# 统计增强：能力雷达 + 搭档分析 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在统计页新增能力雷达图（好人/坏人各 6 维）和搭档分析（6 称号 + 配对矩阵），页面重构为首页概览+Tab 细分布局。

**Architecture:** 服务端在 `history.js` 新增 `_buildRadar` 和 `_buildPartners` 函数，遍历玩家历史对局 payload 计算维度分数和搭档数据。前端统计页拆成首页（概览+雷达+搭档）+ Tab（角色胜率+勋章）。雷达图用小程序 Canvas 2D 绘制。

**Tech Stack:** Node.js (server), WeChat miniprogram (client), Canvas 2D, SQLite (better-sqlite3)

---

## 文件结构

### 服务端
- **修改** `server/history.js` — 新增 `_buildRadar(phone, excludeAI)` 和 `_buildPartners(phone, excludeAI)`，扩展 `_buildStats` 返回值
- **创建** `server/stats-radar.js` — 雷达图计算逻辑（从 payload 提取 6 维分数）
- **创建** `server/stats-partners.js` — 搭档分析计算逻辑（称号 + 矩阵）

### 客户端
- **修改** `mobile/miniprogram/subpkg/role-stats/index/index.js` — 新增 tab 切换、雷达数据绑定、搭档数据绑定、Canvas 绑定
- **修改** `mobile/miniprogram/subpkg/role-stats/index/index.wxml` — 重构为首页+Tab 布局，新增雷达、称号、矩阵模板
- **修改** `mobile/miniprogram/subpkg/role-stats/index/index.wxss` — 新增雷达、称号、矩阵、Tab 样式
- **创建** `mobile/miniprogram/subpkg/role-stats/index/radar.js` — Canvas 雷达图绘制函数

---

## Task 1: 服务端 — 雷达图计算引擎

**Files:**
- Create: `server/stats-radar.js`

- [ ] **Step 1: 创建 stats-radar.js 文件，实现 buildRadar 函数**

```javascript
// server/stats-radar.js
const { userDb } = require('./db');

const ROLE_FACTIONS = {
  梅林: 'good', 派西维尔: 'good', 忠臣: 'good', '亚瑟的忠臣': 'good', '兰斯洛特（正义）': 'good',
  刺客: 'evil', 莫甘娜: 'evil', 莫德雷德: 'evil', 奥伯伦: 'evil', 爪牙: 'evil', '兰斯洛特（邪恶）': 'evil',
};

function buildRadar(phone, excludeAI) {
  const gpFilter = excludeAI
    ? `AND NOT EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id = gp.game_id AND ai.is_ai = 1)`
    : `AND EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id = gp.game_id AND ai.is_ai = 1)`;

  // 查询该玩家最近100局的 game_id + role + result
  const gameRows = userDb.prepare(
    `SELECT gp.game_id, gp.role, gp.result, gr.payload
     FROM game_participants gp
     JOIN game_records gr ON gr.id = gp.game_id
     WHERE gp.phone = ? AND gp.role != '观战' AND COALESCE(gr.status,'completed') = 'completed'
     ${gpFilter}
     ORDER BY gr.ended_at DESC LIMIT 100`
  ).all(phone);

  // 好人维度累加器
  const good = {
    recognition: { hit: 0, total: 0 },       // 识人能力
    leadership: { hit: 0, total: 0 },         // 领袖力
    trustworthiness: { hit: 0, total: 0 },    // 表水能力
    shield: { hit: 0, total: 0 },             // 挡刀能力
    dodge: { hit: 0, total: 0 },              // 躲刀能力
    winRate: { wins: 0, total: 0 },           // 好人胜率
  };

  // 坏人维度累加器
  const evil = {
    charge: { hit: 0, total: 0 },             // 冲锋能力
    stealth: { hit: 0, total: 0 },            // 隐秘性
    trustworthiness: { hit: 0, total: 0 },    // 表水能力
    assassination: { hit: 0, total: 0 },      // 刺杀能力
    destruction: { hit: 0, total: 0 },        // 破坏力
    winRate: { wins: 0, total: 0 },           // 坏人胜率
  };

  for (const row of gameRows) {
    let payload;
    try { payload = JSON.parse(row.payload); } catch (_) { continue; }
    if (!payload || !payload.players) continue;

    const myRole = row.role;
    const myFaction = ROLE_FACTIONS[myRole] || 'good';
    const isWin = row.result === 'win';

    // 建立 playerId -> faction/role 映射
    const playerById = {};
    for (const p of payload.players) {
      if (p.id) playerById[p.id] = { role: p.role, faction: p.faction || ROLE_FACTIONS[p.role] || 'good' };
    }

    // 找到自己的 playerId
    const me = payload.players.find(p => p.phone === phone && p.role === myRole);
    if (!me) continue;
    const myId = me.id;

    const voteHistory = payload.voteHistory || [];
    const missionHistory = payload.missionHistory || [];
    const assassination = payload.assassination || null;

    if (myFaction === 'good') {
      good.winRate.total++;
      if (isWin) good.winRate.wins++;

      // 识人能力：非梅林时，含坏人队伍投反对的比例
      if (myRole !== '梅林') {
        for (const v of voteHistory) {
          if (!v.votes || v.votes[myId] === undefined) continue;
          const teamHasEvil = (v.team || []).some(id => playerById[id] && playerById[id].faction === 'evil');
          if (teamHasEvil) {
            good.recognition.total++;
            if (!v.votes[myId]) good.recognition.hit++; // 投了反对
          }
        }
      }

      // 领袖力：当队长时发车成功率
      for (const v of voteHistory) {
        if (v.leaderId === myId) {
          good.leadership.total++;
          if (v.approved) good.leadership.hit++;
        }
      }

      // 表水能力：非队长时被选入队伍的频率
      for (const v of voteHistory) {
        if (v.leaderId !== myId && v.approved) {
          good.trustworthiness.total++;
          if ((v.team || []).includes(myId)) good.trustworthiness.hit++;
        }
      }

      // 挡刀能力：非梅林时被刺客选为刺杀目标
      if (myRole !== '梅林' && assassination && assassination.targetId) {
        good.shield.total++;
        if (assassination.targetId === myId) good.shield.hit++;
      }

      // 躲刀能力：梅林时没被刺杀
      if (myRole === '梅林' && assassination) {
        good.dodge.total++;
        if (!assassination.hit) good.dodge.hit++;
      }

    } else {
      evil.winRate.total++;
      if (isWin) evil.winRate.wins++;

      // 冲锋能力：通过的队伍中含其他坏人队友
      for (const v of voteHistory) {
        if (!v.approved) continue;
        const team = v.team || [];
        if (!team.includes(myId)) continue;
        const otherEvil = team.filter(id => id !== myId && playerById[id] && playerById[id].faction === 'evil');
        if (otherEvil.length > 0) evil.charge.hit++;
        evil.charge.total++;
      }

      // 隐秘性：在队伍中出成功票（不暴露）的比例
      for (const m of missionHistory) {
        if (!(m.team || []).includes(myId)) continue;
        const mv = m.missionVotes || {};
        if (mv[myId] !== undefined) {
          evil.stealth.total++;
          if (!mv[myId]) evil.stealth.hit++; // false = 出成功票（藏票）
        }
      }

      // 表水能力：非队长时自己上车
      for (const v of voteHistory) {
        if (v.leaderId !== myId && v.approved) {
          evil.trustworthiness.total++;
          if ((v.team || []).includes(myId)) evil.trustworthiness.hit++;
        }
      }

      // 刺杀能力：刺客时刺中梅林
      if (myRole === '刺客' && assassination) {
        evil.assassination.total++;
        if (assassination.hit) evil.assassination.hit++;
      }

      // 破坏力：出失败票且任务确实失败
      for (const m of missionHistory) {
        if (!(m.team || []).includes(myId)) continue;
        const mv = m.missionVotes || {};
        if (mv[myId]) { // true = 出失败票
          evil.destruction.total++;
          if (!m.success) evil.destruction.hit++;
        }
      }
    }
  }

  function score(acc) {
    if (acc.total !== undefined) {
      if (acc.total < 3) return -1; // 样本不足
      return Math.round((acc.hit / acc.total) * 100);
    }
    if (acc.wins !== undefined) {
      if (acc.total < 3) return -1;
      return Math.round((acc.wins / acc.total) * 100);
    }
    return -1;
  }

  return {
    good: {
      recognition: score(good.recognition),
      leadership: score(good.leadership),
      trustworthiness: score(good.trustworthiness),
      shield: score(good.shield),
      dodge: score(good.dodge),
      winRate: score(good.winRate),
    },
    evil: {
      charge: score(evil.charge),
      stealth: score(evil.stealth),
      trustworthiness: score(evil.trustworthiness),
      assassination: score(evil.assassination),
      destruction: score(evil.destruction),
      winRate: score(evil.winRate),
    },
  };
}

module.exports = { buildRadar };
```

