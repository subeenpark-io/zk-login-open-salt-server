# 01-env: 환경변수 방식

가장 간단한 방식으로 환경변수 `MASTER_SEED`에서 시드를 로드합니다.

## 보안 수준
⭐ (개발/테스트 전용)

## 전제 조건
- Node.js 22.5.0+
- npm 10.8.2+

## 사용법

### 1. 환경 설정
```bash
cp .env.example .env
```

### 2. 시드 생성 (또는 기존 시드 사용)
```bash
cd ../../..  # 프로젝트 루트로 이동
npm run generate-seed
# 출력된 시드를 guides/standalone/01-env/.env에 복사
```

### 3. 테스트 실행
```bash
cd guides/standalone/01-env
chmod +x test.sh
./test.sh
```

## 동작 방식

1. `.env` 파일에서 `MASTER_SEED` 로드
2. Salt Server가 시드를 메모리에 로드
3. JWT 요청마다 HKDF로 salt 계산

## 테스트 결과 예시

```bash
$ ./test.sh

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
    왼쪽 API 목록에서 "Google OAuth2 API v2"를 찾아서 클릭
    다음 스코프들을 체크:
    ✅ https://www.googleapis.com/auth/userinfo.email
    ✅ https://www.googleapis.com/auth/userinfo.profile
    ✅ openid
    또는 더 간단하게:

    왼쪽 검색창에 "openid"를 입력하면 관련 스코프들이 나옵니다
    Step 2: Authorize APIs
    오른쪽 상단의 "Authorize APIs" 버튼 클릭
    Google 계정 선택 및 로그인
    권한 승인
    Step 3: Exchange authorization code for tokens
    Authorization code를 받으면 자동으로 "Step 2"로 이동합니다
    "Exchange authorization code for tokens" 버튼 클릭
    Step 4: JWT 토큰 복사
    Response에서 id_token 값을 찾습니다 (매우 긴 문자열)
    id_token 값 전체를 복사합니다 (eyJ로 시작)
    Step 5: 테스트 실행

    export TEST_JWT="여기에-복사한-id_token-붙여넣기"
    ./test.sh

   1. Google OAuth Playground에서 JWT 발급
      https://developers.google.com/oauthplayground/
   2. export TEST_JWT="your-jwt-here"
   3. 테스트 재실행

======================================
✅ 모든 테스트 통과!
======================================
```

## JWT로 전체 테스트

```bash
# 1. Google OAuth Playground에서 JWT 발급
# https://developers.google.com/oauthplayground/

# 2. JWT를 환경변수로 설정
export TEST_JWT="eyJhbGciOiJSUzI1NiIs..."

# 3. 테스트 실행
./test.sh
```

## 주의사항

⚠️ **프로덕션에서 절대 사용하지 마세요!**
- 환경변수는 프로세스 덤프로 노출될 수 있습니다
- 로그에 실수로 기록될 수 있습니다
- AWS Secrets Manager 또는 Vault 사용 권장

## 다음 단계

- [02-file](../02-file/): 파일 방식 테스트
- [03-aws-secrets](../03-aws-secrets/): AWS Secrets Manager 테스트
- [04-vault](../04-vault/): HashiCorp Vault 테스트
