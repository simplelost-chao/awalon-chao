# 游戏内快捷表情 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 游戏中底部固定 6 个阿瓦隆快捷表情按钮，点击后在圆桌头像上方飘气泡，3 秒消失。

**Architecture:** 客户端新建 emoji-bar 组件（6 按钮），发 SEND_EMOJI WebSocket 消息。服务端广播 EMOJI 给房间所有人。round-table 组件接收 emojiBubbles 数据显示气泡动画。

**Tech Stack:** WeChat miniprogram (WXML/WXSS/JS), Node.js WebSocket server

---

## 文件结构

### 新建
- `mobile/miniprogram/components/emoji-bar/index.js` — 组件逻辑
- `mobile/miniprogram/components/emoji-bar/index.wxml` — 模板
- `mobile/miniprogram/components/emoji-bar/index.wxss` — 样式
- `mobile/miniprogram/components/emoji-bar/index.json` — 组件声明

### 修改
- `server/index.js` — 加 SEND_EMOJI case（~10 行）
- `mobile/miniprogram/pages/index/index.js` — 接收 EMOJI 消息，管理气泡状态
- `mobile/miniprogram/pages/index/index.wxml` — 引入 emoji-bar，传 emojiBubbles 给 round-table
- `mobile/miniprogram/pages/index/index.json` — 注册 emoji-bar
- `mobile/miniprogram/components/round-table/index.wxml` — 气泡显示
- `mobile/miniprogram/components/round-table/index.js` — 接收 emojiBubbles property
- `mobile/miniprogram/components/round-table/index.wxss` — 气泡动画
- `mobile/miniprogram/styles/round-table.wxss` — 气泡样式（如果 round-table 样式在这里）

---

## Task 1: 服务端 — SEND_EMOJI 消息处理

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: 在 switch-case 中加 SEND_EMOJI 处理**

在 `server/index.js` 的 WebSocket 消息 switch 里，`case 'AUTOPLAY_ON'` 之前，添加：

```javascript
case 'SEND_EMOJI': {
  const emojiRoom = rooms.get(client.roomCode);
  if (!emojiRoom || !emojiRoom.started) break;
  const emojiPlayer = emojiRoom.players.get(client.id);
  if (!emojiPlayer || emojiPlayer.spectator) break;
  const emojiId = payload && payload.emojiId;
  if (!emojiId) break;
  const emojiNow = Date.now();
  if (emojiPlayer._lastEmoji && emojiNow - emojiPlayer._lastEmoji < 3000) break;
  emojiPlayer._lastEmoji = emojiNow;
  const emojiSeat = Array.isArray(emojiRoom.seats) ? emojiRoom.seats.indexOf(client.id) : -1;
  for (const ep of emojiRoom.players.values()) {
    send(ep, { type: 'EMOJI', data: { playerId: client.id, emojiId, seat: emojiSeat } });
  }
  break;
}
```

- [ ] **Step 2: 部署并验证**

```bash
scp server/index.js awalon:/opt/avalon-online/server/
ssh awalon "pm2 restart avalon-server"
```

- [ ] **Step 3: 提交**

```bash
git add server/index.js
git commit -m "feat(emoji): add SEND_EMOJI server handler with 3s rate limit"
```

---

## Task 2: 客户端 — emoji-bar 组件

**Files:**
- Create: `mobile/miniprogram/components/emoji-bar/index.json`
- Create: `mobile/miniprogram/components/emoji-bar/index.js`
- Create: `mobile/miniprogram/components/emoji-bar/index.wxml`
- Create: `mobile/miniprogram/components/emoji-bar/index.wxss`

- [ ] **Step 1: 创建组件 JSON**

```json
{"component": true, "styleIsolation": "shared"}
```

- [ ] **Step 2: 创建组件 JS**

