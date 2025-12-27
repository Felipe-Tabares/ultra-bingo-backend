# Ultra Bingo - AWS Migration Plan

## Target Architecture

```
                    +------------------+
                    |   CloudFront     |
                    |   (CDN + SSL)    |
                    +--------+---------+
                             |
            +----------------+----------------+
            |                                 |
    +-------v--------+              +---------v---------+
    |      S3        |              |   API Gateway     |
    | (Frontend SPA) |              |   (REST + WS)     |
    +----------------+              +---------+---------+
                                              |
                                    +---------v---------+
                                    |     Lambda        |
                                    | (Node.js 20.x)    |
                                    +---------+---------+
                                              |
                    +-------------------------+-------------------------+
                    |                         |                         |
           +--------v--------+      +---------v---------+     +---------v---------+
           |   DynamoDB      |      |   API Gateway     |     |   Secrets Manager |
           |   (Tables)      |      |   WebSocket API   |     |   (Config)        |
           +-----------------+      +-------------------+     +-------------------+
```

## DynamoDB Table Design

### Table: `ultra-bingo-main`

Single-table design for optimal performance and cost.

#### Primary Key Structure
- **PK (Partition Key)**: String - Entity type prefix
- **SK (Sort Key)**: String - Entity identifier

#### Access Patterns

| Access Pattern | PK | SK | GSI |
|----------------|----|----|-----|
| Get user by ID | `USER#<odId>` | `USER#<odId>` | - |
| Get user by wallet | - | - | GSI1: `wallet` |
| Get card by ID | `CARD#<cardId>` | `CARD#<cardId>` | - |
| Get cards by owner | `USERCARD#<owner>` | `CARD#<cardId>` | - |
| Get available cards | `AVAILABLE` | `CARD#<cardId>` | - |
| Get current game | `GAME` | `CURRENT` | - |
| Get game by ID | `GAME#<gameId>` | `GAME#<gameId>` | - |

#### Entity Schemas

**User Entity**
```json
{
  "PK": "USER#od_123",
  "SK": "USER#od_123",
  "entityType": "USER",
  "odId": "od_123",
  "username": "f3l1p3",
  "wallet": "0x0F36...",
  "isAdmin": false,
  "stats": {
    "cardsPurchased": 5,
    "gamesPlayed": 2,
    "wins": 0,
    "totalSpent": "5000000"
  },
  "createdAt": "2025-12-26T...",
  "updatedAt": "2025-12-26T...",
  "GSI1PK": "WALLET#0x0f36..."
}
```

**Card Entity (Available)**
```json
{
  "PK": "AVAILABLE",
  "SK": "CARD#card_abc123",
  "entityType": "CARD",
  "cardId": "card_abc123",
  "numbers": {
    "B": [1, 5, 10, 12, 15],
    "I": [16, 20, 25, 28, 30],
    "N": [31, 35, 0, 40, 45],
    "G": [46, 50, 55, 58, 60],
    "O": [61, 65, 70, 73, 75]
  },
  "hash": "abc123...",
  "status": "available",
  "createdAt": "2025-12-26T..."
}
```

**Card Entity (Purchased)**
```json
{
  "PK": "USERCARD#od_123",
  "SK": "CARD#card_abc123",
  "entityType": "CARD",
  "cardId": "card_abc123",
  "numbers": { ... },
  "hash": "abc123...",
  "status": "purchased",
  "owner": "od_123",
  "ownerUsername": "f3l1p3",
  "ownerWallet": "0x0F36...",
  "purchaseTxHash": "0xabc...",
  "pricePaid": "1000000",
  "purchasedAt": "2025-12-26T...",
  "createdAt": "2025-12-26T..."
}
```

**Game Entity**
```json
{
  "PK": "GAME",
  "SK": "CURRENT",
  "entityType": "GAME",
  "gameId": "game_1735200000000",
  "status": "playing",
  "calledNumbers": [5, 23, 45, 67],
  "currentNumber": 67,
  "winner": null,
  "prizePool": "50000000",
  "cardsSold": 50,
  "startedAt": "2025-12-26T...",
  "endedAt": null,
  "createdAt": "2025-12-26T..."
}
```

