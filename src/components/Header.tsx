import type { LoadStatus } from '../data/useResets';
import type { Theme } from '../data/types';
import type { Locale } from '../i18n/locales';
import { formatUtcClock } from '../lib/time';
import { LangSwitcher } from './LangSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';

export interface HeaderProps {
  status: LoadStatus;
  lastCheckedAt: Date | null;
  pollCount: number;
  theme: Theme;
  onChangeTheme: (theme: Theme) => void;
  onOpenPalette: () => void;
  locale: Locale;
  labels: {
    tag: string;
    live: string;
    offline: string;
    loading: string;
    error: string;
    lastPoll: string;
    polls: string;
    lang: string;
    theme: string;
    themeNames: Record<Theme, string>;
    x: string;
    search: string;
  };
}

export function Header({
  status,
  lastCheckedAt,
  pollCount,
  theme,
  onChangeTheme,
  onOpenPalette,
  locale,
  labels,
}: HeaderProps) {
  const state =
    status === 'ready' ? labels.live : status === 'error' ? labels.error : labels.loading;
  const dotClass =
    status === 'ready'
      ? 'presence-dot'
      : status === 'error'
        ? 'presence-dot presence-dot--error'
        : 'presence-dot presence-dot--idle';

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <div className="brand">
          <span className="brand__name">Quota Radar</span>
          <span className="brand__tag">{labels.tag}</span>
        </div>

        <div className="masthead-presence" aria-live="polite">
          <span className={dotClass} aria-hidden="true" />
          <span>{state}</span>
          <span className="presence-meta">
            {labels.lastPoll} {lastCheckedAt ? formatUtcClock(lastCheckedAt) : '--:--:--'}Z ·{' '}
            {labels.polls} {pollCount}
          </span>
        </div>

        <div className="masthead-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={onOpenPalette}
            aria-label={labels.search}
            title={labels.search}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-3.6-3.6" />
            </svg>
          </button>
          <LangSwitcher locale={locale} label={labels.lang} />
          <a
            className="icon-btn"
            href="https://x.com/codex_resets"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={labels.x}
            title={labels.x}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ fill: 'currentColor', stroke: 'none' }}>
              <path d="M18.9 2H22l-6.8 7.8L23 22h-6.3l-4.9-6.4L6.2 22H3l7.3-8.3L2.3 2h6.4l4.4 5.9L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z" />
            </svg>
          </a>
          <ThemeSwitcher
            theme={theme}
            onChange={onChangeTheme}
            label={labels.theme}
            names={labels.themeNames}
          />
        </div>
      </div>
    </header>
  );
}
