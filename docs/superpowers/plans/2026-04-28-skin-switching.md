# 皮肤换肤系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 玩家可在「我的主页」皮肤选择器中切换已发布皮肤，所有背景图和角色图随之联动；服务端维护皮肤状态（创作中 / 已发布），未发布皮肤不出现在选择器中。

**Architecture:** 服务端新增 `GET /api/skins` 返回皮肤列表+状态，小程序启动时拉取并缓存已发布皮肤 ID；`skins.js` 补充每个皮肤的 CDN 路径（背景图、角色图 base）；各页面从 `globalData.skinId` 读取当前皮肤并计算背景图 URL；角色图通过已有的 `roleImageFor(role, skinId)` 函数动态切换。

**Tech Stack:** Node.js/Express（服务端）、WeChat Miniprogram JS（小程序）、CDN `https://www.awalon.top/mp-assets/`

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `server/index.js` | 修改 | 新增 `/api/skins` 端点，返回皮肤列表+状态 |
| `mobile/miniprogram/skins.js` | 修改 | 补充每个皮肤的 `homeBg`、`inGameBg`、`imageBase` |
| `mobile/miniprogram/app.js` | 修改 | 拉取 `/api/skins`，将已发布 ID 存入 `globalData.publishedSkinIds` |
| `mobile/miniprogram/subpkg/role-stats/index/index.js` | 修改 | 皮肤列表过滤为已发布 + 动态背景 |
| `mobile/miniprogram/subpkg/role-stats/index/index.wxml` | 修改 | 背景图改用 `{{skinInGameBg}}` |
| `mobile/miniprogram/pages/index/index.js` | 修改 | 计算 `skinHomeBg` / `skinInGameBg`，响应换肤 |
| `mobile/miniprogram/pages/index/index.wxml` | 修改 | 背景图改用 `{{skinHomeBg}}` / `{{skinInGameBg}}` |
| `mobile/miniprogram/subpkg/history/index/index.js` | 修改 | 计算 `skinInGameBg` |
| `mobile/miniprogram/subpkg/history/index/index.wxml` | 修改 | 背景图改用 `{{skinInGameBg}}` |
| `mobile/miniprogram/subpkg/history-detail/index/index.js` | 修改 | `roleImageFor()` 改调 `skins.js` 实现皮肤感知 |
| `mobile/miniprogram/subpkg/history-detail/index/index.wxml` | 修改 | 背景图改用 `{{skinInGameBg}}` |
| `mobile/miniprogram/components/review-page/index.js` | 修改 | 计算 `skinHomeBg` |
| `mobile/miniprogram/components/review-page/index.wxml` | 修改 | 背景图改用 `{{skinHomeBg}}` |

CDN 目录约定（手动上传，计划不负责上传）：
```
mp-assets/skins/{skinId}/home-bg.jpg
mp-assets/skins/{skinId}/in-game-bg.jpg
mp-assets/skins/{skinId}/table.png
mp-assets/skins/{skinId}/role-split/{rolefile}.png
```
dark-gold 继续使用根目录旧路径，不迁移。

---

## Task 1: 服务端 `/api/skins` 端点

**Files:**
- Modify: `server/index.js`（在现有 `/api/review-mode` 附近添加）

- [ ] **Step 1: 在 `server/index.js` 找到 `/api/review-mode` 端点（约第93行），在其后插入**

```js
// Skin catalogue — edit statuses here to publish/unpublish skins
const SKIN_CATALOGUE = [
  { id: 'dark-gold',    name: '暗夜金',   status: 'published' },
  { id: 'celestial',   name: '仙境',     status: 'draft' },
  { id: 'ink-wash',    name: '水墨古风', status: 'draft' },
  { id: 'cyber-neon',  name: '赛博霓虹', status: 'draft' },
  { id: 'dark-dungeon',name: '暗黑地牢', status: 'draft' },
  { id: 'abyss',       name: '深渊',     status: 'draft' },
];

app.get('/api/skins', (req, res) => {
  res.json({ skins: SKIN_CATALOGUE });
});
```

