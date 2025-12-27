# =============================================================================
# Ultra Bingo - AWS Secrets Manager
# =============================================================================
# Stores sensitive configuration securely
# =============================================================================

resource "aws_secretsmanager_secret" "app_config" {
  name                    = "${local.name_prefix}-config-${random_id.unique.hex}"
  description             = "Ultra Bingo application configuration"
  recovery_window_in_days = 7

  tags = {
    Name = "${local.name_prefix}-config"
  }
}

resource "aws_secretsmanager_secret_version" "app_config" {
  secret_id = aws_secretsmanager_secret.app_config.id
  secret_string = jsonencode({
    JWT_SECRET            = var.jwt_secret
    ADMIN_PASSWORD        = var.admin_password
    ADMIN_WALLETS         = var.admin_wallets
    X402_FACILITATOR_URL  = var.x402_facilitator_url
    X402_NETWORK          = var.x402_network
    X402_RECEIVER_ADDRESS = var.x402_receiver_address
    CARD_PRICE            = var.card_price
  })
}

# =============================================================================
# Outputs
# =============================================================================

output "secrets_arn" {
  description = "ARN of the secrets manager secret"
  value       = aws_secretsmanager_secret.app_config.arn
}

output "secrets_name" {
  description = "Name of the secrets manager secret"
  value       = aws_secretsmanager_secret.app_config.name
}
