# 05-nitro: AWS Nitro Enclaves

AWS Nitro Enclaves는 TEE (Trusted Execution Environment)를 제공하여
master seed를 하드웨어 수준에서 격리합니다.

## 보안 수준
⭐⭐⭐⭐⭐ (최고 보안)

## 로컬 테스트
❌ **불가능** - 실제 EC2 Nitro 인스턴스 필요

## 전제 조건
- AWS 계정
- EC2 Nitro 지원 인스턴스 (c5, m5, r5, c6i, m6i, r6i 등)
- Terraform (인프라 배포)
- AWS CLI v2

## 배포 방법

전체 Nitro Enclaves 구현은 다음 디렉토리에 있습니다:

```
deploy/aws-nitro/
├── terraform/          # EC2, VPC, ALB, KMS
│   ├── main.tf
│   ├── vpc.tf
│   ├── ec2.tf
│   ├── alb.tf
│   ├── kms.tf
│   └── ...
├── enclave/           # Enclave 애플리케이션
│   ├── src/
│   ├── Dockerfile
│   └── build-eif.sh
└── README.md          # 상세 배포 가이드
```

## 빠른 시작

### 1. Terraform 배포

```bash
cd deploy/aws-nitro/terraform

# 초기화
terraform init

# 변수 설정
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars 편집:
#   - aws_region
#   - environment
#   - instance_type
#   - key_name (SSH 키)

# 배포
terraform plan
terraform apply
```

### 2. EC2 접속

```bash
# Terraform output에서 IP 확인
EC2_IP=$(terraform output -raw ec2_public_ip)

# SSH 접속
ssh -i ~/.ssh/your-key.pem ec2-user@$EC2_IP
```

### 3. Enclave 시작

```bash
# Enclave 시작
sudo nitro-cli run-enclave \
  --eif-path /app/zklogin-enclave.eif \
  --cpu-count 2 \
  --memory 512 \
  --debug-mode

# Enclave 상태 확인
sudo nitro-cli describe-enclaves

# Enclave 로그 확인
ENCLAVE_ID=$(sudo nitro-cli describe-enclaves | jq -r '.[0].EnclaveID')
sudo nitro-cli console --enclave-id $ENCLAVE_ID
```

### 4. Salt Server 시작

```bash
# Systemd로 자동 시작 (이미 설정됨)
sudo systemctl status salt-server

# 수동 시작
cd /app/salt-server
npm start
```

### 5. 테스트

```bash
# ALB URL 확인
ALB_URL=$(terraform output -raw alb_url)

# Health check
curl https://$ALB_URL/health

# Ready check (Enclave 연결 확인)
curl https://$ALB_URL/ready

# Salt API (JWT 필요)
curl -X POST https://$ALB_URL/v1/salt \
  -H "Content-Type: application/json" \
  -d '{"jwt": "eyJhbGciOiJSUzI1NiIs..."}'
```

## 동작 방식

```
┌─────────────────────────────────────────────────────────┐
│              EC2 Instance (Nitro-enabled)                │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Parent Instance                     │   │
│  │                                                  │   │
│  │  ┌──────────────────────────────┐               │   │
│  │  │     Salt Server (Hono)       │               │   │
│  │  │  - POST /v1/salt             │               │   │
│  │  │  - JWT 검증                   │               │   │
│  │  │  - vsock 클라이언트           │               │   │
│  │  └──────────┬───────────────────┘               │   │
│  │             │ vsock (CID 16, port 5000)         │   │
│  │             ▼                                    │   │
│  │  ┌──────────────────────────────────────────┐   │   │
│  │  │          Nitro Enclave                   │   │   │
│  │  │                                          │   │   │
│  │  │  • Master Seed (메모리에만 존재)          │   │   │
│  │  │  • Salt 계산 (HKDF)                      │   │   │
│  │  │  • KMS attestation                      │   │   │
│  │  │  • vsock 서버                            │   │   │
│  │  │                                          │   │   │
│  │  └──────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
         ▲                                 │
         │                                 │
         │ HTTPS                          │ KMS
         │                                 │ (attestation)
         │                                 ▼
    ┌────┴────┐                      ┌─────────┐
    │   ALB   │                      │   KMS   │
    └─────────┘                      └─────────┘
```

### 보안 흐름

1. **Enclave 시작**
   - Enclave 이미지 (EIF) 로드
   - PCR (Platform Configuration Register) 계산

