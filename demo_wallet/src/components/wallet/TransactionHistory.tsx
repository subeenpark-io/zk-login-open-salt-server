/**
 * Transaction History component
 */

import { useState, useEffect } from "react";
import { WalletService } from "../../services/wallet.service";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { Card } from "../ui/Card";

interface Transaction {
  digest: string;
  timestampMs?: string;
}

interface TransactionHistoryProps {
  address: string;
  refreshTrigger?: number;
}

export function TransactionHistory({ address, refreshTrigger }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const network = import.meta.env.VITE_SUI_NETWORK || "testnet";

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const walletService = new WalletService();
        const result = await walletService.getTransactionHistory(address, 10);
        setTransactions(result.data as Transaction[]);
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [address, refreshTrigger]);

  const formatTime = (timestampMs?: string) => {
    if (!timestampMs) return "";
    const date = new Date(parseInt(timestampMs));
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const explorerUrl = (digest: string) => {
    return `https://${network}.suivision.xyz/txblock/${digest}`;
  };

  if (loading) {
    return (
      <Card>
        <h3 className="display-font text-2xl text-[var(--text-main)]">Recent Transactions</h3>
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="display-font text-2xl text-[var(--text-main)]">Recent Transactions</h3>
        <a
          href={`https://${network}.suivision.xyz/account/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--accent-main)] hover:underline"
        >
          View all
        </a>
      </div>

      {transactions.length === 0 ? (
        <div className="py-8 text-center text-[var(--text-dim)]">
          <p>No transactions yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div
              key={tx.digest}
              className="flex flex-col gap-1 rounded-lg border border-[rgba(171,123,81,0.2)] bg-[rgba(255,249,240,0.84)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between last:mb-0"
            >
              <a
                href={explorerUrl(tx.digest)}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-mono text-xs text-[var(--accent-main)] hover:underline sm:text-sm"
                title={tx.digest}
              >
                {tx.digest.slice(0, 10)}...{tx.digest.slice(-8)}
              </a>
              <span className="text-xs text-[var(--text-dim)] sm:whitespace-nowrap">
                {formatTime(tx.timestampMs)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
