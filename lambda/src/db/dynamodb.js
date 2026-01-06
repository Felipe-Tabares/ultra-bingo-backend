/**
 * Ultra Bingo - DynamoDB Client and Table Operations
 * Single-table design for optimal performance
 *
 * Table: ultra-bingo-main
 * PK: Partition Key, SK: Sort Key
 *
 * Entity Types:
 * - USER:      PK=USER#{odId}           SK=PROFILE
 * - CARD:      PK=CARD#{cardId}         SK=METADATA
 * - CARD_BY_OWNER: PK=USER#{odId}       SK=CARD#{cardId}
 * - GAME:      PK=GAME#{gameId}         SK=STATE
 * - GAME_CURRENT: PK=GAME#CURRENT       SK=ACTIVE
 * - WINNER:    PK=WINNER#{odId}         SK=GAME#{gameId}#{timestamp}
 * - CONFIG:    PK=CONFIG                SK=GLOBAL
 *
 * GSI1 (wallet lookups):
 * - GSI1PK=WALLET#{wallet}  GSI1SK=varies
 *
 * GSI2 (status queries):
 * - GSI2PK=STATUS#{status}  GSI2SK=createdAt
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

export const dynamodb = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

// Table names from environment
export const TABLES = {
  MAIN: process.env.DYNAMODB_TABLE_MAIN || 'ultra-bingo-main',
  CONNECTIONS: process.env.DYNAMODB_TABLE_CONNECTIONS || 'ultra-bingo-connections',
};

// Index names
export const INDEXES = {
  GSI1: 'GSI1',
  GSI2: 'GSI2',
};

// ============================================================================
// USER Operations
// ============================================================================

export async function createUser(user) {
  const now = new Date().toISOString();
  const item = {
    PK: `USER#${user.odId}`,
    SK: 'PROFILE',
    entityType: 'USER',
    odId: user.odId,
    username: user.username,
    wallet: user.wallet.toLowerCase(),
    isAdmin: user.isAdmin || false,
    profileImage: user.profileImage || null,
    stats: {
      gamesPlayed: 0,
      gamesWon: 0,
      cardsPurchased: 0,
      totalSpent: 0,
      totalWon: 0,
    },
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
    // GSI1 for wallet lookup
    GSI1PK: `WALLET#${user.wallet.toLowerCase()}`,
    GSI1SK: 'USER',
  };

  await dynamodb.send(new PutCommand({
    TableName: TABLES.MAIN,
    Item: item,
    ConditionExpression: 'attribute_not_exists(PK)',
  }));

  return item;
}

export async function getUserById(odId) {
  const result = await dynamodb.send(new GetCommand({
    TableName: TABLES.MAIN,
    Key: { PK: `USER#${odId}`, SK: 'PROFILE' },
  }));
  return result.Item || null;
}

export async function getUserByWallet(wallet) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: TABLES.MAIN,
    IndexName: INDEXES.GSI1,
    KeyConditionExpression: 'GSI1PK = :pk AND SK = :sk',
    ExpressionAttributeValues: {
      ':pk': `WALLET#${wallet.toLowerCase()}`,
      ':sk': 'USER',
    },
    Limit: 1,
  }));
  return result.Items?.[0] || null;
}

export async function updateUser(odId, updates) {
  const updateParts = [];
  const expressionValues = { ':updatedAt': new Date().toISOString() };
  const expressionNames = {};

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'PK' && key !== 'SK') {
      const attrName = `#${key}`;
      const attrValue = `:${key}`;
      expressionNames[attrName] = key;
      expressionValues[attrValue] = value;
      updateParts.push(`${attrName} = ${attrValue}`);
    }
  });

  updateParts.push('#updatedAt = :updatedAt');
  expressionNames['#updatedAt'] = 'updatedAt';

  const result = await dynamodb.send(new UpdateCommand({
    TableName: TABLES.MAIN,
    Key: { PK: `USER#${odId}`, SK: 'PROFILE' },
    UpdateExpression: `SET ${updateParts.join(', ')}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: 'ALL_NEW',
  }));

  return result.Attributes;
}

export async function incrementUserStats(odId, field, amount = 1) {
  // Ensure amount is a valid number
  const numAmount = typeof amount === 'string' ? parseInt(amount, 10) || 0 : (amount || 0);

  // First, try to get the user to check if field exists and its type
  const user = await getUserById(odId);
  if (!user) {
    console.error(`incrementUserStats: User ${odId} not found`);
    return null;
  }

  // Get current value and ensure it's a number
  const currentValue = user.stats?.[field];
  const numericCurrentValue = typeof currentValue === 'string' ? parseInt(currentValue, 10) || 0 : (currentValue || 0);

  // Use SET with explicit value to avoid type mismatch issues
  const result = await dynamodb.send(new UpdateCommand({
    TableName: TABLES.MAIN,
    Key: { PK: `USER#${odId}`, SK: 'PROFILE' },
    UpdateExpression: 'SET stats.#field = :newValue, updatedAt = :now',
    ExpressionAttributeNames: { '#field': field },
    ExpressionAttributeValues: {
      ':newValue': numericCurrentValue + numAmount,
      ':now': new Date().toISOString(),
    },
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes;
}

// ============================================================================
// CARD Operations
// ============================================================================

export async function createCard(card) {
  const now = new Date().toISOString();
  const item = {
    PK: `CARD#${card.cardId}`,
    SK: 'METADATA',
    entityType: 'CARD',
    cardId: card.cardId,
    numbers: card.numbers,
    status: 'available',
    hash: card.hash || null,
    createdAt: now,
    // GSI2 for status queries
    GSI2PK: 'STATUS#available',
    GSI2SK: now,
  };

  await dynamodb.send(new PutCommand({
    TableName: TABLES.MAIN,
    Item: item,
  }));

  return item;
}

export async function createCardsBatch(cards) {
  const now = new Date().toISOString();
  const items = cards.map(card => ({
    PK: `CARD#${card.cardId}`,
    SK: 'METADATA',
    entityType: 'CARD',
    cardId: card.cardId,
    numbers: card.numbers,
    status: 'available',
    hash: card.hash || null,
    createdAt: now,
    GSI2PK: 'STATUS#available',
    GSI2SK: now,
  }));

  // DynamoDB BatchWrite max 25 items
  const batches = [];
  for (let i = 0; i < items.length; i += 25) {
    batches.push(items.slice(i, i + 25));
  }

  for (const batch of batches) {
    await dynamodb.send(new BatchWriteCommand({
      RequestItems: {
        [TABLES.MAIN]: batch.map(item => ({
          PutRequest: { Item: item },
        })),
      },
    }));
  }

  return items;
}

export async function getCardById(cardId) {
  const result = await dynamodb.send(new GetCommand({
    TableName: TABLES.MAIN,
    Key: { PK: `CARD#${cardId}`, SK: 'METADATA' },
  }));
  return result.Item || null;
}

export async function getAvailableCards(limit = 50) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: TABLES.MAIN,
    IndexName: INDEXES.GSI2,
    KeyConditionExpression: 'GSI2PK = :status',
    ExpressionAttributeValues: {
      ':status': 'STATUS#available',
    },
    Limit: limit,
    ScanIndexForward: true, // oldest first
  }));
  return result.Items || [];
}

export async function getCardsByOwner(odId) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: TABLES.MAIN,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${odId}`,
      ':sk': 'CARD#',
    },
  }));
  return result.Items || [];
}

export async function getCardsByWallet(wallet) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: TABLES.MAIN,
    IndexName: INDEXES.GSI1,
    KeyConditionExpression: 'GSI1PK = :pk',
    FilterExpression: 'entityType = :entityType',
    ExpressionAttributeValues: {
      ':pk': `WALLET#${wallet.toLowerCase()}`,
      ':entityType': 'CARD',
    },
  }));
  return result.Items || [];
}

export async function getPurchasedCards() {
  const result = await dynamodb.send(new QueryCommand({
    TableName: TABLES.MAIN,
    IndexName: INDEXES.GSI2,
    KeyConditionExpression: 'GSI2PK = :status',
    ExpressionAttributeValues: {
      ':status': 'STATUS#purchased',
    },
  }));
  return result.Items || [];
}

/**
 * Reserve cards atomically using DynamoDB transactions
 * Only reserves cards that are currently 'available'
 * Returns array of successfully reserved card IDs
 */