- [ ] **Step 2: 提交**

```bash
git add server/stats-radar.js
git commit -m "feat(stats): add radar chart calculation engine"
```

---

## Task 2: 服务端 — 搭档分析计算引擎

**Files:**
- Create: `server/stats-partners.js`

- [ ] **Step 1: 创建 stats-partners.js 文件**

```javascript
// server/stats-partners.js
const { userDb } = require('./db');

const ROLE_FACTIONS = {
  梅林: 'good', 派西维尔: 'good', 忠臣: 'good', '亚瑟的忠臣': 'good', '兰斯洛特（正义）': 'good',
  刺客: 'evil', 莫甘娜: 'evil', 莫德雷德: 'evil', 奥伯伦: 'evil', 爪牙: 'evil', '兰斯洛特（邪恶）': 'evil',
};

function buildPartners(phone, excludeAI) {
  const gpFilter = excludeAI
    ? `AND NOT EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id = gp.game_id AND ai.is_ai = 1)`
    : `AND EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id = gp.game_id AND ai.is_ai = 1)`;

  const gameRows = userDb.prepare(
    `SELECT gp.game_id, gp.role, gp.result, gr.payload
     FROM game_participants gp
     JOIN game_records gr ON gr.id = gp.game_id
     WHERE gp.phone = ? AND gp.role != '观战' AND COALESCE(gr.status,'completed') = 'completed'
     ${gpFilter}
     ORDER BY gr.ended_at DESC LIMIT 100`
  ).all(phone);

  // partnerPhone -> 统计数据
  const partnerMap = {};

  for (const row of gameRows) {
    let payload;
    try { payload = JSON.parse(row.payload); } catch (_) { continue; }
    if (!payload || !payload.players) continue;

    const myRole = row.role;
    const myFaction = ROLE_FACTIONS[myRole] || 'good';
    const isWin = row.result === 'win';

    for (const p of payload.players) {
      if (!p.phone || p.phone === phone || p.role === '观战') continue;
      const theirFaction = ROLE_FACTIONS[p.role] || p.faction || 'good';
      const sameTeam = myFaction === theirFaction;

      if (!partnerMap[p.phone]) {
        partnerMap[p.phone] = {
          phone: p.phone,
          nickname: p.nickname || '玩家',
          avatar: p.avatar || '',
          totalGames: 0,
          sameTeam: { games: 0, wins: 0 },
          sameGood: { games: 0, wins: 0 },
          sameEvil: { games: 0, wins: 0 },
          opponent: { games: 0, wins: 0 },
          combos: {},
        };
      }

      const partner = partnerMap[p.phone];
      // 更新昵称/头像为最新
      partner.nickname = p.nickname || partner.nickname;
      if (p.avatar) partner.avatar = p.avatar;
      partner.totalGames++;

      if (sameTeam) {
        partner.sameTeam.games++;
        if (isWin) partner.sameTeam.wins++;
        if (myFaction === 'good') {
          partner.sameGood.games++;
          if (isWin) partner.sameGood.wins++;
        } else {
          partner.sameEvil.games++;
          if (isWin) partner.sameEvil.wins++;
        }
      } else {
        partner.opponent.games++;
        if (isWin) partner.opponent.wins++;
      }

      const comboKey = `${myRole}+${p.role}`;
      if (!partner.combos[comboKey]) partner.combos[comboKey] = { myRole, theirRole: p.role, games: 0, wins: 0 };
      partner.combos[comboKey].games++;
      if (isWin) partner.combos[comboKey].wins++;
    }
  }

  // 补全真实头像（payload 里旧记录可能没头像）
  const phones = Object.keys(partnerMap);
  if (phones.length) {
    const placeholders = phones.map(() => '?').join(',');
    const userRows = userDb.prepare(`SELECT phone, avatar, nickname FROM users WHERE phone IN (${placeholders})`).all(...phones);
    for (const u of userRows) {
      if (partnerMap[u.phone]) {
        if (u.avatar && !partnerMap[u.phone].avatar) partnerMap[u.phone].avatar = u.avatar;
        if (u.nickname) partnerMap[u.phone].nickname = u.nickname;
      }
    }
  }

  const matrix = Object.values(partnerMap)
    .filter(p => p.totalGames >= 1)
    .map(p => {
      const topCombos = Object.values(p.combos)
        .sort((a, b) => b.games - a.games)
        .slice(0, 3)
        .map(c => ({ myRole: c.myRole, theirRole: c.theirRole, games: c.games, wins: c.wins }));
      return {
        phone: p.phone,
        nickname: p.nickname,
        avatar: p.avatar,
        totalGames: p.totalGames,
        sameTeam: { ...p.sameTeam, winRate: p.sameTeam.games > 0 ? Math.round(p.sameTeam.wins / p.sameTeam.games * 1000) / 10 : 0 },
        sameGood: { ...p.sameGood, winRate: p.sameGood.games > 0 ? Math.round(p.sameGood.wins / p.sameGood.games * 1000) / 10 : 0 },
        sameEvil: { ...p.sameEvil, winRate: p.sameEvil.games > 0 ? Math.round(p.sameEvil.wins / p.sameEvil.games * 1000) / 10 : 0 },
        opponent: { ...p.opponent, winRate: p.opponent.games > 0 ? Math.round(p.opponent.wins / p.opponent.games * 1000) / 10 : 0 },
        topCombos,
      };
    })
    .sort((a, b) => b.totalGames - a.totalGames);

  // 计算称号
  const MIN_SAME = 3;
  const MIN_MERLIN_PERCI = 2;

  function bestBy(arr, field, min) {
    const candidates = arr.filter(p => p[field].games >= min);
    if (!candidates.length) return null;
    candidates.sort((a, b) => b[field].winRate - a[field].winRate || b[field].games - a[field].games);
    return candidates[0];
  }
  function worstBy(arr, field, min) {
    const candidates = arr.filter(p => p[field].games >= min);
    if (!candidates.length) return null;
    candidates.sort((a, b) => a[field].winRate - b[field].winRate || b[field].games - a[field].games);
    return candidates[0];
  }

  // 最佳梅林&派西：在 combos 里找 梅林+派西维尔 或 派西维尔+梅林
  let bestMerlinPerci = null;
  {
    const candidates = [];
    for (const p of matrix) {
      const combos = Object.values(p.combos || {});
      let mpGames = 0, mpWins = 0;
      for (const c of combos) {
        if ((c.myRole === '梅林' && c.theirRole === '派西维尔') || (c.myRole === '派西维尔' && c.theirRole === '梅林')) {
          mpGames += c.games;
          mpWins += c.wins;
        }
      }
      if (mpGames >= MIN_MERLIN_PERCI) {
        candidates.push({ ...p, mpGames, mpWins, mpWinRate: Math.round(mpWins / mpGames * 1000) / 10 });
      }
    }
    if (candidates.length) {
      candidates.sort((a, b) => b.mpWinRate - a.mpWinRate || b.mpGames - a.mpGames);
      bestMerlinPerci = candidates[0];
    }
  }

  // 天生冤家：对面阵营时我胜率最低
  let nemesis = null;
  {
    const candidates = matrix.filter(p => p.opponent.games >= MIN_SAME);
    if (candidates.length) {
      candidates.sort((a, b) => a.opponent.winRate - b.opponent.winRate || b.opponent.games - a.opponent.games);
      nemesis = candidates[0];
    }
  }

  function titleCard(type, partner, field) {
    if (!partner) return { type, phone: null, nickname: null, avatar: null, winRate: 0, games: 0 };
    const data = field ? partner[field] : partner;
    return {
      type,
      phone: partner.phone,
      nickname: partner.nickname,
      avatar: partner.avatar,
      winRate: data.winRate !== undefined ? data.winRate : (data.mpWinRate || 0),
      games: data.games !== undefined ? data.games : (data.mpGames || 0),
    };
  }

  const golden = bestBy(matrix, 'sameTeam', MIN_SAME);
  const bestWolf = bestBy(matrix, 'sameEvil', MIN_SAME);
  const bestKnight = bestBy(matrix, 'sameGood', MIN_SAME);
  const worstTeammate = worstBy(matrix, 'sameTeam', MIN_SAME);

  const titles = [
    titleCard('golden', golden, 'sameTeam'),
    titleCard('bestWolf', bestWolf, 'sameEvil'),
    titleCard('bestKnight', bestKnight, 'sameGood'),
    titleCard('bestMerlinPerci', bestMerlinPerci, null),
    titleCard('nemesis', nemesis, 'opponent'),
    titleCard('worstTeammate', worstTeammate, 'sameTeam'),
  ];

  return { titles, matrix };
}

module.exports = { buildPartners };
```

