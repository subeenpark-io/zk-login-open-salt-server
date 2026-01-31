/**
 * Balance Card component
 */

import { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { WalletService } from '../../services/wallet.service';

interface BalanceCardProps {
  address: string;
  refreshTrigger?: number;
}

export function BalanceCard({ address, refreshTrigger }: BalanceCardProps) {
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        setError(null);
        const walletService = new WalletService();
        const bal = await walletService.getBalance(address);
        setBalance(bal);
      } catch (err) {
        setError('Failed to fetch balance');
        console.error('Balance fetch error:', err);
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
      <p className="text-sm text-gray-500 mb-2">Balance</p>
      {loading ? (
        <div className="py-4">
          <LoadingSpinner size="sm" />
        </div>
      ) : error ? (
        <p className="text-red-600 text-sm">{error}</p>
      ) : (
        <div>
          <p className="text-3xl font-bold">{balance} SUI</p>
          <p className="text-xs text-gray-400 mt-1">on Devnet</p>
        </div>
      )}
    </Card>
  );
}
