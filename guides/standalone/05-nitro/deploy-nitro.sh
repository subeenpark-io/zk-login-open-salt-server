#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DEFAULT_TERRAFORM_DIR="$PROJECT_ROOT/deploy/aws-nitro/terraform"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTANCE_ID="${INSTANCE_ID:-}"
KMS_KEY_ARN="${KMS_KEY_ARN:-}"
ALB_URL="${ALB_URL:-}"
AWS_REGION="${AWS_REGION:-us-west-2}"
TERRAFORM_DIR="${TERRAFORM_DIR:-$DEFAULT_TERRAFORM_DIR}"
EIF_PATH="${EIF_PATH:-$PROJECT_ROOT/enclave/zklogin-enclave.eif}"
SEED_HEX="${SEED_HEX:-}"

NITRO_ENCLAVE_CID="${NITRO_ENCLAVE_CID:-16}"
NITRO_VSOCK_PORT="${NITRO_VSOCK_PORT:-5000}"
NITRO_VSOCK_TIMEOUT="${NITRO_VSOCK_TIMEOUT:-5000}"
NITRO_BOOTSTRAP_RETRIES="${NITRO_BOOTSTRAP_RETRIES:-8}"
NITRO_BOOTSTRAP_RETRY_DELAY_MS="${NITRO_BOOTSTRAP_RETRY_DELAY_MS:-3000}"

BUILD_APP="true"
BUILD_EIF="false"

TMP_DIR=""
BUCKET_NAME=""
ENCRYPTED_SEED=""

print_usage() {
  cat <<'EOF'
Usage: ./deploy-nitro.sh [options]

Options:
  --instance-id <id>         EC2 instance ID (omit to resolve from Terraform output)
  --kms-key-arn <arn>        KMS key ARN (omit to resolve from Terraform output)
  --alb-url <url>            ALB/Salt server URL for output display
  --region <region>          AWS region (default: us-west-2)
  --terraform-dir <path>     Terraform directory for output resolution
  --eif-path <path>          EIF file path (default: enclave/zklogin-enclave.eif)
  --seed-hex <hex>           Master seed hex (0x + 64 hex chars). If omitted, generated automatically
  --build-eif                Build EIF locally with enclave/build-eif.sh
  --skip-app-build           Skip npm run build for the main app
  -h, --help                 Show help

Environment alternatives:
  INSTANCE_ID, KMS_KEY_ARN, ALB_URL, AWS_REGION, TERRAFORM_DIR, EIF_PATH, SEED_HEX
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo -e "${RED}❌ Required command not found: $1${NC}"
    exit 1
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

  if [ -z "$KMS_KEY_ARN" ]; then
    KMS_KEY_ARN=$(terraform -chdir="$TERRAFORM_DIR" output -raw kms_key_arn 2>/dev/null || true)
  fi

  if [ -z "$ALB_URL" ]; then
    ALB_URL=$(terraform -chdir="$TERRAFORM_DIR" output -raw salt_server_url 2>/dev/null || true)
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --instance-id)
      INSTANCE_ID="$2"
      shift 2
      ;;
    --kms-key-arn)
      KMS_KEY_ARN="$2"
      shift 2
      ;;
    --alb-url)
      ALB_URL="$2"
      shift 2
      ;;
    --region)
      AWS_REGION="$2"
      shift 2
      ;;
    --terraform-dir)
      TERRAFORM_DIR="$2"
      shift 2
      ;;
    --eif-path)
      EIF_PATH="$2"
      shift 2
      ;;
    --seed-hex)
      SEED_HEX="$2"
      shift 2
      ;;
    --build-eif)
      BUILD_EIF="true"
      shift
      ;;
    --skip-app-build)
      BUILD_APP="false"
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
echo "  Nitro 배포 (앱 + EIF + Seed Bootstrap)"
echo "======================================"
echo ""

require_cmd aws
require_cmd jq
require_cmd npm
require_cmd tar
require_cmd xxd

resolve_from_terraform

if [ -z "$INSTANCE_ID" ]; then
  echo -e "${RED}❌ EC2 instance ID is required${NC}"
  echo "Use --instance-id or provide terraform outputs"
  exit 1
fi

if [ -z "$KMS_KEY_ARN" ]; then
  echo -e "${RED}❌ KMS key ARN is required${NC}"
  echo "Use --kms-key-arn or provide terraform outputs"
  exit 1
fi

