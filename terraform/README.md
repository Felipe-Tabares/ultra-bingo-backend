# Ultra Bingo - Terraform Infrastructure

Este directorio contiene la configuracion de Terraform para desplegar el backend de Ultra Bingo en AWS.

## Arquitectura

```
                    +------------------+
                    |   CloudFront     |  <-- Frontend (Amplify)
                    |   (CDN + SSL)    |
                    +--------+---------+
                             |
            +----------------+----------------+
            |                                 |
    +-------v--------+              +---------v---------+
    |   Amplify      |              |   API Gateway     |
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
                    |
           +--------v--------+
           |  DynamoDB       |
           |  Streams        |
           +-----------------+
```

## Componentes

### DynamoDB (dynamodb.tf)
- **ultra-bingo-main**: Tabla principal (usuarios, cartones, juegos, ganadores)
  - Single-table design para mejor rendimiento
  - GSI1: Busqueda por wallet
  - GSI2: Busqueda por estado
  - Streams habilitados para actualizaciones en tiempo real
  - TTL para expiracion de reservas

- **ultra-bingo-connections**: Conexiones WebSocket
  - TTL para limpieza automatica

### Lambda Functions (lambda.tf)
- **ultra-bingo-api**: Handler principal REST API
- **ultra-bingo-ws-connect**: Conexion WebSocket
- **ultra-bingo-ws-disconnect**: Desconexion WebSocket
- **ultra-bingo-ws-message**: Mensajes WebSocket
- **ultra-bingo-stream-processor**: Procesa DynamoDB Streams

### API Gateway (api_gateway_*.tf)
- **REST API**: Todos los endpoints HTTP
- **WebSocket API**: Comunicacion en tiempo real

### S3 (s3.tf)
- **lambda-code**: Almacena codigo Lambda
- **assets**: Assets estaticos

### Secrets Manager (secrets.tf)
- Almacena configuracion sensible (JWT_SECRET, etc.)

## Uso

### 1. Prerequisitos
```bash
# Instalar Terraform
brew install terraform  # macOS
# o descargar de https://terraform.io

# Configurar AWS CLI
aws configure
```

### 2. Inicializar Terraform
```bash
cd terraform
terraform init
```

### 3. Configurar Variables
```bash
cp terraform.tfvars.example terraform.tfvars
# Editar terraform.tfvars con tus valores
```

### 4. Planificar Cambios
```bash
terraform plan
```

### 5. Aplicar Cambios
```bash
terraform apply
```

### 6. Ver Outputs
```bash
terraform output
```

## Variables Requeridas

| Variable | Descripcion |
|----------|-------------|
| `jwt_secret` | Secreto para firmar JWT tokens |
| `admin_password` | Contrasena del panel admin |
| `admin_wallets` | Wallets autorizadas (separadas por coma) |
| `x402_receiver_address` | Wallet para recibir pagos |

## Outputs Importantes

Despues de `terraform apply`, obtendras:

- `api_endpoint`: URL del REST API
- `websocket_endpoint`: URL del WebSocket API
- `frontend_config`: Variables para el frontend

## Despliegue de Codigo Lambda

Despues de crear la infraestructura, necesitas desplegar el codigo Lambda real:

```bash
# 1. Crear directorio lambda y copiar codigo adaptado
mkdir -p lambda
# (Copiar codigo del backend adaptado para Lambda)

# 2. Instalar dependencias y empaquetar
cd lambda
npm install
zip -r function.zip .

# 3. Actualizar funciones Lambda
aws lambda update-function-code \
  --function-name ultra-bingo-prod-api \
  --zip-file fileb://function.zip
```

## WebSocket vs Socket.io

**IMPORTANTE**: El backend original usa Socket.io, pero AWS API Gateway WebSocket usa un protocolo diferente. El codigo Lambda debe ser adaptado para:

1. Usar `@aws-sdk/client-apigatewaymanagementapi` en lugar de Socket.io
2. Almacenar conexiones en DynamoDB
3. Broadcast usando iteracion sobre conexiones

## Costos Estimados

| Servicio | Costo Mensual |
|----------|---------------|
| DynamoDB (On-demand) | $5-20 |
| Lambda (1M requests) | $0.20 |
| API Gateway | $3.50 |
| S3 | $0.50 |
| Secrets Manager | $0.40 |
| **Total** | **~$10-25/mes** |

## Seguridad

- IAM con privilegios minimos
- Secrets en Secrets Manager
- DynamoDB encriptado at-rest
- API Gateway con rate limiting
- CORS configurado para frontend

## Troubleshooting

### Error: "Insufficient permissions"
Verifica que tu usuario AWS tenga los permisos necesarios.

### Error: "Table already exists"
Usa `terraform import` o elimina recursos manualmente.

### WebSocket no conecta
Verifica que el Lambda tenga permisos `execute-api:ManageConnections`.
