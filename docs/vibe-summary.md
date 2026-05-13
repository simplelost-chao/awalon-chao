## 项目定位

**一句话**: 阿瓦隆桌游联机平台，微信小程序客户端 + Node.js 服务端，支持真人多人对局和 AI 托管，部署于 awalon.top。

## 核心架构

- 小程序端 — 微信原生小程序（`mobile/miniprogram/`），单页面承载全部游戏流程，组件化拆分 UI，WebSocket 驱动状态同步
- 服务端 — Node.js，`game.js` 游戏状态机驱动发牌、组队投票、任务、刺杀、结算全流程
- AI 模块 — `game-ai.js` AI 托管决策（发言/投票/任务选择/梅林验人）；`ai.js` 做复盘与记忆
- 持久化 — SQLite（`db.js` + `history.js`），存储对战历史和勋章数据
- 审核模式 — `review-page` 组件伪装为"发牌工具"，Admin 接口热切换，绕过微信审核

## 数据流

用户操作 → socket.js → WebSocket 消息 → index.js 分发 → room.js / game.js / game-ai.js → ROOM_STATE 广播 → 所有客户端重渲染

## 服务端模块

- index.js — HTTP 接口 + WebSocket 入口，Admin / ReviewMode 控制
- game.js — 游戏状态机，全流程驱动（发牌→投票→任务→刺杀→结算）
- room.js — 房间生命周期：创建、加入、恢复、销毁
- game-ai.js — AI 托管决策：发言、投票、任务选择、梅林验人
- ai.js — AI 复盘与记忆，调用 DeepSeek API
- db.js — SQLite 访问层
- history.js — 对战历史读写
- medals.js — 勋章积分计算与结算
- presence.js — 在线状态管理

## 小程序组件

- round-table — 圆桌座位图
- identity-panel — 身份牌展示
- action-panel — 投票 / 任务操作
- speak-panel / speak-list — 发言输入与记录
- mission-pills — 任务进度胶囊
- review-page — 审核伪装界面

## 当前状态

**部署**: EC2（awalon.top），PM2 守护进程

**已知问题**: 重新发牌时留局计为失败，根因在 game.js 留局标记时机

## 主要功能

- 多房间并发，房间创建/加入/恢复
- 完整阿瓦隆状态机：组队→投票→任务→刺杀梅林→结算
- AI 托管：玩家不在线时 AI 代打
- 对战历史记录与详情（分包页面）
- 角色胜率统计
- 勋章系统（局内积分 + 赛后结算）
- 审核模式：随时热切换为无害界面
- 微信登录（openid + 手机号）
- 小程序分享卡片

## 尚未实现

- 留局机制修复（重新发牌时正确保留留局标记）
