#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_TERRAFORM_DIR="$PROJECT_ROOT/deploy/aws-nitro/terraform"
DEPLOY_SCRIPT="$PROJECT_ROOT/guides/standalone/05-nitro/deploy-nitro.sh"

TERRAFORM_DIR="${TERRAFORM_DIR:-$DEFAULT_TERRAFORM_DIR}"
AWS_REGION="${AWS_REGION:-}"
SEED_HEX="${SEED_HEX:-}"
INSTANCE_ID="${INSTANCE_ID:-}"
KMS_KEY_ARN="${KMS_KEY_ARN:-}"
ALB_URL="${ALB_URL:-}"
EIF_PATH="${EIF_PATH:-}"
BUILD_EIF="false"
SKIP_TERRAFORM="false"
SKIP_APP_BUILD="false"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_usage() {
  cat <<'USAGE'
Usage: ./scripts/nitro-up.sh [options]

This script performs end-to-end Nitro deployment:
1) terraform init/apply (unless --skip-terraform)
2) waits until EC2 is SSM-online
3) runs guides/standalone/05-nitro/deploy-nitro.sh
   (app artifact + EIF upload + encrypted seed bootstrap)

Note:
  This is an advanced wrapper. For end-users, prefer ./scripts/nitro-quickstart.sh

Options:
  --region <region>          AWS region (default: terraform.tfvars aws_region or AWS_REGION env)
  --terraform-dir <path>     Terraform directory (default: deploy/aws-nitro/terraform)
  --seed-hex <hex>           Master seed (0x + 64 hex). If omitted, generated automatically
  --instance-id <id>         Override EC2 instance ID (usually from terraform output)
  --kms-key-arn <arn>        Override KMS key ARN (usually from terraform output)
  --alb-url <url>            Override ALB URL (usually from terraform output)
  --eif-path <path>          Use prebuilt EIF file path
  --build-eif                Build EIF locally using enclave/build-eif.sh
  --skip-terraform           Skip terraform init/apply
  --skip-app-build           Skip app build inside deploy script
  -h, --help                 Show help
USAGE
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo -e "${RED}❌ Required command not found: $1${NC}"
    exit 1
  fi
}

detect_region_from_tfvars() {
  local tfvars_file="$1/terraform.tfvars"
  if [ -f "$tfvars_file" ]; then
    sed -n 's/^[[:space:]]*aws_region[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' "$tfvars_file" | head -n1
  fi
}

detect_pcr0_from_tfvars() {
  local tfvars_file="$1/terraform.tfvars"
  if [ -f "$tfvars_file" ]; then
    sed -n 's/^[[:space:]]*enclave_pcr0[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' "$tfvars_file" | head -n1
  fi
}

resolve_tf_output() {
  local key="$1"
  terraform -chdir="$TERRAFORM_DIR" output -raw "$key" 2>/dev/null || true
}

wait_for_ssm_online() {
  local instance_id="$1"
  local region="$2"
  local retries=40
  local sleep_secs=8

  echo -e "${BLUE}⏳ Waiting for SSM agent to become Online...${NC}"
  for ((i=1; i<=retries; i++)); do
    local ping
    ping=$(aws ssm describe-instance-information \
      --region "$region" \
      --filters "Key=InstanceIds,Values=$instance_id" \
      --query 'InstanceInformationList[0].PingStatus' \
      --output text 2>/dev/null || true)

    if [ "$ping" = "Online" ]; then
      echo -e "${GREEN}✅ SSM Online: $instance_id${NC}"
      return 0
    fi

    echo "  - attempt $i/$retries: PingStatus=$ping"
    sleep "$sleep_secs"
  done

  echo -e "${RED}❌ SSM did not become Online in time: $instance_id${NC}"
  return 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --region)
      AWS_REGION="$2"
      shift 2
      ;;
    --terraform-dir)
      TERRAFORM_DIR="$2"
      shift 2
      ;;
    --seed-hex)
      SEED_HEX="$2"
      shift 2
      ;;
    --instance-id)
      INSTANCE_ID="$2"
      shift 2
      ;;
    --kms-key-arn)
      KMS_KEY_ARN="$2"
      shift 2
      ;;
    --alb-url)
      ALB_URL="$2"
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
require_cmd npm
require_cmd tar
require_cmd xxd

