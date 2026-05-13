#!/usr/bin/env node
// regen-atlases.js — 重新生成 dark-dungeon roles-atlas + medals-atlas
// 用法: node scripts/regen-atlases.js

const https = require('https');
const http  = require('http');
const { Jimp, JimpMime } = require('jimp');

const API_KEY  = 'ark-760ac07f-94d8-4b50-9759-2ec350b69521-3e5ad';
const MODEL    = 'doubao-seedream-5-0-260128';
const ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const SAVE_URL = 'https://www.awalon.top/api/save-asset';
const PROXY_URL= 'https://www.awalon.top/api/proxy-image';

const ASSETS = [
  { id: 'roles-atlas',  size: '1920x1920' },
  { id: 'medals-atlas', size: '1440x2560' },
];

const PROMPTS = {
  'roles-atlas': `Inscryption-inspired character card portrait atlas. LAYOUT (CRITICAL): strict 4-column × 4-row grid. The grid MUST FILL THE ENTIRE IMAGE EDGE TO EDGE — top-left cell corner touches the image top-left pixel, bottom-right cell corner touches image bottom-right pixel. ZERO outer margin, ZERO padding, ZERO border outside the grid. ART STYLE: dark gothic pen-and-ink etching on aged card stock — crude expressive line work, crosshatch shading, black ink on warm cream parchment (#e8ddc0), like old tarot cards or Victorian engravings. NOT pixel art, NOT painted, NOT photorealistic. Each cell: square bust portrait, head + upper chest, face filling 80-90% of cell, bottom 15% darkens toward #1a0e06. NO visible dividing lines between cells. FACTION COLOR RULE (CRITICAL): good characters (Row 1) have clearly visible cool steel-blue ink-wash tint on parchment and armor; evil characters (Rows 2–3) have clearly visible warm crimson-red ink-wash tint on parchment and clothing. Tint must be strongly visible, not subtle. Row 1 (GOOD — blue tint #3a6ab5): [Merlin — hooded elder wizard, star-rune staff, blue-tinted parchment, blue rune glints]; [Percival — iron helm cross crest, earnest face, blue armor sheen]; [Loyal Knight — plain nasal helm, honest face, blue shield highlights]; [Good Lancelot — lion-crest pauldron, noble bearing, blue-steel plates]. Row 2 (EVIL — crimson tint #a82020): [Assassin — deep hood, cold hollow eyes, crimson eye glint]; [Morgana — dark witch, bone ornament, sinister smile, red veil]; [Mordred — skull-relief helm, scheming eyes, red skull]; [Oberon — ragged cloak, wild suspicious eyes, crimson fringe]. Row 3 (EVIL — crimson tint): [Minion — iron skull mask, amber pinpoint eyes, red crack glow]; [Evil Lancelot — cracked black armor, haunted face, crimson cracks]; [solid #1a0e06 empty card]; [solid #1a0e06 empty card]. Row 4: all cells solid #1a0e06. No text, no labels`,

  'medals-atlas': `Dark gothic medal icon sheet. LAYOUT (CRITICAL): strict 4-column × 6-row grid. The grid MUST FILL THE ENTIRE IMAGE EDGE TO EDGE — first icon row starts at the very top of the image, last icon row ends at the very bottom, left column starts at left edge, right column ends at right edge. ZERO outer margin, ZERO top/bottom/left/right padding outside the grid. BACKGROUND: pure solid #0c0802 everywhere — NO parchment, NO gradient, NO texture. ICON STYLE: flat bold woodcut silhouette — thick amber (#c8982a) outline, amber fill, near-black interior details, instantly readable at tiny size. SIZE RULE: every icon body occupies the same 65% of its cell — consistent across all 24 icons, centered, equal margins inside each cell. NO dividing lines between cells. Row 1: [hooded wizard head wearing a mask — disguise]; [sword piercing shield — blocked]; [iron captain helm — leader]; [all-seeing eye with radiating spokes — oracle]. Row 2: [leg caught in iron bear trap — snared]; [blindfolded archer drawing bow — blind shot]; [three X marks — triple fail]; [skull with teardrop lines — defeated]. Row 3: [seated figure head buried in hands — exhausted]; [skull with spiral dizzy eyes — confused]; [small four-wheel minecart — wagon]; [crown resting on laurel branch — glory]. Row 4: [dagger pointing straight down — kill]; [witch hand with reaching gesture — enchant]; [lone wolf figure joining a pack — found]; [two figures about to collide — clash]. Row 5: [shield with crack splitting it — broken defense]; [three towers exploding in chain — chain destroy]; [cloaked figure clutching coin bag — hidden]; [two silhouettes walking apart — split]. Row 6: [spoked wheel with cracks bursting — burst]; [wolf skull wearing a crown — wolf king]; [plain blank oval iron mask — faceless]; [single figure with two directional arrows — switching]. No text, no labels, #0c0802 background only`,
};

// ── HTTP helpers ────────────────────────────────────────────────────────────
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

async function callDoubao(prompt, size) {
  const body = JSON.stringify({ model: MODEL, prompt, n: 1, size });
  const res = await request(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
  }, body);
  if (res.status !== 200) throw new Error(`Doubao ${res.status}: ${res.text.slice(0,200)}`);
  const data = res.json();
  const item = data.data?.[0];
  if (!item) throw new Error('空响应');
  if (item.b64_json) return `data:image/jpeg;base64,${item.b64_json}`;
  if (item.url) {
    const pr = await request(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({ url: item.url }));
    if (pr.status !== 200) throw new Error(`proxy ${pr.status}: ${pr.text.slice(0,100)}`);
    const pd = pr.json();
    return `data:${pd.mimeType || 'image/jpeg'};base64,${pd.b64}`;
  }
  throw new Error('无图片数据');
}

