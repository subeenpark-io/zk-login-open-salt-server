/**
 * Loading Spinner component
 */

import { cn } from "../../utils/cn";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={cn(
          "animate-spin rounded-full border-2 border-[rgba(171,123,81,0.26)] border-t-[var(--accent-main)]",
          sizeClasses[size],
          className
        )}
      />
    </div>
  );
}
