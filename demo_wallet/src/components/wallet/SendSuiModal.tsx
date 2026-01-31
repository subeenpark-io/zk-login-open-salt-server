/**
 * Send SUI Modal component
 */

import { useState } from 'react';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { WalletService } from '../../services/wallet.service';
import { StorageService } from '../../services/storage.service';
import { useWalletStore } from '../../store/wallet.store';

interface SendSuiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (digest: string) => void;
}

export function SendSuiModal({ isOpen, onClose, onSuccess }: SendSuiModalProps) {
  const { zkAddress, zkProof: storeZkProof, salt: storeSalt, jwt: storeJwt } = useWalletStore();
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!toAddress || !amount) {
      setError('Please fill in all fields');
      return;
    }

    // Get data from store or sessionStorage
    const salt = storeSalt || sessionStorage.getItem('zklogin_salt');
    const jwt = storeJwt || sessionStorage.getItem('zklogin_jwt');
    const zkProofStr = sessionStorage.getItem('zklogin_proof');
    const zkProof = storeZkProof || (zkProofStr ? JSON.parse(zkProofStr) : null);

    if (!zkAddress || !zkProof || !salt || !jwt) {
      setError('Session expired. Please login again.');
      return;
    }

    // Validate address format
    if (!toAddress.startsWith('0x') || toAddress.length !== 66) {
      setError('Invalid Sui address format');
      return;
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Invalid amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ephemeralData = StorageService.loadEphemeralData();
      if (!ephemeralData) {
        throw new Error('Session expired. Please login again.');
      }

      const walletService = new WalletService();
      const digest = await walletService.sendSui({
        fromAddress: zkAddress,
        toAddress,
        amount,
        privateKey: ephemeralData.privateKey,
        zkProof,
        maxEpoch: ephemeralData.maxEpoch,
        userSalt: salt,
        jwt,
      });

      onSuccess(digest);
      setToAddress('');
      setAmount('');
      onClose();
    } catch (err) {
      console.error('Send failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to send SUI');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Send SUI</h2>

        <div className="space-y-4">
          {/* To Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recipient Address
            </label>
            <input
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sui-blue focus:border-transparent"
              disabled={loading}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (SUI)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              step="0.001"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sui-blue focus:border-transparent"
              disabled={loading}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={loading || !toAddress || !amount}
              className="flex-1"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Sending...</span>
                </>
              ) : (
                'Send'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
