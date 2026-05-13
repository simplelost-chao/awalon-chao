#!/usr/bin/env node
// analyze-skin-style.js — 用本地 claude -p 分析皮肤图片，生成 CSS 配色建议
//
// 用法:
//   node analyze-skin-style.js <skinId>           # 只分析，输出建议
//   node analyze-skin-style.js <skinId> --apply   # 分析 + 写入 HTML（内置皮肤）或输出控制台命令
//   node analyze-skin-style.js <skinId> --iterate # 多轮迭代，直到满意为止

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { spawnSync, execSync } = require('child_process');
const readline = require('readline');

// ── CLI 参数 ────────────────────────────────────────────────────────────────
const skinId   = process.argv[2];
const doApply  = process.argv.includes('--apply');
const doIter   = process.argv.includes('--iterate');

if (!skinId) {
  console.error('用法: node analyze-skin-style.js <skinId> [--apply] [--iterate]');
  process.exit(1);
}

const TMP_DIR  = path.join(os.tmpdir(), `skin-analyze-${skinId}`);
const HTML_FILE = path.join(__dirname, '..', 'design-preview', 'skin-prompt-studio.html');

// 重点分析的资产（优先选取最能体现整体风格的图）
const KEY_ASSETS = ['home-bg', 'in-game-bg', 'table', 'merlin', 'morgana', 'assassin'];

// ── 颜色工具（与 skin-prompt-studio.html 里的 nw* 函数保持一致） ───────────────
function _hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
}
function nwRgba(hex, a) {
  const [r,g,b] = _hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function nwShift(hex, amt) {
  return '#' + _hexToRgb(hex).map(v => Math.max(0,Math.min(255,v+amt)).toString(16).padStart(2,'0')).join('');
}
function nwLuminance(hex) {
  return _hexToRgb(hex).reduce((s,v,i)=>s+v*[0.2126,0.7152,0.0722][i],0) / 255;
}

// 与 HTML 里 buildNWSkinEntry 完全相同的计算逻辑
function buildSkinVars({ skinName, accentColor, bgColor, borderStyle }) {
  const acc = accentColor || '#d9b36b';
  const bg  = bgColor     || '#0f1115';
  const r   = borderStyle === 'sharp' ? '0' : '1';
  const lum  = nwLuminance(bg);
  const dark = lum < 0.35;

  const bg2         = dark ? nwShift(bg, 10) : nwShift(bg, -10);
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

  return {
    name: skinName,
    chip, chipBorder,
    isDark: dark,
    custom: true,
    // 这几个字段供 buildNWSkinEntry 缓存用，存回 customSkins 里
    bgColor, accentColor, borderStyle,
    vars: {
      '--aw-bg':               bg,
      '--aw-bg-2':             bg2,
      '--aw-panel':            panelBg,
      '--aw-panel-border':     panelBorder,
      '--aw-text':             textCol,
      '--aw-subtext':          subCol,
      '--aw-accent':           acc,
      '--aw-accent-text':      accTextAuto,
      '--aw-nav-bg':           navBg,
      '--aw-nav-border':       navBorder,
      '--aw-input-bg':         inputBg,
      '--aw-input-border':     inputBorder,
      '--aw-btn-ghost-border': btnBorder,
      '--aw-btn-ghost-text':   textCol,
      '--aw-r':                r,
    }
  };
}

// ── 工具函数 ─────────────────────────────────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error(`JSON 解析失败: ${data.slice(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https') ? https.get : http.get;
    const file = fs.createWriteStream(dest);
    get(url, res => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', reject);
  });
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => { rl.close(); resolve(answer.trim()); });
  });
}

