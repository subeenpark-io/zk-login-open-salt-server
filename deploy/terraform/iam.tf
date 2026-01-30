# IAM Roles and Policies for ECS

# ECS Execution Role (for ECS to pull images, write logs, etc.)
resource "aws_iam_role" "ecs_execution" {
  name = "${local.name_prefix}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-ecs-execution-role"
  }
}

# Attach managed policy for ECS execution
resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ECS Task Role (for the application to access AWS services)
resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-ecs-task-role"
  }
}

# Policy for accessing Secrets Manager
resource "aws_iam_policy" "secrets_access" {
  name        = "${local.name_prefix}-secrets-access"
  description = "Allow access to master seed secret"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.master_seed.arn
        ]
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-secrets-access"
  }
}

# Attach secrets policy to task role
resource "aws_iam_role_policy_attachment" "task_secrets" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = aws_iam_policy.secrets_access.arn
}

# Policy for CloudWatch Logs (for task role)
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
          "logs:PutLogEvents"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.ecs.arn}:*"
        ]
      }
    ]
  })

  tags = {
    Name = "${local.name_prefix}-cloudwatch-logs"
  }
}

# Attach CloudWatch policy to task role
resource "aws_iam_role_policy_attachment" "task_cloudwatch" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = aws_iam_policy.cloudwatch_logs.arn
}
