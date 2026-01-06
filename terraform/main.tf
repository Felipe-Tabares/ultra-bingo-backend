# =============================================================================
# Ultra Bingo - Main Terraform Configuration
# =============================================================================
# This Terraform configuration deploys the Ultra Bingo backend to AWS using:
# - API Gateway (REST + WebSocket) for HTTP and real-time communication
# - Lambda functions for serverless compute
# - DynamoDB for database with Streams for real-time updates
# - S3 for static assets
# - Secrets Manager for sensitive configuration
# =============================================================================

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Uncomment and configure for remote state
  # backend "s3" {
  #   bucket         = "ultra-bingo-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "ultra-bingo-terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}

# =============================================================================
# Local Values
# =============================================================================

locals {
  name_prefix = "${var.project_name}-${var.environment}"

  # CORS configuration
  cors_origins = var.frontend_domain != "" ? [
    "https://${var.frontend_domain}",
    "https://ultra-bingo-frontend-five.vercel.app",
    "https://ultra-bingo-frontend.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ] : [
    "https://ultra-bingo-frontend-five.vercel.app",
    "https://ultra-bingo-frontend.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ]
}

# =============================================================================
# Random ID for unique naming
# =============================================================================

resource "random_id" "unique" {
  byte_length = 4
}