// ── 第一步：下载皮肤图片 ──────────────────────────────────────────────────────
async function downloadAssets() {
  const apiUrl = `https://www.awalon.top/api/skin-generated/${skinId}`;
  console.log(`📡 获取 ${skinId} 资产列表...`);

  let assets;
  try {
    assets = await fetchJson(apiUrl);
  } catch(e) {
    console.error('❌ 获取资产列表失败:', e.message);
    process.exit(1);
  }

  // API 返回格式: { assets: { assetId: '/tools/...' } }
  if (assets && assets.assets) assets = assets.assets;
  if (!assets || typeof assets !== 'object') {
    console.error('❌ 资产列表格式异常:', JSON.stringify(assets).slice(0, 200));
    process.exit(1);
  }

  fs.mkdirSync(TMP_DIR, { recursive: true });

  const localPaths = {};
  for (const assetId of KEY_ASSETS) {
    const relPath = assets[assetId];
    if (!relPath) { console.log(`  ⚠  跳过 ${assetId}（无数据）`); continue; }
    const imgUrl = `https://www.awalon.top${relPath}`;
    const ext    = path.extname(relPath) || '.jpeg';
    const dest   = path.join(TMP_DIR, `${assetId}${ext}`);
    process.stdout.write(`  ⬇  ${assetId}... `);
    try {
      await downloadFile(imgUrl, dest);
      console.log('✅');
      localPaths[assetId] = dest;
    } catch(e) {
      console.log(`❌ ${e.message}`);
    }
  }

  if (Object.keys(localPaths).length === 0) {
    console.error('❌ 没有成功下载任何图片，请确认皮肤已生成');
    process.exit(1);
  }

  return localPaths;
}

