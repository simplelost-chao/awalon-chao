const path = require('path');
const Database = require('better-sqlite3');

const API_KEY = process.env.QWEN_API_KEY || '';
const MODEL = process.env.QWEN_MODEL || 'qwen-plus';
const BASE_URL = process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

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
`);

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
  const speakRound = room.game.speakHistory ? room.game.speakHistory[currentRound] || [] : [];
  const recentSpeaks = speakRound.slice(-30).map((m) => `${m.from}:${m.text}`);
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
    voteHistory: room.game.voteHistory.map((v) => ({
      round: v.round,
      approved: v.approved,
      approves: v.approves,
      rejects: v.rejects,
      teamSeats: v.team.map((id) => seatNo(room, id)).filter(Boolean),
    })),
    missionHistory: room.game.missionHistory.map((m) => ({
      round: m.round,
      success: m.success,
      fails: m.fails,
      teamSeats: m.team.map((id) => seatNo(room, id)).filter(Boolean),
    })),
    recentSpeaks,
    trustMap,
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

async function decideSpeak({ room, player, role, roleFactions }) {
  const memory = getAiMemory(player.aiPersonaId || player.nickname, 6).concat(getRecentSummaries(3));
  const info = roleInfo(room, player.id, role, roleFactions);
  const system =
    '你是阿瓦隆桌游的高水平AI玩家。目标是赢下对局，发言像真人且有策略。' +
    '允许撒谎、冲锋、装弱、装强、转移视线，但不要直接暴露真实身份。' +
    '发言要结合当前轮次、投票/任务结果、队伍结构，长度偏中等(建议30-80字)。' +
    '只允许提及本局实际存在的角色名称，并尊重你的底牌阵营目标。' +
    '如果你是梅林，需要适度向派西维尔传递信息，但要隐蔽，避免被刺客发现。' +
    '如果你是派西维尔，不要公开暴露拇指位，优先隐藏梅林位置，可用模糊表态甚至假跳身份。' +
    '如果你是好人阵营，目标是完成任务并保护梅林身份。' +
    '如果你是坏人阵营，可以硬跳身份/误导/搅局，但严禁直接承认自己是坏人、严禁直接说出队友身份/座位。' +
    '坏人发言要像在争取队伍通过与隐藏信息，而不是自爆。' +
    '必须参考当前发言记录（state.recentSpeaks）进行判断。' +
    '如果你掌握同阵营座位号（info.seats），仅用于隐性判断，不要直说。输出必须是严格JSON。';
  const rolesInGame = Array.from(new Set(room.roles || []));
  const aiStyle = player.aiStyle || '冷静理性，偏结构分析';
  const user = JSON.stringify({
    task: 'speak',
    role,
    seat: seatNo(room, player.id),
    rolesInGame,
    style: aiStyle,
    info,
    state: publicState(room),
    memory,
    format: { text: 'string(中文30-80字，且不提及不存在的角色)' },
  });
  const res = await callLLM(system, user, 0.9);
  const obj = parseJSON(res, { text: '' });
  const text = sanitizeSpeech(obj.text || '', rolesInGame);
  return hasExplicitIdentityReveal(text) ? '' : text;
}

async function decideTeam({ room, leaderId, role, roleFactions, teamSize }) {
  const leader = room.players.get(leaderId);
  const leaderKey = leader ? leader.aiPersonaId || leader.nickname : 'AI';
  const memory = getAiMemory(leaderKey, 6).concat(getRecentSummaries(3));
  const info = roleInfo(room, leaderId, role, roleFactions);
  const system =
    '你是阿瓦隆队长AI，目标是带领阵营获胜。' +
    '选择队伍时要考虑本阵营目标、玩家发言与投票历史、任务结果。' +
    '允许欺骗和试探，但需给出能过票的合理队伍。尊重你的底牌阵营目标。' +
    '如果你是坏人队长，不要机械地把所有坏人都塞进队伍；通常只带足够影响任务的人数（例如只需1张失败票时优先只露1个坏人）。' +
    '组队时必须认真利用任务失败票数量和投票记录，不要忽视明显的失败队伍嫌疑。' +
    '你可能掌握同阵营座位号（info.seats），但不要明说，只能暗中使用。输出必须是严格JSON，teamSeats为座位号数组。';
  const resolvedTeamSize = teamSize || (room.game.team ? room.game.team.length : 0);
  const aiStyle = leader && leader.aiStyle ? leader.aiStyle : '偏结构，稳健';
  const user = JSON.stringify({
    task: 'pick_team',
    role,
    seat: seatNo(room, leaderId),
    teamSize: resolvedTeamSize,
    rolesInGame: Array.from(new Set(room.roles || [])),
    style: aiStyle,
    info,
    state: publicState(room),
    memory,
    format: { teamSeats: [1, 2] },
  });
  const res = await callLLM(system, user, 0.6);
  const obj = parseJSON(res, { teamSeats: [] });
  return Array.isArray(obj.teamSeats) ? obj.teamSeats : [];
}

async function decideVote({ room, playerId, role, roleFactions }) {
  const player = room.players.get(playerId);
  const playerKey = player ? player.aiPersonaId || player.nickname : 'AI';
  const memory = getAiMemory(playerKey, 6).concat(getRecentSummaries(3));
  const info = roleInfo(room, playerId, role, roleFactions);
  const system =
    '你是阿瓦隆高水平AI玩家。投票时考虑队伍结构、历史表现与自身身份目标。' +
    '可以策略性通过或否决以迷惑对手，但不能暴露真实身份。尊重你的底牌阵营目标。' +
    '投票必须结合任务失败票数量与历史队伍结果；如果出现明显高嫌疑队伍（尤其失败票很多的组合），好人不应轻易通过。' +
    '如果你是坏人，队伍里已有坏人时可以考虑策略性投反对来藏票，但要有收益，不要乱投。' +
    '若连续否决过多会导致坏人直接获胜，因此避免无意义否决。输出必须是严格JSON。';
  const user = JSON.stringify({
    task: 'vote_team',
    role,
    seat: seatNo(room, playerId),
    teamSeats: room.game.team.map((id) => seatNo(room, id)).filter(Boolean),
    rolesInGame: Array.from(new Set(room.roles || [])),
    style: player && player.aiStyle ? player.aiStyle : '理性',
    info,
    state: publicState(room),
    memory,
    rejectsInRow: room.game.rejectsInRow || 0,
    format: { approve: true },
  });
  const res = await callLLM(system, user, 0.5);
  const obj = parseJSON(res, { approve: true });
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
    '你可能掌握同阵营座位号（info.seats），仅用于判断，不要明说。输出必须是严格JSON。';
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
  const memory = getAiMemory(player.aiPersonaId || player.nickname, 6).concat(getRecentSummaries(3));
  const info = roleInfo(room, player.id, role, roleFactions);
  const actionSummary = buildPlayerActionSummary(room, player.id);
  const system =
    '你是阿瓦隆AI玩家，请按角色复盘，逻辑必须建立在已知信息之上。' +
    '已知信息(info.seats)必须作为判断基点，不要怀疑自己已知的好/坏阵营身份。' +
    '必须结合 actionSummary 中你自己本局真实做过的发言、组队、投票、任务与刺杀行为。' +
    '复盘要明确说明这些行为当时的思考、哪里做对、哪里做错、下局如何调整。' +
    '输出必须是严格JSON。';
  const rolesInGame = Array.from(new Set(room.roles || []));
  const user = JSON.stringify({
    task: 'recap',
    role,
    seat: seatNo(room, player.id),
    rolesInGame,
    info,
    state: publicState(room),
    actionSummary,
    memory,
    format: {
      role,
      merlin: { evilSeats: [2, 5], guessMordredSeat: 3, reason: 'string(120-200字)' },
      percival: { guessMerlinSeat: 2, guessMorganaSeat: 5, reason: 'string(120-200字)' },
      evil: { teammateRoles: [{ seat: 2, role: '莫甘娜' }], guessMerlinSeat: 6, reason: 'string(120-200字)' },
      loyal: { suspicious: [2, 5], guessMerlinSeat: 4, reason: 'string(120-200字)' },
      review: {
        overview: 'string(80-160字)',
        speak: { thought: 'string(60-120字)', didWell: 'string(40-80字)', mistake: 'string(40-80字)', adjustment: 'string(40-80字)' },
        team: { thought: 'string(60-120字)', didWell: 'string(40-80字)', mistake: 'string(40-80字)', adjustment: 'string(40-80字)' },
        vote: { thought: 'string(60-120字)', didWell: 'string(40-80字)', mistake: 'string(40-80字)', adjustment: 'string(40-80字)' },
        mission: { thought: 'string(60-120字)', didWell: 'string(40-80字)', mistake: 'string(40-80字)', adjustment: 'string(40-80字)' },
        assassination: { thought: 'string(40-100字)', didWell: 'string(20-60字)', mistake: 'string(20-60字)', adjustment: 'string(20-60字)' },
        nextGamePlan: 'string(60-120字)'
      }
    },
  });
  const res = await callLLM(system, user, 0.6);
  const obj = parseJSON(res, {});
  return { ...obj, info, actionSummary };
}

module.exports = {
  recordGameSummary,
  recordAiRecapMemory,
  decideSpeak,
  decideTeam,
  decideVote,
  decideMission,
  decideAssassinate,
  decideRecap,
  decideEvilIntel,
};
