# 02-file: 파일 방식

파일 시스템에서 시드를 로드합니다.

## 보안 수준
⭐⭐ (파일 권한 관리 필요)

## 전제 조건
- Node.js 22.5.0+
- npm 10.8.2+

## 사용법

### 기본 테스트 (Salt API 제외)

```bash
cd guides/standalone/02-file
chmod +x test.sh
./test.sh
```

테스트 스크립트가 자동으로 `seed.json` 파일을 생성하고 테스트를 실행합니다.

### Salt API까지 테스트하기

```bash
# 1. .env 파일 생성
cp .env.example .env

# 2. Google OAuth Playground에서 JWT 발급
#    https://developers.google.com/oauthplayground/
#    - "Google OAuth2 API v2" 선택
#    - openid, email, profile 스코프 선택
#    - "Authorize APIs" 클릭
#    - "Exchange code for tokens" 클릭
#    - id_token 값 복사

# 3. .env 파일에 JWT 추가
echo 'TEST_JWT=여기에-복사한-id_token-붙여넣기' >> .env

# 4. 테스트 실행
./test.sh
```

## 동작 방식

1. `seed.json` 파일 읽기
2. JSON 파싱 및 `masterSeed` 키 추출
3. Salt Server가 시드를 메모리에 로드
4. JWT 요청마다 HKDF로 salt 계산

## seed.json 형식

```json
{
  "masterSeed": "0x1234567890abcdef...",
  "createdAt": "2024-01-01T00:00:00Z",
  "description": "Test seed for local development",
  "version": "1.0"
}
```

## 수동으로 seed.json 생성

```bash
# 1. 시드 생성
cd ../../..  # 프로젝트 루트로 이동
SEED=$(npm run generate-seed --silent)

# 2. seed.json 생성
cat > guides/standalone/02-file/seed.json <<EOF
{
  "masterSeed": "$SEED",
  "createdAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "description": "Test seed for local development",
  "version": "1.0"
}
EOF

# 3. 파일 권한 설정
chmod 600 guides/standalone/02-file/seed.json
```

## 보안 권장사항

### 파일 권한 제한
```bash
# 소유자만 읽기/쓰기 가능
chmod 600 seed.json
chown $USER:$USER seed.json
```

### Git에서 제외
```bash
# .gitignore에 추가
echo "guides/standalone/02-file/seed.json" >> .gitignore
```

### 백업 시 암호화
```bash
# GPG로 암호화
gpg -c seed.json  # seed.json.gpg 생성

# 복호화
gpg seed.json.gpg
```

## 주의사항

⚠️ **프로덕션에서 주의해서 사용하세요**
- 파일 시스템 접근 권한 엄격히 관리
- 백업 시 암호화 필수
- Git에 절대 커밋하지 말 것 (`.gitignore` 추가)
- 파일 시스템이 암호화되어 있는지 확인

✅ **프로덕션 권장사항**
- Docker secrets 사용
- Kubernetes secrets 사용
- 파일 시스템 레벨 암호화 (LUKS, dm-crypt)

## 다음 단계

- [03-aws-secrets](../03-aws-secrets/): AWS Secrets Manager 테스트
- [04-vault](../04-vault/): HashiCorp Vault 테스트
- [05-nitro](../05-nitro/): AWS Nitro Enclaves 문서
