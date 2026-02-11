/**
 * Card component
 */

import { cn } from '../../utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'panel p-5 sm:p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
