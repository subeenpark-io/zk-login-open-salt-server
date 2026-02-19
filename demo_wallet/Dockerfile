# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build frontend and server
RUN npm run build && npm run build:server

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV SALT_SERVER_URL=http://zklogin-prod-alb-346534019.ap-northeast-2.elb.amazonaws.com
ENV PROVER_URL=https://prover.mystenlabs.com
ENV SUI_RPC_URL=https://fullnode.testnet.sui.io
ENV SPONSORED_TX_ENABLED=true
# IMPORTANT: Inject real key at deploy time (secret manager / runtime env)
ENV SPONSOR_PRIVATE_KEY=

EXPOSE 3001

CMD ["node", "dist-server/index.js"]
