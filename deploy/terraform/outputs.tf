# Terraform Outputs

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer (for Route53)"
  value       = aws_lb.main.zone_id
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "ecs_cluster_arn" {
  description = "ARN of the ECS cluster"
  value       = aws_ecs_cluster.main.arn
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.main.name
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "master_seed_secret_arn" {
  description = "ARN of the master seed secret in Secrets Manager"
  value       = aws_secretsmanager_secret.master_seed.arn
}

output "cloudwatch_log_group" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs.name
}

output "salt_server_url" {
  description = "URL to access the salt server"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"
}

output "salt_endpoint" {
  description = "Full URL for the /v1/salt endpoint"
  value       = var.domain_name != "" ? "https://${var.domain_name}/v1/salt" : "http://${aws_lb.main.dns_name}/v1/salt"
}

# Instructions
output "next_steps" {
  description = "Next steps after deployment"
  value       = <<-EOT

    ============================================
    Deployment Complete!
    ============================================

    Salt Server URL: ${var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"}
    Salt Endpoint:   ${var.domain_name != "" ? "https://${var.domain_name}/v1/salt" : "http://${aws_lb.main.dns_name}/v1/salt"}

    Next Steps:
    -----------
    1. Set the master seed in Secrets Manager:
       aws secretsmanager put-secret-value \
         --secret-id ${var.master_seed_secret_name} \
         --secret-string '{"masterSeed": "0x<your-64-char-hex-seed>"}'

    2. Build and push Docker image to ECR:
       aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin <account-id>.dkr.ecr.${var.aws_region}.amazonaws.com
       docker build -t zklogin-salt-server .
       docker tag zklogin-salt-server:latest <ecr-repo-url>:latest
       docker push <ecr-repo-url>:latest

    3. Update ECS service to use new image:
       aws ecs update-service --cluster ${aws_ecs_cluster.main.name} --service ${aws_ecs_service.main.name} --force-new-deployment

    4. Test the endpoint:
       curl -X POST ${var.domain_name != "" ? "https://${var.domain_name}/v1/salt" : "http://${aws_lb.main.dns_name}/v1/salt"} \
         -H "Content-Type: application/json" \
         -d '{"jwt": "<your-jwt>"}'

    ============================================

  EOT
}