export async function reserveCards(cardIds, userId, ttlMinutes = 5) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
  const reservedCards = [];

  // Process one at a time with conditional updates for atomicity
  for (const cardId of cardIds) {
    try {
      await dynamodb.send(new UpdateCommand({
        TableName: TABLES.MAIN,
        Key: { PK: `CARD#${cardId}`, SK: 'METADATA' },
        UpdateExpression: `
          SET #status = :reserved,
              reservedBy = :userId,
              reservedAt = :now,
              reservationExpiresAt = :expiresAt,
              GSI2PK = :newStatus,
              GSI2SK = :now
        `,
        ConditionExpression: '#status = :available',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':reserved': 'reserved',
          ':available': 'available',
          ':userId': userId,
          ':now': now.toISOString(),
          ':expiresAt': expiresAt.toISOString(),
          ':newStatus': 'STATUS#reserved',
        },
      }));
      reservedCards.push(cardId);
    } catch (err) {
      if (err.name !== 'ConditionalCheckFailedException') {
        console.error(`Error reserving card ${cardId}:`, err);
      }
      // Card was not available, skip it
    }
  }

  return reservedCards;
}

/**
 * Release reservation - only if reserved by the same user
 */
export async function releaseReservation(cardIds, userId) {
  for (const cardId of cardIds) {
    try {
      await dynamodb.send(new UpdateCommand({
        TableName: TABLES.MAIN,
        Key: { PK: `CARD#${cardId}`, SK: 'METADATA' },
        UpdateExpression: `
          SET #status = :available,
              GSI2PK = :newStatus,
              GSI2SK = createdAt
          REMOVE reservedBy, reservedAt, reservationExpiresAt
        `,
        ConditionExpression: '#status = :reserved AND reservedBy = :userId',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':available': 'available',
          ':reserved': 'reserved',
          ':userId': userId,
          ':newStatus': 'STATUS#available',
        },
      }));
    } catch (err) {
      if (err.name !== 'ConditionalCheckFailedException') {
        console.error(`Error releasing card ${cardId}:`, err);
      }
    }
  }
}

