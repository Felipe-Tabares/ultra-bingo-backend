import { Router } from 'express';
import { verifyToken, optionalAuth } from '../middleware/auth.js';
import { rateLimit, validateFibonacciQuantity, auditLog } from '../middleware/security.js';
import gameState from '../services/gameState.js';
import bingoCard from '../services/bingoCard.js';
import { config } from '../config/index.js';

const router = Router();

// SECURITY: Valid Fibonacci quantities for card purchase
const VALID_QUANTITIES = [1, 2, 3, 5, 8, 13, 21, 34];

/**
 * GET /api/cards/available
 * Get available cards for purchase
 */
router.get('/available', async (req, res) => {
  try {
    // Get the real count of available cards
    const totalAvailable = await gameState.countAvailableCards();

    // Get cards for display (limited for performance)
    const cards = await gameState.getAvailableCards(50);

    res.json({
      cards,
      total: totalAvailable,
      price: config.cardPrice,
      maxPerPurchase: config.maxCardsPerPurchase,
    });
  } catch (error) {
    console.error('Error getting available cards:', error);
    res.status(500).json({ error: 'Failed to get available cards' });
  }
});

/**
 * POST /api/cards/purchase
 * Purchase cards by quantity (random assignment)
 * Protected by x402 payment middleware (configured in index.js)
 * SECURITY: Rate limited, Fibonacci quantities only, no manual card selection
 */
