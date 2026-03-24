# Awalon Online

`awalon-online` 是一个阿瓦隆联机项目，当前由两个主工程组成：

- `mobile/`: Expo React Native 客户端，现阶段同时承担 Web 端部署
- `server/`: Express + WebSocket 服务端，包含 SQLite 持久化和 AI 逻辑

项目已经具备完整主流程，但代码仍处在“功能先行、工程待整理”的阶段。本文档以“接手维护”为目标，优先说明怎么运行、怎么部署、代码放在哪里、接下来该怎么收口。

## 当前完成度

截至 `2026-03-12`，主链路已具备：

- 登录和身份恢复
- 创建房间、加入房间、观战、选座
- 房主设置人数、发言时长和角色配置
- 发言阶段、组队、全员投票、任务执行、刺杀
- 历史对局、角色统计、勋章展示
- SQLite 持久化
- AI 发言 / 投票 / 复盘能力
- Web 部署脚本与服务端部署脚本

当前主要问题不是功能缺失，而是：

- 前端入口文件过大：`mobile/App.js`
- 服务端状态机和接口集中在单文件：`server/index.js`
- 运行时数据、环境文件、素材和代码边界还不够清晰
- git 提交历史不足，难以追踪演进

## 目录说明

```text
avalon-online/
├── mobile/        Expo 客户端主工程
├── server/        服务端主工程
├── mobile_old/    历史版本备份
└── docs/          补充文档
```

补充说明：

- `mobile/miniprogram/` 当前不是独立主工程，更像小程序残留代码和复用工具目录。
- `mobile_old/` 当前不建议继续开发，建议视为归档。

更细的工程说明见 [docs/ARCHITECTURE.md](/Users/chao/Documents/Projects/avalon-online/docs/ARCHITECTURE.md)。

## 本地开发

### 1. 启动服务端

```bash
cd /Users/chao/Documents/Projects/avalon-online/server
npm install
cp .env.example .env
npm start
```

默认端口为 `8080`，健康检查地址为 `http://localhost:8080/health`。

如果需要 AI 或微信登录能力，补齐 `.env` 中的对应变量。

### 2. 启动客户端

```bash
cd /Users/chao/Documents/Projects/avalon-online/mobile
npm install
npm start
```

默认行为：

- Web 端会根据当前页面地址推导 WebSocket 地址
- 原生端会优先读取 `EXPO_PUBLIC_WS_URL`
- 若未配置，会回退到 `ws://127.0.0.1:8080/ws`

生产 WebSocket 地址样例见 [mobile/.env.production.example](/Users/chao/Documents/Projects/avalon-online/mobile/.env.production.example)。

## 环境变量

### `server/.env`

最小可用：

```env
PORT=8080
```

可选项：

- `QWEN_API_KEY`
- `QWEN_MODEL`
- `QWEN_BASE_URL`
- `WX_APPID`
- `WX_APPSECRET`
- `RECONNECT_GRACE_MS`

样例见：

- [server/.env.example](/Users/chao/Documents/Projects/avalon-online/server/.env.example)
- [server/.env.production.example](/Users/chao/Documents/Projects/avalon-online/server/.env.production.example)

### `mobile/.env.production`

目前主要使用：

```env
EXPO_PUBLIC_WS_URL=ws://15.135.140.253/ws
```

注意：

- 上线时应改成 `wss://<your-domain>/ws`
- `.env` 与 `.env.production` 都不应提交到版本库

## 部署

### 部署服务端

```bash
cd /Users/chao/Documents/Projects/avalon-online/server
bash scripts/deploy.sh
```

脚本会通过 `rsync + ssh` 同步到远端；默认不同步 `*.sqlite*` 数据库文件。

如果需要同步数据库，需要显式使用 `--include-db`。

### 部署前端 Web

```bash
cd /Users/chao/Documents/Projects/avalon-online/mobile
bash scripts/deploy.sh --prod
```

该脚本会在远端执行：

- 安装依赖
- `expo export --platform web`
- 同步 `assets/` 到 `dist/mp-assets/`
- 使用 `pm2 + serve` 托管 `dist/`

## 协议与数据

服务端同时暴露：

- HTTP 接口：健康检查、微信登录
- WebSocket 协议：房间、对局、历史、统计

协议整理见 [docs/PROTOCOL.md](/Users/chao/Documents/Projects/avalon-online/docs/PROTOCOL.md)。

运行时数据说明：

- `server/users.sqlite*`: 用户与对局数据
- `server/ai.sqlite*`: AI 总结与记忆
- `mobile/dist/`: Web 构建产物

这些文件都属于运行时或构建产物，不应进入 git。

## 推荐的下一步整理顺序

1. 为 `mobile` 和 `server` 分别提交一次“当前可运行快照”。
2. 优先拆分 `mobile/App.js`，先抽常量、纯函数和网络层。
3. 把 `server/index.js` 的 HTTP、协议分发、状态机、落库逻辑拆开。
4. 给关键状态机补最基本测试：角色分配、投票、任务、刺杀、历史写入。
5. 保持文档同步更新，不再让协议和环境约定只存在代码里。

## 文档清单

- [docs/ARCHITECTURE.md](/Users/chao/Documents/Projects/avalon-online/docs/ARCHITECTURE.md)
- [docs/PROTOCOL.md](/Users/chao/Documents/Projects/avalon-online/docs/PROTOCOL.md)
- [docs/RUNBOOK.md](/Users/chao/Documents/Projects/avalon-online/docs/RUNBOOK.md)
