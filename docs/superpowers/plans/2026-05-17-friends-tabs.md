# 好友系统 + 底部 Tab 导航 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 底部 Tab 导航（首页/好友/历史/我的）+ 好友系统（游戏中加好友、在线状态、快速加入房间）。

**Architecture:** 自建 tab-bar 组件固定底部，4 个页面各自引入。好友数据存 SQLite friends 表，WebSocket 消息实现请求/接受/列表/状态推送。服务端新建 friends.js 处理好友逻辑。

**Tech Stack:** WeChat miniprogram, Node.js, SQLite (better-sqlite3), WebSocket

---

## 文件结构

### 新增
- `mobile/miniprogram/components/tab-bar/index.js/wxml/wxss/json` — 底部导航组件
- `mobile/miniprogram/subpkg/friends/index/index.js/wxml/wxss/json` — 好友列表页
- `server/friends.js` — 好友数据库操作 + 消息处理

### 修改
- `server/db.js` — 创建 friends 表
- `server/index.js` — 注册好友消息处理 + 连接/断开通知好友
- `mobile/miniprogram/pages/index/index.wxml` — 加 tab-bar，移除旧入口按钮
- `mobile/miniprogram/pages/index/index.json` — 注册 tab-bar
- `mobile/miniprogram/subpkg/history/index/index.wxml/json` — 加 tab-bar
- `mobile/miniprogram/subpkg/role-stats/index/index.wxml/json` — 加 tab-bar + 规则入口
- `mobile/miniprogram/components/room-players-panel/index.wxml/js` — 加好友按钮
- `mobile/miniprogram/app.json` — subpkg 加 friends 页面

---

## Task 1: tab-bar 组件

**Files:**
- Create: `mobile/miniprogram/components/tab-bar/index.json`
- Create: `mobile/miniprogram/components/tab-bar/index.js`
- Create: `mobile/miniprogram/components/tab-bar/index.wxml`
- Create: `mobile/miniprogram/components/tab-bar/index.wxss`

- [ ] **Step 1: 创建 tab-bar 组件**

index.json:
```json
{"component": true, "styleIsolation": "shared"}
```

index.js:
```javascript
Component({
  properties: {
    active: { type: String, value: 'home' },
  },
  data: {
    tabs: [
      { key: 'home',    label: '首页', icon: '🏠', url: '/pages/index/index' },
      { key: 'friends', label: '好友', icon: '👥', url: '/subpkg/friends/index/index' },
      { key: 'history', label: '历史', icon: '📋', url: '/subpkg/history/index/index' },
      { key: 'mine',    label: '我的', icon: '👤', url: '/subpkg/role-stats/index/index' },
    ],
  },
  methods: {
    onTap(e) {
      const key = e.currentTarget.dataset.key;
      if (key === this.data.active) return;
      const tab = this.data.tabs.find(t => t.key === key);
      if (!tab) return;
      if (key === 'home') {
        wx.reLaunch({ url: tab.url });
      } else {
        wx.redirectTo({ url: tab.url });
      }
    },
  },
});
```

index.wxml:
```xml
<view class="tab-bar">
  <view class="tab-item {{active === item.key ? 'tab-item-active' : ''}}"
    wx:for="{{tabs}}" wx:key="key"
    data-key="{{item.key}}" bindtap="onTap">
    <text class="tab-icon">{{item.icon}}</text>
    <text class="tab-label">{{item.label}}</text>
  </view>
</view>
```

index.wxss:
```css
.tab-bar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  z-index: 50;
  display: flex;
  justify-content: space-around;
  align-items: center;
  height: 100rpx;
  padding-bottom: env(safe-area-inset-bottom);
  background: rgba(10, 8, 16, 0.92);
  border-top: 1rpx solid rgba(216,176,107,0.15);
}
.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
  flex: 1;
  padding: 8rpx 0;
}
.tab-icon { font-size: 36rpx; }
.tab-label { font-size: 20rpx; color: rgba(255,255,255,0.4); }
.tab-item-active .tab-label { color: rgba(216,176,107,0.9); }
```

- [ ] **Step 2: 提交**

---

## Task 2: 4 个页面接入 tab-bar