- [ ] **Step 2: 提交**

```bash
git add server/stats-partners.js
git commit -m "feat(stats): add partner analysis calculation engine"
```

---

## Task 3: 服务端 — 集成到 history.js API

**Files:**
- Modify: `server/history.js`

- [ ] **Step 1: 在 history.js 中引入新模块并扩展 _buildStats**

在文件顶部 require 之后添加：

```javascript
const { buildRadar } = require('./stats-radar');
const { buildPartners } = require('./stats-partners');
```

修改 `_buildStats` 函数，在 return 语句前添加 radar 和 partners：

```javascript
// 在 _buildStats 函数的 return 语句中添加两个字段
function _buildStats(phone, excludeAI) {
  // ... 现有代码不变 ...
  
  const radar = buildRadar(phone, excludeAI);
  const partners = buildPartners(phone, excludeAI);
  
  return { totalGames, totalWins, overallWinRate, byRole, medals, totalMedals, recentGames, streakType, streakCount, radar, partners };
}
```

- [ ] **Step 2: 部署并验证**

```bash
scp server/stats-radar.js server/stats-partners.js server/history.js awalon:/opt/avalon-online/server/
ssh awalon "pm2 restart avalon-server"
ssh awalon "pm2 logs avalon-server --lines 5 --nostream"
```

