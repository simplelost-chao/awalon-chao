#!/usr/bin/env node
// gen-dark-dungeon.js — 批量生成 dark-dungeon 皮肤资产
// 用法: node scripts/gen-dark-dungeon.js

const https = require('https');
const http  = require('http');

const API_KEY  = 'ark-760ac07f-94d8-4b50-9759-2ec350b69521-3e5ad';
const MODEL    = 'doubao-seedream-5-0-260128';
const ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const SAVE_URL = 'https://www.awalon.top/api/save-asset';
const PROXY_URL= 'https://www.awalon.top/api/proxy-image';
const CONCUR   = 2; // 并发数（Doubao 限流保守一点）

const ASSETS = [
  { id: 'home-bg',       size: '1440x2560' },
  { id: 'in-game-bg',    size: '1440x2560' },
  { id: 'table',         size: '1920x1920' },
  { id: 'roles-atlas',   size: '1920x1920' },
  { id: 'medals-atlas',  size: '1440x2560' },
  { id: 'quest-success', size: '2560x1440' },
  { id: 'quest-fail',    size: '2560x1440' },
  { id: 'kill-icon',     size: '1920x1920' },
  { id: 'history-icon',  size: '1920x1920' },
  { id: 'stats-icon',    size: '1920x1920' },
  { id: 'panel-frame',   size: '1920x1920' },
  { id: 'panel-texture', size: '1920x1920' },
  { id: 'btn-texture',   size: '2560x1440' },
  { id: 'divider',       size: '2560x1440' },
];

