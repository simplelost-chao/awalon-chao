# 运行与部署手册

## 本地启动

### 服务端

```bash
cd /Users/chao/Documents/Projects/avalon-online/server
npm install
cp .env.example .env
npm start
```

默认端口：`8080`

健康检查：

```bash
curl http://127.0.0.1:8080/health
```

### 客户端

```bash
cd /Users/chao/Documents/Projects/avalon-online/mobile
npm install
npm start
```

## 常见环境变量

### 服务端

- `PORT`: HTTP / WebSocket 端口
- `QWEN_API_KEY`: AI 能力密钥
- `QWEN_MODEL`: AI 模型名
- `QWEN_BASE_URL`: AI 接口地址
- `WX_APPID`: 微信小程序 AppID
- `WX_APPSECRET`: 微信小程序密钥
- `RECONNECT_GRACE_MS`: 断线重连保留时长。玩家断线后会先保留原席位，在该时间窗内允许同手机号重新接管原玩家位。

### 客户端

- `EXPO_PUBLIC_WS_URL`: 原生端优先使用的 WebSocket 地址

## 部署命令

### 服务端同步

```bash
cd /Users/chao/Documents/Projects/avalon-online/server
bash scripts/deploy.sh
```

常用参数：

- `--include-db`: 同步 SQLite 数据库
- `--no-delete`: 不删除远端多余文件
- `--remote-cmd "<cmd>"`: 同步后执行远端命令

### 前端 Web 部署

```bash
cd /Users/chao/Documents/Projects/avalon-online/mobile
bash scripts/deploy.sh --prod
```

该命令会在远端完成构建并使用 `pm2` 托管静态站点。

## 数据文件

服务端运行时数据：

- `users.sqlite*`
- `ai.sqlite*`

处理原则：

- 默认不进 git
- 默认不随服务端部署脚本同步
- 迁移服务器时，单独备份和恢复

## 发布前检查

建议每次发布前至少确认：

1. `.env` 和 `.env.production` 没有被提交。
2. 服务端 `/health` 正常。
3. 客户端 WebSocket 地址指向正确环境。
4. 若修改了协议，已同步更新 [PROTOCOL.md](/Users/chao/Documents/Projects/avalon-online/docs/PROTOCOL.md)。
5. 若修改了部署行为，已同步更新本手册。

## 断线重连说明

- 服务端会把真人玩家房间映射持久化到 SQLite，并在断线后保留原席位一段时间。
- 同一手机号重新进入同一房间时，优先恢复原玩家位，不应因为旧连接残留而误报“房间已满”。
- 客户端会保存最近一次活动房号，并在前台恢复或鉴权成功后主动补发回房请求。
- 当前前端界面主要由 `ROOM_STATE` 驱动，所以只要恢复成功，玩家应直接看到当前阶段，包括投票、任务或刺杀。

## 断线问题排查

如果用户反馈“切后台后回不来”或“提示房间已满”，建议按这个顺序排查：

1. 确认服务端已部署包含重连接管修复的版本，而不是旧版本。
2. 确认用户是用同一个手机号重新登录，而不是换了身份。
3. 检查服务端 `RECONNECT_GRACE_MS` 是否过短，导致玩家位已被清理。
4. 观察服务端日志中是否出现 `JOIN_ROOM`、`AUTH`、`RECOVERED` 相关记录，但没有后续 `ROOM_STATE` 广播。
5. 如果用户已成功恢复房间但仍看不到投票按钮，优先怀疑客户端没有收到最新 `ROOM_STATE`，而不是单独的“投票通知”丢失。

## 当前已知工程债

- `mobile/App.js` 文件过大，后续需拆分。
- `server/index.js` 同时承载协议和状态机，后续需分层。
- 顶层目录还不是正式 git 仓库，当前主要以 `mobile/` 为 git 边界。
