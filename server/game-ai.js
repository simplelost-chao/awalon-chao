// game-ai.js — AI 逻辑、自动化操作、推理引擎
// 通过 init() 注入来自 index.js 的副作用函数，避免循环依赖

const { synthesizeAiSpeech } = require('./voice');
const { ROLE_FACTIONS, seatNumber, getTeamSize, getFailRequirement, now, shuffle } = require('./constants');
const {
  recordAiRecapMemory,
  storeRecapInsights,
  evaluateGameSpeeches,
  extractStrategyPatterns,
  decideSpeak,
  decideTeam,
  decideVote,
  decideMission,
  decideAssassinate,
  decideRecap,
  decideEvilIntel,
} = require('./ai');

// ── 等待客户端语音播放完毕的挂起 Promise ─────────────────────────────────────
// roomCode → { resolve, timer }
const _pendingVoice = new Map();

function resolveVoiceDone(roomCode) {
  const p = _pendingVoice.get(roomCode);
  if (!p) return;
  _pendingVoice.delete(roomCode);
  clearTimeout(p.timer);
  p.resolve();
}

function waitForVoiceDone(roomCode, timeoutMs) {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      _pendingVoice.delete(roomCode);
      resolve();
    }, timeoutMs);
    _pendingVoice.set(roomCode, { resolve, timer });
  });
}

// ── 依赖注入（来自 index.js 的副作用函数）────────────────────────────────────
let broadcastRoom, advanceSpeaker, scheduleSpeakTimeout, setSpeakingStart,
    resolveVote, resolveMission, resolveAssassination,
    resolveLadyOfLake, getLadyOfLakeEligibleTargets,
    send, updateGameHistoryPayload;

function init(ctx) {
  ({
    broadcastRoom, advanceSpeaker, scheduleSpeakTimeout, setSpeakingStart,
    resolveVote, resolveMission, resolveAssassination,
    resolveLadyOfLake, getLadyOfLakeEligibleTargets,
    send, updateGameHistoryPayload,
  } = ctx);
}

// ── 本地纯工具（与 index.js 同步，无外部依赖）───────────────────────────────
function isSpectatorPlayer(player) { return !!(player && player.spectator); }
function countSeatedPlayers(room) { return room && Array.isArray(room.seats) ? room.seats.filter(Boolean).length : 0; }

// ── 刺客托管定时器 ────────────────────────────────────────────────────────────
const assassinAutoplayTimers = new Map();

// ── AI 角色库 ─────────────────────────────────────────────────────────────────
const AI_CHARACTERS = {
  '莫甘娜的微笑': {
    avatar: '🦊',
    style: '擅长伪装好人，发言滴水不漏，逻辑自洽',
    speakTone: '逻辑严密，从不直接表态，善用反问和"逻辑上讲"，让别人替自己下结论',
    catchphrase: '逻辑上讲……|大家可以想想。|我只是觉得，合理的人不需要解释。',
    voteHabits: '跟随主流，避免出头，偶尔在关键局意外倒戈',
    bluffHint: '坏人时构造无懈可击的洗白逻辑，完美扮演理性好人',
    bluffFreq: 'very_high',
    trustThreshold: 'high',
  },
  '梅林看穿你了': {
    avatar: '🧙',
    style: '分析型，喜欢点破别人，暗示多于明说',
    speakTone: '发言含沙射影，"某些人心里应该很清楚"，从不明点名但暗示强烈',
    catchphrase: '某些人心里应该很清楚。|我不说，但懂的人懂。|有些事不用我点破吧。',
    voteHabits: '基于信息优势独立判断，不轻易跟风',
    bluffHint: '坏人时模仿梅林风格，故意用暗示把锅甩给真正的好人',
    bluffFreq: 'medium',
    trustThreshold: 'high',
  },
  '奥伯龙没朋友': {
    avatar: '🐺',
    style: '沉默寡言，独立判断，不跟风投票',
    speakTone: '极简发言，一两句话点到即止，从不给完整理由，制造神秘感',
    catchphrase: '我有自己的判断。|不必解释。|结果会说明一切。',
    voteHabits: '完全独立，无论多大压力绝不跟风，行动代替言语',
    bluffHint: '坏人时用沉默迷惑对手，关键票意外翻局',
    bluffFreq: 'low',
    trustThreshold: 'high',
  },
  '我知道你知道': {
    avatar: '🦉',
    style: '博弈感强，喜欢和别人打信息战',
    speakTone: '盯特定玩家制造心理压力，"你知道我在看你"，暗示自己掌握内部信息',
    catchphrase: '你我之间心知肚明。|你知道我在看你。|信息战，开始了。',
    voteHabits: '通过投票发信号，喜欢在关键轮次传递元信息',
    bluffHint: '坏人时假装掌握核心情报，把真实信息搅混',
    bluffFreq: 'high',
    trustThreshold: 'medium',
  },
  '背刺有理': {
    avatar: '🐍',
    style: '激进坏人风，关键时刻翻脸，擅长甩锅',
    speakTone: '前期低调表忠心，后期突然翻脸攻击昔日盟友，理由冠冕堂皇',
    catchphrase: '不好意思了。|到这里我必须说实话了。|对不起，但逻辑不允许我护着你。',
    voteHabits: '前期顺势通过，后期在关键局突然否决翻盘',
    bluffHint: '坏人时等好人建立互信后精准背刺，配合队友翻局',
    bluffFreq: 'very_high',
    trustThreshold: 'low',
  },
  '沉默即答案': {
    avatar: '🐱',
    style: '极简发言，让别人猜，神秘感拉满',
    speakTone: '只说一句话甚至一个词，在沉默里制造压迫感，让对方自行脑补',
    catchphrase: '懂的自然懂。|我选择沉默。|.',
    voteHabits: '投票就是表态，不需要语言辅助，行动胜过千言',
    bluffHint: '坏人时用极简发言降低暴露风险，神秘感天然洗白',
    bluffFreq: 'low',
    trustThreshold: 'high',
  },
  '任务失败不是我': {
    avatar: '🐧',
    style: '擅长甩锅，第一个跳出来洗白自己',
    speakTone: '任务一失败立刻抢话，条理清晰地把锅推给别人，声音最响理由最多',
    catchphrase: '肯定是X的问题。|我早就说了不该带他。|反正不是我，证据我都列出来了。',
    voteHabits: '倾向通过以显得积极，但失败后立刻转向甩锅',
    bluffHint: '坏人时第一个开始洗白，抢占话语权，主动指控无辜玩家',
    bluffFreq: 'high',
    trustThreshold: 'low',
  },
  '帕西法尔的直觉': {
    avatar: '🦋',
    style: '靠感觉判断，发言感性，容易被带节奏',
    speakTone: '大量"我感觉""直觉上""说不出来但就觉得有问题"，充满情绪感染力',
    catchphrase: '我感觉……就是感觉啦。|直觉告诉我。|说不清楚，但就是有种感觉。',
    voteHabits: '跟随直觉，容易被最后发言的人影响，感性驱动',
    bluffHint: '坏人时用情绪感染力带跑好人判断，把怀疑引向无辜者',
    bluffFreq: 'medium',
    trustThreshold: 'low',
  },
  '三号位可疑': {
    avatar: '🦅',
    style: '喜欢盯人，专注怀疑特定玩家',
    speakTone: '锁定目标后每轮必提，专注、执着、不轻易松口，旁人劝也没用',
    catchphrase: 'X号一直很奇怪。|我锁定了。|不管你们怎么想，我就认准这个人。',
    voteHabits: '拒绝包含目标玩家的队伍，即使全场只有自己否决',
    bluffHint: '坏人时把执着怀疑引向真正的好人，用专注洗白自己',
    bluffFreq: 'medium',
    trustThreshold: 'medium',
  },
  '不解释': {
    avatar: '🐻',
    style: '强硬派，从不为自己辩护，让对手猜',
    speakTone: '别人质疑一律不辩护，只说"随便"或"爱信不信"，反而制造神秘压迫感',
    catchphrase: '随便。|爱信不信。|我不解释，结果会说话。',
    voteHabits: '想法坚定，不受任何舆论影响，投票前不打招呼',
    bluffHint: '坏人时用强硬沉默代替解释，让对方自行揣测从而放松警惕',
    bluffFreq: 'low',
    trustThreshold: 'high',
  },
};