**Files:**
- Modify: `mobile/miniprogram/pages/index/index.wxml`
- Modify: `mobile/miniprogram/pages/index/index.json`
- Modify: `mobile/miniprogram/subpkg/history/index/index.wxml`
- Modify: `mobile/miniprogram/subpkg/history/index/index.json`
- Modify: `mobile/miniprogram/subpkg/role-stats/index/index.wxml`
- Modify: `mobile/miniprogram/subpkg/role-stats/index/index.json`

- [ ] **Step 1: 注册 tab-bar 组件**

在 4 个页面的 index.json 的 usingComponents 中添加：
```json
"tab-bar": "/components/tab-bar/index"
```

- [ ] **Step 2: 主页 — 加 tab-bar，移除旧按钮，游戏中隐藏 tab**

在 index.wxml 末尾（页面 view 闭合前）添加：
```xml
<tab-bar wx:if="{{atHome || !room}}" active="home" />
```

移除 `home-action-grid`（历史/统计/规则按钮，约 line 63-93）。

- [ ] **Step 3: 历史页 — 加 tab-bar**

在 history/index/index.wxml 页面末尾添加：
```xml
<tab-bar active="history" />
```

给 content 加底部 padding 避免被 tab-bar 遮挡：在 content view 的 style 中追加 `padding-bottom: 120rpx;`

- [ ] **Step 4: 统计页 — 加 tab-bar + 规则入口**

在 role-stats/index/index.wxml 页面末尾添加：
```xml
<tab-bar active="mine" />
```

在统计页合适位置（勋章墙 tab 下方）加规则入口按钮：
```xml
<view class="rules-entry" bindtap="openRules">
  <text class="rules-entry-text">📖 游戏规则</text>
</view>
```

给 content 加底部 padding。

- [ ] **Step 5: 提交**

---

## Task 3: 好友页面骨架 + app.json 注册

**Files:**
- Create: `mobile/miniprogram/subpkg/friends/index/index.json`
- Create: `mobile/miniprogram/subpkg/friends/index/index.js`
- Create: `mobile/miniprogram/subpkg/friends/index/index.wxml`
- Create: `mobile/miniprogram/subpkg/friends/index/index.wxss`
- Modify: `mobile/miniprogram/app.json`

- [ ] **Step 1: app.json 注册好友页**

在 subpackages 中加入 friends 页面路径。

- [ ] **Step 2: 创建好友页面**

index.json:
```json
{
  "usingComponents": {
    "tab-bar": "/components/tab-bar/index"
  }
}
```

