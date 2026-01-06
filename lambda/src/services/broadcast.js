/**
 * Ultra Bingo - WebSocket Broadcast Service
 * Uses API Gateway Management API to send messages to connected clients
 */

import { ApiGatewayManagementApiClient, PostToConnectionCommand, DeleteConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { scanAllConnections, deleteConnection } from '../db/dynamodb.js';

let apiGatewayClient = null;

/**
 * Initialize API Gateway Management API client
 * Called with the endpoint from the WebSocket event
 */
export function initializeClient(endpoint) {
  if (!apiGatewayClient || apiGatewayClient.endpoint !== endpoint) {
    apiGatewayClient = new ApiGatewayManagementApiClient({
      endpoint,
      region: process.env.AWS_REGION || 'us-east-1',
    });
    apiGatewayClient.endpoint = endpoint;
  }
  return apiGatewayClient;
}

/**
 * Get API Gateway endpoint from Lambda event
 */
export function getEndpointFromEvent(event) {
  const { domainName, stage } = event.requestContext;
  return `https://${domainName}/${stage}`;
}

/**
 * Send message to a single connection
 */
export async function sendToConnection(connectionId, data) {
  if (!apiGatewayClient) {
    console.error('API Gateway client not initialized');
    return false;
  }

  try {
    await apiGatewayClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(data),
    }));
    return true;
  } catch (error) {
    if (error.statusCode === 410 || error.name === 'GoneException') {
      // Connection is stale, remove it
      console.log(`Removing stale connection: ${connectionId}`);
      await deleteConnection(connectionId);
    } else {
      console.error(`Error sending to connection ${connectionId}:`, error);
    }
    return false;
  }
}

/**
 * Broadcast message to all connected clients
 */
export async function broadcast(data, filter = null) {
  const connections = await scanAllConnections();

  const results = await Promise.allSettled(
    connections
      .filter(conn => !filter || filter(conn))
      .map(conn => sendToConnection(conn.connectionId, data))
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const failed = results.length - successful;

  console.log(`Broadcast complete: ${successful} sent, ${failed} failed`);

  return { successful, failed, total: results.length };
}

/**
 * Broadcast to specific game room
 */
export async function broadcastToRoom(gameRoom, data) {
  return broadcast(data, conn => conn.gameRoom === gameRoom);
}

/**
 * Broadcast to all clients except admin
 */
export async function broadcastToPlayers(data) {
  return broadcast(data, conn => !conn.isAdmin);
}

/**
 * Broadcast to admin clients only
 */
export async function broadcastToAdmins(data) {
  return broadcast(data, conn => conn.isAdmin === true);
}

/**
 * Send error message to a connection
 */
export async function sendError(connectionId, message) {
  return sendToConnection(connectionId, {
    type: 'error',
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast game state update
 */
export async function broadcastGameState(game) {
  const payload = {
    type: 'game-state',
    data: {
      id: game.gameId,
      status: game.status,
      gameMode: game.gameMode,
      calledNumbers: game.calledNumbers || [],
      currentNumber: game.currentNumber,
      winner: game.winner,
      canPurchase: game.status === 'waiting' || game.status === 'ended',
    },
    timestamp: new Date().toISOString(),
  };

  return broadcast(payload);
}

/**
 * Broadcast number called event
 */
export async function broadcastNumberCalled(number, calledNumbers) {
  return broadcast({
    type: 'number-called',
    data: {
      number,
      calledNumbers,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast potential winner detected
 */
export async function broadcastPotentialWinner(winnerData) {
  return broadcast({
    type: 'potential-winner',
    data: winnerData,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast winner announced
 */
export async function broadcastWinnerAnnounced(winner) {
  return broadcast({
    type: 'winner-announced',
    data: { winner },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast winner rejected
 */
export async function broadcastWinnerRejected(cardId) {
  return broadcast({
    type: 'winner-rejected',
    data: {
      cardId,
      disabled: true,
      rejectedAt: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast game mode changed
 */
export async function broadcastGameModeChanged(mode, patternInfo) {
  return broadcast({
    type: 'game-mode-changed',
    data: {
      mode,
      patternInfo,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast game started
 */
export async function broadcastGameStarted(game) {
  return broadcast({
    type: 'game-started',
    data: {
      id: game.gameId,
      status: game.status,
      gameMode: game.gameMode,
      startedAt: game.startedAt,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast game paused
 */
export async function broadcastGamePaused(game, reason = null) {
  return broadcast({
    type: 'game-paused',
    data: {
      id: game.gameId,
      status: game.status,
      reason,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast game resumed
 */
export async function broadcastGameResumed(game) {
  return broadcast({
    type: 'game-resumed',
    data: {
      id: game.gameId,
      status: game.status,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast game ended
 */
export async function broadcastGameEnded(game) {
  return broadcast({
    type: 'game-ended',
    data: {
      id: game.gameId,
      status: game.status,
      winner: game.winner,
      endedAt: game.endedAt,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast game cleared
 */
export async function broadcastGameCleared() {
  return broadcast({
    type: 'game-cleared',
    data: {},
    timestamp: new Date().toISOString(),
  });
}

export default {
  initializeClient,
  getEndpointFromEvent,
  sendToConnection,
  broadcast,
  broadcastToRoom,
  broadcastToPlayers,
  broadcastToAdmins,
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
};
