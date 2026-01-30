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
echo "  Router 모드: 멀티테넌트 라우팅"
echo "======================================"
echo ""

# 1. Master Seeds 확인
echo -e "${BLUE}🔍 Master Seeds 확인 중...${NC}"

if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
    echo -e "${GREEN}✅ .env 파일 로드 완료${NC}"
else
    echo -e "${YELLOW}⚠️  .env 파일이 없습니다${NC}"
    echo ""
    echo "앱별 Master Seed를 생성하고 .env 파일에 저장하세요:"
    echo ""
    echo "  # Seed 생성 (3개)"
    echo "  npm run generate-seed  # App A"
    echo "  npm run generate-seed  # App B"
    echo "  npm run generate-seed  # Internal"
    echo ""
    echo "  # .env 파일 생성"
    echo "  cat > $SCRIPT_DIR/.env << EOF"
    echo "  SEED_APP_A=0x..."
    echo "  SEED_APP_B=0x..."
    echo "  INTERNAL_SEED=0x..."
    echo "  EOF"
    echo ""
    exit 1
fi

# Seeds 확인
MISSING_SEEDS=""

if [ -z "$SEED_APP_A" ]; then
    MISSING_SEEDS="${MISSING_SEEDS}SEED_APP_A, "
fi

if [ -z "$SEED_APP_B" ]; then
    MISSING_SEEDS="${MISSING_SEEDS}SEED_APP_B, "
fi

if [ -z "$INTERNAL_SEED" ]; then
    MISSING_SEEDS="${MISSING_SEEDS}INTERNAL_SEED, "
fi

if [ -n "$MISSING_SEEDS" ]; then
    echo -e "${RED}❌ 다음 환경변수가 설정되지 않았습니다: ${MISSING_SEEDS::-2}${NC}"
    echo ""
    echo ".env 파일을 확인하세요:"
    echo "  cat $SCRIPT_DIR/.env"
    exit 1
fi

echo -e "${GREEN}✅ 모든 Seeds 확인 완료${NC}"
echo "  App A Seed: ${SEED_APP_A:0:20}...${SEED_APP_A: -20}"
echo "  App B Seed: ${SEED_APP_B:0:20}...${SEED_APP_B: -20}"
echo "  Internal Seed: ${INTERNAL_SEED:0:20}...${INTERNAL_SEED: -20}"
echo ""

# 2. Mysten Labs 연결 확인
echo -e "${BLUE}🔍 Fallback (Mysten Labs) 연결 확인 중...${NC}"
if curl -s --max-time 5 https://salt.api.mystenlabs.com/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Mysten Labs 연결 성공${NC}"
else
    echo -e "${YELLOW}⚠️  Mysten Labs 연결 실패 (health check)${NC}"
    echo -e "${YELLOW}   Default provider가 동작하지 않을 수 있습니다${NC}"
fi
echo ""

# 3. 서버 시작
echo -e "${YELLOW}🚀 Salt Server 시작 중...${NC}"
echo ""
cd "$PROJECT_ROOT"
export CONFIG_FILE="$SCRIPT_DIR/config.yaml"
export SEED_APP_A="$SEED_APP_A"
export SEED_APP_B="$SEED_APP_B"
export INTERNAL_SEED="$INTERNAL_SEED"

echo -e "${GREEN}✅ 서버가 실행 중입니다!${NC}"
echo ""
echo "======================================"
echo "  라우팅 규칙"
echo "======================================"
echo ""
echo "1. app-a.example.com → Provider: app-a"
echo "   (자체 seed: ${SEED_APP_A:0:10}...)"
echo ""
echo "2. app-b.example.com → Provider: app-b"
echo "   (자체 seed: ${SEED_APP_B:0:10}...)"
echo ""
echo "3. *.internal.example.com → Provider: internal"
echo "   (내부용 seed: ${INTERNAL_SEED:0:10}...)"
echo ""
echo "4. 매칭되지 않는 모든 요청 → Provider: mysten"
echo "   (Mysten Labs)"
echo ""
echo "======================================"
echo "  테스트 방법"
echo "======================================"
echo ""
echo "⚠️  실제 JWT가 필요합니다 (Google OAuth Playground):"
echo "   https://developers.google.com/oauthplayground/"
echo ""
echo "1. App A 테스트 (aud: app-a.example.com):"
echo ""
echo "   curl -X POST http://localhost:3000/v1/salt \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"jwt\": \"YOUR_JWT_WITH_AUD_APP_A\"}'"
echo ""
echo "   ✅ 응답: App A seed로 생성된 salt"
echo "   📋 로그: \"Routing to provider app-a\""
echo ""
echo "2. App B 테스트 (aud: app-b.example.com):"
echo ""
echo "   curl -X POST http://localhost:3000/v1/salt \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"jwt\": \"YOUR_JWT_WITH_AUD_APP_B\"}'"
echo ""
echo "   ✅ 응답: App B seed로 생성된 salt (App A와 다름!)"
echo "   📋 로그: \"Routing to provider app-b\""
echo ""
echo "3. Internal 테스트 (aud: admin.internal.example.com):"
echo ""
echo "   curl -X POST http://localhost:3000/v1/salt \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"jwt\": \"YOUR_JWT_WITH_AUD_INTERNAL\"}'"
echo ""
echo "   ✅ 응답: Internal seed로 생성된 salt"
echo "   📋 로그: \"Routing to provider internal\""
echo ""
echo "4. Default 테스트 (aud: other-app.com):"
echo ""
echo "   curl -X POST http://localhost:3000/v1/salt \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"jwt\": \"YOUR_JWT_WITH_ANY_OTHER_AUD\"}'"
echo ""
echo "   ✅ 응답: Mysten Labs에서 조회된 salt"
echo "   📋 로그: \"Routing to provider mysten\""
echo ""
echo "======================================"
echo "  동일 사용자, 다른 앱 테스트"
echo "======================================"
echo ""
echo "동일한 사용자(sub)가 다른 앱(aud)을 사용하면"
echo "다른 salt를 받아야 합니다:"
echo ""
echo "# 사용자 alice, App A"
echo "curl ... -d '{\"jwt\": \"...sub=alice&aud=app-a.example.com\"}'"
echo "# 응답: {\"salt\": \"0x111...\"}"
echo ""
echo "# 동일 사용자 alice, App B"
echo "curl ... -d '{\"jwt\": \"...sub=alice&aud=app-b.example.com\"}'"
echo "# 응답: {\"salt\": \"0x222...\"}  ← 다른 salt!"
echo ""
echo "======================================"
echo -e "${YELLOW}서버를 종료하려면 Ctrl+C를 누르세요${NC}"
echo "======================================"
echo ""

# 서버 실행 (포그라운드)
npm start
