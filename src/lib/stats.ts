import type { DerivedStats, ResetEvent } from '../data/types';

const DAY_MS = 86_400_000;

/**
 * 由事件列表推导所有统计指标。口径与上游站点一致：
 * - avgIntervalDays = 相邻事件间隔的算术平均
 * - longestWaitDays = 相邻事件间隔的最大值
 * - daysSinceLast  = 距最近一次重置的天数
 */
export function deriveStats(events: ResetEvent[], now: Date = new Date()): DerivedStats {
  const times = events.map((e) => Date.parse(e.announced_at)).filter((t) => !Number.isNaN(t));
  const sorted = [...times].sort((a, b) => a - b);
  const total = sorted.length;

  let avgIntervalDays = 0;
  let longestWaitDays = 0;
  if (total >= 2) {
    let sum = 0;
    for (let i = 1; i < total; i += 1) {
      const gap = (sorted[i]! - sorted[i - 1]!) / DAY_MS;
      sum += gap;
      if (gap > longestWaitDays) longestWaitDays = gap;
    }
    avgIntervalDays = sum / (total - 1);
  }

  const regularCount = events.filter((e) => e.reset_type === 'regular').length;
  const bankedCount = events.filter((e) => e.reset_type === 'banked').length;

  const lastResetAt = total > 0 ? new Date(sorted[total - 1]!).toISOString() : null;
  const daysSinceLast = lastResetAt
    ? Math.max(0, (now.getTime() - Date.parse(lastResetAt)) / DAY_MS)
    : 0;

  return {
    total,
    regularCount,
    bankedCount,
    lastResetAt,
    daysSinceLast,
    avgIntervalDays,
    longestWaitDays,
  };
}
