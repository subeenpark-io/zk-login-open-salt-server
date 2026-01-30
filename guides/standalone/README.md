# Standalone 모드 테스트 케이스

이 디렉토리는 Standalone 모드의 각 시드 저장 방식을 테스트할 수 있는 예제를 제공합니다.

## 저장 방식 비교

| 방식 | 보안 수준 | 로컬 테스트 | 설정 난이도 | 프로덕션 권장 | 비용 |
|------|----------|------------|-------------|--------------|------|
| [01-env](./01-env/) | ⭐ | ✅ | 쉬움 | ❌ | 무료 |
| [02-file](./02-file/) | ⭐⭐ | ✅ | 쉬움 | ⚠️ | 무료 |
| [03-aws-secrets](./03-aws-secrets/) | ⭐⭐⭐ | ✅ (LocalStack) | 보통 | ✅ | ~$0.50/월 |
| [04-vault](./04-vault/) | ⭐⭐⭐ | ✅ (Docker) | 보통 | ✅ | Open Source |
| [05-nitro](./05-nitro/) | ⭐⭐⭐⭐⭐ | ❌ (EC2 필요) | 어려움 | ✅✅ | ~$140/월 |

## 빠른 시작

### 1. 환경변수 방식 (가장 간단)

```bash
cd 01-env
cp .env.example .env
chmod +x test.sh
./test.sh
```

**결과**:
- ✅ Health check 통과
- ✅ Ready check 통과
- ℹ️ Salt API는 TEST_JWT 필요

### 2. 파일 방식

```bash
cd 02-file
chmod +x test.sh
./test.sh
```

**특징**:
- 자동으로 seed.json 생성
- 파일 권한 600으로 설정
- 테스트 후 자동 삭제

### 3. AWS Secrets Manager (LocalStack)

```bash
cd 03-aws-secrets
chmod +x test.sh setup-localstack.sh
./test.sh
```

**필요한 도구**:
- Docker & Docker Compose
- AWS CLI v2
- jq

### 4. HashiCorp Vault

```bash
cd 04-vault
chmod +x test.sh setup-vault.sh
./test.sh
```

**필요한 도구**:
- Docker & Docker Compose

### 5. AWS Nitro Enclaves

실제 EC2 인스턴스가 필요합니다. [05-nitro/README.md](./05-nitro/README.md)를 참조하세요.

## 전제 조건

### 필수
- Node.js 22.5.0+
- npm 10.8.2+

### 예제별 추가 요구사항
- **01-env, 02-file**: 추가 없음
- **03-aws-secrets**: Docker, AWS CLI, jq
- **04-vault**: Docker
- **05-nitro**: AWS 계정, Terraform

## 공통 테스트 플로우

모든 테스트는 다음 순서로 진행됩니다:

```
1. Setup
   ├─ 시드 생성/로드
   └─ 환경변수 설정

2. Server Start
   └─ npm run dev (백그라운드)

3. Health Checks
   ├─ GET /health (200 OK)
   └─ GET /ready (provider healthy)

4. Salt API Test (선택)
   └─ POST /v1/salt (TEST_JWT 필요)

5. Cleanup
   ├─ 서버 종료
   └─ 리소스 정리
```

## 테스트 결과 예시

```bash
$ cd 01-env && ./test.sh

======================================
  01-env: 환경변수 방식 테스트
======================================

🚀 서버 시작 중...
⏳ 서버 준비 대기 중...
🔍 Health check 중...
✅ 서버가 정상 작동 중입니다
🔍 Ready 엔드포인트 확인 중...
✅ Ready check 통과
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "providers": {
    "local": {
      "healthy": true,
      "message": "Provider is healthy"
    }
  }
}
ℹ️  TEST_JWT 환경변수가 설정되지 않았습니다
   Salt API 테스트를 건너뜁니다

💡 Salt API를 테스트하려면:
   1. Google OAuth Playground에서 JWT 발급
      https://developers.google.com/oauthplayground/
   2. export TEST_JWT="your-jwt-here"
   3. 테스트 재실행

======================================
✅ 모든 테스트 통과!
======================================
```

## JWT로 전체 테스트

### 1. Google OAuth JWT 발급

