# =============================================================================
# Ultra Bingo - Terraform Variables
# =============================================================================

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "ultra-bingo"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# =============================================================================
# Application Configuration
# =============================================================================

variable "jwt_secret" {
  description = "JWT secret for token signing"
  type        = string
  sensitive   = true
}

variable "admin_password" {
  description = "Admin panel password"
  type        = string
  sensitive   = true
}

variable "admin_wallets" {
  description = "Comma-separated list of admin wallet addresses"
  type        = string
}

variable "x402_facilitator_url" {
  description = "x402 Facilitator URL"
  type        = string
  default     = "https://facilitator.ultravioletadao.xyz"
}

variable "x402_network" {
  description = "x402 network (avalanche, base)"
  type        = string
  default     = "avalanche"
}

variable "x402_receiver_address" {
  description = "x402 receiver wallet address for payments"
  type        = string
}

variable "card_price" {
  description = "Price per bingo card in USDC (Avalanche Mainnet)"
  type        = string
  default     = "5"
}

variable "frontend_domain" {
  description = "Frontend domain for CORS"
  type        = string
  default     = ""
}

# =============================================================================
# Lambda Configuration
# =============================================================================

variable "lambda_memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}

variable "lambda_runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs20.x"
}

# =============================================================================
# DynamoDB Configuration
# =============================================================================

variable "dynamodb_billing_mode" {
  description = "DynamoDB billing mode (PROVISIONED or PAY_PER_REQUEST)"
  type        = string
  default     = "PAY_PER_REQUEST"
}

variable "dynamodb_read_capacity" {
  description = "DynamoDB read capacity units (only for PROVISIONED)"
  type        = number
  default     = 5
}

variable "dynamodb_write_capacity" {
  description = "DynamoDB write capacity units (only for PROVISIONED)"
  type        = number
  default     = 5
}

# =============================================================================
# Tags
# =============================================================================

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "ultra-bingo"
    ManagedBy   = "terraform"
    Application = "UltravioletaDAO Bingo"
  }
}