```javascript
const EMOJIS = [
  { id: 'good',  label: '我是好人', image: 'https://www.awalon.top/mp-assets/emoji/good.png' },
  { id: 'ride',  label: '我要上车', image: 'https://www.awalon.top/mp-assets/emoji/ride.png' },
  { id: 'vote',  label: '冲一票',   image: 'https://www.awalon.top/mp-assets/emoji/vote.png' },
  { id: 'wolf',  label: '这车有狼', image: 'https://www.awalon.top/mp-assets/emoji/wolf.png' },
  { id: 'perci', label: '听派指车', image: 'https://www.awalon.top/mp-assets/emoji/perci.png' },
  { id: 'angry', label: '我不满意', image: 'https://www.awalon.top/mp-assets/emoji/angry.png' },
];

Component({
  data: { emojis: EMOJIS, cooldown: false },
  methods: {
    onTapEmoji(e) {
      if (this.data.cooldown) return;
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      this.triggerEvent('send', { emojiId: id });
      this.setData({ cooldown: true });
      setTimeout(() => this.setData({ cooldown: false }), 3000);
    },
  },
});
```

- [ ] **Step 3: 创建组件 WXML**

```xml
<view class="emoji-bar">
  <view class="emoji-btn {{cooldown ? 'emoji-btn-cool' : ''}}"
    wx:for="{{emojis}}" wx:key="id"
    data-id="{{item.id}}" bindtap="onTapEmoji">
    <image class="emoji-btn-img" src="{{item.image}}" mode="aspectFit" />
    <text class="emoji-btn-label">{{item.label}}</text>
  </view>
</view>
```

- [ ] **Step 4: 创建组件 WXSS**

```css
.emoji-bar {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 8rpx 12rpx;
  background: rgba(10, 8, 16, 0.6);
  border-top: 1rpx solid rgba(216,176,107,0.12);
}
.emoji-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
  padding: 6rpx 8rpx;
  border-radius: 8rpx;
  transition: opacity 0.2s;
}
.emoji-btn:active { opacity: 0.5; }
.emoji-btn-cool { opacity: 0.3; pointer-events: none; }
.emoji-btn-img { width: 48rpx; height: 48rpx; }
.emoji-btn-label { font-size: 16rpx; color: rgba(255,255,255,0.45); white-space: nowrap; }
```

- [ ] **Step 5: 提交**

```bash
git add mobile/miniprogram/components/emoji-bar/
git commit -m "feat(emoji): create emoji-bar component with 6 quick emojis"
```

---

## Task 3: 圆桌气泡 — round-table 组件修改

**Files:**
- Modify: `mobile/miniprogram/components/round-table/index.js`
- Modify: `mobile/miniprogram/components/round-table/index.wxml`
- Modify: `mobile/miniprogram/styles/round-table.wxss`

- [ ] **Step 1: round-table JS 加 emojiBubbles property**

在 `properties` 中添加：

```javascript
emojiBubbles: { type: Object, value: {} },
```

`emojiBubbles` 格式：`{ [seatIndex]: { emojiId, image, timestamp } }` 或空对象。

- [ ] **Step 2: round-table WXML 加气泡显示**

在每个 seat-card 的 `seat-avatar` 区域上方，加气泡：

```xml
<!-- 表情气泡 -->
<view class="emoji-bubble {{emojiBubbles[item.index] ? 'emoji-bubble-show' : ''}}"
  wx:if="{{emojiBubbles[item.index]}}">
  <image class="emoji-bubble-img" src="{{emojiBubbles[item.index].image}}" mode="aspectFit" />
</view>
```

在 seat-card 内部、seat-status-badge 之前插入。

- [ ] **Step 3: 气泡样式**

在 `mobile/miniprogram/styles/round-table.wxss` 中添加：

```css
/* ─── 表情气泡 ─── */
.emoji-bubble {
  position: absolute;
  top: -50rpx;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  opacity: 0;
  pointer-events: none;
}
.emoji-bubble-show {
  animation: emoji-float 3s ease-out forwards;
}
.emoji-bubble-img {
  width: 60rpx;
  height: 60rpx;
}
@keyframes emoji-float {
  0% { opacity: 0; transform: translateX(-50%) translateY(10rpx) scale(0.5); }
  10% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  80% { opacity: 1; transform: translateX(-50%) translateY(-20rpx) scale(1); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-40rpx) scale(0.8); }
}
```

- [ ] **Step 4: 提交**

