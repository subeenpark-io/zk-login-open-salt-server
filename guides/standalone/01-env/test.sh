#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$PROJECT_ROOT"

# 공통 유틸리티 로드
source guides/shared/test-utils.sh

# 에러 핸들러 설정
trap handle_error ERR

echo "======================================"
echo "  01-env: 환경변수 방식 테스트"
echo "======================================"
echo ""

# 1. .env 확인
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${YELLOW}⚠️  .env 파일이 없습니다. .env.example을 복사합니다.${NC}"
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    echo -e "${GREEN}✅ .env 파일 생성 완료${NC}"
    echo ""
fi

# 2. .env 로드
set -a  # 자동으로 export
source "$SCRIPT_DIR/.env"
set +a

# 3. 서버 시작
start_server "$SCRIPT_DIR/config.yaml"

# 4. Health check
wait_for_healthy

# 5. Ready check
test_ready_endpoint

# 6. Salt API 테스트 (TEST_JWT가 있으면)
test_salt_api

# 7. 성공
print_success

# 8. 정리
cleanup
