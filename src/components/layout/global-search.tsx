'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { searchContacts } from '@/actions/search';
import { Input } from '@/components/ui/input';

type ResultRow = {
  id: string;
  type: 'user' | 'vendor';
  name: string;
  phone: string;
  href: '/customers' | '/vendors';
};

export function GlobalSearch() {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const rows = await searchContacts(normalized);
        if (!active) return;
        setResults(rows);
        setOpen(true);
      } finally {
        if (active) setLoading(false);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  function handleSelect(item: ResultRow) {
    setOpen(false);
    setQuery('');
    const params = new URLSearchParams({
      q: `${item.name} ${item.phone}`.trim(),
      id: item.id,
      type: item.type,
    });
    router.push(`${item.href}?${params.toString()}`);
  }

  return (
    <div ref={wrapperRef} className="relative hidden md:block">
      <div className="flex w-[300px] items-center gap-2 rounded-full border border-border/80 bg-background px-3 py-1.5">
        <Search className="h-4 w-4 text-text-muted" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder="Search name or phone"
          className="h-auto border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
        />
      </div>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[360px] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl">
          <div className="border-b border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Search results
          </div>

          {loading ? <p className="px-3 py-3 text-sm text-muted-foreground">Searching...</p> : null}

          {!loading && results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No matching user/vendor found.</p>
          ) : null}

          {!loading && results.length > 0 ? (
            <div className="max-h-80 overflow-y-auto py-1">
              {results.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-primary/8"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.phone}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${item.type === 'user' ? 'bg-primary/15 text-primary' : 'bg-secondary/15 text-secondary'}`}>
                    {item.type}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