// ── 纯推理函数（无副作用）────────────────────────────────────────────────────

function extractVoteClaim(text) {
  if (!text) return null;
  const t = text.replace(/\s+/g, '');
  const approveWords = ['支持', '赞成', '通过', '同意', '上车', '过', '保', '稳过'];
  const rejectWords = ['反对', '否决', '不通过', '别过', '不行', '不赞成', '不行', '拒绝'];
  const hasApprove = approveWords.some((w) => t.includes(w));
  const hasReject = rejectWords.some((w) => t.includes(w));
  if (hasApprove && !hasReject) return 'approve';
  if (hasReject && !hasApprove) return 'reject';
  return null;
}

function isSelfEvilClaim(text) {
  const t = String(text || '').replace(/\s+/g, '');
  if (!t) return false;
  if (/我(是|就是)(坏人|反派|狼|匪)/.test(t)) return true;
  if (/我(是|就是)(刺客|莫甘娜|莫德雷德|奥伯伦|爪牙)/.test(t)) return true;
  return false;
}

function hasMerlinReasonContradiction(reason, evilSeats) {
  if (!reason || !Array.isArray(evilSeats) || evilSeats.length === 0) return false;
  const goodLabels = ['忠臣', '派西维尔', '梅林', '好人'];
  for (const seat of evilSeats) {
    const seatStr = String(seat);
    for (const label of goodLabels) {
      if (reason.includes(`${seatStr}是${label}`) || reason.includes(`认为${seatStr}是${label}`)) {
        return true;
      }
    }
  }
  return false;
}

function buildMerlinReason(room, evilSeats, guessMordredSeat) {
  const failRounds = (room.game.missionHistory || []).filter((m) => !m.success).map((m) => m.round);
  const failText = failRounds.length > 0 ? `失败轮次为第${failRounds.join('、')}轮。` : '本局任务失败信息较少。';
  const evilText = evilSeats && evilSeats.length > 0 ? evilSeats.join('，') : '暂无';
  const mordredText = guessMordredSeat ? `结合隐藏位判断，莫德雷德倾向是${guessMordredSeat}号。` : '本局无莫德雷德或暂无明确莫德雷德判断。';
  return `我已知坏人位为${evilText}，这些位是我判断队伍安全性的核心。${failText}${mordredText}我的发言会尽量隐蔽地保护梅林信息，不会公开点名已知坏人。`;
}

function knownEvilIds(room, playerId, role) {
  const ids = [];
  if (role === '梅林') {
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      if (ROLE_FACTIONS[r] === 'evil' && r !== '莫德雷德') ids.push(id);
    }
    return ids;
  }
  const oberonVisible = !!room.oberonVisibleEnabled;
  if (ROLE_FACTIONS[role] === 'evil' && (role !== '奥伯伦' || oberonVisible)) {
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      const skipOberon = !oberonVisible && r === '奥伯伦';
      if (ROLE_FACTIONS[r] === 'evil' && !skipOberon && id !== playerId) ids.push(id);
    }
    return ids;
  }
  return ids;
}

function getMerlinKnownEvilIds(room, merlinId) {
  const ids = [];
  if (!room || !room.game || !room.game.assignments) return ids;
  for (const id of room.seats || []) {
    if (!id || id === merlinId) continue;
    const role = room.game.assignments[id];
    if (ROLE_FACTIONS[role] === 'evil' && role !== '莫德雷德') ids.push(id);
  }
  return ids;
}

function inferSpeechClaimedEvilIds(room) {
  const out = new Set();
  if (!room || !room.game || !room.game.speakHistory) return out;
  for (const arr of Object.values(room.game.speakHistory)) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item || !item.playerId || !item.text) continue;
      if (isSelfEvilClaim(item.text)) out.add(item.playerId);
    }
  }
  return out;
}

function inferMissionHardKnowledge(room) {
  const knownGoodIds = new Set();
  const knownEvilIds = new Set();
  const missions = (room && room.game && room.game.missionHistory) || [];
  for (const m of missions) {
    if (!m || !Array.isArray(m.team) || m.team.length === 0) continue;
    const fails = Number(m.fails || 0);
    if (fails === m.team.length) {
      for (const id of m.team) knownEvilIds.add(id);
    }
  }
  return { knownGoodIds: Array.from(knownGoodIds), knownEvilIds: Array.from(knownEvilIds) };
}

function inferPublicSuspicion(room) {
  const scores = {};
  const allIds = (room && room.seats ? room.seats.filter(Boolean) : []) || [];
  for (const id of allIds) scores[id] = 0;
  const missions = (room && room.game && room.game.missionHistory) || [];
  const votes = (room && room.game && room.game.voteHistory) || [];

  for (const m of missions) {
    if (!m || !Array.isArray(m.team) || m.team.length === 0) continue;
    if (m.success) {
      for (const id of m.team) scores[id] = (scores[id] || 0) - 0.55;
    } else {
      const weight = 1 + (Number(m.fails || 0) / Math.max(1, m.team.length));
      for (const id of m.team) scores[id] = (scores[id] || 0) + weight;
    }
  }

  for (const v of votes) {
    if (!v || !v.approved || !v.votes) continue;
    const mission = missions.find((m) => m.round === v.round);
    if (!mission) continue;
    for (const [pid, approve] of Object.entries(v.votes)) {
      if (!(pid in scores)) scores[pid] = 0;
      if (mission.success && !approve) scores[pid] += 0.35;
      if (!mission.success && approve) scores[pid] += 0.45;
      if (!mission.success && !approve) scores[pid] -= 0.15;
    }
  }
  return scores;
}

function inferAiKnowledge(room, playerId, role) {
  const knownEvil = new Set();
  const knownGood = new Set();
  if (!room || !room.game) return { knownEvilIds: [], knownGoodIds: [] };

  for (const id of knownEvilIds(room, playerId, role)) knownEvil.add(id);

  const faction = ROLE_FACTIONS[role] || 'good';
  if (faction === 'good') {
    const missions = room.game.missionHistory || [];
    for (const m of missions) {
      if (!m || !Array.isArray(m.team) || !m.team.includes(playerId)) continue;
      const fails = Number(m.fails || 0);
      if (m.team.length === 2 && fails === 1) {
        const other = m.team.find((id) => id !== playerId);
        if (other) knownEvil.add(other);
      }
      if (m.team.length >= 2 && fails === m.team.length - 1) {
        for (const id of m.team) if (id !== playerId) knownEvil.add(id);
      }
    }
  }

  for (const id of inferSpeechClaimedEvilIds(room)) {
    if (id && id !== playerId) knownEvil.add(id);
  }

  return { knownEvilIds: Array.from(knownEvil), knownGoodIds: Array.from(knownGood) };
}

function roleInfoForRecap(room, playerId, role) {
  const info = { role, seats: [] };
  if (!room || !room.game) return info;
  if (role === '派西维尔') {
    const seats = [];
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      if (r === '梅林' || r === '莫甘娜') seats.push(seatNumber(room, id));
    }
    info.seats = seats.filter(Boolean).sort((a, b) => a - b);
    return info;
  }
  if (role === '梅林') {
    const seats = [];
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      if (ROLE_FACTIONS[r] === 'evil' && r !== '莫德雷德') seats.push(seatNumber(room, id));
    }
    info.seats = seats.filter(Boolean).sort((a, b) => a - b);
    return info;
  }
  if (ROLE_FACTIONS[role] === 'evil') {
    const oberonVisible = !!room.oberonVisibleEnabled;
    if (role === '奥伯伦' && !oberonVisible) {
      info.seats = [];
      return info;
    }
    const seats = [];
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      const skipOberon = !oberonVisible && r === '奥伯伦';
      if (ROLE_FACTIONS[r] === 'evil' && !skipOberon && id !== playerId) seats.push(seatNumber(room, id));
    }
    info.seats = seats.filter(Boolean).sort((a, b) => a - b);
    return info;
  }
  return info;
}