- [ ] **Step 2: 验证端点**

```bash
# 部署后验证（或本地启动 node server/index.js 后）
curl https://www.awalon.top/api/skins
```

Expected:
```json
{"skins":[{"id":"dark-gold","name":"暗夜金","status":"published"},{"id":"celestial","name":"仙境","status":"draft"},...]}
```

- [ ] **Step 3: 部署**

```bash
./deploy.sh
```

- [ ] **Step 4: Commit**

```bash
git add server/index.js
git commit -m "feat(server): add /api/skins endpoint with skin status catalogue"
```

---

## Task 2: `skins.js` 补充 CDN 路径

**Files:**
- Modify: `mobile/miniprogram/skins.js`

**背景**：当前 `skins.js` 中所有皮肤的 `imageBase: null` 和 `bgImage: null`。需要填入每个皮肤的背景图 URL 和角色图 base URL。

- [ ] **Step 1: 将 `skins.js` 文件全量替换为以下内容**

```js
// mobile/miniprogram/skins.js

const CDN = 'https://www.awalon.top/mp-assets';

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
    // dark-gold uses legacy CDN root paths (already deployed)
    homeBg:    `${CDN}/home-bg-optimized.jpg`,
    inGameBg:  `${CDN}/in-game-bg-optimized.jpg`,
    imageBase: null, // roleImageFor falls back to CDN/role-split
  },
  {
    id: 'celestial',
    name: '仙境',
    isDark: false,
    cssClass: 'theme-celestial',
    colors: { bg: '#ddeeff', panel: 'rgba(255,255,255,0.75)', accent: '#2e7fc8' },
    homeBg:    `${CDN}/skins/celestial/home-bg.jpg`,
    inGameBg:  `${CDN}/skins/celestial/in-game-bg.jpg`,
    imageBase: `${CDN}/skins/celestial/role-split`,
  },
  {
    id: 'ink-wash',
    name: '水墨古风',
    isDark: false,
    cssClass: 'theme-ink-wash',
    colors: { bg: '#f4f0ea', panel: 'rgba(244,240,234,0.88)', accent: '#2d2520' },
    homeBg:    `${CDN}/skins/ink-wash/home-bg.jpg`,
    inGameBg:  `${CDN}/skins/ink-wash/in-game-bg.jpg`,
    imageBase: `${CDN}/skins/ink-wash/role-split`,
  },
  {
    id: 'cyber-neon',
    name: '赛博霓虹',
    isDark: true,
    cssClass: 'theme-cyber-neon',
    colors: { bg: '#0d0b16', panel: 'rgba(20,16,40,0.88)', accent: '#e879f9' },
    homeBg:    `${CDN}/skins/cyber-neon/home-bg.jpg`,
    inGameBg:  `${CDN}/skins/cyber-neon/in-game-bg.jpg`,
    imageBase: `${CDN}/skins/cyber-neon/role-split`,
  },
  {
    id: 'dark-dungeon',
    name: '暗黑地牢',
    isDark: true,
    cssClass: 'theme-dark-dungeon',
    colors: { bg: '#0e0a07', panel: 'rgba(20,14,8,0.90)', accent: '#c8902a' },
    homeBg:    `${CDN}/skins/dark-dungeon/home-bg.jpg`,
    inGameBg:  `${CDN}/skins/dark-dungeon/in-game-bg.jpg`,
    imageBase: `${CDN}/skins/dark-dungeon/role-split`,
  },
  {
    id: 'abyss',
    name: '深渊',
    isDark: true,
    cssClass: 'theme-abyss',
    colors: { bg: '#050507', panel: 'rgba(8,8,16,0.92)', accent: '#4060c0' },
    homeBg:    `${CDN}/skins/abyss/home-bg.jpg`,
    inGameBg:  `${CDN}/skins/abyss/in-game-bg.jpg`,
    imageBase: `${CDN}/skins/abyss/role-split`,
  },
];

function getSkin(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}

function roleImageFor(role, skinId) {
  const file = ROLE_FILE_MAP[role];
  if (!file) return '';
  const skin = getSkin(skinId);
  const base = (skin && skin.imageBase) ? skin.imageBase : `${CDN}/role-split`;
  return `${base}/${file}.png`;
}

module.exports = { SKINS, getSkin, roleImageFor };
```

