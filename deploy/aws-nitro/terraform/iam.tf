# IAM Roles and Policies for EC2 with Nitro Enclaves

# EC2 Instance Role
resource "aws_iam_role" "ec2" {
  name = "${local.name_prefix}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-ec2-role"
  }
}

# Instance Profile
resource "aws_iam_instance_profile" "ec2" {
  name = "${local.name_prefix}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# Policy for KMS operations (encrypt for setup, decrypt via enclave)
resource "aws_iam_policy" "kms_access" {
  name        = "${local.name_prefix}-kms-access"
  description = "Allow KMS operations for enclave seed"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Encrypt operations (for initial seed setup from parent)
      {
        Effect = "Allow"
        Action = [
          "kms:Encrypt",
          "kms:GenerateDataKey",
          "kms:GenerateDataKeyWithoutPlaintext",
          "kms:DescribeKey"
        ]
        Resource = [aws_kms_key.enclave_seed.arn]
      },
      # Decrypt is handled via KMS key policy with attestation
      # This allows the request to reach KMS; the key policy enforces attestation
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = [aws_kms_key.enclave_seed.arn]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "kms_access" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.kms_access.arn
}

# Policy for CloudWatch Logs
resource "aws_iam_policy" "cloudwatch_logs" {
  name        = "${local.name_prefix}-cloudwatch-logs"
  description = "Allow writing to CloudWatch Logs"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.ec2.arn}:*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "cloudwatch_logs" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.cloudwatch_logs.arn
}

# Policy for ECR (to pull Docker images)
resource "aws_iam_policy" "ecr_access" {
  name        = "${local.name_prefix}-ecr-access"
  description = "Allow pulling from ECR"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchCheckLayerAvailability"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecr_access" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.ecr_access.arn
}

# SSM for secure access (instead of SSH)
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