2. **Seed 복호화**
   - Enclave가 KMS에 attestation document 전송
   - KMS가 PCR 검증
   - 검증 통과 시 암호화된 seed 복호화
   - Seed를 Enclave 메모리에만 저장

3. **Salt 계산**
   - Parent가 vsock으로 salt 요청 (sub, aud 전달)
   - Enclave 내부에서 HKDF로 salt 계산
   - vsock으로 salt 반환

4. **격리**
   - Parent 프로세스는 seed에 절대 접근 불가
   - 메모리 스냅샷 불가
   - 디버깅 불가

## 보안 장점

### 하드웨어 격리
- ✅ CPU, 메모리 완전 격리
- ✅ Parent 프로세스도 seed에 접근 불가
- ✅ 메모리 덤프 불가능
- ✅ 디버거 연결 불가능

### KMS 통합
- ✅ Attestation 기반 복호화
- ✅ PCR 값으로 이미지 검증
- ✅ Seed는 암호화된 상태로 저장
- ✅ CloudTrail 감사 로그

### 운영 보안
- ✅ Enclave 이미지 불변성
- ✅ 무단 수정 방지
- ✅ 자동 재시작 (systemd)

## 비용 (예상)

### 월 예상 비용 (us-west-2)
- **EC2 c5.xlarge**: $0.17/시간 × 730시간 = ~$124/월
- **ALB**: $16.20/월 (기본) + 데이터 전송
- **KMS**: $1/월 + API 호출 ($0.03/10,000 requests)
- **Data Transfer**: 변동 (첫 1GB 무료)

**총 예상**: ~$140-150/월

### 비용 절감 팁
- Reserved Instance 사용 (1년: ~40% 할인)
- Savings Plans
- 개발 환경은 t3.medium 사용 가능

## 문제 해결

### Enclave 시작 실패
```bash
# Nitro CLI 설치 확인
nitro-cli --version

# Enclave 옵션 확인
cat /sys/module/nitro_enclaves/parameters/ne_cpus
cat /sys/module/nitro_enclaves/parameters/ne_mem_size

# 할당된 리소스 확인
lscpu | grep "On-line CPU(s) list"
```

### KMS 복호화 실패
```bash
# IAM 권한 확인
aws sts get-caller-identity

# KMS 키 정책 확인
aws kms get-key-policy \
  --key-id <key-id> \
  --policy-name default

# Attestation document 확인
sudo nitro-cli describe-enclaves | jq '.[0].Measurements'
```

### vsock 연결 실패
```bash
# Parent에서 vsock 확인
sudo lsof -i :5000

# Enclave 로그 확인
ENCLAVE_ID=$(sudo nitro-cli describe-enclaves | jq -r '.[0].EnclaveID')
sudo nitro-cli console --enclave-id $ENCLAVE_ID
```

## 모니터링

### CloudWatch Metrics
- EC2 인스턴스 메트릭
- ALB 메트릭 (요청 수, 레이턴시)
- KMS API 호출 수

### CloudWatch Logs
- Salt Server 로그
- Enclave 로그 (CloudWatch Logs Agent)

### 알람 설정
```bash
# EC2 CPU 사용률
aws cloudwatch put-metric-alarm \
  --alarm-name salt-server-cpu \
  --metric-name CPUUtilization \
  --threshold 80

# ALB 5xx 에러
aws cloudwatch put-metric-alarm \
  --alarm-name salt-server-errors \
  --metric-name HTTPCode_Target_5XX_Count \
  --threshold 10
```

## 백업 및 복구

### Seed 백업
```bash
# KMS로 암호화된 seed 백업
aws secretsmanager create-secret \
  --name zklogin/encrypted-seed-backup \
  --secret-string "$(cat encrypted-seed.bin | base64)"

# Terraform 상태 백업
terraform state pull > terraform.tfstate.backup
```

### DR (Disaster Recovery)
- Multi-region KMS 복제
- Terraform으로 다른 리전에 배포
- ALB failover 구성

## 다음 단계

- [Nitro Enclaves 공식 문서](https://docs.aws.amazon.com/enclaves/latest/user/)
- [KMS Attestation 가이드](https://docs.aws.amazon.com/kms/latest/developerguide/services-nitro-enclaves.html)
- [vsock 프로그래밍](https://man7.org/linux/man-pages/man7/vsock.7.html)
- [프로덕션 체크리스트](../../../README.md#프로덕션-체크리스트)
