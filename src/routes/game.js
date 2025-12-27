import { Router } from 'express';
import gameState from '../services/gameState.js';

const router = Router();

/**
 * GET /api/game/current
 * Get current game state (including game mode and purchase status)
 */
router.get('/current', async (req, res) => {
  try {
    const state = await gameState.getGameState();
    const patternInfo = gameState.getPatternInfoForMode(state.gameMode);

    res.json({
      ...state,
      patternInfo,
    });
  } catch (error) {
    console.error('Error getting game state:', error);
    res.status(500).json({ error: 'Failed to get game state' });
  }
});

/**
 * GET /api/game/called-numbers
 * Get all called numbers
 */
router.get('/called-numbers', async (req, res) => {
  try {
    const calledNumbers = await gameState.getCalledNumbers();
    res.json({
      calledNumbers,
      count: calledNumbers.length,
      remaining: 75 - calledNumbers.length,
    });
  } catch (error) {
    console.error('Error getting called numbers:', error);
    res.status(500).json({ error: 'Failed to get called numbers' });
  }
});

/**
 * GET /api/game/status
 * Get game status (including canPurchase for frontend)
 */
router.get('/status', async (req, res) => {
  try {
    const state = await gameState.getGameState();
    res.json({
      status: state.status,
      gameMode: state.gameMode,
      currentNumber: state.currentNumber,
      numbersCalledCount: state.calledNumbers.length,
      winner: state.winner,
      canPurchase: state.canPurchase,
    });
  } catch (error) {
    console.error('Error getting game status:', error);
    res.status(500).json({ error: 'Failed to get game status' });
  }
});

/**
 * GET /api/game/modes
 * Get all available game modes (public endpoint)
 */
router.get('/modes', (req, res) => {
  try {
    const patterns = gameState.getAvailablePatterns();
    const modes = Object.entries(patterns).map(([key, pattern]) => ({
      key,
      name: pattern.name,
      description: pattern.description,
      positions: pattern.positions,
      isSpecialPattern: pattern.isSpecialPattern || false,
    }));

    res.json({ modes });
  } catch (error) {
    console.error('Error getting game modes:', error);
    res.status(500).json({ error: 'Failed to get game modes' });
  }
});

/**
 * GET /api/game/pattern/:mode
 * Get pattern info for a specific mode
 */
router.get('/pattern/:mode', (req, res) => {
  try {
    const { mode } = req.params;
    const patternInfo = gameState.getPatternInfoForMode(mode);

    if (!patternInfo) {
      return res.status(404).json({ error: 'Mode not found' });
    }

    res.json(patternInfo);
  } catch (error) {
    console.error('Error getting pattern info:', error);
    res.status(500).json({ error: 'Failed to get pattern info' });
  }
});

/**
 * GET /api/game/winners
 * Get recent winners history (public endpoint)
 */
router.get('/winners', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50
    const winners = await gameState.getRecentWinners(limit);

    res.json({
      winners,
      count: winners.length,
    });
  } catch (error) {
    console.error('Error getting winners:', error);
    res.status(500).json({ error: 'Failed to get winners' });
  }
});

/**
 * GET /api/game/winners/:wallet
 * Get winners by wallet address
 */
router.get('/winners/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;

    // Validate wallet format
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return res.status(400).json({ error: 'Invalid wallet format' });
    }

    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const winners = await gameState.getWinnersByWallet(wallet, limit);

    res.json({
      winners,
      count: winners.length,
      wallet,
    });
  } catch (error) {
    console.error('Error getting winners by wallet:', error);
    res.status(500).json({ error: 'Failed to get winners' });
  }
});

export default router;