index.js — 页面骨架：获取好友列表、处理请求、加入房间。
```javascript
const { getSkin } = require("../../../skins");
const socket = require("../../../utils/socket");

function getIndexPage() {
  const pages = getCurrentPages();
  for (let i = pages.length - 1; i >= 0; i--) {
    if (pages[i].route === "pages/index/index") return pages[i];
  }
  return null;
}

Page({
  data: {
    statusBarHeight: 20, navBarHeight: 44, navTotalHeight: 64,
    skinId: 'dark-gold', skinInGameBg: '',
    friends: [],
    pendingRequests: [],
    loading: true,
  },

  onLoad() {
    const app = getApp();
    const nav = (app.globalData && app.globalData.nav) || {};
    const skinId = (app.globalData && app.globalData.skinId) || 'dark-gold';
    this.setData({
      statusBarHeight: nav.statusBarHeight || 20,
      navBarHeight: nav.navBarHeight || 44,
      navTotalHeight: nav.navTotalHeight || 64,
      skinId, skinInGameBg: getSkin(skinId).inGameBg,
    });
  },

  onShow() {
    const app = getApp();
    app.globalData.friendsListener = (msg) => this.onFriendsMessage(msg);
    this.requestFriendsList();
  },

  onUnload() {
    const app = getApp();
    if (app.globalData.friendsListener) app.globalData.friendsListener = null;
  },

  requestFriendsList() {
    this.setData({ loading: true });
    socket.send({ type: 'GET_FRIENDS' });
  },

  onFriendsMessage(msg) {
    if (msg.type === 'FRIENDS_LIST') {
      const data = msg.data || {};
      const friends = (data.friends || []).sort((a, b) => {
        if (a.online && !b.online) return -1;
        if (!a.online && b.online) return 1;
        return 0;
      });
      this.setData({ friends, pendingRequests: data.pending || [], loading: false });
    }
    if (msg.type === 'FRIEND_STATUS') {
      const { phone, online, roomCode } = msg.data || {};
      const friends = this.data.friends.map(f =>
        f.phone === phone ? { ...f, online, roomCode } : f
      );
      this.setData({ friends });
    }
    if (msg.type === 'FRIEND_REQUEST_RECEIVED') {
      this.requestFriendsList();
    }
    if (msg.type === 'FRIEND_RESPONSE') {
      this.requestFriendsList();
    }
  },

  onAcceptRequest(e) {
    const phone = e.currentTarget.dataset.phone;
    socket.send({ type: 'FRIEND_RESPOND', payload: { phone, accept: true } });
  },

  onRejectRequest(e) {
    const phone = e.currentTarget.dataset.phone;
    socket.send({ type: 'FRIEND_RESPOND', payload: { phone, accept: false } });
  },

  onJoinRoom(e) {
    const roomCode = e.currentTarget.dataset.room;
    if (!roomCode) return;
    const indexPage = getIndexPage();
    if (indexPage && typeof indexPage.joinRoomByCode === 'function') {
      indexPage.joinRoomByCode(roomCode);
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  onDeleteFriend(e) {
    const phone = e.currentTarget.dataset.phone;
    wx.showModal({
      title: '删除好友', content: '确认删除该好友？', confirmText: '删除',
      success: (res) => {
        if (!res.confirm) return;
        socket.send({ type: 'FRIEND_DELETE', payload: { phone } });
        this.requestFriendsList();
      },
    });
  },

  onBackHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  },
});
```

index.wxml:
```xml
<view class="page theme-{{skinId}}">
  <image class="bg" src="{{skinInGameBg}}" mode="aspectFill" />
  <view class="mask"></view>

  <view class="sub-nav" style="padding-top: {{statusBarHeight}}px; height: {{navBarHeight}}px;">
    <view class="sub-nav-inner">
      <view class="sub-nav-back" bindtap="onBackHome"><text class="sub-nav-back-arrow">‹</text></view>
      <text class="sub-nav-title">好友</text>
      <view class="sub-nav-placeholder"></view>
    </view>
  </view>

  <view class="content" style="padding-top: {{navTotalHeight + 8}}px; padding-bottom: 120rpx;">

    <!-- 好友请求 -->
    <view class="pf friend-section" wx:if="{{pendingRequests.length}}">
      <view class="fb fb-top"></view><view class="fb fb-bottom"></view>
      <view class="fb fb-left"></view><view class="fb fb-right"></view>
      <view class="fb fb-ctl"></view><view class="fb fb-ctr"></view>
      <view class="fb fb-cbl"></view><view class="fb fb-cbr"></view>
      <view class="fc-inner fc-tl"></view><view class="fc-inner fc-tr"></view>
      <view class="fc-inner fc-bl"></view><view class="fc-inner fc-br"></view>
      <text class="friend-section-title">好友请求</text>
      <view class="friend-request" wx:for="{{pendingRequests}}" wx:key="phone">
        <image class="friend-avatar" wx:if="{{item.avatarImage}}" src="{{item.avatarImage}}" mode="aspectFill" />
        <text class="friend-avatar-text" wx:else>{{item.avatarText || '🐺'}}</text>
        <text class="friend-name">{{item.nickname}}</text>
        <view class="friend-request-actions">
          <text class="friend-btn friend-btn-accept" data-phone="{{item.phone}}" bindtap="onAcceptRequest">同意</text>
          <text class="friend-btn friend-btn-reject" data-phone="{{item.phone}}" bindtap="onRejectRequest">拒绝</text>
        </view>
      </view>
    </view>

    <!-- 好友列表 -->
    <view class="pf friend-section">
      <view class="fb fb-top"></view><view class="fb fb-bottom"></view>
      <view class="fb fb-left"></view><view class="fb fb-right"></view>
      <view class="fb fb-ctl"></view><view class="fb fb-ctr"></view>
      <view class="fb fb-cbl"></view><view class="fb fb-cbr"></view>
      <view class="fc-inner fc-tl"></view><view class="fc-inner fc-tr"></view>
      <view class="fc-inner fc-bl"></view><view class="fc-inner fc-br"></view>
      <text class="friend-section-title">好友列表 ({{friends.length}})</text>

      <view wx:if="{{!friends.length && !loading}}" class="friend-empty">
        <text class="friend-empty-text">还没有好友，在游戏中可以添加</text>
      </view>

      <view class="friend-item" wx:for="{{friends}}" wx:key="phone"
        bindlongpress="onDeleteFriend" data-phone="{{item.phone}}">
        <image class="friend-avatar" wx:if="{{item.avatarImage}}" src="{{item.avatarImage}}" mode="aspectFill" />
        <text class="friend-avatar-text" wx:else>{{item.avatarText || '🐺'}}</text>
        <view class="friend-info">
          <text class="friend-name">{{item.nickname}}</text>
          <text class="friend-status {{item.online ? 'friend-online' : 'friend-offline'}}">
            {{item.online ? (item.roomCode ? '游戏中 · ' + item.roomCode : '在线') : '离线'}}
          </text>
        </view>
        <text class="friend-join-btn" wx:if="{{item.online && item.roomCode}}"
          data-room="{{item.roomCode}}" catchtap="onJoinRoom">加入</text>
      </view>
    </view>

  </view>

  <tab-bar active="friends" />
</view>
```

