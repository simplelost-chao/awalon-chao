# Awalon Online

阿瓦隆联机小程序，微信小程序客户端 + Node.js 服务端。

- **线上地址**：`wss://www.awalon.top/ws`（服务端）
- **小程序**：微信搜索「阿瓦隆联机」或扫描 AppID `wx...` 二维码

## 工程结构

```
awalon-chao/
├── mobile/miniprogram/         微信小程序客户端（主工程）
│   ├── pages/index/            主页面（房间/游戏/复盘全在此）
│   ├── subpkg/                 分包页面（头像裁剪、规则、历史、统计）
│   ├── components/             自定义组件（圆桌、身份面板、任务卡等）
│   ├── skins.js                皮肤配置（6 套主题）
│   ├── utils/                  工具函数（socket、medals、gameUtils 等）
│   └── assets/                 图片、图标素材
├── server/                     Node.js 服务端
│   ├── index.js                主服务（HTTP + WebSocket + 连接管理）
│   ├── game.js                 游戏核心逻辑（投票、任务、刺杀、状态机）
│   ├── game-ai.js              AI 玩家行为（发言、投票、组队、自动托管）
│   ├── room.js                 房间管理（创建、加入、观战、踢人、持久化）
│   ├── presence.js             在线状态与断线重连
│   ├── ai.js                   AI 推理引擎（DeepSeek API 调用、复盘生成）
│   ├── voice.js                AI 语音合成
│   ├── db.js                   数据库层（SQLite 读写）
│   ├── medals.js               勋章计算引擎
│   ├── constants.js            角色阵营、任务配置等常量
│   ├── default-role-config.js  默认角色配置表
│   ├── history.js              历史对局查询
│   ├── stats-radar.js          能力雷达图计算引擎
│   ├── stats-partners.js       搭档分析计算引擎
│   ├── stats-config.js         统计参数配置（读 admin-config.json）
│   ├── admin-api.js            管理后台 API
│   ├── admin-config.json       运行时配置（超级玩家、统计参数等）
│   ├── users.sqlite            用户、对局、历史数据
│   └── ai.sqlite               AI 复盘缓存、发言策略库
└── design-preview/             设计工具
    ├── skin-prompt-studio.html AI 皮肤资产生成工具（DALL-E 集成）
    ├── component-workshop.html 组件展示/测试工具
    └── system-overview.html    系统架构概览
```

## 已实现功能

### 房间与对局

- 创建房间：5–10 人，自定义角色配置、发言时长、组队判负规则、坏人互认模式
- 加入房间：房间号加入或首页列表一键加入/观战
- 首页房间列表：显示当前活跃房间（可加入 / 游戏中），10 秒自动刷新
- 观战：进行中的房间可随时加入观战（自动设为观战者身份，保留真实头像），游戏结束后可点击空座位坐下参与下局
- 断线重连：30 分钟内自动恢复房间状态，指数退避重连
- 房主限制：同一账号同时只能是一个房间的房主，建新房自动解散旧房
- 分享邀请：生成房间分享卡片，扫码直接加入

### 游戏流程

- **发言阶段**：顺序发言、倒计时、发言记录按轮次查看、房主可跳过
- **组队阶段**：队长选队、全员投票、强制判负规则
- **任务阶段**：队员秘密提交成功/失败，任务进度可视化（5 轮卡片）
- **刺杀阶段**：刺客选择目标完成终局
- **湖中仙女**：8 人以上可开启，持卡者逐轮验人
- 座位圆桌可视化（Canvas 绘制）
- 座位标注系统：给其他玩家打标签（嫌疑大 / 可信 / 摇摆等）
- 游戏结束互评：MVP、最可疑、最有趣

### AI 功能

- **AI 玩家**：可添加 AI 填充空位，自动参与发言、投票、任务
- **自动托管**：游戏中开启托管，AI 代为操作（自动跳过发言、投票、出征）；断线 30 分钟后自动启用
- **AI 复盘**：游戏结束后生成每位玩家视角的详细复盘（推理过程、关键节点、发言分析等）
- **AI 语音**：AI 玩家发言可合成语音播放，支持不同角色人格语音
- **AI 信念推理**：`computeBeliefState` 基于投票/任务历史做确定性逻辑推断
- AI 接入 DeepSeek API（默认模型 `deepseek-chat`，支持替换其他兼容接口）

### 历史与统计

- 历史对局列表：分页展示，PVP/PVE 分 tab，含角色、胜负、时间、勋章、互评
- 对局详情：完整任务/投票/发言/刺杀记录
- 角色统计：总胜率、按角色/阵营分类胜率、勋章统计
- **能力雷达图**：好人/坏人各 6 维能力画像（Canvas 六边形雷达），贝叶斯平滑评分
  - 正义：识人、领袖、表水、挡刀、躲刀、胜率
  - 邪恶：冲锋、煽动、表水、隐秘、破坏、胜率
