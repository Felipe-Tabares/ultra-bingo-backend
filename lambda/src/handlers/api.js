/**
 * Ultra Bingo - REST API Lambda Handler
 * Handles all HTTP requests via API Gateway
 */

import {
  createUser,
  getUserById,
  getUserByWallet,
  updateUser,
  incrementUserStats,
  createCard,
  createCardsBatch,
  getCardById,
  getAvailableCards,
  getCardsByOwner,
  getCardsByWallet,
  getPurchasedCards,
  reserveCards,
  releaseReservation,
  confirmPurchase,
  createGame,
  getCurrentGame,
  updateGame,
  getRecentWinners,
  getWinnersByWallet,
} from '../db/dynamodb.js';

import {
  generateBingoCard,
  generateMultipleCards,
  checkWinner,
  calculateProgress,
  getPatternInfo,
  getAllGameModes,
} from '../services/bingoCard.js';

import {
  generateToken,
  authenticateRequest,
  requireAuth,
  requireAdmin,
  isValidWallet,
  isValidUsername,
  sanitizeInput,
  isAdminWallet,
} from '../middleware/auth.js';

import { validatePayment, calculateAtomicPrice } from '../middleware/x402.js';

import bcrypt from 'bcryptjs';

// Configuration
const config = {
  cardPrice: parseFloat(process.env.CARD_PRICE) || 5,
  maxCardsPerPurchase: 34,
  fibonacciQuantities: [1, 2, 3, 5, 8, 13, 21, 34],
  adminPassword: process.env.ADMIN_PASSWORD,
};

// Allowed origins for CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://bingo.ultravioletadao.xyz',
  'https://ultra-bingo-frontend.vercel.app',
  'https://ultra-bingo-frontend-felipe-tabares.vercel.app',
  'https://ultra-bingo-front.vercel.app',
  'https://ultra-bingo-frontend-five.vercel.app',
].filter(Boolean);

// Add any Vercel preview URLs pattern
const isAllowedOrigin = (origin) => {
  if (!origin) return true; // Allow requests without origin (same-origin)
  if (allowedOrigins.includes(origin)) return true;
  // Allow any Vercel preview deployments
  if (origin.match(/^https:\/\/ultra-bingo.*\.vercel\.app$/)) return true;
  if (origin.match(/^https:\/\/.*-felipe-tabares\.vercel\.app$/)) return true;
  return false;
};

// Get CORS headers for a specific origin
const getCorsHeaders = (origin) => {
  // If origin is allowed, use it; otherwise use first allowed origin or wildcard
  let allowedOrigin = '*';
  if (origin && isAllowedOrigin(origin)) {
    allowedOrigin = origin;
  } else if (allowedOrigins.length > 0 && allowedOrigins[0]) {
    allowedOrigin = allowedOrigins[0];
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-PAYMENT, x-payment, PAYMENT-SIGNATURE, payment-signature',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': 'PAYMENT-REQUIRED, Payment-Required, PAYMENT-RESPONSE, Payment-Response, X-PAYMENT-REQUIRED',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
};

// Current request origin (set in handler)
let currentOrigin = '';

/**
 * Create JSON response with CORS headers
 */
function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(currentOrigin),
    },
    body: JSON.stringify(body),
  };
}

/**
 * Main Lambda handler
 */
