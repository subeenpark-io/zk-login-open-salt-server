# Terraform Outputs for Nitro Enclaves Deployment

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the ALB (for Route53)"
  value       = aws_lb.main.zone_id
}

output "ec2_instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.salt_server.id
}

output "ec2_private_ip" {
  description = "Private IP of EC2 instance"
  value       = aws_instance.salt_server.private_ip
}

output "kms_key_arn" {
  description = "ARN of KMS key for seed encryption"
  value       = aws_kms_key.enclave_seed.arn
}

output "kms_key_alias" {
  description = "KMS key alias"
  value       = aws_kms_alias.enclave_seed.name
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.ec2.name
}

output "salt_server_url" {
  description = "URL to access the salt server"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"
}

output "salt_endpoint" {
  description = "Full URL for the /v1/salt endpoint"
  value       = var.domain_name != "" ? "https://${var.domain_name}/v1/salt" : "http://${aws_lb.main.dns_name}/v1/salt"
}

# Deployment Instructions
output "next_steps" {
  description = "Next steps after deployment"
  value       = <<-EOT

    ============================================
    Nitro Enclaves Deployment Complete!
    ============================================

    Salt Server URL: ${var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"}
    KMS Key ARN: ${aws_kms_key.enclave_seed.arn}

    Next Steps:
    -----------

    1. Build the enclave image:
       cd enclave && ./build-eif.sh

    2. Note the PCR0 value from the build output

    3. Update terraform.tfvars with PCR0:
       enclave_pcr0 = "<pcr0-value-from-build>"

    4. Apply the updated configuration:
       terraform apply

    5. Connect to EC2 instance (via SSM):
       aws ssm start-session --target ${aws_instance.salt_server.id}

    6. Upload files to EC2:
       # Application code
       scp -r dist/ ec2-user@<instance>:/opt/zklogin/

       # Enclave image
       scp enclave/zklogin-enclave.eif ec2-user@<instance>:/opt/zklogin/enclave/

    7. Encrypt master seed with KMS:
       aws kms encrypt \
         --key-id ${aws_kms_key.enclave_seed.arn} \
         --plaintext fileb://master-seed.bin \
         --output text --query CiphertextBlob > encrypted-seed.b64

    8. Set encrypted seed in enclave environment:
       export ENCRYPTED_SEED=$(cat encrypted-seed.b64)

    9. Start the enclave:
       /opt/zklogin/run-enclave.sh

    10. Start the salt server:
        sudo systemctl enable --now zklogin-salt

    11. Test the endpoint:
        curl -X POST ${var.domain_name != "" ? "https://${var.domain_name}/v1/salt" : "http://${aws_lb.main.dns_name}/v1/salt"} \
          -H "Content-Type: application/json" \
          -d '{"jwt": "<your-jwt>"}'

    ============================================

  EOT
}
