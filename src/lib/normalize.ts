import type { EventSource, ResetEvent } from '../data/types';

const VALID_SOURCES: EventSource[] = ['observed', 'webhook', 'backfill'];

/** 上游接口的原始条目（字段名与本项目内部结构不同）。 */
export interface RawEvent {
  tweet_id?: string;
  id?: string;
  tweet_url?: string;
  url?: string;
  announced_at?: string;
  reset_type?: string;
  text?: string;
  source?: string;
}

export interface RawPayload {
  events?: RawEvent[];
}

/**
 * 把上游接口的原始数据归一化成项目内部结构。
 *
 * 这个函数被三处共用，保证 Worker（写入 KV）、刷新脚本（写静态快照）
 * 和构建脚本（生成 .ics）用同一套口径，不会出现分歧：
 *  - worker/index.ts
 *  - scripts/refresh-data.mjs
 *  - scripts/generate-feeds.mjs
 */
export function normalizeUpstream(payload: RawPayload | RawEvent[]): ResetEvent[] {
  const list = Array.isArray(payload) ? payload : (payload?.events ?? []);

  const byId = new Map<string, ResetEvent>();
  for (const raw of list) {
    const id = String(raw.tweet_id ?? raw.id ?? '').trim();
    if (!id || !raw.announced_at) continue;

    const time = Date.parse(raw.announced_at);
    if (Number.isNaN(time)) continue;
    if (byId.has(id)) continue;

    const source = raw.source as EventSource | undefined;
    byId.set(id, {
      id,
      url: String(raw.tweet_url ?? raw.url ?? ''),
      announced_at: new Date(time).toISOString(),
      reset_type: raw.reset_type === 'banked' ? 'banked' : 'regular',
      text: String(raw.text ?? ''),
      source: source && VALID_SOURCES.includes(source) ? source : 'backfill',
    });
  }

  return [...byId.values()].sort(
    (a, b) => Date.parse(b.announced_at) - Date.parse(a.announced_at),
  );
}