- [ ] **Step 2: Commit**

```bash
git add mobile/miniprogram/skins.js
git commit -m "feat(skins): add CDN paths for bg images and role-split per skin"
```

---

## Task 3: `app.js` 拉取皮肤状态

**Files:**
- Modify: `mobile/miniprogram/app.js`

**背景**：`app.js` 的 `onLaunch` 里已有 `/api/review-mode` 和 `/api/role-config` 的请求，照同一模式加皮肤请求。`globalData` 里加 `publishedSkinIds`，其他页面读这个来过滤皮肤列表。

- [ ] **Step 1: 在 `onLaunch` 里（`// 角色配置` 请求之后）加皮肤拉取**

在 `app.js` 第46行 `}` 之前插入：

```js
    // 已发布皮肤列表
    wx.request({
      url: this.globalData.apiBase + '/api/skins',
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.skins) {
          const published = res.data.skins
            .filter((s) => s.status === 'published')
            .map((s) => s.id);
          this.globalData.publishedSkinIds = published;
          if (typeof this.globalData.skinsLoadedListener === 'function') {
            this.globalData.skinsLoadedListener(published);
          }
        }
      }
    });
```

- [ ] **Step 2: 在 `globalData` 对象中加两个字段**（在 `skinChangeListener: null,` 这行附近）

```js
    publishedSkinIds: ['dark-gold'], // fallback until API responds
    skinsLoadedListener: null,
```

- [ ] **Step 3: Commit**

```bash
git add mobile/miniprogram/app.js
git commit -m "feat(app): fetch published skin ids from /api/skins on launch"
```

---

## Task 4: role-stats 皮肤选择器过滤 + 动态背景

**Files:**
- Modify: `mobile/miniprogram/subpkg/role-stats/index/index.js`
- Modify: `mobile/miniprogram/subpkg/role-stats/index/index.wxml`

**背景**：`onLoad` 里已从 `SKINS` 构建 `skins` 数组并 `setData`，只需加一步过滤。背景图 `<image>` src 目前硬编码为 `in-game-bg-optimized.jpg`。

- [ ] **Step 1: 修改 `index.js` 的 `onLoad`**

将现有的 `onLoad` 中构建 `skins` 数组的代码（约第56-69行）替换为：

```js
  onLoad() {
    const app = getApp();
    const nav = (app.globalData && app.globalData.nav) || {};
    const skinId = (app.globalData && app.globalData.skinId) || 'dark-gold';
    const publishedIds = (app.globalData && app.globalData.publishedSkinIds) || ['dark-gold'];
    const skins = SKINS
      .filter((s) => publishedIds.includes(s.id))
      .map((s) => ({ id: s.id, name: s.name, bg: s.colors.bg, panel: s.colors.panel, accent: s.colors.accent }));
    const skinInGameBg = getSkin(skinId).inGameBg;
    this.setData({
      statusBarHeight: nav.statusBarHeight || 20,
      navBarHeight: nav.navBarHeight || 44,
      navTotalHeight: nav.navTotalHeight || 64,
      skinId,
      skins,
      skinInGameBg,
    });
    // Re-filter when API response arrives after page load
    app.globalData.skinsLoadedListener = (published) => {
      const filtered = SKINS
        .filter((s) => published.includes(s.id))
        .map((s) => ({ id: s.id, name: s.name, bg: s.colors.bg, panel: s.colors.panel, accent: s.colors.accent }));
      this.setData({ skins: filtered });
    };
  },
```

