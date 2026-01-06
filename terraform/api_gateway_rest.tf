# =============================================================================
# Ultra Bingo - API Gateway REST API
# =============================================================================
# REST API for all HTTP endpoints:
# - /api/auth/* - Authentication
# - /api/cards/* - Card management
# - /api/game/* - Game state
# - /api/admin/* - Admin operations
# =============================================================================

# =============================================================================
# REST API Definition
# =============================================================================

resource "aws_apigatewayv2_api" "rest" {
  name          = "${local.name_prefix}-rest-api"
  protocol_type = "HTTP"
  description   = "Ultra Bingo REST API"

  cors_configuration {
    allow_origins     = local.cors_origins
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers     = ["Content-Type", "Authorization", "X-PAYMENT", "x-payment", "PAYMENT-SIGNATURE", "payment-signature"]
    expose_headers    = ["PAYMENT-REQUIRED", "Payment-Required", "PAYMENT-RESPONSE", "Payment-Response", "X-PAYMENT-REQUIRED"]
    max_age           = 300
    allow_credentials = true
  }

  tags = {
    Name = "${local.name_prefix}-rest-api"
  }
}

# =============================================================================
# Lambda Integration
# =============================================================================

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.rest.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# =============================================================================
# Routes
# =============================================================================

# Health check
resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Auth routes
resource "aws_apigatewayv2_route" "auth_register" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "POST /api/auth/register"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "auth_me" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/auth/me"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "auth_wallet" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "POST /api/auth/wallet"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "auth_cards" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/auth/cards"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Cards routes
resource "aws_apigatewayv2_route" "cards_available" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/cards/available"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "cards_purchase" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "POST /api/cards/purchase"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "cards_my_cards" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/cards/my-cards"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "cards_by_id" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/cards/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Game routes
resource "aws_apigatewayv2_route" "game_current" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/game/current"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "game_called_numbers" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/game/called-numbers"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "game_status" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/game/status"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "game_modes" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/game/modes"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "game_pattern" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/game/pattern/{mode}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "game_winners" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/game/winners"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "game_winners_wallet" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/game/winners/{wallet}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Admin routes
resource "aws_apigatewayv2_route" "admin_login" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "POST /api/admin/login"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "admin_validate" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/admin/validate"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "admin_stats" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/admin/stats"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "admin_game_start" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "POST /api/admin/game/start"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "admin_game_pause" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "POST /api/admin/game/pause"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "admin_game_resume" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "POST /api/admin/game/resume"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "admin_game_end" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "POST /api/admin/game/end"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "admin_game_call" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "POST /api/admin/game/call"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "admin_game_verify" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "POST /api/admin/game/verify"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "admin_game_modes" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/admin/game/modes"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "admin_game_mode" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "POST /api/admin/game/mode"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "admin_cards_generate" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "POST /api/admin/cards/generate"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "admin_cards_search" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/admin/cards/search"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "admin_cards_active" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/admin/cards/active"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "admin_cards_details" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/admin/cards/{cardId}/details"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "admin_users" {
  api_id    = aws_apigatewayv2_api.rest.id
  route_key = "GET /api/admin/users"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# =============================================================================
# Stage
# =============================================================================

resource "aws_apigatewayv2_stage" "rest" {
  api_id      = aws_apigatewayv2_api.rest.id
  name        = var.environment
  auto_deploy = true

  # NOTE: access_log_settings requires API Gateway account-level CloudWatch role
  # This can be enabled later by configuring the role in API Gateway settings
  # access_log_settings {
  #   destination_arn = aws_cloudwatch_log_group.api_gateway_rest.arn
  #   format = jsonencode({
  #     requestId      = "$context.requestId"
  #     ip             = "$context.identity.sourceIp"
  #     requestTime    = "$context.requestTime"
  #     httpMethod     = "$context.httpMethod"
  #     routeKey       = "$context.routeKey"
  #     status         = "$context.status"
  #     responseLength = "$context.responseLength"
  #     errorMessage   = "$context.error.message"
  #   })
  # }

  default_route_settings {
    throttling_burst_limit = 100
    throttling_rate_limit  = 50
  }
}

# =============================================================================
# CloudWatch Log Group for API Gateway
# =============================================================================

resource "aws_cloudwatch_log_group" "api_gateway_rest" {
  name              = "/aws/apigateway/${local.name_prefix}-rest-api"
  retention_in_days = 14
}

# =============================================================================
# Lambda Permission for API Gateway
# =============================================================================

resource "aws_lambda_permission" "api_gateway_rest" {
  statement_id  = "AllowAPIGatewayREST"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.rest.execution_arn}/*/*"
}

# =============================================================================
# Outputs
# =============================================================================

output "rest_api_id" {
  description = "ID of the REST API"
  value       = aws_apigatewayv2_api.rest.id
}

output "rest_api_endpoint" {
  description = "REST API endpoint URL"
  value       = aws_apigatewayv2_stage.rest.invoke_url
}
