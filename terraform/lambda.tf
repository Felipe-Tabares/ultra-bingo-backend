# =============================================================================
# Ultra Bingo - Lambda Functions
# =============================================================================
# Lambda functions for:
# - REST API handler (all HTTP endpoints)
# - WebSocket connect/disconnect/message handlers
# - DynamoDB Stream processor (broadcasts real-time updates)
# =============================================================================

# =============================================================================
# CloudWatch Log Groups (created before Lambdas)
# =============================================================================

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.name_prefix}-api"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "ws_connect" {
  name              = "/aws/lambda/${local.name_prefix}-ws-connect"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "ws_disconnect" {
  name              = "/aws/lambda/${local.name_prefix}-ws-disconnect"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "ws_message" {
  name              = "/aws/lambda/${local.name_prefix}-ws-message"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "stream_processor" {
  name              = "/aws/lambda/${local.name_prefix}-stream-processor"
  retention_in_days = 14
}

# =============================================================================
# Lambda Function: REST API Handler
# =============================================================================

resource "aws_lambda_function" "api" {
  function_name = "${local.name_prefix}-api"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = var.lambda_runtime
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  # Placeholder - will be updated with actual code
  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256

  environment {
    variables = {
      NODE_ENV                = var.environment
      DYNAMODB_TABLE          = aws_dynamodb_table.main.name
      CONNECTIONS_TABLE       = aws_dynamodb_table.connections.name
      SECRETS_ARN             = aws_secretsmanager_secret.app_config.arn
      WEBSOCKET_API_ENDPOINT  = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.websocket.name}"
      CORS_ORIGINS            = join(",", local.cors_origins)
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.api,
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy_attachment.dynamodb_access,
    aws_iam_role_policy_attachment.secrets_access
  ]

  tags = {
    Name = "${local.name_prefix}-api"
  }
}

# =============================================================================
# Lambda Function: WebSocket Connect
# =============================================================================

resource "aws_lambda_function" "ws_connect" {
  function_name = "${local.name_prefix}-ws-connect"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "connect.handler"
  runtime       = var.lambda_runtime
  memory_size   = 256
  timeout       = 10

  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256

  environment {
    variables = {
      NODE_ENV          = var.environment
      DYNAMODB_TABLE    = aws_dynamodb_table.main.name
      CONNECTIONS_TABLE = aws_dynamodb_table.connections.name
      SECRETS_ARN       = aws_secretsmanager_secret.app_config.arn
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.ws_connect,
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy_attachment.dynamodb_access,
    aws_iam_role_policy_attachment.secrets_access
  ]

  tags = {
    Name = "${local.name_prefix}-ws-connect"
  }
}

# =============================================================================
# Lambda Function: WebSocket Disconnect
# =============================================================================

resource "aws_lambda_function" "ws_disconnect" {
  function_name = "${local.name_prefix}-ws-disconnect"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "disconnect.handler"
  runtime       = var.lambda_runtime
  memory_size   = 256
  timeout       = 10

  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256

  environment {
    variables = {
      NODE_ENV          = var.environment
      CONNECTIONS_TABLE = aws_dynamodb_table.connections.name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.ws_disconnect,
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy_attachment.dynamodb_access
  ]

  tags = {
    Name = "${local.name_prefix}-ws-disconnect"
  }
}

# =============================================================================
# Lambda Function: WebSocket Message Handler
# =============================================================================

resource "aws_lambda_function" "ws_message" {
  function_name = "${local.name_prefix}-ws-message"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "message.handler"
  runtime       = var.lambda_runtime
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256

  environment {
    variables = {
      NODE_ENV                = var.environment
      DYNAMODB_TABLE          = aws_dynamodb_table.main.name
      CONNECTIONS_TABLE       = aws_dynamodb_table.connections.name
      SECRETS_ARN             = aws_secretsmanager_secret.app_config.arn
      WEBSOCKET_API_ENDPOINT  = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.websocket.name}"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.ws_message,
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy_attachment.dynamodb_access,
    aws_iam_role_policy_attachment.secrets_access,
    aws_iam_role_policy_attachment.websocket_management
  ]

  tags = {
    Name = "${local.name_prefix}-ws-message"
  }
}

# =============================================================================
# Lambda Function: DynamoDB Stream Processor
# =============================================================================

resource "aws_lambda_function" "stream_processor" {
  function_name = "${local.name_prefix}-stream-processor"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "stream.handler"
  runtime       = var.lambda_runtime
  memory_size   = 256
  timeout       = 60

  filename         = data.archive_file.lambda_placeholder.output_path
  source_code_hash = data.archive_file.lambda_placeholder.output_base64sha256

  environment {
    variables = {
      NODE_ENV                = var.environment
      CONNECTIONS_TABLE       = aws_dynamodb_table.connections.name
      WEBSOCKET_API_ENDPOINT  = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${var.aws_region}.amazonaws.com/${aws_apigatewayv2_stage.websocket.name}"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.stream_processor,
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy_attachment.dynamodb_access,
    aws_iam_role_policy_attachment.websocket_management
  ]

  tags = {
    Name = "${local.name_prefix}-stream-processor"
  }
}

# =============================================================================
# DynamoDB Stream Event Source Mapping
# =============================================================================

resource "aws_lambda_event_source_mapping" "dynamodb_stream" {
  event_source_arn  = aws_dynamodb_table.main.stream_arn
  function_name     = aws_lambda_function.stream_processor.arn
  starting_position = "LATEST"
  batch_size        = 10

  filter_criteria {
    filter {
      pattern = jsonencode({
        eventName = ["INSERT", "MODIFY"]
        dynamodb = {
          NewImage = {
            entityType = {
              S = ["GAME", "CARD"]
            }
          }
        }
      })
    }
  }
}

# =============================================================================
# Placeholder Lambda Code
# =============================================================================

data "archive_file" "lambda_placeholder" {
  type        = "zip"
  output_path = "${path.module}/placeholder.zip"

  source {
    content  = <<EOF
exports.handler = async (event) => {
  console.log('Placeholder function - deploy actual code');
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Placeholder - deploy actual code' })
  };
};
EOF
    filename = "index.js"
  }
}

# =============================================================================
# Outputs
# =============================================================================

output "lambda_api_arn" {
  description = "ARN of the API Lambda function"
  value       = aws_lambda_function.api.arn
}

output "lambda_api_name" {
  description = "Name of the API Lambda function"
  value       = aws_lambda_function.api.function_name
}

output "lambda_ws_connect_arn" {
  description = "ARN of the WebSocket connect Lambda"
  value       = aws_lambda_function.ws_connect.arn
}

output "lambda_ws_disconnect_arn" {
  description = "ARN of the WebSocket disconnect Lambda"
  value       = aws_lambda_function.ws_disconnect.arn
}

output "lambda_ws_message_arn" {
  description = "ARN of the WebSocket message Lambda"
  value       = aws_lambda_function.ws_message.arn
}

output "lambda_stream_processor_arn" {
  description = "ARN of the Stream Processor Lambda"
  value       = aws_lambda_function.stream_processor.arn
}
