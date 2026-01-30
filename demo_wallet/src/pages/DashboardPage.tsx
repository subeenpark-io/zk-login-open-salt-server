/**
 * Dashboard Page - Main wallet interface
 */

import { Navigate } from 'react-router-dom';
import { useWalletStore } from '../store/wallet.store';
import { WalletAddress } from '../components/wallet/WalletAddress';
import { BalanceCard } from '../components/wallet/BalanceCard';
import { Button } from '../components/ui/Button';

export function DashboardPage() {
  const { zkAddress, isAuthenticated, logout } = useWalletStore();

  // Redirect to home if not authenticated
  if (!isAuthenticated || !zkAddress) {
    return <Navigate to="/" replace />;
  }

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

        {/* Address and Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <WalletAddress address={zkAddress} />
          <BalanceCard address={zkAddress} />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <Button disabled className="opacity-50 cursor-not-allowed">
              Send SUI
              <span className="text-xs ml-2">(Coming Soon)</span>
            </Button>
            <Button variant="secondary" disabled className="opacity-50 cursor-not-allowed">
              Receive
              <span className="text-xs ml-2">(Coming Soon)</span>
            </Button>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This is a demo wallet running on Sui Devnet.
            Your zkLogin address is deterministically generated from your Google account.
          </p>
        </div>
      </main>
    </div>
  );
}
