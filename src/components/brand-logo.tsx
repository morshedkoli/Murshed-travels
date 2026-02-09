import { cn } from '@/lib/utils';

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
};

export function BrandLogo({ className, compact = false }: BrandLogoProps) {
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <div className="relative grid h-9 w-9 place-content-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-sm shadow-primary/30 ring-1 ring-primary/25">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path
            d="M5.5 17.5V7.5m6.5 10V5.5m6.5 12V10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4.5 18.5h15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.9"
          />
        </svg>
      </div>

      {!compact ? (
        <div className="leading-tight">
          <p className="text-[18px] font-extrabold tracking-tight text-text-primary">Murshed Travels</p>
          <p className="text-[11px] text-text-muted">Accounting Console</p>
        </div>
      ) : null}
    </div>
  );
}
