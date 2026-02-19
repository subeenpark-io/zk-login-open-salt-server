/**
 * Button component
 */

import { cn } from "../../utils/cn";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}

export function Button({ children, className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold tracking-[0.01em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,107,69,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-main)]",
        variant === "primary" &&
          "border border-[rgba(255,107,69,0.5)] bg-[var(--accent-main)] text-white shadow-[0_10px_26px_rgba(235,79,37,0.28)] hover:-translate-y-[1px] hover:bg-[var(--accent-strong)]",
        variant === "secondary" &&
          "border border-[rgba(171,123,81,0.32)] bg-[rgba(255,247,236,0.84)] text-[var(--text-main)] hover:-translate-y-[1px] hover:bg-[rgba(255,240,222,0.94)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
