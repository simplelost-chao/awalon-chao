# 好友系统 + 底部 Tab 导航

## 概述

新增好友系统（游戏中加好友、查看好友在线状态、快速加入好友房间）+ 底部 Tab 导航栏（首页/好友/历史/我的）。

## 底部 Tab 导航

### 结构

| Tab | 图标 | 页面 | 说明 |
|-----|------|------|------|
| 首页 | 🏠 | pages/index/index | 现有主页面（房间/游戏） |
| 好友 | 👥 | subpkg/friends/index | 新建好友列表页 |
| 历史 | 📋 | subpkg/history/index | 现有历史页 |
| 我的 | 👤 | subpkg/role-stats/index | 现有统计页（加规则入口） |

### 实现方式

不用微信原生 tabBar（限制多），自建固定底部导航组件 `tab-bar`：
- 固定在页面底部，所有 4 个页面共享
- 当前页高亮，其他页灰色
- 点击用 `wx.navigateTo` 或 `wx.redirectTo` 跳转
- 游戏进行中（在房间内非首页）不显示 tab-bar
- 高度约 100rpx + safe-area-inset-bottom

### 首页改动

移除现有的历史/统计/规则按钮（home-action-grid 中的跳转按钮），由 tab-bar 替代。

## 好友系统

### 数据库

新增 `friends` 表：

```sql
CREATE TABLE friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_a TEXT NOT NULL,      -- 发起方
  phone_b TEXT NOT NULL,      -- 接收方
  status TEXT DEFAULT 'pending', -- pending / accepted / rejected
  created_at INTEGER,
  accepted_at INTEGER,
  UNIQUE(phone_a, phone_b)
);
CREATE INDEX idx_friends_a ON friends(phone_a);
CREATE INDEX idx_friends_b ON friends(phone_b);
```

### WebSocket 消息

**发送好友请求**（玩家列表中点击）：
- 客户端 → `FRIEND_REQUEST { targetPhone }`
- 服务端 → 目标玩家 `FRIEND_REQUEST_RECEIVED { fromPhone, fromNickname, fromAvatar }`

**处理好友请求**：
- 客户端 → `FRIEND_RESPOND { phone, accept: true/false }`
- 服务端 → 发起方 `FRIEND_RESPONSE { phone, accepted }`

**获取好友列表**：
- 客户端 → `GET_FRIENDS {}`
- 服务端 → `FRIENDS_LIST { friends: [{ phone, nickname, avatar, online, roomCode }] }`

**好友状态变更**（上下线、进出房间时推送）：
- 服务端 → `FRIEND_STATUS { phone, online, roomCode }`

### 好友列表页（friends/index）

分两部分：

**好友请求**（顶部，有待处理时显示）：
- 显示待处理的好友请求列表
- 每条：头像 + 昵称 + 同意/拒绝按钮

**好友列表**（主体）：
- 在线好友排前面，离线排后面
- 每行：头像 + 昵称 + 状态（在线/离线/游戏中·房间号）
- 在线且在房间中的好友：显示"加入"按钮，点击直接加入房间
- 长按好友可删除

### 玩家列表加好友入口

在 room-players-panel 的玩家列表中，非好友的玩家行显示"加好友"按钮：
- 点击发送好友请求
- 已是好友的显示"好友"标记
- 自己不显示

### 在线状态

服务端维护好友在线映射：
- 玩家连接/断开时，通知其所有在线好友
- 玩家进出房间时，通知其所有在线好友
- 好友列表请求时返回每个好友的当前在线/房间状态

## 文件结构

### 新增
- `mobile/miniprogram/components/tab-bar/index.js/wxml/wxss/json` — 底部导航组件
- `mobile/miniprogram/subpkg/friends/index/index.js/wxml/wxss/json` — 好友列表页
- `server/friends.js` — 好友数据库操作

### 修改
- `server/db.js` — 创建 friends 表
- `server/index.js` — 加好友相关消息处理 + 在线状态推送
- `server/presence.js` — 连接/断开时通知好友
- `mobile/miniprogram/pages/index/index.wxml` — 移除旧按钮，加 tab-bar
- `mobile/miniprogram/pages/index/index.json` — 注册 tab-bar
- `mobile/miniprogram/subpkg/history/index/index.wxml` — 加 tab-bar
- `mobile/miniprogram/subpkg/role-stats/index/index.wxml` — 加 tab-bar + 规则入口
- `mobile/miniprogram/components/room-players-panel/index.wxml` — 加好友按钮
- `mobile/miniprogram/components/room-players-panel/index.js` — 加好友事件

## 不做的事

- 不做好友分组
- 不做黑名单
- 不做好友聊天（私信）
- 不做好友推送通知（微信服务通知）
- 不做好友对战数据（搭档系统已有）
