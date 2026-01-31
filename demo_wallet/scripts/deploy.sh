#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "======================================"
echo "  zkLogin Wallet 프로덕션 배포"
echo "======================================"
echo ""

cd "$PROJECT_DIR"

# 1. Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

# 2. Build frontend
echo -e "${BLUE}🔨 Building frontend...${NC}"
npm run build

# 3. Build server
echo -e "${BLUE}🔨 Building server...${NC}"
npm run build:server

# 4. Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 not found. Installing globally...${NC}"
    npm install -g pm2
fi

# 5. Stop existing process if running
echo -e "${BLUE}🛑 Stopping existing process...${NC}"
pm2 stop zklogin-wallet 2>/dev/null || true
pm2 delete zklogin-wallet 2>/dev/null || true

# 6. Start with PM2
echo -e "${BLUE}🚀 Starting with PM2...${NC}"
pm2 start ecosystem.config.cjs

# 7. Save PM2 process list
pm2 save

# 8. Setup PM2 startup (optional)
echo -e "${YELLOW}💡 To enable auto-start on reboot, run:${NC}"
echo "   pm2 startup"
echo ""

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "======================================"
echo "  서버 정보"
echo "======================================"
echo ""
echo "URL: http://localhost:3001"
echo ""
echo "PM2 명령어:"
echo "  pm2 status          # 상태 확인"
echo "  pm2 logs            # 로그 확인"
echo "  pm2 restart all     # 재시작"
echo "  pm2 stop all        # 중지"
echo ""
