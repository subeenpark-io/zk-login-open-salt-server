/**
 * Wallet Address display component
 */

import { useState } from "react";
import { CheckCheck, Copy } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

interface WalletAddressProps {
  address: string;
}

function shortenAddress(value: string, prefix = 14, suffix = 10): string {
  if (!value) return "";
  if (value.length <= prefix + suffix + 3) return value;
  return `${value.slice(0, prefix)}...${value.slice(-suffix)}`;
}

export function WalletAddress({ address }: WalletAddressProps) {
  const [copied, setCopied] = useState(false);
  const displayAddress = shortenAddress(address);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="micro-label mb-1">zkLogin Address</p>
          <p className="font-mono text-sm leading-relaxed text-[var(--text-main)] truncate" title={address}>
            {displayAddress}
          </p>
        </div>
        <Button variant="secondary" onClick={handleCopy} className="sm:shrink-0 min-w-[110px]">
          {copied ? (
            <>
              <CheckCheck className="h-4 w-4 shrink-0" />
              <span className="inline-block w-[52px] text-center">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 shrink-0" />
              <span className="inline-block w-[52px] text-center">Copy</span>
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
