import { useCallback, useEffect, useState } from 'react';
import type { Theme } from '../data/types';

const STORAGE_KEY = 'cr.theme';
const THEMES: Theme[] = ['felt', 'ink', 'memphis', 'neon'];

function readInitialTheme(): Theme {
  const attr = document.documentElement.dataset.theme;
  if (attr === 'felt' || attr === 'ink' || attr === 'memphis' || attr === 'neon') return attr;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'felt' || stored === 'ink' || stored === 'memphis' || stored === 'neon') {
      return stored;
    }
  } catch {
    /* 隐私模式下不可读 */
  }
  return 'felt';
}

export interface UseThemeResult {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);

  const setTheme = useCallback((next: Theme) => {
    if (!THEMES.includes(next)) return;
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 隐私模式下不可写 */
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return { theme, setTheme };
}
