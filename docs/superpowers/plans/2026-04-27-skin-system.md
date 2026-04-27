# Skin System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 6-skin visual theming system with a skin selector on the personal page (我的主页), replacing all hardcoded chrome colors in the miniprogram with CSS variables.

**Architecture:** CSS custom properties cascaded from a `.theme-{id}` class on the root `.page` element. A new `skins.js` module owns skin definitions and skin-aware role image URLs. Skin selection persists via `wx.storage` and propagates to all open pages via a `globalData.skinChangeListener` callback.

**Tech Stack:** WeChat Miniprogram (WXML/WXSS/JS), CSS Custom Properties, `wx.setStorageSync`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `mobile/miniprogram/skins.js` | **Create** | SKINS array, `getSkin(id)`, `roleImageFor(role, skinId)` |
| `mobile/miniprogram/app.wxss` | **Modify** | Replace `:root` vars with full `page {}` var set + 6 theme class overrides |
| `mobile/miniprogram/app.js` | **Modify** | Load skinId from storage on launch; add `skinChangeListener` to globalData |
| `mobile/miniprogram/utils/gameUtils.js` | **Modify** | Update `roleImageFor` to accept optional `skinId` arg, delegate to `skins.js` |
| `mobile/miniprogram/pages/index/index.wxss` | **Modify** | Replace chrome colors → `var(--aw-*)` (nav, panel, text, border, input, accent) |
| `mobile/miniprogram/pages/index/index.js` | **Modify** | Load skinId from `app.globalData`; register `skinChangeListener`; update roleImageFor calls |
| `mobile/miniprogram/pages/index/index.wxml` | **Modify** | Bind `class="page theme-{{skinId}}"` on root view |
| `mobile/miniprogram/subpkg/role-stats/index/index.js` | **Modify** | Add skinId; skin picker handler; page title → 我的主页; broadcast skin change |
| `mobile/miniprogram/subpkg/role-stats/index/index.wxml` | **Modify** | Add skin selector section at top; bind skinId class |
| `mobile/miniprogram/subpkg/role-stats/index/index.wxss` | **Modify** | Add skin picker styles |
| `mobile/miniprogram/subpkg/history/index/index.wxml` | **Modify** | Bind skinId class |
| `mobile/miniprogram/subpkg/history/index/index.js` | **Modify** | Load skinId from globalData |
| `mobile/miniprogram/subpkg/history-detail/index/index.wxml` | **Modify** | Bind skinId class |
| `mobile/miniprogram/subpkg/history-detail/index/index.js` | **Modify** | Load skinId from globalData |

---

## Task 1: Create `skins.js`

**Files:**
- Create: `mobile/miniprogram/skins.js`

- [ ] **Step 1: Create the file**

```js
// mobile/miniprogram/skins.js

const IMAGE_BASE = 'https://www.awalon.top/mp-assets';

const ROLE_FILE_MAP = {
  '梅林':    'merlin',
  '派西维尔': 'percival',
  '忠臣':    'arthur_loyal',
  '亚瑟的忠臣': 'arthur_loyal',
  '刺客':    'assassin',
  '莫甘娜':  'morgana',
  '莫德雷德': 'mordred',
  '奥伯伦':  'oberon',
  '爪牙':    'minion',
  '兰斯洛特（正义）': 'lancelot_good',
  '兰斯洛特（邪恶）': 'lancelot_evil',
};

const SKINS = [
  {
    id: 'dark-gold',
    name: '暗夜金',
    isDark: true,
    cssClass: 'theme-dark-gold',
    colors: { bg: '#0f1115', panel: 'rgba(19,23,31,0.82)', accent: '#d9b36b' },
    imageBase: null,
    bgImage: null,
  },
  {
    id: 'celestial',
    name: '仙境',
    isDark: false,
    cssClass: 'theme-celestial',
    colors: { bg: '#ddeeff', panel: 'rgba(255,255,255,0.75)', accent: '#2e7fc8' },
    imageBase: null,
    bgImage: null,
  },
  {
    id: 'ink-wash',
    name: '水墨古风',
    isDark: false,
    cssClass: 'theme-ink-wash',
    colors: { bg: '#f4f0ea', panel: 'rgba(244,240,234,0.88)', accent: '#2d2520' },
    imageBase: null,
    bgImage: null,
  },
  {
    id: 'cyber-neon',
    name: '赛博霓虹',
    isDark: true,
    cssClass: 'theme-cyber-neon',
    colors: { bg: '#0d0b16', panel: 'rgba(20,16,40,0.88)', accent: '#e879f9' },
    imageBase: null,
    bgImage: null,
  },
  {
    id: 'dark-dungeon',
    name: '暗黑地牢',
    isDark: true,
    cssClass: 'theme-dark-dungeon',
    colors: { bg: '#0e0a07', panel: 'rgba(20,14,8,0.90)', accent: '#c8902a' },
    imageBase: null,
    bgImage: null,
  },
  {
    id: 'abyss',
    name: '深渊',
    isDark: true,
    cssClass: 'theme-abyss',
    colors: { bg: '#050507', panel: 'rgba(8,8,16,0.92)', accent: '#4060c0' },
    imageBase: null,
    bgImage: null,
  },
];

function getSkin(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}

function roleImageFor(role, skinId) {
  const file = ROLE_FILE_MAP[role];
  if (!file) return '';
  const skin = getSkin(skinId);
  const base = (skin && skin.imageBase) ? skin.imageBase : `${IMAGE_BASE}/role-split`;
  return `${base}/${file}.png`;
}

module.exports = { SKINS, getSkin, roleImageFor };
```

- [ ] **Step 2: Verify the file loads in DevTools**