index.wxss — 复用历史页/统计页的基础样式模式。

- [ ] **Step 3: 提交**

---

## Task 4: 服务端 — friends 表 + friends.js

**Files:**
- Modify: `server/db.js`
- Create: `server/friends.js`

- [ ] **Step 1: db.js 创建 friends 表**

在 db.js 的 CREATE TABLE 区域追加：
```javascript
CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_a TEXT NOT NULL,
  phone_b TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at INTEGER,
  accepted_at INTEGER,
  UNIQUE(phone_a, phone_b)
);
CREATE INDEX IF NOT EXISTS idx_friends_a ON friends(phone_a);
CREATE INDEX IF NOT EXISTS idx_friends_b ON friends(phone_b);
```

- [ ] **Step 2: 创建 friends.js**

```javascript
const { userDb } = require('./db');
const { now } = require('./constants');

function sendFriendRequest(fromPhone, toPhone) {
  if (fromPhone === toPhone) return { error: 'SELF' };
  const existing = userDb.prepare(
    'SELECT * FROM friends WHERE (phone_a=? AND phone_b=?) OR (phone_a=? AND phone_b=?)'
  ).get(fromPhone, toPhone, toPhone, fromPhone);
  if (existing) {
    if (existing.status === 'accepted') return { error: 'ALREADY_FRIENDS' };
    if (existing.status === 'pending') return { error: 'ALREADY_PENDING' };
  }
  userDb.prepare(
    'INSERT OR REPLACE INTO friends (phone_a, phone_b, status, created_at) VALUES (?, ?, ?, ?)'
  ).run(fromPhone, toPhone, 'pending', now());
  return { ok: true };
}

function respondFriendRequest(myPhone, fromPhone, accept) {
  const row = userDb.prepare(
    'SELECT * FROM friends WHERE phone_a=? AND phone_b=? AND status=?'
  ).get(fromPhone, myPhone, 'pending');
  if (!row) return { error: 'NOT_FOUND' };
  if (accept) {
    userDb.prepare('UPDATE friends SET status=?, accepted_at=? WHERE id=?').run('accepted', now(), row.id);
  } else {
    userDb.prepare('DELETE FROM friends WHERE id=?').run(row.id);
  }
  return { ok: true, accepted: accept };
}

function deleteFriend(myPhone, theirPhone) {
  userDb.prepare(
    'DELETE FROM friends WHERE (phone_a=? AND phone_b=?) OR (phone_a=? AND phone_b=?)'
  ).run(myPhone, theirPhone, theirPhone, myPhone);
  return { ok: true };
}

function getFriendsList(myPhone) {
  const rows = userDb.prepare(`
    SELECT f.*, u.nickname, u.avatar FROM friends f
    JOIN users u ON u.phone = CASE WHEN f.phone_a = ? THEN f.phone_b ELSE f.phone_a END
    WHERE (f.phone_a = ? OR f.phone_b = ?) AND f.status = 'accepted'
  `).all(myPhone, myPhone, myPhone);
  return rows.map(r => ({
    phone: r.phone_a === myPhone ? r.phone_b : r.phone_a,
    nickname: r.nickname || '玩家',
    avatar: r.avatar || '',
  }));
}

function getPendingRequests(myPhone) {
  const rows = userDb.prepare(`
    SELECT f.phone_a AS phone, u.nickname, u.avatar FROM friends f
    JOIN users u ON u.phone = f.phone_a
    WHERE f.phone_b = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).all(myPhone);
  return rows.map(r => ({
    phone: r.phone,
    nickname: r.nickname || '玩家',
    avatar: r.avatar || '',
  }));
}

