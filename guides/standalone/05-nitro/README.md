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

## 배포 준비 체크리스트

아래 항목만 준비하면 됩니다.

1. AWS 인증
```bash
aws sts get-caller-identity
```

2. Terraform 변수 파일
```bash
cp deploy/aws-nitro/terraform/terraform.tfvars.example \
   deploy/aws-nitro/terraform/terraform.tfvars
# aws_region / environment / instance_type 등 수정
```

3. (선택) 고정 master seed
- 미지정 시 배포 스크립트가 자동 생성합니다.
- 고정 운영을 원하면 `--seed-hex 0x...`로 전달합니다.

4. (선택) EIF 로컬 빌드 환경
- `--build-eif`를 쓰려면 로컬에 Docker + nitro-cli 필요
- 준비되지 않았다면 미리 만든 EIF를 `enclave/zklogin-enclave.eif`에 두고 실행 가능

## 배포 방법

전체 Nitro Enclaves 구현은 다음 디렉토리에 있습니다:

```
deploy/aws-nitro/terraform/   # EC2, VPC, ALB, KMS
enclave/                      # Enclave 애플리케이션 (EIF 빌드)
guides/standalone/05-nitro/   # 이 문서
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

## 원클릭 스크립트 (권장)

루트에서 아래 명령 하나로 인프라 생성 + enclave bootstrap까지 진행할 수 있습니다.

### 사용자 배포용 (다운로드 후 바로 실행)

저장소를 받은 사용자가 최소 입력으로 바로 올리려면 `nitro-quickstart.sh`를 사용하세요.

```bash
# 1) 저장소 다운로드 후 루트로 이동
cd zk-login-open-salt-server

# 2) 실행 권한 (zip 다운로드 시 필요)
chmod +x scripts/nitro-quickstart.sh scripts/nitro-up.sh

# 3) 배포 실행 (EC2 + Enclave + bootstrap)
./scripts/nitro-quickstart.sh \
  --region ap-northeast-2 \
  --instance-type c6i.xlarge

# (선택) SSH 키를 붙이고 싶으면
./scripts/nitro-quickstart.sh \
  --region ap-northeast-2 \
  --instance-type c6i.xlarge \
  --key-name my-ec2-key

# (권장) 사전 빌드 EIF URL을 사용해 reproducible 배포
./scripts/nitro-quickstart.sh \
  --region ap-northeast-2 \
  --instance-type c6i.xlarge \
  --eif-url "https://<your-release-or-s3>/zklogin-enclave.eif" \
  --eif-sha256 "<sha256>"
```

`nitro-quickstart.sh`는 다음을 자동으로 처리합니다.
- `deploy/aws-nitro/terraform/terraform.tfvars`가 없으면 example에서 생성
- 전달한 값(`aws_region`, `environment`, `instance_type`, `key_name`)을 tfvars에 반영
- EIF 준비 자동화: 기존 파일 사용 또는 URL 다운로드(`--eif-url`) 또는 로컬 빌드(`--build-eif`)
- 기존 `./scripts/nitro-up.sh`를 호출해 전체 배포 진행

> 참고: `EIF`는 파일 크기가 커서 보통 Git에 커밋하지 않고 Release/S3에서 내려받는 방식을 권장합니다.

내릴 때는 아래 스크립트를 사용합니다.

```bash
# 서비스/엔클레이브 중지 + terraform destroy
./scripts/nitro-down.sh

# 인스턴스 내부 서비스/엔클레이브만 중지
./scripts/nitro-down.sh --stop-only
```

### 2. 고급 모드 (디버깅/세부 제어 시)

일반 사용자 배포는 `nitro-quickstart.sh`를 권장합니다.
아래는 내부 단계별 제어가 필요할 때만 사용하세요.

#### 2-1) 래퍼 스크립트 (`scripts/nitro-up.sh`)

```bash
# terraform apply + 앱/EIF/ENCRYPTED_SEED bootstrap
./scripts/nitro-up.sh