Open WeChat DevTools → Console → run:
```js
const { SKINS, getSkin, roleImageFor } = require('/miniprogram/skins');
console.log(SKINS.length);            // 6
console.log(getSkin('abyss').name);   // 深渊
console.log(getSkin('bad-id').id);    // dark-gold  (fallback)
console.log(roleImageFor('梅林', 'dark-gold'));  // https://www.awalon.top/mp-assets/role-split/merlin.png
console.log(roleImageFor('梅林', 'celestial'));  // same (imageBase is null → fallback)
console.log(roleImageFor('未知角色', 'dark-gold')); // ''
```

- [ ] **Step 3: Commit**

```bash
git add mobile/miniprogram/skins.js
git commit -m "feat(skin): add skins.js with 6 skin definitions and roleImageFor"
```

---

## Task 2: Expand `app.wxss` with full CSS variable system

**Files:**
- Modify: `mobile/miniprogram/app.wxss`

- [ ] **Step 1: Replace the entire `app.wxss` content**

```css
/* mobile/miniprogram/app.wxss */

/* ── Default theme: dark-gold ─────────────────────────── */
page {
  /* Chrome variables – replaced per theme */
  --aw-bg:               #0f1115;
  --aw-bg-2:             #161b24;
  --aw-panel:            rgba(19,23,31,0.82);
  --aw-panel-border:     rgba(255,255,255,0.10);
  --aw-text:             #eef1f7;
  --aw-subtext:          #aeb6c7;
  --aw-accent:           #d9b36b;
  --aw-accent-text:      #1a1200;
  --aw-nav-bg:           rgba(12,16,24,0.88);
  --aw-nav-border:       rgba(255,255,255,0.08);
  --aw-chip-on-bg:       rgba(217,179,107,0.18);
  --aw-chip-on-border:   rgba(217,179,107,0.45);
  --aw-chip-on-text:     #d9b36b;
  --aw-btn-ghost-border: rgba(255,255,255,0.22);
  --aw-btn-ghost-text:   #eef1f7;
  --aw-input-bg:         rgba(255,255,255,0.06);
  --aw-input-border:     rgba(255,255,255,0.14);
  --aw-bg-image:         none;

  background: var(--aw-bg);
  color: var(--aw-text);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
}

/* ── 仙境 (light blue watercolor) ──────────────────────── */
.theme-celestial {
  --aw-bg:               #ddeeff;
  --aw-bg-2:             #c8e0f8;
  --aw-panel:            rgba(255,255,255,0.75);
  --aw-panel-border:     rgba(100,160,220,0.25);
  --aw-text:             #1a2a3a;
  --aw-subtext:          #4a6a8a;
  --aw-accent:           #2e7fc8;
  --aw-accent-text:      #ffffff;
  --aw-nav-bg:           rgba(200,230,255,0.90);
  --aw-nav-border:       rgba(100,160,220,0.20);
  --aw-chip-on-bg:       rgba(46,127,200,0.15);
  --aw-chip-on-border:   rgba(46,127,200,0.50);
  --aw-chip-on-text:     #1a5a9a;
  --aw-btn-ghost-border: rgba(46,127,200,0.35);
  --aw-btn-ghost-text:   #2e7fc8;
  --aw-input-bg:         rgba(255,255,255,0.60);
  --aw-input-border:     rgba(100,160,220,0.30);
  --aw-bg-image:         none;
}

/* ── 水墨古风 (ink wash, near-monochrome) ──────────────── */
.theme-ink-wash {
  --aw-bg:               #f4f0ea;
  --aw-bg-2:             #e8e2d8;
  --aw-panel:            rgba(244,240,234,0.88);
  --aw-panel-border:     rgba(0,0,0,0.12);
  --aw-text:             #1a1612;
  --aw-subtext:          #6b5f54;
  --aw-accent:           #2d2520;
  --aw-accent-text:      #f4f0ea;
  --aw-nav-bg:           rgba(234,230,220,0.92);
  --aw-nav-border:       rgba(0,0,0,0.08);
  --aw-chip-on-bg:       rgba(45,37,32,0.12);
  --aw-chip-on-border:   rgba(45,37,32,0.40);
  --aw-chip-on-text:     #2d2520;
  --aw-btn-ghost-border: rgba(0,0,0,0.22);
  --aw-btn-ghost-text:   #2d2520;
  --aw-input-bg:         rgba(255,255,255,0.70);
  --aw-input-border:     rgba(0,0,0,0.16);
  --aw-bg-image:         none;
}

/* ── 赛博霓虹 (cyberpunk neon purple) ──────────────────── */
.theme-cyber-neon {
  --aw-bg:               #0d0b16;
  --aw-bg-2:             #14102a;
  --aw-panel:            rgba(20,16,40,0.88);
  --aw-panel-border:     rgba(232,121,249,0.15);
  --aw-text:             #f0e8ff;
  --aw-subtext:          #b097d8;
  --aw-accent:           #e879f9;
  --aw-accent-text:      #1a0020;
  --aw-nav-bg:           rgba(10,6,22,0.92);
  --aw-nav-border:       rgba(232,121,249,0.12);
  --aw-chip-on-bg:       rgba(232,121,249,0.15);
  --aw-chip-on-border:   rgba(232,121,249,0.45);
  --aw-chip-on-text:     #e879f9;
  --aw-btn-ghost-border: rgba(232,121,249,0.30);
  --aw-btn-ghost-text:   #f0e8ff;
  --aw-input-bg:         rgba(255,255,255,0.05);
  --aw-input-border:     rgba(232,121,249,0.20);
  --aw-bg-image:         none;
}

/* ── 暗黑地牢 (gothic dark brown) ─────────────────────── */
.theme-dark-dungeon {
  --aw-bg:               #0e0a07;
  --aw-bg-2:             #1a1208;
  --aw-panel:            rgba(20,14,8,0.90);
  --aw-panel-border:     rgba(180,130,60,0.15);
  --aw-text:             #e8d8b8;
  --aw-subtext:          #9a8060;
  --aw-accent:           #c8902a;
  --aw-accent-text:      #0e0a07;
  --aw-nav-bg:           rgba(10,6,2,0.92);
  --aw-nav-border:       rgba(180,130,60,0.10);
  --aw-chip-on-bg:       rgba(200,144,42,0.18);
  --aw-chip-on-border:   rgba(200,144,42,0.45);
  --aw-chip-on-text:     #c8902a;
  --aw-btn-ghost-border: rgba(200,144,42,0.30);
  --aw-btn-ghost-text:   #e8d8b8;
  --aw-input-bg:         rgba(255,255,255,0.04);
  --aw-input-border:     rgba(180,130,60,0.18);
  --aw-bg-image:         none;
}

/* ── 深渊 (near-black deep space) ─────────────────────── */
.theme-abyss {
  --aw-bg:               #050507;
  --aw-bg-2:             #0a0a12;
  --aw-panel:            rgba(8,8,16,0.92);
  --aw-panel-border:     rgba(100,120,180,0.12);
  --aw-text:             #d0d8f0;
  --aw-subtext:          #7080a8;
  --aw-accent:           #4060c0;
  --aw-accent-text:      #ffffff;
  --aw-nav-bg:           rgba(2,2,8,0.95);
  --aw-nav-border:       rgba(80,100,160,0.10);
  --aw-chip-on-bg:       rgba(64,96,192,0.18);
  --aw-chip-on-border:   rgba(64,96,192,0.45);
  --aw-chip-on-text:     #4060c0;
  --aw-btn-ghost-border: rgba(80,100,160,0.30);
  --aw-btn-ghost-text:   #d0d8f0;
  --aw-input-bg:         rgba(255,255,255,0.04);
  --aw-input-border:     rgba(80,100,160,0.16);
  --aw-bg-image:         none;
}
```