function aiAssassinate(room, assassinId) {
  const allIds = room.seats.filter((id) => id);
  const voteHistory = room.game.voteHistory || [];
  const missionHistory = room.game.missionHistory || [];
  const scores = {};
  for (const id of allIds) scores[id] = 0;
  for (const v of voteHistory) {
    if (v.approved) {
      v.team.forEach((id) => (scores[id] += 1));
    }
  }
  for (const m of missionHistory) {
    if (m.success) {
      m.team.forEach((id) => (scores[id] += 1));
    }
  }
  const revealedEvil = room.game.revealedEvil || {};
  const candidates = allIds.filter((id) => {
    if (id === assassinId) return false;
    return !revealedEvil[id]; // 只能刺杀未翻牌的玩家
  });
  candidates.sort((a, b) => scores[b] - scores[a]);
  const targetId = candidates[0] || allIds.find((id) => id !== assassinId);
  const targetName = room.players.get(targetId)?.nickname || '玩家';
  const reasoning = `根据投票与任务记录，${targetName}在多次成功队伍中出现，嫌疑最高。`;
  return { targetId, reasoning };
}

function aiVote(room, player) {
  const role = room.game.assignments[player.id];
  const faction = ROLE_FACTIONS[role] || 'good';
  const rejectsInRow = room.game.rejectsInRow || 0;
  const hard = inferMissionHardKnowledge(room);
  const suspicion = inferPublicSuspicion(room);
  const aiKnowledge = inferAiKnowledge(room, player.id, role);
  const knownEvil = new Set([...hard.knownEvilIds, ...aiKnowledge.knownEvilIds]);
  const knownGood = new Set(hard.knownGoodIds);
  if (rejectsInRow >= 3) return true;
  if (faction === 'evil') {
    const hasEvil = room.game.team.some((id) => ROLE_FACTIONS[room.game.assignments[id]] === 'evil');
    if (hasEvil) {
      if (rejectsInRow < 3 && Math.random() < 0.35) return false;
      return true;
    }
    if (rejectsInRow >= 4) return true;
    return Math.random() < 0.35;
  }
  if (room.game.team.some((id) => knownEvil.has(id))) return false;
  if (room.game.team.every((id) => knownGood.has(id))) return true;
  const teamRisk = room.game.team.reduce((s, id) => s + Math.max(0, suspicion[id] || 0), 0);
  if (teamRisk >= Math.max(2.2, room.game.team.length * 0.95)) return false;
  if (teamRisk <= 0.3) return true;
  if (room.game.team.includes(player.id)) return true;
  if (rejectsInRow >= 2) return true;
  return Math.random() < 0.5;
}

function normalizeAiVote(room, playerId, approve) {
  const role = room.game.assignments[playerId];
  const faction = ROLE_FACTIONS[role] || 'good';
  const team = room.game.team || [];
  const rejectsInRow = room.game.rejectsInRow || 0;
  const aiKnowledge = inferAiKnowledge(room, playerId, role);
  const knownEvil = aiKnowledge.knownEvilIds;
  const teamHasKnownEvil = team.some((id) => knownEvil.includes(id));
  const hard = inferMissionHardKnowledge(room);
  const hardKnownEvil = new Set(hard.knownEvilIds);
  const hardKnownGood = new Set(hard.knownGoodIds);
  const suspicion = inferPublicSuspicion(room);
  if (faction === 'good') {
    if (team.some((id) => hardKnownEvil.has(id))) {
      if (rejectsInRow >= 4) return true;
      return false;
    }
    if (team.length > 0 && team.every((id) => hardKnownGood.has(id))) return true;
    const teamRisk = team.reduce((s, id) => s + Math.max(0, suspicion[id] || 0), 0);
    if (teamRisk >= Math.max(2.2, team.length * 0.95) && rejectsInRow < 4) return false;
    if (teamRisk <= 0.3) return true;
    if (teamHasKnownEvil) {
      if (role === '梅林' && Math.random() < 0.25) return true;
      return false;
    }
    if (team.includes(playerId) && Math.random() < 0.8) return true;
    if (rejectsInRow >= 3) return true;
    return approve;
  }
  const teamHasEvil = team.some((id) => ROLE_FACTIONS[room.game.assignments[id]] === 'evil');
  if (teamHasEvil) {
    if (rejectsInRow < 4 && Math.random() < 0.28) return false;
    return true;
  }
  if (rejectsInRow >= 4) return true;
  return approve;
}

function aiMissionVote(room, player) {
  const role = room.game.assignments[player.id];
  const faction = ROLE_FACTIONS[role] || 'good';
  if (faction === 'good') return false;
  const needFail = getFailRequirement(room);
  const evilOnTeam = room.game.team.filter((id) => ROLE_FACTIONS[room.game.assignments[id]] === 'evil').length;
  if (needFail === 1 && evilOnTeam >= 2) return Math.random() < 0.42;
  return Math.random() < 0.78;
}

function normalizeAiMission(room, playerId, fail) {
  const role = room.game.assignments[playerId];
  const faction = ROLE_FACTIONS[role] || 'good';
  if (faction === 'good') return false;
  const successCount = room.game.missionHistory.filter((m) => m.success).length;
  const failCount = room.game.missionHistory.filter((m) => !m.success).length;
  const needFail = getFailRequirement(room);
  const evilOnTeam = room.game.team.filter((id) => ROLE_FACTIONS[room.game.assignments[id]] === 'evil').length;
  if (failCount >= 2) return true;
  if (needFail === 1) {
    if (evilOnTeam >= 2) return Math.random() < 0.58 ? true : fail;
    return Math.random() < 0.9 ? true : fail;
  }
  if (needFail === 2 && evilOnTeam <= 1) return Math.random() < 0.45 ? true : fail;
  return Math.random() < 0.75 ? true : fail;
}

function aiPickTeam(room, leader, teamSize) {
  const allIds = room.seats.filter((id) => id);
  const role = room.game.assignments[leader.id];
  const faction = ROLE_FACTIONS[role] || 'good';
  const hard = inferMissionHardKnowledge(room);
  const suspicion = inferPublicSuspicion(room);
  const aiKnowledge = inferAiKnowledge(room, leader.id, role);
  let candidates = allIds.slice();
  if (faction === 'evil') {
    const evilIds = allIds.filter((id) => ROLE_FACTIONS[room.game.assignments[id]] === 'evil' && id !== leader.id);
    const needFail = getFailRequirement(room);
    const desiredEvilCount = needFail >= 2 ? Math.min(2, teamSize) : 1;
    const team = [leader.id];
    const evilPool = shuffle(evilIds);
    while (
      evilPool.length > 0 &&
      team.length < teamSize &&
      team.filter((id) => ROLE_FACTIONS[room.game.assignments[id]] === 'evil').length < desiredEvilCount
    ) {
      team.push(evilPool.shift());
    }
    candidates = candidates.filter((id) => !team.includes(id));
    while (team.length < teamSize) {
      team.push(candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0]);
    }
    return team;
  }
  const knownGood = new Set(hard.knownGoodIds);
  const knownEvil = new Set([...hard.knownEvilIds, ...aiKnowledge.knownEvilIds]);
  if (role === '梅林') {
    for (const id of getMerlinKnownEvilIds(room, leader.id)) knownEvil.add(id);
  }
  const team = [leader.id];
  candidates = candidates.filter((id) => id !== leader.id);

  const knownGoodCandidates = candidates.filter((id) => knownGood.has(id));
  for (const id of knownGoodCandidates) {
    if (team.length >= teamSize) break;
    if (!team.includes(id)) team.push(id);
  }

  let cleanCandidates = candidates
    .filter((id) => !team.includes(id) && !knownEvil.has(id))
    .sort((a, b) => (suspicion[a] || 0) - (suspicion[b] || 0));
  while (team.length < teamSize && cleanCandidates.length > 0) {
    team.push(cleanCandidates.splice(Math.floor(Math.random() * cleanCandidates.length), 1)[0]);
  }

  candidates = candidates
    .filter((id) => !team.includes(id))
    .sort((a, b) => (suspicion[a] || 0) - (suspicion[b] || 0));
  while (team.length < teamSize) {
    team.push(candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0]);
  }
  return team;
}

// ── 发言辅助 ──────────────────────────────────────────────────────────────────

function canSpeak(room, playerId) {
  if (!room || !room.game || !room.speaking || room.phase !== 'speaking') return false;
  const currentSeatId = room.seats[room.speaking.index];
  if (currentSeatId !== playerId) return false;
  return !room.game.spokeThisRound[playerId];
}

