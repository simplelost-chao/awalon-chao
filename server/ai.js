const path = require('path');
const Database = require('better-sqlite3');

const API_KEY = process.env.AI_API_KEY || process.env.QWEN_API_KEY || '';
const MODEL = process.env.AI_MODEL || 'deepseek-chat';
const BASE_URL = process.env.AI_BASE_URL || 'https://api.deepseek.com/v1';

const db = new Database(path.join(__dirname, 'ai.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS game_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT,
    winner TEXT,
    summary TEXT,
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS ai_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ai_name TEXT,
    summary TEXT,
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS good_speeches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    faction TEXT,
    role TEXT,
    intent TEXT,
    text TEXT,
    score INTEGER,
    context TEXT,
    situation_type TEXT,
    player_count INTEGER DEFAULT 0,
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS strategy_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    faction TEXT NOT NULL,
    situation_type TEXT NOT NULL,
    player_count INTEGER DEFAULT 0,
    pattern TEXT NOT NULL,
    outcome TEXT NOT NULL,
    confidence INTEGER DEFAULT 1,
    created_at INTEGER
  );
`);
// 字段迁移（兼容旧表结构）
try { db.exec('ALTER TABLE good_speeches ADD COLUMN situation_type TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE good_speeches ADD COLUMN player_count INTEGER DEFAULT 0'); } catch (e) {}

function buildPersonaDesc(player) {
  const key = player && player.aiPersonaKey;
  const personas = {
    '激进冲锋': { speakTone: '直接强势，喜欢点名质疑，句子简短有力', voteHabits: '倾向快速通过', bluffHint: '坏人时更敢于硬跳身份' },
    '稳健保守': { speakTone: '措辞谨慎，引用具体投票和任务记录', voteHabits: '基于证据投票', bluffHint: '坏人时偏向藏在人群里' },
    '逻辑推理': { speakTone: '喜欢列举证据链，用"因为...所以..."', voteHabits: '严格按记录判断', bluffHint: '坏人时构造看起来合理的逻辑链' },
    '社交观察': { speakTone: '关注他人情绪和用词，善于捕捉矛盾', voteHabits: '重视发言一致性', bluffHint: '坏人时专注指出别人矛盾转移视线' },
    '搅局误导': { speakTone: '引导话题，制造分歧，发言模糊', voteHabits: '偶尔出乎意料地投票', bluffHint: '坏人时尤其享受在好人中制造内耗' },
    '冷静克制': { speakTone: '话少精准，每句有指向性', voteHabits: '非必要不否决', bluffHint: '坏人时沉默是金，偶尔一语中的' },
    '强势控场': { speakTone: '主动表态定性，带有引导性', voteHabits: '敢于强推队伍', bluffHint: '坏人时更强势地主导局势' },
    '谨慎试探': { speakTone: '多用疑问句，倾向观察', voteHabits: '早保守晚行动', bluffHint: '坏人时前期极度低调积累信任' },
  };
  const p = personas[key] || { speakTone: '理性分析', voteHabits: '综合判断', bluffHint: '灵活应对' };
  return `发言风格：${p.speakTone}。投票习惯：${p.voteHabits}。坏人策略倾向：${p.bluffHint}。`;
}

function recordGameSummary(room, winner) {
  try {
    const summary = buildSummary(room, winner);
    const stmt = db.prepare('INSERT INTO game_logs(room_code, winner, summary, created_at) VALUES(?,?,?,?)');
    stmt.run(room.code, winner || 'unknown', summary, Date.now());
    for (const p of room.players.values()) {
      if (!p.isAI) continue;
      const aiSummary = `${summary}; ai=${p.nickname}; role=${room.game.assignments[p.id]}`;
      const aiId = p.aiPersonaId || p.nickname;
      db.prepare('INSERT INTO ai_memory(ai_name, summary, created_at) VALUES(?,?,?)').run(aiId, aiSummary, Date.now());
    }
  } catch (e) {
    // no-op
  }
}

function getRecentSummaries(limit = 5) {
  try {
    const stmt = db.prepare('SELECT summary FROM game_logs ORDER BY id DESC LIMIT ?');
    return stmt.all(limit).map((r) => r.summary);
  } catch (e) {
    return [];
  }
}

function getAiMemory(aiId, limit = 6) {
  try {
    const stmt = db.prepare('SELECT summary FROM ai_memory WHERE ai_name = ? ORDER BY id DESC LIMIT ?');
    return stmt.all(aiId, limit).map((r) => r.summary);
  } catch (e) {
    return [];
  }
}

function buildSummary(room, winner) {
  const missions = room.game.missionHistory
    .map((m) => `R${m.round}:${m.success ? 'S' : 'F'}(f${m.fails})`)
    .join(' ');
  const votes = room.game.voteHistory
    .map((v) => `R${v.round}-${v.approved ? 'A' : 'R'}(${v.approves}/${v.rejects})`)
    .join(' ');
  return `winner=${winner}; missions=${missions}; votes=${votes}`;
}

const ALL_ROLES = ['梅林', '派西维尔', '忠臣', '莫甘娜', '刺客', '莫德雷德', '奥伯伦', '爪牙'];

// ─── Few-shot 发言示例库（基于 Avalon-NLU 真人对局策略 + AvalonBench 研究） ───
// 来源：sstepput/Avalon-NLU (EMNLP 2023) 20局真人标注对局
// 核心策略：好人用 logical deduction，坏人用 influence/commission/omission
const SPEAK_FEW_SHOT = [
  // ── 好人阵营 ─────────────────────────────────────────
  {
    faction: 'good',
    scenario: '第2轮，1号任务失败(1票失败)，5号急着推3号，我是忠臣(4号座位)',
    output: {
      intent: 'accusation', target: 5,
      text: '我注意到1号任务失败票只有1张，3号和5号都在那轮队伍里。现在5号这么急着把矛头指向3号，反而让我觉得5号更值得关注，急着甩锅是什么意思？',
    },
    why: 'logical deduction：用投票记录质疑，不凭感觉，指出行为异常而非猜测身份',
  },
  {
    faction: 'good',
    scenario: '第1轮无信息，我是梅林(2号座位)，知道4号6号是坏人，但不能暴露',
    output: {
      intent: 'neutral',
      text: '第一轮信息太少，目前只能看谁的推荐方向比较奇怪，或者谁表态太积极想主导队伍组成——这两种行为往往值得关注，先观察几轮再说。',
    },
    why: '梅林早期保守：不暴露视野，建立分析者形象，避免被刺客锁定',
  },
  {
    faction: 'good',
    scenario: '第3轮，2轮任务均成功，领袖提了包含4号的队伍，我是梅林(2号)，4号是坏人',
    output: {
      intent: 'suggestion', target: 4,
      text: '4号在前两轮都没上过车，我们对他完全没有任务记录，这时候让他上队风险很高。我倾向于换一个有记录可循的人，比如1号或3号，至少我们知道他们的表现。',
    },
    why: '梅林间接引导：用"缺乏记录"代替"我知道他是坏人"，符合忠臣视角，不暴露视野',
  },
  {
    faction: 'good',
    scenario: '第3轮，我(5号)被3号点名：5号上车那轮任务失败，我是忠臣',
    output: {
      intent: 'defense',
      text: '那轮任务失败我也很意外。但跟我一起上车的还有2号和6号，3号你只盯着我，是不是有些选择性？如果要排查，应该三个人都看，单独锁我没有说服力。',
    },
    why: 'appeal/defense：分散注意力到其他队员，用逻辑反驳，不是情绪否认',
  },
  {
    faction: 'good',
    scenario: '第2轮，我是忠臣(1号)，发现3号投票模式和发言有明显矛盾',
    output: {
      intent: 'probe', target: 3,
      text: '3号，我想问一下，你第1轮投了反对，说是不信任队伍，但这轮你自己推了一个跟上轮差不多的人选——你的标准是什么？能不能解释一下？',
    },
    why: 'questioning：直接提问逼其表态，基于具体行为，而非凭感觉质疑',
  },
  {
    faction: 'good',
    scenario: '第2轮，我是派西维尔(1号)，梅林(3号)刚暗示了4号有问题',
    output: {
      intent: 'support', target: 3,
      text: '3号说的方向我认同，4号第1轮的发言一直在给争议人选站台，自己却一直没有明确表态。这种模糊态度结合任务失败，值得重点关注。',
    },
    why: '支持梅林方向，不暴露知道谁是梅林，用自己的逻辑"独立"得出相同结论',
  },
  // ── 坏人阵营 ─────────────────────────────────────────
  {
    faction: 'evil',
    scenario: '第2轮，1号任务失败，我是爪牙(6号)，队友3号被怀疑，队友发言：我是好人不会出失败票',
    output: {
      intent: 'redirect', target: 2,
      text: '大家把焦点全放在3号身上了，但我反而觉得2号更可疑——他每次都跟着大多数票走，完全没有自己的判断。这种藏在人群里的打法才是真正危险的。',
    },
    why: 'influence deception：把怀疑引向好人，给出看似合理的逻辑，同时保护队友3号',
  },
  {
    faction: 'evil',
    scenario: '第1轮，我是莫甘娜(3号)，想建立早期好人信任',
    output: {
      intent: 'claim',
      text: '第一轮我打算先看两件事：谁在推一些大家不太了解的人上车，以及投票时谁的犹豫特别明显。犹豫得越多越值得关注，这是我的判断框架，先说出来让大家参考。',
    },
    why: 'commission deception：主动展示分析框架，建立"理性好人"形象，积累信任',
  },
  {
    faction: 'evil',
    scenario: '第3轮，我是刺客(4号)，被2号和5号点名，上轮任务失败',
    output: {
      intent: 'defense',
      text: '我上车那轮失败，但你们只盯着我，那轮还有3号和6号在队伍里。如果真的要排查，应该这三个人一起看。而且我在之前的投票里一直是反对可疑队伍的——这有记录的，不信可以翻。',
    },
    why: 'omission+defense：分散怀疑，用部分真实信息（投票记录）支撑虚假立场',
  },
  {
    faction: 'evil',
    scenario: '第3轮局势紧张，我是爪牙(5号)，想转移话题给好人制造内耗',
    output: {
      intent: 'accusation', target: 1,
      text: '我觉得现在大家的方向有点乱。先不说3号，1号从第1轮到现在一直没有明确的立场，发言都是跟随大流——这种人其实比明显可疑的人更难排查，反而更危险。',
    },
    why: '转移视线(influence)：引入新目标制造混乱，"跟随大流"是无法证伪的指控，让好人内耗',
  },
];

// 按 intent 建立索引，用于按需选取最相关的 few-shot
const FEW_SHOT_BY_INTENT = {};
for (const ex of SPEAK_FEW_SHOT) {
  const key = `${ex.faction}:${ex.output.intent}`;
  if (!FEW_SHOT_BY_INTENT[key]) FEW_SHOT_BY_INTENT[key] = [];
  FEW_SHOT_BY_INTENT[key].push(ex);
}

// 根据上下文选取最相关的 2-3 条示例（纯文本，不是JSON，让模型学发言风格）
function buildFewShotBlock(faction, round = 1, accused = null, allyNarrative = null) {
  const lines = ['【发言参考示例】（学习以下发言的风格和逻辑，不要照抄）'];

  const added = new Set();
  const tryAdd = (intent) => {
    const key = `${faction}:${intent}`;
    const pool = FEW_SHOT_BY_INTENT[key] || [];
    const ex = pool.find(e => !added.has(e));
    if (ex) {
      added.add(ex);
      lines.push(`情境：${ex.scenario}\n好发言："${ex.output.text}"\n原则：${ex.why}\n`);
    }
  };

  // 优先加载与当前局面最匹配的示例
  if (accused) { tryAdd('defense'); tryAdd('redirect'); }
  if (faction === 'evil' && allyNarrative) tryAdd('redirect');
  if (round <= 1) tryAdd(faction === 'good' ? 'neutral' : 'claim');
  else tryAdd(faction === 'good' ? 'accusation' : 'redirect');
  tryAdd(faction === 'good' ? 'probe' : 'defense');
  const allIntents = ['accusation', 'defense', 'redirect', 'claim', 'probe', 'support', 'neutral'];
  for (const intent of allIntents) {
    if (added.size >= 3) break;
    tryAdd(intent);
  }

  // 动态高分发言（最多2条，来自历史对局评分）
  const dynamic = getDynamicSpeeches(faction, 2);
  if (dynamic.length) {
    lines.push('【历史高分发言参考】');
    for (const d of dynamic) {
      lines.push(`"${d.text}" （${d.role}/${d.intent}，${d.context}）`);
    }
  }
  return lines.join('\n');
}

function getDynamicSpeeches(faction, n = 3) {
  try {
    return db.prepare(
      'SELECT role, intent, text, context FROM good_speeches WHERE faction = ? ORDER BY score DESC, id DESC LIMIT ?'
    ).all(faction, n);
  } catch (e) {
    return [];
  }
}

function storeSpeech(faction, role, intent, text, score, context, situationType, playerCount) {
  try {
    db.prepare(
      `INSERT INTO good_speeches(faction, role, intent, text, score, context, situation_type, player_count, created_at)
       VALUES(?,?,?,?,?,?,?,?,?)`
    ).run(faction, role, intent, text, score, context || '', situationType || '', playerCount || 0, Date.now());
    db.prepare(
      `DELETE FROM good_speeches WHERE faction = ? AND id NOT IN (
        SELECT id FROM good_speeches WHERE faction = ? ORDER BY score DESC, id DESC LIMIT 200
      )`
    ).run(faction, faction);
  } catch (e) {}
}

// 在一局结束后，批量评估 AI 发言质量，将高质量发言存入 good_speeches
async function evaluateGameSpeeches(room, roleFactions) {
  if (!room || !room.game || !room.game.speakHistory) return;
  const assignments = room.game.assignments || {};
  const winner = room.game.winner || '';

  // 收集所有 AI 发言，附带上下文
  const candidates = [];
  for (const [key, msgs] of Object.entries(room.game.speakHistory)) {
    const [roundStr, attemptStr] = key.split('-');
    const round = Number(roundStr) || 0;
    for (const m of (msgs || [])) {
      if (!m || !m.playerId || !m.text || m.text.length < 15) continue;
      const role = assignments[m.playerId] || '';
      if (!role) continue;
      // 只评估 AI 玩家
      const player = room.players && room.players.get ? room.players.get(m.playerId) : null;
      if (!player || !player.isAI) continue;
      const faction      = (roleFactions[role] || 'good');
      const player2      = room.players && room.players.get ? room.players.get(m.playerId) : null;
      const sitType      = player2 ? classifySituation(room, m.playerId) : 'info_available';
      const context      = `第${round}轮，${winner || '?'}方胜，角色${role}`;
      candidates.push({ playerId: m.playerId, role, faction, text: m.text, intent: m.intent || '', context, sitType });
    }
  }

  if (!candidates.length) return;

  // 每次最多评估 20 条，避免 token 过多
  const batch = candidates.slice(-20);
  const system =
    '你是阿瓦隆桌游发言质量评审。请对每条发言从以下维度评分（1-5分）：\n' +
    '1. 策略性：发言是否对本方阵营有帮助，避免暴露身份的同时推进己方目标\n' +
    '2. 自然度：是否像真人在说话，口语化，有逻辑有温度\n' +
    '3. 信息密度：是否包含有效信息或有效干扰，而非废话\n' +
    '综合以上给出1-5的整数分，5分=极好，4分=好，3分=一般，2分=较差，1分=很差。\n' +
    '只评分，不需要解释。输出严格JSON数组，每项格式：{"index":N,"score":M}';

  const user = JSON.stringify(batch.map((c, i) => ({
    index: i,
    role: c.role,
    faction: c.faction,
    text: c.text,
    intent: c.intent,
    context: c.context,
  })));

  try {
    const res = await callLLM(system, user, 0.3);
    // 解析评分结果，可能被包裹在 ```json 里
    const cleaned = res.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const scores = parseJSON(cleaned, []);
    if (!Array.isArray(scores)) return;
    for (const item of scores) {
      if (typeof item.index !== 'number' || typeof item.score !== 'number') continue;
      const c = batch[item.index];
      if (!c) continue;
      if (item.score >= 4) {
        const pCount = (room.seats || []).length;
        storeSpeech(c.faction, c.role, c.intent, c.text, item.score, c.context, c.sitType, pCount);
      }
    }
  } catch (e) {
    // no-op — evaluation is best-effort
  }
}

