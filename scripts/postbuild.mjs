#!/usr/bin/env node
/**
 * 构建后处理：把 dist/pages/<locale>.html 整理成 dist/<locale>/index.html，
 * 让每种语言拥有独立的目录式 URL（/en/、/zh-CN/ …）。
 *
 * Vite 按输入文件所在层级计算资源相对路径（dist/pages/x.html → ../assets/），
 * 移动到 dist/<locale>/index.html 后层级深度不变，资源路径依然成立。
 */
import { rename, mkdir, rm, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist');
const PAGES = join(DIST, 'pages');

const LOCALES = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'];

async function main() {
  try {
    await stat(DIST);
  } catch {
    throw new Error('dist 目录不存在，请先运行 vite build');
  }

  for (const locale of LOCALES) {
    const source = join(PAGES, `${locale}.html`);
    const targetDir = join(DIST, locale);
    const target = join(targetDir, 'index.html');

    try {
      await stat(source);
    } catch {
      throw new Error(`缺少产物 pages/${locale}.html`);
    }

    await mkdir(targetDir, { recursive: true });
    await rename(source, target);
    console.log(`> pages/${locale}.html -> ${locale}/index.html`);
  }

  await rm(PAGES, { recursive: true, force: true });
  console.log('> postbuild done');
}

main().catch((error) => {
  console.error(`! postbuild failed: ${error.message}`);
  process.exit(1);
});
