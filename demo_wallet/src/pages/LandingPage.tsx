/**
 * Landing Page - Mobile-first showcase for zkLogin wallet flow
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoginButton } from "../components/wallet/LoginButton";
import { useWalletStore } from "../store/wallet.store";
import { Button } from "../components/ui/Button";
import { ArrowRight, Gamepad2, Sparkles, WalletCards } from "lucide-react";

const SHOWCASE_ITEMS = [
  {
    title: "1) Sign In With Google",
    description: "Start instantly with your existing Google account.",
  },
  {
    title: "2) Instant Wallet Creation",
    description: "A zkLogin wallet address is created immediately with no seed phrase.",
  },
  {
    title: "3) Instant Wallet + On-Chain Actions",
    description: "A zkLogin wallet is generated right away, then you can check balance and send SUI.",
  },
];

const USE_CASES = [
  "Onboarding demo: move users from Web2 to Web3 in under 60 seconds.",
  "Community rewards: distribute incentives without manual wallet setup.",
  "Mobile payments demo: fast transfers with minimal friction.",
];

const DAPP_EXAMPLES = [
  {
    title: "Wallet Playground",
    description: "Core wallet flow for balance checks, transfers, and explorer tracking.",
    href: "/wallet",
    tag: "Live",
  },
  {
    title: "Lucky Roll Game",
    description: "Mobile mini-game with on-chain claim actions after winning rounds.",
    href: "/dapps/game",
    tag: "New",
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const isAuthenticated = useWalletStore((state) => state.isAuthenticated);
  const zkAddress = useWalletStore((state) => state.zkAddress);
  const network = import.meta.env.VITE_SUI_NETWORK ?? "testnet";

  useEffect(() => {
    if (isAuthenticated && zkAddress) {
      navigate("/wallet");
    }
  }, [isAuthenticated, zkAddress, navigate]);

  return (
    <div className="relative min-h-screen min-h-[100dvh] safe-area-inset overflow-hidden">
      <div className="ambient-grid" />

      <main className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-10 pt-6 sm:px-6">
        <div className="animated-appear">
          <p className="micro-label mb-3">zkLogin Showcase DApp</p>
          <h1 className="display-font title-balance text-[clamp(2.1rem,8vw,3.8rem)] text-[var(--text-main)]">
            Tap In, Sign With Google, Use Your Wallet Instantly.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--text-dim)] sm:text-base">
            Open on mobile, sign in with Google, and get your wallet in seconds.
            Then send SUI and verify live on-chain transactions right away.
          </p>
        </div>

        <section className="panel animated-appear delay-1 mt-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="micro-label">Start Demo</p>
              <p className="mt-1 text-sm text-[var(--text-dim)]">
                Network: <span className="font-semibold text-[var(--text-main)]">{network}</span>
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(171,123,81,0.32)] bg-[rgba(255,247,236,0.84)] px-3 py-1 text-xs font-semibold text-[var(--text-main)]">
              <Sparkles className="h-3.5 w-3.5" />
              Mobile Ready
            </span>
          </div>

          <div className="mt-4">
            <LoginButton />
          </div>
        </section>

        <section className="animated-appear delay-2 mt-6 grid gap-3">
          {SHOWCASE_ITEMS.map((item) => (
            <article key={item.title} className="panel p-4">
              <h2 className="display-font text-xl leading-tight text-[var(--text-main)]">{item.title}</h2>
              <p className="mt-1 text-sm text-[var(--text-dim)]">{item.description}</p>
            </article>
          ))}
        </section>

        <section className="panel animated-appear delay-3 mt-6 p-5 sm:p-6">
          <p className="micro-label">What Users Can Do</p>
          <ul className="mt-3 space-y-2">
            {USE_CASES.map((item) => (
              <li
                key={item}
                className="grid grid-cols-[8px_1fr] items-start gap-x-2 text-sm leading-relaxed text-[var(--text-main)]"
              >
                <span className="mt-[0.5rem] h-2 w-2 rounded-full bg-[var(--accent-main)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="animated-appear delay-3 mt-6 grid gap-3">
          {DAPP_EXAMPLES.map((example) => (
            <article key={example.title} className="panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="display-font text-2xl text-[var(--text-main)]">{example.title}</h2>
                  <p className="mt-2 text-sm text-[var(--text-dim)]">{example.description}</p>
                </div>
                <span className="tag-badge">{example.tag}</span>
              </div>
              <div className="mt-4">
                <Button variant="secondary" onClick={() => navigate(example.href)}>
                  {example.href === "/wallet" ? (
                    <WalletCards className="h-4 w-4 shrink-0" />
                  ) : (
                    <Gamepad2 className="h-4 w-4 shrink-0" />
                  )}
                  Open Demo
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Button>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