function sanitizeSpeech(text, rolesInGame) {
  if (!text) return '';
  if (!Array.isArray(rolesInGame) || rolesInGame.length === 0) return text;
  const allowed = new Set(rolesInGame);
  let out = text;
  for (const role of ALL_ROLES) {
    if (!allowed.has(role)) {
      out = out.replace(new RegExp(role, 'g'), '某角色');
    }
  }
  return out;
}

function hasExplicitIdentityReveal(text) {
  const t = String(text || '').replace(/\s+/g, '');
  if (!t) return false;
  if (/我(是|就是|身份是|身份确定是|的身份是|作为)(梅林|派西维尔|忠臣|好人|莫甘娜|刺客|莫德雷德|奥伯伦|爪牙|坏人)/.test(t)) return true;
  if (/(我是梅林|我是派西维尔|我是忠臣|我是刺客|我是莫甘娜|我是莫德雷德|我是奥伯伦|我是爪牙|我是好人|我是坏人)/.test(t)) return true;
  return false;
}

function seatNo(room, id) {
  const idx = room.seats.findIndex((x) => x === id);
  return idx >= 0 ? idx + 1 : null;
}

function buildPlayerActionSummary(room, playerId) {
  const voteHistory = (room && room.game && room.game.voteHistory) || [];
  const missionHistory = (room && room.game && room.game.missionHistory) || [];
  const speakHistory = (room && room.game && room.game.speakHistory) || {};
  const out = {
    speeches: [],
    teamDecisions: [],
    votes: [],
    missions: [],
    assassination: null,
  };

  for (const [key, arr] of Object.entries(speakHistory)) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item || item.playerId !== playerId || !item.text) continue;
      out.speeches.push({
        key,
        text: item.text,
      });
    }
  }

  for (const v of voteHistory) {
    if (!v || !Array.isArray(v.team)) continue;
    const teamSeats = v.team.map((id) => seatNo(room, id)).filter(Boolean);
    if (v.leaderId === playerId) {
      out.teamDecisions.push({
        round: v.round,
        attempt: v.attempt,
        teamSeats,
        approved: !!v.approved,
        voteResult: `${v.approves}/${v.rejects}`,
      });
    }
    if (Object.prototype.hasOwnProperty.call(v.votes || {}, playerId)) {
      out.votes.push({
        round: v.round,
        attempt: v.attempt,
        teamSeats,
        approve: !!v.votes[playerId],
        approved: !!v.approved,
        voteResult: `${v.approves}/${v.rejects}`,
      });
    }
  }

  for (const m of missionHistory) {
    if (!m || !Array.isArray(m.team) || !m.team.includes(playerId)) continue;
    const missionVotes = m.missionVotes || {};
    out.missions.push({
      round: m.round,
      teamSeats: m.team.map((id) => seatNo(room, id)).filter(Boolean),
      success: !!m.success,
      fails: Number(m.fails || 0),
      needFail: Number(m.needFail || 1),
      myMissionVote: Object.prototype.hasOwnProperty.call(missionVotes, playerId) ? (!!missionVotes[playerId] ? 'fail' : 'success') : 'unknown',
    });
  }

  const assassination = room && room.game ? room.game.assassination : null;
  if (assassination && (assassination.assassinId === playerId || assassination.targetId === playerId)) {
    out.assassination = {
      acted: assassination.assassinId === playerId,
      targeted: assassination.targetId === playerId,
      hit: !!assassination.hit,
      targetSeat: assassination.targetId ? seatNo(room, assassination.targetId) : null,
    };
  }

  out.speeches.sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return out;
}

