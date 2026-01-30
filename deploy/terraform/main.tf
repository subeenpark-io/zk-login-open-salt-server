# zkLogin Salt Server - Terraform Configuration
# AWS ECS Fargate deployment with Secrets Manager

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment to use remote state
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "zklogin-salt-server/terraform.tfstate"
  #   region         = "us-west-2"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "zklogin-salt-server"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

# Local values
locals {
  name_prefix = "zklogin-salt-${var.environment}"

  common_tags = {
    Project     = "zklogin-salt-server"
    Environment = var.environment
  }
}