- [ ] **Step 3: 提交**

```bash
git add server/history.js server/stats-radar.js server/stats-partners.js
git commit -m "feat(stats): integrate radar and partner APIs into stats response"
```

---

## Task 4: 客户端 — Canvas 雷达图绘制函数

**Files:**
- Create: `mobile/miniprogram/subpkg/role-stats/index/radar.js`

- [ ] **Step 1: 创建雷达图绘制模块**

```javascript
// mobile/miniprogram/subpkg/role-stats/index/radar.js

const GOOD_LABELS = ['识人能力', '领袖力', '表水能力', '挡刀能力', '躲刀能力', '好人胜率'];
const EVIL_LABELS = ['冲锋能力', '隐秘性', '表水能力', '刺杀能力', '破坏力', '坏人胜率'];
const GOOD_KEYS = ['recognition', 'leadership', 'trustworthiness', 'shield', 'dodge', 'winRate'];
const EVIL_KEYS = ['charge', 'stealth', 'trustworthiness', 'assassination', 'destruction', 'winRate'];

function drawRadar(ctx, data, faction, size) {
  const labels = faction === 'good' ? GOOD_LABELS : EVIL_LABELS;
  const keys = faction === 'good' ? GOOD_KEYS : EVIL_KEYS;
  const n = 6;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const dpr = wx.getWindowInfo().pixelRatio || 2;

  ctx.clearRect(0, 0, size * dpr, size * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);

  const angleStep = (Math.PI * 2) / n;
  const startAngle = -Math.PI / 2; // 从顶部开始

  function getPoint(i, r) {
    const angle = startAngle + i * angleStep;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  // 绘制网格背景（3层）
  for (let level = 1; level <= 3; level++) {
    const r = radius * (level / 3);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = getPoint(i, r);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // 绘制轴线
  for (let i = 0; i < n; i++) {
    const p = getPoint(i, radius);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // 绘制数据区域
  const color = faction === 'good' ? { r: 78, g: 158, b: 255 } : { r: 220, g: 80, b: 80 };
  ctx.beginPath();
  let hasData = false;
  for (let i = 0; i < n; i++) {
    const val = data[keys[i]];
    const v = val >= 0 ? val / 100 : 0;
    if (val >= 0) hasData = true;
    const p = getPoint(i, radius * Math.max(v, 0.05));
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},0.25)`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},0.8)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 绘制数据点
  for (let i = 0; i < n; i++) {
    const val = data[keys[i]];
    const v = val >= 0 ? val / 100 : 0;
    const p = getPoint(i, radius * Math.max(v, 0.05));
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = val >= 0 ? `rgb(${color.r},${color.g},${color.b})` : 'rgba(255,255,255,0.3)';
    ctx.fill();
  }

  // 绘制标签 + 分数
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const labelR = radius + 28;
    const p = getPoint(i, labelR);
    const val = data[keys[i]];

    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(labels[i], p.x, p.y - 7);

    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = val >= 0 ? `rgb(${color.r},${color.g},${color.b})` : 'rgba(255,255,255,0.3)';
    ctx.fillText(val >= 0 ? val.toString() : '—', p.x, p.y + 8);
  }

  ctx.restore();
}