// ── 第二步：调用 claude -p 分析 ───────────────────────────────────────────────
function analyzeWithClaude(localPaths, previousSuggestion) {
  const imageList = Object.entries(localPaths)
    .map(([id, p]) => `- ${id}: ${p}`)
    .join('\n');

  const prevContext = previousSuggestion
    ? `\n上一轮建议是: ${JSON.stringify(previousSuggestion)}。请在此基础上改进。\n`
    : '';

  const prompt = `你是一位经验丰富的游戏 UI 设计师，任务是分析一套移动游戏皮肤的视觉风格，并提取能让 UI 与图片风格匹配的配色方案。
${prevContext}
请先用 Read 工具逐一读取以下图片，仔细观察：
${imageList}

观察要点：
1. home-bg / in-game-bg：整体色调（偏暖/偏冷？明暗对比？主色是什么？）
2. table：桌面材质和配色
3. 角色图（merlin/morgana/assassin）：服装色、发光色、强调色

分析完毕后，根据图片整体风格，输出以下 CSS 配色参数：
- bgColor: 主背景色（hex），应与 home-bg 的主色调一致
- accentColor: 强调色（hex），取图片中最有特征的亮色（如金色光晕、法术光效等）
- borderStyle: "sharp"（直角/硬朗）或 "round"（圆角/柔和），根据图片整体气质判断
- isDark: true（暗色调）或 false（亮色调）

最终只输出一个合法 JSON，不要有任何其他文字、Markdown 代码块或解释：
{"bgColor":"#xxxxxx","accentColor":"#xxxxxx","borderStyle":"sharp"|"round","isDark":true|false,"reasoning":"一句话说明配色依据"}`;

  console.log('\n🤖 启动 claude -p 分析图片（约 30-60 秒）...\n');

  const result = spawnSync('claude', [
    '-p', prompt,
    '--allowedTools', 'Read',  // 只允许 Read 工具，避免副作用
  ], {
    encoding:  'utf8',
    timeout:   180000,  // 3 分钟超时
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    console.error('❌ claude 执行失败:', result.error.message);
    if (result.error.code === 'ENOENT') {
      console.error('   请确认 claude 已安装: which claude');
    }
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error('❌ claude 返回错误 (exit ' + result.status + '):');
    console.error(result.stderr || result.stdout);
    process.exit(1);
  }

  const output = (result.stdout || '').trim();
  console.log('📝 claude 原始输出:\n' + output + '\n');

  // 提取 JSON（claude 可能在 JSON 前后有少量说明文字）
  const jsonMatch = output.match(/\{[\s\S]*"bgColor"[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('❌ 未在输出中找到有效 JSON，请检查 claude 是否正常工作');
    process.exit(1);
  }

  let suggestion;
  try {
    suggestion = JSON.parse(jsonMatch[0]);
  } catch(e) {
    console.error('❌ JSON 解析失败:', e.message, '\n原始内容:', jsonMatch[0]);
    process.exit(1);
  }

  return suggestion;
}

// ── 第三步：展示建议 ──────────────────────────────────────────────────────────
function printSuggestion(suggestion) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 配色建议:');
  console.log(`   bgColor:     ${suggestion.bgColor}`);
  console.log(`   accentColor: ${suggestion.accentColor}`);
  console.log(`   borderStyle: ${suggestion.borderStyle}`);
  console.log(`   isDark:      ${suggestion.isDark}`);
  console.log(`   reasoning:   ${suggestion.reasoning || '—'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ── 第四步：写入配置 ──────────────────────────────────────────────────────────
function applyToHtml(suggestion) {
  // 用与 HTML 相同的颜色逻辑，预先计算完整 vars
  // 先需要知道皮肤名称——从 customSkins 里读不到，用 skinId 代替
  const entry = buildSkinVars({
    skinName:    skinId,
    accentColor: suggestion.accentColor,
    bgColor:     suggestion.bgColor,
    borderStyle: suggestion.borderStyle,
  });

  console.log('\n🎨 计算出的完整 CSS 变量:');
  Object.entries(entry.vars).forEach(([k, v]) => console.log(`   ${k}: ${v}`));

  // 生成可在浏览器控制台直接粘贴执行的命令
  // 直接覆盖 vars，无需刷新 buildNWSkinEntry
  const jsCmd = `(function(){
  var cs = JSON.parse(localStorage.getItem('customSkins') || '{}');
  if (!cs['${skinId}']) {
    console.error('未找到皮肤 ${skinId}，请先在皮肤工作室创建该皮肤');
    return;
  }
  // 更新输入参数（供以后再次编辑用）
  cs['${skinId}'].bgColor     = ${JSON.stringify(suggestion.bgColor)};
  cs['${skinId}'].accentColor = ${JSON.stringify(suggestion.accentColor)};
  cs['${skinId}'].borderStyle = ${JSON.stringify(suggestion.borderStyle)};
  cs['${skinId}'].isDark      = ${entry.isDark};
  cs['${skinId}'].chip        = ${JSON.stringify(entry.chip)};
  cs['${skinId}'].chipBorder  = ${JSON.stringify(entry.chipBorder)};
  // 直接覆盖全部 CSS 变量（立即生效）
  cs['${skinId}'].vars = ${JSON.stringify(entry.vars, null, 2)};
  localStorage.setItem('customSkins', JSON.stringify(cs));
  // 如果当前皮肤正是该皮肤，立即重新应用
  var cur = localStorage.getItem('currentSkin');
  if (cur === '${skinId}') {
    Object.entries(cs['${skinId}'].vars).forEach(([k,v]) => {
      document.documentElement.style.setProperty(k, v);
    });
    console.log('✅ CSS 变量已实时更新，无需刷新');
  } else {
    console.log('✅ 已更新 ${skinId} 配色，切换到该皮肤后生效');
  }
})();`;

  console.log('\n📋 在皮肤工作室页面的浏览器控制台执行以下命令:\n');
  console.log('```javascript');
  console.log(jsCmd);
  console.log('```\n');

  const outFile = path.join(TMP_DIR, `apply-${skinId}.js`);
  fs.writeFileSync(outFile, jsCmd, 'utf8');
  console.log(`💾 已保存到: ${outFile}`);
  console.log('   可用 pbcopy 复制: cat ' + outFile + ' | pbcopy');
}

// ── 主流程 ────────────────────────────────────────────────────────────────────
async function main() {
  const localPaths = await downloadAssets();

  if (doIter) {
    // 迭代模式
    let suggestion = null;
    let round = 1;
    while (true) {
      console.log(`\n🔄 第 ${round} 轮分析...`);
      suggestion = analyzeWithClaude(localPaths, suggestion);
      printSuggestion(suggestion);

      const ans = await ask('\n是否满意？[y=满意/n=继续迭代/q=放弃] ');
      if (ans === 'y' || ans === 'Y') break;
      if (ans === 'q' || ans === 'Q') { console.log('放弃。'); return; }
      round++;
    }

    if (doApply) applyToHtml(suggestion);
    else console.log('\n💡 加 --apply 参数可自动输出浏览器控制台命令');

  } else {
    // 单次分析
    const suggestion = analyzeWithClaude(localPaths, null);
    printSuggestion(suggestion);

    if (doApply) applyToHtml(suggestion);
    else console.log('\n💡 加 --apply 参数可输出浏览器控制台命令来应用配色');
  }
}

main().catch(e => {
  console.error('❌ 意外错误:', e.message);
  process.exit(1);
});
