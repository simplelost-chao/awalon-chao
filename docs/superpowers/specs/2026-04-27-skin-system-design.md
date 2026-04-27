# 换肤系统设计文档

**日期：** 2026-04-27  
**状态：** 待实施

---

## 目标

为 Awalon 小程序添加全套视觉换肤能力。每套皮肤替换背景、面板、按钮、文字、边框的完整颜色体系，以及对应的角色图资产。皮肤入口位于「我的主页」（原角色统计页）顶部。

---

## 皮肤列表（6套，全部免费）

| ID | 名称 | 底色类型 | 风格描述 |
|---|---|---|---|
| `dark-gold` | 暗夜金 | 深色 | 当前默认，深空黑 + 琥珀金 |
| `celestial` | 仙境 | 浅色 | 水彩山水，浅蓝天空，插画角色 |
| `ink-wash` | 水墨古风 | 浅色/中性 | 黑白水墨，近乎单色，中国传统风 |
| `cyber-neon` | 赛博霓虹 | 深色 | 暗紫底 + 粉紫荧光，赛博朋克 |
| `dark-dungeon` | 暗黑地牢 | 深色 | 焦棕哥特，中世纪油画风角色 |
| `abyss` | 深渊 | 深色 | 比地牢更暗更重，近乎黑色 |

---

## 架构

### 1. 皮肤定义 `mobile/miniprogram/skins.js`

```js
const SKINS = [
  {
    id: 'dark-gold',
    name: '暗夜金',
    isDark: true,
    cssClass: 'theme-dark-gold',
    imageBase: null,           // null = 使用默认角色图路径
    bgImage: null,
  },
  {
    id: 'celestial',
    name: '仙境',
    isDark: false,
    cssClass: 'theme-celestial',
    imageBase: 'https://www.awalon.top/mp-assets/skins/celestial',
    bgImage: 'https://www.awalon.top/mp-assets/skins/celestial/bg.jpg',
  },
  // ... 其余 4 套同格式
];

function getSkin(id) {
  return SKINS.find(s => s.id === id) || SKINS[0];
}

module.exports = { SKINS, getSkin };
```

### 2. CSS 变量体系 `mobile/miniprogram/app.wxss`

定义完整变量集（默认为 dark-gold），每个 `theme-{id}` class 覆盖相应变量：

```css
/* 默认变量（dark-gold） */
page {
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
}

/* 仙境（浅色） */
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
  --aw-bg-image:         url('https://www.awalon.top/mp-assets/skins/celestial/bg.jpg');
}

/* 其余 4 套同格式... */
```

**阵营色不随皮肤变化**（`--id-evil-*` / `--id-good-*` / `--id-merlin-*` 保持原值）。

### 3. 变量化重构 `index.wxss`

将 `index.wxss` 中所有硬编码颜色替换为对应的 `var(--aw-*)` 引用。约 500+ 处，分批按模块替换（导航→面板→按钮→输入框→chip→其他）。

**替换规则示例：**
```css
/* 之前 */
background: rgba(12, 16, 24, 0.88);
color: #eef1f7;
border-color: rgba(255,255,255,0.1);

/* 之后 */
background: var(--aw-nav-bg);
color: var(--aw-text);
border-color: var(--aw-panel-border);
```

### 4. 皮肤应用 — `app.js`

```js
onLaunch() {
  const savedSkin = wx.getStorageSync('selectedSkin') || 'dark-gold';
  this.globalData.skinId = savedSkin;
  // ...其他初始化
}
```

### 5. 页面应用皮肤 class

所有页面（index、role-stats、history、history-detail）的根 `.page` 元素绑定皮肤 class：

```js
// 页面 onLoad / onShow
const app = getApp();
this.setData({ skinId: app.globalData.skinId });
```

```html
<!-- wxml -->
<view class="page theme-{{skinId}}">
```