module.exports = { drawRadar };
```

- [ ] **Step 2: 提交**

```bash
git add mobile/miniprogram/subpkg/role-stats/index/radar.js
git commit -m "feat(stats): add Canvas radar chart drawing module"
```

---

## Task 5: 客户端 — 页面重构：首页+Tab 布局 (WXML)

**Files:**
- Modify: `mobile/miniprogram/subpkg/role-stats/index/index.wxml`

- [ ] **Step 1: 重构 WXML，将现有角色统计和勋章放入 tab，首页新增雷达和搭档**

用以下内容完全替换 index.wxml 中 `<block wx:if="{{!loading && roleStats}}">` 到对应 `</block>` 之间的内容（约 line 65~221），保留之前的导航栏、用户资料、loading 状态部分不变：

```xml
    <block wx:if="{{!loading && roleStats}}">

      <!-- ── 近期战绩 + 连胜 + 阵营对比（保持不变） ── -->
      <view class="pf rs-section">
        <view class="fb fb-top"></view><view class="fb fb-bottom"></view>
        <view class="fb fb-left"></view><view class="fb fb-right"></view>
        <view class="fb fb-ctl"></view><view class="fb fb-ctr"></view>
        <view class="fb fb-cbl"></view><view class="fb fb-cbr"></view>
        <view class="fc-inner fc-tl"></view><view class="fc-inner fc-tr"></view>
        <view class="fc-inner fc-bl"></view><view class="fc-inner fc-br"></view>

        <view class="ov-recent-streak">
          <view class="ov-streak-inline" wx:if="{{streakType}}">
            <view class="ov-streak-icon {{streakType === 'win' ? 'ov-streak-win' : 'ov-streak-lose'}}">
              <view class="ov-streak-arrow"></view>
            </view>
            <text class="ov-streak-text {{streakType === 'win' ? 'ov-num-gold' : 'ov-num-red'}}">{{streakType === 'win' ? '连胜' : '连败'}} {{streakCount}}</text>
          </view>
          <view class="ov-recent" wx:if="{{recentGames.length}}">
            <text class="ov-recent-label">近期战绩</text>
            <text class="recent-row">{{recentDotsText}}</text>
          </view>
        </view>

        <view class="ov-faction">
          <view class="ov-faction-pair">
            <view class="ov-faction-col">
              <text class="ov-faction-name good">正义</text>
              <text class="ov-faction-rate good">{{goodSummary.winRate}}%</text>
              <text class="ov-faction-detail good">{{goodSummary.wins}}胜 / {{goodSummary.total}}局</text>
            </view>
            <view class="ov-faction-sep"></view>
            <view class="ov-faction-col">
              <text class="ov-faction-name evil">邪恶</text>
              <text class="ov-faction-rate evil">{{evilSummary.winRate}}%</text>
              <text class="ov-faction-detail evil">{{evilSummary.wins}}胜 / {{evilSummary.total}}局</text>
            </view>
          </view>
        </view>
      </view>

      <!-- ── 能力雷达 ── -->
      <view class="pf rs-section">
        <view class="fb fb-top"></view><view class="fb fb-bottom"></view>
        <view class="fb fb-left"></view><view class="fb fb-right"></view>
        <view class="fb fb-ctl"></view><view class="fb fb-ctr"></view>
        <view class="fb fb-cbl"></view><view class="fb fb-cbr"></view>
        <view class="fc-inner fc-tl"></view><view class="fc-inner fc-tr"></view>
        <view class="fc-inner fc-bl"></view><view class="fc-inner fc-br"></view>

        <view class="rs-title-row">
          <view class="rs-title-line"></view>
          <text class="rs-deco">◆</text>
          <text class="rs-title">能力雷达</text>
          <text class="rs-deco">◆</text>
          <view class="rs-title-line"></view>
        </view>

        <view class="radar-faction-tabs">
          <view class="radar-tab {{radarFaction === 'good' ? 'radar-tab-active-good' : ''}}" bindtap="onSwitchRadar" data-faction="good">正义</view>
          <view class="radar-tab {{radarFaction === 'evil' ? 'radar-tab-active-evil' : ''}}" bindtap="onSwitchRadar" data-faction="evil">邪恶</view>
        </view>

        <view class="radar-canvas-wrap">
          <canvas id="radarCanvas" type="2d" class="radar-canvas" style="width:320px;height:320px;"></canvas>
        </view>
      </view>

      <!-- ── 搭档称号 ── -->
      <view class="pf rs-section" wx:if="{{partnerTitles.length}}">
        <view class="fb fb-top"></view><view class="fb fb-bottom"></view>
        <view class="fb fb-left"></view><view class="fb fb-right"></view>
        <view class="fb fb-ctl"></view><view class="fb fb-ctr"></view>
        <view class="fb fb-cbl"></view><view class="fb fb-cbr"></view>
        <view class="fc-inner fc-tl"></view><view class="fc-inner fc-tr"></view>
        <view class="fc-inner fc-bl"></view><view class="fc-inner fc-br"></view>

        <view class="rs-title-row">
          <view class="rs-title-line"></view>
          <text class="rs-deco">◆</text>
          <text class="rs-title">搭档称号</text>
          <text class="rs-deco">◆</text>
          <view class="rs-title-line"></view>
        </view>

        <scroll-view class="title-scroll" scroll-x>
          <view class="title-cards">
            <view class="title-card" wx:for="{{partnerTitles}}" wx:key="type" wx:if="{{item.phone}}">
              <text class="title-label">{{item.label}}</text>
              <image class="title-avatar-img" wx:if="{{item.avatarImage}}" src="{{item.avatarImage}}" mode="aspectFill" />
              <text class="title-avatar-text" wx:else>{{item.avatarText}}</text>
              <text class="title-nickname">{{item.nickname}}</text>
              <text class="title-stat">胜率 {{item.winRate}}% · {{item.games}}局</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- ── 搭档矩阵 ── -->
      <view class="pf rs-section" wx:if="{{partnerMatrix.length}}">
        <view class="fb fb-top"></view><view class="fb fb-bottom"></view>
        <view class="fb fb-left"></view><view class="fb fb-right"></view>
        <view class="fb fb-ctl"></view><view class="fb fb-ctr"></view>
        <view class="fb fb-cbl"></view><view class="fb fb-cbr"></view>
        <view class="fc-inner fc-tl"></view><view class="fc-inner fc-tr"></view>
        <view class="fc-inner fc-bl"></view><view class="fc-inner fc-br"></view>

        <view class="rs-title-row">
          <view class="rs-title-line"></view>
          <text class="rs-deco">◆</text>
          <text class="rs-title">搭档数据</text>
          <text class="rs-deco">◆</text>
          <view class="rs-title-line"></view>
        </view>

        <view class="partner-list">
          <view class="partner-row" wx:for="{{partnerMatrix}}" wx:key="phone" bindtap="onTogglePartner" data-phone="{{item.phone}}">
            <view class="partner-summary">
              <image class="partner-avatar-img" wx:if="{{item.avatarImage}}" src="{{item.avatarImage}}" mode="aspectFill" />
              <text class="partner-avatar-text" wx:else>{{item.avatarText}}</text>
              <text class="partner-name">{{item.nickname}}</text>
              <text class="partner-games">{{item.totalGames}}局</text>
              <view class="partner-bar-wrap">
                <view class="partner-bar" style="width: {{item.sameTeam.winRate}}%"></view>
              </view>
              <text class="partner-rate">{{item.sameTeam.winRate}}%</text>
            </view>
            <view class="partner-detail" wx:if="{{expandedPartner === item.phone}}">
              <view class="partner-detail-row">
                <text class="pd-label">同为好人</text>
                <text class="pd-value">{{item.sameGood.games}}局 · {{item.sameGood.winRate}}%</text>
              </view>
              <view class="partner-detail-row">
                <text class="pd-label">同为坏人</text>
                <text class="pd-value">{{item.sameEvil.games}}局 · {{item.sameEvil.winRate}}%</text>
              </view>
              <view class="partner-detail-row">
                <text class="pd-label">对面阵营</text>
                <text class="pd-value">{{item.opponent.games}}局 · 我胜{{item.opponent.winRate}}%</text>
              </view>
              <view class="partner-combos" wx:if="{{item.topCombos.length}}">
                <text class="pd-label">常见组合</text>
                <view class="combo-tags">
                  <text class="combo-tag" wx:for="{{item.topCombos}}" wx:for-item="combo" wx:key="myRole">{{combo.myRole}}+{{combo.theirRole}} ({{combo.games}}局)</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- ── Tab 切换：角色统计 / 勋章墙 ── -->
      <view class="detail-tabs">
        <view class="detail-tab {{detailTab === 'roles' ? 'detail-tab-active' : ''}}" bindtap="onSwitchDetailTab" data-tab="roles">角色统计</view>
        <view class="detail-tab {{detailTab === 'medals' ? 'detail-tab-active' : ''}}" bindtap="onSwitchDetailTab" data-tab="medals">勋章墙</view>
      </view>

      <!-- 角色统计 Tab -->
      <block wx:if="{{detailTab === 'roles'}}">
        <view class="pf rs-section rs-section-flush">
          <view class="fb fb-top"></view><view class="fb fb-bottom"></view>
          <view class="fb fb-left"></view><view class="fb fb-right"></view>
          <view class="fb fb-ctl"></view><view class="fb fb-ctr"></view>
          <view class="fb fb-cbl"></view><view class="fb fb-cbr"></view>
          <view class="fc-inner fc-tl"></view><view class="fc-inner fc-tr"></view>
          <view class="fc-inner fc-bl"></view><view class="fc-inner fc-br"></view>
          <view class="role-grid">
            <view class="role-card" wx:for="{{statsList}}" wx:key="role">
              <view class="role-card-topbar {{item.faction}}"></view>
              <view class="gauge-wrap">
                <view class="gauge-ring" style="background: conic-gradient({{item.faction==='good'?'rgba(78,158,255,0.88)':'rgba(220,80,80,0.88)'}} {{item.rateDeg}}deg, {{item.faction==='good'?'rgba(78,158,255,0.10)':'rgba(220,80,80,0.10)'}} 0deg)"></view>
                <view class="gauge-inner">
                  <image class="gauge-img" wx:if="{{item.roleImage}}" src="{{item.roleImage}}" mode="aspectFill" />
                  <text class="gauge-emoji" wx:else>🎭</text>
                </view>
              </view>
              <text class="rs-role-name {{item.faction}}">{{item.role}}</text>
              <text class="rs-role-games">{{item.total > 0 ? item.total+'局 / '+item.wins+'胜' : '未出场'}}</text>
              <text class="rs-role-rate {{item.total > 0 ? (item.winRate >= 50 ? 'rate-hi' : 'rate-lo') : 'rate-zero'}}">{{item.total > 0 ? item.winRate+'%' : '—'}}</text>
            </view>
          </view>
        </view>
      </block>

      <!-- 勋章墙 Tab -->
      <block wx:if="{{detailTab === 'medals'}}">
        <view class="pf rs-section" wx:if="{{goodMedals.length}}">
          <view class="fb fb-top"></view><view class="fb fb-bottom"></view>
          <view class="fb fb-left"></view><view class="fb fb-right"></view>
          <view class="fb fb-ctl"></view><view class="fb fb-ctr"></view>
          <view class="fb fb-cbl"></view><view class="fb fb-cbr"></view>
          <view class="fc-inner fc-tl"></view><view class="fc-inner fc-tr"></view>
          <view class="fc-inner fc-bl"></view><view class="fc-inner fc-br"></view>
          <view class="rs-title-row">
            <view class="rs-title-line"></view>
            <text class="rs-deco">◆</text>
            <text class="rs-title">正义勋章</text>
            <text class="rs-deco">◆</text>
            <view class="rs-title-line"></view>
          </view>
          <view class="medal-section">
            <view class="medal-grid">
              <view class="medal-card {{item.total > 0 ? '' : 'medal-zero'}}" wx:for="{{goodMedals}}" wx:key="code" catchtap="onTapMedal" data-name="{{item.name}}" data-description="{{item.description}}">
                <image class="medal-img" wx:if="{{item.image}}" src="{{item.image}}" mode="aspectFit" />
                <text class="medal-emoji" wx:else>🏅</text>
                <text class="medal-name">{{item.name}}</text>
                <text class="medal-count">{{item.total}}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="pf rs-section" wx:if="{{evilMedals.length}}">
          <view class="fb fb-top"></view><view class="fb fb-bottom"></view>
          <view class="fb fb-left"></view><view class="fb fb-right"></view>
          <view class="fb fb-ctl"></view><view class="fb fb-ctr"></view>
          <view class="fb fb-cbl"></view><view class="fb fb-cbr"></view>
          <view class="fc-inner fc-tl"></view><view class="fc-inner fc-tr"></view>
          <view class="fc-inner fc-bl"></view><view class="fc-inner fc-br"></view>
          <view class="rs-title-row">
            <view class="rs-title-line"></view>
            <text class="rs-deco">◆</text>
            <text class="rs-title">邪恶勋章</text>
            <text class="rs-deco">◆</text>
            <view class="rs-title-line"></view>
          </view>
          <view class="medal-section">
            <view class="medal-grid">
              <view class="medal-card {{item.total > 0 ? '' : 'medal-zero'}}" wx:for="{{evilMedals}}" wx:key="code" catchtap="onTapMedal" data-name="{{item.name}}" data-description="{{item.description}}">
                <image class="medal-img" wx:if="{{item.image}}" src="{{item.image}}" mode="aspectFit" />
                <text class="medal-emoji" wx:else>🏅</text>
                <text class="medal-name">{{item.name}}</text>
                <text class="medal-count">{{item.total}}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="pf rs-section" wx:if="{{roleMedals.length}}">
          <view class="fb fb-top"></view><view class="fb fb-bottom"></view>
          <view class="fb fb-left"></view><view class="fb fb-right"></view>
          <view class="fb fb-ctl"></view><view class="fb fb-ctr"></view>
          <view class="fb fb-cbl"></view><view class="fb fb-cbr"></view>
          <view class="fc-inner fc-tl"></view><view class="fc-inner fc-tr"></view>
          <view class="fc-inner fc-bl"></view><view class="fc-inner fc-br"></view>
          <view class="rs-title-row">
            <view class="rs-title-line"></view>
            <text class="rs-deco">◆</text>
            <text class="rs-title">角色专属</text>
            <text class="rs-deco">◆</text>
            <view class="rs-title-line"></view>
          </view>
          <view class="medal-section">
            <view class="medal-grid">
              <view class="medal-card {{item.total > 0 ? '' : 'medal-zero'}}" wx:for="{{roleMedals}}" wx:key="code" catchtap="onTapMedal" data-name="{{item.name}}" data-description="{{item.description}}">
                <image class="medal-img" wx:if="{{item.image}}" src="{{item.image}}" mode="aspectFit" />
                <text class="medal-emoji" wx:else>🏅</text>
                <text class="medal-name">{{item.name}}</text>
                <text class="medal-count">{{item.total}}</text>
              </view>
            </view>
          </view>
        </view>
      </block>

    </block>
