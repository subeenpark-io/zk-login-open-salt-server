#!/usr/bin/env node
/**
 * 테스트용 JWT 생성 스크립트
 *
 * ⚠️ 주의: 이 스크립트는 실제 OAuth provider가 아닌 Mock JWT를 생성합니다.
 * 실제 Salt Server는 Google, Facebook 등의 JWKS를 사용하여 JWT를 검증하므로,
 * 이 JWT로는 Salt API를 테스트할 수 없습니다.
 *
 * **실제 테스트 방법**:
 * 1. Google OAuth Playground에서 실제 JWT 발급
 *    https://developers.google.com/oauthplayground/
 * 2. 발급받은 JWT를 TEST_JWT 환경변수로 설정
 *    export TEST_JWT="eyJhbGciOiJSUzI1NiIs..."
 * 3. 테스트 스크립트 실행
 *
 * 이 스크립트는 참고용으로만 남겨둡니다.
 */

console.error("========================================");
console.error("⚠️  Mock JWT는 실제 테스트에 사용할 수 없습니다");
console.error("========================================");
console.error("");
console.error("실제 OAuth JWT를 발급받아 사용하세요:");
console.error("1. Google OAuth Playground: https://developers.google.com/oauthplayground/");
console.error("2. Scope 선택: openid, email, profile");
console.error("3. 발급받은 id_token 사용");
console.error("");
console.error("사용법:");
console.error("  export TEST_JWT=\"eyJhbGciOiJSUzI1NiIs...\"");
console.error("  ./test.sh");
console.error("");
process.exit(1);
