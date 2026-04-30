#!/usr/bin/env node
// skin-ai-server.js — 本地 AI 皮肤助手（轮询模式）
//
// 支持两种任务:
//   type='theme'  : 分析图片 → 生成完整 CSS vars（主题色 + 阵营色 + 勋章色等）
//   type='qa'     : 质检所有资产 → 评分 + 改写弱图 prompt
//
// 启动: node scripts/skin-ai-server.js

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { spawnSync } = require('child_process');

const RELAY_BASE = 'https://www.awalon.top';
const POLL_MS    = 3000;

// ── 颜色工具（与 HTML 保持一致） ─────────────────────────────────────────────
function _hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
}
function nwRgba(hex, a) { const [r,g,b] = _hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function nwShift(hex, amt) {
  return '#' + _hexToRgb(hex).map(v => Math.max(0,Math.min(255,v+amt)).toString(16).padStart(2,'0')).join('');
}
function nwLuminance(hex) {
  return _hexToRgb(hex).reduce((s,v,i) => s + v * [0.2126,0.7152,0.0722][i], 0) / 255;
}
function buildSkinVars({ skinName, accentColor, bgColor, borderStyle,
                         goodColor, evilColor, successColor, failColor,
                         btnPrimaryFrom, btnPrimaryTo, btnPrimaryText,
                         medalColor }) {
  const acc  = accentColor || '#d9b36b';
  const bg   = bgColor     || '#0f1115';
  const r    = borderStyle === 'sharp' ? '0' : '1';
  const lum  = nwLuminance(bg);
  const dark = lum < 0.35;
  const bg2  = dark ? nwShift(bg, 10) : nwShift(bg, -10);

  const panelBg     = nwRgba(dark ? nwShift(bg, 8) : bg, dark ? 0.85 : 0.90);
  const navBg       = nwRgba(dark ? nwShift(bg, -4) : nwShift(bg, 4), dark ? 0.92 : 0.94);
  const textCol     = dark ? '#eef1f7' : '#1a1c24';
  const subCol      = dark ? '#aeb6c7' : '#6b7080';
  const panelBorder = nwRgba(acc, dark ? 0.45 : 0.30);
  const navBorder   = nwRgba(acc, dark ? 0.20 : 0.14);
  const inputBorder = nwRgba(acc, dark ? 0.28 : 0.22);
  const btnBorder   = nwRgba(acc, dark ? 0.55 : 0.35);
  const inputBg     = dark ? nwRgba(acc, 0.05) : 'rgba(255,255,255,.75)';
  const accTextAuto = nwLuminance(acc) > 0.45 ? '#1a1200' : '#ffffff';
  const chip        = `linear-gradient(135deg,${bg},${dark ? nwShift(bg,18) : nwShift(bg,-12)})`;
  const chipBorder  = nwRgba(acc, 0.55);

  // 阵营/按钮色 - 优先用 CC 给出的，否则用默认值
  const _good    = goodColor    || '#4e9eff';
  const _evil    = evilColor    || '#e05050';
  const _success = successColor || (dark ? '#72e0a0' : '#1a8c52');
  const _fail    = failColor    || (dark ? '#f07070' : '#c03030');
  const _medal   = medalColor   || acc;
  const _btnFrom = btnPrimaryFrom || nwShift(acc, 30);
  const _btnTo   = btnPrimaryTo   || acc;
  const _btnText = btnPrimaryText || (nwLuminance(acc) > 0.45 ? '#1a1200' : '#ffffff');

  // 从好人/邪恶颜色衍生 rgba 版本
  const goodRgb  = _hexToRgb(_good);
  const evilRgb  = _hexToRgb(_evil);
  const medalRgb = _hexToRgb(_medal);

  return {
    name: skinName, chip, chipBorder, isDark: dark, custom: true,
    bgColor, accentColor, borderStyle, goodColor: _good, evilColor: _evil,
    successColor: _success, failColor: _fail, medalColor: _medal,
    btnPrimaryFrom: _btnFrom, btnPrimaryTo: _btnTo, btnPrimaryText: _btnText,
    vars: {
      '--aw-bg': bg, '--aw-bg-2': bg2, '--aw-panel': panelBg,
      '--aw-panel-border': panelBorder, '--aw-text': textCol, '--aw-subtext': subCol,
      '--aw-accent': acc, '--aw-accent-text': accTextAuto, '--aw-nav-bg': navBg,
      '--aw-nav-border': navBorder, '--aw-input-bg': inputBg,
      '--aw-input-border': inputBorder, '--aw-btn-ghost-border': btnBorder,
      '--aw-btn-ghost-text': textCol, '--aw-r': r,
      '--aw-btn-primary-bg':   `linear-gradient(180deg,${_btnFrom},${_btnTo})`,
      '--aw-btn-primary-text': _btnText,
      '--aw-good-glow':        `rgba(${goodRgb},0.85)`,
      '--aw-good-shadow':      `rgba(${goodRgb},0.45)`,
      '--aw-good-seat-bg':     `rgba(${goodRgb},0.18)`,
      '--aw-good-chip-bg':     `rgba(${goodRgb},0.20)`,
      '--aw-good-chip-border': `rgba(${goodRgb},0.55)`,
      '--aw-good-chip-text':   _good,
      '--aw-faction-good':     `linear-gradient(90deg,${nwShift(_good,-30)},${_good})`,
      '--aw-evil-glow':        `rgba(${evilRgb},0.80)`,
      '--aw-evil-shadow':      `rgba(${evilRgb},0.38)`,
      '--aw-evil-seat-bg':     `rgba(${evilRgb},0.15)`,
      '--aw-evil-chip-bg':     `rgba(${evilRgb},0.18)`,
      '--aw-evil-chip-border': `rgba(${evilRgb},0.55)`,
      '--aw-evil-chip-text':   _evil,
      '--aw-faction-evil':     `linear-gradient(90deg,${nwShift(_evil,-30)},${_evil})`,
      '--aw-success':          _success,
      '--aw-fail':             _fail,
      '--aw-medal-color':      _medal,
      '--aw-medal-bg':         `rgba(${medalRgb},0.15)`,
      '--aw-medal-border':     `rgba(${medalRgb},0.35)`,
    }
  };
}

// ── HTTP 工具 ─────────────────────────────────────────────────────────────────
function _hexToRgbStr(hex) { return _hexToRgb(hex).join(','); }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}
function postJson(url, payload) {
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    proto.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

function runClaude(prompt, extraArgs = []) {
  const result = spawnSync('claude', ['-p', prompt, '--allowedTools', 'Read', ...extraArgs], {
    encoding: 'utf8', timeout: 300000, maxBuffer: 30 * 1024 * 1024,
  });
  if (result.error) throw new Error('claude 执行失败: ' + result.error.message);
  if (result.status !== 0) throw new Error('claude 异常: ' + (result.stderr || result.stdout).slice(0, 300));
  return (result.stdout || '').trim();
}

// 从 claude 输出中提取并修复 JSON（处理代码块、未转义引号等）
function extractJSON(output, requiredKey) {
  // 去掉 markdown 代码块
  let text = output.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  // 找到包含 requiredKey 的 JSON 对象
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('输出中未找到 JSON');
  let jsonStr = text.slice(start, end + 1);

  // 先尝试直接解析
  try { return JSON.parse(jsonStr); } catch(_) {}

  // 修复字符串值中的未转义双引号：
  // 策略：在 JSON 字符串值内，把 " 替换为 \"（排除 key 和结构符号）
  jsonStr = jsonStr.replace(
    /("(?:batchSummary|summary|issue|improvedPrompt|reasoning)"\s*:\s*")([\s\S]*?)("(?:\s*[,}\]]))/g,
    (_, key, val, end) => key + val.replace(/(?<!\\)"/g, '\\"') + end
  );

  try { return JSON.parse(jsonStr); } catch(_) {}

  // 最后尝试：把所有字符串值中的裸引号替换掉
  jsonStr = jsonStr.replace(/"([^"]*?)"(?=\s*[,}\]])/g, (match) => {
    const inner = match.slice(1, -1).replace(/(?<!\\)"/g, '\\"');
    return `"${inner}"`;
  });

  return JSON.parse(jsonStr);  // 若还失败则抛出
}

