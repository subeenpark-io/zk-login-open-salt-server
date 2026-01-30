#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$PROJECT_ROOT"

source guides/shared/test-utils.sh
trap handle_error ERR

echo "======================================"
echo "  03-aws-secrets: AWS Secrets Manager"
echo "======================================"
echo ""

# 1. .env 로드 (TEST_JWT 등)
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
    echo -e "${GREEN}✅ .env 파일 로드 완료${NC}"
elif [ -f "$SCRIPT_DIR/.env.example" ]; then
    echo -e "${YELLOW}ℹ️  .env 파일이 없습니다. .env.example을 복사하세요:${NC}"
    echo -e "${YELLOW}   cp .env.example .env${NC}"
fi
echo ""

# 2. LocalStack 설정
"$SCRIPT_DIR/setup-localstack.sh"
echo ""

# 3. AWS 환경변수 설정
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_ENDPOINT_URL=http://localhost:4566

echo -e "${BLUE}🔧 AWS 환경변수 설정 완료${NC}"
echo "  AWS_ENDPOINT_URL: $AWS_ENDPOINT_URL"
echo "  AWS_REGION: us-east-1"
echo ""

# 4. 서버 시작
start_server "$SCRIPT_DIR/config.yaml"

# 5. Health check
wait_for_healthy

# 6. Ready check
test_ready_endpoint

# 7. Salt API 테스트 (TEST_JWT가 있으면)
test_salt_api

# 8. 성공
print_success

# 9. 정리
cleanup
echo -e "${YELLOW}🧹 LocalStack 정리 중...${NC}"
cd "$SCRIPT_DIR"
docker-compose down -v
echo -e "${GREEN}✅ 정리 완료${NC}"
