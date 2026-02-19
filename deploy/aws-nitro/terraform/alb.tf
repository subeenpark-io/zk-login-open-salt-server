# Application Load Balancer Configuration

# ALB
resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = {
    Name = "${local.name_prefix}-alb"
  }
}

# Target Group - Salt Server (port 3000)
resource "aws_lb_target_group" "salt" {
  name     = "${local.name_prefix}-salt-tg"
  port     = var.app_port
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
  }

  tags = {
    Name = "${local.name_prefix}-salt-tg"
  }
}

# Target Group - DApp Server (port 8080)
resource "aws_lb_target_group" "dapp" {
  name     = "${local.name_prefix}-dapp-tg"
  port     = 8080
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    path                = "/"
    protocol            = "HTTP"
    matcher             = "200"
  }

  tags = {
    Name = "${local.name_prefix}-dapp-tg"
  }
}

# Register EC2 with salt target group
resource "aws_lb_target_group_attachment" "salt" {
  target_group_arn = aws_lb_target_group.salt.arn
  target_id        = aws_instance.salt_server.id
  port             = var.app_port
}

# Register EC2 with dApp target group
resource "aws_lb_target_group_attachment" "dapp" {
  target_group_arn = aws_lb_target_group.dapp.arn
  target_id        = aws_instance.salt_server.id
  port             = 8080
}

# HTTP Listener → redirect to HTTPS (always, since we have ACM cert)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS Listener → default to dApp
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.dapp.arn
  }
}

# Route /v1/* to Salt Server
resource "aws_lb_listener_rule" "salt_v1" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.salt.arn
  }

  condition {
    path_pattern {
      values = ["/v1/*"]
    }
  }
}

# Route /health and /ready to Salt Server
resource "aws_lb_listener_rule" "salt_health" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.salt.arn
  }

  condition {
    path_pattern {
      values = ["/health", "/ready"]
    }
  }
}
