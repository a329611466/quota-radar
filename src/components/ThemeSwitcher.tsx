import { useEffect, useRef, useState } from 'react';
import type { Theme } from '../data/types';

export const THEME_OPTIONS = [
  { id: 'felt', swatch: ['#f2e9dd', '#c8643c'] },
  { id: 'ink', swatch: ['#fff6e4', '#2f9e6a'] },
  { id: 'memphis', swatch: ['#fdf7e6', '#ff4f8b'] },
  { id: 'neon', swatch: ['#14142a', '#6ef0d0'] },
] as const satisfies readonly { id: Theme; swatch: readonly [string, string] }[];

export interface ThemeSwitcherProps {
  theme: Theme;
  onChange: (theme: Theme) => void;
  label: string;
  names: Record<Theme, string>;
}

export function ThemeSwitcher({ theme, onChange, label, names }: ThemeSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="theme-switcher" ref={rootRef}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        title={label}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.7 1.9-1.7h1.6a4.2 4.2 0 0 0 4.2-4.2c0-3.9-3.8-7-8.5-7Z" />
          <circle cx="8" cy="10" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="16" cy="9.5" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {open ? (
        <div className="theme-menu" role="menu" aria-label={label}>
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className="theme-menu__item"
              role="menuitemradio"
              aria-checked={theme === option.id}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
            >
              <span
                className="theme-swatch"
                style={{
                  background: option.swatch[0],
                  boxShadow: `inset -8px -8px 0 ${option.swatch[1]}`,
                }}
              />
              {names[option.id]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