export async function handler(event) {
  // Get origin from request headers and set globally for this request
  currentOrigin = event.headers?.origin || event.headers?.Origin || '';

  // Handle CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS' || event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: getCorsHeaders(currentOrigin),
      body: '',
    };
  }

  const method = event.requestContext?.http?.method || event.httpMethod;
  let path = event.rawPath || event.path;

  // Remove stage prefix (e.g., /prod) from path
  const stage = event.requestContext?.stage;
  if (stage && path.startsWith(`/${stage}`)) {
    path = path.slice(stage.length + 1) || '/';
  }

  console.log(`${method} ${path}`);

  try {
    // Route matching
    // Health check
    if (path === '/health' && method === 'GET') {
      return jsonResponse(200, { status: 'ok', timestamp: new Date().toISOString() });
    }

    // Auth routes
    if (path === '/api/auth/register' && method === 'POST') {
      return handleRegister(event);
    }
    if (path === '/api/auth/me' && method === 'GET') {
      return handleGetMe(event);
    }
    if (path === '/api/auth/wallet' && method === 'POST') {
      return handleConnectWallet(event);
    }
    if (path === '/api/auth/cards' && method === 'GET') {
      return handleGetUserCards(event);
    }

    // Card routes
    if (path === '/api/cards/available' && method === 'GET') {
      return handleGetAvailableCards(event);
    }
    if (path === '/api/cards/purchase' && method === 'POST') {
      return handlePurchaseCards(event);
    }
    if (path === '/api/cards/my-cards' && method === 'GET') {
      return handleGetMyCards(event);
    }
    if (path.match(/^\/api\/cards\/[^\/]+$/) && method === 'GET') {
      return handleGetCard(event);
    }

    // Game routes
    if (path === '/api/game/current' && method === 'GET') {
      return handleGetCurrentGame(event);
    }
    if (path === '/api/game/called-numbers' && method === 'GET') {
      return handleGetCalledNumbers(event);
    }
    if (path === '/api/game/status' && method === 'GET') {
      return handleGetGameStatus(event);
    }
    if (path === '/api/game/modes' && method === 'GET') {
      return handleGetGameModes(event);
    }
    if (path.match(/^\/api\/game\/pattern\/[^\/]+$/) && method === 'GET') {
      return handleGetPattern(event);
    }
    if (path === '/api/game/winners' && method === 'GET') {
      return handleGetWinners(event);
    }
    if (path.match(/^\/api\/game\/winners\/0x[a-fA-F0-9]+$/) && method === 'GET') {
      return handleGetWinnersByWallet(event);
    }

    // Admin routes
    if (path === '/api/admin/login' && method === 'POST') {
      return handleAdminLogin(event);
    }
    if (path === '/api/admin/validate' && method === 'GET') {
      return handleAdminValidate(event);
    }
    if (path === '/api/admin/stats' && method === 'GET') {
      return handleAdminStats(event);
    }
    if (path === '/api/admin/game/start' && method === 'POST') {
      return handleAdminStartGame(event);
    }
    if (path === '/api/admin/game/pause' && method === 'POST') {
      return handleAdminPauseGame(event);
    }
    if (path === '/api/admin/game/resume' && method === 'POST') {
      return handleAdminResumeGame(event);
    }
    if (path === '/api/admin/game/end' && method === 'POST') {
      return handleAdminEndGame(event);
    }
    if (path === '/api/admin/game/call' && method === 'POST') {
      return handleAdminCallNumber(event);
    }
    if (path === '/api/admin/game/verify' && method === 'POST') {
      return handleAdminVerifyWinner(event);
    }
    if (path === '/api/admin/game/modes' && method === 'GET') {
      return handleGetGameModes(event);
    }
    if (path === '/api/admin/game/mode' && method === 'POST') {
      return handleAdminSetMode(event);
    }
    if (path === '/api/admin/cards/generate' && method === 'POST') {
      return handleAdminGenerateCards(event);
    }
    if (path === '/api/admin/cards/search' && method === 'GET') {
      return handleAdminSearchCards(event);
    }
    if (path === '/api/admin/cards/active' && method === 'GET') {
      return handleAdminGetActiveCards(event);
    }
    if (path.match(/^\/api\/admin\/cards\/[^\/]+\/details$/) && method === 'GET') {
      return handleAdminGetCardDetails(event);
    }
    if (path === '/api/admin/users' && method === 'GET') {
      return handleAdminGetUsers(event);
    }

    // 404
    return jsonResponse(404, { error: 'Not found' });

  } catch (error) {
    console.error('Handler error:', error);
    return jsonResponse(500, { error: 'Internal server error', message: error.message });
  }
}

// ============================================================================
// AUTH HANDLERS
// ============================================================================

