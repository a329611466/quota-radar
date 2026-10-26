/**
 * Cloudflare Worker 入口。
 *
 * 两件事：
 *  1. 定时（Cron）从上游抓取重置数据，归一化后写入 KV
 *  2. 提供 /api/resets、/api/status、.ics、feed.xml 四个动态接口，
 *     其余路径回落到静态资源（ASSETS）
 *
 * 这样数据每 15 分钟自动更新一次，不需要重新构建部署。
 */
import { normalizeUpstream, type RawPayload } from '../src/lib/normalize';
import { buildIcs, buildRss } from '../src/lib/feeds';
import type { ResetEvent } from '../src/data/types';

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

export interface Env {
  ASSETS: Fetcher;
  RESETS: KVNamespace;
}

const UPSTREAM = 'https://codex-resets.com/api/resets';
const SNAPSHOT_KEY = 'snapshot';
/** 快照保留 30 天，防止上游长期异常时留下过期数据。 */
const SNAPSHOT_TTL = 60 * 60 * 24 * 30;
/**
 * 读时机会刷新：快照超过这个时长，就在响应前顺手向上游拉一次。
 * Cron（15 分钟）只作为兜底，正常情况下数据延迟在 5 分钟以内。
 */
const STALE_AFTER_MS = 5 * 60 * 1000;

interface Snapshot {
  version: number;
  generated_at: string;
  source: { provider: string; account: string };
  events: ResetEvent[];
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
};

async function refreshSnapshot(env: Env): Promise<void> {
  try {
    const response = await fetch(UPSTREAM, { headers: { accept: 'application/json' } });
    if (!response.ok) {
      console.error(`upstream HTTP ${response.status}`);
      return;
    }

    const payload = (await response.json()) as RawPayload;
    const events = normalizeUpstream(payload);
    if (events.length === 0) {
      console.error('upstream returned 0 events, keeping previous snapshot');
      return;
    }

    const snapshot: Snapshot = {
      version: 1,
      generated_at: new Date().toISOString(),
      source: { provider: UPSTREAM, account: '@thsottiaux' },
      events,
    };

    await env.RESETS.put(SNAPSHOT_KEY, JSON.stringify(snapshot), {
      expirationTtl: SNAPSHOT_TTL,
    });
    console.log(`snapshot updated: ${events.length} events`);
  } catch (error) {
    console.error(`refresh failed: ${(error as Error).message}`);
  }
}

async function readSnapshot(env: Env): Promise<Snapshot | null> {
  const raw = await env.RESETS.get(SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

/** 快照是否已过期。 */
function isStale(snapshot: Snapshot | null): boolean {
  if (!snapshot) return true;
  const age = Date.now() - Date.parse(snapshot.generated_at);
  return !Number.isFinite(age) || age > STALE_AFTER_MS;
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // KV 读取失败不能影响静态资源，退回空快照走静态回退逻辑
    let snapshot: Snapshot | null = null;
    try {
      snapshot = await readSnapshot(env);
    } catch (error) {
      console.error(`kv read failed: ${(error as Error).message}`);
    }

    // 读时机会刷新：快照超过 5 分钟就当场拉一次上游，再返回最新结果。
    // 拉取失败不会抛错——继续用旧快照，站点照常可用。
    if (isStale(snapshot)) {
      try {
        await refreshSnapshot(env);
        snapshot = await readSnapshot(env);
      } catch (error) {
        console.error(`opportunistic refresh failed: ${(error as Error).message}`);
      }
    }

    if (url.pathname === '/api/resets') {
      if (snapshot) {
        return new Response(JSON.stringify(snapshot), {
          headers: { ...JSON_HEADERS, 'cache-control': 'public, max-age=900' },
        });
      }
      // 还没有跑过 cron，回退到构建期静态快照
      return env.ASSETS.fetch(new Request(new URL('/data/resets.json', url), request));
    }

    if (url.pathname === '/api/status') {
      if (!snapshot) {
        return new Response(JSON.stringify({ error: 'no snapshot yet' }), {
          status: 503,
          headers: JSON_HEADERS,
        });
      }
      const events = snapshot.events;
      const latest = events[0] ?? null;
      return new Response(
        JSON.stringify({
          data: {
            latest_reset: latest,
            stats: {
              total: events.length,
              last_reset_at: latest?.announced_at ?? null,
              days_since_last: latest
                ? (Date.now() - Date.parse(latest.announced_at)) / 86_400_000
                : null,
            },
          },
          meta: { generated_at: snapshot.generated_at },
        }),
        { headers: { ...JSON_HEADERS, 'cache-control': 'public, max-age=900' } },
      );
    }

    if (url.pathname === '/quota-radar.ics') {
      const events = snapshot?.events ?? [];
      return new Response(buildIcs(events), {
        headers: {
          'content-type': 'text/calendar; charset=utf-8',
          'cache-control': 'public, max-age=900',
        },
      });
    }

    if (url.pathname === '/feed.xml') {
      const events = snapshot?.events ?? [];
      return new Response(buildRss(events, url.origin), {
        headers: {
          'content-type': 'application/rss+xml; charset=utf-8',
          'cache-control': 'public, max-age=900',
        },
      });
    }

    // 其余路径交给静态资源
    const response = await env.ASSETS.fetch(request);
    return response;
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refreshSnapshot(env));
  },
};
