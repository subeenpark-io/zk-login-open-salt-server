# 03-aws-secrets: AWS Secrets Manager

AWS Secrets Manager를 사용하여 master seed를 안전하게 저장하는 방법입니다.

## 📋 목차

- [스크립트 개요](#스크립트-개요)
- [Option 1: 로컬 개발 (LocalStack)](#option-1-로컬-개발-localstack)
- [Option 2: 로컬 개발 (실제 AWS)](#option-2-로컬-개발-실제-aws)
- [Option 3: EC2 프로덕션 배포](#option-3-ec2-프로덕션-배포)
- [비교표](#비교표)
- [실제 JWT 발급 방법](#실제-jwt-발급-방법)

---

## 스크립트 개요

| 스크립트 | 실행 위치 | Seed 저장소 | 외부 접근 | 용도 |
|---------|----------|------------|---------|------|
| [`run-dev.sh`](#option-1-로컬-개발-localstack) | **로컬** | LocalStack | ❌ | 로컬 개발/테스트 |
| [`run-dev-aws.sh`](#option-2-로컬-개발-실제-aws) | **로컬** | AWS Secrets Manager | ❌ | AWS 통합 테스트 |
| [`deploy-to-ec2.sh`](#option-3-ec2-프로덕션-배포) | **EC2** | AWS Secrets Manager | ✅ | 프로덕션 배포 |

---

## Option 1: 로컬 개발 (LocalStack)

**스크립트**: `run-dev.sh`

### 개요

로컬 환경에서 AWS Secrets Manager를 에뮬레이션하여 테스트합니다.
- **서버 실행**: 로컬 컴퓨터 (localhost:3000)
- **Seed 저장소**: LocalStack (Docker)
- **외부 접근**: 불가능
- **비용**: 무료

### 전제 조건

```bash
# macOS
brew install docker docker-compose awscli jq

# Ubuntu/Debian
apt-get install docker.io docker-compose awscli jq
```

### 실행 방법

```bash
cd guides/standalone/03-aws-secrets

# 서버 시작 (LocalStack 자동 설정 포함)
./run-dev.sh
```

### 동작 과정

1. **LocalStack 시작**: Docker Compose로 LocalStack 컨테이너 실행
2. **Master Seed 생성**: 테스트용 32바이트 seed 생성
3. **Secrets Manager에 저장**: LocalStack의 Secrets Manager에 업로드 (`zklogin/test-seed`)
4. **Config 파일 생성**: `config.yaml` 자동 생성
5. **서버 시작**: localhost:3000에서 Salt Server 실행

### 테스트 방법

새 터미널을 열고:

```bash
# Health check
curl http://localhost:3000/health

# Ready check (Provider 상태 확인)
curl http://localhost:3000/ready

# Salt API 테스트 (실제 JWT 필요)
curl -X POST http://localhost:3000/v1/salt \
  -H 'Content-Type: application/json' \
  -d '{"jwt": "YOUR_GOOGLE_JWT_HERE"}'
```

### 종료 방법

서버를 실행 중인 터미널에서 `Ctrl+C`를 누르면 자동으로:
- Salt Server 종료
- LocalStack 컨테이너 중지 및 삭제

### 장단점

✅ **장점**:
- 로컬 환경에서 완전히 격리
- AWS 비용 없음
- 빠른 테스트 가능
- 인터넷 연결 불필요

❌ **단점**:
- 실제 보안 메커니즘 없음
- LocalStack은 프로덕션 용도 아님
- 외부에서 접근 불가

---

## Option 2: 로컬 개발 (실제 AWS)

**스크립트**: `run-dev-aws.sh`

### 개요

로컬에서 서버를 실행하지만 실제 AWS Secrets Manager를 사용합니다.
- **서버 실행**: 로컬 컴퓨터 (localhost:3000)
- **Seed 저장소**: 실제 AWS Secrets Manager
- **외부 접근**: 불가능
- **비용**: ~$0.50/월

### 전제 조건

```bash
# AWS CLI 설치
brew install awscli jq  # macOS
apt-get install awscli jq  # Ubuntu

# AWS 자격 증명 설정
aws configure
# AWS Access Key ID: AKIA...
# AWS Secret Access Key: ...
# Default region name: ap-northeast-2
# Default output format: json
```

### IAM 권한

다음 권한이 필요합니다:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:CreateSecret"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:zklogin/*"
    }
  ]
}
```

### 실행 방법

```bash
cd guides/standalone/03-aws-secrets

# 1. Master Seed 생성
npm run generate-seed
# 출력: 0xabcdef1234567890...

# 2. AWS Secrets Manager에 업로드
aws secretsmanager create-secret \
  --name zklogin/prod-seed \
  --description "zkLogin Salt Server Production Master Seed" \
  --secret-string '{"masterSeed":"YOUR_SEED_HERE"}' \
  --region ap-northeast-2

# 3. 서버 시작
./run-dev-aws.sh
```

### 동작 과정

1. **AWS 자격 증명 확인**: `aws sts get-caller-identity` 실행
2. **Secret 존재 확인**: `zklogin/prod-seed` 검증
3. **Config 파일 생성**: 실제 AWS 연결 설정 (`config-aws-runtime.yaml`)
4. **서버 시작**: localhost:3000에서 실행
5. **런타임 Seed 로드**: 서버가 AWS Secrets Manager에서 직접 로드

### 장단점

✅ **장점**:
- 실제 AWS 환경 시뮬레이션
- AWS KMS 암호화 사용
- IAM 접근 제어
- CloudTrail 감사 로그

❌ **단점**:
- AWS 비용 발생 (~$0.50/월)
- 인터넷 연결 필요
- 로컬 서버이므로 외부 접근 불가

---

## Option 3: EC2 프로덕션 배포

**스크립트**: `deploy-to-ec2.sh`

### 개요

AWS EC2에서 Salt Server를 실행하여 외부에서 접근 가능하게 만듭니다.
- **서버 실행**: AWS EC2 인스턴스
- **Seed 저장소**: AWS Secrets Manager
- **외부 접근**: ALB를 통해 가능
- **비용**: ~$145/월

### 전제 조건

1. **Terraform으로 인프라 배포**:

```bash
cd deploy/aws-nitro/terraform

# Terraform 초기화
terraform init

# 변수 설정
cp terraform.tfvars.example terraform.tfvars
# terraform.tfvars 편집

# 인프라 배포
terraform apply

# Outputs 확인:
# - ec2_instance_id: i-XXXXXXXXXX
# - alb_dns_name: zklogin-prod-alb-XXXXXXXXXX.elb.amazonaws.com
# - salt_server_url: http://...
```

2. **AWS Secrets Manager에 Seed 저장**:

```bash
# Master Seed 생성
npm run generate-seed

# Secrets Manager에 저장
aws secretsmanager create-secret \
  --name zklogin/prod-seed \
  --description "zkLogin Salt Server Production Master Seed" \
  --secret-string '{"masterSeed":"YOUR_SEED_HERE"}' \
  --region ap-northeast-2
```

### 배포 방법

```bash
cd guides/standalone/03-aws-secrets

# EC2에 배포
./deploy-to-ec2.sh
```

### 동작 과정

1. **EC2 상태 확인**: 인스턴스가 실행 중인지 확인
2. **로컬 빌드**: TypeScript 컴파일 (`npm run build`)
3. **패키징**: dist/, package.json 등을 tar.gz로 압축
4. **S3 업로드**: 임시 S3 버킷에 패키지 업로드
5. **EC2 배포**:
   - S3에서 패키지 다운로드
   - npm 의존성 설치
   - Config 파일 생성 (`config/production.yaml`)
   - systemd 서비스 등록
   - 서비스 시작
6. **정리**: 임시 S3 버킷 삭제

### 배포 후 확인

```bash
# ALB URL (Terraform output에서 확인)
ALB_URL="http://zklogin-prod-alb-XXXXXXXXXX.ap-northeast-2.elb.amazonaws.com"

# Health check
curl $ALB_URL/health

# Ready check
curl $ALB_URL/ready

# Salt API 테스트
curl -X POST $ALB_URL/v1/salt \
  -H 'Content-Type: application/json' \
  -d '{"jwt": "YOUR_GOOGLE_JWT_HERE"}'
```

### 서비스 관리

**EC2 접속**:
```bash
aws ssm start-session --target i-XXXXXXXXXX --region ap-northeast-2
```

**로그 확인**:
```bash
sudo journalctl -u salt-server -f
```

**서비스 상태**:
```bash
sudo systemctl status salt-server
```

**서비스 재시작**:
```bash
sudo systemctl restart salt-server
```

**재배포** (코드 변경 후):
```bash
./deploy-to-ec2.sh
```

### 장단점

✅ **장점**:
- **외부 접근 가능** (ALB를 통해)
- AWS Secrets Manager 사용
- Auto Scaling 지원 (설정 필요)
- CloudWatch 로그 통합
- IAM 역할 기반 권한
- VPC 내부 격리
- Security Group으로 네트워크 제어
- systemd로 자동 재시작

❌ **단점**:
- 인프라 관리 필요
- AWS 비용 발생 (~$145/월)
  - EC2 c5.xlarge: ~$122/월
  - ALB: ~$22/월
  - Secrets Manager: ~$0.50/월
  - CloudWatch Logs: ~$0.50/월

---

## 비교표

### 실행 위치

| 항목 | run-dev.sh | run-dev-aws.sh | deploy-to-ec2.sh |
|------|-----------|----------------|------------------|
| **서버 위치** | 로컬 PC | 로컬 PC | AWS EC2 |
| **접근 URL** | localhost:3000 | localhost:3000 | ALB URL |
| **외부 접근** | ❌ | ❌ | ✅ |
| **서비스 관리** | 터미널 | 터미널 | systemd |

### Seed 저장소

| 항목 | run-dev.sh | run-dev-aws.sh | deploy-to-ec2.sh |
|------|-----------|----------------|------------------|
| **저장소** | LocalStack | AWS Secrets Manager | AWS Secrets Manager |
| **암호화** | 없음 | AWS KMS | AWS KMS |
| **접근 제어** | 없음 | IAM 정책 | IAM 역할 |
| **감사 로그** | 없음 | CloudTrail | CloudTrail |

### 비용

| 항목 | run-dev.sh | run-dev-aws.sh | deploy-to-ec2.sh |
|------|-----------|----------------|------------------|
| **월 비용** | 무료 | ~$0.50 | ~$145 |
| **Secrets Manager** | - | $0.40/월 | $0.40/월 |
| **EC2** | - | - | ~$122/월 |
| **ALB** | - | - | ~$22/월 |

### 권장 용도

| 항목 | run-dev.sh | run-dev-aws.sh | deploy-to-ec2.sh |
|------|-----------|----------------|------------------|
| **개발** | ✅ 최적 | ⚠️ 가능 | ❌ 비권장 |
| **테스트** | ✅ 적합 | ✅ 권장 | ⚠️ 가능 |
| **프로덕션** | ❌ 불가 | ❌ 불가 | ✅ 권장 |

---

## 실제 JWT 발급 방법

Salt API는 실제 OAuth provider (Google, Facebook 등)의 JWT만 허용합니다.

### Google OAuth Playground 사용

1. **접속**: https://developers.google.com/oauthplayground/

2. **Step 1: Select & authorize APIs**
   - Scope 입력:
     - `openid`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
   - "Authorize APIs" 클릭

3. **Step 2: Google 로그인**
   - Google 계정으로 로그인
   - 권한 허용

4. **Step 3: Exchange authorization code for tokens**
   - "Exchange authorization code for tokens" 클릭
   - **id_token** 값을 복사 (⚠️ access_token이 아님!)

5. **Salt API 호출**:

```bash
# 로컬 개발 (run-dev.sh 또는 run-dev-aws.sh)
curl -X POST http://localhost:3000/v1/salt \
  -H 'Content-Type: application/json' \
  -d '{"jwt": "eyJhbGciOiJSUzI1NiIs..."}'

# EC2 프로덕션 (deploy-to-ec2.sh)
curl -X POST http://zklogin-prod-alb-XXXXXXXXXX.elb.amazonaws.com/v1/salt \
  -H 'Content-Type: application/json' \
  -d '{"jwt": "eyJhbGciOiJSUzI1NiIs..."}'
```

### 응답 예시

**성공**:
```json
{
  "salt": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
}
```

**실패**:
```json
{
  "error": "invalid_jwt",
  "message": "JWT signature verification failed"
}
```

---

## 트러블슈팅

### LocalStack 연결 실패 (run-dev.sh)

```bash
# Docker 상태 확인
docker ps | grep localstack

# LocalStack 로그 확인
cd guides/standalone/03-aws-secrets
docker-compose logs

# Health check
curl http://localhost:4566/_localstack/health

# 재시작
docker-compose restart

# 완전 재시작
docker-compose down -v
./run-dev.sh
```

### AWS 자격 증명 실패 (run-dev-aws.sh)

```bash
# 자격 증명 확인
aws sts get-caller-identity

# 자격 증명 재설정
aws configure

# 환경변수 확인
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY
echo $AWS_DEFAULT_REGION
```

### Secret이 없음 (run-dev-aws.sh)

```bash
# Secret 확인
aws secretsmanager describe-secret \
  --secret-id zklogin/prod-seed \
  --region ap-northeast-2

# Secret 생성
aws secretsmanager create-secret \
  --name zklogin/prod-seed \
  --secret-string '{"masterSeed":"YOUR_SEED_HERE"}' \
  --region ap-northeast-2
```

### EC2 배포 실패 (deploy-to-ec2.sh)

```bash
# EC2 상태 확인
aws ec2 describe-instances \
  --instance-ids i-XXXXXXXXXX \
  --region ap-northeast-2 \
  --query 'Reservations[0].Instances[0].State.Name'

# EC2 로그 확인
aws ssm start-session --target i-XXXXXXXXXX --region ap-northeast-2
sudo journalctl -u salt-server -n 100

# 재배포
./deploy-to-ec2.sh
```

### 502 Bad Gateway (deploy-to-ec2.sh)

ALB에서 502 에러가 발생하면:

```bash
# 1. EC2 서비스 상태 확인
aws ssm send-command \
    --instance-ids i-XXXXXXXXXX \
    --region ap-northeast-2 \
    --document-name "AWS-RunShellScript" \
    --parameters 'commands=["sudo systemctl status salt-server"]'

# 2. 로그 확인
aws ssm start-session --target i-XXXXXXXXXX --region ap-northeast-2
sudo journalctl -u salt-server -n 50

# 3. 재시작
sudo systemctl restart salt-server

# 4. 로컬 health check
curl http://localhost:3000/health
```

---

## 비용 안내

### LocalStack (run-dev.sh)
- **비용**: 무료
- **권장**: 로컬 개발

### 실제 AWS 로컬 서버 (run-dev-aws.sh)
- **Secrets Manager**: $0.40/월
- **API 호출**: $0.05 per 10,000 requests
- **예상 총 비용**: ~$0.50/월
- **권장**: AWS 통합 테스트

### EC2 프로덕션 (deploy-to-ec2.sh)
- **EC2 c5.xlarge**: ~$122/월 (24시간 실행)
- **ALB**: ~$22/월 + 데이터 전송
- **Secrets Manager**: $0.40/월
- **CloudWatch Logs**: ~$0.50/월
- **예상 총 비용**: ~$145/월
- **권장**: 프로덕션 서비스

**비용 절감 팁**:
- **Savings Plans**: 최대 72% 할인
- **Reserved Instances**: 최대 75% 할인
- **Spot Instances**: 최대 90% 할인 (개발/테스트 환경)
- **Auto Scaling**: 트래픽에 따라 자동 확장/축소

---

## 보안 권장사항

### LocalStack (개발 전용)
- ⚠️ 프로덕션 사용 금지
- ⚠️ 실제 seed 사용 금지

### 실제 AWS

**IAM 정책**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:ap-northeast-2:*:secret:zklogin/prod-seed-*"
    }
  ]
}
```

**CloudTrail 활성화**:
```bash
aws cloudtrail create-trail \
  --name zklogin-audit \
  --s3-bucket-name zklogin-audit-logs
```

**VPC Endpoint** (프라이빗 네트워크):
```bash
aws ec2 create-vpc-endpoint \
  --vpc-id vpc-XXXXXXXXXX \
  --service-name com.amazonaws.ap-northeast-2.secretsmanager \
  --route-table-ids rtb-XXXXXXXXXX
```

**Secret 로테이션**:
```bash
aws secretsmanager rotate-secret \
  --secret-id zklogin/prod-seed \
  --rotation-lambda-arn arn:aws:lambda:... \
  --rotation-rules AutomaticallyAfterDays=90
```

---

## 다음 단계

1. **로컬 개발**: `run-dev.sh`로 시작
2. **AWS 통합 테스트**: `run-dev-aws.sh`로 실제 AWS 연결 테스트
3. **프로덕션 배포**: Terraform + `deploy-to-ec2.sh`로 EC2 배포
4. **모니터링 설정**: CloudWatch Alarms, Dashboards 설정
5. **보안 강화**: WAF, Secret Rotation, VPC Endpoint 설정

---

## 참고 자료

- [LocalProvider 구현](../../../src/providers/local.provider.ts)
- [AWS Secrets Manager 문서](https://docs.aws.amazon.com/secretsmanager/)
- [LocalStack 문서](https://docs.localstack.cloud/)
- [AWS Systems Manager Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [04-vault](../04-vault/): HashiCorp Vault 테스트
- [05-nitro](../05-nitro/): AWS Nitro Enclaves 문서
