# Nitro Enclave Docker Image for zkLogin Salt Server
#
# This Dockerfile builds the enclave image that will be converted to EIF
# (Enclave Image Format) for running in AWS Nitro Enclaves.
#
# Build: docker build -t zklogin-enclave:latest .
# Convert to EIF: nitro-cli build-enclave --docker-uri zklogin-enclave:latest --output-file zklogin-enclave.eif

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install full dependencies for TypeScript build
RUN npm ci && npm cache clean --force

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies before copying to production stage
RUN npm prune --omit=dev

# Production stage - minimal image for enclave
FROM node:22-alpine AS production

# Install only essential packages
RUN apk add --no-cache dumb-init socat

# Create non-root user
RUN addgroup -g 1001 -S enclave && \
    adduser -u 1001 -S enclave -G enclave

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Set ownership
RUN chown -R enclave:enclave /app

# Switch to non-root user
USER enclave

# Expose vsock port (for documentation, vsock doesn't use TCP ports)
EXPOSE 5000

# Nitro runtime can bypass Docker ENTRYPOINT semantics, so start bridge + app in CMD.
CMD ["/bin/sh", "-lc", "set -eu; socat -d -d VSOCK-LISTEN:${VSOCK_PORT:-5000},fork,reuseaddr UNIX-CONNECT:${ENCLAVE_RPC_SOCKET_PATH:-/tmp/zklogin-enclave-rpc.sock} & pid=$!; sleep 0.2; kill -0 \"$pid\" 2>/dev/null || { echo \"[enclave] failed to start VSOCK listener\" >&2; exit 1; }; exec /usr/local/bin/node /app/dist/main.js"]