// 构建完整对局叙事（复盘用，包含所有发言/投票/任务）
function buildFullGameNarrative(room, roleFactions) {
  const game = room.game || {};
  const missionHistory = game.missionHistory || [];
  const voteHistory = game.voteHistory || [];
  const speakHistory = game.speakHistory || {};
  const lines = [];

  // 按轮次整理发言+投票+任务
  const rounds = Math.max(
    missionHistory.length ? missionHistory[missionHistory.length - 1].round : 0,
    voteHistory.length ? voteHistory[voteHistory.length - 1].round : 0,
    1
  );

  for (let r = 1; r <= rounds; r++) {
    lines.push(`\n=== 第${r}轮 ===`);

    // 本轮投票（可能多次）
    const roundVotes = voteHistory.filter(v => v.round === r);
    for (const v of roundVotes) {
      const teamStr = (v.team || []).map(id => seatNo(room, id)).filter(Boolean).join('、');
      const noes = v.votes
        ? Object.entries(v.votes).filter(([, ok]) => !ok).map(([id]) => `${seatNo(room, id)}号`).join(' ')
        : '';
      lines.push(`  [组队第${v.attempt || 1}次] 队长推[${teamStr}号] → ${v.approved ? '通过' : '否决'}(${v.approves}赞/${v.rejects}反)${noes ? '，反对票：' + noes : ''}`);
    }

    // 本轮发言（按 speakHistory key 匹配，格式 "轮次-attempt"）
    const speakKeys = Object.keys(speakHistory).filter(k => k.startsWith(`${r}-`)).sort();
    for (const key of speakKeys) {
      const msgs = speakHistory[key] || [];
      if (!msgs.length) continue;
      lines.push(`  [发言阶段 ${key}]`);
      for (const m of msgs) {
        if (!m || !m.text) continue;
        const s = seatNo(room, m.playerId);
        if (s) lines.push(`    ${s}号："${m.text}"`);
      }
    }

    // 本轮任务结果
    const mission = missionHistory.find(m => m.round === r);
    if (mission) {
      const teamStr = (mission.team || []).map(id => seatNo(room, id)).filter(Boolean).join('、');
      lines.push(`  [任务结果] 队伍[${teamStr}号] → ${mission.success ? '✓成功' : `✗失败(${mission.fails}票失败，需${mission.needFail || 1}票)`}`);
    }
  }

  // 刺杀
  const asgn = game.assassination;
  if (asgn) {
    const assassinSeat = seatNo(room, asgn.assassinId);
    const targetSeat = seatNo(room, asgn.targetId);
    lines.push(`\n=== 刺杀阶段 ===`);
    lines.push(`  刺客(${assassinSeat}号) 指向 ${targetSeat}号 → ${asgn.hit ? '刺杀成功，坏人获胜' : '刺杀失败，好人获胜'}`);
  }

  lines.push(`\n=== 最终结果 ===`);
  lines.push(`  获胜方：${game.winner === 'good' ? '好人阵营' : '坏人阵营'}`);

  // 公开身份（结束后全部揭开）
  const assignments = game.assignments || {};
  const roleLines = [];
  for (const [pid, r] of Object.entries(assignments)) {
    const s = seatNo(room, pid);
    if (s) roleLines.push(`${s}号=${r}`);
  }
  if (roleLines.length) lines.push(`  身份揭示：${roleLines.join('，')}`);

  return lines.join('\n');
}