- [ ] **Step 2: Verify in DevTools**

Open WeChat DevTools, navigate to index page. The page should look identical to before (dark-gold is default). No visual change expected yet.

- [ ] **Step 3: Commit**

```bash
git add mobile/miniprogram/app.wxss
git commit -m "feat(skin): expand app.wxss with 18 CSS vars and 6 theme classes"
```

---

## Task 3: Update `app.js` — skin persistence and listener

**Files:**
- Modify: `mobile/miniprogram/app.js`

- [ ] **Step 1: Add skinId loading and skinChangeListener**

In `mobile/miniprogram/app.js`, replace the entire file:

```js
App({
  onLaunch() {
    let statusBarHeight = 20;
    let navBarHeight = 44;
    try {
      const win = wx.getWindowInfo();
      statusBarHeight = win.statusBarHeight || statusBarHeight;
      const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
      if (menu && menu.height && menu.top) {
        navBarHeight = menu.height + (menu.top - statusBarHeight) * 2;
      }
    } catch (e) {}
    this.globalData.nav = {
      statusBarHeight,
      navBarHeight,
      navTotalHeight: statusBarHeight + navBarHeight
    };

    // 皮肤
    const savedSkin = wx.getStorageSync('selectedSkin') || 'dark-gold';
    this.globalData.skinId = savedSkin;

    // 审核模式开关
    wx.request({
      url: this.globalData.apiBase + '/api/review-mode',
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          this.globalData.reviewMode = !!res.data.reviewMode;
          if (typeof this.globalData.reviewModeListener === 'function') {
            this.globalData.reviewModeListener(this.globalData.reviewMode);
          }
        }
      }
    });
    // 角色配置
    wx.request({
      url: this.globalData.apiBase + '/api/role-config',
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          this.globalData.roleConfig = res.data;
          if (typeof this.globalData.roleConfigListener === 'function') {
            this.globalData.roleConfigListener(res.data);
          }
        }
      }
    });
  },
  globalData: {
    wsUrl: "wss://www.awalon.top/ws",
    apiBase: "https://www.awalon.top",
    roleConfig: {},
    nav: {
      statusBarHeight: 20,
      navBarHeight: 44,
      navTotalHeight: 64
    },
    theme: {
      bg: "#0f1115",
      panel: "rgba(19,23,31,0.82)",
      border: "rgba(255,255,255,0.1)",
      text: "#eef1f7",
      subText: "#aeb6c7",
      accent: "#d9b36b"
    },
    skinId: 'dark-gold',
    skinChangeListener: null,
    reviewMode: false,
    reviewModeListener: null,
    roleConfigListener: null,
    latestHistoryList: null,
    latestHistoryDetail: null,
    latestRoleStats: null,
    historyListListener: null,
    historyDetailListener: null,
    roleStatsListener: null
  }
});
```

- [ ] **Step 2: Verify**

Open DevTools → Console:
```js
getApp().globalData.skinId  // 'dark-gold'
```

Close and reopen the miniprogram — skinId should persist (it reads from storage).

- [ ] **Step 3: Commit**

```bash
git add mobile/miniprogram/app.js
git commit -m "feat(skin): add skinId init and skinChangeListener to app.js"
```

---

## Task 4: Update `gameUtils.js` — skin-aware `roleImageFor`

**Files:**
- Modify: `mobile/miniprogram/utils/gameUtils.js` (lines 1-3 and 46-49)

- [ ] **Step 1: Add skins.js import at top of gameUtils.js**

At the very top of the file, add the import on line 3 (after the existing require):

Find:
```js
// 游戏纯计算工具函数（不依赖 this/setData）

const { decorateMedals } = require('./medals');
```

Replace with:
```js
// 游戏纯计算工具函数（不依赖 this/setData）

const { decorateMedals } = require('./medals');
const { roleImageFor: roleImageForSkin } = require('../skins');
```

