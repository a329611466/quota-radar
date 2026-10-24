import { useState } from 'react';
import type { ResetEvent, TimeMode } from '../data/types';
import { formatAbsolute, formatRelative } from '../lib/time';

export interface AnnouncementFeedProps {
  events: ResetEvent[];
  locale: string;
  timeMode: TimeMode;
  labels: {
    showAll: string;
    showLess: string;
    viewOnX: string;
    empty: string;
    regular: string;
    banked: string;
  };
}

const COLLAPSED_COUNT = 5;

export function AnnouncementFeed({ events, locale, timeMode, labels }: AnnouncementFeedProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? events : events.slice(0, COLLAPSED_COUNT);

  if (events.length === 0) {
    return <p className="section-sub">{labels.empty}</p>;
  }

  return (
    <>
      <ol className="ledger">
        {visible.map((event) => (
          <li className="ledger__row" key={event.id}>
            <div className="ledger__meta">
              <span className="ledger__time">{formatRelative(event.announced_at, locale)}</span>
              <span className="ledger__abs">
                {formatAbsolute(event.announced_at, locale, timeMode)}
              </span>
            </div>
            <div className="ledger__body">
              <span
                className={`tag ${
                  event.reset_type === 'banked' ? 'tag--banked' : 'tag--regular'
                }`}
              >
                {event.reset_type === 'banked' ? labels.banked : labels.regular}
              </span>
              <p className="ledger__text">{event.text}</p>
              <a
                className="ledger__link"
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {labels.viewOnX} →
              </a>
            </div>
          </li>
        ))}
      </ol>

      {events.length > COLLAPSED_COUNT ? (
        <button
          type="button"
          className="btn ledger__toggle"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? labels.showLess : labels.showAll.replace('{n}', String(events.length))}
        </button>
      ) : null}
    </>
  );
}
