# Variables for zkLogin Salt Server deployment

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "prod"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

# ECS Configuration
variable "ecs_task_cpu" {
  description = "CPU units for ECS task (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 256
}

variable "ecs_task_memory" {
  description = "Memory (MB) for ECS task"
  type        = number
  default     = 512
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "ecs_min_count" {
  description = "Minimum number of ECS tasks for auto-scaling"
  type        = number
  default     = 1
}

variable "ecs_max_count" {
  description = "Maximum number of ECS tasks for auto-scaling"
  type        = number
  default     = 10
}

# Container Configuration
variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 3000
}

variable "container_image" {
  description = "Docker image for the salt server (ECR repository URL)"
  type        = string
}

# Secrets Manager
variable "master_seed_secret_name" {
  description = "Name of the secret in AWS Secrets Manager containing the master seed"
  type        = string
  default     = "zklogin/master-seed"
}

# Domain Configuration (optional)
variable "domain_name" {
  description = "Domain name for the salt server (optional, requires ACM certificate)"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ARN of the ACM certificate for HTTPS (required if domain_name is set)"
  type        = string
  default     = ""
}

# Security
variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the ALB (use 0.0.0.0/0 for public)"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# Logging
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

# Application Configuration
variable "cors_origins" {
  description = "Allowed CORS origins"
  type        = string
  default     = "*"
}

variable "rate_limit_max" {
  description = "Maximum requests per rate limit window"
  type        = number
  default     = 100
}