const PROMPTS = {
  'home-bg': `Inscryption-inspired dark cabin interior — rough-hewn wooden walls and low ceiling consumed by absolute darkness, a single tallow candle on a crude wooden shelf casting one small warm amber pool of light, shadow devouring everything beyond arm's reach, dimly visible animal bones and old glass jars on shelves, oppressive suffocating atmosphere. ART STYLE: heavy ink woodcut print illustration — bold outlines, flat dry-brush texture fills, NOT photorealistic, NOT pixel art. PALETTE: near-black (#0c0802) dominates, amber (#c8982a) candle glow only. Vertical 9:16, bottom 40% darkest for UI overlay, no text no UI no people`,
  'in-game-bg': `Inscryption-inspired candlelit game table — low-angle view of a rough dark wooden table surface in near-total darkness, single stubby candle flame casting amber warmth across scarred wood grain, crude carved symbols faintly visible on table edge, absolute void shadow beyond the table, claustrophobic and tense. ART STYLE: heavy ink woodcut print illustration — bold outlines, flat dry-brush texture, NOT photorealistic, NOT pixel art. PALETTE: near-black (#0c0802) wood grain, amber (#c8982a) candle light only. Vertical 9:16, bottom 45% deepest shadow for UI overlay, no text no UI`,
  'table': `Dark gothic round stone table top-down view — Darkest Dungeon illustration style: heavy ink outlines, flat dry-brush texture fills, NOT photorealistic, NOT pixel art grid. OBJECT: perfect circle of rough basalt stone viewed from directly above, angular ink-carved skull and crossed-bone runes in center, crude iron banding around circumference, amber (#c8982a) carved line details and iron rivets. Background: solid #0c0802. Square 1:1, no text`,
  'roles-atlas': `Inscryption-inspired character card portrait atlas. ART STYLE: dark gothic pen-and-ink etching on aged card stock — crude expressive line work, crosshatch shading, black ink on warm cream parchment (#e8ddc0), like old tarot cards or Victorian engravings. NOT pixel art, NOT painted, NOT photorealistic. Grid: strict 4-column × 4-row, 1024×1024px, each cell exactly 256×256px, NO visible borders between cells. Each cell: bust portrait, head + upper chest, ink illustration on parchment background (#e8ddc0), face filling 70-80% of cell, bottom 15% darkens toward #1a0e06. CHARACTERS Row 1: [Merlin — hooded elder wizard, star-rune staff, knowing eyes, ink etching]; [Percival — iron helm with cross crest, earnest face, ink etching]; [Loyal Knight — plain nasal-guard helm, honest open face, ink etching]; [Good Lancelot — lion-crest pauldron, noble bearing, ink etching]. Row 2: [Assassin — deep hood, only cold narrow eyes visible, ink etching]; [Morgana — dark witch, bone hair ornament, sinister half-smile, ink etching]; [Mordred — skull-relief helm, scheming narrowed eyes, ink etching]; [Oberon — ragged rough cloak, wild suspicious hollow eyes, ink etching]. Row 3: [Minion — iron skull mask, two pinpoint eyes in shadow, ink etching]; [Evil Lancelot — cracked black armor, haunted tormented face, ink etching]; [solid #1a0e06 empty card]; [solid #1a0e06 empty card]. Row 4: all cells solid #1a0e06. No text, no labels`,
  'medals-atlas': `Dark gothic medal icon grid for game UI. BACKGROUND: every cell is solid near-black #0c0802 — NO parchment, NO texture, PURE SOLID #0c0802 fill behind every icon. ICON STYLE: flat bold woodcut silhouette — thick amber (#c8982a) outline, flat amber fill, near-black interior details, instantly readable at 32px. SIZE RULE (CRITICAL): every single icon must be the EXACT SAME visual size — icon body occupies 55-65% of cell width and height, centered with equal margins on all four sides. If one icon is small another must not be large — ABSOLUTE SIZE CONSISTENCY across all 24 cells. Grid: 4-column × 6-row, 1024×1792 total, each cell 256×298px, NO borders or dividing lines. Row 1: [hooded wizard wearing mask — disguise]; [sword piercing shield — blocked]; [iron captain helm — leader]; [all-seeing eye with spokes — oracle]. Row 2: [leg caught in iron trap — snared]; [blindfolded archer aiming — blind shot]; [three X marks — triple fail]; [skull with tear drops — defeated]. Row 3: [figure head in hands — exhausted]; [dizzy skull spiral eyes — confused]; [small minecart — wagon]; [crown on laurel branches — glory]. Row 4: [dagger pointing down — kill]; [witch hand gesture — enchant]; [wolf joining pack — found]; [two figures colliding — clash]. Row 5: [shield cracking — broken defense]; [three towers exploding — chain destroy]; [cloaked figure hiding coins — hidden]; [two figures walking apart — split]. Row 6: [wheel with cracks — burst]; [wolf skull with crown — wolf king]; [blank oval iron mask — faceless]; [figure with two arrows — switching]. No text, no labels, solid #0c0802 background only`,
  'quest-success': `Dark gothic victory banner — Darkest Dungeon illustration style: heavy ink outlines, flat dry-brush paint texture, NOT photorealistic, NOT pixel art. SCENE landscape 16:9: tall gothic torch blazing with bold amber flame top center, broad two-handed broadsword raised triumphantly beside it, angular ink radiant lines emanating like dark heraldic sunburst, crude stone dungeon arch framing. PALETTE: pure black + near-black (#0c0802) + amber (#c8982a) only. No text no UI`,
  'quest-fail': `Dark gothic defeat banner — Darkest Dungeon illustration style: heavy ink outlines, flat dry-brush paint texture, NOT photorealistic, NOT pixel art. SCENE landscape 16:9: extinguished torch stub with tiny dying amber ember, broadsword snapped in two pieces on stone floor, ink-drawn skull and crossed bones center, cracked dungeon stones, darkness consuming everything. PALETTE: pure black + near-black (#0c0802) + faint amber (#c8982a) ember only. No text no UI`,
  'kill-icon': `Dark gothic dagger icon — Darkest Dungeon woodcut icon style: bold solid black ink silhouette, flat amber (#c8982a) fill details, heavy black outline, instantly readable at small size. Single crude iron dagger pointing straight down, simple crossguard, amber blood drip at tip. Solid #0c0802 background. Square 1:1, centered, no text`,
  'history-icon': `Dark gothic stone tablet icon — Darkest Dungeon woodcut icon style: bold solid black ink silhouette, flat amber (#c8982a) line details, heavy black outline. Rough rectangular stone slab with iron ring bolt at top, three horizontal carved inscriptions. Solid #0c0802 background. Square 1:1, centered, no text`,
  'stats-icon': `Dark gothic rank pillars icon — Darkest Dungeon woodcut icon style: bold solid black ink silhouette, flat amber (#c8982a) top faces, heavy black outline. Three ascending rectangular stone pillar bars. Solid #0c0802 background. Square 1:1, centered, no text`,
  'panel-frame': `UI panel border tile — flat dark gothic graphic design asset. Square tile. Border: 16px on all sides, solid near-black (#0c0802) fill with single 1.5px amber (#c8982a) inner edge line. Each corner: simple L-bracket ornament in amber. Center area: solid #0c0802, completely empty. Flat 2D, no gradients, no 3D. Square 1:1`,
  'panel-texture': `Seamless dark stone surface texture — dark gothic material. Base exactly #0c0802, very subtle irregular stone grain with contrast under 6%, flat even light no directional shadows. Must not compete with amber text. Tileable square 1:1`,
  'btn-texture': `Dark aged stone surface texture for gothic button — Darkest Dungeon material style. Base #0c0802, subtle stone grain and faint crack lines, flat even lighting, amber (#c8982a) 1px highlight line along top edge only. Wide landscape 4:1, no text`,
  'divider': `Dark gothic horizontal ornamental divider — flat graphic design element. Center: small diamond or fleur ornament in amber (#c8982a). Two thin amber lines extend left and right from center, gradually fading toward edges. Solid #0c0802 background. Wide 8:1 banner ratio, no text`,
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

// ── Generate one image via Doubao ──────────────────────────────────────────
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
    // 代理拉取（绕过 CORS / TOS）
    const pr = await request(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, JSON.stringify({ url: item.url }));
    if (pr.status !== 200) throw new Error(`proxy ${pr.status}`);
    const pd = pr.json();
    return `data:${pd.mimeType || 'image/jpeg'};base64,${pd.b64}`;
  }
  throw new Error('无图片数据');
}

