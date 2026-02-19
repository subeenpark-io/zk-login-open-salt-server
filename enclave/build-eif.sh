#!/bin/bash
#
# Build script for zkLogin Nitro Enclave Image (EIF)
#
# This script:
# 1. Builds the Docker image for the enclave
# 2. Converts it to EIF format using nitro-cli
# 3. Outputs PCR values for KMS policy configuration
#
# Prerequisites:
# - Docker installed and running
# - nitro-cli installed (available on Amazon Linux 2 with Nitro Enclaves support)
# - AWS Nitro Enclaves CLI: https://github.com/aws/aws-nitro-enclaves-cli
#
# Usage: ./build-eif.sh [output-file]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_IMAGE="zklogin-enclave:latest"
OUTPUT_FILE="${1:-zklogin-enclave.eif}"
PCR_OUTPUT_FILE="pcr-values.json"

echo "=========================================="
echo "zkLogin Nitro Enclave Build Script"
echo "=========================================="
echo ""

# Step 1: Build Docker image
echo "Step 1: Building Docker image..."
docker build -t "$DOCKER_IMAGE" "$SCRIPT_DIR"

if [ $? -ne 0 ]; then
    echo "ERROR: Docker build failed"
    exit 1
fi
echo "Docker image built: $DOCKER_IMAGE"
echo ""

# Step 2: Check if nitro-cli is available
if ! command -v nitro-cli &> /dev/null; then
    echo "WARNING: nitro-cli is not installed."
    echo "To build EIF files, install AWS Nitro Enclaves CLI:"
    echo "  sudo amazon-linux-extras install aws-nitro-enclaves-cli"
    echo ""
    echo "For development/testing, you can use the Docker image directly."
    echo "Docker image is ready: $DOCKER_IMAGE"
    exit 0
fi

# Step 3: Build EIF
echo "Step 2: Building Enclave Image Format (EIF)..."
nitro-cli build-enclave \
    --docker-uri "$DOCKER_IMAGE" \
    --output-file "$OUTPUT_FILE"

if [ $? -ne 0 ]; then
    echo "ERROR: EIF build failed"
    exit 1
fi
echo "EIF built: $OUTPUT_FILE"
echo ""

# Step 4: Get PCR values
echo "Step 3: Extracting PCR values..."
nitro-cli describe-eif --eif-path "$OUTPUT_FILE" > "$PCR_OUTPUT_FILE"

echo ""
echo "=========================================="
echo "Build Complete!"
echo "=========================================="
echo ""
echo "Output files:"
echo "  - EIF: $OUTPUT_FILE"
echo "  - PCR values: $PCR_OUTPUT_FILE"
echo ""
echo "PCR Values (for KMS key policy):"
echo "---"
# Nitro CLI output schema can differ by version (e.g. "PCRs" vs "Measurements").
if grep -q '"PCRs"' "$PCR_OUTPUT_FILE"; then
    grep -A 20 "PCRs" "$PCR_OUTPUT_FILE" || true
elif grep -q '"Measurements"' "$PCR_OUTPUT_FILE"; then
    grep -A 20 "Measurements" "$PCR_OUTPUT_FILE" || true
else
    cat "$PCR_OUTPUT_FILE"
fi
echo "---"
echo ""
echo "Next steps:"
echo "1. Upload EIF to your EC2 instance"
echo "2. Update KMS key policy with PCR0 value"
echo "3. Run enclave: nitro-cli run-enclave --eif-path $OUTPUT_FILE --cpu-count 2 --memory 512"
echo ""
