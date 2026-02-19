#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_TERRAFORM_DIR="$PROJECT_ROOT/deploy/aws-nitro/terraform"

TERRAFORM_DIR="${TERRAFORM_DIR:-$DEFAULT_TERRAFORM_DIR}"
AWS_REGION="${AWS_REGION:-}"
INSTANCE_ID="${INSTANCE_ID:-}"
STOP_ONLY="false"
SKIP_INSTANCE_STOP="false"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_usage() {
  cat <<'USAGE'
Usage: ./scripts/nitro-down.sh [options]

This script safely tears down Nitro deployment:
1) stop app service + enclave on EC2 via SSM (best-effort)
2) terraform destroy (unless --stop-only)

Options:
  --region <region>          AWS region (default: terraform.tfvars aws_region or AWS_REGION env)
  --terraform-dir <path>     Terraform directory (default: deploy/aws-nitro/terraform)
  --instance-id <id>         EC2 instance ID override
  --stop-only                Stop service/enclave only; do not run terraform destroy
  --skip-instance-stop       Skip SSM stop command
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

resolve_tf_output() {
  local key="$1"
  terraform -chdir="$TERRAFORM_DIR" output -raw "$key" 2>/dev/null || true
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
    --instance-id)
      INSTANCE_ID="$2"
      shift 2
      ;;
    --stop-only)
      STOP_ONLY="true"
      shift
      ;;
    --skip-instance-stop)
      SKIP_INSTANCE_STOP="true"
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

if [ -z "$AWS_REGION" ]; then
  AWS_REGION="$(detect_region_from_tfvars "$TERRAFORM_DIR")"
fi
if [ -z "$AWS_REGION" ]; then
  AWS_REGION="us-west-2"
fi

if [ -z "$INSTANCE_ID" ]; then
  INSTANCE_ID="$(resolve_tf_output ec2_instance_id)"
fi

echo "============================================"
echo "  zkLogin Nitro Teardown"
echo "============================================"
echo "Terraform dir     : $TERRAFORM_DIR"
echo "AWS region        : $AWS_REGION"
echo "Instance stop     : $([ "$SKIP_INSTANCE_STOP" = "true" ] && echo 'skip' || echo 'enabled')"
echo "Terraform destroy : $([ "$STOP_ONLY" = "true" ] && echo 'skip (--stop-only)' || echo 'enabled')"
echo ""

if [ "$SKIP_INSTANCE_STOP" = "false" ] && [ -n "$INSTANCE_ID" ]; then
  INSTANCE_STATE=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --region "$AWS_REGION" \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text 2>/dev/null || echo "not-found")

  if [ "$INSTANCE_STATE" = "running" ] || [ "$INSTANCE_STATE" = "stopped" ]; then
    echo -e "${BLUE}🛑 Stopping service/enclave via SSM...${NC}"

    COMMAND_ID=$(aws ssm send-command \
      --instance-ids "$INSTANCE_ID" \
      --region "$AWS_REGION" \
      --document-name "AWS-RunShellScript" \
      --parameters commands='["sudo systemctl stop zklogin-salt || true","sudo /opt/zklogin/manage-enclave.sh stop || true"]' \
      --query 'Command.CommandId' \
      --output text 2>/dev/null || true)

    if [ -n "$COMMAND_ID" ] && [ "$COMMAND_ID" != "None" ]; then
      echo "  - SSM command id: $COMMAND_ID"
      sleep 3
      aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --region "$AWS_REGION" \
        --query '{Status:Status,Stdout:StandardOutputContent,Stderr:StandardErrorContent}' \
        --output json || true
    else
      echo -e "${YELLOW}⚠️ Could not run SSM stop command (instance may be unreachable).${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️ Instance not running: $INSTANCE_ID ($INSTANCE_STATE)${NC}"
  fi
fi

if [ "$STOP_ONLY" = "true" ]; then
  echo -e "${GREEN}✅ Stop-only completed${NC}"
  exit 0
fi

echo -e "${BLUE}💥 Running terraform destroy...${NC}"
terraform -chdir="$TERRAFORM_DIR" destroy -auto-approve

echo ""
echo -e "${GREEN}✅ Terraform destroy completed${NC}"