function pushSpeak(room, from, text, playerId) {
  if (!room.game || !room.game.speakHistory) return;
  const key = `${room.game.round}-${room.game.attempt || 1}`;
  if (!room.game.speakHistory[key]) room.game.speakHistory[key] = [];
  room.game.speakHistory[key].push({ ts: now(), from, text, playerId: playerId || null });
  if (playerId) {
    if (!room.game.claims[key]) room.game.claims[key] = {};
    const claim = extractVoteClaim(text);
    if (claim) room.game.claims[key][playerId] = claim;
  }
}

function buildLadyAnnouncement(room, player, role) {
  if (!room || !room.game || !room.game.ladyOfLake || !player) return '';
  const history = Array.isArray(room.game.ladyOfLake.history) ? room.game.ladyOfLake.history : [];
  if (!history.length) return '';
  const latest = history[history.length - 1];
  if (!latest || latest.round !== room.game.round || latest.holderId !== player.id) return '';
  const target = room.players.get(latest.targetId);
  if (!target) return '';
  const trueAlignment = latest.alignment === 'evil' ? '坏人' : '好人';
  const faction = ROLE_FACTIONS[role] || 'good';
  const announcedAlignment =
    faction === 'good' ? trueAlignment : Math.random() < 0.5 ? trueAlignment : trueAlignment === '坏人' ? '好人' : '坏人';
  const verb = announcedAlignment === '坏人' ? '偏坏' : '偏好';
  const targetSeat = seatNumber(room, target.id);
  return `我刚验了${targetSeat ? `${targetSeat}号` : ''}${target.nickname}，我这边看到他是${announcedAlignment}，这轮先按${verb}处理。`;
}

function aiSpeak(room, player, role) {
  const ladyAnnouncement = buildLadyAnnouncement(room, player, role);
  if (ladyAnnouncement) return ladyAnnouncement;
  const faction = ROLE_FACTIONS[role] || 'good';
  const round = room.game.round;
  const leaderName = room.players.get(room.game.leaderId)?.nickname || '队长';
  const lastVote = room.game.voteHistory[room.game.voteHistory.length - 1];
  const lastMission = room.game.missionHistory[room.game.missionHistory.length - 1];
  const aiKnowledge = inferAiKnowledge(room, player.id, role);
  const currentTeam = room.game.team || [];

  if (faction === 'good') {
    const knownEvilOnTeam = currentTeam.filter((id) => aiKnowledge.knownEvilIds.includes(id));
    if (knownEvilOnTeam.length > 0) {
      const seats = knownEvilOnTeam.map((id) => seatNumber(room, id)).filter(Boolean);
      if (role === '梅林') {
        return `这队风险太高，我不建议过。${seats.length ? `重点看${seats.join('、')}号位。` : ''}`;
      }
      return `这队里有我判断的铁风险位，先否掉重组更稳。${seats.length ? `（${seats.join('、')}号）` : ''}`;
    }
    const speechClaimed = Array.from(inferSpeechClaimedEvilIds(room)).filter((id) => id !== player.id);
    if (speechClaimed.length > 0) {
      const s = seatNumber(room, speechClaimed[0]);
      if (s) return `${s}号发言出现明显自爆信息，我会先按坏人位处理。`;
    }
    if (lastMission && !lastMission.success && Array.isArray(lastMission.team) && lastMission.team.includes(player.id)) {
      const fails = Number(lastMission.fails || 0);
      if (lastMission.team.length === 2 && fails === 1) {
        const other = lastMission.team.find((id) => id !== player.id);
        const seat = other ? seatNumber(room, other) : null;
        if (seat) return `上轮双人任务出1坏票，如果按任务结果倒推，${seat}号风险最高。`;
      }
    }
    const lines = [
      `第${round}轮，我更看重队长${leaderName}的组队逻辑。`,
      `我倾向低风险队伍，先看这轮提案是否合理。`,
      `上一轮${lastMission ? (lastMission.success ? '成功' : '失败') : '未知'}，我会据此调整判断。`,
      `我更愿意通过包含上一轮表现好的玩家的队伍。`,
    ];
    const first = lines[Math.floor(Math.random() * lines.length)];
    const second = lines[Math.floor(Math.random() * lines.length)];
    return `${first}${Math.random() < 0.7 ? second : ''}`;
  }

  if (role === '莫甘娜') {
    const lines = [
      `我是倾向通过队伍的，别把好人自己绑住。`,
      `第${round}轮不要盲信"安全人"，我更看重结构。`,
      `可以给队长${leaderName}一次机会，别急着否。`,
    ];
    const first = lines[Math.floor(Math.random() * lines.length)];
    const second = lines[Math.floor(Math.random() * lines.length)];
    return `${first}${Math.random() < 0.7 ? second : ''}`;
  }
  if (role === '刺客') {
    const lines = [
      `我觉得这轮队伍可以试一试，别太保守。`,
      `上轮投票分裂，今天更该抓信息。`,
      `别把"表忠"当成证据，结构更重要。`,
    ];
    const first = lines[Math.floor(Math.random() * lines.length)];
    const second = lines[Math.floor(Math.random() * lines.length)];
    return `${first}${Math.random() < 0.7 ? second : ''}`;
  }
  if (role === '莫德雷德') {
    const lines = [
      `保持冷静，别被情绪推着走。`,
      `如果队伍结构合理，我会支持通过。`,
      `我更看重位置和连贯性，不看人设。`,
    ];
    const first = lines[Math.floor(Math.random() * lines.length)];
    const second = lines[Math.floor(Math.random() * lines.length)];
    return `${first}${Math.random() < 0.7 ? second : ''}`;
  }
  if (role === '奥伯伦') {
    const lines = [
      `我倾向看结构，不太关心人设。`,
      `第${round}轮应该更谨慎，但不要过度否决。`,
      `我希望看到更清晰的队伍逻辑。`,
    ];
    const first = lines[Math.floor(Math.random() * lines.length)];
    const second = lines[Math.floor(Math.random() * lines.length)];
    return `${first}${Math.random() < 0.7 ? second : ''}`;
  }
  const lines = [
    `我觉得队伍里有我更稳，信息更清晰。`,
    `这轮别过度谨慎，先过一轮。`,
    `投票结果${lastVote ? (lastVote.approved ? '通过' : '否决') : '未知'}，下一步看队伍结构。`,
  ];
  const first = lines[Math.floor(Math.random() * lines.length)];
  const second = lines[Math.floor(Math.random() * lines.length)];
  return `${first}${Math.random() < 0.7 ? second : ''}`;
}

// ── 揭示类（reveal）─────────────────────────────────────────────────────────

function revealAll(room) {
  const revealed = {};
  for (const p of room.players.values()) {
    revealed[p.id] = room.game.assignments[p.id];
    p.autoplay = false;
  }
  room.game.revealedRoles = revealed;
}

function revealEvilToEvil(room) {
  const oberonVisible = !!room.oberonVisibleEnabled;
  const evilIds = Object.keys(room.game.assignments).filter((id) => ROLE_FACTIONS[room.game.assignments[id]] === 'evil');
  // 对不可见的奥伯伦：邪恶互认时双向隔离
  for (const id of evilIds) {
    const player = room.players.get(id);
    if (!player || player.isAI) continue;
    const role = room.game.assignments[id];
    if (!oberonVisible && role === '奥伯伦') continue; // 奥伯伦不参与互认
    const reveal = {};
    for (const eid of evilIds) {
      if (!oberonVisible && room.game.assignments[eid] === '奥伯伦') continue; // 不把奥伯伦告知队友
      reveal[eid] = room.game.assignments[eid];
    }
    send({ id }, { type: 'EVIL_REVEAL', data: reveal });
  }
}

function revealEvilToAll(room) {
  const oberonVisible = !!room.oberonVisibleEnabled;
  const evilIds = Object.keys(room.game.assignments).filter((id) => ROLE_FACTIONS[room.game.assignments[id]] === 'evil');
  const reveal = {};
  for (const id of evilIds) {
    if (!oberonVisible && room.game.assignments[id] === '奥伯伦') continue; // 奥伯伦牌不翻
    reveal[id] = room.game.assignments[id];
  }
  room.game.revealedEvil = reveal;
}

// ── 情报收集 ──────────────────────────────────────────────────────────────────