async function handleRegister(event) {
  const body = JSON.parse(event.body || '{}');
  let { username, wallet } = body;

  // Validate and sanitize
  username = sanitizeInput(username)?.toLowerCase();
  wallet = sanitizeInput(wallet);

  if (!isValidUsername(username)) {
    return jsonResponse(400, {
      success: false,
      error: 'Invalid username. Must be 3-30 characters, alphanumeric with underscores/hyphens.',
    });
  }

  if (!isValidWallet(wallet)) {
    return jsonResponse(400, {
      success: false,
      error: 'Invalid wallet address format.',
    });
  }

  // Check if user exists
  let user = await getUserByWallet(wallet);

  if (user) {
    // Update username if different
    if (user.username !== username) {
      user = await updateUser(user.odId, { username, lastLoginAt: new Date().toISOString() });
    } else {
      user = await updateUser(user.odId, { lastLoginAt: new Date().toISOString() });
    }
  } else {
    // Create new user
    const odId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    user = await createUser({
      odId,
      username,
      wallet: wallet.toLowerCase(),
      isAdmin: isAdminWallet(wallet),
    });
  }

  const token = generateToken(user);

  return jsonResponse(200, {
    success: true,
    user: {
      id: user.odId,
      username: user.username,
      wallet: user.wallet,
      isAdmin: user.isAdmin && isAdminWallet(user.wallet),
      stats: user.stats,
    },
    token,
  });
}

async function handleGetMe(event) {
  const authResult = requireAuth(event);
  if (authResult.statusCode) return authResult;

  const user = await getUserById(authResult.odId);
  if (!user) {
    return jsonResponse(404, { error: 'User not found' });
  }

  const cards = await getCardsByOwner(user.odId);

  return jsonResponse(200, {
    id: user.odId,
    username: user.username,
    wallet: user.wallet,
    isAdmin: user.isAdmin && isAdminWallet(user.wallet),
    stats: user.stats,
    cards: cards.map(c => ({ id: c.cardId, numbers: c.numbers })),
    cardCount: cards.length,
  });
}

async function handleConnectWallet(event) {
  const authResult = requireAuth(event);
  if (authResult.statusCode) return authResult;

  const body = JSON.parse(event.body || '{}');
  const wallet = sanitizeInput(body.wallet);

  if (!isValidWallet(wallet)) {
    return jsonResponse(400, { error: 'Invalid wallet address' });
  }

  const user = await updateUser(authResult.odId, {
    wallet: wallet.toLowerCase(),
    isAdmin: isAdminWallet(wallet),
  });

  return jsonResponse(200, { success: true, user });
}

async function handleGetUserCards(event) {
  const authResult = requireAuth(event);
  if (authResult.statusCode) return authResult;

  const cards = await getCardsByOwner(authResult.odId);

  return jsonResponse(200, {
    cards: cards.map(c => ({ id: c.cardId, numbers: c.numbers })),
    count: cards.length,
  });
}

// ============================================================================
// CARD HANDLERS
// ============================================================================

async function handleGetAvailableCards(event) {
  const cards = await getAvailableCards(100);

  return jsonResponse(200, {
    cards: cards.map(c => ({ id: c.cardId, numbers: c.numbers })),
    total: cards.length,
    price: config.cardPrice,
    maxPerPurchase: config.maxCardsPerPurchase,
  });
}