// 把 actionSummary 格式化为可读文本（供 LLM 复盘分析）
function buildActionSummaryText(room, playerId, summary, mySeat) {
  const parts = [];
  const game = room.game || {};
  const missionHistory = game.missionHistory || [];
  const voteHistory = game.voteHistory || [];

  // 发言
  if (summary.speeches.length) {
    parts.push('【我的发言记录】');
    for (const s of summary.speeches) {
      const [r, a] = (s.key || '').split('-');
      // 找本轮任务结果作为上下文
      const roundMission = missionHistory.find(m => m.round === Number(r));
      const ctx = roundMission ? `（${roundMission.success ? '本轮任务最终成功' : '本轮任务最终失败'}）` : '';
      parts.push(`  第${r}轮第${a || 1}次${ctx}："${s.text}"`);
    }
  } else {
    parts.push('【我的发言记录】无');
  }

  // 投票
  if (summary.votes.length) {
    parts.push('【我的投票记录】');
    for (const v of summary.votes) {
      const teamStr = (v.teamSeats || []).join('、');
      const missionAfter = missionHistory.find(m => m.round === v.round);
      const missionCtx = missionAfter ? `，任务最终${missionAfter.success ? '成功' : '失败'}` : '';
      parts.push(`  第${v.round}轮第${v.attempt || 1}次：队伍[${teamStr}号] → 我投${v.approve ? '赞成' : '反对'} → 队伍${v.approved ? '通过' : '否决'}(${v.voteResult})${missionCtx}`);
    }
  }

  // 任务
  if (summary.missions.length) {
    parts.push('【我的任务行为】');
    for (const m of summary.missions) {
      const teamStr = (m.teamSeats || []).join('、');
      parts.push(`  第${m.round}轮：队伍[${teamStr}号] → 我出了${m.myMissionVote === 'fail' ? '失败票' : m.myMissionVote === 'success' ? '成功票' : '未知票'} → 任务${m.success ? '成功' : `失败(${m.fails}票失败)`}`);
    }
  }

  // 组队决策（作为队长时）
  if (summary.teamDecisions.length) {
    parts.push('【我作为队长的组队】');
    for (const t of summary.teamDecisions) {
      parts.push(`  第${t.round}轮第${t.attempt || 1}次：我推[${(t.teamSeats || []).join('、')}号] → ${t.approved ? '通过' : '否决'}(${t.voteResult})`);
    }
  }

  // 刺杀
  if (summary.assassination) {
    const a = summary.assassination;
    if (a.acted) {
      parts.push(`【刺杀行为】我（刺客）选择了${a.targetSeat}号 → ${a.hit ? '刺杀成功' : '刺杀失败'}`);
    } else if (a.targeted) {
      parts.push(`【被刺杀】我（${a.targeted}号）被刺客选中 → ${a.hit ? '刺杀命中，坏人获胜' : '刺杀未中，好人获胜'}`);
    }
  }

  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// ──  LEARNING SYSTEM: 情景分类 / 信念状态 / 情绪寄存器 / 发言多样性 / 模式检索  ──
// ─────────────────────────────────────────────────────────────────────────────

// 8 种标准局面类型，用于跨局知识的标签化存储和精准检索
const SIT = {
  EARLY:       'early_game',        // 第1轮，无有效信息
  MID:         'info_available',    // 中局，有任务/投票记录
  FAIL_1:      'first_failure',     // 第一次任务失败刚发生
  FAIL_2:      'consecutive_fails', // 连续失败，坏人接近获胜
  GOOD_LEAD:   'good_leading',      // 好人已赢2局
  EVIL_EDGE:   'evil_needs_one',    // 坏人只需1次失败即获胜
  PRE_ASGN:    'pre_assassination', // 好人赢3局，进入刺杀阶段
  ACCUSED:     'under_suspicion',   // 当前玩家刚被点名怀疑
};

/** 根据游戏状态和最近发言判断当前局面类型 */
function classifySituation(room, playerId) {
  const missions = (room.game && room.game.missionHistory) || [];
  const goodWins = missions.filter(m => m.success).length;
  const evilWins = missions.filter(m => !m.success).length;
  const round    = (room.game && room.game.round) || 1;
  const mySeat   = seatNo(room, playerId);

  // 优先检测是否被点名（影响当轮发言策略）
  const speakHistory = (room.game && room.game.speakHistory) || {};
  const recentKeys = Object.keys(speakHistory).sort().slice(-2);
  for (const key of recentKeys) {
    for (const m of (speakHistory[key] || []).slice(-10)) {
      if (m && m.text && m.playerId !== playerId &&
          m.text.includes(`${mySeat}号`) &&
          /怀疑|坏人|问题|排查|出局/.test(m.text)) {
        return SIT.ACCUSED;
      }
    }
  }

  if (goodWins >= 3) return SIT.PRE_ASGN;
  if (evilWins >= 2) return missions.length > 0 && !missions[missions.length - 1].success
    ? SIT.FAIL_2 : SIT.EVIL_EDGE;
  if (goodWins >= 2) return SIT.GOOD_LEAD;
  if (missions.length > 0 && !missions[missions.length - 1].success) return SIT.FAIL_1;
  if (round <= 1) return SIT.EARLY;
  return SIT.MID;
}

/**
 * 基于任务失败记录和投票相关性，为每个座位计算嫌疑分 (0~1)。
 * 梅林/坏人会覆盖已知角色的分数。
 */
function computeBeliefState(room, playerId, role, roleFactions) {
  const info        = roleInfo(room, playerId, role, roleFactions);
  const mySeat      = seatNo(room, playerId);
  const missions    = (room.game && room.game.missionHistory) || [];
  const votes       = (room.game && room.game.voteHistory)    || [];
  const faction     = roleFactions[role] || 'good';
  const totalSeats  = (room.seats || []).length;

  const sus = {};   // seat -> float
  const evi = {};   // seat -> string[]
  for (let s = 1; s <= totalSeats; s++) { sus[s] = 0.3; evi[s] = []; }

  // 角色视野覆盖（确定性信息最高权重）
  if (role === '梅林') {
    for (const s of info.seats) {
      sus[s] = 0.92; evi[s] = ['梅林视野：确认坏人'];
    }
    for (let s = 1; s <= totalSeats; s++) {
      if (s !== mySeat && !info.seats.includes(s)) {
        sus[s] = 0.08; evi[s] = ['梅林视野：确认好人'];
      }
    }
  } else if (faction === 'evil' && role !== '奥伯伦') {
    for (const s of info.seats) {
      if (s !== mySeat) { sus[s] = 0.05; evi[s] = ['坏人视野：确认队友']; }
    }
  }

  // 任务失败分析（最强信号）
  for (const m of missions) {
    const teamSeats = (m.team || []).map(id => seatNo(room, id)).filter(Boolean);
    if (!m.success) {
      for (const s of teamSeats) {
        if (s !== mySeat && (sus[s] || 0) < 0.9) {
          sus[s] = Math.min(0.92, (sus[s] || 0.3) + 0.18);
          evi[s] = [...(evi[s] || []), `第${m.round}轮失败任务成员`];
        }
      }
      // 不在失败队伍里 → 微弱好人信号
      for (let s = 1; s <= totalSeats; s++) {
        if (!teamSeats.includes(s) && s !== mySeat && (sus[s] || 0) < 0.9) {
          sus[s] = Math.max(0.05, (sus[s] || 0.3) - 0.03);
        }
      }
    }
  }

  // 投票相关性（次级信号）
  for (const v of votes) {
    const relMission = missions.find(m => m.round === v.round);
    if (!relMission) continue;
    for (const [pid, approved] of Object.entries(v.votes || {})) {
      const s = seatNo(room, pid);
      if (!s || s === mySeat || (sus[s] || 0) >= 0.9) continue;
      if (approved && !relMission.success) {
        sus[s] = Math.min(0.85, (sus[s] || 0.3) + 0.07);
        evi[s] = [...(evi[s] || []), `第${v.round}轮赞成了后来失败的队伍`];
      } else if (!approved && !relMission.success) {
        sus[s] = Math.max(0.05, (sus[s] || 0.3) - 0.07);
        evi[s] = [...(evi[s] || []), `第${v.round}轮反对了后来失败的队伍`];
      }
    }
  }

  const topSuspects = Object.entries(sus)
    .filter(([s]) => Number(s) !== mySeat)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([s]) => Number(s));

  return {
    suspicion: sus,
    evidence: evi,
    topSuspects,
    knownEvil:   role === '梅林' ? info.seats : [],
    knownAllies: faction === 'evil' && role !== '奥伯伦' ? info.seats : [],
  };
}

/** 把 beliefState 格式化为可读文本，注入到 LLM prompt */
function formatBeliefStateForPrompt(bs, mySeat) {
  const lines = ['【当前嫌疑评估（基于任务/投票分析）】'];
  if (bs.knownEvil.length)    lines.push(`已知坏人（梅林视野）：${bs.knownEvil.join('、')}号`);
  if (bs.knownAllies.length)  lines.push(`已知队友（坏人视野）：${bs.knownAllies.join('、')}号`);

  const sorted = Object.entries(bs.suspicion)
    .filter(([s]) => Number(s) !== mySeat)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  for (const [seat, score] of sorted) {
    const ev   = (bs.evidence[seat] || []).slice(-2).join('；');
    const lvl  = score >= 0.8 ? '高度可疑' : score >= 0.55 ? '中等嫌疑' : '较低嫌疑';
    if (ev) lines.push(`${seat}号：${lvl}(${Math.round(score * 100)}%) — ${ev}`);
  }
  return lines.join('\n');
}

/** 根据当前战局计算情绪寄存器，让发言有真实情绪而非永远理性分析 */
function computeEmotionalRegister(room, playerId, role, roleFactions) {
  const missions  = (room.game && room.game.missionHistory) || [];
  const faction   = roleFactions[role] || 'good';
  const goodWins  = missions.filter(m => m.success).length;
  const evilWins  = missions.filter(m => !m.success).length;
  const mySeat    = seatNo(room, playerId);

  // 最近是否被点名
  const speakHistory = (room.game && room.game.speakHistory) || {};
  const recentKeys   = Object.keys(speakHistory).sort().slice(-2);
  let accused = false;
  outer: for (const key of recentKeys) {
    for (const m of (speakHistory[key] || []).slice(-8)) {
      if (m && m.text && m.playerId !== playerId &&
          m.text.includes(`${mySeat}号`) &&
          /怀疑|坏人|问题|出局/.test(m.text)) {
        accused = true; break outer;
      }
    }
  }

  if (accused) return { state: 'defensive',
    hint: '刚被点名，内心有点不爽，说话可以稍微急一点或者有点不服气，不要只是冷静解释' };

  if (faction === 'good') {
    if (evilWins >= 2) return { state: 'stressed',
      hint: '好人快输了，局势很紧张，语气可以透出急迫感，需要尽快锁定坏人' };
    if (goodWins >= 2) return { state: 'confident',
      hint: '好人形势不错，可以更主动地推进，语气自信一些' };
    if (missions.length === 0) return { state: 'observing',
      hint: '第一轮完全没有信息，可以说说自己的判断标准或者直觉，不要强行分析' };
  } else {
    if (goodWins >= 2) return { state: 'stressed',
      hint: '好人快赢了，坏人需要搅局，语气可以有压迫感，主动制造混乱' };
    if (evilWins >= 2) return { state: 'confident',
      hint: '坏人局势占优，保持沉稳，不要过度表现' };
  }
  return { state: 'neutral', hint: '局面普通，按正常节奏说话' };
}

/** 获取该玩家最近使用过的发言意图，防止连续重复 */
function getForbiddenIntents(room, playerId) {
  const patterns = room.game && room.game.speechPatterns && room.game.speechPatterns[playerId];
  if (!patterns || patterns.length < 2) return [];
  const recent = patterns.slice(-4);
  const forbidden = new Set();
  // 连续相同意图 → 禁止
  if (recent.length >= 2 && recent[recent.length - 1] === recent[recent.length - 2]) {
    forbidden.add(recent[recent.length - 1]);
  }
  // 最近4次出现3次同意图 → 也禁止
  const counts = {};
  for (const x of recent) counts[x] = (counts[x] || 0) + 1;
  for (const [intent, cnt] of Object.entries(counts)) {
    if (cnt >= 3) forbidden.add(intent);
  }
  return [...forbidden];
}