1. [Google OAuth Playground](https://developers.google.com/oauthplayground/) 접속
2. Scopes 선택:
   - `openid`
   - `email`
   - `profile`
3. "Authorize APIs" 클릭
4. "Exchange authorization code for tokens" 클릭
5. `id_token` 값 복사

### 2. 환경변수 설정 및 테스트

```bash
# JWT 설정
export TEST_JWT="eyJhbGciOiJSUzI1NiIs..."

# 테스트 실행
cd 01-env
./test.sh
```

### 3. 전체 테스트 결과

```bash
🧪 Salt API 테스트 중...
✅ Salt 생성 성공
   Salt: 0x7a8b9c1d2e3f4a5b...1f2a3b4c5d6e7f8a9b
✅ Salt 형식이 올바릅니다 (0x + 64 hex chars)
```

## 문제 해결

### 서버가 시작되지 않음
```bash
# 의존성 설치 확인
npm install

# 빌드 실행 (또는 npm run dev 사용)
npm run build

# 포트 확인
lsof -i :3000

# 강제 종료
pkill -f "node.*dev"
```

### LocalStack 연결 실패
```bash
# Docker 상태 확인
docker ps | grep localstack

# LocalStack 로그 확인
cd 03-aws-secrets
docker-compose logs localstack

# 재시작
docker-compose restart

# 완전 정리 후 재시작
docker-compose down -v
docker-compose up -d
```

### Vault 연결 실패
```bash
# Docker 상태 확인
docker ps | grep vault

# Vault 로그 확인
cd 04-vault
docker-compose logs vault

# 토큰 확인
echo $VAULT_TOKEN

# 수동 테스트
curl http://localhost:8200/v1/sys/health
```

### JWT 검증 실패
```bash
# JWT 디코딩 (jwt.io에서)
# 확인할 것:
# - iss: https://accounts.google.com
# - sub: 사용자 ID
# - aud: 클라이언트 ID
# - exp: 만료 시간 (미래)

# JWT 갱신
# OAuth Playground에서 새로 발급
```

### Permission denied 에러
```bash
# 스크립트 실행 권한 부여
chmod +x guides/shared/*.sh
chmod +x guides/standalone/*/test.sh
chmod +x guides/standalone/*/setup-*.sh
```

## 프로덕션 체크리스트

### ❌ 절대 하지 말 것
- [ ] 환경변수로 프로덕션 seed 저장
- [ ] seed를 Git에 커밋
- [ ] 테스트 seed를 프로덕션에 사용
- [ ] seed를 로그에 출력
- [ ] HTTP (HTTPS 필수)
- [ ] 기본 CORS 설정 (`*`)
- [ ] Rate limiting 비활성화

### ✅ 반드시 할 것
- [ ] AWS Secrets Manager 또는 Vault 사용
- [ ] IAM/ACL로 접근 제어
- [ ] 감사 로그 활성화
- [ ] TLS/HTTPS 사용
- [ ] Seed 백업 및 복구 계획
- [ ] Shamir's Secret Sharing 사용 (선택)
- [ ] 모니터링 및 알람 설정
- [ ] 정기적인 보안 감사

### ✅ 프로덕션 권장 방식

| 요구사항 | 권장 방식 |
|---------|----------|
| 일반 웹앱 | AWS Secrets Manager |
| Enterprise | HashiCorp Vault |
| 최고 보안 | AWS Nitro Enclaves |
| 컨테이너 | Kubernetes Secrets + External Secrets Operator |
| Multi-cloud | HashiCorp Vault |

## 성능 비교

| 방식 | 시작 시간 | Salt API 레이턴시 | 메모리 사용 |
|------|----------|------------------|------------|
| 환경변수 | ~2초 | ~5ms | ~50MB |
| 파일 | ~2초 | ~5ms | ~50MB |
| AWS Secrets | ~3초 | ~6ms | ~60MB |
| Vault | ~3초 | ~6ms | ~60MB |
| Nitro Enclaves | ~10초 | ~8ms | ~80MB |

*로컬 개발 환경 기준, 실제 환경에서는 다를 수 있음*

## 다음 단계

### 1. 프로덕션 배포
- [메인 README](../../README.md#배포-가이드) 참조
- [Kubernetes 배포](../../deploy/kubernetes/)
- [AWS ECS 배포](../../deploy/aws-ecs/)
- [AWS Nitro 배포](../../deploy/aws-nitro/)

### 2. 다른 모드 테스트
- **Proxy 모드**: 외부 Salt Server 프록시
- **Hybrid 모드**: Primary + Fallback
- **Router 모드**: 멀티테넌트 라우팅

### 3. SDK 통합
- [Express 통합](../../sdk/integrations/express.ts)
- [Fastify 통합](../../sdk/integrations/fastify.ts)
- [Hono 통합](../../sdk/integrations/hono.ts)

### 4. 모니터링 설정
- CloudWatch / Prometheus
- 알람 설정
- 로그 집계

## 참고 자료

### 코드
- [LocalProvider 구현](../../src/providers/local.provider.ts)
- [Config 타입 정의](../../src/types/index.ts)
- [JWT 서비스](../../src/services/jwt.service.ts)

### 문서
- [Sui zkLogin](https://docs.sui.io/concepts/cryptography/zklogin)
- [HKDF (RFC 5869)](https://tools.ietf.org/html/rfc5869)
- [LocalStack](https://docs.localstack.cloud/)
- [HashiCorp Vault](https://developer.hashicorp.com/vault/docs)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [AWS Nitro Enclaves](https://docs.aws.amazon.com/enclaves/latest/user/)

## 기여

버그 리포트 및 기능 제안은 [GitHub Issues](https://github.com/subeenpark-io/zk-login-open-salt-server/issues)에서 환영합니다.

## 라이선스

Apache-2.0
