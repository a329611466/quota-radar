import type { Locale } from '../i18n/locales';

/**
 * 站点根路径。页面固定位于 <root>/<locale>/index.html，
 * 因此从当前地址上溯一级即为站点根，兼容域名根目录与子路径部署。
 */
export const BASE_URL: string = new URL('../', window.location.href).href;

export function assetUrl(path: string): string {
  return new URL(path, BASE_URL).href;
}

export function localeUrl(locale: Locale): string {
  return new URL(`${locale}/index.html`, BASE_URL).href;
}
