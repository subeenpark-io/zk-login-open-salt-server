# 03-aws-secrets: AWS Secrets Manager

AWS Secrets Manager를 사용하여 시드를 안전하게 저장합니다.

## 보안 수준
⭐⭐⭐ (프로덕션 권장)

## 전제 조건
- AWS CLI v2
- jq (JSON 파싱)
- Docker & Docker Compose (LocalStack 사용 시)

```bash
# macOS
brew install awscli jq

# Ubuntu/Debian
apt-get install awscli jq

# AWS CLI 버전 확인
aws --version  # AWS CLI 2.x 권장
```

## 사용법

### Option 1: LocalStack (로컬 테스트)

#### 기본 테스트 (Salt API 제외)
```bash
cd guides/standalone/03-aws-secrets
chmod +x test.sh setup-localstack.sh
./test.sh
```

#### Salt API까지 테스트하기
```bash
# 1. .env 파일 생성
cp .env.example .env

# 2. Google OAuth Playground에서 JWT 발급 (id_token 복사)
#    https://developers.google.com/oauthplayground/

# 3. .env 파일에 JWT 추가
echo 'TEST_JWT=여기에-복사한-id_token-붙여넣기' >> .env

# 4. 테스트 실행
./test.sh
```

### Option 2: 실제 AWS (프로덕션/테스트)

#### 기본 테스트 (Salt API 제외)
```bash
cd guides/standalone/03-aws-secrets
chmod +x test-aws.sh setup-aws.sh

# AWS 자격 증명 설정
aws configure

# 시드 생성 및 업로드
./setup-aws.sh

# 테스트 실행
./test-aws.sh
```

#### Salt API까지 테스트하기
```bash
# .env 파일에 TEST_JWT 추가 후 실행
cp .env.example .env
echo 'TEST_JWT=여기에-JWT-붙여넣기' >> .env
./test-aws.sh
```

## 동작 방식

1. LocalStack에서 Secrets Manager 서비스 시작
2. 시드를 Secrets Manager에 업로드
3. Salt Server가 AWS SDK로 시드 다운로드
4. 메모리에 시드 로드 후 salt 계산

## LocalStack 설정

LocalStack은 AWS 서비스를 로컬에서 에뮬레이션합니다:
- Endpoint: `http://localhost:4566`
- Region: `us-east-1`
- Credentials: `test` / `test` (무시됨)

## 실제 AWS 사용 가이드

### 1. AWS 자격 증명 설정

```bash
# AWS CLI 설정
aws configure
# AWS Access Key ID: AKIA...
# AWS Secret Access Key: ...
# Default region name: us-west-2
# Default output format: json

# 또는 환경변수로 설정
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=us-west-2
```

### 2. IAM 사용자 생성 (처음 1회)

```bash
# IAM 사용자 생성
aws iam create-user --user-name zklogin-salt-server

# 정책 문서 생성 (secrets-policy.json)
cat > secrets-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:zklogin/*"
    }
  ]
}
EOF

# 정책 생성
aws iam create-policy \
  --policy-name zklogin-secrets-readonly \
  --policy-document file://secrets-policy.json

# 정책 연결 (ACCOUNT_ID를 실제 계정 ID로 변경)
aws iam attach-user-policy \
  --user-name zklogin-salt-server \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/zklogin-secrets-readonly

# Access Key 생성
aws iam create-access-key --user-name zklogin-salt-server
```

### 3. 시드 생성 및 업로드

```bash
# setup-aws.sh 실행
./setup-aws.sh

# 수동으로 하려면:
# 1. 시드 생성
cd ../../..
SEED=$(npm run generate-seed --silent | grep "^0x")

# 2. Secrets Manager에 저장
aws secretsmanager create-secret \
  --name zklogin/production-seed \
  --secret-string "{\"masterSeed\": \"$SEED\"}" \
  --description "zkLogin Salt Server master seed" \
  --region us-west-2

# 3. 태그 추가
aws secretsmanager tag-resource \
  --secret-id zklogin/production-seed \
  --tags Key=Environment,Value=production Key=Application,Value=zklogin \
  --region us-west-2
```

### 4. 테스트 실행

```bash
# test-aws.sh 실행
./test-aws.sh
```

### 5. config-aws.yaml

실제 AWS용 설정 파일:
```yaml
server:
  port: 3000

logging:
  level: info
  format: json

security:
  corsOrigins: "https://your-app.com"
  rateLimitMax: 100

provider:
  type: local
  seed:
    type: aws
    secretName: zklogin/production-seed
    region: us-west-2
    secretKey: masterSeed
```

### IAM 정책

최소 권한 원칙:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-west-2:123456789012:secret:zklogin/production-seed-*"
    }
  ]
}
```

### 시크릿 생성

```bash
# AWS CLI로 시크릿 생성
aws secretsmanager create-secret \
  --name zklogin/production-seed \
  --secret-string '{"masterSeed":"0x1234..."}' \
  --description "zkLogin Salt Server master seed" \
  --region us-west-2

