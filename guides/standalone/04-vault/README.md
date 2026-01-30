# 04-vault: HashiCorp Vault

HashiCorp Vault를 사용하여 시드를 안전하게 저장합니다.

## 보안 수준
⭐⭐⭐ (Enterprise 권장)

## 전제 조건
- Docker & Docker Compose
- Vault CLI (선택)

```bash
# macOS
brew install vault

# Ubuntu/Debian
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install vault
```

## 사용법

```bash
cd guides/standalone/04-vault
chmod +x test.sh setup-vault.sh
./test.sh
```

## 동작 방식

1. Vault를 Dev 모드로 시작
2. 시드를 KV v2 secret에 저장
3. Salt Server가 Vault API로 시드 다운로드
4. 메모리에 시드 로드 후 salt 계산

## Vault 설정

Dev 모드 설정:
- Address: `http://localhost:8200`
- Root Token: `root-token`
- KV v2 engine enabled by default

## 프로덕션 사용

실제 Vault 사용 시:

### config.yaml
```yaml
provider:
  type: local
  seed:
    type: vault
    address: "https://vault.example.com"
    path: "secret/data/zklogin/seed"
    key: masterSeed
    tokenEnvVar: VAULT_TOKEN
```

### 환경변수
```bash
export VAULT_TOKEN=s.xxxxxxxxxxxxx
# 또는 Vault Agent 사용
```

### Vault 초기화 및 Unsealing

```bash
# 1. Vault 초기화
vault operator init -key-shares=5 -key-threshold=3

# 2. Unseal (3개의 키 필요)
vault operator unseal <key1>
vault operator unseal <key2>
vault operator unseal <key3>

# 3. Root token으로 로그인
vault login <root-token>
```

### KV v2 Engine 활성화

```bash
# KV v2 engine 활성화
vault secrets enable -version=2 -path=secret kv

# Seed 저장
vault kv put secret/zklogin/seed \
  masterSeed="0x1234..." \
  createdAt="$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  description="Production master seed"

# Seed 조회
vault kv get secret/zklogin/seed
```

### ACL 정책

최소 권한 정책:
```hcl
# salt-server-policy.hcl
path "secret/data/zklogin/seed" {
  capabilities = ["read"]
}
```

```bash
# 정책 생성
vault policy write salt-server salt-server-policy.hcl

# AppRole 생성
vault auth enable approle
vault write auth/approle/role/salt-server \
  token_policies="salt-server" \
  token_ttl=1h \
  token_max_ttl=4h

# Role ID 및 Secret ID 발급
vault read auth/approle/role/salt-server/role-id
vault write -f auth/approle/role/salt-server/secret-id
```

### HA 구성 (Raft)

```hcl
# vault.hcl
storage "raft" {
  path    = "/vault/data"
  node_id = "node1"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_cert_file = "/vault/config/cert.pem"
  tls_key_file  = "/vault/config/key.pem"
}

api_addr = "https://vault-1.example.com:8200"
cluster_addr = "https://vault-1.example.com:8201"
```

## Vault 장점

✅ **Enterprise 기능**
- **Dynamic Secrets**: 임시 자격 증명 생성
- **Secret Leasing**: 시크릿 자동 만료
- **Audit Logging**: 모든 접근 기록
- **ACL Policies**: 세밀한 접근 제어
- **Multi-tenancy**: 네임스페이스 지원
- **Encryption as a Service**: Transit secrets engine

✅ **보안**
- **Unsealing**: 시작 시 여러 키 필요
- **Root Token Protection**: Root token은 응급용
- **TLS 필수**: HTTPS 강제
- **Audit Logs**: 모든 요청 감사

✅ **확장성**
- **HA 지원**: Raft, Consul backend
- **Performance Replication**: 읽기 성능 확장
- **DR Replication**: 재해 복구

## 문제 해결

### Vault 연결 실패
```bash
# Docker 상태 확인
docker ps | grep vault

# Vault 로그 확인
docker-compose logs vault

# 직접 테스트
curl http://localhost:8200/v1/sys/health
```

### Token 인증 실패
```bash
# 환경변수 확인
echo $VAULT_TOKEN  # should be "root-token"
echo $VAULT_ADDR   # should be "http://localhost:8200"

# Token 검증
vault token lookup
```

### Secret 조회 실패
```bash
# 수동 조회
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="root-token"

vault kv get secret/zklogin/seed

# API로 직접 조회
curl -H "X-Vault-Token: root-token" \
  http://localhost:8200/v1/secret/data/zklogin/seed | jq .
```

## 비용

HashiCorp Vault:
- **Open Source**: 무료
- **Enterprise**: 연락 필요 (기업용 기능)
- **HCP Vault**: $0.03/hour (~$22/월)

## 다음 단계

- [05-nitro](../05-nitro/): AWS Nitro Enclaves 문서
- [프로덕션 배포](../../../README.md#배포-가이드)
- [Vault 공식 문서](https://developer.hashicorp.com/vault/docs)
