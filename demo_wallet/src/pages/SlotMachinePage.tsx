import { useEffect, useState, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ExternalLink, LogOut, RotateCcw, Wallet2, Trophy, History, RefreshCw } from "lucide-react";
import { useWalletStore } from "../store/wallet.store";
import { Button } from "../components/ui/Button";
import { WalletService } from "../services/wallet.service";
import { ProverService } from "../services/prover.service";
import { StorageService } from "../services/storage.service";

const SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣"];
const BET_OPTIONS = ["0.01", "0.05", "0.1"];
const STORAGE_KEY = "zklogin-slot-game-v2";

interface GameResult {
  id: string;
  symbols: string[];
  outcome: "JACKPOT" | "WIN" | "LOSS";
  betSui: string;
  payoutSui: string;
  digest: string;
  timestamp: number;
}

interface GameStats {
  spins: number;
  wins: number;
  jackpots: number;
  history: GameResult[];
}

type PipelineStep = "IDLE" | "PROOF" | "SIGNING" | "BROADCAST" | "CONFIRM" | "DONE";

const INITIAL_STATS: GameStats = {
  spins: 0,
  wins: 0,
  jackpots: 0,
  history: [],
};

function parseGameEvent(events: Array<{ type: string; parsedJson: Record<string, unknown> }>): {
  reel1: number;
  reel2: number;
  reel3: number;
  payout: bigint;
  betAmount: bigint;
} | null {
  const gameEvent = events.find((e) => e.type.includes("::game::GameResult"));
  if (!gameEvent?.parsedJson) return null;
  const json = gameEvent.parsedJson;
  return {
    reel1: Number(json.reel1),
    reel2: Number(json.reel2),
    reel3: Number(json.reel3),
    payout: BigInt(String(json.payout)),
    betAmount: BigInt(String(json.bet_amount)),
  };
}

function formatSui(mist: bigint): string {
  const sui = Number(mist) / 1_000_000_000;
  return sui.toFixed(sui < 0.01 ? 4 : 2);
}

function determineOutcome(reel1: number, reel2: number, reel3: number): "JACKPOT" | "WIN" | "LOSS" {
  if (reel1 === reel2 && reel2 === reel3) return "JACKPOT";
  if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) return "WIN";
  return "LOSS";
}