- [ ] **Step 2: Update `roleImageFor` function (around line 46)**

Find the existing function:
```js
function roleImageFor(role) {
  return ROLE_IMAGE_MAP[role] || '';
}
```

Replace with:
```js
function roleImageFor(role, skinId) {
  // Use skin-aware lookup; fall back to static map for unknown roles
  const skinUrl = roleImageForSkin(role, skinId);
  if (skinUrl) return skinUrl;
  return ROLE_IMAGE_MAP[role] || '';
}
```

- [ ] **Step 3: Verify**

In DevTools Console:
```js
const { roleImageFor } = require('/miniprogram/utils/gameUtils');
console.log(roleImageFor('梅林'));           // https://www.awalon.top/mp-assets/role-split/merlin.png
console.log(roleImageFor('梅林', 'abyss'));  // same URL (imageBase is null for all skins currently)
console.log(roleImageFor('未知'));           // ''
```

- [ ] **Step 4: Commit**

```bash
git add mobile/miniprogram/utils/gameUtils.js
git commit -m "feat(skin): make gameUtils roleImageFor skin-aware"
```

---

## Task 5: Refactor `index.wxss` — chrome colors → CSS variables

This is the largest task. `index.wxss` is 3351 lines with ~501 color references. Most are game-semantic (faction colors, role colors) — **leave those alone**. Replace only the chrome/structural colors listed below.

**Files:**
- Modify: `mobile/miniprogram/pages/index/index.wxss`

- [ ] **Step 1: Run the replacement script**

Save the following as `/tmp/patch_wxss.py`, then run it:

```python
#!/usr/bin/env python3
import re

path = 'mobile/miniprogram/pages/index/index.wxss'
with open(path, 'r') as f:
    src = f.read()

# Order matters: more-specific patterns before less-specific
replacements = [
    # Nav background (rgba with spaces)
    (r'rgba\(12,\s*16,\s*24,\s*0\.88\)',  'var(--aw-nav-bg)'),
    (r'rgba\(12,\s*16,\s*24,\s*0\.82\)',  'var(--aw-nav-bg)'),
    # Nav border
    (r'rgba\(255,\s*255,\s*255,\s*0\.08\)', 'var(--aw-nav-border)'),
    # Main panel background
    (r'rgba\(19,\s*23,\s*31,\s*0\.82\)',  'var(--aw-panel)'),
    # Panel border (0.10 and 0.1 forms)
    (r'rgba\(255,\s*255,\s*255,\s*0\.10\)', 'var(--aw-panel-border)'),
    (r'rgba\(255,\s*255,\s*255,\s*0\.1\)',  'var(--aw-panel-border)'),
    # Slightly different border opacities used on inputs/rows
    (r'rgba\(255,\s*255,\s*255,\s*0\.14\)', 'var(--aw-input-border)'),
    (r'rgba\(255,\s*255,\s*255,\s*0\.12\)', 'var(--aw-panel-border)'),
    (r'rgba\(255,\s*255,\s*255,\s*0\.22\)', 'var(--aw-btn-ghost-border)'),
    # Input background
    (r'rgba\(255,\s*255,\s*255,\s*0\.06\)', 'var(--aw-input-bg)'),
    (r'rgba\(255,\s*255,\s*255,\s*0\.05\)', 'var(--aw-input-bg)'),
    # Chip on (accent-tinted)
    (r'rgba\(217,\s*179,\s*107,\s*0\.18\)', 'var(--aw-chip-on-bg)'),
    (r'rgba\(217,\s*179,\s*107,\s*0\.45\)', 'var(--aw-chip-on-border)'),
    (r'rgba\(216,\s*176,\s*107,\s*0\.18\)', 'var(--aw-chip-on-bg)'),
    (r'rgba\(216,\s*176,\s*107,\s*0\.45\)', 'var(--aw-chip-on-border)'),
    # Main text
    (r'#eef1f7', 'var(--aw-text)'),
    (r'#eef2fa', 'var(--aw-text)'),
    (r'#eef3fa', 'var(--aw-text)'),
    (r'#dfe7f8', 'var(--aw-text)'),
    (r'#f2eeff', 'var(--aw-text)'),
    # Subtext
    (r'#aeb6c7', 'var(--aw-subtext)'),
    # Accent gold
    (r'#d9b36b', 'var(--aw-accent)'),
    (r'#d8b06b', 'var(--aw-accent)'),
    # Background
    (r'#0f1115', 'var(--aw-bg)'),
    (r'#161b24', 'var(--aw-bg-2)'),
]

for pattern, replacement in replacements:
    src = re.sub(pattern, replacement, src)

with open(path, 'w') as f:
    f.write(src)

print('Done. Run grep to verify:')
print('  grep -n "var(--aw-" mobile/miniprogram/pages/index/index.wxss | wc -l')
```

Run it:
```bash
cd /path/to/awalon-chao
python3 /tmp/patch_wxss.py
```

- [ ] **Step 2: Verify replacement count**

```bash
grep -c "var(--aw-" mobile/miniprogram/pages/index/index.wxss
# Expected: 80-120 replacements
```

- [ ] **Step 3: Check no accidental replacements of faction colors**

Faction colors must NOT have been replaced (these are identity-system colors that stay constant):

```bash
# These should still be present as literal colors:
grep -c "#4e9eff\|#f87171\|#fca5a5\|#c084fc\|#e9d5ff\|#bfdbfe" mobile/miniprogram/pages/index/index.wxss
# Expected: > 0 (faction colors untouched)

# These should be gone:
grep -c "#d9b36b\|#d8b06b\|#eef1f7\|#aeb6c7\|#0f1115" mobile/miniprogram/pages/index/index.wxss
# Expected: 0 or very small number (manual edge cases)
```

