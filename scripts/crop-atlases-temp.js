#!/usr/bin/env node
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const { Jimp, JimpMime } = require('jimp');

const SAVE_URL = 'https://www.awalon.top/api/save-asset';

const TASKS = [
  { file: '/tmp/roles-atlas-raw.jpeg',  assetId: 'roles-atlas',  cols: 4, rows: 4 },
  { file: '/tmp/medals-atlas-raw.jpeg', assetId: 'medals-atlas', cols: 4, rows: 6 },
];

function request(url, opts, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const proto = u.protocol === 'https:' ? https : http;
    const req = proto.request({ hostname: u.hostname, path: u.pathname + u.search, method: opts.method || 'GET', headers: opts.headers || {} }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, text, json: () => JSON.parse(text) });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function cropToContent(buf, cols, rows) {
  const img = await Jimp.fromBuffer(buf);
  const { width, height } = img.bitmap;

  // dark-dungeon bg = #1a0e06 (r=26,g=14,b=6) and #0c0802 (r=12,g=8,b=2)
  // DARK=40 ensures these are treated as background
  const DARK = 40;
  const WM_L = width  - 220;
  const WM_T = height -  70;

  function isBg(x, y) {
    if (x >= WM_L && y >= WM_T) return true;
    const c = img.getPixelColor(x, y);
    const r = (c >>> 24) & 0xff;
    const g = (c >>> 16) & 0xff;
    const b = (c >>>  8) & 0xff;
    return r < DARK && g < DARK && b < DARK;
  }

  let top = 0, bottom = height - 1, left = 0, right = width - 1;

  outerT: for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x += 3)
      if (!isBg(x, y)) { top = y; break outerT; }

  outerB: for (let y = height - 1; y >= 0; y--)
    for (let x = 0; x < width; x += 3)
      if (!isBg(x, y)) { bottom = y; break outerB; }

  outerL: for (let x = 0; x < width; x++)
    for (let y = 0; y < height; y += 3)
      if (!isBg(x, y)) { left = x; break outerL; }

  outerR: for (let x = width - 1; x >= 0; x--)
    for (let y = 0; y < height; y += 3)
      if (!isBg(x, y)) { right = x; break outerR; }

  const detW = right - left + 1;
  const detH = bottom - top + 1;
  const padX = Math.round(detW / cols * 0.18);
  const padY = Math.round(detH / rows * 0.18);
  left   = Math.max(0, left   - padX);
  right  = Math.min(width  - 1, right  + padX);
  top    = Math.max(0, top    - padY);
  bottom = Math.min(height - 1, bottom + padY);

  const cw = right - left + 1;
  const ch = bottom - top + 1;
  const marginPctW = ((width  - cw) / width  * 100).toFixed(1);
  const marginPctH = ((height - ch) / height * 100).toFixed(1);

  console.log(`  检测: (${left},${top}) → (${right},${bottom})  裁去 ${marginPctW}% 宽 / ${marginPctH}% 高`);

  if (cw < width * 0.3 || ch < height * 0.3) {
    console.log('  ⚠ 内容区过小，跳过裁边');
    return buf;
  }

  img.crop({ x: left, y: top, w: cw, h: ch });
  return await img.getBuffer(JimpMime.jpeg);
}

async function run() {
  for (const task of TASKS) {
    console.log(`\n▶ ${task.assetId}`);
    const raw = fs.readFileSync(task.file);
    console.log(`  原始尺寸: ${(raw.length/1024).toFixed(0)} KB`);

    const cropped = await cropToContent(raw, task.cols, task.rows);
    console.log(`  裁切后:   ${(cropped.length/1024).toFixed(0)} KB`);

    // 保存到本地预览
    fs.writeFileSync(`/tmp/${task.assetId}-cropped.jpeg`, cropped);

    // 上传到服务器
    const dataUrl = `data:image/jpeg;base64,${cropped.toString('base64')}`;
    const body = JSON.stringify({ skinId: 'dark-dungeon', assetId: task.assetId, dataUrl });
    const res = await request(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, body);
    if (res.status !== 200) throw new Error(`save failed ${res.status}: ${res.text.slice(0,100)}`);
    const result = res.json();
    console.log(`  ✅ 已上传 → ${result.assetUrl}`);
  }
  console.log('\n完成！');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