echo -e "${BLUE}🔍 AWS 인증 확인 중...${NC}"
CALLER_IDENTITY=$(aws sts get-caller-identity --region "$AWS_REGION")
ACCOUNT_ID=$(echo "$CALLER_IDENTITY" | jq -r .Account)
echo -e "${GREEN}✅ 인증 성공 (Account: $ACCOUNT_ID)${NC}"
echo ""

INSTANCE_STATE=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'Reservations[0].Instances[0].State.Name' \
  --output text)

if [ "$INSTANCE_STATE" != "running" ]; then
  echo -e "${RED}❌ EC2 인스턴스 상태가 running이 아닙니다: $INSTANCE_STATE${NC}"
  exit 1
fi

echo -e "${GREEN}✅ EC2 인스턴스 확인 완료: $INSTANCE_ID${NC}"
echo ""

TMP_DIR=$(mktemp -d)
APP_ARCHIVE="$TMP_DIR/zklogin-app.tar.gz"
EIF_ARTIFACT="$TMP_DIR/zklogin-enclave.eif"
SEED_BIN="$TMP_DIR/master-seed.bin"
SSM_COMMAND_FILE="$TMP_DIR/ssm-commands.txt"
SSM_PARAMS_FILE="$TMP_DIR/ssm-params.json"
SSM_RESULT_FILE="$TMP_DIR/ssm-result.json"

if [ "$BUILD_APP" = "true" ]; then
  echo -e "${BLUE}📦 메인 애플리케이션 빌드 중...${NC}"
  cd "$PROJECT_ROOT"
  npm run build
fi

echo -e "${BLUE}📦 앱 아티팩트 패키징 중...${NC}"
cd "$PROJECT_ROOT"
tar -czf "$APP_ARCHIVE" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='tmp' \
  --exclude='coverage' \
  package.json \
  package-lock.json \
  dist/

if [ "$BUILD_EIF" = "true" ]; then
  echo -e "${BLUE}🔨 EIF 빌드 중...${NC}"
  (
    cd "$PROJECT_ROOT/enclave"
    ./build-eif.sh "$EIF_ARTIFACT"
  )
else
  if [ ! -f "$EIF_PATH" ]; then
    echo -e "${RED}❌ EIF 파일을 찾을 수 없습니다: $EIF_PATH${NC}"
    echo "파일을 준비하거나 --build-eif 옵션을 사용하세요."
    exit 1
  fi
  cp "$EIF_PATH" "$EIF_ARTIFACT"
fi

if [ -z "$SEED_HEX" ]; then
  echo -e "${YELLOW}⚠️ SEED_HEX가 없어 새 master seed를 생성합니다.${NC}"
  SEED_HEX=$(npm run generate-seed --silent 2>&1 | grep -Eo '0x[0-9a-fA-F]{64}' | head -n1 || true)
  if [ -z "$SEED_HEX" ]; then
    echo -e "${RED}❌ seed 생성에 실패했습니다. --seed-hex를 지정하세요.${NC}"
    exit 1
  fi
  echo -e "${YELLOW}생성된 seed는 안전한 장소에 백업하세요:${NC}"
  echo "$SEED_HEX"
fi

