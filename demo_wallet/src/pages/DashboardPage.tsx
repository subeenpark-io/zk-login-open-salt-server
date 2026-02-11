/**
 * Dashboard Page - Main wallet interface
 */

import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useWalletStore } from "../store/wallet.store";
import { WalletAddress } from "../components/wallet/WalletAddress";
import { BalanceCard } from "../components/wallet/BalanceCard";
import { SendSuiModal } from "../components/wallet/SendSuiModal";
import { TransactionHistory } from "../components/wallet/TransactionHistory";
import { Button } from "../components/ui/Button";

const DEMO_ACTIONS = [
  "받은 Devnet SUI를 다른 주소로 전송해보기",
  "전송 결과를 Explorer에서 바로 검증하기",
  "Google 로그인 기반 온보딩 UX 체험하기",
];

export function DashboardPage() {
  const navigate = useNavigate();
  const { zkAddress, isAuthenticated, logout } = useWalletStore();
  const [showSendModal, setShowSendModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastTxDigest, setLastTxDigest] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const network = import.meta.env.VITE_SUI_NETWORK || "devnet";

  if (!isAuthenticated || !zkAddress) {
    return <Navigate to="/" replace />;
  }

  const handleSendSuccess = (digest: string) => {
    setLastTxDigest(digest);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(zkAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  const faucetUrl = `https://faucet.sui.io/?network=${network}`;

  return (
    <div className="relative min-h-screen min-h-[100dvh] safe-area-inset overflow-hidden">
      <div className="ambient-grid" />

      <main className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-10 pt-6 sm:px-6">
        <section className="panel animated-appear p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="micro-label">Wallet Ready</p>
              <h1 className="display-font mt-2 text-3xl leading-[1.05] text-[var(--text-main)] sm:text-4xl">
                Your zkLogin Wallet is Live.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[var(--text-dim)] sm:text-base">
                구글 로그인 직후 생성된 지갑으로 바로 트랜잭션을 실행하고, 블록 탐색기에서 결과를
                확인할 수 있습니다.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="tag-badge">{network}</span>
                <span className="tag-badge">Google Authenticated</span>
              </div>
            </div>
            <Button variant="secondary" onClick={logout} className="w-full sm:w-auto">
              Logout
            </Button>
          </div>
        </section>

        {lastTxDigest && (
          <section className="panel animated-appear delay-1 mt-5 border-[rgba(45,212,191,0.45)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-main)]">Transaction Sent</p>
                <a
                  href={`https://${network}.suivision.xyz/txblock/${lastTxDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block font-mono text-xs text-[var(--accent-main)] hover:underline"
                >
                  {lastTxDigest.slice(0, 16)}...{lastTxDigest.slice(-8)}
                </a>
              </div>
              <button
                type="button"
                onClick={() => setLastTxDigest(null)}
                className="rounded-lg border border-[rgba(255,255,255,0.18)] px-2 py-1 text-xs text-[var(--text-dim)] hover:text-[var(--text-main)]"
              >
                Close
              </button>
            </div>
          </section>
        )}

        <section className="animated-appear delay-1 mt-6 grid gap-4 md:grid-cols-2">
          <WalletAddress address={zkAddress} />
          <BalanceCard address={zkAddress} refreshTrigger={refreshTrigger} />
        </section>

        <section className="panel animated-appear delay-2 mt-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="micro-label">Quick Demo Actions</p>
            <p className="text-xs text-[var(--text-dim)]">모바일에서 즉시 체험 가능</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Button onClick={() => setShowSendModal(true)}>Send SUI</Button>
            <Button variant="secondary" onClick={handleCopyAddress}>
              {copied ? "Address Copied" : "Copy Address"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                window.open(faucetUrl, "_blank", "noopener,noreferrer");
              }}
            >
              Open Faucet
            </Button>
          </div>
        </section>

        <section className="panel animated-appear delay-2 mt-6 p-5 sm:p-6">
          <p className="micro-label">What Users Can Do Now</p>
          <ul className="mt-3 space-y-2">
            {DEMO_ACTIONS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-[var(--text-main)]">
                <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent-main)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel animated-appear delay-2 mt-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="micro-label">DApp Examples</p>
              <p className="mt-2 text-sm text-[var(--text-dim)]">
                지갑 데모 외에 게임형 dApp 데모도 바로 체험할 수 있습니다.
              </p>
            </div>
            <Button onClick={() => navigate("/dapps/game")}>Open Game DApp</Button>
          </div>
        </section>

        <section className="animated-appear delay-3 mt-6">
          <TransactionHistory address={zkAddress} refreshTrigger={refreshTrigger} />
        </section>

        <section className="panel animated-appear delay-3 mt-6 p-4">
          <p className="text-sm text-[var(--text-dim)]">
            Explorer account view:{" "}
            <a
              href={`https://${network}.suivision.xyz/account/${zkAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[var(--accent-main)] hover:underline"
            >
              {zkAddress.slice(0, 10)}...{zkAddress.slice(-8)}
            </a>
          </p>
        </section>
      </main>

      <SendSuiModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        onSuccess={handleSendSuccess}
      />
    </div>
  );
}