- [ ] **Step 4: Add `.page` background-image binding**

In `index.wxss`, find the `.page` block at the very top:

```css
.page {
  position: relative;
  min-height: 100vh;
  overflow: auto;

  /* ── 身份阵营颜色系统 ────────────────────────── */
```

Add the background-image line after `overflow: auto;`:

```css
.page {
  position: relative;
  min-height: 100vh;
  overflow: auto;
  background-image: var(--aw-bg-image);
  background-size: cover;
  background-position: center;

  /* ── 身份阵营颜色系统 ────────────────────────── */
```

- [ ] **Step 5: Preview in DevTools**

Open index page in WeChat DevTools. Page should look identical to before. Temporarily add `theme-celestial` class to the root `<view class="page">` in DevTools Elements panel — the background should turn light blue.

Remove the manual class after verifying.

- [ ] **Step 6: Commit**

```bash
git add mobile/miniprogram/pages/index/index.wxss
git commit -m "feat(skin): replace chrome colors with CSS vars in index.wxss"
```

---

## Task 6: Bind skinId in `index.js` and `index.wxml`

**Files:**
- Modify: `mobile/miniprogram/pages/index/index.js`
- Modify: `mobile/miniprogram/pages/index/index.wxml`

- [ ] **Step 1: Add `skinId` to page `data` in `index.js`**

In the `data: { ... }` block (around line 64), add `skinId: 'dark-gold'` near the other display properties. Find a line like:
```js
    wsUrl: "",
```
Add after it:
```js
    skinId: 'dark-gold',
```

- [ ] **Step 2: Load skinId in `onLoad` (or early init)**

Find the `onLoad` method. Locate where `app.globalData.nav` is accessed to initialize nav dimensions. Add skinId loading right after that block:

```js
    // Load skin
    const app = getApp();
    this.setData({ skinId: app.globalData.skinId || 'dark-gold' });
    // Listen for skin changes from role-stats page
    app.globalData.skinChangeListener = (newSkinId) => {
      this.setData({ skinId: newSkinId });
    };
```

- [ ] **Step 3: Bind class in `index.wxml`**

Find the root view element (first line of index.wxml):
```html
<view class="page">
```

Replace with:
```html
<view class="page theme-{{skinId}}">
```

- [ ] **Step 4: Verify in DevTools**

Open index page. Open WeChat DevTools → `app.globalData.skinId = 'theme-celestial'` won't work yet (need role-stats UI), but you can test by temporarily setting:
```js
getCurrentPages()[0].setData({ skinId: 'cyber-neon' })
```
The page should immediately shift to dark purple tones.

Reset with:
```js
getCurrentPages()[0].setData({ skinId: 'dark-gold' })
```

- [ ] **Step 5: Commit**

```bash
git add mobile/miniprogram/pages/index/index.js mobile/miniprogram/pages/index/index.wxml
git commit -m "feat(skin): bind skinId to index page root element"
```

---

## Task 7: Build skin selector in `role-stats` (我的主页)

**Files:**
- Modify: `mobile/miniprogram/subpkg/role-stats/index/index.js`
- Modify: `mobile/miniprogram/subpkg/role-stats/index/index.wxml`
- Modify: `mobile/miniprogram/subpkg/role-stats/index/index.wxss`

- [ ] **Step 1: Update `role-stats/index/index.js`**

Replace the entire file:

