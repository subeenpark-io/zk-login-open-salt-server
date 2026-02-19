/**
 * Send SUI Modal component
 */

import { useState } from "react";
import { Button } from "../ui/Button";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { WalletService } from "../../services/wallet.service";
import { StorageService } from "../../services/storage.service";
import { ProverService } from "../../services/prover.service";
import { useWalletStore } from "../../store/wallet.store";

interface SendSuiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (digest: string) => void;
}

export function SendSuiModal({ isOpen, onClose, onSuccess }: SendSuiModalProps) {
  const { zkAddress, salt: storeSalt, jwt: storeJwt } = useWalletStore();
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!toAddress || !amount) {
      setError("Please fill in all fields");
      return;
    }

    const salt = storeSalt || sessionStorage.getItem("zklogin_salt");
    const jwt = storeJwt || sessionStorage.getItem("zklogin_jwt");

    if (!zkAddress || !salt || !jwt) {
      setError("Session expired. Please login again.");
      return;
    }

    if (!toAddress.startsWith("0x") || toAddress.length !== 66) {
      setError("Invalid Sui address format");
      return;
    }

    const amountNum = parseFloat(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setError("Invalid amount");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ephemeralData = StorageService.loadEphemeralData();
      if (!ephemeralData) {
        throw new Error("Session expired. Please login again.");
      }

      const proverService = new ProverService();
      const freshProof = await proverService.generateZkProof({
        jwt,
        salt,
        ephemeralPublicKey: ephemeralData.extendedEphemeralPublicKey,
        maxEpoch: ephemeralData.maxEpoch,
        randomness: ephemeralData.randomness,
      });
      proverService.cacheProof(freshProof);

      const walletService = new WalletService();
      const digest = await walletService.sendSui({
        fromAddress: zkAddress,
        toAddress,
        amount,
        privateKey: ephemeralData.privateKey,
        zkProof: freshProof,
        maxEpoch: ephemeralData.maxEpoch,
        userSalt: salt,
        jwt,
      });

      onSuccess(digest);
      setToAddress("");
      setAmount("");
      onClose();
    } catch (err) {
      console.error("Send failed:", err);
      setError(err instanceof Error ? err.message : "Failed to send SUI");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(54,30,12,0.35)] p-4 backdrop-blur-sm sm:items-center">
      <div className="panel w-full max-w-md p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="micro-label">Transfer</p>
            <h2 className="display-font mt-1 text-3xl text-[var(--text-main)]">Send SUI</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[rgba(171,123,81,0.32)] bg-[rgba(255,247,236,0.84)] px-2 py-1 text-xs text-[var(--text-dim)] hover:text-[var(--text-main)]"
          >
            Close
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="send-to" className="field-label">
              Recipient Address
            </label>
            <input
              id="send-to"
              type="text"
              value={toAddress}
              onChange={(event) => setToAddress(event.target.value)}
              placeholder="0x..."
              className="field-input"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="send-amount" className="field-label">
              Amount (SUI)
            </label>
            <input
              id="send-amount"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.0"
              step="0.001"
              min="0"
              className="field-input"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-[rgba(240,173,55,0.45)] bg-[rgba(240,173,55,0.14)] p-3">
              <p className="text-sm text-[#8f4918]">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={loading} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={loading || !toAddress || !amount} className="flex-1">
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-1">Sending...</span>
                </>
              ) : (
                "Send"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
