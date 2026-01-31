/**
 * Dashboard Page - Main wallet interface
 */

import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useWalletStore } from '../store/wallet.store';
import { WalletAddress } from '../components/wallet/WalletAddress';
import { BalanceCard } from '../components/wallet/BalanceCard';
import { SendSuiModal } from '../components/wallet/SendSuiModal';
import { TransactionHistory } from '../components/wallet/TransactionHistory';
import { Button } from '../components/ui/Button';

export function DashboardPage() {
  const { zkAddress, isAuthenticated, logout } = useWalletStore();
  const [showSendModal, setShowSendModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastTxDigest, setLastTxDigest] = useState<string | null>(null);

  // Redirect to home if not authenticated
  if (!isAuthenticated || !zkAddress) {
    return <Navigate to="/" replace />;
  }

  const handleSendSuccess = (digest: string) => {
    setLastTxDigest(digest);
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-sui-dark">zkLogin Wallet</h1>
          <Button variant="secondary" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900">My Wallet</h2>
          <p className="text-gray-600 mt-1">Manage your Sui assets</p>
        </div>

        {/* Success message */}
        {lastTxDigest && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-green-800">
                <strong>Transaction sent!</strong>
              </p>
              <a
                href={`https://${import.meta.env.VITE_SUI_NETWORK || 'devnet'}.suivision.xyz/txblock/${lastTxDigest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-600 hover:underline font-mono"
              >
                {lastTxDigest.slice(0, 16)}...{lastTxDigest.slice(-8)}
              </a>
            </div>
            <button
              onClick={() => setLastTxDigest(null)}
              className="text-green-600 hover:text-green-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Address and Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <WalletAddress address={zkAddress} />
          <BalanceCard address={zkAddress} refreshTrigger={refreshTrigger} />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <Button onClick={() => setShowSendModal(true)}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send SUI
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(zkAddress);
                alert('Address copied to clipboard!');
              }}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy Address
            </Button>
          </div>
        </div>

        {/* Transaction History */}
        <TransactionHistory address={zkAddress} refreshTrigger={refreshTrigger} />

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This is a demo wallet running on Sui Devnet.
            Get free devnet SUI from the{' '}
            <a
              href="https://faucet.sui.io/?network=devnet"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-blue-600"
            >
              Sui Faucet
            </a>
            .
          </p>
        </div>
      </main>

      {/* Send Modal */}
      <SendSuiModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        onSuccess={handleSendSuccess}
      />
    </div>
  );
}