```js
const { ALL_MEDALS, decorateMedals } = require("../../../utils/medals");
const { SKINS } = require("../../../skins");

const ROLE_IMAGE_MAP = {
  梅林: "https://www.awalon.top/mp-assets/role-split/merlin.png",
  派西维尔: "https://www.awalon.top/mp-assets/role-split/percival.png",
  忠臣: "https://www.awalon.top/mp-assets/role-split/arthur_loyal.png",
  "亚瑟的忠臣": "https://www.awalon.top/mp-assets/role-split/arthur_loyal.png",
  "兰斯洛特（正义）": "https://www.awalon.top/mp-assets/role-split/lancelot_good.png",
  莫甘娜: "https://www.awalon.top/mp-assets/role-split/morgana.png",
  刺客: "https://www.awalon.top/mp-assets/role-split/assassin.png",
  莫德雷德: "https://www.awalon.top/mp-assets/role-split/mordred.png",
  奥伯伦: "https://www.awalon.top/mp-assets/role-split/oberon.png",
  爪牙: "https://www.awalon.top/mp-assets/role-split/minion.png",
  "兰斯洛特（邪恶）": "https://www.awalon.top/mp-assets/role-split/lancelot_evil.png"
};

const ALL_ROLES = [
  "梅林", "派西维尔", "忠臣", "兰斯洛特（正义）",
  "刺客", "莫甘娜", "莫德雷德", "奥伯伦", "爪牙", "兰斯洛特（邪恶）"
];
const GOOD_ROLE_SET = new Set(["梅林", "派西维尔", "忠臣", "亚瑟的忠臣", "兰斯洛特（正义）"]);
const EVIL_ROLE_SET = new Set(["刺客", "莫甘娜", "莫德雷德", "奥伯伦", "爪牙", "兰斯洛特（邪恶）"]);

function getIndexPage() {
  const pages = getCurrentPages();
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    if (pages[i].route === "pages/index/index") return pages[i];
  }
  return null;
}

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    navTotalHeight: 64,
    skinId: 'dark-gold',
    skins: [],
    loading: true,
    roleStats: null,
    statsList: [],
    goodSummary: { total: 0, wins: 0, winRate: 0 },
    evilSummary: { total: 0, wins: 0, winRate: 0 },
    factionBarGoodPct: 50,
    factionBarEvilPct: 50,
    medalTotal: 0,
    goodMedals: [],
    evilMedals: []
  },

  onLoad() {
    const app = getApp();
    const nav = (app.globalData && app.globalData.nav) || {};
    const skinId = (app.globalData && app.globalData.skinId) || 'dark-gold';
    const skins = SKINS.map((s) => ({
      id: s.id,
      name: s.name,
      bg: s.colors.bg,
      panel: s.colors.panel,
      accent: s.colors.accent,
    }));
    this.setData({
      statusBarHeight: nav.statusBarHeight || 20,
      navBarHeight: nav.navBarHeight || 44,
      navTotalHeight: nav.navTotalHeight || 64,
      skinId,
      skins,
    });
  },

  onShow() {
    const app = getApp();
    // Sync skinId in case it changed
    const skinId = (app.globalData && app.globalData.skinId) || 'dark-gold';
    this.setData({ skinId });

    app.globalData.roleStatsListener = (stats) => {
      const roleStats = stats || null;
      const byRoleMap = new Map(
        (((roleStats && roleStats.byRole) || [])).map((item) => [item.role, item])
      );
      const statsList = ALL_ROLES.map((role) => {
        const found = byRoleMap.get(role) || null;
        const total = found ? Number(found.total || 0) : 0;
        const wins = found ? Number(found.wins || 0) : 0;
        const winRate = total > 0 ? Number((wins * 100 / total).toFixed(1)) : 0;
        const faction = GOOD_ROLE_SET.has(role) ? "good" : EVIL_ROLE_SET.has(role) ? "evil" : "good";
        return {
          role, total, wins, winRate,
          roleImage: ROLE_IMAGE_MAP[role] || "",
          rateDeg: Number((winRate * 3.6).toFixed(1)),
          winRateClass: winRate >= 50 ? "rate-good" : "rate-bad",
          roleNameClass: faction === "evil" ? "role-name-evil" : "role-name-good",
          faction
        };
      });
      const good = statsList.filter((item) => item.faction === "good");
      const evil = statsList.filter((item) => item.faction === "evil");
      const goodTotal = good.reduce((s, item) => s + Number(item.total || 0), 0);
      const goodWins = good.reduce((s, item) => s + Number(item.wins || 0), 0);
      const evilTotal = evil.reduce((s, item) => s + Number(item.total || 0), 0);
      const evilWins = evil.reduce((s, item) => s + Number(item.wins || 0), 0);
      const goodSummary = {
        total: goodTotal, wins: goodWins,
        winRate: goodTotal > 0 ? Number((goodWins * 100 / goodTotal).toFixed(1)) : 0
      };
      const evilSummary = {
        total: evilTotal, wins: evilWins,
        winRate: evilTotal > 0 ? Number((evilWins * 100 / evilTotal).toFixed(1)) : 0
      };
      const rawMedalMap = new Map((((roleStats && roleStats.medals) || [])).map((m) => [m.code, Number(m.total || 0)]));
      const legacyMerge = { good_protect_round_fail_captain: "good_first_round_clean_captain" };
      for (const [legacyCode, newCode] of Object.entries(legacyMerge)) {
        const legacyCount = rawMedalMap.get(legacyCode) || 0;
        if (legacyCount > 0) rawMedalMap.set(newCode, (rawMedalMap.get(newCode) || 0) + legacyCount);
      }
      const medalList = decorateMedals(ALL_MEDALS.filter((m) => !m.hidden).map((m) => ({
        ...m, total: rawMedalMap.get(m.code) || 0
      })));
      const goodMedals = medalList.filter((m) => m.faction === "good");
      const evilMedals = medalList.filter((m) => m.faction === "evil");
      const barTotal = goodTotal + evilTotal || 1;
      const factionBarGoodPct = Number((goodTotal * 100 / barTotal).toFixed(1));
      const factionBarEvilPct = Number((100 - factionBarGoodPct).toFixed(1));
      this.setData({
        roleStats, statsList, goodSummary, evilSummary,
        factionBarGoodPct, factionBarEvilPct,
        medalTotal: Number((roleStats && roleStats.totalMedals) || 0),
        goodMedals, evilMedals, loading: false
      });
    };

    if (app.globalData.latestRoleStats) {
      app.globalData.roleStatsListener(app.globalData.latestRoleStats);
      return;
    }
    const indexPage = getIndexPage();
    if (indexPage && typeof indexPage.requestRoleStats === "function") {
      this.setData({ loading: true });
      indexPage.requestRoleStats();
    }
  },

  onUnload() {
    const app = getApp();
    if (app.globalData.roleStatsListener) app.globalData.roleStatsListener = null;
  },

  onPickSkin(e) {
    const skinId = String(e.currentTarget.dataset.id || 'dark-gold');
    const app = getApp();
    wx.setStorageSync('selectedSkin', skinId);
    app.globalData.skinId = skinId;
    this.setData({ skinId });
    // Notify index page
    if (typeof app.globalData.skinChangeListener === 'function') {
      app.globalData.skinChangeListener(skinId);
    }
  },

  onTapMedal(e) {
    const name = String(e.currentTarget.dataset.name || "勋章");
    const description = String(e.currentTarget.dataset.description || "暂无说明");
    wx.showModal({ title: name, content: description, showCancel: false, confirmText: "知道了" });
  },

  onBackHome() {
    const pages = getCurrentPages();
    if (pages.length > 1) { wx.navigateBack({ delta: 1 }); return; }
    wx.reLaunch({ url: "/pages/index/index" });
  }
});
```

- [ ] **Step 2: Update `role-stats/index/index.wxml`**

Replace the entire file:

