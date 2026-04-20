# 工程结构与维护约定

## 当前结构

```text
awalon-chao/
├── mobile/
│   ├── miniprogram/          微信小程序主工程
│   │   ├── app.js            全局初始化，拉取 reviewMode / roleConfig
│   │   ├── pages/
│   │   │   └── index/        主页面（游戏大厅、游戏房间、圆桌、身份、投票等）
│   │   ├── components/       可复用组件
│   │   │   ├── review-page/  审核伪装组件
│   │   │   ├── round-table/  圆桌显示
│   │   │   ├── identity-panel/ 身份面板
│   │   │   ├── action-panel/ 操作面板（投票/任务）
│   │   │   ├── mission-pills/ 任务进度胶囊
│   │   │   ├── mission-table/ 任务详情表格
│   │   │   ├── speak-panel/  发言输入
│   │   │   ├── speak-list/   发言记录列表
│   │   │   ├── nav-header/   导航栏
│   │   │   ├── room-card/    房间卡片
│   │   │   ├── room-players-panel/ 房间玩家列表
│   │   │   └── advanced-settings/ 高级设置
│   │   ├── subpkg/           分包页面
│   │   │   ├── history/      历史对战列表
│   │   │   ├── history-detail/ 历史对战详情
│   │   │   ├── role-stats/   角色统计
│   │   │   └── rules/        规则说明
│   │   └── utils/
│   │       ├── gameUtils.js  buildMissionPills 等游戏工具函数
│   │       ├── medals.js     勋章装饰
│   │       ├── socket.js     WebSocket 封装
│   │       └── shareCard.js  分享卡片
│   └── scripts/
│       └── mp-deploy.js      小程序发布脚本
├── server/
│   ├── index.js              HTTP 接口、WebSocket 分发、Admin / ReviewMode
│   ├── game.js               游戏状态机（发牌、投票、任务、刺杀、结算）
│   ├── game-ai.js            AI 托管决策（发言、投票、任务、验人）
│   ├── room.js               房间管理
│   ├── db.js                 SQLite 访问层
│   ├── history.js            对战历史读写
│   ├── medals.js             勋章结算
│   ├── ai.js                 AI 复盘与记忆
│   ├── constants.js          角色、阵营常量
│   ├── default-role-config.js 默认角色配置
│   └── presence.js           在线状态管理
├── docs/
│   ├── ARCHITECTURE.md       本文件
│   ├── PROTOCOL.md           WebSocket 消息协议
│   └── RUNBOOK.md            运行与部署手册
├── design-preview/           UI 设计稿（HTML 预览）
└── ai-research/              阿瓦隆 AI 研究资料
```

## 核心数据流

```
小程序启动
  ├─ GET /api/review-mode  → reviewMode 决定显示什么界面
  └─ GET /api/role-config  → 角色配置（哪些角色可用）

游戏主流程（WebSocket）
  用户操作 → socket.js → WS 消息 → server/index.js 分发
    ├─ 房间管理 → room.js
    ├─ 游戏逻辑 → game.js
    ├─ AI 托管  → game-ai.js
    └─ ROOM_STATE 广播 → 所有客户端重渲染
```

## 审核模式机制

小程序需要通过微信审核时，服务端可切换至"审核模式"，让所有打开小程序的用户看到一个伪装成"发牌工具"的界面（`review-page` 组件），而非真实游戏。

- 切换方式：Admin 接口（立即生效）或修改环境变量重启（见 RUNBOOK）
- 退出方式：长按 review-page 内"企业破冰"卡片 1 秒，客户端本地退出伪装

## WebSocket 消息层

见 `PROTOCOL.md`。

关键消息类型：

| 消息 | 方向 | 说明 |
|------|------|------|
| `AUTH` | C→S | 登录鉴权，携带手机号和 token |
| `JOIN_ROOM` | C→S | 加入/恢复房间 |
| `ROOM_STATE` | S→C | 整包房间状态广播（全量） |
| `GAME_ACTION` | C→S | 游戏操作（投票、选人、出牌等） |
| `CHAT` | C→S | 发言 |

## 运行时数据约定

- `server/*.sqlite*`：运行时数据，不进 git，迁移服务器时单独备份
- `.env`、`.env.production`：环境文件，不进 git
- `mobile/miniprogram/project.private.config.json`：本地私有配置，不进 git

## 最低维护标准

- 修改 WebSocket 协议时，同步更新 `PROTOCOL.md`
- 新增/修改环境变量时，同步更新 `RUNBOOK.md`
- 新增角色或勋章时，`server/constants.js` 与客户端 `ROLE_IMAGE_MAP` 必须同步
- 修改部署脚本时，注明适用环境和是否影响数据库