async function handlePurchaseCards(event) {
  const authResult = requireAuth(event);
  if (authResult.statusCode) return authResult;

  const body = JSON.parse(event.body || '{}');
  const { quantity, wallet } = body;

  // Validate quantity is Fibonacci
  if (!config.fibonacciQuantities.includes(quantity)) {
    return jsonResponse(400, {
      success: false,
      error: `Invalid quantity. Must be one of: ${config.fibonacciQuantities.join(', ')}`,
    });
  }

  // Validate wallet
  if (!isValidWallet(wallet)) {
    return jsonResponse(400, { success: false, error: 'Invalid wallet address' });
  }

  // Check if game allows purchases
  const game = await getCurrentGame();
  if (game && (game.status === 'playing' || game.status === 'paused')) {
    return jsonResponse(403, {
      success: false,
      error: 'La venta está bloqueada mientras hay un juego en progreso',
    });
  }

  // Get available cards
  const availableCards = await getAvailableCards(quantity + 10);
  if (availableCards.length < quantity) {
    return jsonResponse(400, {
      success: false,
      error: 'Not enough cards available',
    });
  }

  // Select random cards
  const shuffled = availableCards.sort(() => Math.random() - 0.5);
  const selectedCardIds = shuffled.slice(0, quantity).map(c => c.cardId);

  // Reserve cards
  const reservedIds = await reserveCards(selectedCardIds, authResult.odId);
  if (reservedIds.length < quantity) {
    // Release any partial reservations
    if (reservedIds.length > 0) {
      await releaseReservation(reservedIds, authResult.odId);
    }
    return jsonResponse(409, {
      success: false,
      error: 'Some cards were already reserved. Please try again.',
    });
  }

  // Validate x402 payment
  const paymentResult = await validatePayment(event, quantity);

  if (!paymentResult.valid) {
    // Release reservations
    await releaseReservation(reservedIds, authResult.odId);
    return paymentResult.response;
  }

  // Confirm purchase
  const pricePerCard = parseInt(calculateAtomicPrice(1), 10); // Convert to number for DynamoDB
  const user = await getUserById(authResult.odId);
  const confirmedIds = await confirmPurchase(
    reservedIds,
    authResult.odId,
    wallet.toLowerCase(),
    paymentResult.transaction || 'pending',
    pricePerCard,
    user?.username || authResult.username
  );

  // Update user stats
  await incrementUserStats(authResult.odId, 'cardsPurchased', confirmedIds.length);
  const totalSpent = parseInt(pricePerCard) * confirmedIds.length;
  await incrementUserStats(authResult.odId, 'totalSpent', totalSpent);

  // Get confirmed cards
  const purchasedCards = [];
  for (const cardId of confirmedIds) {
    const card = await getCardById(cardId);
    if (card) {
      purchasedCards.push({
        id: card.cardId,
        numbers: card.numbers,
        owner: card.owner,
        ownerUsername: card.ownerUsername,
        ownerWallet: card.ownerWallet,
      });
    }
  }

  return jsonResponse(200, {
    success: true,
    cards: purchasedCards,
    message: `Successfully purchased ${confirmedIds.length} cards`,
    transaction: paymentResult.transaction,
    errors: [],
  });
}

async function handleGetMyCards(event) {
  const authResult = requireAuth(event);
  if (authResult.statusCode) return authResult;

  // Get user-card associations
  const userCards = await getCardsByOwner(authResult.odId);

  // Fetch full card data for each association
  const cards = [];
  for (const uc of userCards) {
    const card = await getCardById(uc.cardId);
    if (card) {
      cards.push({
        id: card.cardId,
        numbers: card.numbers,
        purchasedAt: uc.purchasedAt || card.purchasedAt,
      });
    }
  }

  return jsonResponse(200, {
    cards,
    count: cards.length,
  });
}

async function handleGetCard(event) {
  const cardId = event.pathParameters?.id || event.rawPath.split('/').pop();
  const card = await getCardById(cardId);

  if (!card) {
    return jsonResponse(404, { error: 'Card not found' });
  }

  // Check ownership
  const user = authenticateRequest(event);
  if (!user?.isAdmin && card.owner !== user?.odId) {
    return jsonResponse(403, { error: 'Access denied' });
  }

  return jsonResponse(200, {
    card: { id: card.cardId, numbers: card.numbers },
    owner: card.owner,
    purchasedAt: card.purchasedAt,
  });
}

// ============================================================================
// GAME HANDLERS
// ============================================================================

async function handleGetCurrentGame(event) {
  const game = await getCurrentGame();

  if (!game) {
    return jsonResponse(200, {
      id: null,
      status: 'waiting',
      gameMode: 'fullCard',
      calledNumbers: [],
      currentNumber: null,
      winner: null,
      canPurchase: true,
      patternInfo: getPatternInfo('fullCard'),
    });
  }

  return jsonResponse(200, {
    id: game.gameId,
    status: game.status,
    gameMode: game.gameMode,
    calledNumbers: game.calledNumbers || [],
    currentNumber: game.currentNumber,
    winner: game.winner,
    startedAt: game.startedAt,
    endedAt: game.endedAt,
    canPurchase: game.status === 'waiting' || game.status === 'ended',
    patternInfo: getPatternInfo(game.gameMode),
  });
}

