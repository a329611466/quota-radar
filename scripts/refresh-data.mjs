#!/usr/bin/env node
/**
 * 重新抓取 Codex 重置数据并覆盖 public/data/resets.json。
 *
 *   node scripts/refresh-data.mjs [--source <url>]
 *
 * 默认为上游公开接口。写入前会做两道保护：
 *  1. 上游返回的事件数比现有文件少 20% 以上时拒绝写入（防止上游故障把本地数据清空）
 *  2. 按 id 去重，按 announced_at 倒序输出
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeUpstream } from '../src/lib/normalize.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TARGET = resolve(ROOT, 'public/data/resets.json');
const DEFAULT_SOURCE = 'https://codex-resets.com/api/resets';

function parseArgs(argv) {
  const opts = { source: DEFAULT_SOURCE };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--source' && argv[i + 1]) {
      opts.source = argv[i + 1];
      i += 1;
    }
  }
  return opts;
}

function diff(oldEvents, newEvents) {
  const oldMap = new Map(oldEvents.map((e) => [e.id, e]));
  const newMap = new Map(newEvents.map((e) => [e.id, e]));

  const added = newEvents.filter((e) => !oldMap.has(e.id));
  const removed = oldEvents.filter((e) => !newMap.has(e.id));
  const changed = newEvents.filter((e) => {
    const prev = oldMap.get(e.id);
    if (!prev) return false;
    return prev.announced_at !== e.announced_at || prev.reset_type !== e.reset_type || prev.text !== e.text;
  });

  return { added, removed, changed };
}

async function readExisting() {
  try {
    const raw = await readFile(TARGET, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log(`> fetching ${opts.source}`);

  const response = await fetch(opts.source, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`上游返回 HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload) && !Array.isArray(payload?.events)) {
    throw new Error('上游返回的数据结构无法识别');
  }
  const events = normalizeUpstream(payload);
  if (events.length === 0) {
    throw new Error('上游返回 0 条事件，拒绝写入');
  }

  const existing = await readExisting();
  if (existing.length > 0 && events.length < existing.length * 0.8) {
    throw new Error(
      `上游事件数 ${events.length} 明显少于本地 ${existing.length}（跌幅超过 20%），拒绝覆盖`,
    );
  }

  const { added, removed, changed } = diff(existing, events);
  const file = {
    version: 1,
    generated_at: new Date().toISOString(),
    source: {
      provider: opts.source,
      account: '@thsottiaux',
    },
    events,
  };

  await mkdir(dirname(TARGET), { recursive: true });
  await writeFile(TARGET, `${JSON.stringify(file, null, 2)}\n`, 'utf8');

  console.log(`> wrote ${events.length} events to public/data/resets.json`);
  console.log(`  +${added.length} added  ~${changed.length} changed  -${removed.length} removed`);
  for (const event of added.slice(0, 5)) {
    console.log(`  + ${event.announced_at}  ${event.reset_type.padEnd(7)} ${event.text.slice(0, 60)}`);
  }
  if (added.length > 5) console.log(`  … 还有 ${added.length - 5} 条`);
}

main().catch((error) => {
  console.error(`! refresh failed: ${error.message}`);
  process.exit(1);
});
