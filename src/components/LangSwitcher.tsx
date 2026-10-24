import { LOCALE_LABELS, LOCALES, storeLocale, type Locale } from '../i18n/locales';
import { localeUrl } from '../lib/base';

export interface LangSwitcherProps {
  locale: Locale;
  label: string;
}

export function LangSwitcher({ locale, label }: LangSwitcherProps) {
  return (
    <select
      className="select"
      value={locale}
      aria-label={label}
      onChange={(event) => {
        const next = event.target.value as Locale;
        storeLocale(next);
        window.location.href = localeUrl(next);
      }}
    >
      {LOCALES.map((item) => (
        <option key={item} value={item}>
          {LOCALE_LABELS[item]}
        </option>
      ))}
    </select>
  );
}
