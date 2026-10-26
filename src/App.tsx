import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnnouncementFeed } from './components/AnnouncementFeed';
import { CommandPalette } from './components/CommandPalette';
import { ForecastCard } from './components/ForecastCard';
import { Header } from './components/Header';
import { ResetCalendar } from './components/ResetCalendar';
import { RhythmChart } from './components/RhythmChart';
import { Section } from './components/Section';
import { StatsBar } from './components/StatsBar';
import { StatusPanel } from './components/StatusPanel';
import { TerminalLog } from './components/TerminalLog';
import type { TimeMode } from './data/types';
import { useResets } from './data/useResets';
import { useLog } from './hooks/useLog';
import { useNotify } from './hooks/useNotify';
import { useTheme } from './hooks/useTheme';
import { fmt, fmtNode, getDict } from './i18n';
import type { Locale } from './i18n/locales';
import { assetUrl } from './lib/base';
import { downloadCsv, downloadJson } from './lib/export';
import { forecastNextReset, horizonProbabilities } from './lib/forecast';
import { analyseRhythm } from './lib/rhythm';

const THANKS_KEY = 'cr.thanks';
const TZ_KEY = 'cr.tz';

function readThanks(): string[] {
  try {
    const raw = localStorage.getItem(THANKS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function readTimeMode(): TimeMode {
  try {
    return localStorage.getItem(TZ_KEY) === 'local' ? 'local' : 'PT';
  } catch {
    return 'PT';
  }
}

export default function App({ locale }: { locale: Locale }) {
  const dict = getDict(locale);
  const t = useCallback(
    (key: keyof typeof dict, params?: Record<string, string | number>) =>
      fmt(dict[key], params),
    [dict],
  );

  const { status, events, stats, error, lastCheckedAt, generatedAt, source, refresh } = useResets();
  const { theme, setTheme } = useTheme();
  const { lines, push } = useLog();

  const [timeMode, setTimeMode] = useState<TimeMode>(readTimeMode);
  const [pollCount, setPollCount] = useState(0);
  const [thankedIds, setThankedIds] = useState<string[]>(readThanks);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const latest = events[0] ?? null;
  const thanked = latest ? thankedIds.includes(latest.id) : false;

  useEffect(() => {
    try {
      localStorage.setItem(TZ_KEY, timeMode);
    } catch {
      /* 隐私模式下不可写 */
    }
  }, [timeMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const booted = useRef(false);
  useEffect(() => {
    if (status !== 'ready' || booted.current) return;
    booted.current = true;
    const stamp = generatedAt ?? '—';
    if (lines.some((line) => line.text.startsWith('booted ::') && line.text.includes(stamp))) return;
    // source 标明数据来自动态接口（自动更新）还是构建期静态快照
    const via = source === 'api' ? 'via API' : 'static snapshot';
    push('info', `booted :: ${stats.total} events · ${via} · ${stamp}`);
  }, [status, stats.total, generatedAt, source, lines, push]);

  useEffect(() => {
    if (status === 'error' && error) {
      push('err', `load failed :: ${error}`);
    }
  }, [status, error, push]);

  const onThank = useCallback(() => {
    if (!latest || thankedIds.includes(latest.id)) return;
    const next = [...thankedIds, latest.id];
    setThankedIds(next);
    try {
      localStorage.setItem(THANKS_KEY, JSON.stringify(next));
    } catch {
      /* 隐私模式下不可写 */
    }
    const index = events.findIndex((event) => event.id === latest.id);
    const ordinal = events.length - index;
    push('ok', `thanks recorded :: reset #${ordinal} · ${latest.announced_at.slice(0, 16).replace('T', ' ')}Z`);
  }, [events, latest, push, thankedIds]);

  const notify = useNotify({
    latest,
    poll: refresh,
    onPoll: (count) => {
      setPollCount((prev) => prev + 1);
      push('info', `poll :: ${count} events`);
    },
    onFire: (event) => {
      push('ok', `reset detected :: ${event.announced_at}`);
    },
    onToggle: (on) => {
      push('info', on ? 'notify enabled :: polling every 2 min' : 'notify disabled');
    },
  });

  const forecast = useMemo(() => forecastNextReset(events), [events, pollCount]);
  const horizons = useMemo(
    () => horizonProbabilities(events, [1, 2, 3, 4, 5, 6, 7]),
    [events, pollCount],
  );
  const rhythm = useMemo(() => analyseRhythm(events, locale), [events, locale]);

  const accountLink = (
    <a href="https://x.com/thsottiaux" target="_blank" rel="noopener noreferrer">
      @thsottiaux
    </a>
  );

  const snapshotMeta = useMemo(() => {
    if (!generatedAt) return '';
    return `${t('footer.snapshot')} ${generatedAt.slice(0, 10)}`;
  }, [generatedAt, t]);

  return (
    <>
      <Header
        status={status}
        lastCheckedAt={lastCheckedAt}
        pollCount={pollCount}
        theme={theme}
        onChangeTheme={setTheme}
        onOpenPalette={() => setPaletteOpen(true)}
        locale={locale}
        labels={{
          tag: t('brand.tag'),
          live: t('header.live'),
          offline: t('header.offline'),
          loading: t('header.loading'),
          error: t('header.error'),
          lastPoll: t('header.lastPoll'),
          polls: t('header.polls'),
          lang: t('header.lang'),
          theme: t('header.theme'),
          themeNames: {
            felt: t('theme.felt'),
            ink: t('theme.ink'),
            memphis: t('theme.memphis'),
            neon: t('theme.neon'),
          },
          x: t('header.x'),
          search: t('header.search'),
        }}
      />

      <div className="shell">
        <main>
          <p className="hero-explainer">
            {fmtNode(dict['intro.watch'], { account: accountLink })}
          </p>

          <StatusPanel
            latest={latest}
            stats={stats}
            locale={locale}
            timeMode={timeMode}
            onTimeModeChange={setTimeMode}
            thanked={thanked}
            onThank={onThank}
            notify={{
              supported: notify.supported,
              permission: notify.permission,
              enabled: notify.enabled,
              onToggle: () => void notify.toggle(),
            }}
            error={status === 'error' ? error : null}
            onRetry={() => void refresh()}
            labels={{
              lastReset: t('status.lastReset'),
              noReset: t('status.noReset'),
              tiboTime: t('status.tiboTime'),
              localTime: t('status.localTime'),
              thanks: t('status.thanks'),
              thanksDone: t('status.thanksDone'),
              notify: t('status.notify'),
              notifyOn: t('status.notifyOn'),
              notifyBlocked: t('status.notifyBlocked'),
              notifyUnsupported: t('status.notifyUnsupported'),
              retry: t('status.retry'),
              regular: t('resetType.regular'),
              banked: t('resetType.banked'),
            }}
          />

          <StatsBar
            stats={stats}
            labels={{
              total: t('stats.total'),
              avgInterval: t('stats.avgInterval'),
              longestWait: t('stats.longestWait'),
              days: t('stats.days'),
            }}
          />

          <Section title={t('forecast.title')} sub={t('forecast.sub')}>
            <ForecastCard
              forecast={forecast}
              horizons={horizons}
              labels={{
                likelyOne: t('forecast.likelyOne'),
                likelyRange: t('forecast.likelyRange'),
                sub: t('forecast.detail'),
                chartTitle: t('forecast.chartTitle'),
                within: t('forecast.within'),
                window: t('forecast.window'),
                typical: t('forecast.typical'),
                note: t('forecast.note'),
                days: t('stats.days'),
              }}
            />
          </Section>

          <Section title={t('rhythm.title')} sub={t('rhythm.sub')}>
            <RhythmChart
              rhythm={rhythm}
              labels={{
                intervals: t('rhythm.intervals'),
                weekdays: t('rhythm.weekdays'),
                days: t('stats.days'),
                recent: t('rhythm.recent'),
                full: t('rhythm.full'),
              }}
            />
          </Section>

          <Section title={t('calendar.title')} sub={t('calendar.sub')}>
            <ResetCalendar
              events={events}
              locale={locale}
              labels={{
                count: t('calendar.count'),
                viewSource: t('calendar.viewSource'),
                regular: t('resetType.regular'),
                banked: t('resetType.banked'),
                empty: t('calendar.empty'),
                hint: t('calendar.hint'),
                latest: t('calendar.latest'),
              }}
            />
          </Section>

          <Section title={t('feed.title')} sub={t('feed.sub')}>
            <AnnouncementFeed
              events={events}
              locale={locale}
              timeMode={timeMode}
              labels={{
                showAll: t('feed.showAll'),
                showLess: t('feed.showLess'),
                viewOnX: t('feed.viewOnX'),
                empty: t('feed.empty'),
                regular: t('resetType.regular'),
                banked: t('resetType.banked'),
              }}
            />
          </Section>

          <Section title={t('export.title')} sub={t('export.sub')}>
            <div className="export">
              <button type="button" className="btn" onClick={() => downloadCsv(events)}>
                {t('export.csv')}
              </button>
              <button type="button" className="btn" onClick={() => downloadJson(events)}>
                {t('export.json')}
              </button>
              <a className="btn" href={assetUrl('quota-watermark.ics')} download>
                {t('export.ics')}
              </a>
              <a className="btn" href={assetUrl('feed.xml')} target="_blank" rel="noopener noreferrer">
                {t('export.rss')}
              </a>
            </div>
          </Section>

          <Section title={t('notify.title')} sub={t('notify.sub')}>
            <div className="strip">
              <span className="strip__text">{t('notify.desc')}</span>
              <button
                type="button"
                className="btn btn--mint"
                onClick={() => void notify.toggle()}
                disabled={!notify.supported || notify.permission === 'denied'}
                aria-pressed={notify.enabled}
              >
                {notify.enabled ? t('notify.disable') : t('notify.enable')}
              </button>
            </div>
          </Section>

          <Section title={t('log.title')} sub={t('log.sub')}>
            <TerminalLog lines={lines} />
          </Section>
        </main>

        <footer className="site-footer">
          <div className="site-footer__row">
            <span>{fmtNode(dict['footer.data'], { account: accountLink })}</span>
          </div>
          <div className="site-footer__row site-footer__meta">
            <span>{t('footer.disclaimer')}</span>
          </div>
          <div className="site-footer__row site-footer__meta">
            <span>
              {t('footer.source')}:{' '}
              <a href="https://codex-resets.com/api/resets" target="_blank" rel="noopener noreferrer">
                codex-resets.com/api/resets
              </a>
            </span>
            <span>{snapshotMeta}</span>
          </div>
          <div className="site-footer__row site-footer__meta">
            <span>{t('footer.upstream')}</span>
          </div>
          <div className="site-footer__egg">{t('footer.easterEgg')}</div>
        </footer>
      </div>

      <CommandPalette
        open={paletteOpen}
        events={events}
        locale={locale}
        onClose={() => setPaletteOpen(false)}
        labels={{
          placeholder: t('palette.placeholder'),
          empty: t('palette.empty'),
          hint: t('palette.hint'),
        }}
      />
    </>
  );
}