function getFriendPhones(myPhone) {
  const rows = userDb.prepare(`
    SELECT CASE WHEN phone_a = ? THEN phone_b ELSE phone_a END AS phone
    FROM friends WHERE (phone_a = ? OR phone_b = ?) AND status = 'accepted'
  `).all(myPhone, myPhone, myPhone);
  return rows.map(r => r.phone);
}

module.exports = { sendFriendRequest, respondFriendRequest, deleteFriend, getFriendsList, getPendingRequests, getFriendPhones };
```

- [ ] **Step 3: 提交**

---

## Task 5: 服务端 — index.js 消息处理 + 在线通知

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: 引入 friends.js，加消息处理**

在 require 区域加：
```javascript
const { sendFriendRequest, respondFriendRequest, deleteFriend, getFriendsList, getPendingRequests, getFriendPhones } = require('./friends');
```

在 switch-case 中添加：

```javascript
case 'GET_FRIENDS': {
  if (!client.userPhone) { send(client, { type: 'ERROR', data: { code: 'NEED_LOGIN' } }); break; }
  const friendList = getFriendsList(client.userPhone);
  const pending = getPendingRequests(client.userPhone);
  // 填充在线状态
  const friends = friendList.map(f => {
    let online = false, roomCode = null;
    for (const [, r] of rooms) {
      for (const [, p] of r.players) {
        if (p.phone === f.phone && !p.offline) { online = true; roomCode = r.code; break; }
      }
      if (online) break;
    }
    const isUrl = f.avatar && (f.avatar.startsWith('http') || f.avatar.startsWith('/'));
    return { ...f, online, roomCode, avatarImage: isUrl ? f.avatar : '', avatarText: isUrl ? '' : (f.avatar || '🐺') };
  });
  const pendingWithAv = pending.map(p => {
    const isUrl = p.avatar && (p.avatar.startsWith('http') || p.avatar.startsWith('/'));
    return { ...p, avatarImage: isUrl ? p.avatar : '', avatarText: isUrl ? '' : (p.avatar || '🐺') };
  });
  send(client, { type: 'FRIENDS_LIST', data: { friends, pending: pendingWithAv } });
  break;
}

case 'FRIEND_REQUEST': {
  if (!client.userPhone) break;
  const targetPhone = payload && payload.targetPhone;
  if (!targetPhone) break;
  const result = sendFriendRequest(client.userPhone, targetPhone);
  if (result.ok) {
    // 通知目标玩家（如果在线）
    for (const [, ws] of clients) {
      if (ws.userPhone === targetPhone) {
        const user = require('./db').userDb.prepare('SELECT nickname, avatar FROM users WHERE phone=?').get(client.userPhone);
        send(ws, { type: 'FRIEND_REQUEST_RECEIVED', data: { fromPhone: client.userPhone, fromNickname: user ? user.nickname : '玩家', fromAvatar: user ? user.avatar : '' } });
      }
    }
  }
  send(client, { type: 'FRIEND_REQUEST_RESULT', data: result });
  break;
}

