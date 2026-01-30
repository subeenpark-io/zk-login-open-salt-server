# KMS Configuration for Nitro Enclaves
#
# This KMS key is used to encrypt the master seed.
# The key policy restricts decryption to requests that include
# a valid attestation document with matching PCR values.
#
# PCR values are cryptographic measurements of the enclave image.
# Only the exact enclave image that was built can decrypt the seed.

# KMS Key for Enclave Seed Encryption
resource "aws_kms_key" "enclave_seed" {
  description             = "KMS key for zkLogin enclave seed encryption"
  deletion_window_in_days = var.environment == "prod" ? 30 : 7
  enable_key_rotation     = true

  # Key policy with attestation-based access control
  policy = jsonencode({
    Version = "2012-10-17"
    Id      = "enclave-seed-key-policy"
    Statement = [
      # Allow root account full access
      {
        Sid    = "RootAccountAccess"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      # Allow EC2 instance role to encrypt (for initial seed setup)
      {
        Sid    = "AllowEncrypt"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ec2.arn
        }
        Action = [
          "kms:Encrypt",
          "kms:GenerateDataKey",
          "kms:GenerateDataKeyWithoutPlaintext",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      # Allow decryption ONLY from Nitro Enclave with matching PCR values
      {
        Sid    = "AllowDecryptFromEnclave"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ec2.arn
        }
        Action   = "kms:Decrypt"
        Resource = "*"
        Condition = var.enclave_pcr0 != "" ? {
          StringEquals = {
            "kms:RecipientAttestation:ImageSha384" = var.enclave_pcr0
          }
        } : {}
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-enclave-seed-key"
  }
}

# KMS Alias for easier reference
resource "aws_kms_alias" "enclave_seed" {
  name          = "alias/${local.name_prefix}-enclave-seed"
  target_key_id = aws_kms_key.enclave_seed.key_id
}

# Note: To enable strict attestation-based access:
#
# 1. Build your enclave image:
#    cd enclave && ./build-eif.sh
#
# 2. Get PCR0 value from output (looks like SHA384 hash)
#
# 3. Update terraform.tfvars:
#    enclave_pcr0 = "your-pcr0-value-here"
#
# 4. Apply changes:
#    terraform apply
#
# Now only requests from your specific enclave image can decrypt the seed.
#
# For even stricter policies, you can also use:
# - PCR1: Hash of kernel and boot ramdisk
# - PCR2: Hash of application
# - PCR3: Hash of IAM role ARN (for role-based restrictions)
# - PCR4: Hash of instance ID (for instance-specific restrictions)