/** 记录本次发言意图（在 decideSpeak 返回后调用） */
function recordSpeechIntent(room, playerId, intent) {
  if (!room.game) return;
  if (!room.game.speechPatterns) room.game.speechPatterns = {};
  const arr = room.game.speechPatterns[playerId] || [];
  arr.push(intent || 'neutral');
  room.game.speechPatterns[playerId] = arr.slice(-12); // 保留最近12条
}

/** 从 strategy_patterns 检索与当前角色+局面匹配的历史经验 */
function getRelevantPatterns(role, faction, situationType, playerCount = 0, limit = 4) {
  try {
    // 优先：精确角色 + 精确局面
    let rows = db.prepare(
      `SELECT pattern, outcome, confidence FROM strategy_patterns
       WHERE role = ? AND situation_type = ?
       ORDER BY confidence DESC, created_at DESC LIMIT ?`
    ).all(role, situationType, limit);

    // 补充：同阵营 + 同局面（不同角色）
    if (rows.length < 2) {
      const more = db.prepare(
        `SELECT pattern, outcome, confidence FROM strategy_patterns
         WHERE faction = ? AND situation_type = ? AND role != ?
         ORDER BY confidence DESC, created_at DESC LIMIT ?`
      ).all(faction, situationType, role, limit - rows.length);
      rows = [...rows, ...more];
    }

    if (!rows.length) return '';
    const lines = ['【同类局面历史经验】'];
    for (const r of rows) {
      lines.push(`• [${r.outcome === 'win' ? '胜方' : '败方'}经验×${r.confidence}] ${r.pattern}`);
    }
    return lines.join('\n');
  } catch (e) { return ''; }
}

// ─────────────────────────────────────────────────────────────────────────────

function formatAiRecapMemory(room, player, role, recap) {
  const review = recap && recap.review ? recap.review : {};
  const lines = [
    `winner=${room && room.game ? room.game.winner || 'unknown' : 'unknown'}`,
    `role=${role || ''}`,
    `overview=${review.overview || ''}`,
    `speak=${review.speak && review.speak.adjustment ? review.speak.adjustment : ''}`,
    `team=${review.team && review.team.adjustment ? review.team.adjustment : ''}`,
    `vote=${review.vote && review.vote.adjustment ? review.vote.adjustment : ''}`,
    `mission=${review.mission && review.mission.adjustment ? review.mission.adjustment : ''}`,
    `assassination=${review.assassination && review.assassination.adjustment ? review.assassination.adjustment : ''}`,
    `next=${review.nextGamePlan || ''}`,
  ];
  return `post_recap; ai=${player.aiPersonaId || player.nickname}; ${lines.filter(Boolean).join('; ')}`;
}

function recordAiRecapMemory(room, player, role, recap) {
  try {
    const review = recap && recap.review ? recap.review : null;
    if (!review) return;
    if (!review.overview && !review.nextGamePlan) return;
    const aiId = player.aiPersonaId || player.nickname;
    const summary = formatAiRecapMemory(room, player, role, recap);
    db.prepare('INSERT INTO ai_memory(ai_name, summary, created_at) VALUES(?,?,?)').run(aiId, summary, Date.now());
  } catch (e) {
    // no-op
  }
}

function roleInfo(room, playerId, role, roleFactions) {
  const info = { role, seats: [] };
  if (role === '派西维尔') {
    const seats = [];
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      if (r === '梅林' || r === '莫甘娜') seats.push(seatNo(room, id));
    }
    info.seats = seats.filter(Boolean);
  } else if (role === '梅林') {
    const seats = [];
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      if (roleFactions[r] === 'evil' && r !== '莫德雷德') seats.push(seatNo(room, id));
    }
    info.seats = seats.filter(Boolean);
  } else if (roleFactions[role] === 'evil') {
    if (role === '奥伯伦') {
      info.seats = [];
    } else {
      const seats = [];
      for (const id of Object.keys(room.game.assignments)) {
        const r = room.game.assignments[id];
        if (roleFactions[r] === 'evil' && r !== '奥伯伦' && id !== playerId) seats.push(seatNo(room, id));
      }
      info.seats = seats.filter(Boolean);
    }
  }
  return info;
}

function publicState(room) {
  const currentRound = room.game.round;
  const currentAttempt = room.game.attempt;

  // 改动1：跨轮发言历史，最多取最近3轮，每轮最多10条，格式 "R{round}-{attempt}|发言人:内容"
  const recentSpeaks = [];
  if (room.game.speakHistory) {
    // 收集所有已知的 key，按轮次/attempt 排序后取最近3个
    const keys = Object.keys(room.game.speakHistory).sort((a, b) => {
      const [ar, aa] = a.split('-').map(Number);
      const [br, ba] = b.split('-').map(Number);
      return ar !== br ? ar - br : aa - ba;
    });
    const recentKeys = keys.slice(-3);
    for (const key of recentKeys) {
      const msgs = room.game.speakHistory[key] || [];
      for (const m of msgs.slice(-10)) {
        recentSpeaks.push(`R${key}|${m.from}:${m.text}`);
      }
    }
  }

  const trustMap = {};
  if (room.game.trust) {
    for (const id of Object.keys(room.game.trust)) {
      trustMap[seatNo(room, id)] = room.game.trust[id];
    }
  }

  return {
    round: room.game.round,
    leaderSeat: seatNo(room, room.game.leaderId),
    teamSeats: room.game.team.map((id) => seatNo(room, id)).filter(Boolean),
    // 改动2：voteHistory 加上 votesBySeat，格式 { [seatNo]: true/false }
    voteHistory: room.game.voteHistory.map((v) => ({
      round: v.round,
      approved: v.approved,
      approves: v.approves,
      rejects: v.rejects,
      teamSeats: v.team.map((id) => seatNo(room, id)).filter(Boolean),
      votesBySeat: (() => {
        const bySeat = {};
        if (v.votes) {
          for (const [playerId, voted] of Object.entries(v.votes)) {
            const seat = seatNo(room, playerId);
            if (seat) bySeat[seat] = voted;
          }
        }
        return bySeat;
      })(),
    })),
    missionHistory: room.game.missionHistory.map((m) => ({
      round: m.round,
      success: m.success,
      fails: m.fails,
      teamSeats: m.team.map((id) => seatNo(room, id)).filter(Boolean),
    })),
    recentSpeaks,
    trustMap,
    // 改动3：主张追踪，聚合所有轮次的 claims，以座位号为 key
    claims: (() => {
      const result = {};
      const allClaims = room.game.claims || {};
      for (const [key, roundClaims] of Object.entries(allClaims)) {
        for (const [playerId, claim] of Object.entries(roundClaims)) {
          const seat = seatNo(room, playerId);
          if (seat) result[seat] = claim; // 'good'/'bad'/自定义
        }
      }
      return result;
    })(),
  };
}

async function callLLM(system, user, temperature = 0.7) {
  if (!API_KEY) throw new Error('NO_API_KEY');
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return content || '';
}

function parseJSON(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}

// 把游戏状态转为人类可读叙事，避免让 LLM 解析原始 JSON
function buildGameNarrative(room, mySeat, role, roleFactions, info) {
  const lines = [];
  const game = room.game;
  const voteHistory = game.voteHistory || [];
  const missionHistory = game.missionHistory || [];
  const speakHistory = game.speakHistory || {};

  // 任务结果
  if (missionHistory.length) {
    const parts = missionHistory.map(m =>
      `第${m.round}轮[${m.team.map(id => seatNo(room, id)).filter(Boolean).join('、')}号]→${m.success ? '✓成功' : `✗失败(${m.fails}票失败)`}`
    );
    lines.push('任务：' + parts.join('；'));
  }

  // 投票记录（只记录关键信息：反对票、否决）
  if (voteHistory.length) {
    for (const v of voteHistory) {
      const teamStr = v.team.map(id => seatNo(room, id)).filter(Boolean).join('、');
      const noes = v.votes ? Object.entries(v.votes).filter(([, ok]) => !ok).map(([id]) => `${seatNo(room, id)}号`).join(' ') : '';
      const result = v.approved ? '通过' : '否决';
      lines.push(`第${v.round}轮组队[${teamStr}号] ${result}(${v.approves}赞/${v.rejects}反)${noes ? '，反对：' + noes : ''}`);
    }
  }

  // 根据失败任务标记嫌疑座位
  const suspectSeats = new Set();
  for (const m of missionHistory) {
    if (!m.success) m.team.forEach(id => { const s = seatNo(room, id); if (s && s !== mySeat) suspectSeats.add(s); });
  }
  if (suspectSeats.size) lines.push(`失败任务涉及座位：${[...suspectSeats].join('、')}号（其中有坏人出了失败票）`);

  // 近期发言（解析为可读格式）
  const keys = Object.keys(speakHistory).sort((a, b) => {
    const [ar, aa] = a.split('-').map(Number);
    const [br, ba] = b.split('-').map(Number);
    return ar !== br ? ar - br : aa - ba;
  });
  const recentKeys = keys.slice(-2);
  const recentLines = [];
  for (const key of recentKeys) {
    for (const m of (speakHistory[key] || []).slice(-8)) {
      if (!m || !m.text) continue;
      const s = seatNo(room, m.playerId);
      if (s) recentLines.push(`${s}号："${m.text}"`);
    }
  }
  if (recentLines.length) lines.push('近期发言：\n' + recentLines.join('\n'));

  // 我自己说过的话
  const myLines = [];
  for (const arr of Object.values(speakHistory)) {
    for (const m of (arr || [])) {
      if (m && m.text && seatNo(room, m.playerId) === mySeat) {
        myLines.push(m.text);
      }
    }
  }
  const myPrev = myLines.slice(-4);
  if (myPrev.length) lines.push(`我之前说过：${myPrev.map((t, i) => `(${i + 1})${t}`).join('；')}`);

  // 已知信息（角色视野）
  if (role === '梅林' && info.seats.length) {
    lines.push(`【梅林视野】确认坏人：${info.seats.join('、')}号`);
  } else if (role === '派西维尔' && info.seats.length) {
    lines.push(`【派西维尔视野】拇指位（梅林或莫甘娜之一）：${info.seats.join('、')}号`);
  } else if (roleFactions[role] === 'evil' && role !== '奥伯伦' && info.seats.length) {
    lines.push(`【坏人视野】队友：${info.seats.join('、')}号`);
  }

  return lines.join('\n');
}

