# 前后端协议说明

本文档描述 `mobile` 与 `server` 当前使用的主要接口和 WebSocket 消息。

## HTTP 接口

服务默认端口为 `8080`。

### `GET /health`

用途：健康检查。

返回：

```json
{ "ok": true }
```

### `POST /api/wx/openid-login`

用途：使用微信 `code` 换取 `openid`，并映射为伪手机号登录。

请求体：

```json
{
  "code": "wx-login-code",
  "nickname": "玩家昵称"
}
```

### `POST /api/wx/phone-login`

用途：使用微信手机号能力登录。

请求体：

```json
{
  "code": "wx-phone-code",
  "nickname": "玩家昵称"
}
```

## WebSocket 连接

默认路径：

- 本地：`ws://127.0.0.1:8080/ws`
- Web 部署：`ws(s)://<host>/ws`

前端会发送 JSON 消息，服务端按 `type` 分发。

## 核心消息类型

### 连接与身份

- `LOGIN`
  - 旧登录入口。
- `AUTH`
  - 使用已持久化身份恢复会话。
- `SET_PROFILE`
  - 修改昵称、头像等资料。
- `VIEW_ROLE`
  - 查看自己的身份信息。

### 房间管理

- `CREATE_ROOM`
  - 创建房间。
  - 支持可选字段 `ladyOfLakeEnabled`，仅 8 人及以上房间生效。
- `JOIN_ROOM`
  - 加入房间。
  - 如果同一手机号玩家已经在该房间内，服务端会优先接管原玩家席位，而不是按新玩家占位。
  - 该逻辑用于处理小程序切后台、误关程序、网络抖动后的回房恢复，避免误报“房间已满”。
- `LEAVE_ROOM`
  - 离开房间。
- `CHOOSE_SEAT`
  - 选择座位。
- `UPDATE_SETTINGS`
  - 房主更新人数、发言时长、角色配置。
  - 支持切换 `ladyOfLakeEnabled`，当人数小于 8 时服务端会自动关闭该选项。

### 对局流程

- `START_GAME`
  - 开始游戏。
- `RESET_GAME`
  - 重置当前房间。
- `REDEAL_IDENTITIES`
  - 重新发身份。
- `NEXT_SPEAKER`
  - 切到下一位发言。
- `HOST_SKIP_SPEAKER`
  - 房主跳过当前玩家发言。
- `HOST_SKIP_TO_VOTE`
  - 房主直接结束发言，进入投票阶段。
- `START_MISSION_PHASE`
  - 进入任务执行阶段。
- `PROPOSE_TEAM`
  - 队长提名队伍。
- `UPDATE_TEAM`
  - 调整队伍成员。
- `VOTE_TEAM`
  - 对队伍投票。
- `END_SPEAK`
  - 玩家结束发言。
- `EXECUTE_MISSION`
  - 上车玩家提交任务结果。
- `START_ASSASSINATION`
  - 进入刺杀阶段。
- `ASSASSINATE`
  - 刺客选择目标。
- `USE_LADY_OF_LAKE`
  - 湖中仙女持有者查验一名玩家阵营，并将标记传递给该玩家。
- `SPEAK`
  - 发送发言内容。

### 数据查询

- `GET_GAME_HISTORY_LIST`
  - 拉取历史对局列表。
- `GET_GAME_HISTORY_DETAIL`
  - 拉取单局详情。
- `GET_ROLE_STATS`
  - 拉取角色统计。

### 调试

- `CHEAT_REVEAL`
  - 调试用透视消息，生产环境建议禁用或加权限控制。

## 湖中仙女规则接入

- 仅 8 人及以上房间允许开启。
- 当前实现采用固定规则：在第 2、3、4 次任务结束后，若对局未结束，则进入 `lady` 阶段。
- 当前持有湖中仙女标记的玩家可以查验一名“未持有过该标记”的其他玩家阵营。
- 查验结果只私发给当前持有者，不会通过公共 `ROOM_STATE` 广播给全体玩家。
- 查验完成后，标记传递给被查验玩家，随后进入下一轮组队阶段。

## 状态同步建议

- 当前客户端以 `ROOM_STATE` 为主状态源，不依赖单独一条“进入投票阶段”消息驱动界面。
- 客户端在以下时机会主动尝试恢复房间：
  - WebSocket `AUTH` 成功但服务端未直接恢复房间时
  - 应用从后台切回前台时
- 服务端会在 `AUTH` 恢复或 `JOIN_ROOM` 回房时重新广播 `ROOM_STATE`，因此重连后的阶段切换、投票状态、任务状态都应以最新 `ROOM_STATE` 为准。
- 前端新增消息类型时，先更新服务端分发，再更新本文档。
- 消息体字段应尽量保持向后兼容，避免直接改字段名。
- 与结算有关的消息优先补服务端单测，因为这类改动最容易引入回归。
