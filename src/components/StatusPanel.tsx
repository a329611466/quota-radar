import type { DerivedStats, ResetEvent, TimeMode } from '../data/types';
import { formatAbsolute, formatRelative } from '../lib/time';

export interface StatusPanelProps {
  latest: ResetEvent | null;
  stats: DerivedStats;
  locale: string;
  timeMode: TimeMode;
  onTimeModeChange: (mode: TimeMode) => void;
  thanked: boolean;
  onThank: () => void;
  notify: {
    supported: boolean;
    permission: NotificationPermission | 'unsupported';
    enabled: boolean;
    onToggle: () => void;
  };
  error: string | null;
  onRetry: () => void;
  labels: {
    lastReset: string;
    noReset: string;
    tiboTime: string;
    localTime: string;
    thanks: string;
    thanksDone: string;
    notify: string;
    notifyOn: string;
    notifyBlocked: string;
    notifyUnsupported: string;
    retry: string;
    regular: string;
    banked: string;
  };
}

export function StatusPanel({
  latest,
  stats,
  locale,
  timeMode,
  onTimeModeChange,
  thanked,
  onThank,
  notify,
  error,
  onRetry,
  labels,
}: StatusPanelProps) {
  const notifyLabel = !notify.supported
    ? labels.notifyUnsupported
    : notify.permission === 'denied'
      ? labels.notifyBlocked
      : notify.enabled
        ? labels.notifyOn
        : labels.notify;

  return (
    <>
      <div className="hero-toolbar">
        <div className="actions">
          <button
            type="button"
            className="btn"
            onClick={() => onTimeModeChange('PT')}
            aria-pressed={timeMode === 'PT'}
          >
            {labels.tiboTime}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => onTimeModeChange('local')}
            aria-pressed={timeMode === 'local'}
          >
            {labels.localTime}
          </button>
          <button
            type="button"
            className="btn btn--flag"
            onClick={notify.onToggle}
            disabled={!notify.supported || notify.permission === 'denied'}
            aria-pressed={notify.enabled}
          >
            <svg className="btn__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7Z" />
              <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
            </svg>
            {notifyLabel}
          </button>
        </div>
      </div>

      <div className="readout plate">
        <span className="readout__label">{labels.lastReset}</span>

        {latest ? (
          <div className="readout__figure">
            <span className="readout__value">{formatRelative(latest.announced_at, locale)}</span>
            <span className="readout__time">
              {formatAbsolute(latest.announced_at, locale, timeMode)}
            </span>
          </div>
        ) : (
          <div className="readout__figure">
            <span className="readout__value readout__value--muted">{labels.noReset}</span>
            <span className="readout__time">
              {stats.total} · {stats.regularCount} {labels.regular} · {stats.bankedCount}{' '}
              {labels.banked}
            </span>
          </div>
        )}

        <div className="readout__footer">
          {latest ? (
            <span
              className={`tag ${
                latest.reset_type === 'banked' ? 'tag--banked' : 'tag--regular'
              }`}
            >
              {latest.reset_type === 'banked' ? labels.banked : labels.regular}
            </span>
          ) : null}

          <button
            type="button"
            className="btn"
            onClick={onThank}
            disabled={!latest || thanked}
            aria-pressed={thanked}
          >
            {thanked ? labels.thanksDone : labels.thanks}
          </button>
        </div>

        {error ? (
          <div className="readout__error">
            <span>{error}</span>
            <button type="button" className="btn" onClick={onRetry}>
              {labels.retry}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
