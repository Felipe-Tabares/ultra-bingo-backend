import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { generateToken } from '../middleware/auth.js';
import { rateLimit, auditLog } from '../middleware/security.js';
import gameState from '../services/gameState.js';

const router = Router();

/**
 * POST /auth/register
 * Register or login user with username + wallet
 * Simple auth system: username + wallet address
 * SECURITY: Rate limited to prevent brute force
 */
router.post('/register', rateLimit('register'), async (req, res) => {
  try {
    const { username, wallet } = req.body;

    // Validate required fields
    if (!username || !wallet) {
      return res.status(400).json({
        error: 'Username and wallet address are required'
      });
    }

    // SECURITY: Validate username format strictly
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      return res.status(400).json({
        error: 'Username must be at least 3 characters'
      });
    }

    if (trimmedUsername.length > 30) {
      return res.status(400).json({
        error: 'Username must be 30 characters or less'
      });
    }

    // SECURITY: Only allow safe characters in username (alphanumeric, underscore, hyphen)
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      return res.status(400).json({
        error: 'Username can only contain letters, numbers, underscores, and hyphens'
      });
    }

    // Validate wallet address format (Ethereum address)
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return res.status(400).json({
        error: 'Invalid wallet address format'
      });
    }

    // Check if wallet is in admin whitelist
    const isAdmin = config.adminWallets.includes(wallet.toLowerCase());

    // Check if wallet is already registered
    const existingUserByWallet = await gameState.getUserByWallet(wallet);

    if (existingUserByWallet) {
      // User exists - update username if different and return
      const user = await gameState.upsertUser(existingUserByWallet.id, {
        username: trimmedUsername,
        wallet: wallet.toLowerCase(),
        isAdmin,
      });

      const token = generateToken({
        userId: user.id,
        username: user.username,
        wallet: user.wallet,
        isAdmin,
      });


      // SECURITY: Audit log for admin logins
      if (isAdmin) {
        auditLog({
          action: 'ADMIN_LOGIN',
          userId: user.id,
          username: user.username,
          wallet: user.wallet,
          ip: req.ip,
        });
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          wallet: user.wallet,
          isAdmin,
          stats: user.stats,
        },
        token,
        message: 'Welcome back!',
      });
    }

    // Create new user
    const userId = `user_${wallet.toLowerCase()}`;
    const user = await gameState.upsertUser(userId, {
      username: trimmedUsername,
      wallet: wallet.toLowerCase(),
      isAdmin,
    });

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      wallet: user.wallet,
      isAdmin,
    });


    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        wallet: user.wallet,
        isAdmin,
        stats: user.stats,
      },
      token,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * GET /auth/me
 * Get current user info
 */
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await gameState.getUser(decoded.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's cards
    const cards = await gameState.getCardsByOwner(user.id);

    res.json({
      id: user.id,
      username: user.username,
      wallet: user.wallet,
      isAdmin: user.isAdmin || false,
      stats: user.stats,
      cards: cards,
      cardCount: cards.length,
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * POST /auth/wallet
 * Associate wallet with user (for future use if needed)
 */
router.post('/wallet', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const token = authHeader.split(' ')[1];
  const { wallet } = req.body;

  if (!wallet) {
    return res.status(400).json({ error: 'Wallet address required' });
  }

  // Validate wallet address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return res.status(400).json({
      error: 'Invalid wallet address format'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await gameState.upsertUser(decoded.userId, {
      wallet: wallet.toLowerCase()
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        wallet: user.wallet,
        isAdmin: user.isAdmin || false,
      },
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * GET /auth/cards
 * Get current user's purchased cards
 */
router.get('/cards', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const cards = await gameState.getCardsByOwner(decoded.userId);

    res.json({
      cards,
      count: cards.length,
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