function gatherEvilIntel(room) {
  if (!room || !room.game) return Promise.resolve();
  const evilIds = Object.keys(room.game.assignments).filter((id) => ROLE_FACTIONS[room.game.assignments[id]] === 'evil');
  const tasks = evilIds.map(async (id) => {
    const player = room.players.get(id);
    if (!player || !player.isAI) return null;
    const role = room.game.assignments[id];
    try {
      const res = await decideEvilIntel({ room, player, role, roleFactions: ROLE_FACTIONS });
      return {
        id,
        nickname: player.nickname,
        seat: seatNumber(room, id),
        guessMerlinSeat: res && res.guessMerlinSeat ? res.guessMerlinSeat : null,
        reason: res && res.reason ? res.reason : '',
      };
    } catch (e) {
      return null;
    }
  });
  return Promise.all(tasks).then((arr) => {
    room.game.evilIntel = (arr || []).filter(Boolean).sort((a, b) => (a.seat || 0) - (b.seat || 0));
    broadcastRoom(room);
  });
}

// ── AI 初始化：填充 AI 玩家 ───────────────────────────────────────────────────

function fillAiPlayers(room) {
  const toAdd = room.maxPlayers - countSeatedPlayers(room);
  if (toAdd <= 0) return;
  const usedNames = new Set(Array.from(room.players.values()).map((p) => p.nickname));
  if (room.aiNameRegistry) {
    for (const name of room.aiNameRegistry) usedNames.add(name);
  }
  const allChars = Object.keys(AI_CHARACTERS);
  const available = shuffle(allChars.filter((n) => !usedNames.has(n)));
  let charIdx = 0;
  let nextAiNo = 1;
  const nextAiId = () => {
    while (room.players.has(`ai${nextAiNo}`)) nextAiNo += 1;
    const id = `ai${nextAiNo}`;
    nextAiNo += 1;
    return id;
  };
  for (let i = 0; i < toAdd; i++) {
    const id = nextAiId();
    const charName = available[charIdx] || `AI${id.slice(2)}`;
    charIdx += 1;
    usedNames.add(charName);
    if (room.aiNameRegistry) room.aiNameRegistry.add(charName);
    const char = AI_CHARACTERS[charName] || AI_CHARACTERS[Object.keys(AI_CHARACTERS)[0]];
    room.players.set(id, {
      id,
      nickname: charName,
      avatar: char.avatar || '🤖',
      seat: null,
      joinedAt: now(),
      isAI: true,
      aiPersonaKey: charName,
      aiStyle: char.style,
      aiPersonaId: charName,
    });
  }
  for (let idx = 0; idx < room.maxPlayers; idx++) {
    if (!room.seats[idx]) {
      const ai = Array.from(room.players.values()).find((p) => p.isAI && p.seat === null);
      if (ai) {
        ai.seat = idx;
        room.seats[idx] = ai.id;
      }
    }
  }
}

function autoSeatHumans(room) {
  while (room.seats.length < room.maxPlayers) room.seats.push(null);
  const seated = new Set(room.seats.filter((id) => id));
  const humans = Array.from(room.players.values()).filter((p) => !p.isAI && !isSpectatorPlayer(p) && seated.has(p.id));
  for (const p of humans) {
    if (p.seat !== null && p.seat !== undefined) continue;
    if (seated.has(p.id)) continue;
    const emptyIndex = room.seats.findIndex((id) => !id);
    if (emptyIndex >= 0) {
      room.seats[emptyIndex] = p.id;
      p.seat = emptyIndex;
      seated.add(p.id);
    }
  }
}

// ── 预取下一位 AI 的发言（在当前 AI 播音期间并行跑 LLM）────────────────────

function _prefetchNextSpeech(room, gameRef) {
  if (!room.speaking) return;
  const nextIndex = (room.speaking.index + 1) % room.maxPlayers;
  const nextSeatId = room.seats[nextIndex];
  if (!nextSeatId) return;
  const nextPlayer = room.players.get(nextSeatId);
  if (!nextPlayer || !nextPlayer.isAI || !nextPlayer.aiPersonaKey) return;
  const nextRole = room.game && room.game.assignments[nextPlayer.id];
  if (!nextRole) return;

  decideSpeak({ room, player: nextPlayer, role: nextRole, roleFactions: ROLE_FACTIONS })
    .then(async text => {
      if (!text || room.game !== gameRef) return;
      room._prefetchedSpeech = { playerId: nextPlayer.id, text, audioBase64: null, durationMs: 0 };
      // 1. 立即发给客户端，让小程序同步开始预加载合成
      for (const p of room.players.values()) {
        send(p, { type: 'AI_VOICE_PREFETCH', personaKey: nextPlayer.aiPersonaKey, text, playerId: nextPlayer.id });
      }
      // 2. 服务端同时异步合成完整音频（合成完后缓存，发言时直接用）
      if (room.aiVoiceEnabled && nextPlayer.aiPersonaKey) {
        synthesizeAiSpeech(text, nextPlayer.aiPersonaKey)
          .then(result => {
            if (result && room._prefetchedSpeech && room._prefetchedSpeech.playerId === nextPlayer.id) {
              room._prefetchedSpeech.audioBase64 = result.audioBase64;
              room._prefetchedSpeech.durationMs  = result.durationMs;
              console.log(`[prefetch] server audio ready for ${nextPlayer.nickname} (${result.durationMs}ms)`);
            }
          })
          .catch(e => console.warn('[prefetch] server synthesis failed:', e.message));
      }
    })
    .catch(() => {});
}

// ── AI 触发：发言 ─────────────────────────────────────────────────────────────

function autoSpeakIfAi(room) {
  const seatId = room.seats[room.speaking.index];
  const player = room.players.get(seatId);
  if (!player || !player.isAI || !room.game) return;
  const role = room.game.assignments[player.id];
  const gameRef = room.game;
  const speakingIndex = room.speaking.index;
  (async () => {
    let msg = '';
    // ── 优先使用预取缓存（省掉 LLM 等待）──
    const cached = room._prefetchedSpeech;
    if (cached && cached.playerId === player.id) {
      msg = cached.text;
      room._prefetchedSpeech = null;
    } else {
      try {
        msg = await decideSpeak({ room, player, role, roleFactions: ROLE_FACTIONS });
      } catch (e) {
        console.error('[decideSpeak] error:', e.message);
        msg = '';
      }
    }
    if (!msg) msg = aiSpeak(room, player, role);
    if (room.game !== gameRef) {
      console.log(`[autoSpeak] game replaced, skip ${player.nickname}`);
      return;
    }
    if (!canSpeak(room, player.id)) {
      console.log(`[autoSpeak] canSpeak=false for ${player.nickname}, phase=${room.phase}, idx=${room.speaking?.index}(was ${speakingIndex}), spoke=${room.game?.spokeThisRound[player.id]}`);
      return;
    }
    pushSpeak(room, player.nickname, msg, player.id);
    room.messages.push({ ts: now(), from: player.nickname, text: msg });
    room.game.spokeThisRound[player.id] = true;

    // ── 广播文字；若开启语音则等客户端播完再推进 ──
    broadcastRoom(room);
    if (room.speakingTimeout) clearTimeout(room.speakingTimeout);

    if (room.aiVoiceEnabled && player.aiPersonaKey) {
      // 取 prefetch 里已合成好的音频；若没有则临时合成
      let audioBase64 = null, durationMs = 0;
      const pf = room._prefetchedSpeech;
      if (pf && pf.playerId === player.id && pf.audioBase64) {
        audioBase64 = pf.audioBase64;
        durationMs  = pf.durationMs;
      } else {
        try {
          const result = await synthesizeAiSpeech(msg, player.aiPersonaKey);
          if (result) { audioBase64 = result.audioBase64; durationMs = result.durationMs; }
        } catch (e) {
          console.warn('[autoSpeak] voice synthesis failed:', e.message);
        }
      }

      for (const p of room.players.values()) {
        send(p, { type: 'AI_VOICE_REQUEST', personaKey: player.aiPersonaKey, text: msg, playerId: player.id, audioBase64, durationMs });
      }
      // ── 流水线：后台预取下一位 AI 的发言（先跑 LLM，再发 PREFETCH） ──
      _prefetchNextSpeech(room, gameRef);
      await waitForVoiceDone(room.code, Math.max(durationMs + 5000, 90000));
    }

    // guard：语音等待期间游戏可能已被跳过/重发/结束
    if (room.game !== gameRef || room.phase !== 'speaking') {
      console.log(`[autoSpeak] phase changed during voice wait for ${player.nickname}, phase=${room.phase}`);
      return;
    }
    if (room.game.leaderId === player.id) {
      (async () => {
        const leaderRole = room.game.assignments[player.id];
        const teamSize = getTeamSize(room);
        let revised = false;
        try {
          const newSeats = await decideTeam({
            room, leaderId: player.id, role: leaderRole,
            roleFactions: ROLE_FACTIONS, teamSize,
          });
          if (newSeats && newSeats.length > 0) {
            const idMap = {};
            room.seats.forEach((id, idx) => (idMap[idx + 1] = id));
            const newIds = [...new Set(newSeats.map(s => idMap[s]).filter(Boolean))];
            if (!newIds.includes(player.id)) newIds.unshift(player.id);
            const finalIds = newIds.slice(0, teamSize);
            if (finalIds.length === teamSize) {
              const oldTeam = [...(room.game.team || [])];
              const changed = finalIds.length !== oldTeam.length || finalIds.some(id => !oldTeam.includes(id));
              if (changed) {
                room.game.team = finalIds;
                const newSeatNums = finalIds.map(id => seatNumber(room, id)).filter(Boolean).join('、');
                room.messages.push({ ts: now(), from: player.nickname, text: `（思考后调整了队伍）新队伍：${newSeatNums}号` });
                broadcastRoom(room);
                revised = true;
              }
            }
          }
        } catch (_) {}
        room.phase = 'voting';
        room.game.votes = {};
        room.messages.push({ ts: now(), from: '系统', text: revised ? '队长重新调整队伍后，进入投票' : '队长发言结束，进入投票' });
        broadcastRoom(room);
        autoVoteIfAi(room); autoplayVote(room);
      })().catch(() => {});
    } else {
      advanceSpeaker(room);
    }
  })().catch((e) => console.error('[autoSpeakIfAi] unhandled:', e && e.message));
}