```xml
<view class="page theme-{{skinId}}">
  <image class="bg" src="https://www.awalon.top/mp-assets/in-game-bg-optimized.jpg" mode="aspectFill" />
  <view class="mask"></view>

  <nav-header title="我的主页" statusBarHeight="{{statusBarHeight}}" navBarHeight="{{navBarHeight}}" bind:back="onBackHome"></nav-header>

  <view class="content" style="padding-top: {{navTotalHeight + 8}}px;">

    <!-- ── 外观皮肤 ── -->
    <view class="panel skin-picker-panel">
      <view class="panel-header">
        <text class="panel-title">外观皮肤</text>
      </view>
      <view class="skin-grid">
        <view
          class="skin-card {{item.id === skinId ? 'skin-card-active' : ''}}"
          wx:for="{{skins}}"
          wx:key="id"
          data-id="{{item.id}}"
          bindtap="onPickSkin"
        >
          <view class="skin-preview">
            <view class="skin-dot" style="background:{{item.bg}}"></view>
            <view class="skin-dot" style="background:{{item.panel}}"></view>
            <view class="skin-dot" style="background:{{item.accent}}"></view>
          </view>
          <text class="skin-name">{{item.name}}</text>
          <view wx:if="{{item.id === skinId}}" class="skin-check">✓</view>
        </view>
      </view>
    </view>

    <view class="panel" wx:if="{{loading}}">
      <text class="meta">加载中...</text>
    </view>

    <block wx:if="{{!loading && roleStats}}">

      <!-- ── 总览 ── -->
      <view class="panel">
        <view class="panel-header">
          <text class="panel-title">总览</text>
          <text class="panel-subtitle">近期战绩</text>
        </view>

        <view class="overview-numbers">
          <view class="stat-block">
            <text class="stat-num stat-blue">{{roleStats.totalGames}}</text>
            <text class="stat-label">总对局</text>
          </view>
          <view class="stat-divider"></view>
          <view class="stat-block">
            <text class="stat-num stat-green">{{roleStats.overallWinRate}}%</text>
            <text class="stat-label">总胜率</text>
          </view>
        </view>

        <view class="faction-wrap">
          <view class="faction-bar-labels">
            <text class="faction-bar-tag good">正义阵营 · {{goodSummary.total}}局</text>
            <text class="faction-bar-tag evil">邪恶阵营 · {{evilSummary.total}}局</text>
          </view>
          <view class="faction-bar-track">
            <view class="faction-bar-good" style="width: {{factionBarGoodPct}}%"></view>
            <view class="faction-bar-evil" style="width: {{factionBarEvilPct}}%"></view>
          </view>
          <view class="faction-cards">
            <view class="faction-card faction-card-good">
              <text class="faction-card-title good">正义阵营</text>
              <view class="faction-stat-row">
                <text class="faction-stat-big good">{{goodSummary.wins}}</text>
                <text class="faction-stat-small">/ {{goodSummary.total}} 胜</text>
              </view>
              <text class="faction-win-rate good">胜率 {{goodSummary.winRate}}%</text>
            </view>
            <view class="faction-card faction-card-evil">
              <text class="faction-card-title evil">邪恶阵营</text>
              <view class="faction-stat-row">
                <text class="faction-stat-big evil">{{evilSummary.wins}}</text>
                <text class="faction-stat-small">/ {{evilSummary.total}} 胜</text>
              </view>
              <text class="faction-win-rate evil">胜率 {{evilSummary.winRate}}%</text>
            </view>
          </view>
        </view>
      </view>

      <!-- ── 角色统计 ── -->
      <view class="panel rs-panel">
        <view class="panel-header">
          <text class="panel-title">按角色统计</text>
        </view>
        <view class="role-grid">
          <view class="role-card" wx:for="{{statsList}}" wx:key="role">
            <view class="role-card-topbar {{item.faction}}"></view>
            <view class="gauge-wrap">
              <view class="gauge-ring" style="background: conic-gradient({{item.faction==='good'?'rgba(78,158,255,0.88)':'rgba(220,80,80,0.88)'}} {{item.rateDeg}}deg, {{item.faction==='good'?'rgba(78,158,255,0.10)':'rgba(220,80,80,0.10)'}} 0deg)"></view>
              <view class="gauge-inner">
                <image class="gauge-img" wx:if="{{item.roleImage}}" src="{{item.roleImage}}" mode="aspectFill" />
                <text class="gauge-emoji" wx:else>🎭</text>
              </view>
            </view>
            <text class="rs-role-name {{item.faction}}">{{item.role}}</text>
            <text class="rs-role-games">{{item.total > 0 ? item.total+'局 / '+item.wins+'胜' : '未出场'}}</text>
            <text class="rs-role-rate {{item.total > 0 ? (item.winRate >= 50 ? 'rate-hi' : 'rate-lo') : 'rate-zero'}}">{{item.total > 0 ? item.winRate+'%' : '—'}}</text>
          </view>
        </view>
      </view>

      <!-- ── 勋章统计 ── -->
      <view class="panel" wx:if="{{goodMedals.length || evilMedals.length}}">
        <view class="panel-header">
          <text class="panel-title">勋章统计</text>
          <text class="panel-subtitle">共 {{medalTotal}} 枚</text>
        </view>
        <view class="medal-section">
          <text class="medal-section-title good">正义勋章</text>
          <view class="medal-grid">
            <view class="medal-card {{item.total > 0 ? '' : 'medal-zero'}}" wx:for="{{goodMedals}}" wx:key="code" catchtap="onTapMedal" data-name="{{item.name}}" data-description="{{item.description}}">
              <image class="medal-img" wx:if="{{item.image}}" src="{{item.image}}" mode="aspectFit" />
              <text class="medal-emoji" wx:else>🏅</text>
              <text class="medal-name">{{item.name}}</text>
              <text class="medal-count">{{item.total}}</text>
            </view>
          </view>
        </view>
        <view class="medal-section medal-section-sep">
          <text class="medal-section-title evil">邪恶勋章</text>
          <view class="medal-grid">
            <view class="medal-card {{item.total > 0 ? '' : 'medal-zero'}}" wx:for="{{evilMedals}}" wx:key="code" catchtap="onTapMedal" data-name="{{item.name}}" data-description="{{item.description}}">
              <image class="medal-img" wx:if="{{item.image}}" src="{{item.image}}" mode="aspectFit" />
              <text class="medal-emoji" wx:else>🏅</text>
              <text class="medal-name">{{item.name}}</text>
              <text class="medal-count">{{item.total}}</text>
            </view>
          </view>
        </view>
      </view>

    </block>
  </view>
</view>
```

