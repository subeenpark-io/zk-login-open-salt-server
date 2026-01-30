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
echo "  03-aws-secrets: 개발 서버 실행"
echo "======================================"
echo ""

# 1. LocalStack 설정
"$SCRIPT_DIR/setup-localstack.sh"
echo ""

# 2. AWS 환경변수 설정
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_ENDPOINT_URL=http://localhost:4566

echo -e "${BLUE}🔧 AWS 환경변수 설정 완료${NC}"
echo "  AWS_ENDPOINT_URL: $AWS_ENDPOINT_URL"
echo "  AWS_REGION: us-east-1"
echo ""

# 3. 서버 시작
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
echo "   curl -X POST http://localhost:3000/v1/salt \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"jwt\": \"YOUR_JWT_HERE\"}'"
echo ""
echo "2. Health check:"
echo "   curl http://localhost:3000/health"
echo ""
echo "3. Ready check:"
echo "   curl http://localhost:3000/ready"
echo ""
echo "======================================"
echo -e "${YELLOW}서버를 종료하려면 Ctrl+C를 누르세요${NC}"
echo "======================================"
echo ""

# 서버 실행 (포그라운드)
npm start