async function decideSpeak({ room, player, role, roleFactions }) {
  const info          = roleInfo(room, player.id, role, roleFactions);
  const mySeat        = seatNo(room, player.id);
  if (!mySeat) return '';

  const speakHistoryAll  = room.game.speakHistory || {};
  const rolesInGame      = Array.from(new Set(room.roles || []));
  const roleFactionLocal = roleFactions[role] || 'good';
  const currentRound     = room.game.round || 1;
  const playerCount      = (room.seats || []).length;

  // ── 1. 局面分类 + 信念状态 + 情绪寄存器 ──
  const situation  = classifySituation(room, player.id);
  const bs         = computeBeliefState(room, player.id, role, roleFactions);
  const emotion    = computeEmotionalRegister(room, player.id, role, roleFactions);
  const bsText     = formatBeliefStateForPrompt(bs, mySeat);

  // ── 2. 我的历史发言（禁止重复） ──
  const myPreviousSpeeches = [];
  for (const arr of Object.values(speakHistoryAll)) {
    for (const m of (arr || [])) {
      if (m && m.playerId === player.id && m.text) myPreviousSpeeches.push(m.text);
    }
  }

  // ── 3. 被指控检测 ──
  const accusationPattern = new RegExp(`${mySeat}号`);
  const recentLines = [];
  const sortedKeys = Object.keys(speakHistoryAll).sort((a, b) => {
    const [ar, aa] = a.split('-').map(Number);
    const [br, ba] = b.split('-').map(Number);
    return ar !== br ? ar - br : aa - ba;
  });
  for (const key of sortedKeys.slice(-2)) {
    for (const m of (speakHistoryAll[key] || []).slice(-10)) {
      if (m && m.text) recentLines.push(m.text);
    }
  }
  const accusedTexts = recentLines.filter(s =>
    accusationPattern.test(s) && /怀疑|坏人|问题|排水|出局|反对|不信/.test(s)
  );
  const accused = accusedTexts.length > 0 ? accusedTexts.slice(-2).join('；') : null;

  // ── 4. 坏人队友近期发言 ──
  let allySpeeches = [];
  if (roleFactionLocal === 'evil') {
    const assignments = room.game.assignments || {};
    for (const [pid, r] of Object.entries(assignments)) {
      if (pid === player.id || (roleFactions[r] || 'good') !== 'evil' || r === '奥伯伦') continue;
      const allyTalks = [];
      for (const arr of Object.values(speakHistoryAll)) {
        for (const m of (arr || [])) {
          if (m && m.playerId === pid && m.text) allyTalks.push(m.text);
        }
      }
      allyTalks.slice(-2).forEach(t =>
        allySpeeches.push(`${seatNo(room, pid)}号队友说："${t}"`)
      );
    }
  }

  // ── 5. 发言多样性 ──
  const forbiddenIntents = getForbiddenIntents(room, player.id);

  // ── 6. 历史经验检索 ──
  const patternBlock = getRelevantPatterns(role, roleFactionLocal, situation, playerCount);

  // ── 7. Few-shot 示例 ──
  const fewShotBlock = buildFewShotBlock(roleFactionLocal, currentRound, accused, allySpeeches.length ? allySpeeches : null);

  // ── 8. 角色策略 ──
  const roleStrategy = {
    '梅林':   '你知道坏人是谁，绝不直说。用"投票记录""任务失败涉及人员"间接暗示，保护自己。',
    '派西维尔':'你看到两个拇指位（梅林或莫甘娜），保护梅林，不轻易透露你知道谁是梅林。',
    '忠臣':   '靠推理，分析任务失败和投票中的矛盾行为，锁定可疑目标。',
    '刺客':   '伪装好人。留心谁发言最有深度信息量——那很可能是梅林，记在心里。',
    '莫甘娜': '让派西维尔认为你可能是梅林。模仿梅林风格但不要太刻意。',
    '莫德雷德':'梅林看不到你，可以大胆建立好人形象，强推队伍建立信任。',
    '奥伯伦': '你不知道队友，靠自己判断，偷偷让任务失败。',
    '爪牙':   '配合坏人队友，保护核心坏人，制造混乱转移好人视线。',
  };
  const strategyHint = roleStrategy[role] || '用逻辑推理分析任务和投票记录。';

  // ── 9. 构建 system prompt ──
  const forbidStarters = '禁止以下开头：我觉得、我认为、我注意到、大家、说实话、作为、首先、其次、总的来说、从逻辑上。';
  const forbidQuestions = '不要连续使用2个以上反问句，不以疑问句结尾。';
  const forbidIntentStr = forbiddenIntents.length
    ? `本次禁止使用以下发言意图（最近已重复）：${forbiddenIntents.join('、')}。` : '';

  const system =
    `你是阿瓦隆桌游真人玩家，角色：${role}（${roleFactionLocal === 'good' ? '好人' : '坏人'}阵营），座位：${mySeat}号。\n` +
    `策略方向：${strategyHint}\n` +
    `说话风格：${buildPersonaDesc(player)}\n` +
    `当前情绪状态：${emotion.hint}\n` +
    `发言规则：40-80字，像真实玩家说话，可以有情绪和停顿感，不能写成报告或清单，不能暴露身份。${forbidStarters}${forbidQuestions}${forbidIntentStr}\n` +
    `think（内部推理，不超过120字，不展示给其他玩家）：先基于嫌疑评估和情绪状态决定本轮发言方向。\n` +
    (myPreviousSpeeches.length
      ? `【我说过的话——禁止重复相同观点或相同目标】${myPreviousSpeeches.slice(-3).map((t, i) => `(${i + 1})${t}`).join('；')}\n`
      : '') +
    (accused ? `【被指控】有人刚才怀疑我：${accused}。必须回应。\n` : '') +
    (allySpeeches.length ? `【坏人队友说法（保持叙事一致但不要重复他的话）】${allySpeeches.join('；')}\n` : '') +
    (patternBlock ? patternBlock + '\n' : '') +
    (fewShotBlock ? fewShotBlock + '\n' : '') +
    '输出严格JSON，不含其他内容。';

  // ── 10. 构建 user prompt（叙事 + 嫌疑评估） ──
  const narrative = buildGameNarrative(room, mySeat, role, roleFactions, info);
  const user =
    `【第${currentRound}轮，轮到你(${mySeat}号)发言】\n\n` +
    `${bsText}\n\n` +
    `游戏局面：\n${narrative}\n\n` +
    `本局角色配置：${rolesInGame.join('、')}\n` +
    '输出JSON（think不超过120字）：\n' +
    '{"think":"基于嫌疑分析和情绪状态，本轮最优发言方向是...","intent":"accusation|defense|redirect|claim|probe|support|neutral","target":目标座位号或省略,"text":"发言内容40-80字"}';

  const res     = await callLLM(system, user, 0.9);
  const cleaned = res.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const obj     = parseJSON(cleaned, { text: '', intent: 'neutral' });
  const text    = sanitizeSpeech(obj.text || '', rolesInGame);

  // 记录本次发言意图（供下次多样性检测）
  if (text) recordSpeechIntent(room, player.id, obj.intent || 'neutral');

  return hasExplicitIdentityReveal(text) ? '' : text;
}

