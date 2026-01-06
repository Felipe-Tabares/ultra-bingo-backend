# Ultra Bingo - Lambda Backend

Este directorio contiene el código adaptado para AWS Lambda del backend de Ultra Bingo.

## Arquitectura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   CloudFront    │────▶│   API Gateway   │────▶│     Lambda      │
│      (CDN)      │     │   (REST + WS)   │     │   (Handlers)    │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                    ┌────────────────────────────────────┤
                    │                                    │
            ┌───────▼───────┐                   ┌────────▼────────┐
            │   DynamoDB    │                   │ API Gateway     │
            │   (Tables)    │                   │ Management API  │
            └───────┬───────┘                   └─────────────────┘
                    │                                    │
            ┌───────▼───────┐                           │
            │   DynamoDB    │───────────────────────────┘
            │   Streams     │   (Broadcast updates)
            └───────────────┘
```

## Estructura de Archivos

```
lambda/
├── src/
│   ├── db/
│   │   └── dynamodb.js       # Cliente DynamoDB y operaciones CRUD
│   ├── handlers/
│   │   ├── api.js            # Handler REST API
│   │   ├── wsConnect.js      # WebSocket $connect
│   │   ├── wsDisconnect.js   # WebSocket $disconnect
│   │   ├── wsMessage.js      # WebSocket mensajes
│   │   └── streamProcessor.js # DynamoDB Streams → Broadcast
│   ├── middleware/
│   │   ├── auth.js           # JWT y autenticación
│   │   └── x402.js           # Pagos x402
│   ├── services/
│   │   ├── bingoCard.js      # Generación y validación de cartones
│   │   └── broadcast.js      # WebSocket broadcast utilities
│   └── index.js              # Entry points
├── scripts/
│   ├── build.js              # Build con esbuild
│   └── deploy.js             # Despliegue a AWS
├── package.json
└── README.md
```

## Handlers Lambda

| Handler | Archivo | Descripción |
|---------|---------|-------------|
| `api` | api.js | REST API (todos los endpoints HTTP) |
| `wsConnect` | wsConnect.js | WebSocket conexión |
| `wsDisconnect` | wsDisconnect.js | WebSocket desconexión |
| `wsMessage` | wsMessage.js | WebSocket mensajes (incluye admin) |
| `streamProcessor` | streamProcessor.js | Procesa streams, broadcast tiempo real |

## Instalación y Build

```bash
# Instalar dependencias
cd lambda
npm install

# Build (genera dist/)
npm run build

# Empaquetar para Lambda
npm run package
# Genera function.zip
```

## Despliegue

### Opción 1: Desplegar todas las funciones
```bash
npm run deploy:all
```

### Opción 2: Desplegar funciones individuales
```bash
npm run deploy:api
npm run deploy:ws-connect
npm run deploy:ws-disconnect
npm run deploy:ws-message
npm run deploy:stream
```

### Opción 3: Manual con AWS CLI
```bash
aws lambda update-function-code \
  --function-name ultra-bingo-prod-api \
  --zip-file fileb://function.zip \
  --region us-east-1