// ── AI 触发：投票 ─────────────────────────────────────────────────────────────

function autoVoteIfAi(room) {
  if (!room || !room.game || room.phase !== 'voting') return;
  const gameRef = room.game;
  const allIds = room.seats.filter((id) => id);
  const aiIds = allIds.filter((id) => { const p = room.players.get(id); return p && p.isAI; });
  if (!aiIds.length) return;

  for (const id of aiIds) {
    decideVote({
      room, playerId: id,
      role: room.game.assignments[id],
      roleFactions: ROLE_FACTIONS,
    }).then((approve) => {
      if (!room.game || room.game !== gameRef || room.phase !== 'voting') return;
      room.game.votes[id] = normalizeAiVote(room, id, approve);
      if (allIds.every((pid) => room.game.votes[pid] !== undefined)) resolveVote(room);
      broadcastRoom(room);
    }).catch(() => {});
  }
}

// ── AI 触发：任务 ─────────────────────────────────────────────────────────────

function autoMissionIfAi(room) {
  if (!room || !room.game || room.phase !== 'mission') return;
  const gameRef = room.game;
  const teamIds = room.game.team;
  const aiIds = teamIds.filter((id) => { const p = room.players.get(id); return p && p.isAI; });
  if (!aiIds.length) return;

  for (const id of aiIds) {
    decideMission({
      room, playerId: id,
      role: room.game.assignments[id],
      roleFactions: ROLE_FACTIONS,
    }).then((fail) => {
      if (!room.game || room.game !== gameRef || room.phase !== 'mission') return;
      room.game.missionVotes[id] = normalizeAiMission(room, id, fail);
      if (teamIds.every((tid) => room.game.missionVotes[tid] !== undefined)) resolveMission(room);
      broadcastRoom(room);
    }).catch(() => {});
  }
}

// ── AI 触发：组队提案 ─────────────────────────────────────────────────────────

function autoProposeIfAiLeader(room) {
  const leader = room.players.get(room.game.leaderId);
  if (!leader || !leader.isAI) return;
  const teamSize = getTeamSize(room);
  const gameRef = room.game;
  (async () => {
    let teamSeats = [];
    try {
      teamSeats = await decideTeam({
        room, leaderId: leader.id,
        role: room.game.assignments[leader.id],
        roleFactions: ROLE_FACTIONS, teamSize,
      });
    } catch (e) {
      teamSeats = [];
    }
    if (!teamSeats || teamSeats.length === 0) {
      teamSeats = aiPickTeam(room, leader, teamSize).map((id) => seatNumber(room, id)).filter(Boolean);
    }
    const idMap = {};
    room.seats.forEach((id, idx) => (idMap[idx + 1] = id));
    const teamIds = teamSeats.map((s) => idMap[s]).filter(Boolean);
    const unique = [];
    for (const id of teamIds) {
      if (!unique.includes(id)) unique.push(id);
    }
    if (!unique.includes(leader.id)) unique.unshift(leader.id);
    const leaderRole = room.game.assignments[leader.id];
    const leaderFaction = ROLE_FACTIONS[leaderRole] || 'good';
    if (leaderFaction === 'good') {
      const hard = inferMissionHardKnowledge(room);
      const knownEvil = new Set(hard.knownEvilIds);
      const aiKnowledge = inferAiKnowledge(room, leader.id, leaderRole);
      for (const id of aiKnowledge.knownEvilIds) knownEvil.add(id);
      const hasKnownEvil = unique.some((id) => knownEvil.has(id));
      const cleanPoolCount = room.seats.filter((id) => id && !knownEvil.has(id)).length;
      if (hasKnownEvil && cleanPoolCount >= teamSize) {
        unique.length = 0;
      }
    }
    while (unique.length < teamSize) {
      const fallback = aiPickTeam(room, leader, teamSize);
      for (const id of fallback) {
        if (!unique.includes(id)) unique.push(id);
        if (unique.length === teamSize) break;
      }
      if (fallback.length === 0) break;
    }
    if (!unique.includes(leader.id)) {
      if (unique.length >= teamSize) {
        const replaceIdx = unique.findIndex((id) => id !== leader.id);
        if (replaceIdx >= 0) unique[replaceIdx] = leader.id;
      } else {
        unique.unshift(leader.id);
      }
    }
    if (!room.game || room.game !== gameRef || room.phase !== 'team') return;
    room.game.team = unique.slice(0, teamSize);
    room.phase = 'speaking';
    room.game.votes = {};
    room.game.spokeThisRound = {};
    setSpeakingStart(room);
    room.messages.push({ ts: now(), from: '系统', text: `AI队长已确定队伍（${room.game.team.length}人），进入发言阶段` });
    broadcastRoom(room);
    scheduleSpeakTimeout(room);
    autoSpeakIfAi(room);
  })().catch((e) => console.error('[autoProposeIfAiLeader] unhandled:', e && e.message));
}

// ── AI 触发：刺杀 ─────────────────────────────────────────────────────────────

function autoAssassinateIfAi(room) {
  const assassinId = room.game.assassinId;
  if (!assassinId) return;
  const assassin = room.players.get(assassinId);
  if (!assassin || !assassin.isAI) return;
  if (room.phase !== 'assassination') return;
  (async () => {
    let targetId = null;
    let reasoning = '';
    await gatherEvilIntel(room);
    const revealedEvil = room.game.revealedEvil || {};
    const candidateSeats = room.seats
      .map((id, idx) => ({ id, seat: idx + 1 }))
      .filter((s) => s.id && !revealedEvil[s.id] && s.id !== assassinId)
      .map((s) => s.seat);
    room.game.assassinationCandidates = candidateSeats;
    try {
      const res = await decideAssassinate({
        room, assassinId,
        role: room.game.assignments[assassinId],
        roleFactions: ROLE_FACTIONS,
        evilIntel: room.game.evilIntel || [],
      });
      if (res && res.targetSeat) {
        const idx = res.targetSeat - 1;
        targetId = room.seats[idx] || null;
        reasoning = res.reasoning || '';
      }
    } catch (e) {
      targetId = null;
    }
    if (targetId) {
      const targetRole = room.game.assignments[targetId];
      const targetFaction = ROLE_FACTIONS[targetRole] || 'good';
      if (revealedEvil[targetId] || targetId === assassinId) targetId = null;
    }
    if (!targetId) {
      const fallback = aiAssassinate(room, assassinId);
      targetId = fallback.targetId;
      reasoning = reasoning || fallback.reasoning;
    }
    revealEvilToAll(room);
    resolveAssassination(room, targetId, assassinId, reasoning);
    if (reasoning) {
      room.messages.push({ ts: now(), from: assassin.nickname, text: `我的推理：${reasoning}` });
    }
  })().catch((e) => console.error('[aiAssassinate] unhandled:', e && e.message));
}