case 'FRIEND_RESPOND': {
  if (!client.userPhone) break;
  const respPhone = payload && payload.phone;
  const accept = !!(payload && payload.accept);
  if (!respPhone) break;
  const result = respondFriendRequest(client.userPhone, respPhone, accept);
  if (result.ok && result.accepted) {
    // 通知发起方
    for (const [, ws] of clients) {
      if (ws.userPhone === respPhone) {
        send(ws, { type: 'FRIEND_RESPONSE', data: { phone: client.userPhone, accepted: true } });
      }
    }
  }
  send(client, { type: 'FRIEND_RESPOND_RESULT', data: result });
  break;
}

case 'FRIEND_DELETE': {
  if (!client.userPhone) break;
  const delPhone = payload && payload.phone;
  if (!delPhone) break;
  deleteFriend(client.userPhone, delPhone);
  break;
}
```

- [ ] **Step 2: 提交**

---

## Task 6: 玩家列表加好友按钮

**Files:**
- Modify: `mobile/miniprogram/components/room-players-panel/index.wxml`
- Modify: `mobile/miniprogram/components/room-players-panel/index.js`
- Modify: `mobile/miniprogram/pages/index/index.wxml`
- Modify: `mobile/miniprogram/pages/index/index.js`

- [ ] **Step 1: room-players-panel 加"加好友"按钮**

在玩家列表每行（player-item-compact-inner）中，踢人按钮旁边加：
```xml
<text class="friend-add-btn" wx:if="{{!item.isMe && !item.isFriend}}"
  data-phone="{{item.phone}}" catchtap="onAddFriend">加好友</text>
<text class="friend-tag" wx:if="{{item.isFriend}}">好友</text>
```

- [ ] **Step 2: room-players-panel JS 加事件**

```javascript
onAddFriend(e) { this.triggerEvent('addfriend', e.currentTarget.dataset); },
```

- [ ] **Step 3: 主页面绑定事件 + 传好友列表**

index.wxml 的 room-players-panel 上加：
```xml
bind:addfriend="onAddFriend"
```

index.js 加方法：
```javascript
onAddFriend(e) {
  const phone = e.detail && e.detail.phone;
  if (!phone) return;
  this.send('FRIEND_REQUEST', { targetPhone: phone });
  wx.showToast({ title: '已发送好友请求', icon: 'none' });
},
```

在 refreshGameState 中标记 playerCards 的 isFriend 字段（从 app.globalData.friendPhones 查询）。

- [ ] **Step 4: 提交**

---

## Task 7: 主页面接收好友消息 + 转发

**Files:**
- Modify: `mobile/miniprogram/pages/index/index.js`

- [ ] **Step 1: onMessage 中转发好友相关消息**

在 onMessage 处理中添加：
```javascript
if (['FRIENDS_LIST', 'FRIEND_STATUS', 'FRIEND_REQUEST_RECEIVED', 'FRIEND_RESPONSE', 'FRIEND_REQUEST_RESULT', 'FRIEND_RESPOND_RESULT'].includes(msg.type)) {
  const app = getApp();
  if (app.globalData.friendsListener) app.globalData.friendsListener(msg);
  // FRIEND_REQUEST_RECEIVED 时弹提示
  if (msg.type === 'FRIEND_REQUEST_RECEIVED' && msg.data) {
    wx.showToast({ title: `${msg.data.fromNickname} 请求加你好友`, icon: 'none', duration: 3000 });
  }
  return;
}
```

- [ ] **Step 2: 提交**

---

## Task 8: 部署 + 验证

- [ ] **Step 1: 部署服务端**
```bash
scp server/db.js server/friends.js server/index.js awalon:/opt/avalon-online/server/
ssh awalon "pm2 restart avalon-server"
```

- [ ] **Step 2: 验证清单**
1. 底部 4 个 tab 正常显示和跳转
2. 游戏中 tab-bar 隐藏
3. 好友页显示空状态
4. 游戏中玩家列表显示"加好友"按钮
5. 点击加好友后对方收到请求
6. 好友页显示请求，可同意/拒绝
7. 同意后好友列表显示好友在线状态
8. 好友在游戏中显示房间号 + 加入按钮
9. 长按删除好友

- [ ] **Step 3: 最终提交并推送**
```bash
git add -A
git commit -m "feat: friends system + bottom tab navigation"
git push origin main
```
