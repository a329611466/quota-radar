import type { ResetEvent } from '../data/types';
import { gapDays } from './forecast';

const DAY_MS = 86_400_000;

export interface IntervalBucket {
  label: string;
  count: number;
  /** 桶的下界（天） */
  from: number;
}

export interface WeekdayStat {
  /** 周一为 0 */
  index: number;
  short: string;
  count: number;
  isWeekend: boolean;
}

export interface QuarterStat {
  key: string;
  regular: number;
  banked: number;
}

export interface RhythmStats {
  buckets: IntervalBucket[];
  weekdays: WeekdayStat[];
  quarters: QuarterStat[];
  /** 近 N 次的平均间隔 */
  recentAvgGap: number;
  recentMedianGap: number;
  /** 全历史平均间隔 */
  fullAvgGap: number;
  /** 工作日重置占比 */
  weekdayShare: number;
  bankedCount: number;
}

const BUCKET_EDGES: { from: number; label: string }[] = [
  { from: 0, label: '<1' },
  { from: 1, label: '1-3' },
  { from: 3, label: '3-7' },
  { from: 7, label: '7-14' },
  { from: 14, label: '14-30' },
  { from: 30, label: '30+' },
];

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid]! + sorted[mid - 1]!) / 2)
    : sorted[mid]!;
}

/** 星期短名（本地化），以周一为第 0 天。 */
function weekdayShortNames(locale: string): string[] {
  const base = Date.UTC(2024, 0, 1); // 2024-01-01 是周一
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(base + i * DAY_MS),
    ),
  );
}

export function analyseRhythm(events: ResetEvent[], locale: string): RhythmStats {
  const gaps = gapDays(events);
  const shortNames = weekdayShortNames(locale);

  const buckets: IntervalBucket[] = BUCKET_EDGES.map((edge) => ({
    label: edge.label,
    from: edge.from,
    count: 0,
  }));
  for (const gap of gaps) {
    let index = buckets.length - 1;
    for (let i = 0; i < buckets.length; i += 1) {
      if (gap < buckets[i]!.from) {
        index = i - 1;
        break;
      }
      if (i === buckets.length - 1) {
        index = buckets.length - 1;
        break;
      }
    }
    if (index >= 0) buckets[index]!.count += 1;
  }

  const weekdayCounts = Array.from({ length: 7 }, () => 0);
  let weekendCount = 0;
  for (const event of events) {
    const day = new Date(event.announced_at).getUTCDay(); // 0=周日
    const index = (day + 6) % 7; // 转成周一为 0
    weekdayCounts[index] = (weekdayCounts[index] ?? 0) + 1;
    if (day === 0 || day === 6) weekendCount += 1;
  }

  const weekdays: WeekdayStat[] = weekdayCounts.map((count, index) => ({
    index,
    short: shortNames[index] ?? '',
    count,
    isWeekend: index >= 5,
  }));

  const quarterMap = new Map<string, QuarterStat>();
  for (const event of events) {
    const date = new Date(event.announced_at);
    const key = `${date.getUTCFullYear()}Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
    const entry = quarterMap.get(key) ?? { key, regular: 0, banked: 0 };
    if (event.reset_type === 'banked') entry.banked += 1;
    else entry.regular += 1;
    quarterMap.set(key, entry);
  }

  const recent = gaps.slice(-20);
  const fullAvgGap = gaps.length
    ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
    : 0;

  return {
    buckets,
    weekdays,
    quarters: [...quarterMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
    recentAvgGap: recent.length ? recent.reduce((sum, gap) => sum + gap, 0) / recent.length : 0,
    recentMedianGap: median(recent),
    fullAvgGap,
    weekdayShare: events.length ? (events.length - weekendCount) / events.length : 0,
    bankedCount: events.filter((event) => event.reset_type === 'banked').length,
  };
}