export function SlotMachinePage() {
  const navigate = useNavigate();
  const { zkAddress, isAuthenticated, logout, jwt: storeJwt, salt: storeSalt } = useWalletStore();

  const [stats, setStats] = useState<GameStats>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_STATS;
  });

  const [balance, setBalance] = useState<string>("...");
  const [betAmount, setBetAmount] = useState(BET_OPTIONS[0]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("IDLE");
  const [currentReels, setCurrentReels] = useState<string[]>(["7️⃣", "7️⃣", "7️⃣"]);
  const [lastDigest, setLastDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!zkAddress) return;
    const walletService = new WalletService();
    const bal = await walletService.getBalance(zkAddress);
    setBalance(bal);
  }, [zkAddress]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }, [stats]);

  if (!isAuthenticated || !zkAddress) {
    return <Navigate to="/" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleReset = () => {
    if (confirm("Reset game history?")) {
      setStats(INITIAL_STATS);
      setLastDigest(null);
      setError(null);
    }
  };

  const spin = async () => {
    if (isSpinning) return;

    setIsSpinning(true);
    setPipelineStep("PROOF");
    setError(null);
    setLastDigest(null);

    try {
      const salt = storeSalt || sessionStorage.getItem("zklogin_salt");
      const jwt = storeJwt || sessionStorage.getItem("zklogin_jwt");
      if (!salt || !jwt) throw new Error("Missing credentials. Please login again.");

      const ephemeralData = StorageService.loadEphemeralData();
      if (!ephemeralData) throw new Error("Missing ephemeral data.");

      const proverService = new ProverService();
      const freshProof = await proverService.generateZkProof({
        jwt,
        salt,
        ephemeralPublicKey: ephemeralData.extendedEphemeralPublicKey,
        maxEpoch: ephemeralData.maxEpoch,
        randomness: ephemeralData.randomness,
      });
      proverService.cacheProof(freshProof);

      setPipelineStep("SIGNING");
      await new Promise((r) => setTimeout(r, 400));
      setPipelineStep("BROADCAST");

      const walletService = new WalletService();
      const { digest, events } = await walletService.playSlotMachine({
        playerAddress: zkAddress!,
        betAmountSui: betAmount,
        privateKey: ephemeralData.privateKey,
        zkProof: freshProof,
        maxEpoch: ephemeralData.maxEpoch,
        userSalt: salt,
        jwt,
      });

      setPipelineStep("CONFIRM");
      setLastDigest(digest);

      const gameData = parseGameEvent(events);
      if (!gameData) throw new Error("Failed to parse game result from contract.");

      const { reel1, reel2, reel3, payout, betAmount: betMist } = gameData;
      const finalSymbols = [SYMBOLS[reel1], SYMBOLS[reel2], SYMBOLS[reel3]];
      const outcome = determineOutcome(reel1, reel2, reel3);

      await new Promise((r) => setTimeout(r, 800));

      setCurrentReels(finalSymbols);
      setIsSpinning(false);
      setPipelineStep("DONE");

      setStats((prev) => ({
        spins: prev.spins + 1,
        wins: prev.wins + (payout > 0n ? 1 : 0),
        jackpots: prev.jackpots + (outcome === "JACKPOT" ? 1 : 0),
        history: [
          {
            id: digest,
            symbols: finalSymbols,
            outcome,
            betSui: formatSui(betMist),
            payoutSui: formatSui(payout),
            digest,
            timestamp: Date.now(),
          },
          ...prev.history,
        ].slice(0, 8),
      }));

      refreshBalance();
    } catch (err: unknown) {
      console.error("Spin failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Transaction failed";
      setError(errorMessage);
      setIsSpinning(false);
      setPipelineStep("IDLE");
    }
  };

  const network = import.meta.env.VITE_SUI_NETWORK || "devnet";
  const explorerUrl = (digest: string) => `https://${network}.suivision.xyz/txblock/${digest}`;

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] font-sans selection:bg-[var(--accent-warm)] selection:text-white pb-20">
      <style>{`
        @keyframes spin-reel {
          0% { transform: translateY(0); }
          100% { transform: translateY(-100%); }
        }
        .reel-container {
          overflow: hidden;
          position: relative;
          height: 160px;
          background: white;
          border-radius: 8px;
          box-shadow: inset 0 2px 6px rgba(0,0,0,0.1);
        }
        .reel-strip {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .spinning .reel-strip {
          animation: spin-reel 0.4s linear infinite;
        }
        
        .pipeline-step {
          transition: all 0.3s ease;
          opacity: 0.4;
          transform: scale(0.95);
        }
        .pipeline-step.active {
          opacity: 1;
          transform: scale(1.05);
          font-weight: 600;
          color: var(--accent-main);
        }
        .pipeline-step.done {
          opacity: 1;
          color: var(--accent-mint);
        }
        
        .jackpot-glow {
          animation: glow 1s ease-in-out infinite alternate;
        }
        @keyframes glow {
          from { box-shadow: 0 0 10px var(--accent-warm); border-color: var(--accent-warm); }
          to { box-shadow: 0 0 25px var(--accent-warm), 0 0 10px var(--accent-main); border-color: var(--accent-main); }
        }
      `}</style>

      <header className="sticky top-0 z-10 backdrop-blur-md bg-[var(--bg-main)]/90 border-b border-[var(--line-soft)] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-main)] to-[var(--accent-warm)] flex items-center justify-center text-white shadow-lg shadow-[var(--accent-main)]/20">
              <span className="text-xl">🎰</span>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-main)]">
                Sui Slots
              </h1>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-mint)] animate-pulse" />
                <span className="text-xs font-medium text-[var(--text-dim)] uppercase tracking-wider">
                  {network}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-panel)] border border-[var(--line-soft)]">
              <Wallet2 className="w-4 h-4 text-[var(--text-dim)]" />
              <span className="text-sm font-mono text-[var(--text-dim)]">
                {zkAddress?.slice(0, 6)}...{zkAddress?.slice(-4)}
              </span>
            </div>
            <Button variant="secondary" onClick={handleLogout} className="!px-3">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-3 gap-4">
          <div className="panel p-4 flex flex-col items-center justify-center text-center">
            <span className="micro-label mb-1">Balance</span>
            <div className="flex items-center gap-1">
              <span className="display-font text-2xl text-[var(--accent-main)]">{balance}</span>
              <span className="text-xs text-[var(--text-dim)]">SUI</span>
              <button
                onClick={refreshBalance}
                className="ml-1 text-[var(--text-dim)] hover:text-[var(--accent-main)] transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="panel p-4 flex flex-col items-center justify-center text-center">
            <span className="micro-label mb-1">Win Rate</span>
            <span className="display-font text-2xl text-[var(--text-main)]">
              {stats.spins > 0 ? Math.round((stats.wins / stats.spins) * 100) : 0}%
            </span>
          </div>
          <div className="panel p-4 flex flex-col items-center justify-center text-center">
            <span className="micro-label mb-1">Jackpots</span>
            <span className="display-font text-2xl text-[var(--accent-warm)] flex items-center gap-1">
              <Trophy className="w-5 h-5" /> {stats.jackpots}
            </span>
          </div>
        </div>

        <div
          className={`panel p-8 border-4 relative transition-all duration-500 ${
            stats.history[0]?.outcome === "JACKPOT" && !isSpinning
              ? "border-[var(--accent-warm)] jackpot-glow"
              : "border-[var(--line-soft)]"
          }`}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--bg-main)] px-4 text-xs font-bold tracking-widest text-[var(--text-dim)] uppercase">
            On-Chain Slot Machine
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`reel-container ${isSpinning ? "spinning" : ""}`}>
                <div
                  className="reel-strip h-full flex flex-col justify-center items-center"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  {isSpinning ? (
                    <>
                      <span className="text-6xl py-4 filter blur-[1px]">🍒</span>
                      <span className="text-6xl py-4 filter blur-[1px]">7️⃣</span>
                      <span className="text-6xl py-4 filter blur-[1px]">💎</span>
                      <span className="text-6xl py-4 filter blur-[1px]">🔔</span>
                    </>
                  ) : (
                    <span className="text-6xl animated-appear">{currentReels[i]}</span>
                  )}
                </div>
                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_10px_20px_rgba(0,0,0,0.1),inset_0_-10px_20px_rgba(0,0,0,0.1)]"></div>
              </div>
            ))}
          </div>

          <div className="h-12 flex items-center justify-center mb-6">
            {!isSpinning && stats.history.length > 0 && pipelineStep === "DONE" && (
              <div
                className={`text-2xl font-bold animated-appear ${
                  stats.history[0].outcome === "LOSS"
                    ? "text-[var(--text-dim)]"
                    : stats.history[0].outcome === "JACKPOT"
                      ? "text-[var(--accent-warm)] scale-110"
                      : "text-[var(--accent-mint)]"
                }`}
              >
                {stats.history[0].outcome === "LOSS"
                  ? `Try Again (-${stats.history[0].betSui} SUI)`
                  : stats.history[0].outcome === "JACKPOT"
                    ? `🎉 JACKPOT! +${stats.history[0].payoutSui} SUI 🎉`
                    : `✨ WIN! +${stats.history[0].payoutSui} SUI ✨`}
              </div>
            )}
            {isSpinning && (
              <div className="text-[var(--text-dim)] animate-pulse font-medium">
                Processing On-Chain Transaction...
              </div>
            )}
          </div>

          <div className="mb-8 relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-[var(--line-soft)] -z-10"></div>
            <div className="flex justify-between text-xs">
              {[
                { id: "PROOF", label: "ZK Proof" },
                { id: "SIGNING", label: "Signing" },
                { id: "BROADCAST", label: "Broadcast" },
                { id: "CONFIRM", label: "Confirm" },
              ].map((step, idx) => {
                const isActive = pipelineStep === step.id;
                const isDone =
                  ["PROOF", "SIGNING", "BROADCAST", "CONFIRM", "DONE"].indexOf(pipelineStep) > idx;

                return (
                  <div
                    key={step.id}
                    className={`pipeline-step flex flex-col items-center gap-2 bg-[var(--bg-main)] px-2 ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${
                        isActive
                          ? "border-[var(--accent-main)] bg-[var(--accent-main)] text-white animate-bounce"
                          : isDone
                            ? "border-[var(--accent-mint)] bg-[var(--accent-mint)] text-white"
                            : "border-[var(--line-soft)] bg-[var(--bg-main)]"
                      }`}
                    >
                      {isDone ? "✓" : idx + 1}
                    </div>
                    <span>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-sm text-[var(--text-dim)]">Bet:</span>
              {BET_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setBetAmount(opt)}
                  disabled={isSpinning}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    betAmount === opt
                      ? "bg-[var(--accent-main)] text-white shadow-lg"
                      : "bg-[var(--bg-panel)] text-[var(--text-dim)] border border-[var(--line-soft)] hover:border-[var(--accent-main)]"
                  }`}
                >
                  {opt} SUI
                </button>
              ))}
            </div>

            <div className="text-center text-xs text-[var(--text-dim)] mb-2">
              🎯 3 match = 10x &nbsp;|&nbsp; 2 match = 2x &nbsp;|&nbsp; 0 match = lose bet
            </div>

            <Button
              onClick={spin}
              disabled={isSpinning || parseFloat(balance) < parseFloat(betAmount)}
              className="w-full py-6 text-xl shadow-xl shadow-[var(--accent-main)]/20 hover:shadow-[var(--accent-main)]/40 transition-all active:scale-95"
            >
              {isSpinning ? "Spinning..." : `SPIN (${betAmount} SUI)`}
            </Button>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center border border-red-100 animated-appear">
                {error}
              </div>
            )}

            <div className="flex justify-between items-center mt-2">
              <button
                onClick={handleReset}
                className="text-xs text-[var(--text-dim)] hover:text-[var(--accent-main)] flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Reset Stats
              </button>

              {lastDigest && (
                <a
                  href={explorerUrl(lastDigest)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--accent-main)] hover:underline flex items-center gap-1"
                >
                  View Transaction <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-dim)] uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4" /> Recent Spins
          </h3>
          <div className="space-y-2">
            {stats.history.map((item: GameResult) => (
              <div
                key={item.id}
                className="panel p-3 flex items-center justify-between text-sm hover:bg-white/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <a
                    href={explorerUrl(item.digest)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-[var(--accent-main)] bg-[var(--bg-main)] px-2 py-1 rounded border border-[var(--line-soft)] hover:underline"
                  >
                    {item.digest.slice(0, 8)}...
                  </a>
                  <div className="flex gap-1 text-lg">
                    {item.symbols.map((s: string, i: number) => (
                      <span key={i}>{s}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-dim)]">{item.betSui} SUI</span>
                  <span
                    className={`font-bold ${
                      item.outcome === "LOSS"
                        ? "text-[var(--text-dim)]"
                        : item.outcome === "JACKPOT"
                          ? "text-[var(--accent-warm)]"
                          : "text-[var(--accent-mint)]"
                    }`}
                  >
                    {item.outcome === "LOSS" ? "LOSS" : `+${item.payoutSui}`}
                  </span>
                </div>
              </div>
            ))}
            {stats.history.length === 0 && (
              <div className="text-center py-8 text-[var(--text-dim)] italic opacity-60">
                No spins yet. Try your luck!
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
