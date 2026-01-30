# EC2 Configuration with Nitro Enclaves

# EC2 Instance with Nitro Enclaves enabled
resource "aws_instance" "salt_server" {
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = var.instance_type

  # Nitro Enclaves must be enabled
  enclave_options {
    enabled = true
  }

  subnet_id                   = aws_subnet.private[0].id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  associate_public_ip_address = false

  # SSH key (optional)
  key_name = var.key_name != "" ? var.key_name : null

  # Root volume
  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size
    encrypted             = true
    delete_on_termination = true
  }

  # Metadata options
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  # User data script for setup
  user_data = base64encode(templatefile("${path.module}/templates/user-data.sh", {
    aws_region         = var.aws_region
    kms_key_id         = aws_kms_key.enclave_seed.arn
    app_port           = var.app_port
    vsock_port         = var.vsock_port
    enclave_cpu_count  = var.enclave_cpu_count
    enclave_memory_mb  = var.enclave_memory_mb
    log_group_name     = aws_cloudwatch_log_group.ec2.name
  }))

  tags = {
    Name = "${local.name_prefix}-ec2"
  }

  # Ensure KMS key is created before instance
  depends_on = [aws_kms_key.enclave_seed]
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "ec2" {
  name              = "/zklogin/${var.environment}/salt-server"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${local.name_prefix}-logs"
  }
}