/**
 * Confirm reservation as purchase - using transaction for atomicity
 * Creates both the card update and the user-card association
 */
export async function confirmPurchase(cardIds, userId, wallet, txHash, pricePerCard, username) {
  const now = new Date().toISOString();
  const confirmedCards = [];

  // Ensure all values are valid for DynamoDB
  const safeUsername = username || 'anonymous';
  const safeWallet = (wallet || '').toLowerCase();
  const safeTxHash = txHash || 'pending';
  const safePrice = typeof pricePerCard === 'number' ? pricePerCard : parseInt(pricePerCard, 10) || 0;

  for (const cardId of cardIds) {
    try {
      // Transaction: update card AND create user-card association
      await dynamodb.send(new TransactWriteCommand({
        TransactItems: [
          // Update card status
          {
            Update: {
              TableName: TABLES.MAIN,
              Key: { PK: `CARD#${cardId}`, SK: 'METADATA' },
              UpdateExpression: `
                SET #status = :purchased,
                    #owner = :userId,
                    ownerUsername = :username,
                    ownerWallet = :wallet,
                    purchaseTxHash = :txHash,
                    pricePaid = :price,
                    purchasedAt = :now,
                    GSI2PK = :newStatus,
                    GSI2SK = :now,
                    GSI1PK = :walletPK,
                    GSI1SK = :cardSK
                REMOVE reservedBy, reservedAt, reservationExpiresAt
              `,
              ConditionExpression: '#status = :reserved AND reservedBy = :userId',
              ExpressionAttributeNames: {
                '#status': 'status',
                '#owner': 'owner',
              },
              ExpressionAttributeValues: {
                ':purchased': 'purchased',
                ':reserved': 'reserved',
                ':userId': userId,
                ':username': safeUsername,
                ':wallet': safeWallet,
                ':txHash': safeTxHash,
                ':price': safePrice,
                ':now': now,
                ':newStatus': 'STATUS#purchased',
                ':walletPK': `WALLET#${safeWallet}`,
                ':cardSK': `CARD#${cardId}`,
              },
            },
          },
          // Create user-card association for fast lookups
          {
            Put: {
              TableName: TABLES.MAIN,
              Item: {
                PK: `USER#${userId}`,
                SK: `CARD#${cardId}`,
                entityType: 'USER_CARD',
                cardId: cardId,
                purchasedAt: now,
                txHash: safeTxHash,
              },
            },
          },
        ],
      }));

      confirmedCards.push(cardId);
      console.log(`Card ${cardId} confirmed for user ${userId}`);
    } catch (err) {
      console.error(`Error confirming card ${cardId}:`, err.message);
    }
  }

  console.log(`Confirmed ${confirmedCards.length} of ${cardIds.length} cards`);
  return confirmedCards;
}