背景图通过 CSS 变量 `--aw-bg-image` 渗透到所有子元素，在 `.page` 上设置：
```css
.page {
  background-image: var(--aw-bg-image);
  background-size: cover;
  background-position: center;
}
```

### 6. 角色图路径 `roleImageFor(role, skinId)`

```js
const IMAGE_BASE = 'https://www.awalon.top/mp-assets';
const ROLE_FILE_MAP = {
  '梅林': 'merlin', '派西维尔': 'percival', '忠臣': 'arthur_loyal',
  '刺客': 'assassin', '莫甘娜': 'morgana', '莫德雷德': 'mordred',
  '奥伯伦': 'oberon', '爪牙': 'minion',
};

function roleImageFor(role, skinId) {
  const file = ROLE_FILE_MAP[role];
  if (!file) return '';
  const skin = getSkin(skinId);
  const base = skin && skin.imageBase ? skin.imageBase : `${IMAGE_BASE}/role-split`;
  return `${base}/${file}.png`;
}
```

皮肤图片资产未就绪时，将 `imageBase` 设为 `null`，自动回退到默认路径，可分批上传。

---

## UI：「我的主页」页面

### 结构变化

- 页面标题由「角色统计」改为「我的主页」
- 顶部新增「外观皮肤」模块，位于所有统计数据之上
- 其余统计内容不变

### 皮肤选择器布局

```
┌─────────────────────────────┐
│ 🎨 外观皮肤                  │
│  ┌──────┐ ┌──────┐ ┌──────┐│
│  │ ●●● │ │ ●●● │ │ ●●● ││
│  │暗夜金✓│ │ 仙境  │ │水墨  ││
│  └──────┘ └──────┘ └──────┘│
│  ┌──────┐ ┌──────┐ ┌──────┐│
│  │ ●●● │ │ ●●● │ │ ●●● ││
│  │赛博霓虹│ │暗黑地牢│ │深渊  ││
│  └──────┘ └──────┘ └──────┘│
└─────────────────────────────┘
```

每张皮肤卡片显示：三色点（bg / panel / accent） + 皮肤名称 + 当前选中时金边高亮。点击即时生效，写入 `wx.storage`，广播到所有已打开页面。

### 换肤即时生效机制

切换皮肤时：
1. `wx.setStorageSync('selectedSkin', skinId)`
2. `app.globalData.skinId = skinId`
3. `this.setData({ skinId })` 更新当前页面
4. 通过 `app.globalData.skinChangeListener` 回调通知 index 页面同步更新

---

## 涉及文件

| 文件 | 改动类型 |
|---|---|
| `mobile/miniprogram/skins.js` | 新建 |
| `mobile/miniprogram/app.js` | 新增皮肤初始化 |
| `mobile/miniprogram/app.wxss` | 全量 CSS 变量 + 6套 theme class |
| `mobile/miniprogram/pages/index/index.wxss` | 500+ 处硬编码颜色 → var() |
| `mobile/miniprogram/pages/index/index.wxml` | 根元素绑定 skinId class |
| `mobile/miniprogram/pages/index/index.js` | 读取/监听 skinId |
| `mobile/miniprogram/subpkg/role-stats/index/*` | 页面改名 + 皮肤选择器 UI |
| `mobile/miniprogram/subpkg/history/index/*` | 根元素绑定 skinId |
| `mobile/miniprogram/subpkg/history-detail/index/*` | 根元素绑定 skinId |
| 其他 subpkg 页面 | 根元素绑定 skinId |

---

## 实施顺序

1. 新建 `skins.js`，定义 6套皮肤（imageBase 暂时都设 null）
2. 重构 `app.wxss`：建立完整变量集 + 6套 theme class
3. 重构 `index.wxss`：硬编码颜色全部替换为 var()（最大工程量）
4. `app.js` + `index.js`：skinId 初始化与绑定
5. `role-stats` 页面：改名 + 皮肤选择器 UI
6. 其余页面：绑定 skinId class
7. 上传皮肤图片资产后，逐步更新各皮肤的 imageBase
