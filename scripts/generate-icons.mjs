#!/usr/bin/env node
/**
 * 从矢量图元生成 favicon 所需的 PNG / ICO。
 *
 *   node scripts/generate-icons.mjs
 *
 * 不依赖任何第三方库：4 倍超采样手绘像素，zlib 编码 PNG，
 * 再把多张 PNG 打包进 ICO（Vista+ 浏览器都支持 PNG 压缩的 ICO 条目）。
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUBLIC = resolve(ROOT, 'public');

/** 64×64 画布上的配色（viewBox 单位） */
const DEEP_GREEN = [0x2f, 0x6b, 0x52];
const PEACH = [0xff, 0x9d, 0x7a];
const CREAM = [0xff, 0xf6, 0xe9];

const SS = 4; // 超采样倍数

function insideRoundRect(x, y, w, h, r) {
  const cx = Math.min(Math.max(x, r), w - r);
  const cy = Math.min(Math.max(y, r), h - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** 在 64×64 的 viewBox 坐标里取一个点的颜色 */
function sample(ux, uy) {
  if (!insideRoundRect(ux, uy, 64, 64, 16)) return null;

  const dx = ux - 32;
  const dy = uy - 32;
  const r = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);

  let color = DEEP_GREEN;

  // 雷达扫描扇形（右上 → 右下，顺时针）
  if (r <= 24 && ang >= -0.594 && ang <= 0.435) color = PEACH;

  // 两圈雷达环
  for (const [radius, width, opacity] of [
    [21, 2.6, 0.32],
    [12, 2.6, 0.5],
  ]) {
    if (Math.abs(r - radius) <= width / 2) color = mix(color, CREAM, opacity);
  }

  // 中心点
  if (r <= 4.4) color = CREAM;

  return color;
}

function renderRGBA(size) {
  const w = size * SS;
  const acc = new Float64Array(w * w * 4);

  for (let y = 0; y < w; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const ux = ((x + 0.5) / w) * 64;
      const uy = ((y + 0.5) / w) * 64;
      const color = sample(ux, uy);
      const i = (y * w + x) * 4;
      if (color) {
        acc[i] = color[0];
        acc[i + 1] = color[1];
        acc[i + 2] = color[2];
        acc[i + 3] = 255;
      }
    }
  }

  // 降采样得到最终像素
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const i = ((y * SS + sy) * w + (x * SS + sx)) * 4;
          r += acc[i];
          g += acc[i + 1];
          b += acc[i + 2];
          a += acc[i + 3];
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePNG(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  const entries = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

function main() {
  mkdirSync(PUBLIC, { recursive: true });

  const sizes = [16, 32, 48, 180, 512];
  const pngs = sizes.map((size) => ({ size, data: encodePNG(size, renderRGBA(size)) }));

  writeFileSync(resolve(PUBLIC, 'favicon.ico'), encodeIco(pngs.slice(0, 3)));
  writeFileSync(resolve(PUBLIC, 'apple-touch-icon.png'), pngs[3].data);
  writeFileSync(resolve(PUBLIC, 'icon-512.png'), pngs[4].data);

  console.log('> wrote favicon.ico (16/32/48)');
  console.log('> wrote apple-touch-icon.png (180)');
  console.log('> wrote icon-512.png (512)');
}

main();
