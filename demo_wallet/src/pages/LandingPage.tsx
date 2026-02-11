/**
 * Landing Page - Mobile-first showcase for zkLogin wallet flow
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoginButton } from "../components/wallet/LoginButton";
import { useWalletStore } from "../store/wallet.store";
import { Button } from "../components/ui/Button";

const SHOWCASE_ITEMS = [
  {
    title: "1) Google 로그인",
    description: "앱 설치 없이 구글 계정으로 바로 시작",
  },
  {
    title: "2) 자동 지갑 생성",
    description: "zkLogin 주소가 즉시 생성되고 복잡한 시드 문구가 없음",
  },
  {
    title: "3) 온체인 액션",
    description: "잔액 확인, 전송, 트랜잭션 검증까지 한 화면에서",
  },
];

const USE_CASES = [
  "온보딩 체험: 60초 안에 Web2 → Web3 전환 경험",
  "커뮤니티 보상: 지갑 연결 없이 이벤트 보상 지급",
  "모바일 결제 데모: 주소 복사 없이 빠른 전송",
];

const DAPP_EXAMPLES = [
  {
    title: "Wallet Playground",
    description: "잔액 조회, 전송, 트랜잭션 탐색까지 기본 지갑 플로우",
    href: "/wallet",
    tag: "Live",
  },
  {
    title: "Lucky Roll Game",
    description: "모바일 미니 게임 + 승리 라운드 온체인 클레임 데모",
    href: "/dapps/game",
    tag: "New",
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const isAuthenticated = useWalletStore((state) => state.isAuthenticated);
  const zkAddress = useWalletStore((state) => state.zkAddress);
  const network = import.meta.env.VITE_SUI_NETWORK ?? "devnet";

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
          <h1 className="display-font text-4xl leading-[1.05] text-[var(--text-main)] sm:text-5xl">
            Tap In, Sign With Google, <br />
            Use Your Wallet Instantly.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--text-dim)] sm:text-base">
            휴대폰에서 접속해서 구글 로그인만 하면 지갑이 바로 생성됩니다.
            생성된 지갑으로 바로 SUI 전송과 트랜잭션 확인까지 경험할 수 있습니다.
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
            <span className="rounded-full border border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.06)] px-3 py-1 text-xs font-semibold text-[var(--text-main)]">
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
              <h2 className="display-font text-xl text-[var(--text-main)]">{item.title}</h2>
              <p className="mt-1 text-sm text-[var(--text-dim)]">{item.description}</p>
            </article>
          ))}
        </section>

        <section className="panel animated-appear delay-3 mt-6 p-5 sm:p-6">
          <p className="micro-label">What Users Can Do</p>
          <ul className="mt-3 space-y-2">
            {USE_CASES.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-[var(--text-main)]">
                <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent-warm)]" />
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
                  Open Demo
                </Button>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