### Global Secondary Indexes

**GSI1: Wallet Lookup**
- PK: `GSI1PK` (e.g., `WALLET#0x0f36...`)
- SK: `SK`
- Projection: ALL

### DynamoDB Streams

Enable streams for real-time updates:
- New card purchases -> Notify via WebSocket
- Number called -> Broadcast to all connections
- Winner detected -> Broadcast winner announcement

## Lambda Functions

### 1. `ultra-bingo-api` (Main API)
- Runtime: Node.js 20.x
- Memory: 512MB
- Timeout: 30s
- Handles: REST API endpoints

### 2. `ultra-bingo-websocket-connect`
- Handles: WebSocket `$connect`
- Stores connection in DynamoDB

### 3. `ultra-bingo-websocket-disconnect`
- Handles: WebSocket `$disconnect`
- Removes connection from DynamoDB

### 4. `ultra-bingo-websocket-message`
- Handles: WebSocket messages
- Routes to appropriate handlers

### 5. `ultra-bingo-stream-processor`
- Trigger: DynamoDB Streams
- Broadcasts updates via WebSocket

## API Gateway

### REST API Endpoints
```
POST   /auth/login
POST   /auth/register
GET    /cards/available
POST   /cards/purchase (x402 protected)
GET    /cards/my-cards
GET    /game/state
POST   /admin/start-game
POST   /admin/call-number
POST   /admin/verify-winner
```

### WebSocket API Routes
```
$connect    -> ultra-bingo-websocket-connect
$disconnect -> ultra-bingo-websocket-disconnect
$default    -> ultra-bingo-websocket-message
```

## Migration Steps

### Phase 1: Infrastructure Setup (Day 1)
1. Create DynamoDB table with GSI
2. Create Lambda functions (empty handlers)
3. Create API Gateway REST + WebSocket APIs
4. Create S3 bucket for frontend
5. Configure CloudFront distribution
6. Set up Secrets Manager for config

### Phase 2: Backend Migration (Day 1)
1. Port MongoDB models to DynamoDB operations
2. Implement Lambda handlers
3. Test locally with SAM/LocalStack
4. Deploy to AWS

### Phase 3: Frontend Deployment (Day 1)
1. Update config for production URLs
2. Build production bundle
3. Upload to S3
4. Invalidate CloudFront cache

### Phase 4: Data Migration (Day 1)
1. Export MongoDB data
2. Transform to DynamoDB format
3. Bulk import to DynamoDB
4. Verify data integrity

## Environment Variables (Secrets Manager)

```json
{
  "JWT_SECRET": "...",
  "ADMIN_WALLETS": "0x...,0x...",
  "X402_FACILITATOR_URL": "https://facilitator.ultravioletadao.xyz",
  "X402_NETWORK": "avalanche",
  "X402_RECEIVER_ADDRESS": "0x0c9eEB46f822F2C61A7e2f29ddE971F0121b96eE",
  "CARD_PRICE": "0.001"
}
```

## Cost Estimation (Monthly)

| Service | Estimated Cost |
|---------|----------------|
| DynamoDB (On-demand) | $5-20 |
| Lambda (1M requests) | $0.20 |
| API Gateway | $3.50 |
| S3 | $0.50 |
| CloudFront | $1-5 |
| Secrets Manager | $0.40 |
| **Total** | **~$15-30/month** |

## WebSocket Connection Table

Separate table for WebSocket connections:

### Table: `ultra-bingo-connections`

```json
{
  "connectionId": "abc123",
  "odId": "od_123",
  "isAdmin": false,
  "connectedAt": "2025-12-26T...",
  "ttl": 1735300000
}
```

- TTL enabled for automatic cleanup of stale connections
- GSI on `odId` for user-specific broadcasts

## Security Considerations

1. **IAM Roles**: Least privilege for Lambda functions
2. **API Gateway**: Rate limiting, WAF integration
3. **DynamoDB**: Encryption at rest enabled
4. **Secrets Manager**: Rotation enabled
5. **CloudFront**: HTTPS only, geo restrictions if needed