```bash
git add mobile/miniprogram/components/round-table/ mobile/miniprogram/styles/round-table.wxss
git commit -m "feat(emoji): add emoji bubble display to round-table seats"
```

---

## Task 4: 主页面 — 接收消息 + 组装

**Files:**
- Modify: `mobile/miniprogram/pages/index/index.json`
- Modify: `mobile/miniprogram/pages/index/index.wxml`
- Modify: `mobile/miniprogram/pages/index/index.js`

- [ ] **Step 1: index.json 注册组件**

在 `usingComponents` 中添加：

```json
"emoji-bar": "/components/emoji-bar/index"
```

- [ ] **Step 2: index.wxml 加 emoji-bar 和传 emojiBubbles**

在 speak-panel 之后（约 line 613 之后），添加：

```xml
<emoji-bar
  wx:if="{{room && room.started && phase !== 'end' && !isSpectator && !atHome}}"
  bind:send="onSendEmoji"
/>
```

在 round-table 组件上添加 emojiBubbles 属性：

```xml
emojiBubbles="{{emojiBubbles}}"
```

- [ ] **Step 3: index.js 添加 data 和方法**

在 data 中添加：

```javascript
emojiBubbles: {},
```

EMOJI 图片映射（在文件顶部或方法内）：

```javascript
const EMOJI_IMAGES = {
  good:  'https://www.awalon.top/mp-assets/emoji/good.png',
  ride:  'https://www.awalon.top/mp-assets/emoji/ride.png',
  vote:  'https://www.awalon.top/mp-assets/emoji/vote.png',
  wolf:  'https://www.awalon.top/mp-assets/emoji/wolf.png',
  perci: 'https://www.awalon.top/mp-assets/emoji/perci.png',
  angry: 'https://www.awalon.top/mp-assets/emoji/angry.png',
};
```

在 onMessage 的 switch/if 中处理 EMOJI 消息：

```javascript
if (msg.type === 'EMOJI' && msg.data) {
  const { seat, emojiId } = msg.data;
  if (seat < 0 || !emojiId) return;
  const image = EMOJI_IMAGES[emojiId] || '';
  if (!image) return;
  const bubbles = { ...this.data.emojiBubbles };
  bubbles[seat] = { emojiId, image, ts: Date.now() };
  this.setData({ emojiBubbles: bubbles });
  // 3秒后清除
  setTimeout(() => {
    const cur = this.data.emojiBubbles[seat];
    if (cur && cur.ts === bubbles[seat].ts) {
      const next = { ...this.data.emojiBubbles };
      delete next[seat];
      this.setData({ emojiBubbles: next });
    }
  }, 3000);
  return;
}
```

发送方法：

```javascript
onSendEmoji(e) {
  const emojiId = e.detail && e.detail.emojiId;
  if (!emojiId) return;
  this.send('SEND_EMOJI', { emojiId });
},
```

- [ ] **Step 4: 提交**

```bash
git add mobile/miniprogram/pages/index/
git commit -m "feat(emoji): wire emoji-bar, receive EMOJI messages, show bubbles"
```

---

## Task 5: 部署 + 上传表情素材

- [ ] **Step 1: 上传表情 PNG 到服务器**

```bash
ssh awalon "mkdir -p /opt/avalon-online/public/mp-assets/emoji"
scp /path/to/emoji/*.png awalon:/opt/avalon-online/public/mp-assets/emoji/
```

文件名：`good.png`, `ride.png`, `vote.png`, `wolf.png`, `perci.png`, `angry.png`

如果素材还没生成，先用占位 emoji 文字图片，后续替换。

- [ ] **Step 2: 部署服务端**

```bash
scp server/index.js awalon:/opt/avalon-online/server/
ssh awalon "pm2 restart avalon-server"
```

- [ ] **Step 3: 验证**

验证清单：
1. 游戏中底部显示 6 个表情按钮
2. 点击表情后自己和其他玩家头像上方显示气泡
3. 气泡 3 秒后消失
4. 3 秒内再次点击无效（cooldown）
5. 观战者看不到表情栏
6. 游戏未开始/结束时表情栏不显示

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat(emoji): complete quick emoji chat system"
git push origin main
```