async function decideTeam({ room, leaderId, role, roleFactions, teamSize }) {
  const leader          = room.players.get(leaderId);
  const info            = roleInfo(room, leaderId, role, roleFactions);
  const bs              = computeBeliefState(room, leaderId, role, roleFactions);
  const bsText          = formatBeliefStateForPrompt(bs, seatNo(room, leaderId));
  const situation       = classifySituation(room, leaderId);
  const faction         = roleFactions[role] || 'good';
  const resolvedSize    = teamSize || (room.game.team ? room.game.team.length : 0);
  const mySeat          = seatNo(room, leaderId);
  const missions        = (room.game && room.game.missionHistory) || [];
  const patternBlock    = getRelevantPatterns(role, faction, situation, (room.seats || []).length);

  // 博弈提示：好人/坏人组队策略差异
  const goodWins  = missions.filter(m => m.success).length;
  const evilWins  = missions.filter(m => !m.success).length;
  let gameTheoryHint = '';
  if (faction === 'good') {
    gameTheoryHint = `好人组队：避开嫌疑分高的座位，优先选嫌疑分低的可信玩家。当前最可疑：${bs.topSuspects.join('、')}号。`;
  } else {
    const evilSeats = info.seats.filter(s => s !== mySeat);
    const needFail  = resolvedSize >= 4 ? 2 : 1; // 大队伍需要2票失败
    gameTheoryHint = `坏人组队：本轮任务需要${needFail}票失败。${evilSeats.length > 0
      ? `队友(${evilSeats.join('、')}号)可带${Math.min(evilSeats.length, needFail)}人，其余用好人补位以帮助过票。`
      : '只有自己是坏人，慎重考虑是否本轮出失败票。'}若队伍明显可疑则难以过票，权衡利弊。`;
  }

  const narrative = buildGameNarrative(room, mySeat, role, roleFactions, info);
  const system =
    `你是阿瓦隆队长，角色：${role}（${faction === 'good' ? '好人' : '坏人'}阵营），座位：${mySeat}号。\n` +
    `组队规则：需选${resolvedSize}人（含自己或不含均可）。${gameTheoryHint}\n` +
    (patternBlock ? patternBlock + '\n' : '') +
    `风格：${buildPersonaDesc(leader)}输出严格JSON，teamSeats为座位号整数数组。`;

  const user =
    `${bsText}\n\n` +
    `游戏局面：\n${narrative}\n\n` +
    `好人已赢${goodWins}局，坏人已赢${evilWins}局。连续否决次数：${room.game.rejectsInRow || 0}。\n` +
    `请选出${resolvedSize}人的队伍（座位号），同时给出简要理由。\n` +
    `输出JSON：{"teamSeats":[座位号数组],"reason":"简要说明"}`;

  const res = await callLLM(system, user, 0.6);
  const cleaned = res.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const obj = parseJSON(cleaned, { teamSeats: [] });
  return Array.isArray(obj.teamSeats) ? obj.teamSeats : [];
}

async function decideVote({ room, playerId, role, roleFactions }) {
  const player      = room.players.get(playerId);
  const info        = roleInfo(room, playerId, role, roleFactions);
  const bs          = computeBeliefState(room, playerId, role, roleFactions);
  const bsText      = formatBeliefStateForPrompt(bs, seatNo(room, playerId));
  const faction     = roleFactions[role] || 'good';
  const mySeat      = seatNo(room, playerId);
  const teamSeats   = (room.game.team || []).map(id => seatNo(room, id)).filter(Boolean);
  const rejectsInRow = room.game.rejectsInRow || 0;
  const missions    = (room.game && room.game.missionHistory) || [];
  const goodWins    = missions.filter(m => m.success).length;
  const evilWins    = missions.filter(m => !m.success).length;

  // 计算当前队伍的嫌疑分合计（供决策参考）
  const teamSuspicion = teamSeats.map(s => ({
    seat: s, score: bs.suspicion[s] || 0.3,
    ev: (bs.evidence[s] || []).slice(-1).join('')
  }));
  const avgTeamSuspicion = teamSuspicion.length
    ? teamSuspicion.reduce((a, b) => a + b.score, 0) / teamSuspicion.length : 0.3;

  // 博弈论提示
  let gameTheoryHint = '';
  if (faction === 'good') {
    if (rejectsInRow >= 4) gameTheoryHint = '已连续否决4次，再否决坏人直接获胜，必须通过。';
    else if (avgTeamSuspicion > 0.6) gameTheoryHint = `队伍平均嫌疑分${Math.round(avgTeamSuspicion*100)}%，偏高，好人应考虑否决。`;
    else if (avgTeamSuspicion < 0.35) gameTheoryHint = `队伍嫌疑分较低，好人可以通过。`;
  } else {
    const evilInTeam = teamSeats.filter(s => (bs.knownAllies || []).includes(s) || s === mySeat);
    if (evilInTeam.length > 0) gameTheoryHint = `队伍中有坏人(${evilInTeam.join('、')}号)，通常应投通过以让任务进行。`;
    else gameTheoryHint = `队伍中没有坏人，可考虑策略性否决，但${rejectsInRow >= 3 ? '连续否决已多，风险较大' : '权衡暴露风险'}。`;
  }

  const situation    = classifySituation(room, playerId);
  const patternBlock = getRelevantPatterns(role, faction, situation, (room.seats || []).length);
  const narrative    = buildGameNarrative(room, mySeat, role, roleFactions, info);

  const system =
    `你是阿瓦隆${role}（${faction === 'good' ? '好人' : '坏人'}阵营，${mySeat}号座位）。\n` +
    `投票原则：${gameTheoryHint}\n` +
    (patternBlock ? patternBlock + '\n' : '') +
    `风格：${buildPersonaDesc(player)}输出严格JSON。`;

  const teamDetail = teamSuspicion.map(t =>
    `${t.seat}号(嫌疑${Math.round(t.score*100)}%${t.ev ? '，' + t.ev : ''})`
  ).join('、');

  const user =
    `${bsText}\n\n` +
    `本轮提议队伍：${teamDetail}\n` +
    `好人已赢${goodWins}局，坏人已赢${evilWins}局，已连续否决${rejectsInRow}次。\n\n` +
    `游戏局面：\n${narrative}\n\n` +
    `输出JSON：{"approve":true或false,"reason":"一句话理由"}`;

  const res = await callLLM(system, user, 0.5);
  const cleaned = res.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const obj = parseJSON(cleaned, { approve: true });
  return !!obj.approve;
}

async function decideMission({ room, playerId, role, roleFactions }) {
  const player = room.players.get(playerId);
  const playerKey = player ? player.aiPersonaId || player.nickname : 'AI';
  const memory = getAiMemory(playerKey, 6).concat(getRecentSummaries(3));
  const system =
    '你是阿瓦隆高水平AI玩家。执行任务时要权衡是否暴露身份、任务阶段和胜负形势。' +
    '坏人要以任务失败获胜为首要目标，可偶尔隐忍，但不应过度藏票。好人必须投成功。尊重你的底牌阵营目标。' +
    '若队伍中有多个坏人且1张失败票已足够让任务失败，通常只需要少量坏人出失败票，避免全部暴露。' +
    '你可能掌握同阵营座位号（info.seats），仅用于判断，不要明说。' +
    `当前AI人格特征：${buildPersonaDesc(player)}输出必须是严格JSON。`;
  const user = JSON.stringify({
    task: 'mission',
    role,
    seat: seatNo(room, playerId),
    teamSeats: room.game.team.map((id) => seatNo(room, id)).filter(Boolean),
    rolesInGame: Array.from(new Set(room.roles || [])),
    style: player && player.aiStyle ? player.aiStyle : '稳健',
    state: publicState(room),
    memory,
    format: { fail: false },
  });
  const res = await callLLM(system, user, 0.4);
  const obj = parseJSON(res, { fail: false });
  if (roleFactions[role] === 'good') return false;
  return !!obj.fail;
}

async function decideAssassinate({ room, assassinId, role, roleFactions, evilIntel }) {
  const assassin = room.players.get(assassinId);
  const assassinKey = assassin ? assassin.aiPersonaId || assassin.nickname : 'AI';
  const memory = getAiMemory(assassinKey, 6).concat(getRecentSummaries(3));
  const info = roleInfo(room, assassinId, role, roleFactions);
  const system =
    '你是阿瓦隆刺客AI，目标是精准刺杀梅林。' +
    '必须基于投票与任务历史进行推理，给出清晰但不泄露内情的理由。' +
    '刺杀目标只能是好人阵营，禁止刺杀坏人同伴或自己。尊重你的底牌阵营目标。' +
    '你可能掌握同阵营座位号（info.seats），不要明说。输出必须是严格JSON。';
  const user = JSON.stringify({
    task: 'assassinate',
    role,
    seat: seatNo(room, assassinId),
    candidates: room.seats.map((id) => seatNo(room, id)).filter(Boolean),
    rolesInGame: Array.from(new Set(room.roles || [])),
    evilIntel: Array.isArray(evilIntel) ? evilIntel : [],
    style: assassin && assassin.aiStyle ? assassin.aiStyle : '推理型',
    info,
    state: publicState(room),
    memory,
    format: { targetSeat: 1, reasoning: 'string' },
  });
  const res = await callLLM(system, user, 0.6);
  const obj = parseJSON(res, { targetSeat: null, reasoning: '' });
  return obj;
}