- **搭档分析**：5 对翻转称号卡片（黄金搭档↔最坑队友、最佳狼队友↔最差狼队友、最佳骑士↔最差骑士、最佳梅派↔最坑梅派、血脉压制↔天生冤家）
- **胜率趋势图**：最近 N 局正义/邪恶双线走势（Canvas 渐变填充）
- 勋章系统：按游戏表现自动触发，含正义/邪恶双系列（20+ 种勋章），支持本地 SVG 渲染
- 统计参数后台可配置（雷达局数、搭档局数、平滑系数、趋势局数等）

### 用户系统

- 微信登录（openid）+ 手机号绑定
- 昵称、头像编辑（支持本地图片上传或 emoji）
- 登录状态本地持久化（token、昵称、头像）

### 皮肤系统

- 6 套内置皮肤：dark-gold（默认）、celestial、ink-wash、cyber-neon、dark-dungeon、abyss
- 每套皮肤包含 CSS 变量、背景图、配色方案、角色立绘路径
- 皮肤选择器：主页 / 历史 / 统计页面均支持切换
- 动态背景：各页面根据当前皮肤加载对应背景图
- 皮肤资产支持 CDN + 本地双路径，自动降级
- 服务端皮肤目录 API（`/api/skins`）控制发布状态

### 皮肤设计工具（Skin Prompt Studio）

- AI 资产生成：集成 DALL-E API，按皮肤规格批量生成角色立绘、背景图等
- 手机预览：实时模拟小程序界面效果
- QA 报告：自动检测资产一致性，报告持久化到 IndexedDB

### 管理后台

- 超级玩家：后台玩家列表可设置超级玩家权限（可查看游戏中其他玩家底牌）
- 统计配置：雷达图/搭档/趋势图参数可视化配置（局数、平滑系数等）
- 房主默认角色仅房主可见，其他玩家无法看到

### 交互体验

- 操作时机震动提醒（组队/投票/发言/任务/刺杀轮到自己时）
- 新手引导提示卡片（关键阶段首次操作时弹出）
- 审核模式：`REVIEW_MODE=true` 时屏蔽真实 AI 内容，用于微信审核
- 重新发牌身份保护：gameVersion 机制防止重开后显示上局身份
- 游戏配置面板组件化：开始前/进行中/结束后复用同一组件（game-config-panel）

---

## 本地开发

### 服务端

```bash
cd server
npm install
cp .env.example .env   # 填入 QWEN_API_KEY、WX_APPID 等
npm start              # 默认端口 8080
```

健康检查：`http://localhost:8080/health`

### 小程序客户端

用微信开发者工具打开 `mobile/miniprogram/` 目录。`app.js` 内置 dev/prod 双环境配置，将 `globalData.env` 改为 `"dev"` 即可连接本地服务端（`ws://127.0.0.1:8080/ws`）。

---

## 部署

服务端运行在 `awalon.top`（EC2），PM2 管理进程。

```bash
# 部署服务端（scp 全部 JS 文件 + 重启）
scp -r server/*.js awalon:/opt/avalon-online/server/
ssh awalon "pm2 restart avalon-server"

# 仅部署特定文件（推荐，减少传输）
scp server/game.js server/room.js awalon:/opt/avalon-online/server/
ssh awalon "pm2 restart avalon-server"

# 切换审核模式
ssh awalon "REVIEW_MODE=true pm2 restart avalon-server --update-env"

# 切换游戏模式
ssh awalon "REVIEW_MODE=false pm2 restart avalon-server --update-env"

# 清空房间数据（慎用）
ssh awalon "node -e \"const db=require('better-sqlite3')('/opt/avalon-online/server/users.sqlite'); db.prepare('DELETE FROM active_rooms').run(); db.prepare('DELETE FROM active_room_players').run();\""
```

小程序客户端通过微信开发者工具上传代码，提交审核后发布。

---

## 环境变量（server/.env）

| 变量 | 说明 |
|------|------|
| `PORT` | 服务端口，默认 8080 |
| `AI_API_KEY` | AI 服务 API Key（DeepSeek 或兼容接口）|
| `AI_MODEL` | AI 模型名称，默认 `deepseek-chat` |
| `AI_BASE_URL` | AI 服务地址，默认 `https://api.deepseek.com/v1` |
| `WX_APPID` | 微信小程序 AppID |
| `WX_APPSECRET` | 微信小程序 AppSecret |
| `REVIEW_MODE` | `true` 时启用审核模式 |
| `RECONNECT_GRACE_MS` | 断线重连宽限时间（默认 30 分钟）|

---

## 协议说明

服务端同时提供：

- **WebSocket** `wss://www.awalon.top/ws`：全部游戏逻辑（房间、对局、历史、AI）
- **HTTP REST**：
  - `GET /health`
  - `GET /api/rooms` — 活跃房间列表（支持 viewer 身份识别）
  - `GET /api/review-mode`
  - `GET /api/role-config` — 角色配置
  - `GET /api/skins` — 皮肤目录与发布状态
  - `GET /api/skin-generated/:skinId` — 皮肤生成资产
  - `POST /api/wx/openid-login`
  - `POST /api/wx/phone-login`
  - `POST /api/profile/avatar`

详细 WebSocket 消息协议见 [docs/PROTOCOL.md](docs/PROTOCOL.md)。
