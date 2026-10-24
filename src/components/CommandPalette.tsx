import { useEffect, useMemo, useRef, useState } from 'react';
import type { ResetEvent } from '../data/types';
import { formatRelative } from '../lib/time';

export interface CommandPaletteProps {
  open: boolean;
  events: ResetEvent[];
  locale: string;
  onClose: () => void;
  labels: { placeholder: string; empty: string; hint: string };
}

export function CommandPalette({ open, events, locale, onClose, labels }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return events.slice(0, 30);
    return events
      .filter((event) => {
        return (
          event.text.toLowerCase().includes(keyword) ||
          event.announced_at.includes(keyword) ||
          event.reset_type.includes(keyword)
        );
      })
      .slice(0, 60);
  }, [events, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    const active = listRef.current?.querySelector('[aria-selected="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const openEvent = (event: ResetEvent) => {
    window.open(event.url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const onKeyDown = (keyEvent: React.KeyboardEvent<HTMLInputElement>) => {
    if (keyEvent.key === 'ArrowDown') {
      keyEvent.preventDefault();
      setCursor((prev) => (results.length === 0 ? 0 : (prev + 1) % results.length));
    } else if (keyEvent.key === 'ArrowUp') {
      keyEvent.preventDefault();
      setCursor((prev) =>
        results.length === 0 ? 0 : (prev - 1 + results.length) % results.length,
      );
    } else if (keyEvent.key === 'Enter') {
      keyEvent.preventDefault();
      const target = results[cursor];
      if (target) openEvent(target);
    } else if (keyEvent.key === 'Escape') {
      keyEvent.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="palette-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label={labels.placeholder}>
        <input
          ref={inputRef}
          className="palette__input"
          value={query}
          placeholder={labels.placeholder}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          aria-label={labels.placeholder}
          aria-controls="palette-list"
        />

        {results.length === 0 ? (
          <div className="palette__empty">{labels.empty}</div>
        ) : (
          <ul className="palette__list" id="palette-list" role="listbox">
            {results.map((event, index) => (
              <li
                key={event.id}
                className="palette__item"
                role="option"
                aria-selected={index === cursor}
                onMouseEnter={() => setCursor(index)}
                onClick={() => openEvent(event)}
              >
                <span className="palette__item-time">
                  {formatRelative(event.announced_at, locale)} · {event.announced_at.slice(0, 10)}
                </span>
                <span className="palette__item-text">{event.text}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="palette__hint">{labels.hint}</div>
      </div>
    </div>
  );
}