```

- [ ] **Step 2: 提交**

```bash
git add mobile/miniprogram/subpkg/role-stats/index/index.wxml
git commit -m "feat(stats): restructure stats page with radar, partners, and tabs"
```

---

## Task 6: 客户端 — JS 逻辑：数据绑定 + Canvas 绑定

**Files:**
- Modify: `mobile/miniprogram/subpkg/role-stats/index/index.js`

- [ ] **Step 1: 添加新的 data 字段和 require**

在文件顶部添加 require：

```javascript
const { drawRadar } = require("./radar");
```

在 `data` 对象中添加新字段（在 `streakCount: 0` 之后）：

```javascript
    radarFaction: 'good',
    radarData: null,
    detailTab: 'roles',
    partnerTitles: [],
    partnerMatrix: [],
    expandedPartner: null,
```

- [ ] **Step 2: 在 applyStats 函数末尾添加雷达和搭档数据处理**

在 `applyStats` 函数的 `this.setData({...})` 调用中，扩展 setData 的对象，添加以下字段：

```javascript
      radarData: roleStats.radar || null,
      partnerTitles: this._buildPartnerTitles(roleStats.partners),
      partnerMatrix: this._buildPartnerMatrix(roleStats.partners),
```

并在 setData 回调中触发雷达绘制：

```javascript
    }, () => {
      if (roleStats.radar) this._drawRadarChart();
    });
