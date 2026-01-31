/**
 * Landing Page - Marketing page with Google OAuth login
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoginButton } from "../components/wallet/LoginButton";
import { useWalletStore } from "../store/wallet.store";

export function LandingPage() {
  const navigate = useNavigate();
  const isAuthenticated = useWalletStore((state) => state.isAuthenticated);
  const zkAddress = useWalletStore((state) => state.zkAddress);

  // Redirect to wallet if already authenticated
  useEffect(() => {
    if (isAuthenticated && zkAddress) {
      navigate("/wallet");
    }
  }, [isAuthenticated, zkAddress, navigate]);

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center bg-gradient-to-br from-sui-dark to-gray-900 text-white safe-area-inset">
      <div className="max-w-2xl mx-auto text-center px-4 sm:px-6">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">zkLogin Wallet</h1>
        <p className="text-lg sm:text-xl text-gray-300 mb-8">
          Login with Google, get a Sui wallet. No seed phrases, no passwords.
        </p>

        <LoginButton />

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="text-4xl mb-3">🔐</div>
            <h3 className="font-semibold text-lg mb-2">Secure</h3>
            <p className="text-sm text-gray-400">
              zkLogin uses zero-knowledge proofs to protect your privacy
            </p>
          </div>
          <div>
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="font-semibold text-lg mb-2">Fast</h3>
            <p className="text-sm text-gray-400">Sign in with Google in seconds</p>
          </div>
          <div>
            <div className="text-4xl mb-3">🌐</div>
            <h3 className="font-semibold text-lg mb-2">Decentralized</h3>
            <p className="text-sm text-gray-400">Your keys, your crypto, your control</p>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-gray-700">
          <p className="text-sm text-gray-400">
            Powered by <span className="text-sui-blue font-semibold">Sui zkLogin</span>
          </p>
        </div>
      </div>
    </div>
  );
}
