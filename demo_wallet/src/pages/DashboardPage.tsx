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
import { Copy, Droplets, ExternalLink, Gamepad2, LogOut, Send } from "lucide-react";

const DEMO_ACTIONS = [
  "Send your SUI to another address in a single flow.",
  "Verify each transfer result directly in an explorer.",
  "Experience low-friction onboarding with Google-powered login.",
];

export function DashboardPage() {
  const navigate = useNavigate();
  const { zkAddress, isAuthenticated, logout } = useWalletStore();
  const [showSendModal, setShowSendModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastTxDigest, setLastTxDigest] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const network = import.meta.env.VITE_SUI_NETWORK || "testnet";

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
              <h1 className="display-font title-balance mt-2 text-[clamp(2rem,7.3vw,3.2rem)] text-[var(--text-main)]">
                Your zkLogin Wallet is Live.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-dim)] sm:text-base">
                Your wallet is created right after Google sign-in. You can execute transactions
                immediately and inspect results in an explorer.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="tag-badge">{network}</span>
                <span className="tag-badge">Google Authenticated</span>
              </div>
            </div>
            <Button variant="secondary" onClick={logout} className="w-full sm:w-auto">
              <LogOut className="h-4 w-4 shrink-0" />
              Logout
            </Button>
          </div>
        </section>

        {lastTxDigest && (
          <section className="panel animated-appear delay-1 mt-5 border-[rgba(28,154,137,0.42)] p-4">
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
                  <ExternalLink className="ml-1 inline h-3 w-3 align-[-1px]" />
                </a>
              </div>
              <button
                type="button"
                onClick={() => setLastTxDigest(null)}
                className="rounded-lg border border-[rgba(171,123,81,0.32)] bg-[rgba(255,247,236,0.84)] px-2 py-1 text-xs text-[var(--text-dim)] hover:text-[var(--text-main)]"
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
            <p className="text-xs text-[var(--text-dim)]">Ready for instant mobile testing</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Button onClick={() => setShowSendModal(true)}>
              <Send className="h-4 w-4 shrink-0" />
              Send SUI
            </Button>
            <Button variant="secondary" onClick={handleCopyAddress}>
              <Copy className="h-4 w-4 shrink-0" />
              {copied ? "Address Copied" : "Copy Address"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                window.open(faucetUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <Droplets className="h-4 w-4 shrink-0" />
              Open Faucet
            </Button>
          </div>
        </section>

        <section className="panel animated-appear delay-2 mt-6 p-5 sm:p-6">
          <p className="micro-label">What Users Can Do Now</p>
          <ul className="mt-3 space-y-2">
            {DEMO_ACTIONS.map((item) => (
              <li
                key={item}
                className="grid grid-cols-[8px_1fr] items-start gap-x-2 text-sm leading-relaxed text-[var(--text-main)]"
              >
                <span className="mt-[0.5rem] h-2 w-2 rounded-full bg-[var(--accent-warm)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel animated-appear delay-2 mt-6 p-5 sm:p-6">
          <p className="micro-label">DApp Examples</p>
          <p className="mt-2 text-sm text-[var(--text-dim)]">
            Try interactive dApps — each action sends a real on-chain transaction.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button onClick={() => navigate("/dapps/slots")}>
              <Gamepad2 className="h-4 w-4 shrink-0" />
              Sui Slots
            </Button>
            <Button variant="secondary" onClick={() => navigate("/dapps/game")}>
              <Gamepad2 className="h-4 w-4 shrink-0" />
              Lucky Roll
            </Button>
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
