/**
 * Ultra Bingo - WebSocket Connect Handler
 * Handles new WebSocket connections via API Gateway
 */

import { saveConnection } from '../db/dynamodb.js';
import { verifyToken, isAdminWallet } from '../middleware/auth.js';

export async function handler(event) {
  console.log('WebSocket connect:', event.requestContext.connectionId);

  const connectionId = event.requestContext.connectionId;

  // Parse authentication from query string
  const queryParams = event.queryStringParameters || {};
  const token = queryParams.token;

  let userData = {
    odId: null,
    wallet: null,
    isAdmin: false,
    gameRoom: queryParams.gameRoom || 'main',
  };

  // Validate token if provided
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      userData.odId = decoded.id;
      userData.wallet = decoded.wallet;
      userData.isAdmin = decoded.isAdmin && isAdminWallet(decoded.wallet);
    }
  }

  try {
    // Save connection to DynamoDB
    await saveConnection(connectionId, userData);

    // NOTE: Do NOT send messages during $connect handler
    // AWS API Gateway WebSocket doesn't allow sending to a connection
    // until after the $connect handler returns successfully.
    // The game state will be sent when the client sends 'join-game'.

    console.log('Connection saved:', connectionId, 'isAdmin:', userData.isAdmin);

    return {
      statusCode: 200,
      body: 'Connected',
    };
  } catch (error) {
    console.error('Error in connect handler:', error);
    return {
      statusCode: 500,
      body: 'Failed to connect: ' + error.message,
    };
  }
}

export default { handler };