- [ ] **Step 2: 在 `index.js` 头部 require 中加入 `getSkin`**

将第2行从：
```js
const { SKINS } = require("../../../skins");
```
改为：
```js
const { SKINS, getSkin } = require("../../../skins");
```

- [ ] **Step 3: `onShow` 中同步背景图**

在现有 `onShow` 的 `this.setData({ skinId });` 这行后追加：

```js
    const skinInGameBg = getSkin(skinId).inGameBg;
    this.setData({ skinId, skinInGameBg });
```

（删掉原来只有 `skinId` 的那行 `setData`）

- [ ] **Step 4: `onUnload` 清理 listener**

在现有 `onUnload` 里 `roleStatsListener` 清理的旁边加：

```js
    if (app.globalData.skinsLoadedListener) app.globalData.skinsLoadedListener = null;
```

- [ ] **Step 5: `index.wxml` 第2行背景图改为动态**

将：
```xml
<image class="bg" src="https://www.awalon.top/mp-assets/in-game-bg-optimized.jpg" mode="aspectFill" />
```
改为：
```xml
<image class="bg" src="{{skinInGameBg}}" mode="aspectFill" />
```

- [ ] **Step 6: Commit**

```bash
git add mobile/miniprogram/subpkg/role-stats/index/index.js
git add mobile/miniprogram/subpkg/role-stats/index/index.wxml
git commit -m "feat(role-stats): filter skin picker to published skins + dynamic bg"
```

---

## Task 5: index 页动态背景图

**Files:**
- Modify: `mobile/miniprogram/pages/index/index.js`
- Modify: `mobile/miniprogram/pages/index/index.wxml`

**背景**：index.wxml 第14行背景图目前是三元表达式硬编码两个 URL。index.js 已有 `skinChangeListener` 回调，只需在回调里同时更新背景图 URL。

- [ ] **Step 1: 在 `index.js` 头部加 import**

在现有 `require` 列表末尾（约第7行后）加：

```js
const { getSkin } = require("../../skins");
```

- [ ] **Step 2: 在 `index.js` 的 `data` 对象（约第64行）加两个字段**

```js
    skinHomeBg: 'https://www.awalon.top/mp-assets/home-bg-optimized.jpg',
    skinInGameBg: 'https://www.awalon.top/mp-assets/in-game-bg-optimized.jpg',
```

- [ ] **Step 3: 找到 `app.globalData.skinChangeListener` 回调（约第219行），在 `setData` 中加背景图更新**

将现有：
```js
    app.globalData.skinChangeListener = (newSkinId) => {
      this.setData({ skinId: newSkinId });
    };
```
改为：
```js
    app.globalData.skinChangeListener = (newSkinId) => {
      const skin = getSkin(newSkinId);
      this.setData({ skinId: newSkinId, skinHomeBg: skin.homeBg, skinInGameBg: skin.inGameBg });
    };
```

- [ ] **Step 4: 找到 `onLoad`/`onShow` 中 `this.setData({ skinId: ... })` 的地方（约第218行），一并更新背景图**

将：
```js
    this.setData({ skinId: app.globalData.skinId || 'dark-gold' });
```
改为：
```js
    const _skinId = app.globalData.skinId || 'dark-gold';
    const _skin = getSkin(_skinId);
    this.setData({ skinId: _skinId, skinHomeBg: _skin.homeBg, skinInGameBg: _skin.inGameBg });
```

- [ ] **Step 5: `index.wxml` 第14行背景图改为动态**