/**
 * Mark card as won (disabled) - used when rejecting a potential winner
 */
export async function markCardAsWon(cardId) {
  const now = new Date().toISOString();

  await dynamodb.send(new UpdateCommand({
    TableName: TABLES.MAIN,
    Key: { PK: `CARD#${cardId}`, SK: 'METADATA' },
    UpdateExpression: `
      SET #status = :won,
          GSI2PK = :newStatus,
          GSI2SK = :now,
          disabledAt = :now
    `,
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':won': 'won',
      ':newStatus': 'STATUS#won',
      ':now': now,
    },
  }));
}

/**
 * Re-enable all cards with 'won' status back to 'purchased'
 * Called when a game ends to allow rejected cards to play in future games
 */
export async function reEnableWonCards() {
  const now = new Date().toISOString();

  // First, get all cards with 'won' status
  const result = await dynamodb.send(new QueryCommand({
    TableName: TABLES.MAIN,
    IndexName: INDEXES.GSI2,
    KeyConditionExpression: 'GSI2PK = :status',
    ExpressionAttributeValues: {
      ':status': 'STATUS#won',
    },
  }));

  const wonCards = result.Items || [];
  let reEnabledCount = 0;

  // Update each card back to 'purchased'
  for (const card of wonCards) {
    try {
      await dynamodb.send(new UpdateCommand({
        TableName: TABLES.MAIN,
        Key: { PK: `CARD#${card.cardId}`, SK: 'METADATA' },
        UpdateExpression: `
          SET #status = :purchased,
              GSI2PK = :newStatus,
              GSI2SK = :now
          REMOVE disabledAt
        `,
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':purchased': 'purchased',
          ':newStatus': 'STATUS#purchased',
          ':now': now,
        },
      }));
      reEnabledCount++;
      console.log(`Re-enabled card ${card.cardId} from 'won' to 'purchased'`);
    } catch (err) {
      console.error(`Error re-enabling card ${card.cardId}:`, err.message);
    }
  }

  console.log(`Re-enabled ${reEnabledCount} of ${wonCards.length} cards`);
  return reEnabledCount;
}

// ============================================================================
// GAME Operations
// ============================================================================

