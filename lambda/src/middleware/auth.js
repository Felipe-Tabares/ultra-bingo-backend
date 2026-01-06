/**
 * Ultra Bingo - Authentication Middleware for Lambda
 * JWT validation and admin verification
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '')
  .split(',')
  .map(w => w.trim().toLowerCase())
  .filter(Boolean);

/**
 * Generate JWT token for user
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.odId,
      username: user.username,
      wallet: user.wallet.toLowerCase(),
      isAdmin: user.isAdmin || false,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractToken(headers) {
  const authHeader = headers?.authorization || headers?.Authorization;

  if (!authHeader) {
    return null;
  }

  // Support "Bearer <token>" format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return authHeader;
}

/**
 * Authenticate request - returns user data or null
 */
export function authenticateRequest(event) {
  const token = extractToken(event.headers);

  if (!token) {
    return null;
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return null;
  }

  return {
    id: decoded.id,
    odId: decoded.id,
    username: decoded.username,
    wallet: decoded.wallet,
    isAdmin: decoded.isAdmin && isAdminWallet(decoded.wallet),
  };
}

/**
 * Check if wallet is in admin whitelist
 */
export function isAdminWallet(wallet) {
  if (!wallet) return false;
  return ADMIN_WALLETS.includes(wallet.toLowerCase());
}

/**
 * Require authentication - returns error response if not authenticated
 */
export function requireAuth(event) {
  const user = authenticateRequest(event);

  if (!user) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Authentication required',
      }),
    };
  }

  return user;
}

/**
 * Require admin authentication - returns error response if not admin
 */
export function requireAdmin(event) {
  const user = authenticateRequest(event);

  if (!user) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Authentication required',
      }),
    };
  }

  if (!user.isAdmin) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Admin access required',
      }),
    };
  }

  return user;
}

/**
 * Validate Ethereum wallet address format
 */
export function isValidWallet(wallet) {
  if (!wallet || typeof wallet !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(wallet);
}

/**
 * Validate username format
 */
export function isValidUsername(username) {
  if (!username || typeof username !== 'string') return false;
  if (username.length < 3 || username.length > 30) return false;
  return /^[a-zA-Z0-9_-]+$/.test(username);
}

/**
 * Sanitize input string - remove dangerous characters
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  // Remove null bytes and control characters
  return input.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

export default {
  generateToken,
  verifyToken,
  extractToken,
  authenticateRequest,
  isAdminWallet,
  requireAuth,
  requireAdmin,
  isValidWallet,
  isValidUsername,
  sanitizeInput,
  ADMIN_WALLETS,
};
