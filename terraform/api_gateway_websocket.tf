# =============================================================================
# Ultra Bingo - API Gateway WebSocket API
# =============================================================================
# WebSocket API for real-time communication:
# - $connect - Handle new connections
# - $disconnect - Handle disconnections
# - $default - Handle all WebSocket messages
# - Custom routes for admin actions
# =============================================================================

# =============================================================================
# WebSocket API Definition
# =============================================================================

resource "aws_apigatewayv2_api" "websocket" {
  name                       = "${local.name_prefix}-websocket-api"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
  description                = "Ultra Bingo WebSocket API for real-time game updates"

  tags = {
    Name = "${local.name_prefix}-websocket-api"
  }
}

# =============================================================================
# Lambda Integrations
# =============================================================================

# Connect Integration
resource "aws_apigatewayv2_integration" "ws_connect" {
  api_id                    = aws_apigatewayv2_api.websocket.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.ws_connect.invoke_arn
  content_handling_strategy = "CONVERT_TO_TEXT"
  passthrough_behavior      = "WHEN_NO_MATCH"
}

# Disconnect Integration
resource "aws_apigatewayv2_integration" "ws_disconnect" {
  api_id                    = aws_apigatewayv2_api.websocket.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.ws_disconnect.invoke_arn
  content_handling_strategy = "CONVERT_TO_TEXT"
  passthrough_behavior      = "WHEN_NO_MATCH"
}

# Message Integration (default handler)
resource "aws_apigatewayv2_integration" "ws_message" {
  api_id                    = aws_apigatewayv2_api.websocket.id
  integration_type          = "AWS_PROXY"
  integration_uri           = aws_lambda_function.ws_message.invoke_arn
  content_handling_strategy = "CONVERT_TO_TEXT"
  passthrough_behavior      = "WHEN_NO_MATCH"
}

# =============================================================================
# Routes
# =============================================================================

# $connect route
resource "aws_apigatewayv2_route" "ws_connect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_connect.id}"
}

# $disconnect route
resource "aws_apigatewayv2_route" "ws_disconnect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_disconnect.id}"
}

# $default route - catches all messages
resource "aws_apigatewayv2_route" "ws_default" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.ws_message.id}"
}

# Join game route
resource "aws_apigatewayv2_route" "ws_join_game" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "join-game"
  target    = "integrations/${aws_apigatewayv2_integration.ws_message.id}"
}

# Leave game route
resource "aws_apigatewayv2_route" "ws_leave_game" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "leave-game"
  target    = "integrations/${aws_apigatewayv2_integration.ws_message.id}"
}

# Admin: Start game
resource "aws_apigatewayv2_route" "ws_admin_start" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "admin-start-game"
  target    = "integrations/${aws_apigatewayv2_integration.ws_message.id}"
}

# Admin: Pause game
resource "aws_apigatewayv2_route" "ws_admin_pause" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "admin-pause-game"
  target    = "integrations/${aws_apigatewayv2_integration.ws_message.id}"
}

# Admin: Resume game
resource "aws_apigatewayv2_route" "ws_admin_resume" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "admin-resume-game"
  target    = "integrations/${aws_apigatewayv2_integration.ws_message.id}"
}

# Admin: End game
resource "aws_apigatewayv2_route" "ws_admin_end" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "admin-end-game"
  target    = "integrations/${aws_apigatewayv2_integration.ws_message.id}"
}

# Admin: Clear game
resource "aws_apigatewayv2_route" "ws_admin_clear" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "admin-clear-game"
  target    = "integrations/${aws_apigatewayv2_integration.ws_message.id}"
}

# Admin: Call number
resource "aws_apigatewayv2_route" "ws_admin_call" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "admin-call-number"
  target    = "integrations/${aws_apigatewayv2_integration.ws_message.id}"
}

# Admin: Set game mode
resource "aws_apigatewayv2_route" "ws_admin_mode" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "admin-set-game-mode"
  target    = "integrations/${aws_apigatewayv2_integration.ws_message.id}"
}

# Admin: Verify winner
resource "aws_apigatewayv2_route" "ws_admin_verify" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "admin-verify-winner"
  target    = "integrations/${aws_apigatewayv2_integration.ws_message.id}"
}

# Admin: Reject winner
resource "aws_apigatewayv2_route" "ws_admin_reject" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "admin-reject-winner"
  target    = "integrations/${aws_apigatewayv2_integration.ws_message.id}"
}

# =============================================================================
# Stage
# =============================================================================

resource "aws_apigatewayv2_stage" "websocket" {
  api_id      = aws_apigatewayv2_api.websocket.id
  name        = var.environment
  auto_deploy = true

  # NOTE: access_log_settings requires API Gateway account-level CloudWatch role
  # This can be enabled later by configuring the role in API Gateway settings
  # access_log_settings {
  #   destination_arn = aws_cloudwatch_log_group.api_gateway_websocket.arn
  #   format = jsonencode({
  #     requestId     = "$context.requestId"
  #     ip            = "$context.identity.sourceIp"
  #     connectionId  = "$context.connectionId"
  #     requestTime   = "$context.requestTime"
  #     routeKey      = "$context.routeKey"
  #     status        = "$context.status"
  #     errorMessage  = "$context.error.message"
  #   })
  # }

  default_route_settings {
    throttling_burst_limit = 500
    throttling_rate_limit  = 100
  }
}

# =============================================================================
# CloudWatch Log Group for WebSocket API Gateway
# =============================================================================

resource "aws_cloudwatch_log_group" "api_gateway_websocket" {
  name              = "/aws/apigateway/${local.name_prefix}-websocket-api"
  retention_in_days = 14
}

# =============================================================================
# Lambda Permissions for API Gateway WebSocket
# =============================================================================

resource "aws_lambda_permission" "ws_connect" {
  statement_id  = "AllowAPIGatewayWebSocketConnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_connect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/*"
}

resource "aws_lambda_permission" "ws_disconnect" {
  statement_id  = "AllowAPIGatewayWebSocketDisconnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_disconnect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/*"
}

resource "aws_lambda_permission" "ws_message" {
  statement_id  = "AllowAPIGatewayWebSocketMessage"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_message.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*/*"
}

# =============================================================================
# Outputs
# =============================================================================

output "websocket_api_id" {
  description = "ID of the WebSocket API"
  value       = aws_apigatewayv2_api.websocket.id
}

output "websocket_api_endpoint" {
  description = "WebSocket API endpoint URL"
  value       = "wss://${aws_apigatewayv2_api.websocket.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.websocket.name}"
}

output "websocket_api_execution_arn" {
  description = "WebSocket API execution ARN (for Lambda permissions)"
  value       = aws_apigatewayv2_api.websocket.execution_arn
}
