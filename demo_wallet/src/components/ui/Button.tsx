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
        "min-h-[44px] px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center",
        variant === "primary" && "bg-sui-blue text-white hover:bg-blue-600",
        variant === "secondary" && "bg-gray-200 text-gray-800 hover:bg-gray-300",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