export async function createGame(gameId, gameMode = 'fullCard') {
  const now = new Date().toISOString();

  const item = {
    PK: `GAME#${gameId}`,
    SK: 'STATE',
    entityType: 'GAME',
    gameId: gameId,
    status: 'waiting',
    gameMode: gameMode,
    calledNumbers: [],
    currentNumber: null,
    winner: null,
    prizePool: '0',
    cardsSold: 0,
    startedAt: null,
    endedAt: null,
    createdAt: now,
    // GSI2 for status queries
    GSI2PK: 'GAMESTATUS#waiting',
    GSI2SK: now,
  };

  // Transaction: create game AND update current game pointer
  await dynamodb.send(new TransactWriteCommand({
    TransactItems: [
      { Put: { TableName: TABLES.MAIN, Item: item } },
      {
        Put: {
          TableName: TABLES.MAIN,
          Item: {
            PK: 'GAME#CURRENT',
            SK: 'ACTIVE',
            gameId: gameId,
            updatedAt: now,
          },
        },
      },
    ],
  }));

  return item;
}

export async function getCurrentGame() {
  // Get current game pointer
  const pointer = await dynamodb.send(new GetCommand({
    TableName: TABLES.MAIN,
    Key: { PK: 'GAME#CURRENT', SK: 'ACTIVE' },
  }));

  if (!pointer.Item?.gameId) {
    return null;
  }

  // Get game state
  const game = await dynamodb.send(new GetCommand({
    TableName: TABLES.MAIN,
    Key: { PK: `GAME#${pointer.Item.gameId}`, SK: 'STATE' },
  }));

  return game.Item || null;
}

export async function getGameById(gameId) {
  const result = await dynamodb.send(new GetCommand({
    TableName: TABLES.MAIN,
    Key: { PK: `GAME#${gameId}`, SK: 'STATE' },
  }));
  return result.Item || null;
}

export async function clearCurrentGame() {
  // Delete the current game pointer
  await dynamodb.send(new DeleteCommand({
    TableName: TABLES.MAIN,
    Key: { PK: 'GAME#CURRENT', SK: 'ACTIVE' },
  }));
}

export async function updateGame(gameId, updates) {
  const updateParts = [];
  const expressionValues = {};
  const expressionNames = {};

  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'PK' && key !== 'SK') {
      const attrName = `#${key}`;
      const attrValue = `:${key}`;
      expressionNames[attrName] = key;
      expressionValues[attrValue] = value;
      updateParts.push(`${attrName} = ${attrValue}`);
    }
  });

  // Update GSI2 if status changed
  if (updates.status) {
    expressionNames['#gsi2pk'] = 'GSI2PK';
    expressionValues[':gsi2pk'] = `GAMESTATUS#${updates.status}`;
    updateParts.push('#gsi2pk = :gsi2pk');
  }

  const result = await dynamodb.send(new UpdateCommand({
    TableName: TABLES.MAIN,
    Key: { PK: `GAME#${gameId}`, SK: 'STATE' },
    UpdateExpression: `SET ${updateParts.join(', ')}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: 'ALL_NEW',
  }));

  return result.Attributes;
}

export async function callNumber(gameId, number) {
  const result = await dynamodb.send(new UpdateCommand({
    TableName: TABLES.MAIN,
    Key: { PK: `GAME#${gameId}`, SK: 'STATE' },
    UpdateExpression: 'SET calledNumbers = list_append(if_not_exists(calledNumbers, :empty), :number), currentNumber = :num',
    ConditionExpression: 'NOT contains(calledNumbers, :num)',
    ExpressionAttributeValues: {
      ':number': [number],
      ':empty': [],
      ':num': number,
    },
    ReturnValues: 'ALL_NEW',
  }));
  return result.Attributes;
}

// ============================================================================
// WINNER Operations
// ============================================================================

