#!/usr/bin/env node
/**
 * 核对本地 git 与 GitHub 远端是否一致。
 *   node scripts/check-sync.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const tree = JSON.parse(
  execSync(
    'gh api "repos/a329611466/quota-radar/git/trees/main?recursive=1"',
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  ),
);

const remote = tree.tree.filter((node) => node.type === 'blob').map((node) => node.path);
const local = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n');

const onlyRemote = remote.filter((path) => !local.includes(path));
const onlyLocal = local.filter((path) => !remote.includes(path));

console.log(`远端 ${remote.length} 个文件 / 本地 ${local.length} 个文件`);
console.log(`只在远端: ${onlyRemote.join(', ') || '无'}`);
console.log(`只在本地: ${onlyLocal.join(', ') || '无'}`);
console.log(`.wrangler 残留: ${remote.filter((p) => p.startsWith('.wrangler')).length} 个`);

// 逐个比对关键文件的内容哈希
const keyFiles = [
  'worker/index.ts',
  'wrangler.toml',
  'src/lib/normalize.ts',
  'src/lib/feeds.ts',
  'src/data/useResets.ts',
  'src/App.tsx',
  '.gitignore',
  'README.md',
  'scripts/refresh-data.mjs',
  'scripts/generate-feeds.mjs',
  'tsconfig.json',
];

for (const file of keyFiles) {
  const out = execSync(
    `gh api "repos/a329611466/quota-radar/contents/${file}" --jq .content`,
    { encoding: 'utf8' },
  );
  const remoteHash = execSync(`echo '${out}' | base64 -d | shasum | cut -c1-12`, {
    encoding: 'utf8',
  }).trim();
  let localHash = '(本地缺失)';
  try {
    localHash = execSync(`shasum "${file}" | cut -c1-12`, { encoding: 'utf8' }).trim();
  } catch {}
  const mark = remoteHash === localHash ? '✅' : '❌';
  console.log(`  ${mark} ${file.padEnd(28)} 远端=${remoteHash} 本地=${localHash}`);
}

// 远端 .gitignore 里是否已经忽略 .wrangler
const gi = execSync(
  `gh api "repos/a329611466/quota-radar/contents/.gitignore" --jq .content`,
  { encoding: 'utf8' },
);
console.log(`\n远端 .gitignore 内容:\n${Buffer.from(gi, 'base64').toString()}`);
