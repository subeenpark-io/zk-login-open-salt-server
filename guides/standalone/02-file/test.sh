#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$PROJECT_ROOT"

source guides/shared/test-utils.sh
trap handle_error ERR

echo "======================================"
echo "  02-file: 파일 방식 테스트"
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

# 2. seed.json 생성
echo -e "${BLUE}📁 seed.json 생성 중...${NC}"
if [ ! -f "$SCRIPT_DIR/seed.json" ]; then
    cp "$SCRIPT_DIR/seed.json.example" "$SCRIPT_DIR/seed.json"
    echo -e "${GREEN}✅ seed.json 생성 완료${NC}"
else
    echo -e "${YELLOW}ℹ️  기존 seed.json 사용${NC}"
fi
echo ""

# 3. 파일 권한 설정
chmod 600 "$SCRIPT_DIR/seed.json"
echo -e "${GREEN}🔒 파일 권한 설정 완료 (600)${NC}"
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
rm -f "$SCRIPT_DIR/seed.json"
echo -e "${GREEN}🧹 seed.json 삭제 완료${NC}"
