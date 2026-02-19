/**
 * Balance Card component
 */

import { useEffect, useState } from "react";
import { Card } from "../ui/Card";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { WalletService } from "../../services/wallet.service";

interface BalanceCardProps {
  address: string;
  refreshTrigger?: number;
}

export function BalanceCard({ address, refreshTrigger }: BalanceCardProps) {
  const [balance, setBalance] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const network = import.meta.env.VITE_SUI_NETWORK || "testnet";

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        setError(null);
        const walletService = new WalletService();
        const bal = await walletService.getBalance(address);
        setBalance(bal);
      } catch (err) {
        setError("Failed to fetch balance");
        console.error("Balance fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (address) {
      fetchBalance();
    }
  }, [address, refreshTrigger]);

  return (
    <Card>
      <p className="micro-label mb-2">Balance</p>
      {loading ? (
        <div className="py-4">
          <LoadingSpinner size="sm" />
        </div>
      ) : error ? (
        <p className="text-sm text-[#9a4f1d]">{error}</p>
      ) : (
        <div>
          <p className="display-font break-words text-3xl leading-tight text-[var(--text-main)]">{balance} SUI</p>
          <p className="mt-1 text-xs text-[var(--text-dim)]">on {network}</p>
        </div>
      )}
    </Card>
  );
}