```

## Variables de Entorno

Las Lambdas usan estas variables (configuradas via Terraform):

| Variable | Descripción |
|----------|-------------|
| `NODE_ENV` | Entorno (prod) |
| `DYNAMODB_TABLE_MAIN` | Tabla principal DynamoDB |
| `DYNAMODB_TABLE_CONNECTIONS` | Tabla de conexiones WebSocket |
| `WEBSOCKET_ENDPOINT` | URL del API Gateway WebSocket |
| `JWT_SECRET` | Secreto para tokens JWT |
| `ADMIN_PASSWORD` | Contraseña del admin |
| `ADMIN_WALLETS` | Wallets autorizadas (comma-separated) |
| `X402_FACILITATOR_URL` | URL del facilitador x402 |
| `X402_NETWORK` | Red blockchain (avalanche) |
| `X402_RECEIVER_ADDRESS` | Wallet para recibir pagos |
| `CARD_PRICE` | Precio del cartón en USDC |
| `FRONTEND_URL` | URL del frontend para CORS |

## DynamoDB Single-Table Design

### Tabla Principal (`ultra-bingo-main`)

| Entity | PK | SK | GSI1PK | GSI1SK | GSI2PK | GSI2SK |
|--------|----|----|--------|--------|--------|--------|
| User | `USER#{odId}` | `PROFILE` | `WALLET#{wallet}` | `USER` | - | - |
| Card | `CARD#{cardId}` | `METADATA` | `WALLET#{wallet}` | `CARD#{cardId}` | `STATUS#{status}` | `{createdAt}` |
| Game | `GAME#{gameId}` | `STATE` | - | - | `GAMESTATUS#{status}` | `{createdAt}` |
| Winner | `WINNER#{odId}` | `GAME#{gameId}#{ts}` | `WALLET#{wallet}` | `WINNER#{wonAt}` | `WINNERS#ALL` | `{wonAt}` |

### Tabla Conexiones (`ultra-bingo-connections`)

| Field | Type | Descripción |
|-------|------|-------------|
| `connectionId` | PK | ID de conexión WebSocket |
| `odId` | String | Usuario conectado |
| `wallet` | String | Wallet del usuario |
| `isAdmin` | Boolean | Es administrador |
| `gameRoom` | String | Sala del juego |
| `ttl` | Number | TTL para auto-limpieza |

## WebSocket Eventos

### Eventos del Servidor (Broadcast)

| Evento | Descripción |
|--------|-------------|
| `game-state` | Estado completo del juego |
| `game-started` | Juego iniciado |
| `game-paused` | Juego pausado |
| `game-resumed` | Juego reanudado |
| `game-ended` | Juego finalizado |
| `number-called` | Número llamado |
| `potential-winner` | Posible ganador detectado |
| `winner-announced` | Ganador verificado |
| `winner-rejected` | Ganador rechazado |
| `game-mode-changed` | Modo de juego cambiado |

### Acciones del Cliente

| Acción | Requiere Admin | Descripción |
|--------|----------------|-------------|
| `join-game` | No | Unirse a sala |
| `leave-game` | No | Salir de sala |
| `admin:start-game` | Sí | Iniciar juego |
| `admin:pause-game` | Sí | Pausar juego |
| `admin:resume-game` | Sí | Reanudar juego |
| `admin:end-game` | Sí | Finalizar juego |
| `admin:call-number` | Sí | Llamar número |
| `admin:set-game-mode` | Sí | Cambiar modo |
| `admin:verify-winner` | Sí | Verificar ganador |
| `admin:reject-winner` | Sí | Rechazar ganador |

## Flujo de Tiempo Real

1. **Admin llama número** → `wsMessage` handler
2. **Actualiza DynamoDB** → Tabla `GAME` modificada
3. **DynamoDB Stream** → Trigger `streamProcessor`
4. **Stream processor** → Broadcast a todas las conexiones
5. **Clientes reciben** → `number-called` + `game-state`

## Diferencias con el Backend Original

| Aspecto | Original (Express/Socket.io) | Lambda |
|---------|------------------------------|--------|
| Servidor | Express HTTP | API Gateway |
| WebSocket | Socket.io | API Gateway WebSocket |
| Base de datos | MongoDB | DynamoDB |
| Broadcast | Socket.io rooms | API Gateway Management API |
| Estado | En memoria | DynamoDB |
| Escalabilidad | Vertical | Horizontal (auto) |

## Costos Estimados

| Servicio | Costo Mensual |
|----------|---------------|
| Lambda (1M requests) | ~$0.20 |
| API Gateway REST | ~$3.50 |
| API Gateway WebSocket | ~$1.00 |
| DynamoDB (On-demand) | ~$5-20 |
| CloudWatch Logs | ~$0.50 |
| **Total** | **~$10-25/mes** |
