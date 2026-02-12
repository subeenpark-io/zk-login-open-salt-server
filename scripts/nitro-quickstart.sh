#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

NITRO_UP_SCRIPT="$PROJECT_ROOT/scripts/nitro-up.sh"
DEFAULT_TERRAFORM_DIR="$PROJECT_ROOT/deploy/aws-nitro/terraform"
DEFAULT_EIF_PATH="$PROJECT_ROOT/enclave/zklogin-enclave.eif"

TERRAFORM_DIR="${TERRAFORM_DIR:-$DEFAULT_TERRAFORM_DIR}"
AWS_REGION="${AWS_REGION:-}"
ENVIRONMENT="${ENVIRONMENT:-}"
INSTANCE_TYPE="${INSTANCE_TYPE:-}"
KEY_NAME="${KEY_NAME:-}"
EIF_URL="${EIF_URL:-}"
EIF_SHA256="${EIF_SHA256:-}"
EIF_PATH="${EIF_PATH:-$DEFAULT_EIF_PATH}"
BUILD_EIF="false"
SEED_HEX="${SEED_HEX:-}"
SKIP_TERRAFORM="false"
SKIP_APP_BUILD="false"

TFVARS_FILE=""
TFVARS_EXAMPLE=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_usage() {
  cat <<'USAGE'
Usage: ./scripts/nitro-quickstart.sh [options]

Goal:
  Download repo -> run one command -> deploy EC2 + Nitro Enclave + app bootstrap.

What this script does:
  1) creates deploy/aws-nitro/terraform/terraform.tfvars from example when missing
  2) writes basic Terraform variables from options (region/environment/instance_type/key_name)
  3) ensures EIF is ready (download/existing/build)
  4) calls ./scripts/nitro-up.sh for full deployment

Options:
  --region <region>          AWS region (ex: ap-northeast-2)
  --environment <name>       Terraform environment value (default: prod)
  --instance-type <type>     Nitro-enabled EC2 type (ex: c5.xlarge, c6i.xlarge)
  --key-name <name>          Optional EC2 key pair name
  --terraform-dir <path>     Terraform dir (default: deploy/aws-nitro/terraform)
  --eif-url <url>            Download prebuilt EIF before deploy
  --eif-sha256 <hex>         Verify EIF SHA256 checksum (recommended with --eif-url)
  --eif-path <path>          EIF path to use (default: enclave/zklogin-enclave.eif)
  --build-eif                Build EIF locally before deploy (requires docker + nitro-cli)
  --seed-hex <hex>           Fixed master seed (0x + 64 hex)
  --skip-terraform           Pass-through to nitro-up.sh
  --skip-app-build           Pass-through to nitro-up.sh
  -h, --help                 Show help
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo -e "${RED}❌ Required command not found: $1${NC}"
    exit 1
  fi
}

escape_hcl_string() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

normalize_sha256() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]'
}

sha256_of_file() {
  local file_path="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file_path" | awk '{print tolower($1)}'
    return
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file_path" | awk '{print tolower($1)}'
    return
  fi

  echo -e "${RED}❌ Neither shasum nor sha256sum is available.${NC}"
  exit 1
}

verify_eif_checksum() {
  local expected actual
  expected="$(normalize_sha256 "$EIF_SHA256")"
  actual="$(sha256_of_file "$EIF_PATH")"

  if [ "$expected" != "$actual" ]; then
    echo -e "${RED}❌ EIF checksum mismatch${NC}"
    echo "  expected: $expected"
    echo "  actual  : $actual"
    exit 1
  fi

  echo -e "${GREEN}✅ EIF checksum verified${NC}"
}

upsert_tfvar() {
  local key="$1"
  local raw_value="$2"
  local tmp_file
  tmp_file="$(mktemp)"

  awk -v target_key="$key" -v target_value="$raw_value" '
    BEGIN { replaced = 0 }
    {
      if ($0 ~ "^[[:space:]]*" target_key "[[:space:]]*=") {
        if (replaced == 0) {
          print target_key " = " target_value
          replaced = 1
        }
        next
      }
      print $0
    }
    END {
      if (replaced == 0) {
        print target_key " = " target_value
      }
    }
  ' "$TFVARS_FILE" > "$tmp_file"

  mv "$tmp_file" "$TFVARS_FILE"
}

ensure_tfvars() {
  TFVARS_FILE="$TERRAFORM_DIR/terraform.tfvars"
  TFVARS_EXAMPLE="$TERRAFORM_DIR/terraform.tfvars.example"

  if [ ! -f "$TFVARS_FILE" ]; then
    if [ -f "$TFVARS_EXAMPLE" ]; then
      cp "$TFVARS_EXAMPLE" "$TFVARS_FILE"
      echo -e "${GREEN}✅ Created $TFVARS_FILE from example${NC}"
    else
      : > "$TFVARS_FILE"
      echo -e "${YELLOW}⚠️ No terraform.tfvars.example found. Created empty $TFVARS_FILE${NC}"
    fi
  fi
}

