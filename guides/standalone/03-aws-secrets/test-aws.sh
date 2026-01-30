#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$PROJECT_ROOT"

source guides/shared/test-utils.sh
trap handle_error ERR

echo "======================================"
echo "  03-aws-secrets: 실제 AWS 테스트"
echo "======================================"
echo ""

# .env 로드 (TEST_JWT 등)
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
    echo -e "${GREEN}✅ .env 파일 로드 완료${NC}"
elif [ -f "$SCRIPT_DIR/.env.example" ]; then
    echo -e "${YELLOW}ℹ️  .env 파일이 없습니다. .env.example을 복사하세요:${NC}"
    echo -e "${YELLOW}   cp .env.example .env${NC}"
fi
echo ""

# config-aws.yaml 확인
if [ ! -f "$SCRIPT_DIR/config-aws.yaml" ]; then
    echo -e "${RED}❌ config-aws.yaml 파일이 없습니다${NC}"
    echo ""
    echo "먼저 setup-aws.sh를 실행하세요:"
    echo "  ./setup-aws.sh"
    exit 1
fi

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

# config에서 region과 secret name 추출
SECRET_NAME=$(grep "secretName:" "$SCRIPT_DIR/config-aws.yaml" | awk '{print $2}')
AWS_REGION=$(grep "region:" "$SCRIPT_DIR/config-aws.yaml" | awk '{print $2}')

echo -e "${BLUE}📋 설정 정보:${NC}"
echo "  Region: $AWS_REGION"
echo "  Secret Name: $SECRET_NAME"
echo ""

# Secret 존재 확인
echo -e "${BLUE}🔍 Secret 확인 중...${NC}"
if ! aws secretsmanager describe-secret \
    --secret-id "$SECRET_NAME" \
    --region "$AWS_REGION" > /dev/null 2>&1; then
    echo -e "${RED}❌ Secret이 존재하지 않습니다: $SECRET_NAME${NC}"
    echo ""
    echo "먼저 setup-aws.sh를 실행하세요:"
    echo "  ./setup-aws.sh"
    exit 1
fi

echo -e "${GREEN}✅ Secret 확인 완료${NC}"
echo ""

# AWS_ENDPOINT_URL이 설정되어 있으면 제거 (실제 AWS 사용)
unset AWS_ENDPOINT_URL

# 서버 시작
start_server "$SCRIPT_DIR/config-aws.yaml"

# Health check
wait_for_healthy

# Ready check
test_ready_endpoint

# Salt API 테스트 (TEST_JWT가 있으면)
test_salt_api

# 성공
print_success

# 추가 정보
echo -e "${BLUE}💰 비용 안내:${NC}"
echo "  • Secret 저장: \$0.40/월"
echo "  • API 호출: \$0.05 per 10,000 requests"
echo "  • 예상 월 비용: ~\$0.50"
echo ""

echo -e "${BLUE}🔒 보안 권장사항:${NC}"
echo "  • IAM 정책으로 접근 제한"
echo "  • CloudTrail로 감사 로그 활성화"
echo "  • VPC Endpoint 사용 (프라이빗 네트워크)"
echo "  • Secret 로테이션 설정"
echo ""

# 정리
cleanup