if [ ! -x "$DEPLOY_SCRIPT" ]; then
  echo -e "${RED}❌ Deploy script not found/executable: $DEPLOY_SCRIPT${NC}"
  exit 1
fi

if [ -z "$AWS_REGION" ]; then
  AWS_REGION="$(detect_region_from_tfvars "$TERRAFORM_DIR")"
fi
if [ -z "$AWS_REGION" ]; then
  AWS_REGION="us-west-2"
fi

echo "============================================"
echo "  zkLogin Nitro One-Command Deploy"
echo "============================================"
echo "Terraform dir : $TERRAFORM_DIR"
echo "AWS region    : $AWS_REGION"
echo "Build EIF     : $BUILD_EIF"
echo "Skip TF apply : $SKIP_TERRAFORM"
echo ""

PCR0_VALUE="$(detect_pcr0_from_tfvars "$TERRAFORM_DIR")"
if [ -z "$PCR0_VALUE" ]; then
  echo -e "${YELLOW}⚠️ enclave_pcr0 is empty in terraform.tfvars.${NC}"
  echo -e "${YELLOW}   KMS decrypt policy will not be strict attestation-bound.${NC}"
  echo -e "${YELLOW}   For production, set enclave_pcr0 from 'nitro-cli describe-eif'.${NC}"
  echo ""
fi

if [ "$SKIP_TERRAFORM" = "false" ]; then
  echo -e "${BLUE}🏗️  Running terraform init/apply...${NC}"
  terraform -chdir="$TERRAFORM_DIR" init -input=false >/dev/null
  terraform -chdir="$TERRAFORM_DIR" apply -auto-approve
fi

if [ -z "$INSTANCE_ID" ]; then
  INSTANCE_ID="$(resolve_tf_output ec2_instance_id)"
fi
if [ -z "$KMS_KEY_ARN" ]; then
  KMS_KEY_ARN="$(resolve_tf_output kms_key_arn)"
fi
if [ -z "$ALB_URL" ]; then
  ALB_URL="$(resolve_tf_output salt_server_url)"
fi

if [ -z "$INSTANCE_ID" ] || [ -z "$KMS_KEY_ARN" ]; then
  echo -e "${RED}❌ Failed to resolve INSTANCE_ID/KMS_KEY_ARN from Terraform outputs.${NC}"
  echo "Provide --instance-id and --kms-key-arn manually."
  exit 1
fi

INSTANCE_STATE=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'Reservations[0].Instances[0].State.Name' \
  --output text)

if [ "$INSTANCE_STATE" != "running" ]; then
  echo -e "${RED}❌ EC2 is not running: $INSTANCE_ID ($INSTANCE_STATE)${NC}"
  exit 1
fi

wait_for_ssm_online "$INSTANCE_ID" "$AWS_REGION"

echo -e "${BLUE}🚀 Running Nitro deploy script...${NC}"
cmd=("$DEPLOY_SCRIPT" "--region" "$AWS_REGION" "--terraform-dir" "$TERRAFORM_DIR" "--instance-id" "$INSTANCE_ID" "--kms-key-arn" "$KMS_KEY_ARN")

if [ -n "$ALB_URL" ]; then
  cmd+=("--alb-url" "$ALB_URL")
fi
if [ -n "$EIF_PATH" ]; then
  cmd+=("--eif-path" "$EIF_PATH")
fi
if [ "$BUILD_EIF" = "true" ]; then
  cmd+=("--build-eif")
fi
if [ -n "$SEED_HEX" ]; then
  cmd+=("--seed-hex" "$SEED_HEX")
fi
if [ "$SKIP_APP_BUILD" = "true" ]; then
  cmd+=("--skip-app-build")
fi

"${cmd[@]}"

echo ""
echo -e "${GREEN}✅ Nitro deployment completed${NC}"
if [ -n "$ALB_URL" ]; then
  echo "Salt URL: $ALB_URL"
fi
