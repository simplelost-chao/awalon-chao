# 游戏内快捷表情

## 概述

在游戏中底部固定一排 6 个阿瓦隆专属表情按钮，点击后在发送者的圆桌头像上方飘出气泡，3 秒后消失。所有人可见，不持久化。

## 表情列表

| ID | 文案 | 含义 |
|----|------|------|
| good | 我是好人 | 表忠心 |
| ride | 我要上车 | 请求上车 |
| vote | 冲一票 | 号召投赞成 |
| wolf | 这车有狼 | 警告队伍有坏人 |
| perci | 听派指车 | 跟派西维尔走 |
| angry | 我不满意 | 表达不满 |

每个表情有一张 128x128 的素材图（像素风/chibi 风格，深色背景兼容），显示时缩放到 40x40px。

## 数据流

1. 客户端点击表情 → 发送 `{ type: "SEND_EMOJI", payload: { emojiId: "wolf" } }`
2. 服务端接收 → 广播给房间所有人 `{ type: "EMOJI", data: { playerId, emojiId, seat } }`
3. 所有客户端收到 → 在对应座位头像上方显示气泡动画，3 秒后自动消失
4. 不写入 room.messages，不持久化

## 防刷限制

- 每人每 3 秒最多发 1 个表情（服务端限频）
- 观战者不能发表情

## 客户端 UI

### 表情栏
- 位置：圆桌下方、发言区上方
- 布局：横向一排 6 个按钮，等间距
- 按钮样式：表情图标 40rpx + 下方文字标签 18rpx
- 只在游戏进行中（started && phase !== 'end'）显示
- wx:if 条件同 speak-panel / action-panel

### 气泡动画
- 在 round-table 组件中，对应 seat-card 上方显示
- 气泡内容：表情图片 60rpx
- 动画：从头像上方弹出，上浮 + 渐隐，持续 3 秒
- 同一玩家连续发，新的替换旧的（不叠加）
- CSS animation：translateY + opacity

## 服务端

### index.js 消息处理
```javascript
case 'SEND_EMOJI': {
  const room = rooms.get(client.roomCode);
  if (!room || !room.started) break;
  const player = room.players.get(client.id);
  if (!player || player.spectator) break;
  const emojiId = payload && payload.emojiId;
  if (!emojiId) break;
  // 限频：3秒一次
  const now = Date.now();
  if (player._lastEmoji && now - player._lastEmoji < 3000) break;
  player._lastEmoji = now;
  const seat = Array.isArray(room.seats) ? room.seats.indexOf(client.id) : -1;
  for (const p of room.players.values()) {
    send(p, { type: 'EMOJI', data: { playerId: client.id, emojiId, seat } });
  }
  break;
}
```

## 文件结构

### 新增
- `mobile/miniprogram/components/emoji-bar/index.js` — 表情栏组件
- `mobile/miniprogram/components/emoji-bar/index.wxml` — 模板
- `mobile/miniprogram/components/emoji-bar/index.wxss` — 样式
- `mobile/miniprogram/components/emoji-bar/index.json` — 组件声明
- 表情素材：6 张 PNG，部署到 CDN `https://www.awalon.top/mp-assets/emoji/`

### 修改
- `server/index.js` — 加 SEND_EMOJI 消息处理
- `mobile/miniprogram/pages/index/index.js` — 接收 EMOJI 消息，管理气泡状态
- `mobile/miniprogram/pages/index/index.wxml` — 引入 emoji-bar 组件
- `mobile/miniprogram/pages/index/index.json` — 注册 emoji-bar
- `mobile/miniprogram/components/round-table/index.wxml` — 气泡显示区域
- `mobile/miniprogram/components/round-table/index.wxss` — 气泡动画样式

## 不做的事

- 不做自定义表情
- 不做表情商店
- 不持久化到消息历史
- 不做表情统计
