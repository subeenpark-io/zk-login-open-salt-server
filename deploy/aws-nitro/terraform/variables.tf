# Variables for zkLogin Salt Server Nitro Enclaves Deployment

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name (prod, staging, dev)"
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

# EC2 Configuration
variable "instance_type" {
  description = "EC2 instance type (must support Nitro Enclaves)"
  type        = string
  default     = "c5.xlarge"
}

variable "key_name" {
  description = "SSH key pair name for EC2 instance"
  type        = string
  default     = ""
}

variable "root_volume_size" {
  description = "Size of root EBS volume in GB"
  type        = number
  default     = 30
}

# Enclave Configuration
variable "enclave_cpu_count" {
  description = "Number of vCPUs for the enclave"
  type        = number
  default     = 2
}

variable "enclave_memory_mb" {
  description = "Memory for the enclave in MB"
  type        = number
  default     = 512
}

# Enclave PCR values (from build-eif.sh output)
variable "enclave_pcr0" {
  description = "PCR0 value of the enclave image (from build-eif.sh)"
  type        = string
  default     = ""
}

variable "enclave_pcr1" {
  description = "PCR1 value (optional, for stricter policy)"
  type        = string
  default     = ""
}

variable "enclave_pcr2" {
  description = "PCR2 value (optional, for stricter policy)"
  type        = string
  default     = ""
}

# Application Configuration
variable "app_port" {
  description = "Port the application listens on"
  type        = number
  default     = 3000
}

variable "vsock_port" {
  description = "vsock port for enclave communication"
  type        = number
  default     = 5000
}

# Domain Configuration (optional)
variable "domain_name" {
  description = "Custom domain name (optional)"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS (optional)"
  type        = string
  default     = ""
}

# Security
variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access ALB"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ssh_allowed_cidr_blocks" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = []
}

# Logging
variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}