async function handleGetCalledNumbers(event) {
  const game = await getCurrentGame();

  return jsonResponse(200, {
    calledNumbers: game?.calledNumbers || [],
    count: game?.calledNumbers?.length || 0,
    remaining: 75 - (game?.calledNumbers?.length || 0),
  });
}

async function handleGetGameStatus(event) {
  const game = await getCurrentGame();

  return jsonResponse(200, {
    status: game?.status || 'waiting',
    gameMode: game?.gameMode || 'fullCard',
    currentNumber: game?.currentNumber || null,
    numbersCalledCount: game?.calledNumbers?.length || 0,
    winner: game?.winner || null,
    canPurchase: !game || game.status === 'waiting' || game.status === 'ended',
  });
}

async function handleGetGameModes(event) {
  const modes = getAllGameModes();
  return jsonResponse(200, { modes });
}

async function handleGetPattern(event) {
  const mode = event.pathParameters?.mode || event.rawPath.split('/').pop();
  const pattern = getPatternInfo(mode);

  if (!pattern) {
    return jsonResponse(404, { error: 'Pattern not found' });
  }

  return jsonResponse(200, pattern);
}

async function handleGetWinners(event) {
  const limit = Math.min(parseInt(event.queryStringParameters?.limit) || 10, 50);
  const winners = await getRecentWinners(limit);

  return jsonResponse(200, {
    winners: winners.map(w => ({
      winnerId: w.winnerId,
      odUsername: w.odUsername,
      wallet: w.wallet,
      gameMode: w.gameMode,
      patternName: w.patternName,
      prizeAmount: w.prizeAmount,
      wonAt: w.wonAt,
      cardId: w.cardId,
    })),
    count: winners.length,
  });
}

async function handleGetWinnersByWallet(event) {
  const wallet = event.pathParameters?.wallet || event.rawPath.split('/').pop();

  if (!isValidWallet(wallet)) {
    return jsonResponse(400, { error: 'Invalid wallet address' });
  }

  const limit = Math.min(parseInt(event.queryStringParameters?.limit) || 10, 50);
  const winners = await getWinnersByWallet(wallet, limit);

  return jsonResponse(200, {
    winners,
    count: winners.length,
    wallet,
  });
}

// ============================================================================
// ADMIN HANDLERS
// ============================================================================

async function handleAdminLogin(event) {
  const body = JSON.parse(event.body || '{}');
  const { password, wallet } = body;

  if (!password || !wallet) {
    return jsonResponse(400, { error: 'Password and wallet required' });
  }

  if (!isValidWallet(wallet)) {
    return jsonResponse(400, { error: 'Invalid wallet address' });
  }

  // Check wallet whitelist
  if (!isAdminWallet(wallet)) {
    console.log(`Admin login failed: wallet ${wallet} not in whitelist`);
    return jsonResponse(403, { error: 'Wallet not authorized for admin access' });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, await bcrypt.hash(config.adminPassword, 10));
  // Direct comparison for non-hashed password in config
  if (password !== config.adminPassword) {
    console.log('Admin login failed: invalid password');
    return jsonResponse(401, { error: 'Invalid password' });
  }

  // Get or create admin user
  let user = await getUserByWallet(wallet);
  if (!user) {
    const odId = `admin_${Date.now()}`;
    // Use shortened wallet address as username for new admin users
    const shortWallet = wallet.slice(0, 6) + '...' + wallet.slice(-4);
    user = await createUser({
      odId,
      username: `admin_${shortWallet}`,
      wallet: wallet.toLowerCase(),
      isAdmin: true,
    });
  } else {
    user = await updateUser(user.odId, { isAdmin: true, lastLoginAt: new Date().toISOString() });
  }

  const token = generateToken({ ...user, isAdmin: true });

  return jsonResponse(200, { success: true, token });
}

