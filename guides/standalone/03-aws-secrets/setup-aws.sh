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
echo "  실제 AWS Secrets Manager 설정"
echo "======================================"
echo ""

# 기본 설정
DEFAULT_REGION="us-west-2"
DEFAULT_SECRET_NAME="zklogin/test-seed"

# 사용자 입력
read -p "AWS Region (기본: $DEFAULT_REGION): " AWS_REGION
AWS_REGION=${AWS_REGION:-$DEFAULT_REGION}

read -p "Secret Name (기본: $DEFAULT_SECRET_NAME): " SECRET_NAME
SECRET_NAME=${SECRET_NAME:-$DEFAULT_SECRET_NAME}

echo ""
echo -e "${BLUE}설정 정보:${NC}"
echo "  Region: $AWS_REGION"
echo "  Secret Name: $SECRET_NAME"
echo ""

# AWS 자격 증명 확인
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

# 기존 시크릿 확인
echo -e "${BLUE}🔍 기존 시크릿 확인 중...${NC}"
if aws secretsmanager describe-secret \
    --secret-id "$SECRET_NAME" \
    --region "$AWS_REGION" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  시크릿이 이미 존재합니다: $SECRET_NAME${NC}"
    read -p "덮어쓰시겠습니까? (y/N): " OVERWRITE

    if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
        echo "취소되었습니다."
        exit 0
    fi

    echo -e "${YELLOW}기존 시크릿을 삭제합니다...${NC}"
    aws secretsmanager delete-secret \
        --secret-id "$SECRET_NAME" \
        --force-delete-without-recovery \
        --region "$AWS_REGION" > /dev/null 2>&1 || true

    echo -e "${GREEN}✅ 기존 시크릿 삭제 완료${NC}"
fi
echo ""

# 시드 생성
echo -e "${BLUE}🔑 Master Seed 생성 중...${NC}"
cd "$PROJECT_ROOT"
SEED=$(npm run generate-seed --silent 2>&1 | grep "^0x")

if [[ ! "$SEED" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
    echo -e "${RED}❌ 시드 생성 실패${NC}"
    echo "Seed: $SEED"
    exit 1
fi

echo "  Seed: ${SEED:0:20}...${SEED: -20}"
echo ""

# Secrets Manager에 업로드
echo -e "${BLUE}📤 Secrets Manager에 업로드 중...${NC}"
SECRET_ARN=$(aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --secret-string "{\"masterSeed\": \"$SEED\"}" \
    --description "zkLogin Salt Server master seed (created by setup-aws.sh)" \
    --region "$AWS_REGION" \
    --query 'ARN' \
    --output text)

echo -e "${GREEN}✅ 시드가 Secrets Manager에 저장되었습니다${NC}"
echo "  ARN: $SECRET_ARN"
echo ""

# 태그 추가
echo -e "${BLUE}🏷️  태그 추가 중...${NC}"
aws secretsmanager tag-resource \
    --secret-id "$SECRET_NAME" \
    --tags \
        Key=Environment,Value=development \
        Key=Application,Value=zklogin \
        Key=ManagedBy,Value=setup-script \
    --region "$AWS_REGION" > /dev/null 2>&1

echo -e "${GREEN}✅ 태그 추가 완료${NC}"
echo ""

# 검증
echo -e "${BLUE}🔍 시드 검증 중...${NC}"
STORED_SEED=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_NAME" \
    --region "$AWS_REGION" \
    --query SecretString \
    --output text | jq -r .masterSeed)

if [ "$SEED" == "$STORED_SEED" ]; then
    echo -e "${GREEN}✅ 시드 검증 완료${NC}"
else
    echo -e "${RED}❌ 시드 검증 실패${NC}"
    echo "Original: $SEED"
    echo "Stored: $STORED_SEED"
    exit 1
fi
echo ""

# config-aws.yaml 생성
echo -e "${BLUE}📝 config-aws.yaml 생성 중...${NC}"
cat > "$SCRIPT_DIR/config-aws.yaml" <<EOF
server:
  port: 3000

logging:
  level: info
  format: json

security:
  corsOrigins: "*"  # 프로덕션에서는 특정 도메인으로 변경
  rateLimitMax: 100

provider:
  type: local
  seed:
    type: aws
    secretName: $SECRET_NAME
    region: $AWS_REGION
    secretKey: masterSeed
EOF

echo -e "${GREEN}✅ config-aws.yaml 생성 완료${NC}"
echo ""

# 요약
echo "======================================"
echo -e "${GREEN}✅ AWS Secrets Manager 설정 완료!${NC}"
echo "======================================"
echo ""
echo -e "${BLUE}📋 설정 정보:${NC}"
echo "  Region: $AWS_REGION"
echo "  Secret Name: $SECRET_NAME"
echo "  Secret ARN: $SECRET_ARN"
echo ""
echo -e "${BLUE}💡 다음 단계:${NC}"
echo "  1. 테스트 실행: ./test-aws.sh"
echo "  2. 프로덕션 배포: config-aws.yaml 사용"
echo ""
echo -e "${YELLOW}⚠️  주의사항:${NC}"
echo "  • config-aws.yaml을 Git에 커밋하지 마세요"
echo "  • 프로덕션에서는 corsOrigins를 특정 도메인으로 변경"
echo "  • IAM 정책으로 접근 권한 제한"
echo ""
