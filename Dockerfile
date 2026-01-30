# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src/ ./src/
COPY sdk/ ./sdk/
COPY scripts/ ./scripts/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S saltserver -u 1001

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy config example (users can mount their own config.yaml)
COPY config.example.yaml ./config.example.yaml

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Switch to non-root user
USER saltserver

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start server
CMD ["node", "dist/main.js"]
