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
echo "  Vault 설정"
echo "======================================"
echo ""

# 1. Vault 시작
echo -e "${BLUE}🔐 Vault 시작 중...${NC}"
cd "$SCRIPT_DIR"
docker-compose up -d

# 2. Vault 준비 대기
echo -e "${YELLOW}⏳ Vault 준비 대기 중...${NC}"
sleep 5

export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="root-token"

# Health check
MAX_ATTEMPTS=30
attempt=1
while [ $attempt -le $MAX_ATTEMPTS ]; do
    if curl -s "$VAULT_ADDR/v1/sys/health" 2>/dev/null | grep -q '"initialized":true'; then
        echo -e "${GREEN}✅ Vault 준비 완료${NC}"
        break
    fi
    echo "  대기 중... ($attempt/$MAX_ATTEMPTS)"
    sleep 2
    attempt=$((attempt + 1))
done

if [ $attempt -gt $MAX_ATTEMPTS ]; then
    echo -e "${RED}❌ Vault 시작 실패${NC}"
    docker-compose logs
    exit 1
fi
echo ""

# 3. 시드 생성
echo -e "${BLUE}🔑 Master Seed 생성 중...${NC}"
cd "$PROJECT_ROOT"
SEED=$(npm run generate-seed --silent 2>&1 | grep "^0x")
echo "  Seed: ${SEED:0:20}...${SEED: -20}"
echo ""

# 4. Vault에 저장
echo -e "${BLUE}📤 Vault에 저장 중...${NC}"
curl -s -X POST "$VAULT_ADDR/v1/secret/data/zklogin/seed" \
    -H "X-Vault-Token: $VAULT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"data\": {\"masterSeed\": \"$SEED\"}}" \
    > /dev/null 2>&1

echo -e "${GREEN}✅ 시드가 Vault에 저장되었습니다${NC}"
echo ""

# 5. 검증
echo -e "${BLUE}🔍 시드 검증 중...${NC}"
STORED_SEED=$(curl -s -X GET "$VAULT_ADDR/v1/secret/data/zklogin/seed" \
    -H "X-Vault-Token: $VAULT_TOKEN" 2>/dev/null | jq -r .data.data.masterSeed)

if [ "$SEED" == "$STORED_SEED" ]; then
    echo -e "${GREEN}✅ 시드 검증 완료${NC}"
else
    echo -e "${RED}❌ 시드 검증 실패${NC}"
    echo "Original: $SEED"
    echo "Stored: $STORED_SEED"
    exit 1
fi

echo ""
echo "======================================"
echo -e "${GREEN}✅ Vault 설정 완료!${NC}"
echo "======================================"
