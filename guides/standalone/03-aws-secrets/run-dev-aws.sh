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
echo "  실제 AWS Secrets Manager 개발 서버"
echo "======================================"
echo ""

# 1. AWS 자격 증명 확인
echo -e "${BLUE}🔍 AWS 자격 증명 확인 중...${NC}"
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS 자격 증명 실패${NC}"
    echo ""
    echo "다음 중 하나를 실행하세요:"
    echo "  1. aws configure"
    echo "  2. export AWS_ACCESS_KEY_ID=..."
    echo "     export AWS_SECRET_ACCESS_KEY=..."
    exit 1
fi

CALLER_IDENTITY=$(aws sts get-caller-identity)
ACCOUNT_ID=$(echo "$CALLER_IDENTITY" | jq -r .Account)
USER_ARN=$(echo "$CALLER_IDENTITY" | jq -r .Arn)

echo -e "${GREEN}✅ 인증 성공${NC}"
echo "  Account ID: $ACCOUNT_ID"
echo "  User/Role: $USER_ARN"
echo ""

# 2. Secret 확인
SECRET_NAME="zklogin/prod-seed"
AWS_REGION="ap-northeast-2"

echo -e "${BLUE}🔍 Secret 확인 중...${NC}"
echo "  Secret Name: $SECRET_NAME"
echo "  Region: $AWS_REGION"

if ! aws secretsmanager describe-secret \
    --secret-id "$SECRET_NAME" \
    --region "$AWS_REGION" > /dev/null 2>&1; then
    echo -e "${RED}❌ Secret이 존재하지 않습니다: $SECRET_NAME${NC}"
    echo ""
    echo "먼저 다음 명령어로 Secret을 생성하세요:"
    echo ""
    echo "  npm run generate-seed  # Seed 생성"
    echo ""
    echo "  aws secretsmanager create-secret \\"
    echo "    --name zklogin/prod-seed \\"
    echo "    --description 'zkLogin Salt Server Production Master Seed' \\"
    echo "    --secret-string '{\"masterSeed\":\"YOUR_SEED_HERE\"}' \\"
    echo "    --region ap-northeast-2"
    exit 1
fi

echo -e "${GREEN}✅ Secret 확인 완료${NC}"
echo ""

# 3. 설정 파일 생성 (실제 AWS 사용)
CONFIG_FILE="$SCRIPT_DIR/config-aws-runtime.yaml"
echo -e "${BLUE}📝 설정 파일 생성 중...${NC}"

cat > "$CONFIG_FILE" << EOF
server:
  port: 3000
  host: 0.0.0.0

logging:
  level: debug
  format: pretty

security:
  corsOrigins: "*"
  rateLimitMax: 1000
  rateLimitWindowMs: 60000

provider:
  type: local
  seed:
    type: aws
    secretName: $SECRET_NAME
    region: $AWS_REGION
    secretKey: masterSeed
EOF

echo -e "${GREEN}✅ 설정 파일 생성 완료${NC}"
echo ""

# 4. 서버 시작
echo -e "${YELLOW}🚀 Salt Server 시작 중...${NC}"
echo ""
cd "$PROJECT_ROOT"
export CONFIG_FILE="$CONFIG_FILE"

echo -e "${GREEN}✅ 서버가 실행 중입니다!${NC}"
echo ""
echo "======================================"
echo "  테스트 방법"
echo "======================================"
echo ""
echo "1. 새 터미널을 열고 다음 명령어로 테스트:"
echo ""
echo "   # Health check"
echo "   curl http://localhost:3000/health"
echo ""
echo "   # Ready check"
echo "   curl http://localhost:3000/ready"
echo ""
echo "   # Salt API 테스트"
echo "   curl -X POST http://localhost:3000/v1/salt \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"jwt\": \"YOUR_JWT_HERE\"}'"
echo ""
echo "2. Salt 값 확인:"
echo "   - 동일한 JWT로 요청하면 항상 같은 salt 반환 (결정론적)"
echo "   - 다른 sub/aud를 가진 JWT는 다른 salt 반환"
echo ""
echo "======================================"
echo -e "${YELLOW}서버를 종료하려면 Ctrl+C를 누르세요${NC}"
echo "======================================"
echo ""
echo "Secret 정보:"
echo "  Name: $SECRET_NAME"
echo "  Region: $AWS_REGION"
echo "  ARN: arn:aws:secretsmanager:$AWS_REGION:$ACCOUNT_ID:secret:$SECRET_NAME"
echo ""

# 서버 실행 (포그라운드)
npm start
