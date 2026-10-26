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
  /** 数据来源：Worker 动态接口 还是 构建期静态快照 */
  source: 'api' | 'static' | null;
  refresh: () => Promise<ResetEvent[] | null>;
}

async function fetchJson(url: string, cache: RequestCache): Promise<DataFile | null> {
  try {
    const response = await fetch(url, { cache });
    if (!response.ok) return null;
    const data = (await response.json()) as DataFile;
    return Array.isArray(data?.events) ? data : null;
  } catch {
    return null;
  }
}

export function useResets(): UseResetsResult {
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [events, setEvents] = useState<ResetEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [source, setSource] = useState<'api' | 'static' | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async (): Promise<ResetEvent[] | null> => {
    // 优先读 Worker 的动态接口：数据由 Cron 每 15 分钟写入 KV，永远是新的。
    // 接口不可用时回退到构建期静态快照，站点仍可正常展示。
    const dynamic = await fetchJson(assetUrl('api/resets'), 'no-cache');
    const fallback = dynamic ? null : await fetchJson(assetUrl('data/resets.json'), 'no-store');
    const data = dynamic ?? fallback;

    if (!alive.current) return null;
    if (!data) {
      setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
      setError('无法加载重置数据');
      return null;
    }

    setEvents(data.events);
    setGeneratedAt(typeof data.generated_at === 'string' ? data.generated_at : null);
    setLastCheckedAt(new Date());
    setStatus('ready');
    setError(null);
    setSource(dynamic ? 'api' : 'static');
    return data.events;
  }, []);

  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
    };
  }, [refresh]);

  const stats = useMemo(() => deriveStats(events), [events]);

  return { status, events, stats, error, lastCheckedAt, generatedAt, source, refresh };
}