download_eif() {
  mkdir -p "$(dirname "$EIF_PATH")"

  if command -v curl >/dev/null 2>&1; then
    curl -fL --retry 3 --retry-delay 2 --retry-all-errors \
      -o "$EIF_PATH" "$EIF_URL"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -O "$EIF_PATH" "$EIF_URL"
    return
  fi

  echo -e "${RED}❌ curl or wget is required to download EIF.${NC}"
  exit 1
}

prepare_eif() {
  if [ -n "$EIF_URL" ] && [ "$BUILD_EIF" = "true" ]; then
    echo -e "${RED}❌ Use either --eif-url or --build-eif, not both.${NC}"
    exit 1
  fi

  if [ -n "$EIF_URL" ]; then
    echo -e "${BLUE}📥 Downloading EIF from URL...${NC}"
    download_eif
    if [ -n "$EIF_SHA256" ]; then
      verify_eif_checksum
    else
      echo -e "${YELLOW}⚠️ EIF checksum was not provided (--eif-sha256).${NC}"
    fi
    BUILD_EIF="false"
    return
  fi

  if [ -f "$EIF_PATH" ]; then
    echo -e "${GREEN}✅ Using existing EIF: $EIF_PATH${NC}"
    if [ -n "$EIF_SHA256" ]; then
      verify_eif_checksum
    fi
    BUILD_EIF="false"
    return
  fi

  if [ "$BUILD_EIF" = "true" ]; then
    echo -e "${BLUE}🔨 EIF will be built locally (--build-eif).${NC}"
    return
  fi

  if command -v docker >/dev/null 2>&1 && command -v nitro-cli >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then
      BUILD_EIF="true"
      echo -e "${YELLOW}⚠️ No prebuilt EIF found. Auto-enabled --build-eif.${NC}"
      return
    fi
  fi

  echo -e "${RED}❌ EIF is missing and cannot be built automatically.${NC}"
  echo "Provide one of the following:"
  echo "  1) --eif-url <url> [--eif-sha256 <hex>] (recommended)"
  echo "  2) --build-eif (requires docker + nitro-cli)"
  echo "  3) place file at: $EIF_PATH"
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --region)
      AWS_REGION="$2"
      shift 2
      ;;
    --environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --instance-type)
      INSTANCE_TYPE="$2"
      shift 2
      ;;
    --key-name)
      KEY_NAME="$2"
      shift 2
      ;;
    --terraform-dir)
      TERRAFORM_DIR="$2"
      shift 2
      ;;
    --eif-url)
      EIF_URL="$2"
      shift 2
      ;;
    --eif-sha256)
      EIF_SHA256="$2"
      shift 2
      ;;
    --eif-path)
      EIF_PATH="$2"
      shift 2
      ;;
    --build-eif)
      BUILD_EIF="true"
      shift
      ;;
    --seed-hex)
      SEED_HEX="$2"
      shift 2
      ;;
    --skip-terraform)
      SKIP_TERRAFORM="true"
      shift
      ;;
    --skip-app-build)
      SKIP_APP_BUILD="true"
      shift
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo -e "${RED}❌ Unknown argument: $1${NC}"
      print_usage
      exit 1
      ;;
  esac
done

require_cmd aws
require_cmd terraform
require_cmd jq

if [ ! -x "$NITRO_UP_SCRIPT" ]; then
  echo -e "${RED}❌ Not executable: $NITRO_UP_SCRIPT${NC}"
  echo "Run: chmod +x scripts/nitro-up.sh scripts/nitro-quickstart.sh"
  exit 1
fi

ensure_tfvars

if [ -n "$AWS_REGION" ]; then
  upsert_tfvar "aws_region" "$(escape_hcl_string "$AWS_REGION")"
fi
if [ -n "$ENVIRONMENT" ]; then
  upsert_tfvar "environment" "$(escape_hcl_string "$ENVIRONMENT")"
fi
if [ -n "$INSTANCE_TYPE" ]; then
  upsert_tfvar "instance_type" "$(escape_hcl_string "$INSTANCE_TYPE")"
fi
if [ -n "$KEY_NAME" ]; then
  upsert_tfvar "key_name" "$(escape_hcl_string "$KEY_NAME")"
fi

prepare_eif

echo "============================================"
echo "  Nitro Quickstart"
echo "============================================"
echo "Terraform dir : $TERRAFORM_DIR"
echo "tfvars file   : $TFVARS_FILE"
echo "EIF path      : $EIF_PATH"
echo "Build EIF     : $BUILD_EIF"
echo "Skip TF apply : $SKIP_TERRAFORM"
echo ""

cmd=("$NITRO_UP_SCRIPT" "--terraform-dir" "$TERRAFORM_DIR" "--eif-path" "$EIF_PATH")

if [ -n "$AWS_REGION" ]; then
  cmd+=("--region" "$AWS_REGION")
fi
if [ "$BUILD_EIF" = "true" ]; then
  cmd+=("--build-eif")
fi
if [ -n "$SEED_HEX" ]; then
  cmd+=("--seed-hex" "$SEED_HEX")
fi
if [ "$SKIP_TERRAFORM" = "true" ]; then
  cmd+=("--skip-terraform")
fi
if [ "$SKIP_APP_BUILD" = "true" ]; then
  cmd+=("--skip-app-build")
fi

"${cmd[@]}"