async function handleAdminValidate(event) {
  const authResult = requireAdmin(event);
  if (authResult.statusCode) return authResult;

  return jsonResponse(200, { valid: true });
}

async function handleAdminStats(event) {
  const authResult = requireAdmin(event);
  if (authResult.statusCode) return authResult;

  const game = await getCurrentGame();
  const availableCards = await getAvailableCards(1000);
  const purchasedCards = await getPurchasedCards();

  return jsonResponse(200, {
    game: {
      status: game?.status || 'waiting',
      gameMode: game?.gameMode || 'fullCard',
      calledNumbers: game?.calledNumbers?.length || 0,
      startedAt: game?.startedAt,
      canPurchase: !game || game.status === 'waiting' || game.status === 'ended',
    },
    cards: {
      available: availableCards.length,
      purchased: purchasedCards.length,
    },
  });
}

async function handleAdminStartGame(event) {
  const authResult = requireAdmin(event);
  if (authResult.statusCode) return authResult;

  // Get current game to preserve mode
  const currentGame = await getCurrentGame();
  const gameMode = currentGame?.gameMode || 'fullCard';

  // Create new game
  const gameId = `game_${Date.now()}`;
  const game = await createGame(gameId, gameMode);

  // Update to playing status
  const updatedGame = await updateGame(gameId, {
    status: 'playing',
    startedAt: new Date().toISOString(),
  });

  return jsonResponse(200, {
    success: true,
    state: updatedGame,
  });
}

async function handleAdminPauseGame(event) {
  const authResult = requireAdmin(event);
  if (authResult.statusCode) return authResult;

  const game = await getCurrentGame();
  if (!game || game.status !== 'playing') {
    return jsonResponse(400, { error: 'No active game to pause' });
  }

  const updatedGame = await updateGame(game.gameId, { status: 'paused' });

  return jsonResponse(200, { success: true, state: updatedGame });
}

async function handleAdminResumeGame(event) {
  const authResult = requireAdmin(event);
  if (authResult.statusCode) return authResult;

  const game = await getCurrentGame();
  if (!game || game.status !== 'paused') {
    return jsonResponse(400, { error: 'No paused game to resume' });
  }

  const updatedGame = await updateGame(game.gameId, { status: 'playing' });

  return jsonResponse(200, { success: true, state: updatedGame });
}

async function handleAdminEndGame(event) {
  const authResult = requireAdmin(event);
  if (authResult.statusCode) return authResult;

  const body = JSON.parse(event.body || '{}');
  const game = await getCurrentGame();

  if (!game) {
    return jsonResponse(400, { error: 'No game to end' });
  }

  const updates = {
    status: 'ended',
    endedAt: new Date().toISOString(),
  };

  if (body.winner) {
    updates.winner = body.winner;
  }

  const updatedGame = await updateGame(game.gameId, updates);

  // Re-enable all cards that were marked as 'won' (rejected winners)
  // so they can participate in future games
  const { reEnableWonCards } = await import('../db/dynamodb.js');
  const reEnabledCount = await reEnableWonCards();
  console.log(`Game ended: Re-enabled ${reEnabledCount} rejected cards`);

  return jsonResponse(200, { success: true, state: updatedGame, reEnabledCards: reEnabledCount });
}

async function handleAdminCallNumber(event) {
  const authResult = requireAdmin(event);
  if (authResult.statusCode) return authResult;

  const body = JSON.parse(event.body || '{}');
  const { number } = body;

  if (!number || number < 1 || number > 75) {
    return jsonResponse(400, { error: 'Invalid number. Must be 1-75.' });
  }

  const game = await getCurrentGame();
  if (!game || game.status !== 'playing') {
    return jsonResponse(400, { error: 'No active game' });
  }

  if (game.calledNumbers?.includes(number)) {
    return jsonResponse(400, { error: 'Number already called' });
  }

  // Import callNumber from dynamodb
  const { callNumber } = await import('../db/dynamodb.js');
  const updatedGame = await callNumber(game.gameId, number);

  // Check for potential winners (will be handled by stream processor)

  return jsonResponse(200, {
    success: true,
    number,
    calledNumbers: updatedGame.calledNumbers,
    state: updatedGame,
  });
}

