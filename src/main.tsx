import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { isLocale, type Locale } from './i18n/locales';
import './styles/tokens.css';
import './styles/global.css';

function resolveLocale(): Locale {
  const attr = document.documentElement.dataset.locale;
  return isLocale(attr) ? attr : 'en';
}

const locale = resolveLocale();
document.documentElement.lang = locale;

const container = document.getElementById('root');
if (!container) {
  throw new Error('#root not found');
}

createRoot(container).render(
  <StrictMode>
    <App locale={locale} />
  </StrictMode>,
);