// ── 自动裁边：检测非暗色像素的边界框，裁剪掉外侧空白 ─────────────────────
async function cropToContent(dataUrl, cols = 4, rows = 6) {
  // 从 base64 数据URL解码
  const base64 = dataUrl.split(',')[1];
  const buf = Buffer.from(base64, 'base64');
  const img = await Jimp.fromBuffer(buf);
  const { width, height } = img.bitmap;

  const DARK = 40; // R/G/B 均低于此值视为背景（dark-dungeon bg=#1a0e06, r=26，需 DARK>26）
  // Doubao 水印是右下角约 220×70px 的小方块，只精确排除这个区域
  const WM_L = width  - 220; // 水印左边界
  const WM_T = height -  70; // 水印上边界

  function isBg(x, y) {
    if (x >= WM_L && y >= WM_T) return true; // 精确水印区 → 视为背景
    const c = img.getPixelColor(x, y);
    const r = (c >>> 24) & 0xff;
    const g = (c >>> 16) & 0xff;
    const b = (c >>>  8) & 0xff;
    return r < DARK && g < DARK && b < DARK;
  }

  let top = 0, bottom = height - 1, left = 0, right = width - 1;

  outerT: for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x += 4)
      if (!isBg(x, y)) { top = y; break outerT; }

  outerB: for (let y = height - 1; y >= 0; y--)
    for (let x = 0; x < width; x += 4)
      if (!isBg(x, y)) { bottom = y; break outerB; }

  outerL: for (let x = 0; x < width; x++)
    for (let y = 0; y < height; y += 4)
      if (!isBg(x, y)) { left = x; break outerL; }

  outerR: for (let x = width - 1; x >= 0; x--)
    for (let y = 0; y < height; y += 4)
      if (!isBg(x, y)) { right = x; break outerR; }

  // 只在检测到明显外边框时（内容区 < 90% 图像尺寸）扩展补偿格子内边距
  const detW = right - left + 1, detH = bottom - top + 1;
  const hasFrameH = detW / width  < 0.90;
  const hasFrameV = detH / height < 0.90;
  if (!hasFrameH) { left = 0; right = width  - 1; }
  if (!hasFrameV) { top  = 0; bottom = height - 1; }

  const cw = right - left + 1, ch = bottom - top + 1;
  const marginPct = (100 - cw / width * 100).toFixed(1);
  process.stdout.write(`\n    裁边: (${left},${top})→(${right},${bottom})  裁去 ${marginPct}% 外边距`);

  if (cw < width * 0.4 || ch < height * 0.4) {
    process.stdout.write('  ⚠ 内容区域过小，跳过裁边');
    return dataUrl;
  }

  img.crop({ x: left, y: top, w: cw, h: ch });
  const croppedBuf = await img.getBuffer(JimpMime.jpeg);
  return `data:image/jpeg;base64,${croppedBuf.toString('base64')}`;
}

async function saveAsset(assetId, dataUrl) {
  const body = JSON.stringify({ skinId: 'dark-dungeon', assetId, dataUrl });
  const res = await request(SAVE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, body);
  if (res.status !== 200) throw new Error(`save ${res.status}: ${res.text.slice(0,100)}`);
  return res.json();
}

// ── Progress ────────────────────────────────────────────────────────────────
const states = {};
ASSETS.forEach(a => { states[a.id] = '⏳ 等待'; });
let done = 0, failed = 0;

function printProgress() {
  process.stdout.write('\x1b[2J\x1b[H');
  console.log(`\n  🎴 邪恶冥刻 重新生成图集  [${done + failed}/${ASSETS.length}]\n`);
  for (const a of ASSETS) console.log(`  ${states[a.id].padEnd(35)} ${a.id}`);
  console.log('');
}

async function processOne(asset) {
  const prompt = PROMPTS[asset.id];
  states[asset.id] = '⚡ 生成中…'; printProgress();
  try {
    const rawDataUrl = await callDoubao(prompt, asset.size);
    states[asset.id] = '✂ 裁边中…'; printProgress();
    const grid = asset.id === 'roles-atlas'  ? { cols: 4, rows: 4 }
               : asset.id === 'medals-atlas' ? { cols: 4, rows: 6 }
               : { cols: 4, rows: 4 };
    const dataUrl = await cropToContent(rawDataUrl, grid.cols, grid.rows);
    states[asset.id] = '💾 保存中…'; printProgress();
    const result = await saveAsset(asset.id, dataUrl);
    done++;
    states[asset.id] = `✅ 完成 → ${result.assetUrl || '已保存'}`;
  } catch(e) {
    failed++;
    states[asset.id] = `❌ ${e.message.slice(0, 40)}`;
  }
  printProgress();
}

async function run() {
  printProgress();
  await Promise.all(ASSETS.map(processOne));
  console.log(`\n  完成！成功 ${done}/${ASSETS.length}  失败 ${failed}\n`);
  if (failed > 0) console.log('  失败的请手动在 Skin Studio 重新生成\n');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
