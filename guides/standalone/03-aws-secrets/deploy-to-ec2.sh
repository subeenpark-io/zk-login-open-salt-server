#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "======================================"
echo "  EC2 인스턴스에 Salt Server 배포"
echo "======================================"
echo ""

# EC2 인스턴스 ID와 Region
INSTANCE_ID="i-0c4ba36a98b543bd6"
AWS_REGION="ap-northeast-2"
SECRET_NAME="zklogin/prod-seed"
ALB_URL="http://zklogin-prod-alb-1474010946.ap-northeast-2.elb.amazonaws.com"

# 1. EC2 인스턴스 상태 확인
echo -e "${BLUE}🔍 EC2 인스턴스 상태 확인 중...${NC}"
INSTANCE_STATE=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --region "$AWS_REGION" \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text)

if [ "$INSTANCE_STATE" != "running" ]; then
    echo -e "${RED}❌ EC2 인스턴스가 실행 중이지 않습니다: $INSTANCE_STATE${NC}"
    exit 1
fi

echo -e "${GREEN}✅ EC2 인스턴스 실행 중${NC}"
echo ""

# 2. 로컬 코드 빌드 및 패키징
echo -e "${BLUE}📦 로컬 코드 빌드 및 패키징 중...${NC}"
cd "$PROJECT_ROOT"

# 빌드
npm run build

# 패키지 생성 (node_modules 제외, dist 포함)
tar -czf /tmp/salt-server.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='tmp' \
    --exclude='coverage' \
    package.json \
    package-lock.json \
    dist/

echo -e "${GREEN}✅ 패키지 생성 완료: /tmp/salt-server.tar.gz${NC}"
echo ""

# 3. EC2로 파일 전송
echo -e "${BLUE}📤 EC2로 파일 전송 중...${NC}"

# S3 버킷 생성 (임시 전송용)
BUCKET_NAME="zklogin-deploy-temp-$(date +%s)"
aws s3 mb "s3://$BUCKET_NAME" --region "$AWS_REGION" || true

# S3에 업로드
aws s3 cp /tmp/salt-server.tar.gz "s3://$BUCKET_NAME/salt-server.tar.gz" --region "$AWS_REGION"

echo -e "${GREEN}✅ S3 업로드 완료${NC}"
echo ""

# 4. EC2에서 설치 스크립트 실행
echo -e "${BLUE}🚀 EC2에서 배포 스크립트 실행 중...${NC}"

aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --region "$AWS_REGION" \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=[
        "set -e",
        "echo \"=== Salt Server 배포 시작 ===\"",
        "sudo yum install -y nodejs npm",
        "cd /home/ec2-user",
        "mkdir -p salt-server",
        "cd salt-server",
        "aws s3 cp s3://'"$BUCKET_NAME"'/salt-server.tar.gz . --region '"$AWS_REGION"'",
        "tar -xzf salt-server.tar.gz",
        "npm ci --omit=dev",
        "echo \"=== Config 파일 생성 ===\"",
        "mkdir -p config",
        "cat > config/production.yaml << EOF
server:
  port: 3000
  host: 0.0.0.0

logging:
  level: info
  format: json

security:
  corsOrigins: \"*\"
  rateLimitMax: 1000
  rateLimitWindowMs: 60000

provider:
  type: local
  seed:
    type: aws
    secretName: '"$SECRET_NAME"'
    region: '"$AWS_REGION"'
    secretKey: masterSeed
EOF",
        "echo \"=== systemd service 생성 ===\"",
        "sudo tee /etc/systemd/system/salt-server.service > /dev/null << EOF
[Unit]
Description=zkLogin Salt Server
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/salt-server
Environment=NODE_ENV=production
Environment=CONFIG_FILE=/home/ec2-user/salt-server/config/production.yaml
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF",
        "echo \"=== 서비스 시작 ===\"",
        "sudo systemctl daemon-reload",
        "sudo systemctl enable salt-server",
        "sudo systemctl restart salt-server",
        "sleep 5",
        "echo \"=== 서비스 상태 확인 ===\"",
        "sudo systemctl status salt-server --no-pager",
        "echo \"=== 로그 확인 ===\"",
        "sudo journalctl -u salt-server -n 20 --no-pager",
        "echo \"=== Health check ===\"",
        "curl -f http://localhost:3000/health || echo \"Health check failed\"",
        "echo \"=== 배포 완료 ===\""
    ]' \
    --output json > /tmp/ssm-command.json

COMMAND_ID=$(cat /tmp/ssm-command.json | jq -r '.Command.CommandId')

echo -e "${YELLOW}⏳ 명령 실행 대기 중... (Command ID: $COMMAND_ID)${NC}"
echo ""

# 명령 완료 대기
sleep 10

# 5. 명령 결과 확인
echo -e "${BLUE}📋 배포 결과 확인 중...${NC}"
aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$AWS_REGION" \
    --query 'StandardOutputContent' \
    --output text

# 6. S3 버킷 정리
echo ""
echo -e "${BLUE}🧹 임시 S3 버킷 정리 중...${NC}"
aws s3 rb "s3://$BUCKET_NAME" --force --region "$AWS_REGION" || true
rm /tmp/salt-server.tar.gz

echo ""
echo -e "${GREEN}✅ EC2 배포 완료!${NC}"
echo ""
echo "======================================"
echo "  배포 정보"
echo "======================================"
echo ""
echo "EC2 인스턴스: $INSTANCE_ID"
echo "외부 접근 URL: $ALB_URL"
echo "Health Check: $ALB_URL/health"
echo "Ready Check: $ALB_URL/ready"
echo ""
echo "======================================"
echo "  테스트 방법"
echo "======================================"
echo ""
echo "1. Health check:"
echo "   curl $ALB_URL/health"
echo ""
echo "2. Ready check:"
echo "   curl $ALB_URL/ready"
echo ""
echo "3. Salt API 테스트:"
echo "   curl -X POST $ALB_URL/v1/salt \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"jwt\": \"YOUR_JWT_HERE\"}'"
echo ""
echo "======================================"
echo "  서비스 관리"
echo "======================================"
echo ""
echo "EC2 접속:"
echo "  aws ssm start-session --target $INSTANCE_ID --region $AWS_REGION"
echo ""
echo "서비스 상태:"
echo "  sudo systemctl status salt-server"
echo ""
echo "로그 확인:"
echo "  sudo journalctl -u salt-server -f"
echo ""
echo "서비스 재시작:"
echo "  sudo systemctl restart salt-server"
echo ""
