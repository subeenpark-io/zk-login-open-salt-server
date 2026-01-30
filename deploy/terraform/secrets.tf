# AWS Secrets Manager Configuration

# Secret for Master Seed
resource "aws_secretsmanager_secret" "master_seed" {
  name                    = var.master_seed_secret_name
  description             = "Master seed for zkLogin salt generation"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = {
    Name = "${local.name_prefix}-master-seed"
  }
}

# Note: The actual secret value should be set manually or via a separate process
# Do NOT store the master seed in Terraform state or version control!
#
# To set the secret value:
# aws secretsmanager put-secret-value \
#   --secret-id zklogin/master-seed \
#   --secret-string '{"masterSeed": "0x<your-64-char-hex-seed>"}'
#
# Or generate a new seed:
# npm run generate-seed
# Then use that value in the secret

# Secret rotation (optional - for enhanced security)
# Note: Rotating the master seed will change all derived salt values!
# Only enable if you have a migration strategy.
#
# resource "aws_secretsmanager_secret_rotation" "master_seed" {
#   secret_id           = aws_secretsmanager_secret.master_seed.id
#   rotation_lambda_arn = aws_lambda_function.secret_rotation.arn
#
#   rotation_rules {
#     automatically_after_days = 90
#   }
# }