if [[ ! "$SEED_HEX" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo -e "${RED}❌ 유효하지 않은 seed 형식입니다: $SEED_HEX${NC}"
  exit 1
fi

echo "${SEED_HEX#0x}" | xxd -r -p > "$SEED_BIN"

echo -e "${BLUE}🔐 KMS로 seed 암호화 중...${NC}"
ENCRYPTED_SEED=$(aws kms encrypt \
  --region "$AWS_REGION" \
  --key-id "$KMS_KEY_ARN" \
  --plaintext "fileb://$SEED_BIN" \
  --output text \
  --query CiphertextBlob)

if [ -z "$ENCRYPTED_SEED" ]; then
  echo -e "${RED}❌ ENCRYPTED_SEED 생성 실패${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ENCRYPTED_SEED 생성 완료${NC}"
echo ""

BUCKET_NAME="zklogin-nitro-deploy-${ACCOUNT_ID}-$(date +%s)-$RANDOM"
echo -e "${BLUE}📤 아티팩트 업로드 중... (s3://$BUCKET_NAME)${NC}"

aws s3 mb "s3://$BUCKET_NAME" --region "$AWS_REGION" >/dev/null
aws s3 cp "$APP_ARCHIVE" "s3://$BUCKET_NAME/zklogin-app.tar.gz" --region "$AWS_REGION" >/dev/null
aws s3 cp "$EIF_ARTIFACT" "s3://$BUCKET_NAME/zklogin-enclave.eif" --region "$AWS_REGION" >/dev/null

cat > "$SSM_COMMAND_FILE" <<EOF
set -euo pipefail
echo "=== Nitro deployment start ==="
sudo yum install -y nodejs npm
sudo mkdir -p /opt/zklogin /opt/zklogin/enclave /opt/zklogin/logs
sudo chown -R ec2-user:ec2-user /opt/zklogin
aws s3 cp s3://$BUCKET_NAME/zklogin-app.tar.gz /tmp/zklogin-app.tar.gz --region $AWS_REGION
tar -xzf /tmp/zklogin-app.tar.gz -C /opt/zklogin
cd /opt/zklogin
npm ci --omit=dev
aws s3 cp s3://$BUCKET_NAME/zklogin-enclave.eif /opt/zklogin/enclave/zklogin-enclave.eif --region $AWS_REGION
touch /opt/zklogin/.env
sed -i '/^SALT_PROVIDER_MODE=/d;/^SEED_SOURCE=/d;/^ENCRYPTED_SEED=/d;/^KMS_KEY_ID=/d;/^AWS_REGION=/d;/^NITRO_ENCLAVE_CID=/d;/^NITRO_VSOCK_PORT=/d;/^NITRO_VSOCK_TIMEOUT=/d;/^NITRO_BOOTSTRAP_RETRIES=/d;/^NITRO_BOOTSTRAP_RETRY_DELAY_MS=/d' /opt/zklogin/.env
cat <<'ENV_EOF' >> /opt/zklogin/.env
SALT_PROVIDER_MODE=local
SEED_SOURCE=nitro
ENCRYPTED_SEED=$ENCRYPTED_SEED
KMS_KEY_ID=$KMS_KEY_ARN
AWS_REGION=$AWS_REGION
NITRO_ENCLAVE_CID=$NITRO_ENCLAVE_CID
NITRO_VSOCK_PORT=$NITRO_VSOCK_PORT
NITRO_VSOCK_TIMEOUT=$NITRO_VSOCK_TIMEOUT
NITRO_BOOTSTRAP_RETRIES=$NITRO_BOOTSTRAP_RETRIES
NITRO_BOOTSTRAP_RETRY_DELAY_MS=$NITRO_BOOTSTRAP_RETRY_DELAY_MS
ENV_EOF
/opt/zklogin/manage-enclave.sh stop || true
/opt/zklogin/manage-enclave.sh start
set -a
source /opt/zklogin/.env
set +a
cd /opt/zklogin
node dist/tools/nitro-bootstrap.js
sudo systemctl enable --now zklogin-salt
sudo systemctl restart zklogin-salt
sleep 3
curl -sf http://localhost:3000/health
curl -sf http://localhost:3000/ready
echo "=== Nitro deployment complete ==="
EOF

jq -R -s '{
  commands: (split("\n") | map(select(length > 0)))
}' "$SSM_COMMAND_FILE" > "$SSM_PARAMS_FILE"

echo -e "${BLUE}🚀 SSM 배포 실행 중...${NC}"
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --region "$AWS_REGION" \
  --document-name "AWS-RunShellScript" \
  --parameters "file://$SSM_PARAMS_FILE" \
  --output json > "$SSM_RESULT_FILE"

COMMAND_ID=$(jq -r '.Command.CommandId' "$SSM_RESULT_FILE")
echo -e "${YELLOW}SSM Command ID: $COMMAND_ID${NC}"

STATUS="Pending"
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

echo -e "${BLUE}📋 배포 로그${NC}"
aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'StandardOutputContent' \
  --output text

if [ "$STATUS" != "Success" ]; then
  echo -e "${RED}❌ SSM 배포 실패: $STATUS${NC}"
  aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --region "$AWS_REGION" \
    --query 'StandardErrorContent' \
    --output text || true
  exit 1
fi

echo ""
echo -e "${GREEN}✅ Nitro 배포 완료${NC}"
echo ""
echo "Instance ID: $INSTANCE_ID"
echo "KMS Key ARN: $KMS_KEY_ARN"
if [ -n "$ALB_URL" ]; then
  echo "Salt URL: $ALB_URL"
  echo "Health: $ALB_URL/health"
  echo "Ready: $ALB_URL/ready"
fi
echo ""
echo "다음 점검:"
echo "  aws ssm start-session --target $INSTANCE_ID --region $AWS_REGION"
echo "  sudo /opt/zklogin/manage-enclave.sh status"
echo "  sudo systemctl status zklogin-salt"
