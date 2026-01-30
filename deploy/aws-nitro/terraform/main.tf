# Terraform Configuration for zkLogin Salt Server with Nitro Enclaves
#
# This configuration deploys:
# - VPC with public/private subnets
# - EC2 instance with Nitro Enclaves enabled
# - Application Load Balancer
# - KMS key with attestation-based access policy
# - IAM roles and policies
#
# Architecture:
# ALB → EC2 (Parent) ↔ vsock → Nitro Enclave
#                              └─→ KMS (attestation)

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
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

# Local values
locals {
  name_prefix = "zklogin-${var.environment}"

  # Nitro-supported instance types
  # c5, c5d, c5n, m5, m5d, m5n, r5, r5d, r5n, etc.
  nitro_instance_types = [
    "c5.xlarge",
    "c5.2xlarge",
    "c5.4xlarge",
    "m5.xlarge",
    "m5.2xlarge",
    "m5.4xlarge",
    "r5.xlarge",
    "r5.2xlarge",
  ]
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "aws_caller_identity" "current" {}
