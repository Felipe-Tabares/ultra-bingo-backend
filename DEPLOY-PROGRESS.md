# Ultra Bingo - Progreso de Despliegue AWS

## Estado: COMPLETADO

## Infraestructura Desplegada

### URLs de Produccion

```
REST API:     https://k8nsq5hnhi.execute-api.us-east-1.amazonaws.com/prod
WebSocket:    wss://g87r5d75yg.execute-api.us-east-1.amazonaws.com/prod
```

### Recursos AWS Creados

| Recurso | Nombre/ID | Estado |
|---------|-----------|--------|
| REST API | k8nsq5hnhi | ✅ Activo |
| WebSocket API | g87r5d75yg | ✅ Activo |
| DynamoDB Main | ultra-bingo-prod-main | ✅ Activo |
| DynamoDB Connections | ultra-bingo-prod-connections | ✅ Activo |
| Lambda API | ultra-bingo-prod-api | ✅ Desplegado |
| Lambda WS Connect | ultra-bingo-prod-ws-connect | ✅ Desplegado |
| Lambda WS Disconnect | ultra-bingo-prod-ws-disconnect | ✅ Desplegado |
| Lambda WS Message | ultra-bingo-prod-ws-message | ✅ Desplegado |
| Lambda Stream Processor | ultra-bingo-prod-stream-processor | ✅ Desplegado |
| S3 Lambda Code | ultra-bingo-prod-lambda-code-060c556f | ✅ Creado |
| S3 Assets | ultra-bingo-prod-assets-060c556f | ✅ Creado |
| Secrets Manager | ultra-bingo-prod-config-060c556f | ✅ Configurado |

## Configuracion Frontend

Agregar al archivo `.env` del frontend:

```env
VITE_API_URL=https://k8nsq5hnhi.execute-api.us-east-1.amazonaws.com/prod
VITE_WS_URL=wss://g87r5d75yg.execute-api.us-east-1.amazonaws.com/prod
VITE_X402_RECEIVER=0x0c9eEB46f822F2C61A7e2f29ddE971F0121b96eE
VITE_X402_NETWORK=avalanche
```

## Precio Carton
- **$5 USDC** en Avalanche Mainnet
- Configurado en: backend `.env`, `terraform.tfvars`, frontend `config/index.js`

## Admin Wallets Autorizadas
- `0x13ef1f97a3de80cee38ca77267795a635798c101`
- `0x0f36b46e5bd24a81789a59f215f6219749ac985a`

## Endpoints API REST

### Publicos
- `GET /health` - Health check
- `GET /api/game/status` - Estado del juego
- `GET /api/game/current` - Juego actual
- `GET /api/game/modes` - Modos disponibles
- `GET /api/cards/available` - Cartones disponibles

### Autenticados
- `POST /api/auth/register` - Registro con wallet
- `GET /api/auth/me` - Usuario actual
- `POST /api/cards/purchase` - Comprar cartones (x402)
- `GET /api/cards/my-cards` - Mis cartones

### Admin
- `POST /api/admin/login` - Login admin
- `POST /api/admin/game/start` - Iniciar juego
- `POST /api/admin/game/call` - Llamar numero
- `POST /api/admin/cards/generate` - Generar cartones

## WebSocket Eventos

### Cliente -> Servidor
- `join-game` - Unirse a sala
- `leave-game` - Salir de sala
- `admin-start-game` - Iniciar juego (admin)
- `admin-pause-game` - Pausar juego (admin)
- `admin-resume-game` - Reanudar juego (admin)
- `admin-end-game` - Terminar juego (admin)
- `admin-call-number` - Llamar numero (admin)

### Servidor -> Cliente
- `game-state` - Estado completo
- `number-called` - Numero llamado
- `potential-winner` - Posible ganador
- `winner-announced` - Ganador confirmado

## Comandos Utiles

### Actualizar codigo Lambda
```bash
cd lambda
npm run build
powershell Compress-Archive -Path 'dist\*' -DestinationPath 'function.zip' -Force
aws lambda update-function-code --function-name ultra-bingo-prod-api --zip-file fileb://function.zip --region us-east-1
```

### Ver logs
```bash
aws logs tail /aws/lambda/ultra-bingo-prod-api --since 5m --region us-east-1 --follow
```

### Terraform
```bash
cd terraform
terraform plan
terraform apply -auto-approve
```

## Costos Estimados Mensuales
- Lambda: ~$0.20 (1M requests)
- API Gateway: ~$4.50
- DynamoDB: ~$5-20
- CloudWatch: ~$0.50
- **Total: ~$10-25/mes**

---
Ultima actualizacion: 2025-12-29
Desplegado exitosamente.
