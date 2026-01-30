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
echo "  Proxy 모드: Mysten Labs 프록시"
echo "======================================"
echo ""

# 1. Mysten Labs 연결 확인
echo -e "${BLUE}🔍 Mysten Labs 연결 확인 중...${NC}"
if curl -s --max-time 5 https://salt.api.mystenlabs.com/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Mysten Labs 연결 성공${NC}"
else
    echo -e "${YELLOW}⚠️  Mysten Labs 연결 실패 (health check)${NC}"
    echo -e "${YELLOW}   서버는 시작되지만 Mysten Labs가 응답하지 않을 수 있습니다${NC}"
fi
echo ""

# 2. 서버 시작
echo -e "${YELLOW}🚀 Salt Server 시작 중...${NC}"
echo ""
cd "$PROJECT_ROOT"
export CONFIG_FILE="$SCRIPT_DIR/config.yaml"

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
echo "   # Salt API 테스트 (실제 JWT 필요)"
echo "   curl -X POST http://localhost:3000/v1/salt \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"jwt\": \"YOUR_JWT_HERE\"}'"
echo ""
echo "2. Mysten Labs와 비교:"
echo ""
echo "   # Mysten Labs 직접 호출"
echo "   curl -X POST https://salt.api.mystenlabs.com/get_salt \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"jwt\": \"YOUR_JWT_HERE\"}'"
echo ""
echo "   # 프록시 서버 호출"
echo "   curl -X POST http://localhost:3000/v1/salt \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"jwt\": \"YOUR_JWT_HERE\"}'"
echo ""
echo "   ➡️  두 응답이 동일한 salt 값을 반환해야 합니다"
echo ""
echo "======================================"
echo -e "${YELLOW}서버를 종료하려면 Ctrl+C를 누르세요${NC}"
echo "======================================"
echo ""

# 서버 실행 (포그라운드)
npm start
