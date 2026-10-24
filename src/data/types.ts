export type ResetType = 'regular' | 'banked';

export type EventSource = 'observed' | 'webhook' | 'backfill';

export interface ResetEvent {
  id: string;
  url: string;
  announced_at: string;
  reset_type: ResetType;
  text: string;
  source: EventSource;
}

export interface DataFile {
  version: number;
  generated_at: string;
  source: { provider: string; account: string };
  events: ResetEvent[];
}

export interface DerivedStats {
  total: number;
  regularCount: number;
  bankedCount: number;
  lastResetAt: string | null;
  daysSinceLast: number;
  avgIntervalDays: number;
  longestWaitDays: number;
}

export type Theme = 'felt' | 'ink' | 'memphis' | 'neon';

export type TimeMode = 'PT' | 'local';

export type LogLevel = 'info' | 'ok' | 'warn' | 'err';

export interface LogLine {
  ts: string;
  level: LogLevel;
  text: string;
}
