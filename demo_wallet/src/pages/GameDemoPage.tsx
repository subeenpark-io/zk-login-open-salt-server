/**
 * Game Demo Page - Simple mobile-first game dApp example
 */

import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Dice6, ExternalLink, LogOut, RotateCcw, Trophy, Wallet2 } from "lucide-react";
import { useWalletStore } from "../store/wallet.store";
import { Button } from "../components/ui/Button";
import { WalletService } from "../services/wallet.service";
import { ProverService } from "../services/prover.service";
import { StorageService } from "../services/storage.service";

const GAME_STORAGE_KEY = "zklogin-dapp-game-state-v1";
const CLAIM_AMOUNT = "0.001";

type RoundOutcome = "none" | "win" | "lose";

interface ClaimRecord {
  round: number;
  digest: string;
  timestamp: number;
}

interface GameState {
  round: number;
  points: number;
  streak: number;
  bestStreak: number;
  lastRoll: number | null;
  lastOutcome: RoundOutcome;
  claimedRound: number | null;
  claims: ClaimRecord[];
}

const INITIAL_GAME_STATE: GameState = {
  round: 0,
  points: 0,
  streak: 0,
  bestStreak: 0,
  lastRoll: null,
  lastOutcome: "none",
  claimedRound: null,
  claims: [],
};

function loadGameState(): GameState {
  const raw = localStorage.getItem(GAME_STORAGE_KEY);
  if (!raw) return INITIAL_GAME_STATE;

  try {
    return { ...INITIAL_GAME_STATE, ...JSON.parse(raw) };
  } catch {
    return INITIAL_GAME_STATE;
  }
}