// ── 下载关键图片 ──────────────────────────────────────────────────────────────
const THEME_ASSETS = ['home-bg', 'in-game-bg', 'table', 'merlin', 'morgana', 'assassin'];
const QA_ASSETS    = ['home-bg', 'in-game-bg', 'table', 'quest-success', 'quest-fail',
                      'merlin', 'percival', 'arthur_loyal', 'lancelot_good',
                      'assassin', 'morgana', 'mordred', 'oberon', 'minion', 'lancelot_evil'];

async function downloadAssets(skinId, assetIds) {
  let assets = await fetchJson(`${RELAY_BASE}/api/skin-generated/${skinId}`);
  if (assets && assets.assets) assets = assets.assets;

  const tmpDir = path.join(os.tmpdir(), `skin-ai-${skinId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const localPaths = {};
  for (const id of assetIds) {
    const rel = assets[id];
    if (!rel) continue;
    const ext  = path.extname(rel) || '.jpeg';
    const dest = path.join(tmpDir, `${id}${ext}`);
    if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
      await downloadFile(`${RELAY_BASE}${rel}`, dest);
    }
    localPaths[id] = dest;
  }
  return localPaths;
}

// ── 任务1：完整主题生成 ────────────────────────────────────────────────────────
async function analyzeTheme(skinId) {
  console.log(`  [theme] 下载关键图片...`);
  const localPaths = await downloadAssets(skinId, THEME_ASSETS);
  if (Object.keys(localPaths).length === 0) throw new Error('没有可用的图片资产');

  const imageList = Object.entries(localPaths).map(([id, p]) => `- ${id}: ${p}`).join('\n');

  const prompt = `你是专业游戏 UI 设计师，需要为一套移动游戏皮肤生成完整的配色方案。

请用 Read 工具逐一读取以下皮肤图片：
${imageList}

仔细分析后，为以下所有字段给出最符合图片风格的颜色值。
必须严格输出合法 JSON，不加任何其他文字、代码块或解释：

{
  "bgColor": "#xxxxxx",
  "accentColor": "#xxxxxx",
  "borderStyle": "sharp|round",
  "isDark": true|false,

  "goodColor": "#xxxxxx",
  "evilColor": "#xxxxxx",
  "successColor": "#xxxxxx",
  "failColor": "#xxxxxx",

  "btnPrimaryFrom": "#xxxxxx",
  "btnPrimaryTo": "#xxxxxx",
  "btnPrimaryText": "#xxxxxx",

  "medalColor": "#xxxxxx",

  "reasoning": "一句话说明整体配色思路"
}

字段说明：
- bgColor: 主背景色（取自 home-bg/in-game-bg 主色调）
- accentColor: 最突出的装饰色/光效色（金色、玉色、法术色等）
- borderStyle: "sharp" 硬朗直角 / "round" 柔和圆角
- goodColor: 正义阵营专属色（纯色 hex，用于座位光晕/阵营标签）
- evilColor: 邪恶阵营专属色（纯色 hex）
- successColor: 任务成功颜色
- failColor: 任务失败颜色
- btnPrimaryFrom/To: 主按钮渐变起止色（投票"是"按钮）
- btnPrimaryText: 主按钮文字色（需与渐变对比清晰）
- medalColor: 勋章/徽章颜色`;

  console.log(`  [theme] 调用 claude -p 分析完整主题...`);
  const output = runClaude(prompt);
  console.log(`  [theme] 输出: ${output.slice(0, 200)}`);

  const suggestion = extractJSON(output, 'bgColor');

  const entry = buildSkinVars({ skinName: skinId, ...suggestion });
  return { suggestion, entry };
}

// ── 任务2：质检（分批，每批单独 claude -p，批间上报进度）──────────────────────
const QA_BATCHES = [
  { label: '背景与场景',  ids: ['home-bg', 'in-game-bg', 'table', 'quest-success', 'quest-fail'] },
  { label: '正义角色',    ids: ['merlin', 'percival', 'arthur_loyal', 'lancelot_good'] },
  { label: '邪恶角色',    ids: ['assassin', 'morgana', 'mordred', 'oberon', 'minion', 'lancelot_evil'] },
];

async function analyzeQA(skinId, styleDesc) {
  console.log(`  [qa] 下载所有资产图片...`);
  const allIds = QA_BATCHES.flatMap(b => b.ids);
  const localPaths = await downloadAssets(skinId, allIds);
  if (Object.keys(localPaths).length === 0) throw new Error('没有可用的图片资产');

  const weakAssets   = [];
  const passedAssets = [];
  const summaries    = [];

  for (let bi = 0; bi < QA_BATCHES.length; bi++) {
    const batch = QA_BATCHES[bi];
    const batchPaths = batch.ids.filter(id => localPaths[id]);
    if (batchPaths.length === 0) continue;

    const progress = `第 ${bi+1}/${QA_BATCHES.length} 批：${batch.label}`;
    console.log(`  [qa] ${progress}`);

    // 上报进度到服务器（浏览器可轮询看到）
    await postJson(`${RELAY_BASE}/api/ai-progress`, { skinId, type: 'qa', progress }).catch(() => {});

    const imageList = batchPaths
      .map(id => `- ${id}: ${localPaths[id]}`)
      .join('\n');

    const prompt = `你是专业游戏美术总监，正在质检一套名为"${skinId}"的手游皮肤（${batch.label}）。
皮肤风格：${styleDesc || '（无描述）'}

请用 Read 工具依次读取以下图片：
${imageList}

对每张图打分（1-5），3分及以下列出问题和改进 prompt。

只输出合法 JSON，不加代码块或其他文字。注意：中文描述字段内不要出现英文双引号：
{
  "batchSummary": "这批图的整体评价（一句话）",
  "weakAssets": [
    { "assetId": "xxx", "score": 2, "issue": "问题描述", "improvedPrompt": "完整英文改进 prompt" }
  ],
  "passedAssets": ["id1", "id2"]
}`;

    const output = runClaude(prompt);
    console.log(`  [qa] 批次${bi+1}输出: ${output.slice(0, 150)}`);

    let batchResult;
    try { batchResult = extractJSON(output, 'batchSummary'); }
    catch(e) { console.log(`  [qa] 批次${bi+1} JSON 解析失败: ${e.message.slice(0,60)}，跳过`); continue; }
    if (batchResult.batchSummary) summaries.push(`${batch.label}：${batchResult.batchSummary}`);
    weakAssets.push(...(batchResult.weakAssets || []));
    passedAssets.push(...(batchResult.passedAssets || []));
  }

  return {
    summary: summaries.join(' | ') || '质检完成',
    weakAssets,
    passedAssets,
  };
}

// ── 主轮询循环 ────────────────────────────────────────────────────────────────
const processing = new Set();

async function poll() {
  try {
    const { pending } = await fetchJson(`${RELAY_BASE}/api/ai-pending`);
    for (const task of (pending || [])) {
      // task: { skinId, type, styleDesc }
      const key = `${task.skinId}:${task.type}`;
      if (processing.has(key)) continue;
      processing.add(key);

      console.log(`\n[${new Date().toLocaleTimeString()}] 任务: ${task.type} → ${task.skinId}`);

      const run = task.type === 'qa'
        ? analyzeQA(task.skinId, task.styleDesc)
        : analyzeTheme(task.skinId);

      run.then(async result => {
        await postJson(`${RELAY_BASE}/api/ai-result`, { skinId: task.skinId, type: task.type, ok: true, result });
        console.log(`  ✅ ${task.skinId}/${task.type} 完成`);
      }).catch(async e => {
        await postJson(`${RELAY_BASE}/api/ai-result`, { skinId: task.skinId, type: task.type, ok: false, error: e.message });
        console.log(`  ❌ ${task.skinId}/${task.type}: ${e.message}`);
      }).finally(() => processing.delete(key));
    }
  } catch(_) {}
}

console.log('🤖 AI 皮肤助手已启动（轮询模式）');
console.log(`   中继: ${RELAY_BASE}`);
console.log('   支持: 🎨 主题生成 / 🔍 质检\n');

poll();
setInterval(poll, POLL_MS);
