'use client';

import { useEffect } from 'react';
import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type DashboardAutoRefreshProps = {
  intervalMs?: number;
};

const STORAGE_KEY = 'dashboard:auto-refresh-enabled';

export function DashboardAutoRefresh({ intervalMs = 60000 }: DashboardAutoRefreshProps) {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const router = useRouter();
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(STORAGE_KEY) !== 'false';
  });

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  }, [enabled, hydrated]);

  useEffect(() => {
    if (!hydrated || !enabled) return;

    const timer = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [router, intervalMs, enabled, hydrated]);

  if (!hydrated) return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-background p-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-2 rounded-lg px-3 text-xs"
        onClick={() => setEnabled((prev) => !prev)}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${enabled ? 'text-success' : 'text-muted-foreground'}`} />
        Auto-refresh: {enabled ? 'On' : 'Off'}
      </Button>
    </div>
  );
}
