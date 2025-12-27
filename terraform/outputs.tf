# =============================================================================
# Ultra Bingo - Terraform Outputs
# =============================================================================

# =============================================================================
# API Endpoints
# =============================================================================

output "api_endpoint" {
  description = "REST API endpoint URL"
  value       = aws_apigatewayv2_stage.rest.invoke_url
}

output "websocket_endpoint" {
  description = "WebSocket API endpoint URL"
  value       = "wss://${aws_apigatewayv2_api.websocket.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.websocket.name}"
}

# =============================================================================
# Frontend Configuration
# =============================================================================

output "frontend_config" {
  description = "Configuration for frontend .env file"
  value = <<-EOT
    # Ultra Bingo Frontend Configuration
    # Add these to your frontend .env file

    VITE_API_URL=${aws_apigatewayv2_stage.rest.invoke_url}
    VITE_WS_URL=wss://${aws_apigatewayv2_api.websocket.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.websocket.name}
    VITE_X402_RECEIVER=${var.x402_receiver_address}
    VITE_X402_NETWORK=${var.x402_network}
  EOT
}

# =============================================================================
# Lambda Function Names (for deployment)
# =============================================================================

output "lambda_functions" {
  description = "Lambda function names for deployment"
  value = {
    api              = aws_lambda_function.api.function_name
    ws_connect       = aws_lambda_function.ws_connect.function_name
    ws_disconnect    = aws_lambda_function.ws_disconnect.function_name
    ws_message       = aws_lambda_function.ws_message.function_name
    stream_processor = aws_lambda_function.stream_processor.function_name
  }
}

# =============================================================================
# S3 Buckets
# =============================================================================

output "s3_buckets" {
  description = "S3 bucket names"
  value = {
    lambda_code = aws_s3_bucket.lambda_code.bucket
    assets      = aws_s3_bucket.assets.bucket
  }
}

# =============================================================================
# DynamoDB Tables
# =============================================================================

output "dynamodb_tables" {
  description = "DynamoDB table names"
  value = {
    main        = aws_dynamodb_table.main.name
    connections = aws_dynamodb_table.connections.name
  }
}

# =============================================================================
# Deployment Commands
# =============================================================================

output "deployment_commands" {
  description = "Commands to deploy Lambda code"
  value = <<-EOT
    # Deploy Lambda functions (after building)

    # 1. Build and package Lambda code
    cd lambda && npm install && npm run build && zip -r function.zip .

    # 2. Update Lambda functions
    aws lambda update-function-code --function-name ${aws_lambda_function.api.function_name} --zip-file fileb://function.zip
    aws lambda update-function-code --function-name ${aws_lambda_function.ws_connect.function_name} --zip-file fileb://function.zip
    aws lambda update-function-code --function-name ${aws_lambda_function.ws_disconnect.function_name} --zip-file fileb://function.zip
    aws lambda update-function-code --function-name ${aws_lambda_function.ws_message.function_name} --zip-file fileb://function.zip
    aws lambda update-function-code --function-name ${aws_lambda_function.stream_processor.function_name} --zip-file fileb://function.zip
  EOT
}
