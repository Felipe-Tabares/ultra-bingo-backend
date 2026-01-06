/**
 * Ultra Bingo - WebSocket Message Handler
 * Handles all WebSocket messages including admin actions
 */

import {
  getConnection,
  getCurrentGame,
  updateGame,
  createGame,
  clearCurrentGame,
  getCardById,
  getPurchasedCards,
  markCardAsWon,
  reEnableWonCards,
  createWinner,
  callNumber as dbCallNumber,
} from '../db/dynamodb.js';

import {
  initializeClient,
  getEndpointFromEvent,
  sendToConnection,
  sendError,
  broadcastGameState,
  broadcastNumberCalled,
  broadcastPotentialWinner,
  broadcastWinnerAnnounced,
  broadcastWinnerRejected,
  broadcastGameModeChanged,
  broadcastGameStarted,
  broadcastGamePaused,
  broadcastGameResumed,
  broadcastGameEnded,
  broadcastGameCleared,
} from '../services/broadcast.js';

import {
  checkWinner,
  getPatternInfo,
  getAllGameModes,
} from '../services/bingoCard.js';

export async function handler(event) {
  const connectionId = event.requestContext.connectionId;
  const routeKey = event.requestContext.routeKey;

  console.log(`WebSocket message: ${routeKey} from ${connectionId}`);

  // Initialize broadcast client
  const endpoint = getEndpointFromEvent(event);
  initializeClient(endpoint);

  // Parse message body
  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    body = { action: routeKey };
  }

  const action = body.action || routeKey;

  // Get connection info
  const connection = await getConnection(connectionId);

  try {
    switch (action) {
      case 'join-game':
        return handleJoinGame(connectionId, body, connection);

      case 'leave-game':
        return handleLeaveGame(connectionId, body, connection);

      // Admin actions (support both : and - separators for compatibility)
      case 'admin:start-game':
      case 'admin-start-game':
        return handleAdminStartGame(connectionId, connection);

      case 'admin:pause-game':
      case 'admin-pause-game':
        return handleAdminPauseGame(connectionId, connection);

      case 'admin:resume-game':
      case 'admin-resume-game':
        return handleAdminResumeGame(connectionId, connection);

      case 'admin:end-game':
      case 'admin-end-game':
        return handleAdminEndGame(connectionId, body, connection);

      case 'admin:clear-game':
      case 'admin-clear-game':
        return handleAdminClearGame(connectionId, connection);

      case 'admin:call-number':
      case 'admin-call-number':
        return handleAdminCallNumber(connectionId, body, connection);

      case 'admin:set-game-mode':
      case 'admin-set-game-mode':
        return handleAdminSetGameMode(connectionId, body, connection);

      case 'admin:verify-winner':
      case 'admin-verify-winner':
        return handleAdminVerifyWinner(connectionId, body, connection);

      case 'admin:reject-winner':
      case 'admin-reject-winner':
        return handleAdminRejectWinner(connectionId, body, connection);

      case '$default':
      default:
        // Unknown action - send current game state
        const game = await getCurrentGame();
        await broadcastGameState(game || {
          gameId: null,
          status: 'waiting',
          gameMode: 'fullCard',
          calledNumbers: [],
        });
        return { statusCode: 200, body: 'OK' };
    }
  } catch (error) {
    console.error('Error handling message:', error);
    await sendError(connectionId, error.message);
    return { statusCode: 500, body: error.message };
  }
}

// ============================================================================
// Handler Functions
// ============================================================================

async function handleJoinGame(connectionId, body, connection) {
  const gameId = body.gameId || 'main';

  // Update connection with game room
  // Note: In production, update the connection record
  console.log(`Connection ${connectionId} joined game room: ${gameId}`);

  // Send current game state
  const game = await getCurrentGame();
  await sendToConnection(connectionId, {
    type: 'game-state',
    data: {
      id: game?.gameId || null,
      status: game?.status || 'waiting',
      gameMode: game?.gameMode || 'fullCard',
      calledNumbers: game?.calledNumbers || [],
      currentNumber: game?.currentNumber || null,
      winner: game?.winner || null,
      canPurchase: !game || game.status === 'waiting' || game.status === 'ended',
    },
    timestamp: new Date().toISOString(),
  });

  return { statusCode: 200, body: 'Joined' };
}

async function handleLeaveGame(connectionId, body, connection) {
  console.log(`Connection ${connectionId} left game room`);
  return { statusCode: 200, body: 'Left' };
}

// ============================================================================
// Admin Handlers
// ============================================================================

