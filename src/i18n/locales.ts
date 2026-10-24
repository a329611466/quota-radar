export const LOCALES = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  ko: '한국어',
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value !== null && value !== undefined && (LOCALES as readonly string[]).includes(value);
}

export function detectLocale(): Locale {
  const stored = readStoredLocale();
  if (stored) return stored;
  const nav = navigator.language || 'en';
  if (nav.startsWith('zh')) return /TW|HK|Hant/i.test(nav) ? 'zh-TW' : 'zh-CN';
  if (nav.startsWith('ja')) return 'ja';
  if (nav.startsWith('ko')) return 'ko';
  return 'en';
}

function readStoredLocale(): Locale | null {
  try {
    const value = localStorage.getItem('cr.locale');
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem('cr.locale', locale);
  } catch {
    /* 隐私模式下不可写，忽略 */
  }
}
