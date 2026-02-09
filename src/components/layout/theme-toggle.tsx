'use client';

import { Laptop, Moon, Sun } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';

type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'murshed-travels:theme-mode';

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;

  return 'system';
}

function isSystemDark() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeToggle() {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);
  const [systemDark, setSystemDark] = useState(isSystemDark);

  const resolvedMode = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedMode === 'dark');
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode, resolvedMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mediaQuery.matches);

    onChange();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', onChange);
    } else {
      mediaQuery.addListener(onChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', onChange);
      } else {
        mediaQuery.removeListener(onChange);
      }
    };
  }, []);

  function cycleMode() {
    setMode((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  }

  const label = mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System';
  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Laptop;

  if (!hydrated) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-9 gap-2 rounded-xl px-3 text-text-muted hover:bg-primary/10 hover:text-text-primary"
      onClick={cycleMode}
      aria-label={`Theme mode: ${label}. Click to switch`}
      title={`Theme mode: ${label}. Click to switch`}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden text-xs font-semibold sm:inline">{label}</span>
    </Button>
  );
}
