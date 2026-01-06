/**
 * Ultra Bingo - DynamoDB Stream Processor
 * Handles real-time updates by processing DynamoDB stream events
 * Broadcasts changes to connected WebSocket clients
 */

import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { scanAllConnections, deleteConnection } from '../db/dynamodb.js';
import { checkWinner, getPatternInfo } from '../services/bingoCard.js';

// WebSocket API endpoint - must be set in environment
const WEBSOCKET_ENDPOINT = process.env.WEBSOCKET_ENDPOINT;

let apiGatewayClient = null;

function getApiGatewayClient() {
  if (!apiGatewayClient && WEBSOCKET_ENDPOINT) {
    apiGatewayClient = new ApiGatewayManagementApiClient({
      endpoint: WEBSOCKET_ENDPOINT,
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return apiGatewayClient;
}

/**
 * Send message to a single connection
 */
async function sendToConnection(connectionId, data) {
  const client = getApiGatewayClient();
  if (!client) {
    console.error('WebSocket endpoint not configured');
    return false;
  }

  try {
    await client.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(data),
    }));
    return true;
  } catch (error) {
    if (error.statusCode === 410 || error.name === 'GoneException') {
      console.log(`Removing stale connection: ${connectionId}`);
      await deleteConnection(connectionId);
    } else {
      console.error(`Error sending to ${connectionId}:`, error.message);
    }
    return false;
  }
}

/**
 * Broadcast to all connections
 */
async function broadcast(data) {
  const connections = await scanAllConnections();

  const results = await Promise.allSettled(
    connections.map(conn => sendToConnection(conn.connectionId, data))
  );

  const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
  console.log(`Broadcast: ${successful}/${results.length} sent`);
}

/**
 * Main Lambda handler for DynamoDB Stream events
 */
export async function handler(event) {
  console.log(`Processing ${event.Records.length} stream records`);

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error('Error processing record:', error);
    }
  }

  return { statusCode: 200, body: 'Processed' };
}

/**
 * Process a single stream record
 */
async function processRecord(record) {
  const eventName = record.eventName; // INSERT, MODIFY, REMOVE
  const newImage = record.dynamodb?.NewImage ? unmarshall(record.dynamodb.NewImage) : null;
  const oldImage = record.dynamodb?.OldImage ? unmarshall(record.dynamodb.OldImage) : null;

  if (!newImage && !oldImage) return;

  const entityType = newImage?.entityType || oldImage?.entityType;

  switch (entityType) {
    case 'GAME':
      await processGameChange(eventName, newImage, oldImage);
      break;

    case 'CARD':
      await processCardChange(eventName, newImage, oldImage);
      break;

    case 'WINNER':
      await processWinnerChange(eventName, newImage, oldImage);
      break;

    default:
      // Ignore other entity types
      break;
  }
}

/**
 * Process game state changes
 */
async function processGameChange(eventName, newImage, oldImage) {
  if (!newImage) return;

  const statusChanged = oldImage?.status !== newImage.status;
  const numberCalled = (newImage.calledNumbers?.length || 0) > (oldImage?.calledNumbers?.length || 0);
  const modeChanged = oldImage?.gameMode !== newImage.gameMode;

  // Broadcast game state
  await broadcast({
    type: 'game-state',
    data: {
      id: newImage.gameId,
      status: newImage.status,
      gameMode: newImage.gameMode,
      calledNumbers: newImage.calledNumbers || [],
      currentNumber: newImage.currentNumber,
      winner: newImage.winner,
      canPurchase: newImage.status === 'waiting' || newImage.status === 'ended',
    },
    timestamp: new Date().toISOString(),
  });

  // Specific event broadcasts
  if (statusChanged) {
    switch (newImage.status) {
      case 'playing':
        if (oldImage?.status === 'waiting') {
          await broadcast({
            type: 'game-started',
            data: {
              id: newImage.gameId,
              status: newImage.status,
              gameMode: newImage.gameMode,
              startedAt: newImage.startedAt,
            },
            timestamp: new Date().toISOString(),
          });
        } else if (oldImage?.status === 'paused') {
          await broadcast({
            type: 'game-resumed',
            data: { id: newImage.gameId, status: newImage.status },
            timestamp: new Date().toISOString(),
          });
        }
        break;

      case 'paused':
        await broadcast({
          type: 'game-paused',
          data: { id: newImage.gameId, status: newImage.status },
          timestamp: new Date().toISOString(),
        });
        break;

      case 'ended':
        await broadcast({
          type: 'game-ended',
          data: {
            id: newImage.gameId,
            status: newImage.status,
            winner: newImage.winner,
            endedAt: newImage.endedAt,
          },
          timestamp: new Date().toISOString(),
        });
        break;
    }
  }

  // Number called
  if (numberCalled && newImage.currentNumber) {
    await broadcast({
      type: 'number-called',
      data: {
        number: newImage.currentNumber,
        calledNumbers: newImage.calledNumbers,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Mode changed
  if (modeChanged) {
    await broadcast({
      type: 'game-mode-changed',
      data: {
        mode: newImage.gameMode,
        patternInfo: getPatternInfo(newImage.gameMode),
      },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Process card changes (purchases, etc.)
 */
async function processCardChange(eventName, newImage, oldImage) {
  // Card status changed from reserved to purchased
  if (newImage?.status === 'purchased' && oldImage?.status === 'reserved') {
    // Could broadcast card purchase notification if needed
    console.log(`Card ${newImage.cardId} purchased by ${newImage.ownerUsername}`);
  }

  // Card marked as won (rejected)
  if (newImage?.status === 'won' && oldImage?.status !== 'won') {
    await broadcast({
      type: 'winner-rejected',
      data: {
        cardId: newImage.cardId,
        disabled: true,
        rejectedAt: newImage.disabledAt,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Process winner creation
 */
async function processWinnerChange(eventName, newImage, oldImage) {
  if (eventName === 'INSERT' && newImage) {
    await broadcast({
      type: 'winner-announced',
      data: {
        winner: {
          odId: newImage.odId,
          odUsername: newImage.odUsername,
          wallet: newImage.wallet,
          cardId: newImage.cardId,
          gameMode: newImage.gameMode,
          patternName: newImage.patternName,
          prizeAmount: newImage.prizeAmount,
        },
      },
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Simple DynamoDB unmarshaller
 * Converts DynamoDB attribute values to plain JavaScript objects
 */
function unmarshall(item) {
  if (!item) return null;

  const result = {};

  for (const [key, value] of Object.entries(item)) {
    result[key] = unmarshallValue(value);
  }

  return result;
}

function unmarshallValue(value) {
  if (value.S !== undefined) return value.S;
  if (value.N !== undefined) return parseFloat(value.N);
  if (value.BOOL !== undefined) return value.BOOL;
  if (value.NULL !== undefined) return null;
  if (value.L !== undefined) return value.L.map(unmarshallValue);
  if (value.M !== undefined) return unmarshall(value.M);
  if (value.SS !== undefined) return value.SS;
  if (value.NS !== undefined) return value.NS.map(n => parseFloat(n));
  if (value.BS !== undefined) return value.BS;

  return value;
}

export default { handler };
