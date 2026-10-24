import { useCallback, useState } from 'react';
import type { LogLevel, LogLine } from '../data/types';
import { formatClock } from '../lib/time';

const STORAGE_KEY = 'cr.log';
const MAX_LINES = 100;

export interface UseLogResult {
  lines: LogLine[];
  push: (level: LogLevel, text: string) => void;
}

function readStoredLines(): LogLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is LogLine =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as LogLine).ts === 'string' &&
          typeof (item as LogLine).level === 'string' &&
          typeof (item as LogLine).text === 'string',
      )
      .slice(-MAX_LINES);
  } catch {
    return [];
  }
}

export function useLog(): UseLogResult {
  const [lines, setLines] = useState<LogLine[]>(readStoredLines);

  const push = useCallback((level: LogLevel, text: string) => {
    setLines((prev) => {
      const next = [...prev, { ts: formatClock(new Date()), level, text }].slice(-MAX_LINES);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* 隐私模式下不可写 */
      }
      return next;
    });
  }, []);

  return { lines, push };
}
