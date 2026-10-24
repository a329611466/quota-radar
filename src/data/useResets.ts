import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assetUrl } from '../lib/base';
import { deriveStats } from '../lib/stats';
import type { DataFile, DerivedStats, ResetEvent } from './types';

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface UseResetsResult {
  status: LoadStatus;
  events: ResetEvent[];
  stats: DerivedStats;
  error: string | null;
  lastCheckedAt: Date | null;
  generatedAt: string | null;
  refresh: () => Promise<ResetEvent[] | null>;
}

export function useResets(): UseResetsResult {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [events, setEvents] = useState<ResetEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async (): Promise<ResetEvent[] | null> => {
    try {
      const response = await fetch(assetUrl('data/resets.json'), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as DataFile;
      if (!alive.current) return null;

      const next = Array.isArray(data.events) ? data.events : [];
      setEvents(next);
      setGeneratedAt(typeof data.generated_at === 'string' ? data.generated_at : null);
      setLastCheckedAt(new Date());
      setStatus('ready');
      setError(null);
      return next;
    } catch (cause) {
      if (!alive.current) return null;
      setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
      setError(cause instanceof Error ? cause.message : String(cause));
      return null;
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);

  const stats = useMemo(() => deriveStats(events), [events]);

  return { status, events, stats, error, lastCheckedAt, generatedAt, refresh };
}
