# 对局复盘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 历史详情页加"复盘"按钮，进入上帝视角复盘——身份全揭示，逐轮左右翻页回看组队/投票/任务决策。

**Architecture:** 新建 replay 页面，接收 gameId 参数，复用现有 `GET_GAME_HISTORY_DETAIL` API 获取 payload 数据。页面顶部固定身份一览条，中部用 swiper 组件逐轮翻页展示投票/任务数据，最后一页展示刺杀和结局。

**Tech Stack:** WeChat miniprogram (swiper, scroll-view), 无需新 API

---

## 文件结构

### 新增
- `mobile/miniprogram/subpkg/replay/index/index.js` — 页面逻辑：接收 gameId，加载 payload，构建轮次数据
- `mobile/miniprogram/subpkg/replay/index/index.wxml` — 模板：身份条 + swiper 卡片
- `mobile/miniprogram/subpkg/replay/index/index.wxss` — 样式
- `mobile/miniprogram/subpkg/replay/index/index.json` — 页面声明

### 修改
- `mobile/miniprogram/app.json` — 注册 replay 页面
- `mobile/miniprogram/subpkg/history-detail/index/index.wxml` — 加"复盘"按钮
- `mobile/miniprogram/subpkg/history-detail/index/index.js` — 复盘跳转方法

---

## Task 1: app.json 注册 + 详情页加入口

**Files:**
- Modify: `mobile/miniprogram/app.json`
- Modify: `mobile/miniprogram/subpkg/history-detail/index/index.wxml`
- Modify: `mobile/miniprogram/subpkg/history-detail/index/index.js`

- [ ] **Step 1: app.json 加 replay 页面**

在 pages 数组中 `"subpkg/friends/index/index"` 后面添加：
```
"subpkg/replay/index/index"
```

- [ ] **Step 2: 详情页加复盘按钮**

在 history-detail 的 WXML 中合适位置（游戏头部区域下方）加：
```xml
<view class="replay-entry" bindtap="onOpenReplay">
  <text class="replay-entry-text">📋 复盘</text>
</view>
```

- [ ] **Step 3: 详情页 JS 加跳转**

```javascript
onOpenReplay() {
  const gameId = this.data.gameId;
  if (!gameId) return;
  wx.navigateTo({ url: `/subpkg/replay/index/index?gameId=${gameId}` });
},
```

- [ ] **Step 4: 提交**

---

## Task 2: 复盘页面 — 数据加载 + 构建

**Files:**
- Create: `mobile/miniprogram/subpkg/replay/index/index.json`
- Create: `mobile/miniprogram/subpkg/replay/index/index.js`

- [ ] **Step 1: index.json**

```json
{
  "usingComponents": {
    "nav-header": "/subpkg/components/nav-header/index"
  }
}
```

- [ ] **Step 2: index.js**

页面逻辑：
- onLoad 接收 gameId，通过 socket 发 GET_GAME_HISTORY_DETAIL
- 收到数据后构建：
  - `identityBar`：所有玩家身份（座位号+头像+昵称+角色+阵营颜色）
  - `rounds`：每轮数据卡片（队长、队伍、投票明细带阵营色、任务结果）
  - `endCard`：刺杀结果+最终胜负
- 按座位号查阵营、标注好人/坏人

核心数据结构：
```javascript
// identityBar item
{ seat, nickname, role, roleImage, faction, avatarImage, avatarText, factionClass }

// round item
{ key, round, attempt, leaderSeat, leaderName, leaderFaction,
  team: [{ seat, nickname, faction, factionClass }],
  votes: [{ seat, nickname, faction, factionClass, approved }],
  approved, approveCount, rejectCount,
  mission: { success, fails, successCount, votes: [{ seat, nickname, faction, votedFail }] } | null
}

// endCard
{ winner, endReason, assassination: { assassinName, targetName, targetRole, hit } | null }
```

ROLE_FACTIONS 常量：
```javascript
const EVIL_ROLES = new Set(['刺客','莫甘娜','莫德雷德','奥伯伦','爪牙','兰斯洛特（邪恶）']);
```

- [ ] **Step 3: 提交**

---

## Task 3: 复盘页面 — WXML 模板

**Files:**
- Create: `mobile/miniprogram/subpkg/replay/index/index.wxml`

- [ ] **Step 1: 创建模板**

结构：
```
page > bg + mask + nav-header
content:
  1. 身份一览条（scroll-view scroll-x 固定顶部）
     - 每人一个小卡片：头像+座位号+角色名，边框颜色按阵营
  2. swiper 轮次卡片
     - 每张卡片是一个 pf 面板
     - 顶部：第N轮 · 第M次 · 队长XXX
     - 队伍区：被选队员头像+座位号（阵营色边框）
     - 投票区：每人一行（座位+昵称+赞成/反对+阵营色底）+ 统计
     - 任务区（如果通过）：成功/失败票 + 每人出牌
  3. 最后一页：结局卡片
     - 刺杀：刺客→目标，命中/未命中
     - 胜负：好人胜利/邪恶胜利
     - 所有人身份（大图版）
```

swiper 用 `indicator-dots` 显示页码指示器。

- [ ] **Step 2: 提交**

---

## Task 4: 复盘页面 — 样式

**Files:**
- Create: `mobile/miniprogram/subpkg/replay/index/index.wxss`

- [ ] **Step 1: 创建样式**

主要样式：
- 页面基础（bg/mask/content）复用历史页模式
- 身份条：固定顶部横向滚动，每人一个小卡片（60rpx头像+角色名），好人蓝边框、坏人红边框、梅林紫边框
- swiper 区域：占满剩余高度
- 轮次卡片：pf 面板内部，顶部轮次标题金色，队伍横排，投票列表纵排
- 投票行：座位号+头像+昵称左侧，赞成/反对右侧，好人行浅蓝底、坏人行浅红底
- 任务区：成功绿色、失败红色
- 结局卡片：大号胜负文字，刺杀结果

- [ ] **Step 2: 提交**

---

## Task 5: 部署 + 验证

- [ ] **Step 1: 验证清单**
1. 历史详情页显示"复盘"按钮
2. 点击进入复盘页面
3. 顶部身份条显示所有人身份（头像+角色+阵营色）
4. 左右滑动切换轮次
5. 每轮显示队长、队伍（阵营色标注）、投票明细、任务结果
6. 最后一页显示刺杀+胜负
7. 能看出谁是坏人投了赞成在"演"

- [ ] **Step 2: 提交推送**
```bash
git add -A
git commit -m "feat: game replay with god-view identity reveal"
git push origin main
```