export async function createWinner(winner) {
  const now = new Date().toISOString();
  const winnerId = `winner_${Date.now()}_${winner.cardId}`;

  const item = {
    PK: `WINNER#${winner.odId}`,
    SK: `GAME#${winner.gameId}#${now}`,
    entityType: 'WINNER',
    winnerId: winnerId,
    gameId: winner.gameId,
    odId: winner.odId,
    odUsername: winner.odUsername,
    wallet: winner.wallet.toLowerCase(),
    cardId: winner.cardId,
    gameMode: winner.gameMode,
    patternName: winner.patternName,
    prizeAmount: winner.prizeAmount || '0',
    prizeToken: 'USDC',
    totalCalledNumbers: winner.totalCalledNumbers,
    totalCards: winner.totalCards || 0,
    wonAt: now,
    createdAt: now,
    // GSI1 for wallet lookup
    GSI1PK: `WALLET#${winner.wallet.toLowerCase()}`,
    GSI1SK: `WINNER#${now}`,
    // GSI2 for recent winners
    GSI2PK: 'WINNERS#ALL',
    GSI2SK: now,
  };

  await dynamodb.send(new PutCommand({
    TableName: TABLES.MAIN,
    Item: item,
  }));

  return item;
}

export async function getRecentWinners(limit = 10) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: TABLES.MAIN,
    IndexName: INDEXES.GSI2,
    KeyConditionExpression: 'GSI2PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'WINNERS#ALL',
    },
    Limit: limit,
    ScanIndexForward: false, // newest first
  }));
  return result.Items || [];
}

export async function getWinnersByWallet(wallet, limit = 10) {
  const result = await dynamodb.send(new QueryCommand({
    TableName: TABLES.MAIN,
    IndexName: INDEXES.GSI1,
    KeyConditionExpression: 'GSI1PK = :pk',
    FilterExpression: 'entityType = :entityType',
    ExpressionAttributeValues: {
      ':pk': `WALLET#${wallet.toLowerCase()}`,
      ':entityType': 'WINNER',
    },
    Limit: limit,
    ScanIndexForward: false,
  }));
  return result.Items || [];
}

// ============================================================================
// CONNECTIONS Operations (for WebSocket)
// ============================================================================

export async function saveConnection(connectionId, data = {}) {
  const ttl = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours

  await dynamodb.send(new PutCommand({
    TableName: TABLES.CONNECTIONS,
    Item: {
      connectionId,
      odId: data.odId || null,
      wallet: data.wallet ? data.wallet.toLowerCase() : null,
      isAdmin: data.isAdmin || false,
      gameRoom: data.gameRoom || 'main',
      connectedAt: new Date().toISOString(),
      ttl,
    },
  }));
}

export async function getConnection(connectionId) {
  const result = await dynamodb.send(new GetCommand({
    TableName: TABLES.CONNECTIONS,
    Key: { connectionId },
  }));
  return result.Item || null;
}

export async function deleteConnection(connectionId) {
  await dynamodb.send(new DeleteCommand({
    TableName: TABLES.CONNECTIONS,
    Key: { connectionId },
  }));
}

export async function getAllConnections() {
  const result = await dynamodb.send(new QueryCommand({
    TableName: TABLES.CONNECTIONS,
    // Scan all connections - for small scale this is fine
    // For large scale, use GSI on gameRoom
  }));
  return result.Items || [];
}

// For scanning all connections (WebSocket broadcast)
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

export async function scanAllConnections() {
  const result = await dynamodb.send(new ScanCommand({
    TableName: TABLES.CONNECTIONS,
  }));
  return result.Items || [];
}

// Scan all users (for admin panel)
export async function scanAllUsers(limit = 50) {
  const result = await dynamodb.send(new ScanCommand({
    TableName: TABLES.MAIN,
    FilterExpression: 'entityType = :type',
    ExpressionAttributeValues: {
      ':type': 'USER',
    },
    Limit: limit,
  }));
  return result.Items || [];
}

export default {
  dynamodb,
  TABLES,
  INDEXES,
  // User
  createUser,
  getUserById,
  getUserByWallet,
  updateUser,
  incrementUserStats,
  // Card
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
  markCardAsWon,
  reEnableWonCards,
  // Game
  createGame,
  getCurrentGame,
  getGameById,
  updateGame,
  clearCurrentGame,
  callNumber,
  // Winner
  createWinner,
  getRecentWinners,
  getWinnersByWallet,
  // Connections
  saveConnection,
  getConnection,
  deleteConnection,
  getAllConnections,
  scanAllConnections,
  // Admin
  scanAllUsers,
};
