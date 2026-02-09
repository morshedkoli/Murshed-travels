import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'card' | 'circle' | 'text' | 'avatar';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className,
  variant = 'default',
  width,
  height,
}: SkeletonProps) {
  const baseStyles = 'animate-pulse bg-muted rounded-md';

  const variantStyles = {
    default: '',
    card: 'rounded-2xl',
    circle: 'rounded-full',
    text: 'rounded-sm',
    avatar: 'rounded-full',
  };

  const dimensions = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
  };

  return (
    <div
      className={cn(baseStyles, variantStyles[variant], className)}
      style={dimensions}
    />
  );
}

// Pre-built skeleton patterns
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border/70 bg-card p-5', className)}>
      <Skeleton className="h-4 w-24 mb-2" variant="text" />
      <Skeleton className="h-8 w-32" />
    </div>
  );
}

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-border/70 bg-card p-5', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-4 w-20" variant="text" />
      </div>
      <Skeleton className="h-8 w-28" />
    </div>
  );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 py-3 px-4">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === 0 ? 'flex-1' : 'w-24')}
          variant="text"
        />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/50 bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn('h-4', i === 0 ? 'flex-1' : 'w-24')}
              variant="text"
            />
          ))}
        </div>
      </div>
      {/* Rows */}
      <div className="divide-y divide-border/50">
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} columns={columns} />
        ))}
      </div>
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" variant="text" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" variant="text" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeaderSkeleton />

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Table */}
      <TableSkeleton rows={6} columns={8} />
    </div>
  );
}