```

- [ ] **Step 3: 添加新方法**

在页面对象中添加以下方法：

```javascript
  onSwitchRadar(e) {
    const faction = e.currentTarget.dataset.faction;
    this.setData({ radarFaction: faction }, () => this._drawRadarChart());
  },

  onSwitchDetailTab(e) {
    this.setData({ detailTab: e.currentTarget.dataset.tab });
  },

  onTogglePartner(e) {
    const phone = e.currentTarget.dataset.phone;
    this.setData({ expandedPartner: this.data.expandedPartner === phone ? null : phone });
  },

  _drawRadarChart() {
    const query = this.createSelectorQuery();
    query.select('#radarCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo().pixelRatio || 2;
        canvas.width = 320 * dpr;
        canvas.height = 320 * dpr;
        const faction = this.data.radarFaction;
        const radar = this.data.radarData;
        if (!radar) return;
        const data = faction === 'good' ? radar.good : radar.evil;
        drawRadar(ctx, data, faction, 320);
      });
  },

  _buildPartnerTitles(partners) {
    if (!partners || !partners.titles) return [];
    const TITLE_LABELS = {
      golden: '黄金搭档', bestWolf: '最佳狼队友', bestKnight: '最佳骑士搭档',
      bestMerlinPerci: '最佳梅林&派西', nemesis: '天生冤家', worstTeammate: '最坑队友',
    };
    return partners.titles
      .filter(t => t.phone)
      .map(t => {
        const isUrl = t.avatar && (t.avatar.startsWith('http') || t.avatar.startsWith('/'));
        return {
          ...t,
          label: TITLE_LABELS[t.type] || t.type,
          avatarImage: isUrl ? t.avatar : '',
          avatarText: isUrl ? '' : (t.avatar || '🐺'),
        };
      });
  },

  _buildPartnerMatrix(partners) {
    if (!partners || !partners.matrix) return [];
    return partners.matrix.slice(0, 30).map(p => {
      const isUrl = p.avatar && (p.avatar.startsWith('http') || p.avatar.startsWith('/'));
      return {
        ...p,
        avatarImage: isUrl ? p.avatar : '',
        avatarText: isUrl ? '' : (p.avatar || '🐺'),
      };
    });
  },