async function handleAdminVerifyWinner(event) {
  const authResult = requireAdmin(event);
  if (authResult.statusCode) return authResult;

  const body = JSON.parse(event.body || '{}');
  const { cardId } = body;

  if (!cardId) {
    return jsonResponse(400, { error: 'Card ID required' });
  }

  const card = await getCardById(cardId);
  if (!card) {
    return jsonResponse(404, { error: 'Card not found' });
  }

  const game = await getCurrentGame();
  if (!game) {
    return jsonResponse(400, { error: 'No active game' });
  }

  // Check if card is winner
  const result = checkWinner(
    { numbers: card.numbers },
    game.calledNumbers || [],
    game.gameMode
  );

  if (!result.isWinner) {
    return jsonResponse(200, {
      success: false,
      isWinner: false,
      message: 'Card is not a winner',
    });
  }

  // Create winner record
  const { createWinner, reEnableWonCards } = await import('../db/dynamodb.js');
  const winner = await createWinner({
    gameId: game.gameId,
    odId: card.owner,
    odUsername: card.ownerUsername,
    wallet: card.ownerWallet,
    cardId: card.cardId,
    gameMode: game.gameMode,
    patternName: result.modeName,
    totalCalledNumbers: game.calledNumbers.length,
  });

  // End game with winner
  const updatedGame = await updateGame(game.gameId, {
    status: 'ended',
    endedAt: new Date().toISOString(),
    winner: {
      odId: card.owner,
      odUsername: card.ownerUsername,
      wallet: card.ownerWallet,
      cardId: card.cardId,
    },
  });

  // Re-enable all cards that were marked as 'won' (rejected winners)
  // so they can participate in future games
  const reEnabledCount = await reEnableWonCards();
  console.log(`Winner verified: Re-enabled ${reEnabledCount} rejected cards`);

  return jsonResponse(200, {
    success: true,
    isWinner: true,
    winner,
    state: updatedGame,
    reEnabledCards: reEnabledCount,
  });
}

async function handleAdminSetMode(event) {
  const authResult = requireAdmin(event);
  if (authResult.statusCode) return authResult;

  const body = JSON.parse(event.body || '{}');
  const { mode } = body;

  const pattern = getPatternInfo(mode);
  if (!pattern) {
    return jsonResponse(400, { error: 'Invalid game mode' });
  }

  const game = await getCurrentGame();
  if (game && (game.status === 'playing' || game.status === 'paused')) {
    return jsonResponse(400, { error: 'Cannot change mode during active game' });
  }

  let updatedGame;
  if (game) {
    updatedGame = await updateGame(game.gameId, { gameMode: mode });
  } else {
    // Create new game with mode
    const gameId = `game_${Date.now()}`;
    updatedGame = await createGame(gameId, mode);
  }

  return jsonResponse(200, {
    success: true,
    mode,
    patternInfo: pattern,
    state: updatedGame,
  });
}

async function handleAdminGenerateCards(event) {
  const authResult = requireAdmin(event);
  if (authResult.statusCode) return authResult;

  const body = JSON.parse(event.body || '{}');
  const count = Math.min(parseInt(body.count) || 50, 50);

  const cards = generateMultipleCards(count);
  await createCardsBatch(cards);

  const availableCards = await getAvailableCards(1000);

  return jsonResponse(200, {
    success: true,
    generated: count,
    totalAvailable: availableCards.length,
  });
}

