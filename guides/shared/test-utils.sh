#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 서버 시작 및 대기
start_server() {
    local config_file=$1
    export CONFIG_FILE="$config_file"

    echo -e "${YELLOW}🚀 서버 시작 중...${NC}"
    npm run dev > /tmp/salt-server.log 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > /tmp/salt-server.pid

    echo -e "${YELLOW}⏳ 서버 준비 대기 중...${NC}"
    sleep 5
}

# Health check
wait_for_healthy() {
    local max_attempts=10
    local attempt=1

    echo -e "${BLUE}🔍 Health check 중...${NC}"

    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ 서버가 정상 작동 중입니다${NC}"
            return 0
        fi
        echo "  시도 $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo -e "${RED}❌ 서버 시작 실패${NC}"
    cat /tmp/salt-server.log
    return 1
}

# Ready check
test_ready_endpoint() {
    echo -e "${BLUE}🔍 Ready 엔드포인트 확인 중...${NC}"

    local response=$(curl -s http://localhost:3000/ready)
    local status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "error")

    if [ "$status" = "ok" ]; then
        echo -e "${GREEN}✅ Ready check 통과${NC}"
        echo "$response" | jq . 2>/dev/null || echo "$response"
        return 0
    else
        echo -e "${YELLOW}⚠️  Provider가 정상 상태가 아닙니다${NC}"
        echo "$response" | jq . 2>/dev/null || echo "$response"
        return 1
    fi
}

# Salt API 테스트 (JWT 있을 경우만)
test_salt_api() {
    # TEST_JWT 환경변수 확인
    if [ -z "$TEST_JWT" ]; then
        echo -e "${YELLOW}ℹ️  TEST_JWT 환경변수가 설정되지 않았습니다${NC}"
        echo -e "${YELLOW}   Salt API 테스트를 건너뜁니다${NC}"
        echo ""
        echo -e "${BLUE}💡 Salt API를 테스트하려면:${NC}"
        echo "   1. Google OAuth Playground에서 JWT 발급"
        echo "      https://developers.google.com/oauthplayground/"
        echo "   2. export TEST_JWT=\"your-jwt-here\""
        echo "   3. 테스트 재실행"
        return 0
    fi

    echo -e "${BLUE}🧪 Salt API 테스트 중...${NC}"

    # API 호출
    local response=$(curl -s -X POST http://localhost:3000/v1/salt \
        -H "Content-Type: application/json" \
        -d "{\"jwt\": \"$TEST_JWT\"}")

    # 응답 검증
    if echo "$response" | grep -q '"salt"'; then
        local salt=$(echo "$response" | jq -r '.salt' 2>/dev/null)
        echo -e "${GREEN}✅ Salt 생성 성공${NC}"
        echo "   Salt: ${salt:0:20}...${salt: -20}"

        # Salt 형식 검증 (0x + 64 hex characters)
        if [[ $salt =~ ^0x[0-9a-fA-F]{64}$ ]]; then
            echo -e "${GREEN}✅ Salt 형식이 올바릅니다 (0x + 64 hex chars)${NC}"
        else
            echo -e "${RED}❌ Salt 형식이 잘못되었습니다${NC}"
            return 1
        fi

        return 0
    else
        echo -e "${RED}❌ Salt API 호출 실패${NC}"
        echo "   Response: $response"
        return 1
    fi
}

# 정리
cleanup() {
    echo -e "${YELLOW}🧹 정리 중...${NC}"
    if [ -f /tmp/salt-server.pid ]; then
        local pid=$(cat /tmp/salt-server.pid)
        if kill -0 $pid 2>/dev/null; then
            kill $pid 2>/dev/null || true
        fi
        rm -f /tmp/salt-server.pid
    fi
    rm -f /tmp/salt-server.log
}

# 에러 핸들러
handle_error() {
    echo ""
    echo -e "${RED}❌ 테스트 실패!${NC}"
    if [ -f /tmp/salt-server.log ]; then
        echo -e "${YELLOW}📋 서버 로그 (마지막 20줄):${NC}"
        tail -20 /tmp/salt-server.log
    fi
    cleanup
    exit 1
}

# 성공 메시지
print_success() {
    echo ""
    echo "======================================"
    echo -e "${GREEN}✅ 모든 테스트 통과!${NC}"
    echo "======================================"
    echo ""
    echo -e "${BLUE}💡 다음 단계:${NC}"
    echo "   • 프로덕션 배포: README.md 참조"
    echo "   • Hybrid 모드 테스트"
    echo "   • SDK 통합 (Express/Fastify)"
}