router.post('/purchase', rateLimit('purchase'), verifyToken, async (req, res) => {
  try {
    const { quantity, wallet } = req.body;
    const userId = req.user.userId;

    // SECURITY CRITICAL: Check if purchases are allowed (game not in progress)
    const canPurchase = await gameState.canPurchaseCards();
    if (!canPurchase) {
      auditLog({
        action: 'PURCHASE_BLOCKED_GAME_ACTIVE',
        reason: 'Attempted purchase during active game',
        userId,
        quantity,
        ip: req.ip,
      });
      return res.status(403).json({
        error: 'La venta de cartones está bloqueada mientras hay un juego en progreso. Espera a que termine la partida actual.',
        code: 'GAME_IN_PROGRESS',
      });
    }

    // SECURITY: Block cardIds - manual selection is NOT allowed
    if (req.body.cardIds) {
      auditLog({
        action: 'SUSPICIOUS_ACTIVITY',
        reason: 'Attempted manual cardIds selection',
        userId,
        ip: req.ip,
        cardIds: req.body.cardIds,
      });
      return res.status(400).json({
        error: 'Manual card selection is not allowed. Use quantity parameter.',
      });
    }

    // SECURITY: Validate quantity is a Fibonacci number
    if (!quantity || typeof quantity !== 'number') {
      return res.status(400).json({
        error: 'Quantity is required and must be a number',
      });
    }

    if (!VALID_QUANTITIES.includes(quantity)) {
      auditLog({
        action: 'INVALID_QUANTITY_ATTEMPT',
        userId,
        quantity,
        ip: req.ip,
      });
      return res.status(400).json({
        error: `Invalid quantity. Must be a Fibonacci number: ${VALID_QUANTITIES.join(', ')}`,
      });
    }

    // SECURITY CRITICAL: Validate that x402 payment was successful BEFORE processing
    // This route is protected by x402 middleware, but we must verify payment was valid
    if (!req.x402Payment) {
      auditLog({
        action: 'PURCHASE_WITHOUT_PAYMENT',
        reason: 'No x402 payment info on request',
        userId,
        quantity,
        ip: req.ip,
      });
      return res.status(402).json({
        error: 'Payment required. x402 payment not processed.',
      });
    }

    // SECURITY: Verify payment was actually validated and settled
    if (!req.x402Payment.valid) {
      auditLog({
        action: 'PURCHASE_INVALID_PAYMENT',
        reason: 'x402 payment marked as invalid',
        userId,
        quantity,
        paymentInfo: req.x402Payment,
        ip: req.ip,
      });
      return res.status(402).json({
        error: 'Payment validation failed.',
      });
    }

    // SECURITY: Require transaction hash as proof of blockchain payment
    const txHash = req.x402Payment.transaction;
    if (!txHash) {
      auditLog({
        action: 'PURCHASE_NO_TX_HASH',
        reason: 'No transaction hash in payment info',
        userId,
        quantity,
        paymentInfo: req.x402Payment,
        ip: req.ip,
      });
      return res.status(402).json({
        error: 'Payment transaction not confirmed.',
      });
    }

    // Ensure we have enough cards before processing
    await gameState.ensureAvailableCards(quantity, 50);

    // Get available cards randomly
    const availableCards = await gameState.getAvailableCards(quantity);
    if (availableCards.length < quantity) {
      return res.status(400).json({
        error: `Not enough cards available. Requested: ${quantity}, Available: ${availableCards.length}`,
      });
    }

    const cardsToAssign = availableCards.slice(0, quantity).map(c => c.id);
    // Price per card in atomic USDC units (6 decimals)
    const pricePerCard = Math.round(config.cardPrice * 1_000_000).toString();

    // SECURITY: Reserve cards FIRST to prevent race conditions
    // This ensures no other user can buy these same cards while we process
    const reservedCards = await gameState.reserveCards(cardsToAssign, userId, 5);

    if (reservedCards.length === 0) {
      auditLog({
        action: 'PURCHASE_RESERVATION_FAILED',
        reason: 'Could not reserve any cards',
        userId,
        quantity,
        requestedCards: cardsToAssign,
        ip: req.ip,
      });
      return res.status(409).json({
        error: 'Cards no longer available. Please try again with different cards.',
      });
    }

    if (reservedCards.length < quantity) {
      // Release partial reservation and fail
      const reservedIds = reservedCards.map(c => c.id);
      await gameState.releaseReservation(reservedIds, userId);
      auditLog({
        action: 'PURCHASE_PARTIAL_RESERVATION',
        reason: 'Could only reserve some cards',
        userId,
        quantity,
        reserved: reservedCards.length,
        ip: req.ip,
      });
      return res.status(409).json({
        error: `Only ${reservedCards.length} of ${quantity} cards were available. Please try again.`,
      });
    }

    // SECURITY: Now confirm the reservation with the payment transaction
    const reservedIds = reservedCards.map(c => c.id);
    const result = await gameState.confirmReservation(
      reservedIds,
      userId,
      wallet,
      txHash,
      pricePerCard
    );

    const purchasedCards = result.cards;
    const errors = result.success ? [] : [{ error: 'Failed to confirm reservation' }];

    // Update user's wallet if provided
    if (wallet) {
      await gameState.upsertUser(userId, { wallet });
    }

    if (purchasedCards.length === 0) {
      return res.status(400).json({
        error: 'No cards could be purchased',
        details: errors,
      });
    }

    // Update user stats (non-critical, don't fail the purchase if this errors)
    try {
      await gameState.incrementUserStats(userId, 'cardsPurchased', purchasedCards.length);
      // Calculate total spent (cards purchased * price per card)
      const totalSpent = purchasedCards.length * parseInt(pricePerCard);
      if (totalSpent > 0) {
        await gameState.incrementUserStats(userId, 'totalSpent', totalSpent.toString());
      }
    } catch (statsErr) {
      console.error('Error updating user stats (non-critical):', statsErr.message);
    }

    res.json({
      success: true,
      cards: purchasedCards,
      message: `Successfully purchased ${purchasedCards.length} cards`,
      transaction: txHash,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Purchase error:', err);
    res.status(500).json({ error: 'Failed to process purchase' });
  }
});

/**
 * GET /api/cards/my-cards
 * Get user's purchased cards
 */
router.get('/my-cards', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const cards = await gameState.getCardsByOwner(userId);

    res.json({
      cards,
      count: cards.length,
    });
  } catch (error) {
    console.error('Error getting user cards:', error);
    res.status(500).json({ error: 'Failed to get cards' });
  }
});

/**
 * GET /api/cards/:id
 * Get a specific card by ID
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const purchasedCard = await gameState.getPurchasedCard(id);

    if (!purchasedCard) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Only return card details if user owns it or is admin
    if (req.user?.userId !== purchasedCard.owner && !req.user?.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      card: purchasedCard.card,
      owner: purchasedCard.owner,
      purchasedAt: purchasedCard.purchasedAt,
    });
  } catch (error) {
    console.error('Error getting card:', error);
    res.status(500).json({ error: 'Failed to get card' });
  }
});

export default router;