# EIF를 로컬에서 빌드
./scripts/nitro-up.sh --build-eif

# seed 고정
./scripts/nitro-up.sh --seed-hex "0x<64-hex>"
```

#### 2-2) 저수준 배포 스크립트 (`guides/standalone/05-nitro/deploy-nitro.sh`)

아래 스크립트는 다음 작업을 한 번에 수행합니다.
- 앱 빌드 + 아티팩트 패키징
- EIF 업로드
- master seed KMS 암호화 후 `ENCRYPTED_SEED` 주입
- SSM으로 enclave start + bootstrap + `zklogin-salt` 재시작

```bash
cd guides/standalone/05-nitro

# 기본: Terraform output으로 instance/kms 자동 조회
./deploy-nitro.sh --build-eif

# 또는 seed 직접 지정
./deploy-nitro.sh --build-eif --seed-hex "0x<64-hex>"
```

수동 제어가 필요하면 아래 수동 절차를 사용하세요.

### 3. Enclave 이미지(EIF) 빌드

```bash
# repo 루트에서 실행
cd enclave
./build-eif.sh

# 출력의 PCR0 값을 기록
# 예시: enclave_pcr0 = "<pcr0-value>"
```

### 4. PCR0 반영 후 Terraform 재적용

```bash
cd deploy/aws-nitro/terraform
# terraform.tfvars의 enclave_pcr0 업데이트
terraform apply
```

### 4. Terraform 출력값 확인

```bash
cd deploy/aws-nitro/terraform
EC2_INSTANCE_ID=$(terraform output -raw ec2_instance_id)
SALT_URL=$(terraform output -raw salt_server_url)
KMS_KEY_ARN=$(terraform output -raw kms_key_arn)
```

### 5. EC2 접속 (SSM)

```bash
aws ssm start-session --target "$EC2_INSTANCE_ID"
```

### 6. Enclave 시작

> 참고: user-data에서 `/opt/zklogin/run-enclave.sh`와 `/opt/zklogin/manage-enclave.sh`가 생성됩니다.

```bash
# (사전 준비) EIF 파일 업로드
# /opt/zklogin/enclave/zklogin-enclave.eif 경로에 배치

# Enclave 실행
sudo /opt/zklogin/manage-enclave.sh start

# 상태 확인
sudo /opt/zklogin/manage-enclave.sh status
```

### 7. ENCRYPTED_SEED bootstrap 실행

```bash
# /opt/zklogin/.env에 ENCRYPTED_SEED, KMS_KEY_ID, AWS_REGION 등이 있어야 함
sudo /opt/zklogin/bootstrap-enclave.sh
```

### 8. Salt Server 시작

```bash
# Systemd로 자동 시작 (이미 설정됨)
sudo systemctl status zklogin-salt

# 수동 시작
sudo systemctl enable --now zklogin-salt
```

### 9. 테스트

```bash
# SALT_URL 확인 (terraform output)
echo "$SALT_URL"

# Health check
curl "$SALT_URL/health"

# Ready check (Enclave 연결 확인)
curl "$SALT_URL/ready"

# Salt API (JWT 필요)
curl -X POST "$SALT_URL/v1/salt" \
  -H "Content-Type: application/json" \
  -d '{"jwt": "eyJhbGciOiJSUzI1NiIs..."}'
```

### 6. KMS 복호화 준비

암호화된 seed 생성 예시:

```bash
aws kms encrypt \
  --key-id "$KMS_KEY_ARN" \
  --plaintext fileb://master-seed.bin \
  --output text \
  --query CiphertextBlob > encrypted-seed.b64
```

수동 절차에서는 생성된 `CiphertextBlob`을 `.env`에 넣고
`/opt/zklogin/bootstrap-enclave.sh`를 실행해야 enclave가 초기화됩니다.

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
