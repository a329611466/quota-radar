import type { TimeMode } from '../data/types';

const TIBO_TIME_ZONE = 'America/Los_Angeles';

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export function resolveTimeZone(mode: TimeMode): string {
  if (mode === 'PT') return TIBO_TIME_ZONE;
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/**
 * 时区缩写。必须固定用 en-US —— ICU 在 zh-CN 等 locale 下会把
 * America/Los_Angeles 的短名退化成 "GMT-7"，拿不到 "PDT"。
 */
function timeZoneAbbreviation(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(
      date,
    );
    return parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

/**
 * 绝对时间。日期与时间分开格式化，避免英文 locale 插入 " at " 之类的连接词。
 */
export function formatAbsolute(iso: string, locale: string, mode: TimeMode): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const timeZone = resolveTimeZone(mode);
  const datePart = new Intl.DateTimeFormat(locale, {
    timeZone,
    month: 'long',
    day: 'numeric',
  }).format(date);
  const timePart = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  const abbr = timeZoneAbbreviation(date, timeZone);

  return abbr ? `${datePart} ${timePart} ${abbr}` : `${datePart} ${timePart}`;
}

/**
 * 相对时间，如 "10 hours ago" / "10小时前" / "3日前"。
 */
export function formatRelative(iso: string, locale: string, now: Date = new Date()): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  const diff = time - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const abs = Math.abs(diff);
  if (abs < MINUTE) return rtf.format(0, 'second');
  if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), 'minute');
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), 'hour');
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), 'day');
  if (abs < 365 * DAY) return rtf.format(Math.round(diff / (30 * DAY)), 'month');
  return rtf.format(Math.round(diff / (365 * DAY)), 'year');
}

/** 日志用的本地 HH:MM:SS。 */
export function formatClock(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 日志用的 UTC HH:MM:SS。 */
export function formatUtcClock(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/** 本地化星期表头，周一起始。 */
export function weekdayHeaders(locale: string): string[] {
  // 2024-01-01 是周一，用它作为基准周
  const base = Date.UTC(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base + i * DAY);
    return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(d);
  });
}