// ── Save asset to awalon server ──────────────────────────────────────────
async function saveAsset(assetId, dataUrl) {
  const body = JSON.stringify({ skinId: 'dark-dungeon', assetId, dataUrl });
  const res = await request(SAVE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, body);
  if (res.status !== 200) throw new Error(`save ${res.status}: ${res.text.slice(0,100)}`);
  return res.json();
}

// ── Progress display ────────────────────────────────────────────────────────
const total = ASSETS.length;
let done = 0, failed = 0;
const states = {};
ASSETS.forEach(a => { states[a.id] = '⏳ 等待'; });

function printProgress() {
  process.stdout.write('\x1b[2J\x1b[H'); // 清屏
  console.log(`\n  🎴 邪恶冥刻 资产生成  [${done + failed}/${total}]  ✓${done} ✗${failed}\n`);
  const pct = Math.round((done + failed) / total * 100);
  const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
  console.log(`  [${bar}] ${pct}%\n`);
  for (const a of ASSETS) {
    const st = states[a.id];
    console.log(`  ${st.padEnd(30)} ${a.id}`);
  }
  console.log('');
}

// ── Main ────────────────────────────────────────────────────────────────────
async function run() {
  printProgress();
  const queue = [...ASSETS];
  let active = 0;

  await new Promise(resolve => {
    function next() {
      while (active < CONCUR && queue.length) {
        const asset = queue.shift();
        active++;
        processOne(asset).finally(() => {
          active--;
          if (active === 0 && queue.length === 0) resolve();
          else next();
        });
      }
    }
    next();
  });

  printProgress();
  console.log(`\n  완료！成功 ${done}/${total} 个资产\n`);
  if (failed > 0) console.log(`  失败 ${failed} 个，请手动重新生成\n`);
}

async function processOne(asset) {
  const prompt = PROMPTS[asset.id];
  if (!prompt) {
    states[asset.id] = '⚠️  无 prompt';
    printProgress();
    return;
  }

  states[asset.id] = '⚡ 生成中…';
  printProgress();

  try {
    const dataUrl = await callDoubao(prompt, asset.size);
    states[asset.id] = '💾 保存中…';
    printProgress();
    await saveAsset(asset.id, dataUrl);
    done++;
    states[asset.id] = '✅ 完成';
  } catch (e) {
    failed++;
    states[asset.id] = `❌ ${e.message.slice(0, 25)}`;
  }
  printProgress();
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
