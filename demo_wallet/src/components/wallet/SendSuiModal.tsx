/**
 * Send SUI Modal component
 */

import { useState } from "react";
import { Button } from "../ui/Button";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { WalletService } from "../../services/wallet.service";
import { StorageService } from "../../services/storage.service";
import { useWalletStore } from "../../store/wallet.store";

interface SendSuiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (digest: string) => void;
}

export function SendSuiModal({ isOpen, onClose, onSuccess }: SendSuiModalProps) {
  const { zkAddress, zkProof: storeZkProof, salt: storeSalt, jwt: storeJwt } = useWalletStore();
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
    const zkProofStr = sessionStorage.getItem("zklogin_proof");
    const zkProof = storeZkProof || (zkProofStr ? JSON.parse(zkProofStr) : null);

    if (!zkAddress || !zkProof || !salt || !jwt) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(5,9,20,0.7)] p-4 backdrop-blur-sm sm:items-center">
      <div className="panel w-full max-w-md p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="micro-label">Transfer</p>
            <h2 className="display-font mt-1 text-3xl text-[var(--text-main)]">Send SUI</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[rgba(255,255,255,0.2)] px-2 py-1 text-xs text-[var(--text-dim)] hover:text-[var(--text-main)]"
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
            <div className="rounded-xl border border-[rgba(255,122,89,0.45)] bg-[rgba(255,122,89,0.08)] p-3">
              <p className="text-sm text-[#ffc3b4]">{error}</p>
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