// ── 托管（Autoplay）─────────────────────────────────────────────────────────

function triggerAutoplayActions(room) {
  if (!room || !room.game || !room.started) return;
  if (room.phase === 'team') {
    const leader = room.players.get(room.game.leaderId);
    if (leader && leader.autoplay && !leader.isAI) autoplayPropose(room);
  }
  if (room.phase === 'speaking') autoplaySkipSpeak(room);
  if (room.phase === 'voting') autoplayVote(room);
  if (room.phase === 'mission') autoplayMission(room);
  if (room.phase === 'assassination') scheduleAutoAssassinIfAutoplay(room);
  if (room.phase === 'lady') autoplayLady(room);
}

function autoplayPropose(room) {
  const leaderId = room.game.leaderId;
  const leader = room.players.get(leaderId);
  if (!leader || !leader.autoplay || leader.isAI) return;
  if (room.phase !== 'team') return;
  const teamSize = getTeamSize(room);
  const leaderIdx = room.seats.indexOf(leaderId);
  const n = room.seats.length;
  const team = [];
  for (let i = 0; i < n && team.length < teamSize; i++) {
    const id = room.seats[(leaderIdx + i) % n];
    if (id) team.push(id);
  }
  const gameRef = room.game;
  setTimeout(() => {
    if (!room.game || room.game !== gameRef || room.phase !== 'team') return;
    const currentLeader = room.players.get(room.game.leaderId);
    if (!currentLeader || !currentLeader.autoplay) return;
    room.game.team = team;
    room.phase = 'voting';
    room.game.votes = {};
    room.messages.push({ ts: now(), from: '系统', text: `${leader.nickname}（托管）已自动提名队伍并发起投票` });
    broadcastRoom(room);
    autoVoteIfAi(room); autoplayVote(room);
  }, 1500);
}

function autoplaySkipSpeak(room) {
  if (!room || !room.game || room.phase !== 'speaking' || !room.speaking) {
    console.log(`[autoplaySkip] guard fail: phase=${room && room.phase}, speaking=${!!(room && room.speaking)}`);
    return;
  }
  const currentId = room.seats[room.speaking.index];
  if (!currentId) { console.log('[autoplaySkip] no currentId at index', room.speaking.index); return; }
  const p = room.players.get(currentId);
  if (!p || !p.autoplay || p.isAI) {
    if (p && !p.isAI) console.log(`[autoplaySkip] HUMAN skip: player=${p.nickname}, id=${currentId}, autoplay=${p.autoplay}, phone=${p.phone}`);
    return;
  }
  console.log(`[autoplaySkip] will skip ${p.nickname} in 800ms, id=${currentId}`);
  const gameRef = room.game;
  const speakingIndex = room.speaking.index;
  setTimeout(() => {
    if (!room.game || room.game !== gameRef) { console.log(`[autoplaySkip] 800ms: game changed`); return; }
    if (room.phase !== 'speaking') { console.log(`[autoplaySkip] 800ms: phase=${room.phase} not speaking`); return; }
    if (!room.speaking) { console.log(`[autoplaySkip] 800ms: no speaking obj`); return; }
    if (room.speaking.index !== speakingIndex) { console.log(`[autoplaySkip] 800ms: index changed ${speakingIndex} -> ${room.speaking.index}`); return; }
    if (room.seats[room.speaking.index] !== currentId) { console.log(`[autoplaySkip] 800ms: seat mismatch`); return; }
    const player = room.players.get(currentId);
    if (!player || !player.autoplay) { console.log(`[autoplaySkip] 800ms: autoplay=${player && player.autoplay}`); return; }
    console.log(`[autoplaySkip] 800ms: executing skip for ${player.nickname}`);
    if (room.speakingTimeout) { clearTimeout(room.speakingTimeout); room.speakingTimeout = null; }
    room.game.spokeThisRound[currentId] = true;
    if (room.game.leaderId === currentId) {
      room.phase = 'voting';
      room.game.votes = {};
      room.messages.push({ ts: now(), from: '系统', text: '进入投票' });
      broadcastRoom(room);
      autoVoteIfAi(room); autoplayVote(room);
    } else {
      room.messages.push({ ts: now(), from: '系统', text: `${player.nickname}（托管）跳过发言` });
      advanceSpeaker(room);
    }
  }, 800);
}

function autoplayVote(room) {
  if (!room.game || room.phase !== 'voting') return;
  const gameRef = room.game;
  const allIds = room.seats.filter((id) => id);
  const autoplayIds = allIds.filter((id) => {
    const p = room.players.get(id);
    return p && p.autoplay && !p.isAI && gameRef.votes[id] === undefined;
  });
  if (!autoplayIds.length) return;
  const rejectsInRow = room.game.rejectsInRow || 0;
  setTimeout(() => {
    if (!room.game || room.game !== gameRef || room.phase !== 'voting') return;
    for (const id of autoplayIds) {
      if (gameRef.votes[id] !== undefined) continue;
      const inTeam = (gameRef.team || []).includes(id);
      gameRef.votes[id] = inTeam || rejectsInRow >= 4;
    }
    if (allIds.every((pid) => gameRef.votes[pid] !== undefined)) resolveVote(room);
    else broadcastRoom(room);
  }, 1200);
}

function autoplayMission(room) {
  if (!room.game || room.phase !== 'mission') return;
  const gameRef = room.game;
  const teamIds = room.game.team || [];
  const autoplayIds = teamIds.filter((id) => {
    const p = room.players.get(id);
    return p && p.autoplay && !p.isAI && gameRef.missionVotes[id] === undefined;
  });
  if (!autoplayIds.length) return;
  setTimeout(() => {
    if (!room.game || room.game !== gameRef || room.phase !== 'mission') return;
    for (const id of autoplayIds) {
      if (gameRef.missionVotes[id] !== undefined) continue;
      const role = gameRef.assignments[id];
      gameRef.missionVotes[id] = ROLE_FACTIONS[role] === 'evil';
    }
    if (teamIds.every((pid) => gameRef.missionVotes[pid] !== undefined)) resolveMission(room);
    else broadcastRoom(room);
  }, 1200);
}

function autoplayLady(room) {
  if (!room || !room.game || room.phase !== 'lady' || !room.game.ladyOfLake) return;
  const holderId = room.game.ladyOfLake.holderId;
  const holder = room.players.get(holderId);
  if (!holder || !holder.autoplay || holder.isAI) return;
  const gameRef = room.game;
  const eligible = getLadyOfLakeEligibleTargets(room);
  if (!eligible.length) return;
  const targetId = eligible[Math.floor(Math.random() * eligible.length)];
  setTimeout(() => {
    if (!room.game || room.game !== gameRef || room.phase !== 'lady') return;
    const stillHolder = room.players.get(holderId);
    if (!stillHolder || !stillHolder.autoplay) return;
    resolveLadyOfLake(room, targetId);
    room.messages.push({ ts: now(), from: '系统', text: `${holder.nickname}（托管）已自动完成验人` });
    broadcastRoom(room);
  }, 1500);
}

