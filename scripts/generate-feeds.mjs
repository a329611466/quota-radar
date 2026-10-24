#!/usr/bin/env node
/**
 * 构建时生成日历订阅（.ics）与 RSS。
 *
 *   node scripts/generate-feeds.mjs
 *
 * .ics 只放已确认发生的重置，不放预测事件——预测是概率推断，
 * 混进日历容易被当成确定的时间表。预测只在页面上以概率窗口呈现。
 *
 * 部署时可用 SITE_ORIGIN 环境变量指定站点地址（用于 RSS 的 channel link）：
 *   SITE_ORIGIN=https://your-domain.example npm run build
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA = resolve(ROOT, 'public/data/resets.json');
const DIST = resolve(ROOT, 'dist');

const SITE_ORIGIN = process.env.SITE_ORIGIN ?? '';
/** RSS 的 channel link：优先用站点地址，没有就指向事件真正的来源账号。 */
const CHANNEL_LINK = SITE_ORIGIN || 'https://x.com/thsottiaux';
const CALENDAR_NAME = 'Watermark';

function icsEscape(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function rfcStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

async function main() {
  const raw = JSON.parse(await readFile(DATA, 'utf8'));
  const events = [...raw.events].sort(
    (a, b) => Date.parse(a.announced_at) - Date.parse(b.announced_at),
  );

  // ---------- ICS ----------
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${CALENDAR_NAME}//Quota Reset Tracker//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(CALENDAR_NAME)}`,
    'X-WR-TIMEZONE:UTC',
  ];

  for (const event of events) {
    const start = new Date(event.announced_at);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const kind = event.reset_type === 'banked' ? 'banked' : 'regular';
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@watermark`,
      `DTSTAMP:${icsDate(start)}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsEscape(`Codex quota reset (${kind})`)}`,
      `DESCRIPTION:${icsEscape(event.text)}`,
      `URL:${event.url}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  await writeFile(resolve(DIST, 'quota-watermark.ics'), `${lines.join('\r\n')}\r\n`, 'utf8');
  console.log(`> wrote quota-watermark.ics (${events.length} events)`);

  // ---------- RSS ----------
  const rssItems = [...events]
    .reverse()
    .slice(0, 30)
    .map((event) => {
      const pubDate = new Date(event.announced_at).toUTCString();
      return [
        '    <item>',
        `      <title>${icsEscape(`Codex quota reset (${event.reset_type})`)}</title>`,
        `      <description>${icsEscape(event.text)}</description>`,
        `      <link>${event.url}</link>`,
        `      <guid isPermaLink="false">${event.id}</guid>`,
        `      <pubDate>${pubDate}</pubDate>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const rss = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${icsEscape(CALENDAR_NAME)} — Codex quota resets</title>`,
    `    <link>${CHANNEL_LINK}</link>`,
    `    <description>${icsEscape('Tracked Codex usage-limit resets announced by @thsottiaux')}</description>`,
    `    <lastBuildDate>${rfcStamp(new Date())}</lastBuildDate>`,
    rssItems,
    '  </channel>',
    '</rss>',
  ].join('\n');

  await writeFile(resolve(DIST, 'feed.xml'), `${rss}\n`, 'utf8');
  console.log('> wrote feed.xml');
}

main().catch((error) => {
  console.error(`! generate-feeds failed: ${error.message}`);
  process.exit(1);
});