将：
```xml
<image class="bg" wx:if="{{!reviewMode}}" src="{{room && !atHome ? 'https://www.awalon.top/mp-assets/in-game-bg-optimized.jpg' : 'https://www.awalon.top/mp-assets/home-bg-optimized.jpg'}}" mode="aspectFill" />
```
改为：
```xml
<image class="bg" wx:if="{{!reviewMode}}" src="{{room && !atHome ? skinInGameBg : skinHomeBg}}" mode="aspectFill" />
```

- [ ] **Step 6: Commit**

```bash
git add mobile/miniprogram/pages/index/index.js
git add mobile/miniprogram/pages/index/index.wxml
git commit -m "feat(index): dynamic background image per skin"
```

---

## Task 6: history + history-detail 动态背景和角色图

**Files:**
- Modify: `mobile/miniprogram/subpkg/history/index/index.js`
- Modify: `mobile/miniprogram/subpkg/history/index/index.wxml`
- Modify: `mobile/miniprogram/subpkg/history-detail/index/index.js`
- Modify: `mobile/miniprogram/subpkg/history-detail/index/index.wxml`

**背景**：history-detail 有自己的 `ROLE_IMAGE_MAP` 和 `roleImageFor()` 方法，hardcode 了 CDN 路径。需要改为调用 `skins.js` 的 `roleImageFor(role, skinId)`，这样换肤后重新打开历史详情就能看到对应皮肤的角色图。

**history/index.js + wxml（只改背景图）：**

- [ ] **Step 1: `history/index.js` 头部加 import**

```js
const { getSkin } = require("../../../skins");
```

- [ ] **Step 2: `history/index.js` 的 `data` 加字段**

```js
    skinInGameBg: 'https://www.awalon.top/mp-assets/in-game-bg-optimized.jpg',
```

- [ ] **Step 3: `history/index.js` 的 `onShow` 里同步**

找到（约第66行）：
```js
      skinId: (app.globalData && app.globalData.skinId) || 'dark-gold'
```
改为：
```js
      skinId: (app.globalData && app.globalData.skinId) || 'dark-gold',
      skinInGameBg: getSkin((app.globalData && app.globalData.skinId) || 'dark-gold').inGameBg,
```

- [ ] **Step 4: `history/index.wxml` 第2行改为动态**

将：
```xml
<image class="bg" src="https://www.awalon.top/mp-assets/in-game-bg-optimized.jpg" mode="aspectFill" />
```
改为：
```xml
<image class="bg" src="{{skinInGameBg}}" mode="aspectFill" />
```

**history-detail/index.js + wxml（背景图 + 角色图）：**

- [ ] **Step 5: `history-detail/index.js` 头部加 import**

在文件顶部现有 require 后加：
```js
const { getSkin, roleImageFor: skinRoleImageFor } = require("../../../skins");
```

- [ ] **Step 6: `history-detail/index.js` 的 `data` 加字段**

```js
    skinInGameBg: 'https://www.awalon.top/mp-assets/in-game-bg-optimized.jpg',
```

- [ ] **Step 7: `history-detail/index.js` 在设置 `skinId` 的地方（约第70行）同步背景图**

找到：
```js
      skinId: (app.globalData && app.globalData.skinId) || 'dark-gold',
```
改为：
```js
      skinId: (app.globalData && app.globalData.skinId) || 'dark-gold',
      skinInGameBg: getSkin((app.globalData && app.globalData.skinId) || 'dark-gold').inGameBg,
```

- [ ] **Step 8: `history-detail/index.js` 的 `roleImageFor` 方法（约第196行）改为皮肤感知**

将：
```js
  roleImageFor(role) {
    return ROLE_IMAGE_MAP[role] || "";
  },
```
改为：
```js
  roleImageFor(role) {
    return skinRoleImageFor(role, this.data.skinId) || "";
  },
```

- [ ] **Step 9: `history-detail/index.wxml` 第2行改为动态**

将：
```xml
<image class="bg" src="https://www.awalon.top/mp-assets/in-game-bg-optimized.jpg" mode="aspectFill" />
```
改为：
```xml
<image class="bg" src="{{skinInGameBg}}" mode="aspectFill" />
```

