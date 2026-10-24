import type { ResetEvent } from '../data/types';

function triggerDownload(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function downloadCsv(events: ResetEvent[]): void {
  const header = ['id', 'announced_at', 'reset_type', 'source', 'text', 'url'];
  const rows = events.map((event) =>
    [
      event.id,
      event.announced_at,
      event.reset_type,
      event.source,
      event.text,
      event.url,
    ]
      .map(escapeCsv)
      .join(','),
  );
  triggerDownload(
    'quota-watermark-resets.csv',
    'text/csv;charset=utf-8',
    `${header.join(',')}\n${rows.join('\n')}\n`,
  );
}

export function downloadJson(events: ResetEvent[]): void {
  triggerDownload(
    'quota-watermark-resets.json',
    'application/json;charset=utf-8',
    `${JSON.stringify({ total: events.length, events }, null, 2)}\n`,
  );
}
