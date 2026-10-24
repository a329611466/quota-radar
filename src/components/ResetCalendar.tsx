import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { ResetEvent } from '../data/types';
import {
  buildMonthGrid,
  dataMonthRange,
  groupEventsByUtcDay,
  monthRange,
} from '../lib/calendar';
import { weekdayHeaders } from '../lib/time';

/** 只展示最近 N 个月的日历。 */
const MONTH_COUNT = 5;

export interface ResetCalendarProps {
  events: ResetEvent[];
  locale: string;
  labels: {
    count: string;
    viewSource: string;
    regular: string;
    banked: string;
    empty: string;
    hint: string;
    latest: string;
  };
}

export function ResetCalendar({ events, locale, labels }: ResetCalendarProps) {
  const eventsByDay = useMemo(() => groupEventsByUtcDay(events), [events]);
  const range = useMemo(() => dataMonthRange(events), [events]);
  const weekdays = useMemo(() => weekdayHeaders(locale), [locale]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [fade, setFade] = useState({ left: false, right: false });
  const scrollRef = useRef<HTMLDivElement>(null);

  const months = useMemo(() => {
    if (!range) return [];
    return monthRange(range.first, range.last).slice(-MONTH_COUNT);
  }, [range]);

  // 默认停在最新的一侧，进来就能看到最近的重置，不用横向拖动
  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [months.length]);

  // 两侧还有内容时给出渐隐，提示可以横向滚动
  const syncFade = () => {
    const element = scrollRef.current;
    if (!element) return;
    setFade({
      left: element.scrollLeft > 2,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
    });
  };

  useEffect(() => {
    syncFade();
  }, [months.length]);

  const scrollToLatest = () => {
    const element = scrollRef.current;
    if (!element) return;
    // scrollWidth 超过最大可滚动距离，必须减去可视宽度，否则会被 clamp 回 0。
    // 这里用直接赋值而不是 scrollTo({behavior:'smooth'})——后者在部分环境里是空操作。
    element.scrollLeft = element.scrollWidth - element.clientWidth;
    syncFade();
  };

  const activeKey = hoveredKey ?? selectedKey;
  const activeEvents = activeKey ? (eventsByDay.get(activeKey) ?? []) : [];
  const activeType = activeEvents.some((event) => event.reset_type === 'banked')
    ? 'banked'
    : activeEvents.length
      ? 'regular'
      : null;

  if (!range) {
    return <p className="section-sub">{labels.empty}</p>;
  }

  return (
    <div>
      <div className="cg-head">
        <button type="button" className="btn" onClick={scrollToLatest}>
          {labels.latest} →
        </button>
        <span className="cg-detail__hint">{labels.hint}</span>
      </div>

      <div
        className="cg-scroll"
        ref={scrollRef}
        onScroll={syncFade}
        style={
          {
            '--fade-left': fade.left ? 1 : 0,
            '--fade-right': fade.right ? 1 : 0,
          } as CSSProperties
        }
      >
        <div className="cg-grid" role="group" aria-label={labels.hint}>
          {months.map((month) => (
            <div className="cg-month-block" key={month.key}>
              <div className="cg-month">{month.key}</div>
              {/* 星期表头放在月块内部，横向滚动后依然与自己的日期列对齐 */}
              <div className="cg-weekdays" aria-hidden="true">
                {weekdays.map((weekday) => (
                  <span key={weekday} className="cg-weekday">
                    {weekday}
                  </span>
                ))}
              </div>
              <div className="cg-month-cells">
                {buildMonthGrid(month.year, month.month)
                  .flat()
                  .map((cell) => {
                    if (!cell.key) {
                      return <span key="blank" className="cg-cell" aria-hidden="true" />;
                    }
                    const dayEvents = eventsByDay.get(cell.key) ?? [];
                    if (dayEvents.length === 0) {
                      return <span key={cell.key} className="cg-cell" aria-hidden="true" />;
                    }
                    const banked = dayEvents.some((event) => event.reset_type === 'banked');
                    return (
                      <span className="cg-wrap" key={cell.key}>
                        <button
                          type="button"
                          className={`cg-cell cg-cell--event ${
                            banked ? 'cg-cell--banked' : 'cg-cell--regular'
                          }`}
                          onMouseEnter={() => setHoveredKey(cell.key)}
                          onMouseLeave={() => setHoveredKey(null)}
                          onFocus={() => setHoveredKey(cell.key)}
                          onBlur={() => setHoveredKey(null)}
                          onClick={() =>
                            setSelectedKey((prev) => (prev === cell.key ? null : cell.key))
                          }
                          aria-label={`${cell.key} · ${banked ? labels.banked : labels.regular} · ${dayEvents.length}`}
                        >
                          {cell.day}
                        </button>
                        {dayEvents.length > 1 ? (
                          <span className="cg-badge">{dayEvents.length}</span>
                        ) : null}
                      </span>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="cg-detail">
        {activeEvents.length > 0 && activeKey ? (
          <>
            <strong>{activeKey}</strong>
            <span className={`tag ${activeType === 'banked' ? 'tag--banked' : 'tag--regular'}`}>
              {activeType === 'banked' ? labels.banked : labels.regular}
            </span>
            <span className="cg-detail__text">{activeEvents[0]!.text}</span>
            <a href={activeEvents[0]!.url} target="_blank" rel="noopener noreferrer">
              {labels.viewSource} →
            </a>
          </>
        ) : (
          <span className="cg-detail__hint">{labels.hint}</span>
        )}
      </div>
    </div>
  );
}
