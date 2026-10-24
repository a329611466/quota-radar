import type { ReactNode } from 'react';
import { en, type Dict, type DictKey } from './en';
import { zhCN } from './zh-CN';
import { zhTW } from './zh-TW';
import { ja } from './ja';
import { ko } from './ko';
import type { Locale } from './locales';

export const DICTIONARIES: Record<Locale, Dict> = {
  en,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  ja,
  ko,
};

export type { Dict, DictKey };

/** 把模板里的 {name} 替换为参数值（纯文本场景）。 */
export function fmt(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/** 同上，但参数可以是 ReactNode，用于把账号名渲染成外链。 */
export function fmtNode(
  template: string,
  params: Record<string, ReactNode>,
): ReactNode {
  const parts: ReactNode[] = [];
  const regex = /\{(\w+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) !== null) {
    parts.push(template.slice(lastIndex, match.index));
    const key = match[1]!;
    parts.push(key in params ? params[key] : match[0]);
    lastIndex = match.index + match[0].length;
  }
  parts.push(template.slice(lastIndex));

  return parts.length === 1 ? parts[0]! : parts;
}

export function getDict(locale: Locale): Dict {
  return DICTIONARIES[locale];
}