- [ ] **Step 10: Commit**

```bash
git add mobile/miniprogram/subpkg/history/index/index.js
git add mobile/miniprogram/subpkg/history/index/index.wxml
git add mobile/miniprogram/subpkg/history-detail/index/index.js
git add mobile/miniprogram/subpkg/history-detail/index/index.wxml
git commit -m "feat(history): dynamic bg + skin-aware role images in history-detail"
```

---

## Task 7: review-page 组件动态背景

**Files:**
- Modify: `mobile/miniprogram/components/review-page/index.js`
- Modify: `mobile/miniprogram/components/review-page/index.wxml`

**背景**：review-page 是终局互评组件，在 index 页内使用，背景用的是 `home-bg`。组件直接从 `getApp()` 读皮肤 ID。

- [ ] **Step 1: `review-page/index.js` 头部加 import**

```js
const { getSkin } = require("../../skins");
```

- [ ] **Step 2: `review-page/index.js` 的 `data` 加字段**

```js
    skinHomeBg: 'https://www.awalon.top/mp-assets/home-bg-optimized.jpg',
```

- [ ] **Step 3: 在 `review-page/index.js` 中找到组件 attached 或数据初始化的地方，加背景图同步**

在组件的 `attached()` 或第一个设置数据的生命周期函数中加：

```js
    const app = getApp();
    const skinId = (app.globalData && app.globalData.skinId) || 'dark-gold';
    this.setData({ skinHomeBg: getSkin(skinId).homeBg });
```

- [ ] **Step 4: `review-page/index.wxml` 第2行改为动态**

将：
```xml
<image class="rv-bg" src="https://www.awalon.top/mp-assets/home-bg-optimized.jpg" mode="aspectFill" />
```
改为：
```xml
<image class="rv-bg" src="{{skinHomeBg}}" mode="aspectFill" />
```

- [ ] **Step 5: Commit**

```bash
git add mobile/miniprogram/components/review-page/index.js
git add mobile/miniprogram/components/review-page/index.wxml
git commit -m "feat(review-page): dynamic home-bg per skin"
```

---

## Task 8: 全量验证 + 部署

- [ ] **Step 1: 微信开发者工具中切换皮肤**
  - 打开「我的主页」→ 外观皮肤，选择暗夜金（默认）
  - 确认选择器只显示 `published` 状态的皮肤（此时只有暗夜金）
  - 在 `server/index.js` 临时把 `celestial` 改为 `published`，重新部署，确认仙境出现在选择器中
  - 选择仙境 → 确认背景图（主页、游戏中、历史、终局互评）全部切换
  - 还原 `celestial` 为 `draft`

- [ ] **Step 2: 确认 dark-gold 不受影响**
  - 选回暗夜金，背景图仍为 `/mp-assets/home-bg-optimized.jpg`（不带 `/skins/` 前缀）

- [ ] **Step 3: 部署服务端**

```bash
./deploy.sh
```

- [ ] **Step 4: 构建并上传小程序**
  - 微信开发者工具 → 上传 → 填写版本号和说明

---

## 自查

**Spec coverage:**
- ✅ 皮肤状态 (published/draft) → Task 1
- ✅ 小程序只显示 published 皮肤 → Task 4
- ✅ 切换皮肤背景图联动 → Task 4, 5, 6, 7
- ✅ 切换皮肤角色图联动（历史详情）→ Task 6
- ✅ CDN 路径结构 → Task 2
- ✅ 免费换肤（无解锁/付费逻辑）→ 全计划均无付费门控

**注意：** 新皮肤图片资产（背景图、角色图）需手动上传到 CDN 对应目录后，再将服务端该皮肤 status 改为 `published`，否则切换后图片 404（但不会崩溃，只是图片显示空白）。
