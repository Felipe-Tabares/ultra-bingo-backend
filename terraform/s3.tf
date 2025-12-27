# =============================================================================
# Ultra Bingo - S3 Bucket for Static Assets and Lambda Code
# =============================================================================

# =============================================================================
# Lambda Code Bucket
# =============================================================================

resource "aws_s3_bucket" "lambda_code" {
  bucket = "${local.name_prefix}-lambda-code-${random_id.unique.hex}"

  tags = {
    Name = "${local.name_prefix}-lambda-code"
  }
}

resource "aws_s3_bucket_versioning" "lambda_code" {
  bucket = aws_s3_bucket.lambda_code.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "lambda_code" {
  bucket = aws_s3_bucket.lambda_code.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "lambda_code" {
  bucket = aws_s3_bucket.lambda_code.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# =============================================================================
# Static Assets Bucket (for any backend-generated assets)
# =============================================================================

resource "aws_s3_bucket" "assets" {
  bucket = "${local.name_prefix}-assets-${random_id.unique.hex}"

  tags = {
    Name = "${local.name_prefix}-assets"
  }
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = local.cors_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# =============================================================================
# Outputs
# =============================================================================

output "s3_lambda_code_bucket" {
  description = "S3 bucket for Lambda code"
  value       = aws_s3_bucket.lambda_code.bucket
}

output "s3_lambda_code_bucket_arn" {
  description = "ARN of the Lambda code bucket"
  value       = aws_s3_bucket.lambda_code.arn
}

output "s3_assets_bucket" {
  description = "S3 bucket for static assets"
  value       = aws_s3_bucket.assets.bucket
}

output "s3_assets_bucket_arn" {
  description = "ARN of the assets bucket"
  value       = aws_s3_bucket.assets.arn
}