async function decideEvilIntel({ room, player, role, roleFactions }) {
  const memory = getAiMemory(player.aiPersonaId || player.nickname, 6).concat(getRecentSummaries(3));
  const info = roleInfo(room, player.id, role, roleFactions);
  const system =
    '你是阿瓦隆坏人AI，正在与同伴交换信息，为刺杀梅林做判断。' +
    '请给出你认为的梅林座位号与简短理由（60-120字）。输出必须是严格JSON。';
  const user = JSON.stringify({
    task: 'evil_intel',
    role,
    seat: seatNo(room, player.id),
    rolesInGame: Array.from(new Set(room.roles || [])),
    info,
    state: publicState(room),
    memory,
    format: { guessMerlinSeat: 1, reason: 'string(60-120字)' },
  });
  const res = await callLLM(system, user, 0.5);
  const obj = parseJSON(res, { guessMerlinSeat: null, reason: '' });
  return obj;
}

async function decideRecap({ room, player, role, roleFactions }) {
  const info = roleInfo(room, player.id, role, roleFactions);
  const mySeat = seatNo(room, player.id);
  const actionSummary = buildPlayerActionSummary(room, player.id);
  const fullNarrative = buildFullGameNarrative(room, roleFactions);
  const actionText = buildActionSummaryText(room, player.id, actionSummary, mySeat);
  const faction = roleFactions[role] || 'good';
  const winner = (room.game || {}).winner || 'unknown';
  const rolesInGame = Array.from(new Set(room.roles || []));

  // 角色视野文字
  let knownInfoText = '';
  if (role === '梅林' && info.seats.length) {
    knownInfoText = `【梅林视野】确认坏人座位：${info.seats.join('、')}号`;
  } else if (role === '派西维尔' && info.seats.length) {
    knownInfoText = `【派西维尔视野】梅林或莫甘娜之一：${info.seats.join('、')}号`;
  } else if (faction === 'evil' && role !== '奥伯伦' && info.seats.length) {
    knownInfoText = `【坏人视野】队友座位：${info.seats.join('、')}号`;
  }

  const system =
    `你是阿瓦隆${role}（${faction === 'good' ? '好人' : '坏人'}阵营，${mySeat}号座位）。` +
    `本局${faction === winner ? '你方获胜' : '你方失败'}，${winner === 'good' ? '好人' : '坏人'}阵营赢得比赛。\n` +
    `本局角色配置：${rolesInGame.join('、')}\n` +
    (knownInfoText ? `${knownInfoText}（这是已知事实，不要质疑）\n` : '') +
    `你必须先在 think 字段完成逐步推理，再写复盘。think 字段的推理步骤：\n` +
    `  Step1 逐轮回顾：每轮发生了什么，我做了哪些决策，当时的依据是什么\n` +
    `  Step2 玩家行为分析：每个玩家的发言/投票模式透露了什么信号\n` +
    `  Step3 关键决策评估：哪些决策是对的，哪些是错的，为什么\n` +
    `  Step4 转折点定位：哪一个时刻决定了最终结果\n` +
    `  Step5 改进方向：下局具体要改什么，为什么\n` +
    `think 字段是内部推理过程，不限字数，要真正想清楚再写。review 必须以 think 的推理为基础。\n` +
    `输出严格JSON。`;

  const user =
    `【完整对局记录】\n${fullNarrative}\n\n` +
    `【我(${mySeat}号/${role})的行为记录】\n${actionText}\n\n` +
    `输出JSON（think 不限字数，review 各字段字数见要求）：\n` +
    `{\n` +
    `  "think": "Step1 逐轮回顾：...\\nStep2 玩家分析：...\\nStep3 决策评估：...\\nStep4 转折点：...\\nStep5 改进方向：...",\n` +
    `  "role": "${role}",\n` +
    `  "knownInfo": "角色视野已知信息，或无特殊视野",\n` +
    `  "review": {\n` +
    `    "overview": "整局总结150-250字：关键转折、最终结果、我方整体表现",\n` +
    `    "keyMoments": [{"round":轮次数字, "decision":"我做了什么决策", "outcome":"结果怎样", "assessment":"正确还是失误，为什么，100字以上"}],\n` +
    `    "playerAnalysis": [{"seat":座位号数字, "assessment":"对该玩家的读人判断及依据80字以上，结合他的具体发言和行为"}],\n` +
    `    "speak": {"summary":"我的发言策略复盘100-200字", "bestMove":"最好的一句话原文及原因", "mistake":"最大发言失误及应如何改"},\n` +
    `    "vote": {"summary":"投票决策复盘80-150字", "keyVote":"最关键的一票：具体是哪轮，投了什么，为什么对或错"},\n` +
    `    "mission": {"summary":"任务行为复盘（如未上车可写无记录）"},\n` +
    `    "nextGamePlan": "下一局具体改进计划100-200字，要具体，不要说废话"\n` +
    `  }\n` +
    `}`;

  const res = await callLLM(system, user, 0.6);
  const cleaned = res.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const obj = parseJSON(cleaned, {});
  return { ...obj, info, actionSummary };
}

// ─────────────────────────────────────────────────────────────────────────────
// ──  POST-GAME LEARNING: 从完整对局提炼战略规律，存入 strategy_patterns  ──────
// ─────────────────────────────────────────────────────────────────────────────
async function extractStrategyPatterns(room, roleFactions) {
  if (!room || !room.game) return;
  const winner      = room.game.winner || '';
  const assignments = room.game.assignments || {};
  const playerCount = (room.seats || []).length;
  const fullNarrative = buildFullGameNarrative(room, roleFactions);

  const aiPlayers = room.players
    ? Array.from(room.players.values()).filter(p => p.isAI)
    : [];

  for (const player of aiPlayers) {
    const role    = assignments[player.id];
    if (!role) continue;
    const faction = roleFactions[role] || 'good';
    const won     = faction === winner;
    const mySeat  = seatNo(room, player.id);
    const actionSummary = buildPlayerActionSummary(room, player.id);
    const actionText    = buildActionSummaryText(room, player.id, actionSummary, mySeat);
    const sitType       = classifySituation(room, player.id);

    const system =
      `你是阿瓦隆策略分析专家。从以下对局中，以${role}（${faction === 'good' ? '好人' : '坏人'}阵营，${mySeat}号，` +
      `${won ? '本局获胜' : '本局失败'}）的视角，提炼3-5条具体的战略规律。\n` +
      `每条规律必须：①说明什么局面 ②应该做什么或避免什么 ③为什么。\n` +
      `规律要足够具体，下次遇到类似局面可以直接使用。禁止写泛泛的废话。\n` +
      `situation_type 必须是以下之一：early_game, info_available, first_failure, consecutive_fails, good_leading, evil_needs_one, pre_assassination, under_suspicion\n` +
      `输出严格JSON数组。`;

    const user =
      `【完整对局】\n${fullNarrative}\n\n` +
      `【我(${mySeat}号/${role})的行为】\n${actionText}\n\n` +
      `输出：[{"situation_type":"...","pattern":"规律描述（50-120字）","lesson_type":"do或avoid"}]`;

    try {
      const res     = await callLLM(system, user, 0.4);
      const clean2  = res.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const patterns = parseJSON(clean2, []);
      if (!Array.isArray(patterns)) continue;

      for (const p of patterns) {
        if (!p.pattern || !p.situation_type) continue;

        // 同角色+同局面+相似规律 → 累加 confidence，避免重复
        const existing = db.prepare(
          `SELECT id FROM strategy_patterns WHERE role=? AND situation_type=? AND pattern=?`
        ).get(role, p.situation_type, p.pattern);

        if (existing) {
          db.prepare('UPDATE strategy_patterns SET confidence=confidence+1 WHERE id=?').run(existing.id);
        } else {
          db.prepare(
            `INSERT INTO strategy_patterns(role,faction,situation_type,player_count,pattern,outcome,confidence,created_at)
             VALUES(?,?,?,?,?,?,1,?)`
          ).run(role, faction, p.situation_type, playerCount, p.pattern, won ? 'win' : 'loss', Date.now());
        }
      }
      // 每个角色保留最多 150 条，按 confidence 降序
      db.prepare(
        `DELETE FROM strategy_patterns WHERE role=? AND id NOT IN (
          SELECT id FROM strategy_patterns WHERE role=? ORDER BY confidence DESC, created_at DESC LIMIT 150
        )`
      ).run(role, role);
    } catch (e) { /* best-effort */ }
  }
}

module.exports = {
  recordGameSummary,
  recordAiRecapMemory,
  evaluateGameSpeeches,
  extractStrategyPatterns,
  decideSpeak,
  decideTeam,
  decideVote,
  decideMission,
  decideAssassinate,
  decideRecap,
  decideEvilIntel,
};
