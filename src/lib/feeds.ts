import type { ResetEvent } from '../data/types';

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function rssEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** 生成 iCalendar 日历（.ics），供系统日历订阅。 */
export function buildIcs(events: ResetEvent[], calendarName = 'Watermark'): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${calendarName}//Quota Reset Tracker//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
    'X-WR-TIMEZONE:UTC',
  ];

  for (const event of events) {
    const start = new Date(event.announced_at);
    if (Number.isNaN(start.getTime())) continue;
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const kind = event.reset_type === 'banked' ? 'banked' : 'regular';

    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsEscape(event.id)}@watermark`,
      `DTSTAMP:${stamp(start)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${icsEscape(`Codex quota reset (${kind})`)}`,
      `DESCRIPTION:${icsEscape(event.text)}`,
      `URL:${event.url}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

/** 生成 RSS 2.0 订阅源。 */
export function buildRss(
  events: ResetEvent[],
  siteUrl: string,
  title = 'Watermark — Codex quota resets',
): string {
  const items = [...events]
    .sort((a, b) => Date.parse(b.announced_at) - Date.parse(a.announced_at))
    .slice(0, 30)
    .map((event) => {
      const published = new Date(event.announced_at);
      const pubDate = Number.isNaN(published.getTime())
        ? new Date(0).toUTCString()
        : published.toUTCString();
      return [
        '    <item>',
        `      <title>${rssEscape(`Codex quota reset (${event.reset_type})`)}</title>`,
        `      <description>${rssEscape(event.text)}</description>`,
        `      <link>${event.url}</link>`,
        `      <guid isPermaLink="false">${rssEscape(event.id)}</guid>`,
        `      <pubDate>${pubDate}</pubDate>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${rssEscape(title)}</title>`,
    `    <link>${rssEscape(siteUrl)}</link>`,
    `    <description>${rssEscape('Tracked Codex usage-limit resets announced by @thsottiaux')}</description>`,
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    items,
    '  </channel>',
    '</rss>',
  ].join('\n');
}
