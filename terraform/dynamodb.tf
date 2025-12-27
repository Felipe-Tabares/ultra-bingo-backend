# =============================================================================
# Ultra Bingo - DynamoDB Tables
# =============================================================================
# Single-table design for optimal performance:
# - Main table: Users, Cards, Games, Winners
# - Connections table: WebSocket connections with TTL
# =============================================================================

# =============================================================================
# Main Table - Single Table Design
# =============================================================================

resource "aws_dynamodb_table" "main" {
  name         = "${local.name_prefix}-main"
  billing_mode = var.dynamodb_billing_mode

  # Only set capacity if using PROVISIONED billing
  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  # Primary key
  hash_key  = "PK"
  range_key = "SK"

  # Key definitions
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI1: For wallet lookups
  attribute {
    name = "GSI1PK"
    type = "S"
  }

  # GSI2: For status-based queries (available cards, active games)
  attribute {
    name = "GSI2PK"
    type = "S"
  }

  attribute {
    name = "GSI2SK"
    type = "S"
  }

  # Global Secondary Index 1: Wallet Lookup
  global_secondary_index {
    name            = "GSI1"
    hash_key        = "GSI1PK"
    range_key       = "SK"
    projection_type = "ALL"

    read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  # Global Secondary Index 2: Status queries (available cards, game status)
  global_secondary_index {
    name            = "GSI2"
    hash_key        = "GSI2PK"
    range_key       = "GSI2SK"
    projection_type = "ALL"

    read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  # Enable DynamoDB Streams for real-time updates
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  # Enable point-in-time recovery for data protection
  point_in_time_recovery {
    enabled = true
  }

  # Enable server-side encryption
  server_side_encryption {
    enabled = true
  }

  # TTL for reservation expiration
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "${local.name_prefix}-main"
  }
}

# =============================================================================
# WebSocket Connections Table
# =============================================================================

resource "aws_dynamodb_table" "connections" {
  name         = "${local.name_prefix}-connections"
  billing_mode = var.dynamodb_billing_mode

  read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
  write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null

  # Connection ID as primary key
  hash_key = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  # GSI for finding connections by user
  attribute {
    name = "odId"
    type = "S"
  }

  global_secondary_index {
    name            = "UserIndex"
    hash_key        = "odId"
    projection_type = "ALL"

    read_capacity  = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_read_capacity : null
    write_capacity = var.dynamodb_billing_mode == "PROVISIONED" ? var.dynamodb_write_capacity : null
  }

  # TTL for automatic connection cleanup (stale connections)
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Enable server-side encryption
  server_side_encryption {
    enabled = true
  }

  tags = {
    Name = "${local.name_prefix}-connections"
  }
}

# =============================================================================
# Outputs
# =============================================================================

output "dynamodb_main_table_name" {
  description = "Name of the main DynamoDB table"
  value       = aws_dynamodb_table.main.name
}

output "dynamodb_main_table_arn" {
  description = "ARN of the main DynamoDB table"
  value       = aws_dynamodb_table.main.arn
}

output "dynamodb_main_stream_arn" {
  description = "ARN of the main DynamoDB stream"
  value       = aws_dynamodb_table.main.stream_arn
}

output "dynamodb_connections_table_name" {
  description = "Name of the connections DynamoDB table"
  value       = aws_dynamodb_table.connections.name
}

output "dynamodb_connections_table_arn" {
  description = "ARN of the connections DynamoDB table"
  value       = aws_dynamodb_table.connections.arn
}
