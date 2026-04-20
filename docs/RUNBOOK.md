# 运行与部署手册

## 本地启动

### 服务端

```bash
cd /Users/chao/Documents/Projects/awalon-chao/server
npm install
cp .env.example .env   # 填写必要变量后启动
node index.js
```

默认端口：`8080`

健康检查：

```bash
curl https://www.awalon.top/health
```

### 客户端

用微信开发者工具打开 `mobile/miniprogram/`，导入为小程序项目，AppID 填写正式 AppID 即可本地预览。

## 环境变量（服务端）

| 变量 | 说明 |
|------|------|
| `PORT` | HTTP / WebSocket 监听端口，默认 8080 |
| `REVIEW_MODE` | 启动时默认模式，`true` = 审核伪装模式，缺省或其他值 = 游戏模式 |
| `ADMIN_KEY` | Admin 接口鉴权密钥，不设则 admin 接口全部返回 403 |
| `QWEN_API_KEY` | AI 能力（通义千问）密钥 |
| `QWEN_MODEL` | AI 模型名 |
| `QWEN_BASE_URL` | AI 接口地址 |
| `WX_APPID` | 微信小程序 AppID |
| `WX_APPSECRET` | 微信小程序密钥 |
| `RECONNECT_GRACE_MS` | 断线重连保留时长（毫秒），窗口内允许同手机号接管原席位 |

## 审核模式（Review Mode）

小程序提交微信审核时，需要对审核员展示一个"合规"的界面而非真实游戏。

### 工作原理

```
小程序启动
  └─ GET /api/review-mode
       ├─ { reviewMode: true }  → 渲染 review-page 组件（伪装成发牌工具）
       └─ { reviewMode: false } → 正常进入游戏首页
```

`runtimeReviewMode` 是服务端内存变量，启动时由环境变量初始化：

```js
let runtimeReviewMode = process.env.REVIEW_MODE === 'true';
```

### 切换方式

**方式一：Admin 接口（立即生效，不需重启）**

```bash
# 切换到审核模式
curl -X POST "https://www.awalon.top/api/admin/set-mode?key=<ADMIN_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"review"}'

# 切换到游戏模式
curl -X POST "https://www.awalon.top/api/admin/set-mode?key=<ADMIN_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"game"}'
```

**方式二：修改环境变量（需重启服务器）**

在服务器平台修改 `REVIEW_MODE=true/false` 后，触发重新部署即可。

### Admin 面板

访问 `https://www.awalon.top/admin?key=<ADMIN_KEY>` 可通过网页直接切换，无需手动调用接口。

### review-page 组件彩蛋

`review-page` 组件内有一个隐藏入口：长按"企业破冰"卡片 1 秒，即可退出审核伪装，进入正常游戏界面。触发后客户端本地切换 `reviewMode: false`，不影响服务端状态。

## 部署

### 服务端

```bash
cd /Users/chao/Documents/Projects/awalon-chao
bash mobile/scripts/mp-deploy.js   # 小程序发布
```

服务端直接 rsync 到 `awalon.top`（SSH 已配置，直接运行部署命令）。

### 发布前检查

1. `.env` 未被提交
2. `GET /health` 正常
3. 小程序 `app.js` 中 `wsUrl` / `apiBase` 指向正式域名
4. 若修改了协议，同步更新 `PROTOCOL.md`
5. 若新增环境变量，同步更新本手册

## 断线重连说明

- 服务端将真人玩家房间映射持久化到 SQLite，断线后保留原席位一段时间（由 `RECONNECT_GRACE_MS` 控制）。
- 同一手机号重新进入同一房间时，优先恢复原玩家位。
- 客户端保存最近一次活动房号，鉴权成功后主动补发回房请求。
- 前端界面由 `ROOM_STATE` 整包驱动，恢复成功后玩家直接看到当前阶段。

## 断线问题排查

1. 确认服务端已部署包含重连修复的版本。
2. 确认用户用同一手机号重新登录。
3. 检查 `RECONNECT_GRACE_MS` 是否过短。
4. 查看服务端日志中 `JOIN_ROOM`、`AUTH`、`RECOVERED` 相关记录。
5. 如用户已恢复房间但看不到按钮，优先怀疑客户端未收到最新 `ROOM_STATE`。
