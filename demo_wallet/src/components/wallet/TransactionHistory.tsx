/**
 * Transaction History component
 */

import { useState, useEffect } from "react";
import { WalletService } from "../../services/wallet.service";
import { LoadingSpinner } from "../ui/LoadingSpinner";

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

  const network = import.meta.env.VITE_SUI_NETWORK || "devnet";

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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-xl font-semibold mb-4">Recent Transactions</h3>
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Recent Transactions</h3>
        <a
          href={`https://${network}.suivision.xyz/account/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-sui-blue hover:underline"
        >
          View all
        </a>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No transactions yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div
              key={tx.digest}
              className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
            >
              <a
                href={explorerUrl(tx.digest)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-sui-blue hover:underline"
                title={tx.digest}
              >
                {tx.digest.slice(0, 10)}...{tx.digest.slice(-8)}
              </a>
              <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                {formatTime(tx.timestampMs)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
