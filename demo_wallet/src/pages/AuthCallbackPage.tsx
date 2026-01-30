/**
 * Auth Callback Page - Handles OAuth callback and wallet creation
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/wallet.store';
import { AuthService } from '../services/auth.service';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Button } from '../components/ui/Button';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const handleCallback = useWalletStore(state => state.handleCallback);
  const status = useWalletStore(state => state.status);
  const error = useWalletStore(state => state.error);

  useEffect(() => {
    const processCallback = async () => {
      const authService = new AuthService();
      const jwt = authService.handleOAuthCallback();

      if (jwt) {
        await handleCallback(jwt);
      } else {
        navigate('/', { state: { error: 'No JWT token received from OAuth provider' } });
      }
    };

    processCallback();
  }, [handleCallback, navigate]);

  // Redirect to dashboard when ready
  useEffect(() => {
    if (status === 'ready') {
      navigate('/wallet');
    }
  }, [status, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      {status === 'loading' && (
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 text-lg font-medium">
            Generating zkLogin wallet...
          </p>
          <p className="mt-2 text-sm text-gray-500">
            This may take a few seconds while we:
          </p>
          <ul className="mt-2 text-sm text-gray-500 space-y-1">
            <li>✓ Fetch your salt from Salt Server</li>
            <li>✓ Compute your zkLogin address</li>
            <li>✓ Generate ZK proof from Mysten Prover</li>
          </ul>
        </div>
      )}

      {error && (
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
            <h2 className="text-lg font-semibold text-red-800 mb-2">
              Authentication Failed
            </h2>
            <p className="text-red-600 text-sm mb-4">{error}</p>
          </div>
          <Button onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>
      )}
    </div>
  );
}