function requireAdmin(connection, connectionId) {
  if (!connection?.isAdmin) {
    sendError(connectionId, 'Admin access required');
    return false;
  }
  return true;
}

async function handleAdminStartGame(connectionId, connection) {
  if (!requireAdmin(connection, connectionId)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  // Get current game to preserve mode
  const currentGame = await getCurrentGame();
  const gameMode = currentGame?.gameMode || 'fullCard';

  // Create new game
  const gameId = `game_${Date.now()}`;
  await createGame(gameId, gameMode);

  // Update to playing
  const game = await updateGame(gameId, {
    status: 'playing',
    startedAt: new Date().toISOString(),
  });

  // Broadcast to all
  await broadcastGameStarted(game);
  await broadcastGameState(game);

  return { statusCode: 200, body: 'Game started' };
}

async function handleAdminPauseGame(connectionId, connection) {
  if (!requireAdmin(connection, connectionId)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const game = await getCurrentGame();
  if (!game || game.status !== 'playing') {
    await sendError(connectionId, 'No active game to pause');
    return { statusCode: 400, body: 'No active game' };
  }

  const updatedGame = await updateGame(game.gameId, { status: 'paused' });

  await broadcastGamePaused(updatedGame);
  await broadcastGameState(updatedGame);

  return { statusCode: 200, body: 'Game paused' };
}

async function handleAdminResumeGame(connectionId, connection) {
  if (!requireAdmin(connection, connectionId)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const game = await getCurrentGame();
  if (!game || game.status !== 'paused') {
    await sendError(connectionId, 'No paused game to resume');
    return { statusCode: 400, body: 'No paused game' };
  }

  const updatedGame = await updateGame(game.gameId, { status: 'playing' });

  await broadcastGameResumed(updatedGame);
  await broadcastGameState(updatedGame);

  return { statusCode: 200, body: 'Game resumed' };
}

async function handleAdminEndGame(connectionId, body, connection) {
  if (!requireAdmin(connection, connectionId)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const game = await getCurrentGame();
  if (!game) {
    await sendError(connectionId, 'No game to end');
    return { statusCode: 400, body: 'No game' };
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
  const reEnabledCount = await reEnableWonCards();
  console.log(`Game ended via WS: Re-enabled ${reEnabledCount} rejected cards`);

  await broadcastGameEnded(updatedGame);
  await broadcastGameState(updatedGame);

  return { statusCode: 200, body: 'Game ended' };
}

async function handleAdminClearGame(connectionId, connection) {
  if (!requireAdmin(connection, connectionId)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  // Clear the current game from database
  await clearCurrentGame();

  // Broadcast that game was cleared
  await broadcastGameCleared();

  // Send empty game state
  await broadcastGameState({
    gameId: null,
    status: 'waiting',
    gameMode: 'fullCard',
    calledNumbers: [],
    currentNumber: null,
    winner: null,
  });

  return { statusCode: 200, body: 'Game cleared' };
}

async function handleAdminCallNumber(connectionId, body, connection) {
  if (!requireAdmin(connection, connectionId)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const { number } = body;

  if (!number || number < 1 || number > 75) {
    await sendError(connectionId, 'Invalid number. Must be 1-75.');
    return { statusCode: 400, body: 'Invalid number' };
  }

  const game = await getCurrentGame();
  if (!game || game.status !== 'playing') {
    await sendError(connectionId, 'No active game');
    return { statusCode: 400, body: 'No active game' };
  }

  if (game.calledNumbers?.includes(number)) {
    await sendError(connectionId, 'Number already called');
    return { statusCode: 400, body: 'Already called' };
  }

  // Call the number
  const updatedGame = await dbCallNumber(game.gameId, number);

  // Broadcast number called
  await broadcastNumberCalled(number, updatedGame.calledNumbers);

  // Check for potential winners
  const purchasedCards = await getPurchasedCards();
  console.log(`[Winner Check] Checking ${purchasedCards.length} purchased cards for potential winners`);
  console.log(`[Winner Check] Game mode: ${updatedGame.gameMode}, Called numbers count: ${updatedGame.calledNumbers.length}`);
  console.log(`[Winner Check] Called numbers: ${JSON.stringify(updatedGame.calledNumbers)}`);

  // Log first card structure for debugging
  if (purchasedCards.length > 0) {
    const firstCard = purchasedCards[0];
    console.log(`[Winner Check] First card ID: ${firstCard.cardId}`);
    console.log(`[Winner Check] First card B column: ${JSON.stringify(firstCard.numbers?.B)}`);
    console.log(`[Winner Check] First card number type: ${typeof firstCard.numbers?.B?.[0]}`);
  }

  for (const card of purchasedCards) {
    // Skip already won cards
    if (card.status === 'won') {
      console.log(`[Winner Check] Skipping card ${card.cardId} - status is 'won'`);
      continue;
    }

    const result = checkWinner(
      { numbers: card.numbers },
      updatedGame.calledNumbers,
      updatedGame.gameMode
    );

    console.log(`[Winner Check] Card ${card.cardId.slice(-6)}: isWinner=${result.isWinner}`);

    if (result.isWinner) {
      // Pause game
      await updateGame(game.gameId, { status: 'paused' });

      // Broadcast potential winner
      await broadcastPotentialWinner({
        cardId: card.cardId,
        cardNumbers: card.numbers,
        owner: card.owner,
        username: card.ownerUsername,
        wallet: card.ownerWallet,
        pattern: result.pattern,
        gameMode: updatedGame.gameMode,
        detectedAt: new Date().toISOString(),
      });

      await broadcastGamePaused(
        { ...updatedGame, status: 'paused' },
        'potential-winner'
      );

      break; // Only report first winner
    }
  }

  // Broadcast updated game state
  await broadcastGameState(updatedGame);

  return { statusCode: 200, body: 'Number called' };
}

async function handleAdminSetGameMode(connectionId, body, connection) {
  if (!requireAdmin(connection, connectionId)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const { mode } = body;
  const pattern = getPatternInfo(mode);

  if (!pattern) {
    await sendError(connectionId, 'Invalid game mode');
    return { statusCode: 400, body: 'Invalid mode' };
  }

  const game = await getCurrentGame();
  if (game && (game.status === 'playing' || game.status === 'paused')) {
    await sendError(connectionId, 'Cannot change mode during active game');
    return { statusCode: 400, body: 'Game in progress' };
  }

  let updatedGame;
  if (game) {
    updatedGame = await updateGame(game.gameId, { gameMode: mode });
  } else {
    const gameId = `game_${Date.now()}`;
    updatedGame = await createGame(gameId, mode);
  }

  await broadcastGameModeChanged(mode, pattern);
  await broadcastGameState(updatedGame);

  return { statusCode: 200, body: 'Mode changed' };
}

async function handleAdminVerifyWinner(connectionId, body, connection) {
  if (!requireAdmin(connection, connectionId)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const { cardId } = body;

  if (!cardId) {
    await sendError(connectionId, 'Card ID required');
    return { statusCode: 400, body: 'Card ID required' };
  }

  const card = await getCardById(cardId);
  if (!card) {
    await sendError(connectionId, 'Card not found');
    return { statusCode: 404, body: 'Card not found' };
  }

  const game = await getCurrentGame();
  if (!game) {
    await sendError(connectionId, 'No active game');
    return { statusCode: 400, body: 'No game' };
  }

  // Verify winner
  const result = checkWinner(
    { numbers: card.numbers },
    game.calledNumbers || [],
    game.gameMode
  );

  if (!result.isWinner) {
    await sendToConnection(connectionId, {
      type: 'verification-result',
      data: { isWinner: false, cardId },
      timestamp: new Date().toISOString(),
    });
    return { statusCode: 200, body: 'Not a winner' };
  }

  // Create winner record
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
      pattern: result.pattern,
      patternName: result.modeName,
      gameMode: game.gameMode,
    },
  });

  // Re-enable all cards that were marked as 'won' (rejected winners)
  // so they can participate in future games
  const reEnabledCount = await reEnableWonCards();
  console.log(`Winner verified via WS: Re-enabled ${reEnabledCount} rejected cards`);

  // Broadcast winner
  await broadcastWinnerAnnounced(updatedGame.winner);
  await broadcastGameEnded(updatedGame);
  await broadcastGameState(updatedGame);

  return { statusCode: 200, body: 'Winner verified' };
}

async function handleAdminRejectWinner(connectionId, body, connection) {
  if (!requireAdmin(connection, connectionId)) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  const { cardId } = body;

  if (!cardId) {
    await sendError(connectionId, 'Card ID required');
    return { statusCode: 400, body: 'Card ID required' };
  }

  // Mark card as won (disabled)
  await markCardAsWon(cardId);

  // Resume game
  const game = await getCurrentGame();
  if (game && game.status === 'paused') {
    await updateGame(game.gameId, { status: 'playing' });
  }

  // Broadcast rejection
  await broadcastWinnerRejected(cardId);

  const updatedGame = await getCurrentGame();
  await broadcastGameResumed(updatedGame);
  await broadcastGameState(updatedGame);

  return { statusCode: 200, body: 'Winner rejected' };
}

export default { handler };
