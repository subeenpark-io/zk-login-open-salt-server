#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$PROJECT_ROOT"

source guides/shared/test-utils.sh
trap handle_error ERR

echo "======================================"
echo "  04-vault: HashiCorp Vault"
echo "======================================"
echo ""

# 1. Vault 설정
"$SCRIPT_DIR/setup-vault.sh"
echo ""

# 2. Vault 환경변수 설정
export VAULT_TOKEN=root-token

echo -e "${BLUE}🔧 Vault 환경변수 설정 완료${NC}"
echo "  VAULT_ADDR: http://localhost:8200"
echo "  VAULT_TOKEN: root-token"
echo ""

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
echo -e "${YELLOW}🧹 Vault 정리 중...${NC}"
cd "$SCRIPT_DIR"
docker-compose down -v
echo -e "${GREEN}✅ 정리 완료${NC}"