async function handleAdminSearchCards(event) {
  const authResult = requireAdmin(event);
  if (authResult.statusCode) return authResult;

  const params = event.queryStringParameters || {};
  const { cardId, wallet, owner } = params;

  if (!cardId && !wallet && !owner) {
    return jsonResponse(400, { error: 'At least one search parameter required' });
  }

  let card = null;

  if (cardId) {
    card = await getCardById(cardId);
  } else if (wallet && isValidWallet(wallet)) {
    const cards = await getCardsByWallet(wallet);
    card = cards[0];
  }

  if (!card) {
    return jsonResponse(404, { error: 'Card not found' });
  }

  const game = await getCurrentGame();
  const progress = game ?
    calculateProgress({ numbers: card.numbers }, game.calledNumbers || [], game.gameMode) :
    { completed: 0, total: 0, percentage: 0 };

  const winnerResult = game ?
    checkWinner({ numbers: card.numbers }, game.calledNumbers || [], game.gameMode) :
    { isWinner: false };

  return jsonResponse(200, {
    card: {
      id: card.cardId,
      numbers: card.numbers,
      owner: card.owner,
      ownerUsername: card.ownerUsername,
      ownerWallet: card.ownerWallet,
      purchasedAt: card.purchasedAt,
      txHash: card.purchaseTxHash,
    },
    progress,
    isWinner: winnerResult.isWinner,
    winnerPattern: winnerResult.pattern,
    gameMode: game?.gameMode,
    calledNumbers: game?.calledNumbers || [],
  });
}

async function handleAdminGetActiveCards(event) {
  const authResult = requireAdmin(event);
  if (authResult.statusCode) return authResult;

  const cards = await getPurchasedCards();
  const game = await getCurrentGame();

  const cardsWithProgress = cards.map(card => {
    const progress = game ?
      calculateProgress({ numbers: card.numbers }, game.calledNumbers || [], game.gameMode) :
      { completed: 0, total: 0, percentage: 0 };

    const winnerResult = game ?
      checkWinner({ numbers: card.numbers }, game.calledNumbers || [], game.gameMode) :
      { isWinner: false };

    return {
      id: card.cardId,
      numbers: card.numbers,
      owner: card.owner,
      ownerUsername: card.ownerUsername,
      ownerWallet: card.ownerWallet,
      progress,
      isWinner: winnerResult.isWinner,
    };
  });

  // Sort by progress percentage descending
  cardsWithProgress.sort((a, b) => b.progress.percentage - a.progress.percentage);

  return jsonResponse(200, {
    cards: cardsWithProgress,
    total: cardsWithProgress.length,
    gameMode: game?.gameMode,
    calledNumbers: game?.calledNumbers || [],
  });
}

async function handleAdminGetCardDetails(event) {
  const authResult = requireAdmin(event);
  if (authResult.statusCode) return authResult;

  const cardId = event.pathParameters?.cardId || event.rawPath.split('/')[4];
  const card = await getCardById(cardId);

  if (!card) {
    return jsonResponse(404, { error: 'Card not found' });
  }

  const game = await getCurrentGame();
  const progress = game ?
    calculateProgress({ numbers: card.numbers }, game.calledNumbers || [], game.gameMode) :
    { completed: 0, total: 0, percentage: 0 };

  const winnerResult = game ?
    checkWinner({ numbers: card.numbers }, game.calledNumbers || [], game.gameMode) :
    { isWinner: false };

  return jsonResponse(200, {
    card: {
      id: card.cardId,
      numbers: card.numbers,
      owner: card.owner,
      ownerUsername: card.ownerUsername,
      ownerWallet: card.ownerWallet,
      purchasedAt: card.purchasedAt,
      txHash: card.purchaseTxHash,
      status: card.status,
    },
    progress,
    isWinner: winnerResult.isWinner,
    patternInfo: getPatternInfo(game?.gameMode || 'fullCard'),
    gameMode: game?.gameMode,
    calledNumbers: game?.calledNumbers || [],
  });
}

async function handleAdminGetUsers(event) {
  const authResult = requireAdmin(event);
  if (authResult.statusCode) return authResult;

  // Scan for all users
  const { scanAllUsers } = await import('../db/dynamodb.js');
  const limit = Math.min(parseInt(event.queryStringParameters?.limit) || 50, 100);
  const users = await scanAllUsers(limit);

  return jsonResponse(200, {
    users: users.map(u => ({
      odId: u.odId,
      username: u.username,
      wallet: u.wallet,
      isAdmin: u.isAdmin,
      stats: u.stats,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    })),
    total: users.length,
  });
}

export default { handler };
