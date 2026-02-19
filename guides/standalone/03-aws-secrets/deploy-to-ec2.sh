#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DEFAULT_TERRAFORM_DIR="$PROJECT_ROOT/deploy/aws-nitro/terraform"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTANCE_ID="${INSTANCE_ID:-}"
AWS_REGION="${AWS_REGION:-us-west-2}"
SECRET_NAME="${SECRET_NAME:-zklogin/prod-seed}"
ALB_URL="${ALB_URL:-}"
TERRAFORM_DIR="${TERRAFORM_DIR:-$DEFAULT_TERRAFORM_DIR}"
SKIP_SECRET_CHECK="false"

TMP_DIR=""
PACKAGE_PATH=""
BUCKET_NAME=""

print_usage() {
    cat <<'EOF'
Usage: ./deploy-to-ec2.sh [options]

Options:
  --instance-id <id>      EC2 instance ID (if omitted, resolve from Terraform output)
  --region <region>       AWS region (default: us-west-2)
  --secret-name <name>    Secrets Manager secret name (default: zklogin/prod-seed)
  --alb-url <url>         ALB URL for output display (if omitted, resolve from Terraform output)
  --terraform-dir <path>  Terraform directory for output resolution
  --skip-secret-check     Skip Secrets Manager existence check
  -h, --help              Show this help

Environment alternatives:
  INSTANCE_ID, AWS_REGION, SECRET_NAME, ALB_URL, TERRAFORM_DIR
EOF
}

require_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo -e "${RED}❌ Required command not found: $1${NC}"
        exit 1
    fi
}

resolve_from_terraform() {
    if [ ! -d "$TERRAFORM_DIR" ]; then
        return
    fi

    if ! command -v terraform >/dev/null 2>&1; then
        return
    fi

    if [ -z "$INSTANCE_ID" ]; then
        INSTANCE_ID=$(terraform -chdir="$TERRAFORM_DIR" output -raw ec2_instance_id 2>/dev/null || true)
    fi

    if [ -z "$ALB_URL" ]; then
        ALB_URL=$(terraform -chdir="$TERRAFORM_DIR" output -raw salt_server_url 2>/dev/null || true)
    fi
}

cleanup() {
    if [ -n "$BUCKET_NAME" ]; then
        aws s3 rb "s3://$BUCKET_NAME" --force --region "$AWS_REGION" >/dev/null 2>&1 || true
    fi

    if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
        rm -rf "$TMP_DIR"
    fi
}
trap cleanup EXIT

while [ "$#" -gt 0 ]; do
    case "$1" in
        --instance-id)
            INSTANCE_ID="$2"
            shift 2
            ;;
        --region)
            AWS_REGION="$2"
            shift 2
            ;;
        --secret-name)
            SECRET_NAME="$2"
            shift 2
            ;;
        --alb-url)
            ALB_URL="$2"
            shift 2
            ;;
        --terraform-dir)
            TERRAFORM_DIR="$2"
            shift 2
            ;;
        --skip-secret-check)
            SKIP_SECRET_CHECK="true"
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Unknown argument: $1${NC}"
            print_usage
            exit 1
            ;;
    esac
done

echo "======================================"
echo "  EC2 인스턴스에 Salt Server 배포"
echo "======================================"
echo ""

require_cmd aws
require_cmd jq
require_cmd npm
require_cmd tar

resolve_from_terraform

if [ -z "$INSTANCE_ID" ]; then
    echo -e "${RED}❌ EC2 인스턴스 ID를 찾을 수 없습니다.${NC}"
    echo "다음 중 하나로 지정하세요:"
    echo "  1) --instance-id i-xxxxxxxx"
    echo "  2) INSTANCE_ID 환경변수"
    echo "  3) --terraform-dir 경로에서 terraform output 사용"
    exit 1
fi

echo -e "${BLUE}🔍 AWS 자격 증명 확인 중...${NC}"
CALLER_IDENTITY=$(aws sts get-caller-identity --region "$AWS_REGION")
ACCOUNT_ID=$(echo "$CALLER_IDENTITY" | jq -r .Account)
echo -e "${GREEN}✅ 인증 성공 (Account: $ACCOUNT_ID)${NC}"
echo ""

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

if [ "$SKIP_SECRET_CHECK" != "true" ]; then
    echo -e "${BLUE}🔍 Secrets Manager 확인 중...${NC}"
    if ! aws secretsmanager describe-secret \
        --secret-id "$SECRET_NAME" \
        --region "$AWS_REGION" >/dev/null 2>&1; then
        echo -e "${RED}❌ Secret이 존재하지 않습니다: $SECRET_NAME${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Secret 확인 완료${NC}"
    echo ""
fi

# 2. 로컬 코드 빌드 및 패키징
echo -e "${BLUE}📦 로컬 코드 빌드 및 패키징 중...${NC}"
cd "$PROJECT_ROOT"
npm run build

TMP_DIR=$(mktemp -d)
PACKAGE_PATH="$TMP_DIR/salt-server.tar.gz"

tar -czf "$PACKAGE_PATH" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='tmp' \
    --exclude='coverage' \
    package.json \
    package-lock.json \
    dist/

echo -e "${GREEN}✅ 패키지 생성 완료: $PACKAGE_PATH${NC}"
echo ""

# 3. EC2로 파일 전송
echo -e "${BLUE}📤 EC2로 파일 전송 중...${NC}"
BUCKET_NAME="zklogin-deploy-temp-${ACCOUNT_ID}-$(date +%s)-$RANDOM"

aws s3 mb "s3://$BUCKET_NAME" --region "$AWS_REGION" >/dev/null
aws s3 cp "$PACKAGE_PATH" "s3://$BUCKET_NAME/salt-server.tar.gz" --region "$AWS_REGION" >/dev/null

echo -e "${GREEN}✅ S3 업로드 완료 (bucket: $BUCKET_NAME)${NC}"
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
    --output json > "$TMP_DIR/ssm-command.json"

COMMAND_ID=$(jq -r '.Command.CommandId' "$TMP_DIR/ssm-command.json")

echo -e "${YELLOW}⏳ 명령 실행 대기 중... (Command ID: $COMMAND_ID)${NC}"
echo ""

while true; do
    STATUS=$(aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --region "$AWS_REGION" \
        --query 'Status' \
        --output text 2>/dev/null || echo "Pending")

    case "$STATUS" in
        Pending|InProgress|Delayed)
            sleep 5
            ;;
        *)
            break
            ;;
    esac
done

# 5. 명령 결과 확인
echo -e "${BLUE}📋 배포 결과 확인 중...${NC}"
aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$AWS_REGION" \
    --query 'StandardOutputContent' \
    --output text

if [ "$STATUS" != "Success" ]; then
    echo -e "${RED}❌ SSM 명령 실패 상태: $STATUS${NC}"
    aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --region "$AWS_REGION" \
        --query 'StandardErrorContent' \
        --output text || true
    exit 1
fi

echo ""
echo -e "${GREEN}✅ EC2 배포 완료!${NC}"
echo ""
echo "======================================"
echo "  배포 정보"
echo "======================================"
echo ""
echo "EC2 인스턴스: $INSTANCE_ID"
if [ -n "$ALB_URL" ]; then
    echo "외부 접근 URL: $ALB_URL"
    echo "Health Check: $ALB_URL/health"
    echo "Ready Check: $ALB_URL/ready"
else
    echo "외부 접근 URL: (미설정 - --alb-url 또는 Terraform output 사용)"
fi
echo ""
echo "======================================"
echo "  테스트 방법"
echo "======================================"
echo ""
if [ -n "$ALB_URL" ]; then
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
fi
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