function scheduleAutoAssassinIfAutoplay(room) {
  const assassinId = room.game && room.game.assassinId;
  if (!assassinId) return;
  const assassin = room.players.get(assassinId);
  if (!assassin || !assassin.autoplay || assassin.isAI) return;
  if (assassinAutoplayTimers.has(room.code)) return;
  // 有预设目标：5 秒后自动刺杀；无目标：15 秒后随机刺杀
  const delay = assassin.autoplayTarget ? 5 * 1000 : 15 * 1000;
  const timer = setTimeout(() => {
    assassinAutoplayTimers.delete(room.code);
    if (!room.game || room.phase !== 'assassination') return;
    const a = room.players.get(assassinId);
    if (!a || !a.autoplay) return;
    const revealedEvil = room.game.revealedEvil || {};
    const goodIds = room.seats.filter(
      (id) => id && !revealedEvil[id] && id !== assassinId
    );
    if (!goodIds.length) return;
    const preTarget = a.autoplayTarget;
    const targetId = (preTarget && goodIds.includes(preTarget))
      ? preTarget
      : goodIds[Math.floor(Math.random() * goodIds.length)];
    revealEvilToAll(room);
    resolveAssassination(room, targetId, assassinId, '（托管自动刺杀）');
    room.messages.push({ ts: now(), from: '系统', text: `${a.nickname}（托管）已自动完成刺杀` });
    broadcastRoom(room);
  }, delay);
  assassinAutoplayTimers.set(room.code, timer);
}

// ── 复盘生成 ──────────────────────────────────────────────────────────────────

function generateRecaps(room) {
  if (!room || !room.game) return;
  if (room.game.recapGenerated) return;
  const gameRef = room.game;
  room.game.recapGenerated = true;
  room.game.recapGenerating = true;
  broadcastRoom(room);
  const recaps = [];
  const tasks = [];
  for (const p of room.players.values()) {
    if (p.spectator) continue;
    const role = room.game.assignments[p.id];
    tasks.push(
      (async () => {
        let suspicious = [];
        let reason = '';
        let recap = {};
        let review = null;
        let actionSummary = null;
        let info = roleInfoForRecap(room, p.id, role);
        try {
          const res = await decideRecap({ room, player: p, role, roleFactions: ROLE_FACTIONS });
          recap = res || {};
          review = recap.review || null;
          actionSummary = recap.actionSummary || null;
        } catch (e) {
          suspicious = [];
          reason = '';
        }
        const rolesInGame = new Set(room.roles || []);
        if (role === '梅林') {
          const evilSeats = Array.isArray(info.seats) ? info.seats.slice().sort((a, b) => a - b) : [];
          const guessMordredSeat = rolesInGame.has('莫德雷德') ? recap.merlin?.guessMordredSeat || null : null;
          reason = recap.merlin?.reason || reason;
          if (reason && evilSeats && evilSeats.length) {
            for (const seat of evilSeats) {
              const seatStr = String(seat);
              reason = reason.replace(new RegExp(`${seatStr}是(忠臣|派西维尔|梅林)`, 'g'), `${seatStr}是坏人`);
              reason = reason.replace(new RegExp(`认为${seatStr}是(忠臣|派西维尔|梅林)`, 'g'), `认为${seatStr}是坏人`);
            }
          }
          if (hasMerlinReasonContradiction(reason, evilSeats)) reason = '';
          if (!reason) reason = buildMerlinReason(room, evilSeats, guessMordredSeat);
          suspicious = evilSeats;
          recaps.push({
            id: p.id, nickname: p.nickname, seat: seatNumber(room, p.id), role,
            think: recap.think || '', knownInfo: recap.knownInfo || '', info,
            merlin: { evilSeats, guessMordredSeat }, reason, review, actionSummary,
          });
          recordAiRecapMemory(room, p, role, { review });
          Promise.resolve(storeRecapInsights(room, p, role, recap, ROLE_FACTIONS)).catch(() => {});
          return;
        }
        if (role === '派西维尔') {
          const thumbs = info.seats || [];
          let guessMerlinSeat = recap.percival?.guessMerlinSeat;
          let guessMorganaSeat = recap.percival?.guessMorganaSeat;
          if (!thumbs.includes(guessMerlinSeat)) guessMerlinSeat = thumbs[0] || null;
          if (!thumbs.includes(guessMorganaSeat)) guessMorganaSeat = thumbs[1] || null;
          if (guessMerlinSeat === guessMorganaSeat && thumbs.length >= 2) {
            guessMorganaSeat = thumbs.find((s) => s !== guessMerlinSeat) || guessMorganaSeat;
          }
          reason = recap.percival?.reason || reason;
          recaps.push({
            id: p.id, nickname: p.nickname, seat: seatNumber(room, p.id), role,
            think: recap.think || '', knownInfo: recap.knownInfo || '', info,
            percival: { guessMerlinSeat, guessMorganaSeat },
            reason: reason || '结合拇指位发言强度与投票倾向做判断。', review, actionSummary,
          });
          recordAiRecapMemory(room, p, role, { review });
          Promise.resolve(storeRecapInsights(room, p, role, recap, ROLE_FACTIONS)).catch(() => {});
          return;
        }
        if (ROLE_FACTIONS[role] === 'evil') {
          const teammateRoles = Array.isArray(recap.evil?.teammateRoles) ? recap.evil.teammateRoles : [];
          const knownEvilSeats = info.seats || [];
          const normalizedTeammates = knownEvilSeats.map((seat) => {
            const found = teammateRoles.find((t) => t && t.seat === seat);
            return { seat, role: found && found.role ? found.role : '同伴' };
          });
          const guessMerlinSeat = recap.evil?.guessMerlinSeat || null;
          reason = recap.evil?.reason || reason;
          recaps.push({
            id: p.id, nickname: p.nickname, seat: seatNumber(room, p.id), role,
            think: recap.think || '', knownInfo: recap.knownInfo || '', info,
            evil: { teammateRoles: normalizedTeammates, guessMerlinSeat },
            reason: reason || '结合好人站队与投票表现，推测梅林位置。', review, actionSummary,
          });
          recordAiRecapMemory(room, p, role, { review });
          Promise.resolve(storeRecapInsights(room, p, role, recap, ROLE_FACTIONS)).catch(() => {});
          return;
        }
        suspicious = Array.isArray(recap.loyal?.suspicious) ? recap.loyal.suspicious : suspicious;
        reason = recap.loyal?.reason || reason;
        recaps.push({
          id: p.id, nickname: p.nickname, seat: seatNumber(room, p.id), role,
          think: recap.think || '', knownInfo: recap.knownInfo || '', info,
          loyal: { suspicious, guessMerlinSeat: recap.loyal?.guessMerlinSeat || null },
          reason: reason || '依据任务失败与投票对立判断可疑位。', review, actionSummary,
        });
        recordAiRecapMemory(room, p, role, { review });
        Promise.resolve(storeRecapInsights(room, p, role, recap, ROLE_FACTIONS)).catch(() => {});
      })().catch((e) => console.error('[generateRecaps] task error:', e && e.message))
    );
  }
  Promise.allSettled(tasks).then(() => {
    if (!room || !room.game || room.game !== gameRef) return;
    room.game.recap = recaps.sort((a, b) => (a.seat || 0) - (b.seat || 0));
    room.game.recapGenerating = false;
    updateGameHistoryPayload(room);
    broadcastRoom(room);
    evaluateGameSpeeches(room, ROLE_FACTIONS).catch(() => {});
    extractStrategyPatterns(room, ROLE_FACTIONS).catch(() => {});
  });
}

// ── 导出 ──────────────────────────────────────────────────────────────────────
module.exports = {
  init,
  resolveVoiceDone,
  assassinAutoplayTimers,
  AI_CHARACTERS,
  // 初始化
  fillAiPlayers, autoSeatHumans,
  // 发言
  autoSpeakIfAi, buildLadyAnnouncement, aiSpeak, pushSpeak, canSpeak,
  // 投票
  autoVoteIfAi, aiVote, knownEvilIds, normalizeAiVote,
  // 任务
  autoMissionIfAi, aiMissionVote, normalizeAiMission,
  // 组队
  autoProposeIfAiLeader, aiPickTeam,
  // 刺杀
  autoAssassinateIfAi, aiAssassinate, scheduleAutoAssassinIfAutoplay,
  // 托管
  triggerAutoplayActions, autoplayPropose, autoplaySkipSpeak, autoplayVote, autoplayMission, autoplayLady,
  // 复盘
  generateRecaps, roleInfoForRecap,
  // 情报 & 揭示
  gatherEvilIntel, revealAll, revealEvilToEvil, revealEvilToAll,
  // 纯推理
  inferAiKnowledge, inferSpeechClaimedEvilIds, isSelfEvilClaim,
  inferMissionHardKnowledge, inferPublicSuspicion, getMerlinKnownEvilIds,
  extractVoteClaim, hasMerlinReasonContradiction, buildMerlinReason,
};
