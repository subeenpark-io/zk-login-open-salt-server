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
        "min-h-[46px] px-4 py-2 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2",
        variant === "primary" &&
          "text-slate-950 bg-[var(--accent-main)] hover:bg-[var(--accent-strong)] shadow-[0_8px_24px_rgba(45,212,191,0.28)]",
        variant === "secondary" &&
          "text-[var(--text-main)] bg-[rgba(168,190,238,0.12)] border border-[rgba(162,186,235,0.4)] hover:bg-[rgba(168,190,238,0.2)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
