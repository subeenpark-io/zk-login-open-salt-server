#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "======================================"
echo "  Hybrid 모드: Primary + Fallback"
echo "======================================"
echo ""

# 1. Master Seed 확인
echo -e "${BLUE}🔍 Master Seed 확인 중...${NC}"

if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
    echo -e "${GREEN}✅ .env 파일 로드 완료${NC}"
else
    echo -e "${YELLOW}⚠️  .env 파일이 없습니다${NC}"
    echo ""
    echo "Master Seed를 생성하고 .env 파일에 저장하세요:"
    echo ""
    echo "  # 1. Seed 생성"
    echo "  npm run generate-seed"
    echo ""
    echo "  # 2. .env 파일 생성"
    echo "  echo 'MASTER_SEED=YOUR_SEED_HERE' > $SCRIPT_DIR/.env"
    echo ""
    exit 1
fi

if [ -z "$MASTER_SEED" ]; then
    echo -e "${RED}❌ MASTER_SEED 환경변수가 설정되지 않았습니다${NC}"
    echo ""
    echo ".env 파일을 확인하세요:"
    echo "  cat $SCRIPT_DIR/.env"
    exit 1
fi

# Seed 형식 검증 (0x + 64 hex characters)
if [[ ! $MASTER_SEED =~ ^0x[0-9a-fA-F]{64}$ ]]; then
    echo -e "${RED}❌ MASTER_SEED 형식이 올바르지 않습니다${NC}"
    echo ""
    echo "올바른 형식: 0x + 64 hex characters"
    echo "현재 값: ${MASTER_SEED:0:20}..."
    exit 1
fi

echo -e "${GREEN}✅ Master Seed 확인 완료${NC}"
echo "  Seed: ${MASTER_SEED:0:20}...${MASTER_SEED: -20}"
echo ""

# 2. Mysten Labs 연결 확인
echo -e "${BLUE}🔍 Fallback (Mysten Labs) 연결 확인 중...${NC}"
if curl -s --max-time 5 https://salt.api.mystenlabs.com/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Mysten Labs 연결 성공${NC}"
else
    echo -e "${YELLOW}⚠️  Mysten Labs 연결 실패 (health check)${NC}"
    echo -e "${YELLOW}   Fallback이 동작하지 않을 수 있습니다${NC}"
fi
echo ""

# 3. 서버 시작
echo -e "${YELLOW}🚀 Salt Server 시작 중...${NC}"
echo ""
cd "$PROJECT_ROOT"
export CONFIG_FILE="$SCRIPT_DIR/config.yaml"
export MASTER_SEED="$MASTER_SEED"

echo -e "${GREEN}✅ 서버가 실행 중입니다!${NC}"
echo ""
echo "======================================"
echo "  동작 방식"
echo "======================================"
echo ""
echo "1. 정상 상태:"
echo "   ➡️  Primary (자체 seed) 사용"
echo "   ⚡ 빠른 응답 (~50ms)"
echo ""
echo "2. Primary 실패 시:"
echo "   ❌ Primary 실패"
echo "   ➡️  Fallback (Mysten Labs) 자동 전환"
echo "   📡 외부 API 호출 (~200ms)"
echo ""
echo "3. Fallback 사용 중:"
echo "   ⏳ 60초 동안 Fallback 사용"
echo "   🔄 60초 후 Primary 재시도"
echo ""
echo "======================================"
echo "  테스트 방법"
echo "======================================"
echo ""
echo "1. 정상 상태 테스트:"
echo ""
echo "   curl -X POST http://localhost:3000/v1/salt \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"jwt\": \"YOUR_JWT_HERE\"}' \\"
echo "     -w \"\\nTime: %{time_total}s\\n\""
echo ""
echo "   ✅ 응답 시간: ~50ms (Primary 사용)"
echo ""
echo "2. Primary 실패 시뮬레이션:"
echo ""
echo "   # 터미널 1: 잘못된 MASTER_SEED로 재시작"
echo "   export MASTER_SEED=invalid"
echo "   ./run-dev.sh"
echo ""
echo "   # 터미널 2: Salt 요청"
echo "   curl -X POST http://localhost:3000/v1/salt ..."
echo ""
echo "   ✅ 응답 시간: ~200ms (Fallback 사용)"
echo "   📋 로그: \"Falling back to remote provider\""
echo ""
echo "3. Fallback 지속 시간 테스트:"
echo ""
echo "   # 즉시 요청"
echo "   curl -X POST http://localhost:3000/v1/salt ..."
echo "   📋 로그: \"Falling back to remote provider\""
echo ""
echo "   # 30초 후"
echo "   sleep 30 && curl -X POST http://localhost:3000/v1/salt ..."
echo "   📋 로그: \"Using fallback provider due to recent primary failure\""
echo ""
echo "   # 60초 후"
echo "   sleep 30 && curl -X POST http://localhost:3000/v1/salt ..."
echo "   📋 로그: \"Attempting to use primary provider (retry)\""
echo ""
echo "======================================"
echo -e "${YELLOW}서버를 종료하려면 Ctrl+C를 누르세요${NC}"
echo "======================================"
echo ""

# 서버 실행 (포그라운드)
npm start
