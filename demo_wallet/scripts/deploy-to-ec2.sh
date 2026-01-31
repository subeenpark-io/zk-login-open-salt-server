#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "======================================"
echo "  zkLogin Wallet EC2 배포"
echo "======================================"
echo ""

# EC2 Configuration - 필요시 수정
INSTANCE_ID="${EC2_INSTANCE_ID:-i-0c4ba36a98b543bd6}"
AWS_REGION="${AWS_REGION:-ap-northeast-2}"
DEPLOY_PATH="/home/ec2-user/zklogin-wallet"
WALLET_PORT="${WALLET_PORT:-3001}"

# 1. Check EC2 instance status
echo -e "${BLUE}🔍 EC2 인스턴스 상태 확인 중...${NC}"
INSTANCE_STATE=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --region "$AWS_REGION" \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text 2>/dev/null || echo "error")

if [ "$INSTANCE_STATE" != "running" ]; then
    echo -e "${RED}❌ EC2 인스턴스가 실행 중이지 않습니다: $INSTANCE_STATE${NC}"
    exit 1
fi
echo -e "${GREEN}✅ EC2 인스턴스 실행 중${NC}"

# 2. Build locally
echo ""
echo -e "${BLUE}📦 로컬 빌드 중...${NC}"
cd "$PROJECT_DIR"

npm install
npm run build
npm run build:server

# 3. Create deployment package
echo ""
echo -e "${BLUE}📦 배포 패키지 생성 중...${NC}"
tar -czf /tmp/zklogin-wallet.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='src' \
    --exclude='server' \
    package.json \
    package-lock.json \
    dist/ \
    dist-server/ \
    ecosystem.config.cjs

echo -e "${GREEN}✅ 패키지 생성 완료${NC}"

# 4. Upload to S3
echo ""
echo -e "${BLUE}📤 S3 업로드 중...${NC}"
BUCKET_NAME="zklogin-deploy-temp-$(date +%s)"
aws s3 mb "s3://$BUCKET_NAME" --region "$AWS_REGION" 2>/dev/null || true
aws s3 cp /tmp/zklogin-wallet.tar.gz "s3://$BUCKET_NAME/zklogin-wallet.tar.gz" --region "$AWS_REGION"
echo -e "${GREEN}✅ S3 업로드 완료${NC}"

# 5. Deploy to EC2 via SSM
echo ""
echo -e "${BLUE}🚀 EC2 배포 중...${NC}"

aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --region "$AWS_REGION" \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=[
        "set -e",
        "echo \"=== zkLogin Wallet 배포 시작 ===\"",

        "# Install Node.js if not exists",
        "if ! command -v node &> /dev/null; then",
        "  echo \"Installing Node.js...\"",
        "  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -",
        "  sudo yum install -y nodejs",
        "fi",

        "# Install PM2 if not exists",
        "if ! command -v pm2 &> /dev/null; then",
        "  echo \"Installing PM2...\"",
        "  sudo npm install -g pm2",
        "fi",

        "# Create deploy directory",
        "mkdir -p '"$DEPLOY_PATH"'",
        "cd '"$DEPLOY_PATH"'",

        "# Download package from S3",
        "aws s3 cp s3://'"$BUCKET_NAME"'/zklogin-wallet.tar.gz . --region '"$AWS_REGION"'",
        "tar -xzf zklogin-wallet.tar.gz",
        "rm zklogin-wallet.tar.gz",

        "# Install production dependencies",
        "npm ci --omit=dev",

        "# Stop existing process",
        "pm2 stop zklogin-wallet 2>/dev/null || true",
        "pm2 delete zklogin-wallet 2>/dev/null || true",

        "# Start with PM2",
        "PORT='"$WALLET_PORT"' pm2 start ecosystem.config.cjs",
        "pm2 save",

        "# Health check",
        "sleep 3",
        "curl -f http://localhost:'"$WALLET_PORT"'/ > /dev/null 2>&1 && echo \"Health check: OK\" || echo \"Health check: FAILED\"",

        "echo \"=== 배포 완료 ===\"",
        "pm2 status"
    ]' \
    --output json > /tmp/ssm-wallet-command.json

COMMAND_ID=$(cat /tmp/ssm-wallet-command.json | python3 -c "import sys, json; print(json.load(sys.stdin)['Command']['CommandId'])")
echo -e "${YELLOW}⏳ 명령 실행 대기 중... (Command ID: $COMMAND_ID)${NC}"

# Wait for command completion
sleep 15

# 6. Check command result
echo ""
echo -e "${BLUE}📋 배포 결과 확인 중...${NC}"
aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$AWS_REGION" \
    --query 'StandardOutputContent' \
    --output text 2>/dev/null || echo "결과 조회 중..."

# 7. Cleanup S3
echo ""
echo -e "${BLUE}🧹 임시 S3 버킷 정리 중...${NC}"
aws s3 rb "s3://$BUCKET_NAME" --force --region "$AWS_REGION" 2>/dev/null || true
rm -f /tmp/zklogin-wallet.tar.gz

echo ""
echo -e "${GREEN}✅ EC2 배포 완료!${NC}"
echo ""
echo "======================================"
echo "  배포 정보"
echo "======================================"
echo ""
echo "EC2 인스턴스: $INSTANCE_ID"
echo "배포 경로: $DEPLOY_PATH"
echo "포트: $WALLET_PORT"
echo ""
echo "======================================"
echo "  접속 방법"
echo "======================================"
echo ""
echo "1. EC2 Public IP로 접속:"
echo "   http://<EC2-PUBLIC-IP>:$WALLET_PORT"
echo ""
echo "2. ALB 설정 시:"
echo "   - Target Group에 포트 $WALLET_PORT 추가"
echo "   - Health Check: /"
echo ""
echo "======================================"
echo "  서비스 관리"
echo "======================================"
echo ""
echo "EC2 접속:"
echo "  aws ssm start-session --target $INSTANCE_ID --region $AWS_REGION"
echo ""
echo "PM2 명령어:"
echo "  pm2 status"
echo "  pm2 logs zklogin-wallet"
echo "  pm2 restart zklogin-wallet"
echo ""