- [ ] **Step 3: Add skin picker styles to `role-stats/index/index.wxss`**

Append to the end of `mobile/miniprogram/subpkg/role-stats/index/index.wxss`:

```css
/* ─── SKIN PICKER ─── */
.skin-picker-panel { padding: 0; }

.skin-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10rpx;
  padding: 14rpx 14rpx 16rpx;
}

.skin-card {
  border-radius: 12rpx;
  border: 2rpx solid rgba(255,255,255,0.1);
  padding: 10rpx 8rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  position: relative;
  background: rgba(255,255,255,0.03);
}

.skin-card-active {
  border-color: var(--aw-accent, #d9b36b);
  background: rgba(217,179,107,0.06);
}

.skin-preview {
  display: flex;
  gap: 5rpx;
  align-items: center;
  justify-content: center;
  height: 32rpx;
}

.skin-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  border: 1rpx solid rgba(255,255,255,0.15);
  flex-shrink: 0;
}

.skin-name {
  font-size: 18rpx;
  color: rgba(255,255,255,0.55);
  text-align: center;
  line-height: 1.3;
}

.skin-card-active .skin-name {
  color: var(--aw-accent, #d9b36b);
}

.skin-check {
  font-size: 16rpx;
  color: var(--aw-accent, #d9b36b);
  font-weight: 700;
}
```

- [ ] **Step 4: Update `role-stats/index/index.wxss` — replace hardcoded panel color**

Find:
```css
.panel {
  margin-top: 18rpx;
  border-radius: 20rpx;
  background: rgba(14,18,28,0.90);
  border: 1rpx solid rgba(216,176,107,0.12);
  overflow: hidden;
}
```

Replace with:
```css
.panel {
  margin-top: 18rpx;
  border-radius: 20rpx;
  background: var(--aw-panel);
  border: 1rpx solid var(--aw-panel-border);
  overflow: hidden;
}
```

- [ ] **Step 5: Preview in DevTools**

Open role-stats page. You should see:
- Title shows "我的主页"
- A 3×2 grid of skin cards at the top with color dots
- Tapping a skin card updates the page theme immediately
- The active card shows a gold border + checkmark

- [ ] **Step 6: Commit**

```bash
git add mobile/miniprogram/subpkg/role-stats/index/
git commit -m "feat(skin): add skin selector to 我的主页 with live preview"
```

---

## Task 8: Bind skinId to history and history-detail pages

**Files:**
- Modify: `mobile/miniprogram/subpkg/history/index/index.js`
- Modify: `mobile/miniprogram/subpkg/history/index/index.wxml`
- Modify: `mobile/miniprogram/subpkg/history-detail/index/index.js`
- Modify: `mobile/miniprogram/subpkg/history-detail/index/index.wxml`

- [ ] **Step 1: Update `history/index/index.js`**

Find the `data:` block and add `skinId: 'dark-gold'`.

Find the `onLoad()` or `onShow()` method where `getApp().globalData.nav` is accessed. Add after loading nav:

```js
const app = getApp();
this.setData({ skinId: (app.globalData && app.globalData.skinId) || 'dark-gold' });
```

- [ ] **Step 2: Update `history/index/index.wxml`**

Change the root view from:
```xml
<view class="page">
```
to:
```xml
<view class="page theme-{{skinId}}">
```

- [ ] **Step 3: Update `history-detail/index/index.js`**

Same pattern as history: add `skinId: 'dark-gold'` to data, load from `app.globalData.skinId` in onLoad or onShow.

- [ ] **Step 4: Update `history-detail/index/index.wxml`**

Change the root view from:
```xml
<view class="page">
```
to:
```xml
<view class="page theme-{{skinId}}">
```

- [ ] **Step 5: Verify end-to-end flow**

1. Open 我的主页 → tap "赛博霓虹" skin
2. Go back to index page — should be purple/neon themed
3. Navigate to history page — should also be purple/neon themed
4. Navigate to history-detail — same theme
5. Close and reopen miniprogram — theme persists (loaded from storage)

- [ ] **Step 6: Commit**

```bash
git add mobile/miniprogram/subpkg/history/ mobile/miniprogram/subpkg/history-detail/
git commit -m "feat(skin): bind skinId to history and history-detail pages"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ 6 skin definitions (dark-gold, celestial, ink-wash, cyber-neon, dark-dungeon, abyss) — Task 1
- ✅ 18 CSS variables defined in app.wxss — Task 2
- ✅ CSS variables loaded from storage on launch — Task 3
- ✅ roleImageFor accepts skinId — Task 4
- ✅ index.wxss chrome colors → var() — Task 5
- ✅ index page binds skinId class — Task 6
- ✅ 我的主页 skin selector at top, live switching, persistence — Task 7
- ✅ history + history-detail pages bound — Task 8
- ✅ Skin change broadcasts to index via skinChangeListener — Task 7 (onPickSkin)
- ✅ Default fallback when no imageBase uploaded (imageBase: null) — Task 1

**Not in scope (deferred):**
- Uploading actual skin image assets — done later by updating `imageBase` fields in `skins.js`
- bg images for skins — `--aw-bg-image: none` for all; update when assets ready
