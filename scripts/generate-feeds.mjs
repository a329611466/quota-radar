#!/usr/bin/env node
/**
 * 构建时生成日历订阅（.ics）与 RSS，作为 Worker 动态版本之外的兜底。
 *
 *   node scripts/generate-feeds.mjs
 *
 * 线上访问这两个路径时，Worker 会优先用 KV 里的最新快照动态生成；
 * 这个文件只是静态回退。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIcs, buildRss } from '../src/lib/feeds.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA = resolve(ROOT, 'public/data/resets.json');
const DIST = resolve(ROOT, 'dist');
const SITE_ORIGIN = process.env.SITE_ORIGIN ?? '';

async function main() {
  const raw = JSON.parse(await readFile(DATA, 'utf8'));
  /** @type {import('../src/data/types.ts').ResetEvent[]} */
  const events = Array.isArray(raw.events) ? raw.events : [];

  await writeFile(resolve(DIST, 'quota-watermark.ics'), buildIcs(events), 'utf8');
  console.log(`> wrote quota-watermark.ics (${events.length} events)`);

  const siteUrl = SITE_ORIGIN || 'https://x.com/thsottiaux';
  await writeFile(resolve(DIST, 'feed.xml'), buildRss(events, siteUrl), 'utf8');
  console.log('> wrote feed.xml');
}

main().catch((error) => {
  console.error(`! generate-feeds failed: ${error.message}`);
  process.exit(1);
});
