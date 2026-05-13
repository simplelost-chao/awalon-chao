# Admin Dashboard Design

## Overview

单 HTML 文件后台管理系统，替代现有 `ai-dashboard.html`，通过 `GET /admin?key=ADMIN_KEY` 访问。左侧 sidebar 导航 6 个模块，右侧内容区。所有数据通过 REST API（均需 ADMIN_KEY 认证）获取。

## 架构

- **前端：** 单文件 `server/admin.html`，纯 HTML/CSS/JS，无构建工具
- **后端：** 在 `server/index.js` 中新增 admin REST API，复用现有 `ADMIN_KEY` 查询参数认证
- **数据源：** `users.sqlite`（对战/玩家）、`ai.sqlite`（AI 数据）、内存 `_rooms` Map（实时房间）

## 模块设计

### 1. 仪表盘（Dashboard）

**数据：**
- 总对局数、总玩家数（从 `game_records` / `users` 表 COUNT）
- 当前在线房间数（从 `_rooms.size`）
- 正义/邪恶总胜率（从 `game_records` 聚合）
- 最近 10 局快速列表（从 `game_records` ORDER BY ended_at DESC LIMIT 10）

**API：** `GET /api/admin/dashboard-stats`

**返回：**
```json
{
  "totalGames": 150,
  "totalPlayers": 42,
  "activeRooms": 2,
  "goodWinRate": 54.3,
  "evilWinRate": 45.7,
  "recentGames": [
    { "id": 150, "roomCode": "ABC123", "maxPlayers": 7, "winner": "good", "endedAt": "2026-05-09T12:00:00Z" }
  ]
}
```

### 2. 对战记录（Games）

**列表视图：**
- 分页（每页 20 条）
- 显示：ID、房间号、人数、胜负方、状态（completed/aborted）、时间
- 筛选：状态、胜负方、时间范围

**详情视图：**
- 点击一行展开详情面板
- 玩家列表：昵称、座位、角色、阵营、胜负、是否 AI、是否房主
- 投票记录：每轮每次的队伍组成、各人投票
- 任务记录：每轮成功/失败、失败票数
- 刺杀结果
- 发言记录（按轮次折叠）

**API：**
- `GET /api/admin/games?page=1&limit=20&status=completed&winner=good`
- `GET /api/admin/games/:id` — 返回 `game_records.payload` JSON + participants

### 3. 玩家管理（Players）

**列表视图：**
- 分页（每页 20 条）
- 显示：昵称、手机号（脱敏 138****1234）、总局数、胜率、勋章数、注册时间
- 搜索：按昵称或手机号

**详情视图：**
- 角色分布（各角色局数/胜率）
- 勋章列表
- 最近 10 局

**API：**
- `GET /api/admin/players?page=1&limit=20&search=xxx`
- `GET /api/admin/players/:phone` — 复用 `getRoleStatsForPhone` + 玩家基本信息

### 4. AI 管理（AI）

合并现有 `ai-dashboard.html` 全部功能：
- 概览统计（总对局、胜率、发言数）
- 进化日志（evolution_log 列表）
- 元分析触发按钮
- 策略模式浏览（按阵营/角色筛选）
- 发言库浏览（按意图/场景筛选）
- 玩家画像列表
- AI 记忆浏览

**API：** 复用现有 `/api/admin/ai-stats`、`/api/admin/trigger-meta`，从 `ai.sqlite` 直接查询补充数据

**新增 API：**
- `GET /api/admin/ai/speeches?faction=&intent=&limit=50`
- `GET /api/admin/ai/strategies?faction=&role=`
- `GET /api/admin/ai/profiles`
- `GET /api/admin/ai/evolution-log`
- `GET /api/admin/ai/memory`

### 5. 系统配置（Config）

**可配置项：**
- `REVIEW_MODE`：审核模式开关（toggle）
- 默认角色配置（JSON 编辑，保存到服务端内存 / 文件）
- 强制轮默认值
- 发言时长默认值

**API：**
- `GET /api/admin/config` — 返回当前所有配置
- `POST /api/admin/config` — 更新配置（body: `{ key: value }`)

**实现：** 配置存在 `server/admin-config.json`，服务端启动时读取，API 修改后写回文件。`REVIEW_MODE` 同时更新 `process.env`。

### 6. 皮肤管理（Skins）

**列表视图：**
- 所有皮肤：ID、名称、状态（published/draft）
- 每个皮肤的配色预览（accent/bg/panel 色块）
- 切换发布状态按钮

**资产预览：**
- 背景图缩略图
- 角色立绘缩略图

**API：**
- `GET /api/admin/skins` — 返回全部皮肤 + 状态
- `POST /api/admin/skins/:id/status` — body: `{ status: "published" | "draft" }`

**数据源：** 皮肤定义在 `server/index.js` 的 `SKIN_CATALOGUE` 或类似结构中，状态持久化到 `admin-config.json`。

## UI 设计

**布局：** 左侧固定 sidebar（200px），右侧内容区
**配色：** 暗色主题，复用游戏 dark-gold 风格
  - 背景：`#0a0c14`
  - 面板：`rgba(12,14,22,0.85)`
  - 边框：`rgba(216,176,107,0.14)`
  - 强调：`#d8b06b`
  - 正义蓝：`#4e9eff`
  - 邪恶红：`#e05050`
  - 文字：`#f2e5c8`

**交互：**
- sidebar 高亮当前模块
- 列表支持点击展开详情（不跳页面）
- 配置修改即时保存，toast 提示
- 分页用简单的 上一页/下一页 按钮

## 认证

复用现有 `ADMIN_KEY` 机制：
- 首次访问显示密码输入框
- 输入后存到 `localStorage`，后续请求自动附带 `?key=xxx`
- 服务端所有 `/api/admin/*` 路由统一校验

## 文件结构

```
server/
├── admin.html              ← 新建（替代 ai-dashboard.html）
├── admin-config.json        ← 新建（持久化配置）
├── index.js                 ← 新增 admin API 路由
└── (其余不变)
```

## 不做的事

- 不做用户权限分级（只有一个 admin 角色）
- 不做实时推送（轮询或手动刷新）
- 不做数据导出/下载
- 不做数据删除（只读 + 配置修改）