# 태그 추가
aws secretsmanager tag-resource \
  --secret-id zklogin/production-seed \
  --tags Key=Environment,Value=production Key=Application,Value=zklogin \
  --region us-west-2
```

### 자동 로테이션

```bash
# Lambda를 사용한 자동 로테이션 설정
aws secretsmanager rotate-secret \
  --secret-id zklogin/production-seed \
  --rotation-lambda-arn arn:aws:lambda:us-west-2:123456789012:function:SecretsManagerRotation \
  --rotation-rules AutomaticallyAfterDays=90 \
  --region us-west-2
```

## 비용

AWS Secrets Manager 비용 (2024 기준):
- **저장**: $0.40/월 per secret
- **API 호출**: $0.05 per 10,000 API calls
- **예상 월 비용**: ~$0.50 (Salt Server 1대 기준)

## 문제 해결

### LocalStack 연결 실패
```bash
# Docker 상태 확인
docker ps | grep localstack

# LocalStack 로그 확인
docker-compose logs localstack

# Health check
curl http://localhost:4566/_localstack/health
```

### 실제 AWS 연결 실패

#### 1. 자격 증명 오류
```bash
# 현재 자격 증명 확인
aws sts get-caller-identity

# 환경변수 확인
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY
echo $AWS_DEFAULT_REGION

# 재설정
aws configure
```

#### 2. 권한 부족 오류
```bash
# IAM 정책 확인
aws iam list-attached-user-policies --user-name zklogin-salt-server

# 정책 내용 확인
aws iam get-policy-version \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/zklogin-secrets-readonly \
  --version-id v1
```

필요한 권한:
- `secretsmanager:GetSecretValue`
- `secretsmanager:DescribeSecret`

#### 3. Secret이 존재하지 않음
```bash
# 모든 시크릿 목록
aws secretsmanager list-secrets --region us-west-2

# 특정 시크릿 확인
aws secretsmanager describe-secret \
  --secret-id zklogin/production-seed \
  --region us-west-2
```

#### 4. Region 불일치
```bash
# config-aws.yaml과 실제 Secret의 region이 일치하는지 확인
grep "region:" config-aws.yaml

# Secret이 저장된 region 확인
aws secretsmanager list-secrets --region us-west-2 | \
  jq '.SecretList[] | select(.Name == "zklogin/production-seed")'
```

### Secret 값 확인

#### LocalStack
```bash
aws --endpoint-url=http://localhost:4566 \
    --region=us-east-1 \
    secretsmanager get-secret-value \
    --secret-id zklogin/test-seed \
    --query SecretString \
    --output text | jq .
```

#### 실제 AWS
```bash
aws secretsmanager get-secret-value \
    --secret-id zklogin/production-seed \
    --region us-west-2 \
    --query SecretString \
    --output text | jq .
```

## 보안 장점

✅ **중앙 집중식 관리**
- IAM 정책으로 접근 제어
- CloudTrail로 감사 로그
- 자동 로테이션 지원
- 다중 리전 복제 가능

✅ **암호화**
- AWS KMS로 자동 암호화
- 전송 중 TLS 암호화
- 저장 시 암호화 (encryption at rest)

✅ **가용성**
- AWS 관리형 서비스 (99.99% SLA)
- 자동 백업
- 버전 관리

## 실제 사용 예시

### 개발 환경
```bash
# setup-aws.sh로 테스트 시크릿 생성
./setup-aws.sh
# Region: us-west-2
# Secret Name: zklogin/dev-seed

# 테스트
./test-aws.sh
```

### 프로덕션 환경
```bash
# 프로덕션 시크릿 생성
aws secretsmanager create-secret \
  --name zklogin/production-seed \
  --secret-string '{"masterSeed":"0x..."}' \
  --region us-west-2

# config.yaml 업데이트
# secretName: zklogin/production-seed

# 배포 (ECS/EKS)
# IAM Role을 사용하여 자격 증명 자동 관리
```

## 프로덕션 체크리스트

### ✅ 보안
- [ ] IAM 사용자에 최소 권한 부여
- [ ] CloudTrail 활성화 (감사 로그)
- [ ] VPC Endpoint 사용 (프라이빗 네트워크)
- [ ] KMS 커스텀 키 사용
- [ ] Secret 로테이션 설정

### ✅ 고가용성
- [ ] Multi-AZ 배포
- [ ] 다중 리전 복제 (DR)
- [ ] Health check 설정

### ✅ 모니터링
- [ ] CloudWatch 알람 설정
- [ ] Secret 접근 로그 모니터링
- [ ] 비용 알람 설정

## 다음 단계

- [04-vault](../04-vault/): HashiCorp Vault 테스트
- [05-nitro](../05-nitro/): AWS Nitro Enclaves 문서
- [프로덕션 배포](../../../README.md#배포-가이드)
