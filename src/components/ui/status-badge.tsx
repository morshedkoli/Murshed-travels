'use client';

import { cn } from '@/lib/utils';

type StatusVariant = 
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'pending'
  | 'delivered'
  | 'cancelled'
  | 'paid'
  | 'unpaid'
  | 'partial';

interface StatusBadgeProps {
  children: React.ReactNode;
  variant?: StatusVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<StatusVariant, string> = {
  default: 'bg-muted text-muted-foreground border-transparent',
  primary: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  danger: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400',
  info: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
  pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
  unpaid: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400',
  partial: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
};

const dotColors: Record<StatusVariant, string> = {
  default: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-blue-500',
  pending: 'bg-amber-500',
  delivered: 'bg-emerald-500',
  cancelled: 'bg-rose-500',
  paid: 'bg-emerald-500',
  unpaid: 'bg-rose-500',
  partial: 'bg-blue-500',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export function StatusBadge({
  children,
  variant = 'default',
  size = 'md',
  className,
  dot = false,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium uppercase tracking-wider',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            size === 'sm' && 'h-1 w-1',
            size === 'lg' && 'h-2 w-2',
            dotColors[variant]
          )}
        />
      )}
      {children}
    </span>
  );
}

// Quick variants for common use cases
export const PendingBadge = (props: Omit<StatusBadgeProps, 'variant'>) => (
  <StatusBadge {...props} variant="pending" />
);

export const DeliveredBadge = (props: Omit<StatusBadgeProps, 'variant'>) => (
  <StatusBadge {...props} variant="delivered" />
);

export const PaidBadge = (props: Omit<StatusBadgeProps, 'variant'>) => (
  <StatusBadge {...props} variant="paid" />
);

export const UnpaidBadge = (props: Omit<StatusBadgeProps, 'variant'>) => (
  <StatusBadge {...props} variant="unpaid" />
);

export const SuccessBadge = (props: Omit<StatusBadgeProps, 'variant'>) => (
  <StatusBadge {...props} variant="success" />
);

export const WarningBadge = (props: Omit<StatusBadgeProps, 'variant'>) => (
  <StatusBadge {...props} variant="warning" />
);

export const DangerBadge = (props: Omit<StatusBadgeProps, 'variant'>) => (
  <StatusBadge {...props} variant="danger" />
);
