#!/bin/bash
set -e

# Log setup
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "=========================================="
echo "zkLogin Salt Server - EC2 Setup"
echo "=========================================="

# Update system
yum update -y

# Install dependencies
yum install -y docker aws-nitro-enclaves-cli aws-nitro-enclaves-cli-devel

# Configure Docker
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

# Configure Nitro Enclaves
# Allocate resources for enclave
cat > /etc/nitro_enclaves/allocator.yaml << 'ALLOCATOR'
---
memory_mib: ${enclave_memory_mb}
cpu_count: ${enclave_cpu_count}
ALLOCATOR

# Enable and start allocator service
systemctl enable nitro-enclaves-allocator.service
systemctl start nitro-enclaves-allocator.service

# Install Node.js 22
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
yum install -y nodejs

# Create application directory
mkdir -p /opt/zklogin/logs
mkdir -p /opt/zklogin/enclave
cd /opt/zklogin

# Configuration
cat > /opt/zklogin/.env << 'ENVFILE'
SALT_PROVIDER_MODE=local
SEED_SOURCE=nitro
NITRO_ENCLAVE_CID=16
NITRO_VSOCK_PORT=${vsock_port}
NITRO_VSOCK_TIMEOUT=5000
NITRO_BOOTSTRAP_RETRIES=8
NITRO_BOOTSTRAP_RETRY_DELAY_MS=3000
PORT=${app_port}
AWS_REGION=${aws_region}
KMS_KEY_ID=${kms_key_id}
LOG_LEVEL=info
ENVFILE

# Create systemd service for salt server
cat > /etc/systemd/system/zklogin-salt.service << 'SERVICE'
[Unit]
Description=zkLogin Salt Server
After=network.target nitro-enclaves-allocator.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/zklogin
EnvironmentFile=/opt/zklogin/.env
ExecStart=/usr/bin/node /opt/zklogin/dist/main.js
Restart=always
RestartSec=5
StandardOutput=append:/opt/zklogin/logs/app.log
StandardError=append:/opt/zklogin/logs/app.log

[Install]
WantedBy=multi-user.target
SERVICE

# Create enclave run script
cat > /opt/zklogin/run-enclave.sh << 'ENCLAVE_SCRIPT'
#!/bin/bash
# Run Nitro Enclave

EIF_PATH=/opt/zklogin/enclave/zklogin-enclave.eif

if [ ! -f "$EIF_PATH" ]; then
    echo "ERROR: EIF file not found at $EIF_PATH"
    echo "Please upload the enclave image first"
    exit 1
fi

# Terminate any existing enclave
nitro-cli terminate-enclave --all 2>/dev/null || true

# Run enclave
nitro-cli run-enclave \
    --eif-path "$EIF_PATH" \
    --cpu-count ${enclave_cpu_count} \
    --memory ${enclave_memory_mb} \
    --enclave-cid 16

echo "Enclave started successfully"
nitro-cli describe-enclaves
ENCLAVE_SCRIPT

chmod +x /opt/zklogin/run-enclave.sh

# Create enclave management script
cat > /opt/zklogin/manage-enclave.sh << 'MANAGE_SCRIPT'
#!/bin/bash
# Manage Nitro Enclave

case "$1" in
    start)
        /opt/zklogin/run-enclave.sh
        ;;
    stop)
        nitro-cli terminate-enclave --all
        ;;
    status)
        nitro-cli describe-enclaves
        ;;
    logs)
        # Enclave logs are available via vsock console
        nitro-cli console --enclave-id $(nitro-cli describe-enclaves | jq -r '.[0].EnclaveID')
        ;;
    *)
        echo "Usage: $0 {start|stop|status|logs}"
        exit 1
        ;;
esac
MANAGE_SCRIPT

chmod +x /opt/zklogin/manage-enclave.sh

# Create enclave bootstrap script (initialize ENCRYPTED_SEED via vsock RPC)
cat > /opt/zklogin/bootstrap-enclave.sh << 'BOOTSTRAP_SCRIPT'
#!/bin/bash
set -euo pipefail

if [ ! -f /opt/zklogin/.env ]; then
    echo "ERROR: /opt/zklogin/.env not found"
    exit 1
fi

if [ ! -f /opt/zklogin/dist/tools/nitro-bootstrap.js ]; then
    echo "ERROR: /opt/zklogin/dist/tools/nitro-bootstrap.js not found"
    echo "Upload app artifacts first (dist + package files)."
    exit 1
fi

set -a
source /opt/zklogin/.env
set +a

cd /opt/zklogin
node dist/tools/nitro-bootstrap.js
BOOTSTRAP_SCRIPT

chmod +x /opt/zklogin/bootstrap-enclave.sh

# Set permissions
chown -R ec2-user:ec2-user /opt/zklogin

# Install CloudWatch agent for logging
yum install -y amazon-cloudwatch-agent

cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'CWAGENT'
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/opt/zklogin/logs/*.log",
            "log_group_name": "${log_group_name}",
            "log_stream_name": "{instance_id}/app",
            "retention_in_days": 30
          },
          {
            "file_path": "/var/log/user-data.log",
            "log_group_name": "${log_group_name}",
            "log_stream_name": "{instance_id}/user-data",
            "retention_in_days": 30
          }
        ]
      }
    }
  }
}
CWAGENT

systemctl enable amazon-cloudwatch-agent
systemctl start amazon-cloudwatch-agent

echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Upload application code to /opt/zklogin"
echo "2. Upload enclave EIF to /opt/zklogin/enclave/"
echo "3. Inject ENCRYPTED_SEED/KMS_KEY_ID into /opt/zklogin/.env"
echo "4. Run: /opt/zklogin/manage-enclave.sh start"
echo "5. Run: /opt/zklogin/bootstrap-enclave.sh"
echo "6. Enable: systemctl enable --now zklogin-salt"