export function GameDemoPage() {
  const navigate = useNavigate();
  const { zkAddress, isAuthenticated, logout, jwt: storeJwt, salt: storeSalt } =
    useWalletStore();
  const [game, setGame] = useState<GameState>(() => loadGameState());
  const [rolling, setRolling] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDigest, setLastDigest] = useState<string | null>(null);

  const network = import.meta.env.VITE_SUI_NETWORK || "testnet";

  useEffect(() => {
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(game));
  }, [game]);

  if (!isAuthenticated || !zkAddress) {
    return <Navigate to="/" replace />;
  }

  const canClaimWin = game.lastOutcome === "win" && game.claimedRound !== game.round;

  const playRound = async () => {
    setRolling(true);
    setError(null);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const roll = Math.floor(Math.random() * 100) + 1;
    const isWin = roll >= 60;

    setGame((previous) => {
      const nextRound = previous.round + 1;
      const nextStreak = isWin ? previous.streak + 1 : 0;
      const nextPoints = isWin ? previous.points + 15 : Math.max(previous.points - 5, 0);

      return {
        ...previous,
        round: nextRound,
        points: nextPoints,
        streak: nextStreak,
        bestStreak: Math.max(previous.bestStreak, nextStreak),
        lastRoll: roll,
        lastOutcome: isWin ? "win" : "lose",
      };
    });

    setRolling(false);
  };

  const claimWinOnChain = async () => {
    if (!canClaimWin || !zkAddress) {
      return;
    }

    const salt = storeSalt || sessionStorage.getItem("zklogin_salt");
    const jwt = storeJwt || sessionStorage.getItem("zklogin_jwt");

    if (!salt || !jwt) {
      setError("Session data not found. Please login again.");
      return;
    }

    const ephemeralData = StorageService.loadEphemeralData();
    if (!ephemeralData) {
      setError("Ephemeral session expired. Please login again.");
      return;
    }

    setClaiming(true);
    setError(null);

    try {
      const proverService = new ProverService();
      const freshProof = await proverService.generateZkProof({
        jwt,
        salt,
        ephemeralPublicKey: ephemeralData.extendedEphemeralPublicKey,
        maxEpoch: ephemeralData.maxEpoch,
        randomness: ephemeralData.randomness,
      });
      proverService.cacheProof(freshProof);

      const walletService = new WalletService();
      const digest = await walletService.sendSui({
        fromAddress: zkAddress,
        toAddress: zkAddress,
        amount: CLAIM_AMOUNT,
        privateKey: ephemeralData.privateKey,
        zkProof: freshProof,
        maxEpoch: ephemeralData.maxEpoch,
        userSalt: salt,
        jwt,
      });

      setLastDigest(digest);
      setGame((previous) => ({
        ...previous,
        points: previous.points + 25,
        claimedRound: previous.round,
        claims: [
          { round: previous.round, digest, timestamp: Date.now() },
          ...previous.claims,
        ].slice(0, 6),
      }));
    } catch (claimError) {
      console.error("Claim transaction failed:", claimError);
      setError(claimError instanceof Error ? claimError.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  const resetGame = () => {
    setGame(INITIAL_GAME_STATE);
    setLastDigest(null);
    setError(null);
  };

  const getOutcomeLabel = () => {
    if (game.lastOutcome === "win") return "WIN";
    if (game.lastOutcome === "lose") return "LOSE";
    return "READY";
  };

  return (
    <div className="relative min-h-screen min-h-[100dvh] safe-area-inset overflow-hidden">
      <div className="ambient-grid" />

      <main className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-10 pt-6 sm:px-6">
        <section className="panel animated-appear p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="micro-label">Game DApp Demo</p>
              <h1 className="display-font title-balance mt-2 text-[clamp(2rem,7.2vw,3.2rem)] text-[var(--text-main)]">
                Lucky Roll Arena
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-dim)] sm:text-base">
                Play with your zkLogin wallet and record winning rounds on-chain.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="tag-badge">{network}</span>
                <span className="tag-badge">Self-Transfer Claim</span>
              </div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="secondary"
                onClick={() => navigate("/wallet")}
                className="flex-1 sm:flex-none"
              >
                <Wallet2 className="h-4 w-4 shrink-0" />
                Wallet
              </Button>
              <Button variant="secondary" onClick={logout} className="flex-1 sm:flex-none">
                <LogOut className="h-4 w-4 shrink-0" />
                Logout
              </Button>
            </div>
          </div>
        </section>

        <section className="animated-appear delay-1 mt-6 grid gap-3 sm:grid-cols-3">
          <article className="panel p-4">
            <p className="micro-label">Points</p>
            <p className="display-font mt-2 text-3xl text-[var(--text-main)]">{game.points}</p>
          </article>
          <article className="panel p-4">
            <p className="micro-label">Current Streak</p>
            <p className="display-font mt-2 text-3xl text-[var(--text-main)]">{game.streak}</p>
          </article>
          <article className="panel p-4">
            <p className="micro-label">Best Streak</p>
            <p className="display-font mt-2 text-3xl text-[var(--text-main)]">{game.bestStreak}</p>
          </article>
        </section>

        <section className="panel animated-appear delay-2 mt-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="micro-label">Round Engine</p>
            <span className="tag-badge">Round #{game.round + 1}</span>
          </div>

          <div className="mt-4 rounded-2xl border border-[rgba(171,123,81,0.24)] bg-[rgba(255,249,240,0.9)] p-5 text-center">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-dim)]">Last Result</p>
            <p
              className={`display-font mt-2 text-5xl ${
                game.lastOutcome === "win"
                  ? "text-[var(--accent-mint)]"
                  : game.lastOutcome === "lose"
                    ? "text-[var(--accent-warm)]"
                    : "text-[var(--text-main)]"
              }`}
            >
              {getOutcomeLabel()}
            </p>
            <p className="mt-2 text-sm text-[var(--text-dim)]">
              {game.lastRoll ? `Last roll: ${game.lastRoll}` : "Win if your roll is 60 or higher."}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Button onClick={playRound} disabled={rolling || claiming}>
              <Dice6 className="h-4 w-4 shrink-0" />
              {rolling ? "Rolling..." : "Play Round"}
            </Button>
            <Button
              variant="secondary"
              onClick={claimWinOnChain}
              disabled={!canClaimWin || rolling || claiming}
            >
              <Trophy className="h-4 w-4 shrink-0" />
              {claiming ? "Claiming..." : `Claim Win (+${CLAIM_AMOUNT} SUI tx)`}
            </Button>
            <Button variant="secondary" onClick={resetGame} disabled={rolling || claiming}>
              <RotateCcw className="h-4 w-4 shrink-0" />
              Reset
            </Button>
          </div>

          <ul className="mt-4 space-y-2">
            <li className="flex items-start gap-2 text-sm text-[var(--text-main)]">
              <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent-mint)]" />
              <span>Win gives +15 points, loss gives -5 points.</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-[var(--text-main)]">
              <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent-mint)]" />
              <span>Each winning round can be claimed on-chain once for an extra +25 points.</span>
            </li>
          </ul>
        </section>

        {error && (
          <section className="panel animated-appear mt-5 border-[rgba(240,173,55,0.48)] p-4">
            <p className="text-sm text-[#9a4f1d]">{error}</p>
          </section>
        )}

        {lastDigest && (
          <section className="panel animated-appear mt-5 border-[rgba(28,154,137,0.42)] p-4">
            <p className="micro-label">Latest Claim TX</p>
            <a
              href={`https://${network}.suivision.xyz/txblock/${lastDigest}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block font-mono text-sm text-[var(--accent-main)] hover:underline"
            >
              {lastDigest.slice(0, 14)}...{lastDigest.slice(-8)}
              <ExternalLink className="ml-1 inline h-3 w-3 align-[-1px]" />
            </a>
          </section>
        )}

        <section className="panel animated-appear delay-3 mt-6 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <p className="micro-label">Claim History</p>
            <span className="text-xs text-[var(--text-dim)]">Latest 6</span>
          </div>

          {game.claims.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--text-dim)]">
              No on-chain claims yet. Win a round, then press Claim.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {game.claims.map((claim) => (
                <div
                  key={`${claim.digest}-${claim.round}`}
                  className="flex items-center justify-between rounded-lg border border-[rgba(171,123,81,0.2)] bg-[rgba(255,249,240,0.85)] px-3 py-3"
                >
                  <div>
                    <p className="text-sm text-[var(--text-main)]">Round {claim.round}</p>
                    <p className="text-xs text-[var(--text-dim)]">
                      {new Date(claim.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <a
                    href={`https://${network}.suivision.xyz/txblock/${claim.digest}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-[var(--accent-main)] hover:underline"
                  >
                    {claim.digest.slice(0, 10)}...{claim.digest.slice(-6)}
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
