import type { ResetEvent } from '../data/types';

export interface DayCell {
  /** 'YYYY-MM-DD'（UTC），空白占位为 null */
  key: string | null;
  day: number;
  inMonth: boolean;
}

export interface MonthRef {
  year: number;
  /** 0-11 */
  month: number;
  /** 'YYYY-MM' */
  key: string;
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function monthKey(year: number, month: number): string {
  return `${year}-${pad2(month + 1)}`;
}

/**
 * 取事件的 UTC 日期键。必须用 UTC：若按本地时区切分，位于 UTC 傍晚的重置
 * 在东八区会被错误归到次日。
 */
export function eventDateKey(iso: string): string {
  return iso.slice(0, 10);
}

export function groupEventsByUtcDay(events: ResetEvent[]): Map<string, ResetEvent[]> {
  const map = new Map<string, ResetEvent[]>();
  for (const event of events) {
    const key = eventDateKey(event.announced_at);
    const list = map.get(key);
    if (list) list.push(event);
    else map.set(key, [event]);
  }
  return map;
}

/**
 * 生成某个月的日历网格：周一起始，固定 6 行 × 7 列，便于 12 个月横向排布时高度一致。
 */
export function buildMonthGrid(year: number, month: number): DayCell[][] {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;

  const cells: DayCell[] = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ key: null, day: 0, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: `${monthKey(year, month)}-${pad2(day)}`, day, inMonth: true });
  }
  while (cells.length < 42) {
    cells.push({ key: null, day: 0, inMonth: false });
  }

  const weeks: DayCell[][] = [];
  for (let i = 0; i < 42; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/** 由事件列表推导数据覆盖的月份范围。 */
export function dataMonthRange(events: ResetEvent[]): { first: MonthRef; last: MonthRef } | null {
  if (events.length === 0) return null;
  let min = events[0]!.announced_at;
  let max = events[0]!.announced_at;
  for (const event of events) {
    if (event.announced_at < min) min = event.announced_at;
    if (event.announced_at > max) max = event.announced_at;
  }
  const firstDate = new Date(min);
  const lastDate = new Date(max);
  return {
    first: { year: firstDate.getUTCFullYear(), month: firstDate.getUTCMonth(), key: min.slice(0, 7) },
    last: { year: lastDate.getUTCFullYear(), month: lastDate.getUTCMonth(), key: max.slice(0, 7) },
  };
}

/** 闭区间 [from, to] 的月份序列。 */
export function monthRange(from: MonthRef, to: MonthRef): MonthRef[] {
  const months: MonthRef[] = [];
  let year = from.year;
  let month = from.month;
  while (year < to.year || (year === to.year && month <= to.month)) {
    months.push({ year, month, key: monthKey(year, month) });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return months;
}

/** 数据覆盖的所有年份，升序。 */
export function dataYears(events: ResetEvent[]): number[] {
  const years = new Set<number>();
  for (const event of events) {
    years.add(new Date(event.announced_at).getUTCFullYear());
  }
  return [...years].sort((a, b) => a - b);
}
