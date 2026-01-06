/**
 * Ultra Bingo - WebSocket Disconnect Handler
 * Handles WebSocket disconnections
 */

import { deleteConnection } from '../db/dynamodb.js';

export async function handler(event) {
  const connectionId = event.requestContext.connectionId;
  console.log('WebSocket disconnect:', connectionId);

  try {
    // Remove connection from DynamoDB
    await deleteConnection(connectionId);

    return {
      statusCode: 200,
      body: 'Disconnected',
    };
  } catch (error) {
    console.error('Error in disconnect handler:', error);
    // Still return 200 to allow disconnect to complete
    return {
      statusCode: 200,
      body: 'Disconnected with errors',
    };
  }
}

export default { handler };
