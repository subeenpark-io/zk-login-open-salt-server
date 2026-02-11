/**
 * Auth Callback Page - Handles OAuth callback and wallet creation
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWalletStore } from "../store/wallet.store";
import { AuthService } from "../services/auth.service";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { Button } from "../components/ui/Button";

const BUILD_STEPS = [
  "Salt Server에서 사용자 salt 조회",
  "JWT 기반 zkLogin 주소 계산",
  "Mysten prover로 ZK proof 생성",
];

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const handleCallback = useWalletStore((state) => state.handleCallback);
  const status = useWalletStore((state) => state.status);
  const error = useWalletStore((state) => state.error);

  useEffect(() => {
    const processCallback = async () => {
      const authService = new AuthService();
      const jwt = authService.handleOAuthCallback();

      if (jwt) {
        await handleCallback(jwt);
      } else {
        navigate("/", { state: { error: "No JWT token received from OAuth provider" } });
      }
    };

    processCallback();
  }, [handleCallback, navigate]);

  useEffect(() => {
    if (status === "ready") {
      navigate("/wallet");
    }
  }, [status, navigate]);

  return (
    <div className="relative min-h-screen min-h-[100dvh] safe-area-inset overflow-hidden">
      <div className="ambient-grid" />

      <main className="relative z-10 mx-auto flex min-h-[80dvh] w-full max-w-xl items-center justify-center px-4 sm:px-6">
        {status === "loading" && (
          <section className="panel w-full p-6 text-center sm:p-7">
            <p className="micro-label">Preparing Wallet</p>
            <h1 className="display-font mt-2 text-3xl leading-tight text-[var(--text-main)]">
              Building Your zkLogin Wallet
            </h1>
            <p className="mt-3 text-sm text-[var(--text-dim)]">
              로그인 토큰을 검증하고 지갑 주소를 생성하는 중입니다. 잠시만 기다려주세요.
            </p>

            <div className="mt-5">
              <LoadingSpinner size="lg" />
            </div>

            <ul className="mt-5 space-y-2 text-left">
              {BUILD_STEPS.map((step) => (
                <li key={step} className="flex items-start gap-2 text-sm text-[var(--text-main)]">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent-main)]" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && (
          <section className="panel w-full p-6 sm:p-7">
            <p className="micro-label">Authentication Error</p>
            <h2 className="display-font mt-2 text-2xl text-[var(--text-main)]">로그인 처리 실패</h2>
            <p className="mt-3 rounded-xl border border-[rgba(255,122,89,0.45)] bg-[rgba(255,122,89,0.08)] p-3 text-sm text-[var(--text-main)]">
              {error}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => navigate("/")} className="flex-1">
                Back to Home
              </Button>
              <Button variant="secondary" onClick={() => window.location.reload()} className="flex-1">
                Retry
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