```

- [ ] **Step 4: 提交**

```bash
git add mobile/miniprogram/subpkg/role-stats/index/index.js
git commit -m "feat(stats): add radar, partner data binding and Canvas drawing"
```

---

## Task 7: 客户端 — 样式

**Files:**
- Modify: `mobile/miniprogram/subpkg/role-stats/index/index.wxss`

- [ ] **Step 1: 在 wxss 文件末尾追加新样式**

```css
/* ─── 雷达图 ─── */
.radar-faction-tabs { display: flex; justify-content: center; gap: 24rpx; margin: 16rpx 0 8rpx; }
.radar-tab { padding: 8rpx 32rpx; border-radius: 20rpx; font-size: 26rpx; color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.06); }
.radar-tab-active-good { color: #4e9eff; background: rgba(78,158,255,0.15); }
.radar-tab-active-evil { color: #dc5050; background: rgba(220,80,80,0.15); }
.radar-canvas-wrap { display: flex; justify-content: center; padding: 8rpx 0 16rpx; }
.radar-canvas { width: 640rpx; height: 640rpx; }

/* ─── 搭档称号 ─── */
.title-scroll { white-space: nowrap; padding: 8rpx 0 16rpx; }
.title-cards { display: inline-flex; gap: 16rpx; padding: 0 20rpx; }
.title-card { display: inline-flex; flex-direction: column; align-items: center; width: 240rpx; padding: 20rpx 12rpx; background: rgba(255,255,255,0.04); border-radius: 16rpx; border: 1rpx solid rgba(216,176,107,0.12); }
.title-label { font-size: 22rpx; color: rgba(216,176,107,0.8); margin-bottom: 12rpx; letter-spacing: 2rpx; }
.title-avatar-img { width: 72rpx; height: 72rpx; border-radius: 50%; }
.title-avatar-text { font-size: 36rpx; line-height: 72rpx; }
.title-nickname { font-size: 26rpx; color: rgba(255,255,255,0.85); margin-top: 8rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200rpx; }
.title-stat { font-size: 22rpx; color: rgba(255,255,255,0.45); margin-top: 4rpx; }

/* ─── 搭档矩阵 ─── */
.partner-list { padding: 0 20rpx 16rpx; }
.partner-row { margin-bottom: 8rpx; background: rgba(255,255,255,0.03); border-radius: 12rpx; overflow: hidden; }
.partner-summary { display: flex; align-items: center; padding: 16rpx 20rpx; gap: 12rpx; }
.partner-avatar-img { width: 52rpx; height: 52rpx; border-radius: 50%; flex-shrink: 0; }
.partner-avatar-text { font-size: 28rpx; width: 52rpx; text-align: center; flex-shrink: 0; }
.partner-name { font-size: 26rpx; color: rgba(255,255,255,0.8); width: 120rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
.partner-games { font-size: 22rpx; color: rgba(255,255,255,0.4); width: 70rpx; text-align: center; flex-shrink: 0; }
.partner-bar-wrap { flex: 1; height: 12rpx; background: rgba(255,255,255,0.08); border-radius: 6rpx; overflow: hidden; }
.partner-bar { height: 100%; background: linear-gradient(90deg, rgba(78,158,255,0.6), rgba(78,158,255,0.9)); border-radius: 6rpx; transition: width 0.3s; }
.partner-rate { font-size: 24rpx; color: rgba(78,158,255,0.9); width: 80rpx; text-align: right; flex-shrink: 0; }

.partner-detail { padding: 8rpx 24rpx 16rpx 84rpx; }
.partner-detail-row { display: flex; justify-content: space-between; padding: 6rpx 0; }
.pd-label { font-size: 24rpx; color: rgba(255,255,255,0.45); }
.pd-value { font-size: 24rpx; color: rgba(255,255,255,0.7); }
.partner-combos { margin-top: 8rpx; }
.combo-tags { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 4rpx; }
.combo-tag { font-size: 20rpx; padding: 4rpx 12rpx; background: rgba(255,255,255,0.06); border-radius: 8rpx; color: rgba(255,255,255,0.5); }

/* ─── Detail Tab ─── */
.detail-tabs { display: flex; justify-content: center; gap: 32rpx; padding: 24rpx 0 8rpx; }
.detail-tab { font-size: 28rpx; color: rgba(255,255,255,0.4); padding: 8rpx 24rpx; border-bottom: 4rpx solid transparent; }
.detail-tab-active { color: rgba(216,176,107,0.9); border-bottom-color: rgba(216,176,107,0.7); }
```

- [ ] **Step 2: 提交**

```bash
git add mobile/miniprogram/subpkg/role-stats/index/index.wxss
git commit -m "feat(stats): add radar, partner, tab styles"
```

---

## Task 8: 部署 + 验证

- [ ] **Step 1: 部署服务端**

```bash
scp server/stats-radar.js server/stats-partners.js server/history.js awalon:/opt/avalon-online/server/
ssh awalon "pm2 restart avalon-server"
ssh awalon "pm2 logs avalon-server --lines 5 --nostream"
```

- [ ] **Step 2: 在微信开发者工具验证**

验证清单：
1. 统计页首页展示概览 + 雷达图 + 搭档称号 + 搭档矩阵
2. 雷达图正义/邪恶切换正常，Canvas 渲染六边形
3. 搭档称号横向滚动，显示头像、昵称、胜率
4. 搭档矩阵点击展开详情
5. Tab 切换角色统计和勋章墙
6. PvP/PvE 模式切换时所有数据刷新
7. 无对局数据时显示"暂无统计数据"

- [ ] **Step 3: 提交所有文件**

```bash
git add -A
git commit -m "feat(stats): complete radar chart and partner analysis feature"
```
