# 工程结构与维护约定

## 当前结构

```text
avalon-online/
├── mobile/        Expo Web / React Native 客户端主工程
├── server/        Express + WebSocket 游戏服务
├── mobile_old/    旧版客户端备份，当前不建议继续开发
└── docs/          项目文档
```

## 当前代码状态

- `mobile/App.js` 是当前前端主入口，功能齐全但体量过大，后续应优先拆分。
- `server/index.js` 承担 HTTP 接口、WebSocket 协议、房间状态机和落库逻辑，属于关键文件。
- `server/ai.js` 负责 AI 发言、投票、复盘和记忆存储。
- `mobile/miniprogram/` 目前主要承载复用的勋章工具和小程序残留代码，建议后续重命名为更明确的目录。
- `mobile_old/` 是历史版本；除非明确要迁移旧逻辑，否则建议视为归档目录。

## 当前重连链路

- 服务端内存态使用 `rooms` 保存活跃房间，使用 `reconnectEntries` 保存断线后的临时保留记录。
- 服务端数据库中的 `active_rooms` / `active_room_players` 用于在进程重启后恢复真人玩家所在房间。
- 客户端会持久化 `authToken`、手机号和最近一次活动房号。
- `AUTH` 会先尝试恢复离线中的原玩家位；如果没有直接恢复成功，客户端会按保存的房号主动补发 `JOIN_ROOM`。
- `JOIN_ROOM` 现在不仅用于首次进房，也承担“同手机号接管原玩家位”的恢复职责。
- 前端房间界面由 `ROOM_STATE` 整包驱动，因此恢复逻辑的关键不是补发单独阶段通知，而是尽快重新建立房间状态同步。

## 建议的下一步拆分

### `mobile/`

建议先做最小拆分，不要一上来全面重构：

- `src/screens/`
  - 首页、房间页、历史页、统计页
- `src/components/`
  - 圆桌、座位卡片、角色面板、勋章面板、弹窗
- `src/lib/`
  - WebSocket 客户端、HTTP 请求、持久化
- `src/constants/`
  - 角色、阵营、勋章、UI 文案、规则说明
- `src/utils/`
  - 通用纯函数

第一阶段不要求改完全部引用，先把纯数据和纯工具移出 `App.js`。

### `server/`

建议按职责拆为：

- `src/http/`
  - 健康检查、微信登录接口
- `src/ws/`
  - 消息分发、连接管理
- `src/game/`
  - 房间状态机、角色分配、投票与任务结算
- `src/store/`
  - SQLite 访问
- `src/ai/`
  - AI 决策与记忆

## 运行时数据约定

- `server/*.sqlite*` 属于运行时数据，不应纳入版本控制。
- `mobile/dist/` 属于构建产物，不应纳入版本控制。
- `.env`、`.env.production` 属于环境文件，不应纳入版本控制。

## 提交流程建议

建议后续按下面粒度提交，避免一次改动覆盖太多语义：

1. `chore:` 工程整理、忽略规则、文档
2. `refactor:` 不改行为的文件拆分
3. `feat:` 新功能
4. `fix:` 行为修复

## 最低维护标准

- 修改协议时，同时更新 [PROTOCOL.md](/Users/chao/Documents/Projects/avalon-online/docs/PROTOCOL.md)。
- 修改环境变量时，同时更新根 `README.md` 和对应 `.env*.example`。
- 修改部署脚本时，注明适用环境和是否会同步数据库。
- 引入新角色、新勋章时，前后端常量必须同步调整。
