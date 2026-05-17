# 对局复盘

## 概述

在历史对战详情页加"复盘"按钮，进入上帝视角复盘模式——所有人身份全部揭示，逐轮回看每次组队、投票、任务的决策过程。

## 入口

历史对战详情页（subpkg/history-detail）顶部加"复盘"按钮，点击跳转到复盘页面，传 gameId。

## 复盘页面结构

### 顶部：身份一览

- 横向滚动，所有玩家：座位号 + 头像 + 昵称 + 角色名 + 角色立绘
- 好人蓝色边框，坏人红色边框，梅林紫色边框
- 始终可见，不随翻页滚动

### 中部：轮次卡片（左右翻页）

用 swiper 组件左右滑动切换，每轮一张卡片。

**每张卡片包含：**

1. **轮次标题**：第N轮 · 第M次组队
2. **队长**：头像 + 昵称 + 阵营色标记
3. **队伍**：被选中的队员（头像+座位号），用阵营颜色标注——一眼看出队伍里有没有坏人
4. **投票结果**：
   - 每个玩家一行：座位号 + 头像 + 昵称 + 赞成/反对 + 阵营颜色底
   - 统计：N赞成 / M反对 → 通过/否决
5. **任务结果**（如果队伍通过了）：
   - 成功票 / 失败票数量
   - 任务成功/失败
   - 每个队员的出牌（成功/失败），用阵营色——坏人出成功票=藏票，出失败票=破坏

### 最后一张：结局卡片

- 刺杀阶段：刺客选了谁，命中/未命中
- 最终胜负：好人胜利 / 邪恶胜利
- 结束原因

## 数据来源

全部来自 `game_records.payload` JSON，已有字段：
- `players`：所有人身份
- `voteHistory`：每轮投票记录
- `missionHistory`：每轮任务记录
- `assassination`：刺杀数据
- `winner`：胜负
- `endReason`：结束原因

不需要新增 API——复用现有的 `GET_GAME_HISTORY_DETAIL` 返回的 payload。

## 文件结构

### 新增
- `mobile/miniprogram/subpkg/replay/index/index.js` — 页面逻辑
- `mobile/miniprogram/subpkg/replay/index/index.wxml` — 模板
- `mobile/miniprogram/subpkg/replay/index/index.wxss` — 样式
- `mobile/miniprogram/subpkg/replay/index/index.json` — 页面声明

### 修改
- `mobile/miniprogram/app.json` — 注册 replay 页面
- `mobile/miniprogram/subpkg/history-detail/index/index.wxml` — 加"复盘"按钮
- `mobile/miniprogram/subpkg/history-detail/index/index.js` — 复盘跳转方法

## 不做的事

- 不做自动播放/播放器控制
- 不做发言回放（文字太多，棋谱模式不适合）
- 不做动画效果
- 不需要新 API
