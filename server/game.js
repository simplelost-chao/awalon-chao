// game.js — 游戏核心逻辑：通信、状态机、阶段解析、玩家/房主动作、历史

const WebSocket = require('ws');
const {
  MAX_ROUNDS, FORCE_ROUND_MODE_FIXED_5,
  ROLE_FACTIONS, now, shuffle,
  normalizeForceRoundMode, deriveForcedRound, isValidRoleConfig,
  seatNumber, getTeamSize, getFailRequirement,
} = require('./constants');
const { userDb, getOrCreateUser, updateUserProfile, deleteActiveRoomStmt, deleteActiveRoomPlayersByRoomStmt } = require('./db');
const {
  getHistoryListForPhone, getHistoryDetailForPhone,
  getRoleStatsForPhone,
} = require('./history');
const { MEDAL_DEFS, evaluateMedalsForPayload } = require('./medals');
const { recordGameSummary } = require('./ai');
const {
  persistActiveRoom,
  deleteActiveRoom,
  countSeatedPlayers,
  isSpectatorPlayer,
  defaultRoles,
  padRoles,
  removePlayerById,
} = require('./room');

// ── 依赖注入（只注入运行时状态 + 会有循环依赖的 AI 函数）─────────────────────
let _rooms, _clients;
let _fillAiPlayers, _autoSeatHumans,
    _autoProposeIfAiLeader, _autoplayPropose, _autoplaySkipSpeak,
    _autoSpeakIfAi, _autoVoteIfAi, _autoplayVote,
    _autoMissionIfAi, _autoplayMission,
    _autoAssassinateIfAi, _scheduleAutoAssassinIfAutoplay, _autoplayLady,
    _generateRecaps, _gatherEvilIntel,
    _revealAll, _revealEvilToAll;

function init(ctx) {
  ({
    rooms: _rooms,
    clients: _clients,
    fillAiPlayers: _fillAiPlayers,
    autoSeatHumans: _autoSeatHumans,
    autoProposeIfAiLeader: _autoProposeIfAiLeader,
    autoplayPropose: _autoplayPropose,
    autoplaySkipSpeak: _autoplaySkipSpeak,
    autoSpeakIfAi: _autoSpeakIfAi,
    autoVoteIfAi: _autoVoteIfAi,
    autoplayVote: _autoplayVote,
    autoMissionIfAi: _autoMissionIfAi,
    autoplayMission: _autoplayMission,
    autoAssassinateIfAi: _autoAssassinateIfAi,
    scheduleAutoAssassinIfAutoplay: _scheduleAutoAssassinIfAutoplay,
    autoplayLady: _autoplayLady,
    generateRecaps: _generateRecaps,
    gatherEvilIntel: _gatherEvilIntel,
    revealAll: _revealAll,
    revealEvilToAll: _revealEvilToAll,
  } = ctx);
}

// ── 通信 ──────────────────────────────────────────────────────────────────────

function send(client, msg) {
  const ws = _clients.get(client.id);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function ok(client, data) {
  send(client, { type: 'OK', data });
}

function error(client, code) {
  send(client, { type: 'ERROR', code });
}

function broadcastRoom(room) {
  if (room._historyMode) return;
  if (!_rooms.has(room.code)) return;
  persistActiveRoom(room);
  const base = publicRoom(room);
  for (const player of room.players.values()) {
    const ws = _clients.get(player.id);
    if (!ws || ws.readyState !== WebSocket.OPEN) continue;
    const isHost = player.id === room.hostId;
    const superPlayer = !!(player.phone && isSuperPlayer(player.phone));
    const roomData = isHost ? { ...base, _isSuperPlayer: superPlayer } : { ...base, hostRole: null, _isSuperPlayer: superPlayer };
    ws.send(JSON.stringify({ type: 'ROOM_STATE', room: roomData }));
  }
}

function removeAiPlayer(room, playerId) {
  const player = room && room.players && room.players.get(playerId);
  if (player && player.isAI) room.players.delete(playerId);
}

function normalizeSeatsForMaxPlayers(room, nextMaxPlayers) {
  if (!room || !Array.isArray(room.seats)) return;
  while (room.seats.length < nextMaxPlayers) room.seats.push(null);
  const overflow = room.seats.splice(nextMaxPlayers);
  for (const playerId of overflow) {
    if (!playerId) continue;
    const player = room.players.get(playerId);
    if (!player) continue;
    if (player.isAI) {
      removeAiPlayer(room, playerId);
    } else {
      player.seat = null;
      player.spectator = true;
    }
  }
  const seated = new Set();
  for (let idx = 0; idx < room.seats.length; idx++) {
    const playerId = room.seats[idx];
    if (!playerId || seated.has(playerId)) {
      room.seats[idx] = null;
      continue;
    }
    const player = room.players.get(playerId);
    if (!player) {
      room.seats[idx] = null;
      continue;
    }
    seated.add(playerId);
    player.seat = idx;
    if (!player.isAI) player.spectator = false;
  }
  for (const [playerId, player] of room.players.entries()) {
    if (!player) continue;
    if (player.isAI && !seated.has(playerId) && (player.seat === null || player.seat === undefined)) {
      room.players.delete(playerId);
      continue;
    }
    if (player.seat !== null && player.seat !== undefined && !seated.has(playerId)) {
      player.seat = null;
      if (!player.isAI) player.spectator = true;
    }
  }
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    speakingSeconds: room.speakingSeconds,
    roles: room.roles,
    hostRole: room.hostRole || null,
    ladyOfLakeEnabled: !!room.ladyOfLakeEnabled,
    aiVoiceEnabled: !!room.aiVoiceEnabled,
    evilRoleVisibleEnabled: !!room.evilRoleVisibleEnabled,
    oberonVisibleEnabled: !!room.oberonVisibleEnabled,
    forceRoundMode: room.forceRoundMode || FORCE_ROUND_MODE_FIXED_5,
    forceRound: room.forceRound || MAX_ROUNDS,
    started: room.started,
    phase: room.phase,
    speaking: room.speaking || null,
    seats: room.seats,
    players: Array.from(room.players.values()).map(({ autoplayTarget, ...p }) => p),
    messages: room.messages || [],
    game: publicGame(room),
  };
}

function publicGame(room) {
  if (!room.game) return null;
  const ladyOfLake = room.game.ladyOfLake
    ? {
        enabled: !!room.game.ladyOfLake.enabled,
        holderId: room.game.ladyOfLake.holderId || null,
        history: (room.game.ladyOfLake.history || []).map((entry) => ({
          round: entry.round,
          holderId: entry.holderId,
          targetId: entry.targetId,
        })),
      }
    : null;
  return {
    gameVersion: Number(room.game.gameVersion || 0) || 0,
    round: room.game.round,
    attempt: room.game.attempt,
    leaderId: room.game.leaderId,
    team: room.game.team,
    phase: room.phase,
    votes: room.game.votes || {},
    missionVotes: room.game.missionVotes || {},
    voteHistory: room.game.voteHistory || [],
    missionHistory: room.game.missionHistory || [],
    rejectsInRow: room.game.rejectsInRow || 0,
    teamSize: getTeamSize(room),
    failRequirement: getFailRequirement(room),
    speakHistory: room.game.speakHistory || {},
    revealedRoles: room.game.revealedRoles || null,
    revealedEvil: room.game.revealedEvil || null,
    winner: room.game.winner || null,
    endReason: room.game.endReason || null,
    assassination: room.game.assassination || null,
    recap: room.game.recap || [],
    evilIntel: room.game.evilIntel || [],
    ladyOfLake,
    trust: room.game.trust || {},
    latestEarnedMedals: room.game.latestEarnedMedals || {},
  };
}

// ── 游戏历史 ──────────────────────────────────────────────────────────────────

function buildSeatSnapshot(room) {
  const out = {};
  (Array.isArray(room && room.seats) ? room.seats : []).forEach((id, idx) => {
    if (id) out[id] = idx + 1;
  });
  return out;
}

function buildGameHistoryPayload(room) {
  const assignments = (room.game && room.game.assignments) || {};
  const seatedIds = new Set(room.seats.filter(Boolean));
  const players = room.seats
    .map((id, idx) => {
      const p = room.players.get(id);
      const role = assignments[id] || '';
      return {
        id,
        seat: idx + 1,
        nickname: p ? p.nickname : `玩家${idx + 1}`,
        avatar: p ? (p.avatar || '') : '',
        phone: p && !p.isAI ? p.phone || null : null,
        isAI: p ? !!p.isAI : false,
        isHost: id === room.hostId,
        role,
        faction: ROLE_FACTIONS[role] || 'good',
      };
    })
    .filter((x) => !!x.id);

  const addedSpectatorIds = new Set();
  const snapshotList = (room.game && room.game.spectatorSnapshot) || [];
  for (const s of snapshotList) {
    if (!s || !s.id || seatedIds.has(s.id)) continue;
    addedSpectatorIds.add(s.id);
    players.push({
      id: s.id, seat: null, nickname: s.nickname, phone: s.phone,
      isAI: false, isHost: false, role: '观战', faction: 'spectator',
    });
  }
  for (const [id, p] of room.players.entries()) {
    if (!p || p.isAI || !p.spectator || !p.phone || seatedIds.has(id) || addedSpectatorIds.has(id)) continue;
    players.push({
      id, seat: null, nickname: p.nickname || '观战者', phone: p.phone,
      isAI: false, isHost: false, role: '观战', faction: 'spectator',
    });
  }

  return {
    roomCode: room.code,
    maxPlayers: room.maxPlayers,
    startedAt: room.game.startedAt || room.createdAt || now(),
    endedAt: now(),
    winner: room.game.winner || 'unknown',
    endReason: room.game.endReason || null,
    players,
    voteHistory: room.game.voteHistory || [],
    missionHistory: room.game.missionHistory || [],
    speakHistory: room.game.speakHistory || {},
    messages: room.messages || [],
    assassination: room.game.assassination || null,
    recaps: room.game.recap || [],
    evilIntel: room.game.evilIntel || [],
    ladyOfLake: room.game.ladyOfLake || null,
  };
}

function persistGameHistory(room, { status = 'completed' } = {}) {
  if (!room || !room.game || room.game.historySaved) return;
  try {
    const snap = room.game.spectatorSnapshot || [];
    const livePlayers = Array.from(room.players.entries()).map(([id, p]) => ({
      id, phone: p && p.phone, spectator: p && p.spectator,
    }));
    console.log(`[HISTORY] room=${room.code} snap=${JSON.stringify(snap)} livePlayers=${JSON.stringify(livePlayers)}`);
    const payload = buildGameHistoryPayload(room);
    const medalByPlayerId = evaluateMedalsForPayload(payload);
    const latestEarnedMedals = {};
    for (const p of payload.players) {
      const codes = medalByPlayerId[p.id] || [];
      latestEarnedMedals[p.id] = codes
        .map((code) => {
          const def = MEDAL_DEFS[code];
          return def ? { code: def.code, name: def.name, faction: def.faction } : null;
        })
        .filter(Boolean);
    }
    room.game.latestEarnedMedals = latestEarnedMedals;
    const insertGame = userDb.prepare(
      'INSERT INTO game_records(room_code, started_at, ended_at, max_players, winner, payload, status) VALUES(?,?,?,?,?,?,?)'
    );
    const insertParticipant = userDb.prepare(
      `INSERT INTO game_participants(
         game_id, phone, client_id, nickname, seat, role, faction, result, is_host, is_ai, created_at
       ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`
    );
    const insertMedal = userDb.prepare(
      `INSERT INTO participant_medals(
         game_id, phone, client_id, medal_code, medal_name, created_at
       ) VALUES(?,?,?,?,?,?)`
    );
    const tx = userDb.transaction(() => {
      const res = insertGame.run(
        payload.roomCode, payload.startedAt, payload.endedAt,
        payload.maxPlayers, payload.winner, JSON.stringify(payload), status
      );
      const gameId = Number(res.lastInsertRowid);
      room.game.historyGameId = gameId;
      for (const p of payload.players) {
        const result =
          p.faction === 'spectator'
            ? 'spectator'
            : (payload.winner === 'good' && p.faction === 'good') || (payload.winner === 'evil' && p.faction === 'evil')
            ? 'win'
            : 'lose';
        insertParticipant.run(
          gameId, p.phone || null, p.id, p.nickname, p.seat ?? 0,
          p.role, p.faction, result, p.isHost ? 1 : 0, p.isAI ? 1 : 0, payload.endedAt
        );
        for (const code of (medalByPlayerId[p.id] || [])) {
          const def = MEDAL_DEFS[code];
          if (def) insertMedal.run(gameId, p.phone || null, p.id, code, def.name, payload.endedAt);
        }
      }
      room.game.historySaved = true;
      room.game.historyId = gameId;
      // 与写入历史在同一事务内删除快照，保证原子性：
      // 若崩溃发生在 tx() 之前，历史未写、快照仍在，重启后可正常恢复；
      // 若 tx() 提交，历史已写 + 快照已删，重启不会再次触发幽灵游戏。
      deleteActiveRoomStmt.run(room.code);
      deleteActiveRoomPlayersByRoomStmt.run(room.code);
    });
    tx();
  } catch (e) {
    console.error('[HISTORY ERROR]', e && e.message, e && e.stack && e.stack.split('\n').slice(0, 3).join(' | '));
  }
}

function updateGameHistoryPayload(room) {
  if (!room || !room.game || !room.game.historyGameId) return;
  try {
    const gameId = room.game.historyGameId;
    const row = userDb.prepare('SELECT payload FROM game_records WHERE id = ?').get(gameId);
    if (!row) return;
    const payload = JSON.parse(row.payload);
    payload.recaps = room.game.recap || [];
    userDb.prepare('UPDATE game_records SET payload = ? WHERE id = ?').run(JSON.stringify(payload), gameId);
  } catch (e) {
    console.error('[HISTORY] updateGameHistoryPayload error:', e && e.message);
  }
}

// ── 游戏状态初始化 ─────────────────────────────────────────────────────────────

function startGameState(room) {
  const nextGameVersion = (Number(room.gameVersionSeq || 0) || 0) + 1;
  room.gameVersionSeq = nextGameVersion;
  const roles = shuffle(room.roles);
  const seatIds = room.seats.slice();
  const assignments = {};
  const hostId = room.hostId;
  let rolePool = roles.slice();
  if (room.hostRole && hostId) {
    const idx = rolePool.indexOf(room.hostRole);
    if (idx >= 0) {
      rolePool.splice(idx, 1);
      assignments[hostId] = room.hostRole;
    }
  }
  for (const id of seatIds) {
    if (assignments[id]) continue;
    assignments[id] = rolePool.shift();
  }
  const assassinId = seatIds.find((id) => assignments[id] === '刺客')
    || seatIds.find((id) => assignments[id] === '莫德雷德')
    || null;
  const merlinId = seatIds.find((id) => assignments[id] === '梅林') || null;

  room.game = {
    startedAt: now(),
    gameVersion: nextGameVersion,
    round: 1,
    attempt: 1,
    leaderIndex: Math.floor(Math.random() * seatIds.length),
    leaderId: null,
    team: [],
    votes: {},
    voteHistory: [],
    missionHistory: [],
    rejectsInRow: 0,
    assignments,
    missionVotes: {},
    speakHistory: { '1-1': [] },
    claims: { '1-1': {} },
    trust: {},
    revealedRoles: null,
    spokeThisRound: {},
    assassinId,
    merlinId,
    assassination: null,
    revealedEvil: null,
    winner: null,
    spectatorSnapshot: [],
    ladyOfLake:
      room.ladyOfLakeEnabled && room.maxPlayers >= 8
        ? { enabled: true, holderId: null, history: [] }
        : null,
  };
  room.game.leaderId = seatIds[room.game.leaderIndex];
  if (room.game.ladyOfLake && seatIds.length > 0) {
    const initialHolderIndex = (room.game.leaderIndex + seatIds.length - 1) % seatIds.length;
    room.game.ladyOfLake.holderId = seatIds[initialHolderIndex];
  }
  for (const id of seatIds) room.game.trust[id] = 0;
}

function resetPrivateRoleState(room, nextGameVersion = 0) {
  for (const player of room.players.values()) {
    if (player.isAI) continue;
    send({ id: player.id }, { type: 'ROLE_RESET', data: { gameVersion: Number(nextGameVersion || 0) || 0 } });
  }
}

function preselectTeam(room) {
  if (!room || !room.game) return;
  room.game.team = [];
  room.game.votes = {};
}

function nextLeader(room) {
  room.game.leaderIndex = (room.game.leaderIndex + 1) % room.maxPlayers;
  room.game.leaderId = room.seats[room.game.leaderIndex];
}

function setSpeakingStart(room) {
  const leaderIndex = room.game ? room.game.leaderIndex : 0;
  const startIndex = (leaderIndex + 1) % room.maxPlayers;
  room.speaking = { index: startIndex, endAt: now() + room.speakingSeconds * 1000 };
}

// ── 发言流程 ──────────────────────────────────────────────────────────────────

function advanceSpeaker(room) {
  const nextIndex = (room.speaking.index + 1) % room.maxPlayers;
  room.speaking.index = nextIndex;
  room.speaking.endAt = now() + room.speakingSeconds * 1000;
  broadcastRoom(room);
  scheduleSpeakTimeout(room);
  _autoSpeakIfAi(room);
  _autoplaySkipSpeak(room);
}

function scheduleSpeakTimeout(room) {
  if (room.speakingTimeout) clearTimeout(room.speakingTimeout);
  if (!room.speaking) return;
  const currentId = room.seats[room.speaking.index];
  if (!currentId) return;
  const remainingMs = room.speaking.endAt ? Math.max(0, room.speaking.endAt - now()) : room.speakingSeconds * 1000;
  room.speakingTimeout = setTimeout(() => {
    const stillRoom = _rooms.get(room.code);
    if (!stillRoom || stillRoom.phase !== 'speaking') return;
    const current = stillRoom.seats[stillRoom.speaking.index];
    if (!current) return;
    if (!stillRoom.game.spokeThisRound[current]) stillRoom.game.spokeThisRound[current] = true;
    if (stillRoom.game.leaderId === current) {
      stillRoom.speaking = null;
      stillRoom.speakingTimeout = null;
      stillRoom.messages.push({ ts: now(), from: '系统', text: '发言阶段结束，队长可修改队伍后提交' });
      broadcastRoom(stillRoom);
    } else {
      advanceSpeaker(stillRoom);
    }
  }, remainingMs);
}

function enterTeamPhase(room, msg) {
  room.phase = 'team';
  room.messages.push({ ts: now(), from: '系统', text: msg });
  preselectTeam(room);
  broadcastRoom(room);
  const leader = room.players.get(room.game.leaderId);
  if (leader && leader.isAI) _autoProposeIfAiLeader(room);
  _autoplayPropose(room);
}

function interruptActiveFlowForAssassination(room) {
  if (!room || !room.game) return;
  if (room.speakingTimeout) {
    clearTimeout(room.speakingTimeout);
    room.speakingTimeout = null;
  }
  room.speaking = null;
  room.game.spokeThisRound = {};
  room.game.votes = {};
  room.game.missionVotes = {};
}

// ── 阶段解析 ──────────────────────────────────────────────────────────────────

function resolveVote(room) {
  if (!room || !room.game || room.phase !== 'voting') return;
  const votes = room.game.votes;
  const allIds = room.seats.filter((id) => id);
  const approves = allIds.filter((id) => votes[id]).length;
  const rejects = allIds.length - approves;
  const approved = approves > rejects;
  const seatSnapshot = buildSeatSnapshot(room);
  room.game.voteHistory.push({
    round: room.game.round,
    attempt: room.game.attempt,
    leaderId: room.game.leaderId,
    team: room.game.team,
    votes: { ...votes },
    seatSnapshot,
    approves,
    rejects,
    approved,
  });
  if (approved) {
    room.phase = 'mission';
    room.game.missionVotes = {};
    room.messages.push({ ts: now(), from: '系统', text: `队伍通过（${approves}赞成 / ${rejects}反对），开始任务` });
    broadcastRoom(room);
    _autoMissionIfAi(room); _autoplayMission(room);
  } else {
    room.game.rejectsInRow += 1;
    room.messages.push({ ts: now(), from: '系统', text: `队伍被否决（${approves}赞成 / ${rejects}反对）` });
    const forceRound = room.forceRound || MAX_ROUNDS;
    if (Number(room.game.attempt || 0) >= forceRound) {
      room.phase = 'end';
      _revealAll(room);
      room.game.winner = 'evil';
      room.game.endReason = 'force_round';
      recordGameSummary(room, 'evil', { roleFactions: ROLE_FACTIONS });
      persistGameHistory(room);
      room.messages.push({ ts: now(), from: '系统', text: `强制组队第${forceRound}次未能发车，邪恶阵营胜利（已亮明身份）` });
      broadcastRoom(room);
    } else {
      nextLeader(room);
      room.game.attempt += 1;
      room.phase = 'team';
      preselectTeam(room);
      const key = `${room.game.round}-${room.game.attempt}`;
      if (!room.game.speakHistory[key]) room.game.speakHistory[key] = [];
      if (!room.game.claims[key]) room.game.claims[key] = {};
      room.messages.push({ ts: now(), from: '系统', text: `更换队长，进入第${room.game.round}-${room.game.attempt}轮组队` });
      broadcastRoom(room);
      const leader = room.players.get(room.game.leaderId);
      if (leader && leader.isAI) _autoProposeIfAiLeader(room);
      _autoplayPropose(room);
    }
  }

  // 根据声明与实际投票更新信任分
  const key = `${room.game.round}-${room.game.attempt}`;
  const claims = room.game.claims ? room.game.claims[key] || {} : {};
  for (const id of Object.keys(votes)) {
    const claim = claims[id];
    if (!claim) continue;
    const votedApprove = votes[id] ? 'approve' : 'reject';
    room.game.trust[id] = (room.game.trust[id] || 0) + (claim === votedApprove ? 1 : -1);
  }
}

function resolveMission(room) {
  if (!room || !room.game || room.phase !== 'mission') return;
  const votes = room.game.missionVotes;
  const teamIds = room.game.team;
  const fails = teamIds.filter((id) => votes[id]).length;
  const needFail = getFailRequirement(room);
  const success = fails < needFail;
  const seatSnapshot = buildSeatSnapshot(room);
  room.game.missionHistory.push({ round: room.game.round, team: teamIds, fails, needFail, missionVotes: { ...votes }, seatSnapshot, success });
  room.messages.push({ ts: now(), from: '系统', text: `任务${success ? '成功' : '失败'}（失败票 ${fails} / 需求 ${needFail}）` });
  const successCount = room.game.missionHistory.filter((m) => m.success).length;
  const failCount = room.game.missionHistory.filter((m) => !m.success).length;
  if (successCount >= 3) {
    if (!room.game.assassinId) {
      room.phase = 'end';
      _revealAll(room);
      room.game.winner = 'good';
      room.game.endReason = 'missions_success';
      recordGameSummary(room, 'good', { roleFactions: ROLE_FACTIONS });
      persistGameHistory(room);
      room.messages.push({ ts: now(), from: '系统', text: '正义完成三次任务，本局无刺杀角色，正义阵营胜利（已亮明身份）' });
      broadcastRoom(room);
      return;
    }
    room.phase = 'assassination';
    _revealEvilToAll(room);
    room.messages.push({ ts: now(), from: '系统', text: '正义完成三次任务，进入刺杀阶段' });
    _gatherEvilIntel(room);
    _autoAssassinateIfAi(room); _scheduleAutoAssassinIfAutoplay(room);
  } else if (failCount >= 3) {
    room.phase = 'end';
    _revealAll(room);
    room.game.winner = 'evil';
    room.game.endReason = 'missions_failed';
    recordGameSummary(room, 'evil', { roleFactions: ROLE_FACTIONS });
    persistGameHistory(room);
    room.messages.push({ ts: now(), from: '系统', text: '邪恶阵营胜利（已亮明身份）' });
  } else {
    const completedRound = room.game.round;
    if (completedRound >= MAX_ROUNDS) {
      room.phase = 'end';
      _revealAll(room);
      room.game.winner = 'evil';
      room.game.endReason = 'rounds_exhausted';
      recordGameSummary(room, 'evil', { roleFactions: ROLE_FACTIONS });
      persistGameHistory(room);
      room.messages.push({ ts: now(), from: '系统', text: '任务轮次已耗尽，邪恶阵营胜利（已亮明身份）' });
      broadcastRoom(room);
      return;
    }
    room.game.round += 1;
    room.game.attempt = 1;
    room.game.rejectsInRow = 0;
    const key = `${room.game.round}-${room.game.attempt}`;
    if (!room.game.speakHistory[key]) room.game.speakHistory[key] = [];
    if (!room.game.claims[key]) room.game.claims[key] = {};
    room.game.spokeThisRound = {};
    nextLeader(room);
    preselectTeam(room);
    if (shouldTriggerLadyOfLake(room, completedRound)) {
      room.phase = 'lady';
      const holder = room.players.get(room.game.ladyOfLake.holderId);
      room.messages.push({ ts: now(), from: '系统', text: `进入湖中仙女阶段，由 ${holder ? holder.nickname : '未知玩家'} 查验一名玩家阵营` });
      broadcastRoom(room);
      autoLadyOfLakeIfAi(room);
      _autoplayLady(room);
    } else {
      room.phase = 'team';
      room.messages.push({ ts: now(), from: '系统', text: `进入第${room.game.round}-${room.game.attempt}轮组队` });
      broadcastRoom(room);
      const leader = room.players.get(room.game.leaderId);
      if (leader && leader.isAI) _autoProposeIfAiLeader(room);
      _autoplayPropose(room);
    }
  }
}

function resolveAssassination(room, targetId, assassinId, reasoning) {
  const targetRole = room.game.assignments[targetId];
  const hit = targetRole === '梅林';
  room.phase = 'end';
  _revealAll(room);
  const merlinId = room.game.merlinId;
  const merlinSeat = merlinId ? seatNumber(room, merlinId) : null;
  room.game.assassination = {
    targetId, assassinId, hit, reasoning, merlinSeat,
    candidateSeats: room.game.assassinationCandidates || [],
    evilIntel: room.game.evilIntel || [],
  };
  room.game.winner = hit ? 'evil' : 'good';
  recordGameSummary(room, room.game.winner, { roleFactions: ROLE_FACTIONS });
  persistGameHistory(room);
  room.messages.push({ ts: now(), from: '系统', text: `刺杀结果：${hit ? '命中梅林，邪恶胜利' : '刺杀失败，正义胜利'}（已亮明身份）` });
  broadcastRoom(room);
}

// ── 湖中仙女 ──────────────────────────────────────────────────────────────────

function isLadyOfLakeEnabled(room) {
  return !!(room && room.game && room.game.ladyOfLake && room.game.ladyOfLake.enabled);
}

function getLadyOfLakeEligibleTargets(room) {
  if (!isLadyOfLakeEnabled(room)) return [];
  const holderId = room.game.ladyOfLake.holderId;
  const previousHolders = new Set((room.game.ladyOfLake.history || []).map((e) => e.holderId));
  if (holderId) previousHolders.add(holderId);
  return room.seats.filter((id) => id && id !== holderId && !previousHolders.has(id));
}

function shouldTriggerLadyOfLake(room, completedRound) {
  return isLadyOfLakeEnabled(room) && completedRound >= 2 && completedRound <= 4;
}

function autoLadyOfLakeIfAi(room) {
  if (!room || !room.game || room.phase !== 'lady' || !room.game.ladyOfLake) return;
  const holder = room.players.get(room.game.ladyOfLake.holderId);
  if (!holder || !holder.isAI) return;
  const targets = getLadyOfLakeEligibleTargets(room);
  if (targets.length === 0) {
    room.phase = 'team';
    room.messages.push({ ts: now(), from: '系统', text: `进入第${room.game.round}-${room.game.attempt}轮组队` });
    broadcastRoom(room);
    const leader = room.players.get(room.game.leaderId);
    if (leader && leader.isAI) _autoProposeIfAiLeader(room);
    _autoplayPropose(room);
    return;
  }
  setTimeout(() => {
    const stillRoom = _rooms.get(room.code);
    if (!stillRoom || stillRoom.phase !== 'lady' || !stillRoom.game || !stillRoom.game.ladyOfLake) return;
    const stillHolder = stillRoom.players.get(stillRoom.game.ladyOfLake.holderId);
    if (!stillHolder || !stillHolder.isAI) return;
    const eligible = getLadyOfLakeEligibleTargets(stillRoom);
    if (!eligible.length) return;
    const targetId = eligible[Math.floor(Math.random() * eligible.length)];
    resolveLadyOfLake(stillRoom, targetId);
  }, 1200);
}

function resolveLadyOfLake(room, targetId) {
  if (!room || !room.game || room.phase !== 'lady' || !room.game.ladyOfLake) return false;
  const holderId = room.game.ladyOfLake.holderId;
  const eligibleTargets = getLadyOfLakeEligibleTargets(room);
  if (!holderId || !eligibleTargets.includes(targetId)) return false;
  const target = room.players.get(targetId);
  if (!target) return false;
  const alignment = ROLE_FACTIONS[room.game.assignments[targetId]] === 'evil' ? 'evil' : 'good';
  room.game.ladyOfLake.history.push({ round: room.game.round, holderId, targetId, alignment });
  send({ id: holderId }, {
    type: 'LADY_OF_LAKE_RESULT',
    data: { round: room.game.round, targetId, targetNickname: target.nickname, alignment },
  });
  room.game.ladyOfLake.holderId = targetId;
  room.phase = 'team';
  room.messages.push({
    ts: now(), from: '系统',
    text: `湖中仙女已查验 ${target.nickname}，标记传递给 ${target.nickname}，进入第${room.game.round}-${room.game.attempt}轮组队`,
  });
  broadcastRoom(room);
  const leader = room.players.get(room.game.leaderId);
  if (leader && leader.isAI) _autoProposeIfAiLeader(room);
  _autoplayPropose(room);
  return true;
}

function useLadyOfLake(client, payload) {
  const room = _rooms.get(client.roomCode);
  if (!room || !room.game) return;
  if (room.phase !== 'lady' || !room.game.ladyOfLake) return error(client, 'NOT_LADY_OF_LAKE_PHASE');
  if (room.game.ladyOfLake.holderId !== client.id) return error(client, 'LADY_OF_LAKE_ONLY');
  const targetId = String((payload && payload.targetId) || '');
  if (!resolveLadyOfLake(room, targetId)) return error(client, 'INVALID_LADY_OF_LAKE_TARGET');
}

// ── 大厅操作 ──────────────────────────────────────────────────────────────────

function setProfile(client, payload) {
  if (!client.userPhone) return error(client, 'NEED_LOGIN');
  const room = _rooms.get(client.roomCode);
  const nickname = payload.nickname ? payload.nickname.slice(0, 12) : null;
  const avatar = payload.avatar || null;
  const user = getOrCreateUser(client.userPhone);
  const nextNickname = nickname || user.nickname;
  const nextAvatar = avatar || user.avatar;
  updateUserProfile(client.userPhone, nextNickname, nextAvatar);
  if (!room) return;
  const p = room.players.get(client.id);
  if (!p) return;
  p.nickname = nextNickname;
  p.avatar = nextAvatar;
  broadcastRoom(room);
}

function isSuperPlayer(phone) {
  try {
    const fs = require('fs');
    const path = require('path');
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'admin-config.json'), 'utf8'));
    const list = cfg.superPlayers || [];
    return list.includes(phone);
  } catch (_) { return false; }
}

function cheatReveal(client, payload) {
  if (!client.userPhone) return error(client, 'NEED_LOGIN');
  const room = _rooms.get(client.roomCode);
  if (!room) return error(client, 'ROOM_NOT_FOUND');
  if (!isSuperPlayer(client.userPhone)) return error(client, 'NOT_SUPER_PLAYER');
  if (!room.started || !room.game || !room.game.assignments) return error(client, 'NOT_STARTED');
  const targetId = String((payload && payload.targetId) || '');
  if (!targetId || !room.players.has(targetId)) return error(client, 'INVALID_TARGET');
  const role = room.game.assignments[targetId];
  if (!role) return error(client, 'ROLE_NOT_FOUND');
  send(client, { type: 'CHEAT_REVEAL_ROLE', data: { playerId: targetId, role } });
}

function chooseSeat(client, payload) {
  const room = _rooms.get(client.roomCode);
  if (!room) return;
  if (room.started && room.phase !== 'end') return error(client, 'ALREADY_STARTED');
  const seatIndex = payload.seatIndex;
  if (typeof seatIndex !== 'number' || seatIndex < 0 || seatIndex >= room.maxPlayers) {
    return error(client, 'INVALID_SEAT');
  }
  while (room.seats.length < room.maxPlayers) room.seats.push(null);
  const oldSeatIndex = room.seats.findIndex((id) => id === client.id);
  const occupant = room.seats[seatIndex];

  if (!occupant) {
    if (oldSeatIndex >= 0) room.seats[oldSeatIndex] = null;
    room.seats[seatIndex] = client.id;
    const p = room.players.get(client.id);
    if (p) { p.seat = seatIndex; p.spectator = false; }
    broadcastRoom(room);
    return;
  }
  if (occupant === client.id) {
    room.seats[seatIndex] = null;
    const me = room.players.get(client.id);
    if (me) { me.seat = null; me.spectator = false; }
    broadcastRoom(room);
    return;
  }
  if (oldSeatIndex < 0) {
    const occPlayer = room.players.get(occupant);
    if (!occPlayer || !occPlayer.isAI) return error(client, 'SEAT_TAKEN');
    room.seats[seatIndex] = client.id;
    const me = room.players.get(client.id);
    if (me) { me.seat = seatIndex; me.spectator = false; }
    occPlayer.seat = null;
    removeAiPlayer(room, occupant);
    broadcastRoom(room);
    return;
  }
  room.seats[oldSeatIndex] = occupant;
  room.seats[seatIndex] = client.id;
  const me = room.players.get(client.id);
  const other = room.players.get(occupant);
  if (me) { me.seat = seatIndex; me.spectator = false; }
  if (other) other.seat = oldSeatIndex;
  broadcastRoom(room);
}

function updateSettings(client, payload) {
  const room = _rooms.get(client.roomCode);
  if (!room) return;
  console.log('[updateSettings:in]', {
    roomCode: room.code,
    oberonVisibleEnabled: payload && payload.oberonVisibleEnabled,
    roles: payload && payload.roles,
  });
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  if (room.started && room.phase !== 'end') return error(client, 'ALREADY_STARTED');
  const requestedMaxPlayers = Number(payload.maxPlayers);
  if (payload.maxPlayers !== undefined && (!requestedMaxPlayers || requestedMaxPlayers < 5 || requestedMaxPlayers > 10)) {
    return error(client, 'INVALID_MAX_PLAYERS');
  }
  const nextMaxPlayers =
    requestedMaxPlayers && requestedMaxPlayers >= 5 && requestedMaxPlayers <= 10
      ? requestedMaxPlayers
      : room.maxPlayers;
  if (payload.roles !== undefined && !isValidRoleConfig(nextMaxPlayers, payload.roles)) {
    return error(client, 'INVALID_ROLE_CONFIG');
  }
  let maxPlayersChanged = false;
  if (requestedMaxPlayers && requestedMaxPlayers >= 5 && requestedMaxPlayers <= 10) {
    room.maxPlayers = requestedMaxPlayers;
    room.roles = defaultRoles(room.maxPlayers);
    normalizeSeatsForMaxPlayers(room, room.maxPlayers);
    if (room.maxPlayers < 8) room.ladyOfLakeEnabled = false;
    maxPlayersChanged = true;
  }
  if (payload.speakingSeconds && payload.speakingSeconds >= 10 && payload.speakingSeconds <= 300) {
    room.speakingSeconds = payload.speakingSeconds;
  }
  if (payload.roles !== undefined) {
    room.roles = payload.roles;
  } else if (maxPlayersChanged) {
    room.roles = defaultRoles(room.maxPlayers);
  }
  if (payload.hostRole !== undefined) {
    const role = payload.hostRole;
    if (role === null || role === '随机') {
      room.hostRole = null;
    } else if (typeof role === 'string' && room.roles.includes(role)) {
      room.hostRole = role;
    }
  }
  if (payload.ladyOfLakeEnabled !== undefined) {
    room.ladyOfLakeEnabled = !!payload.ladyOfLakeEnabled && room.maxPlayers >= 8;
  }
  if (payload.evilRoleVisibleEnabled !== undefined) {
    room.evilRoleVisibleEnabled = !!payload.evilRoleVisibleEnabled;
  }
  if (payload.oberonVisibleEnabled !== undefined) {
    room.oberonVisibleEnabled = !!payload.oberonVisibleEnabled;
  }
  if (payload.aiVoiceEnabled !== undefined) {
    room.aiVoiceEnabled = !!payload.aiVoiceEnabled;
  }
  if (payload.forceRoundMode !== undefined) {
    room.forceRoundMode = normalizeForceRoundMode(payload.forceRoundMode);
  }
  room.forceRound = deriveForcedRound(room.maxPlayers, room.roles, room.forceRoundMode);
  if (room.hostRole && !room.roles.includes(room.hostRole)) room.hostRole = null;
  broadcastRoom(room);
}

function viewRole(client) {
  const room = _rooms.get(client.roomCode);
  if (!room || !room.game) return;
  const myRole = room.game.assignments[client.id];
  const info = {
    role: myRole,
    seats: [],
    roleDetails: {},
    isAssassin: client.id === room.game.assassinId,
    gameVersion: Number(room.game.gameVersion || 0) || 0,
  };
  if (myRole === '派西维尔') {
    const seats = [];
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      if (r === '梅林' || r === '莫甘娜') seats.push(seatNumber(room, id));
    }
    info.seats = seats.filter(Boolean);
  } else if (myRole === '梅林') {
    const seats = [];
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      if (ROLE_FACTIONS[r] === 'evil' && r !== '莫德雷德') seats.push(seatNumber(room, id));
    }
    info.seats = seats.filter(Boolean);
    info.visibleFaction = 'evil';
  } else if (ROLE_FACTIONS[myRole] === 'evil') {
    // 身份查看阶段：奥伯伦始终不参与邪恶互认
    if (myRole === '奥伯伦') {
      info.seats = [];
      return send(client, { type: 'ROLE_INFO', data: info });
    }
    const seats = [];
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      const skipOberon = r === '奥伯伦';
      if (ROLE_FACTIONS[r] === 'evil' && !skipOberon && id !== client.id) {
        seats.push(seatNumber(room, id));
        if (room.evilRoleVisibleEnabled) info.roleDetails[id] = r;
      }
    }
    info.seats = seats.filter(Boolean);
    // 告知邪恶阵营谁带刀
    if (room.game.assassinId) info.assassinSeatNo = seatNumber(room, room.game.assassinId);
  }
  send(client, { type: 'ROLE_INFO', data: info });
}

// ── 游戏控制 ──────────────────────────────────────────────────────────────────

function startGame(client, payload) {
  const room = _rooms.get(client.roomCode);
  if (!room) return;
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  if (room.started && room.phase === 'end') return redealIdentities(client);
  if (room.started) return error(client, 'ALREADY_STARTED');
  for (const p of room.players.values()) {
    if (p.isAI) continue;
    const inSeat = room.seats.some((id) => id === p.id);
    if (p.id === room.hostId && inSeat && payload && payload.spectate) {
      const idx = room.seats.indexOf(p.id);
      if (idx >= 0) room.seats[idx] = null;
      p.seat = null; p.spectator = true;
    } else if (!inSeat && !isSpectatorPlayer(p)) {
      p.spectator = true;
    }
  }
  _autoSeatHumans(room);
  _fillAiPlayers(room);
  if (countSeatedPlayers(room) < 5) return error(client, 'NOT_ENOUGH_PLAYERS');
  if (!room.seats.every((id) => id)) return error(client, 'SEATS_NOT_FULL');

  room.started = true;
  room.phase = 'team';
  resetPrivateRoleState(room, (Number(room.gameVersionSeq || 0) || 0) + 1);
  startGameState(room);
  const seatedAtStart = new Set(room.seats.filter(Boolean));
  for (const [id, p] of room.players.entries()) {
    if (!p || p.isAI || !p.spectator || !p.phone || seatedAtStart.has(id)) continue;
    room.game.spectatorSnapshot.push({ id, nickname: p.nickname || '观战者', phone: p.phone });
  }
  preselectTeam(room);
  room.messages.push({ ts: now(), from: '系统', text: '游戏开始，进入组队阶段' });
  if (room.game.ladyOfLake && room.game.ladyOfLake.holderId) {
    const holder = room.players.get(room.game.ladyOfLake.holderId);
    room.messages.push({ ts: now(), from: '系统', text: `本局开启湖中仙女，初始持有者为 ${holder ? holder.nickname : '未知玩家'}` });
  }
  room.messages.push({ ts: now(), from: '系统', text: `本局强制轮为第${room.forceRound || MAX_ROUNDS}次组队` });
  broadcastRoom(room);
  const leader = room.players.get(room.game.leaderId);
  if (leader && leader.isAI) _autoProposeIfAiLeader(room);
  _autoplayPropose(room);
}

function resetGame(client) {
  const room = _rooms.get(client.roomCode);
  if (!room) return;
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  room.started = false;
  room.phase = 'lobby';
  room.speaking = null;
  if (room.speakingTimeout) clearTimeout(room.speakingTimeout);
  room.speakingTimeout = null;
  room.messages = [];
  room.game = null;
  broadcastRoom(room);
}

function redealIdentities(client) {
  const room = _rooms.get(client.roomCode);
  if (!room) return;
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  if (!room.started) return error(client, 'NOT_STARTED');
  _autoSeatHumans(room);
  _fillAiPlayers(room);
  if (!room.seats.every((id) => id) || countSeatedPlayers(room) < 5) return error(client, 'SEATS_NOT_FULL');
  persistGameHistory(room, { status: 'aborted' });
  if (room.speakingTimeout) clearTimeout(room.speakingTimeout);
  room.speakingTimeout = null;
  room.speaking = null;
  room.phase = 'team';
  room.messages = [{ ts: now(), from: '系统', text: '房主已重发身份，按当前配置重新开始本局' }];
  resetPrivateRoleState(room, (Number(room.gameVersionSeq || 0) || 0) + 1);
  startGameState(room);
  preselectTeam(room);
  if (room.game.ladyOfLake && room.game.ladyOfLake.holderId) {
    const holder = room.players.get(room.game.ladyOfLake.holderId);
    room.messages.push({ ts: now(), from: '系统', text: `本局开启湖中仙女，初始持有者为 ${holder ? holder.nickname : '未知玩家'}` });
  }
  broadcastRoom(room);
  const leader = room.players.get(room.game.leaderId);
  if (leader && leader.isAI) _autoProposeIfAiLeader(room);
  _autoplayPropose(room);
}

// ── 发言控制 ──────────────────────────────────────────────────────────────────

function nextSpeaker(client) {
  const room = _rooms.get(client.roomCode);
  if (!room) return;
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  if (!room.started) return error(client, 'NOT_STARTED');
  if (room.phase !== 'speaking') return error(client, 'NOT_SPEAKING_PHASE');
  const currentId = room.seats[room.speaking.index];
  if (currentId && !room.game.spokeThisRound[currentId]) return error(client, 'CURRENT_NOT_SPOKEN');
  if (room.game.leaderId === currentId) {
    room.phase = 'voting';
    room.game.votes = {};
    room.messages.push({ ts: now(), from: '系统', text: '队长发言结束，进入投票' });
    broadcastRoom(room);
    _autoVoteIfAi(room); _autoplayVote(room);
    return;
  }
  advanceSpeaker(room);
}

function hostSkipSpeaker(client) {
  const room = _rooms.get(client.roomCode);
  if (!room) return;
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  if (!room.started) return error(client, 'NOT_STARTED');
  if (room.phase !== 'speaking') return error(client, 'NOT_SPEAKING_PHASE');
  const currentId = room.seats[room.speaking.index];
  if (currentId) room.game.spokeThisRound[currentId] = true;
  if (room.game.leaderId === currentId) {
    room.phase = 'voting';
    room.game.votes = {};
    room.messages.push({ ts: now(), from: '系统', text: '房主跳过当前发言，进入投票' });
    broadcastRoom(room);
    _autoVoteIfAi(room); _autoplayVote(room);
    return;
  }
  room.messages.push({ ts: now(), from: '系统', text: '房主跳过当前发言，切换下一位' });
  advanceSpeaker(room);
}

function hostSkipToVote(client) {
  const room = _rooms.get(client.roomCode);
  if (!room) return;
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  if (!room.started) return error(client, 'NOT_STARTED');
  if (room.phase !== 'speaking') return error(client, 'NOT_SPEAKING_PHASE');
  if (room.speakingTimeout) { clearTimeout(room.speakingTimeout); room.speakingTimeout = null; }
  room.speaking = null;
  room.game.votes = {};
  room.phase = 'voting';
  room.messages.push({ ts: now(), from: '系统', text: '房主已直接进入投票阶段' });
  broadcastRoom(room);
  _autoVoteIfAi(room); _autoplayVote(room);
}

function startMissionPhase(client) {
  const room = _rooms.get(client.roomCode);
  if (!room) return;
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  if (!room.started) return error(client, 'NOT_STARTED');
  enterTeamPhase(room, `进入第${room.game.round}轮组队`);
}

// ── 玩家动作 ──────────────────────────────────────────────────────────────────

function proposeTeam(client, payload) {
  const room = _rooms.get(client.roomCode);
  if (!room || !room.game) return;
  if (room.phase !== 'team' && room.phase !== 'speaking') return error(client, 'NOT_TEAM_PHASE');
  if (room.game.leaderId !== client.id) return error(client, 'LEADER_ONLY');
  const team = (payload.team || []).filter((id) => room.players.has(id));
  const teamSize = getTeamSize(room);
  if (team.length !== teamSize) return error(client, 'INVALID_TEAM_SIZE');
  room.game.team = team;
  room.game.votes = {};
  if (room.phase === 'team') {
    room.phase = 'speaking';
    room.game.spokeThisRound = {};
    setSpeakingStart(room);
    room.messages.push({ ts: now(), from: '系统', text: `队长已确定队伍（${team.length}人），进入发言阶段` });
    broadcastRoom(room);
    scheduleSpeakTimeout(room);
    _autoSpeakIfAi(room);
    _autoplaySkipSpeak(room);
    return;
  }
  if (room.speakingTimeout) { clearTimeout(room.speakingTimeout); room.speakingTimeout = null; }
  room.speaking = null;
  room.phase = 'voting';
  room.messages.push({ ts: now(), from: '系统', text: `队长已提交最终队伍（${team.length}人），进入投票` });
  broadcastRoom(room);
  _autoVoteIfAi(room); _autoplayVote(room);
}

function updateTeam(client, payload) {
  const room = _rooms.get(client.roomCode);
  if (!room || !room.game) return;
  if (room.game.leaderId !== client.id) return error(client, 'LEADER_ONLY');
  if (room.phase !== 'team' && room.phase !== 'speaking') return error(client, 'NOT_TEAM_EDIT');
  const team = (payload.team || []).filter((id) => room.players.has(id));
  const teamSize = getTeamSize(room);
  if (team.length > teamSize) return error(client, 'INVALID_TEAM_SIZE');
  room.game.team = team;
  room.game.votes = {};
  broadcastRoom(room);
}

function voteTeam(client, payload) {
  const room = _rooms.get(client.roomCode);
  if (!room || !room.game) return;
  if (room.phase !== 'voting') return error(client, 'NOT_VOTING_PHASE');
  room.game.votes[client.id] = !!payload.approve;
  const allIds = room.seats.filter((id) => id);
  if (allIds.every((id) => room.game.votes[id] !== undefined)) {
    resolveVote(room);
    return;
  }
  broadcastRoom(room);
}

function executeMission(client, payload) {
  const room = _rooms.get(client.roomCode);
  if (!room || !room.game) return;
  if (room.phase !== 'mission') return error(client, 'NOT_MISSION_PHASE');
  if (!room.game.team.includes(client.id)) return error(client, 'NOT_IN_TEAM');
  const role = room.game.assignments[client.id];
  const faction = ROLE_FACTIONS[role] || 'good';
  let fail = !!payload.fail;
  if (faction === 'good') fail = false;
  room.game.missionVotes[client.id] = fail;
  const teamIds = room.game.team;
  if (teamIds.every((id) => room.game.missionVotes[id] !== undefined)) resolveMission(room);
  broadcastRoom(room);
}

function speak(client, payload) {
  const room = _rooms.get(client.roomCode);
  if (!room || !room.game) return;
  if (!room.started) return error(client, 'NOT_STARTED');
  if (room.phase !== 'speaking') return error(client, 'NOT_SPEAKING_PHASE');
  const { canSpeak, pushSpeak } = require('./game-ai');
  if (!canSpeak(room, client.id)) return error(client, 'NOT_YOUR_TURN');
  const text = (payload && payload.text ? String(payload.text) : '').trim();
  if (!text) return error(client, 'EMPTY_SPEAK');
  const safe = text.slice(0, 120);
  const player = room.players.get(client.id);
  if (!player) return;
  pushSpeak(room, player.nickname, safe, player.id);
  room.messages.push({ ts: now(), from: player.nickname, text: safe });
  room.game.spokeThisRound[client.id] = true;
  broadcastRoom(room);
}

function endSpeak(client) {
  const room = _rooms.get(client.roomCode);
  if (!room || !room.game) return;
  if (!room.started) return error(client, 'NOT_STARTED');
  if (room.phase !== 'speaking') return error(client, 'NOT_SPEAKING_PHASE');
  const currentId = room.seats[room.speaking.index];
  if (currentId !== client.id) return error(client, 'NOT_YOUR_TURN');
  room.game.spokeThisRound[client.id] = true;
  if (room.game.leaderId === client.id) {
    room.phase = 'voting';
    room.game.votes = {};
    room.messages.push({ ts: now(), from: '系统', text: '队长发言结束，进入投票' });
    broadcastRoom(room);
    _autoVoteIfAi(room); _autoplayVote(room);
    return;
  }
  advanceSpeaker(room);
}

// ── 刺杀 ──────────────────────────────────────────────────────────────────────

function startAssassination(client) {
  const room = _rooms.get(client.roomCode);
  if (!room || !room.game) return;
  if (!room.started) return error(client, 'NOT_STARTED');
  if (client.id !== room.game.assassinId) return error(client, 'ASSASSIN_ONLY');
  if (room.phase === 'end') return error(client, 'ALREADY_ENDED');
  interruptActiveFlowForAssassination(room);
  room.phase = 'assassination';
  const assassin = room.players.get(client.id);
  room.messages.push({ ts: now(), from: '系统', text: `${assassin ? assassin.nickname : '红方'}选择提前发起刺杀` });
  _revealEvilToAll(room);
  broadcastRoom(room);
  _gatherEvilIntel(room);
  _autoAssassinateIfAi(room); _scheduleAutoAssassinIfAutoplay(room);
}

function assassinate(client, payload) {
  const room = _rooms.get(client.roomCode);
  if (!room || !room.game) return;
  if (client.id !== room.game.assassinId) return error(client, 'ASSASSIN_ONLY');
  if (room.phase === 'end') return error(client, 'ALREADY_ENDED');
  if (room.phase !== 'assassination') {
    interruptActiveFlowForAssassination(room);
    room.phase = 'assassination';
    const assassin = room.players.get(client.id);
    room.messages.push({ ts: now(), from: '系统', text: `${assassin ? assassin.nickname : '红方'}选择提前发起刺杀` });
  }
  _revealEvilToAll(room);
  // 候选人 = 身份未翻牌的玩家（不含自身）
  const revealedEvil = room.game.revealedEvil || {};
  const candidateSeats = room.seats
    .map((id, idx) => ({ id, seat: idx + 1 }))
    .filter((s) => s.id && !revealedEvil[s.id] && s.id !== client.id)
    .map((s) => s.seat);
  room.game.assassinationCandidates = candidateSeats;
  const targetId = payload && payload.targetId;
  if (!targetId || !room.players.has(targetId)) return error(client, 'INVALID_TARGET');
  // 校验目标在座位上（排除观战者）且未翻牌
  if (!room.seats.includes(targetId)) return error(client, 'INVALID_TARGET');
  if (revealedEvil[targetId]) return error(client, 'INVALID_TARGET');
  resolveAssassination(room, targetId, client.id, null);
}

// ── 历史 API ──────────────────────────────────────────────────────────────────

function fetchHistoryList(client, payload) {
  if (!client.userPhone) return error(client, 'NEED_LOGIN');
  const limit = Math.min(100, Math.max(1, parseInt((payload && payload.limit) || 30, 10) || 30));
  const offset = Math.max(0, parseInt((payload && payload.offset) || 0, 10) || 0);
  const mode = (payload && payload.mode === 'pve') ? 'pve' : 'pvp';
  const list = getHistoryListForPhone(client.userPhone, limit, offset, mode);
  send(client, { type: 'GAME_HISTORY_LIST', data: { list, limit, offset, mode } });
}

function fetchHistoryDetail(client, payload) {
  if (!client.userPhone) return error(client, 'NEED_LOGIN');
  const gameId = Number(payload && payload.gameId);
  if (!Number.isFinite(gameId) || gameId <= 0) return error(client, 'INVALID_GAME_ID');
  const detail = getHistoryDetailForPhone(client.userPhone, gameId);
  if (!detail) return error(client, 'HISTORY_NOT_FOUND');
  send(client, { type: 'GAME_HISTORY_DETAIL', data: detail });
}

function generateHistoryRecap(client, payload) {
  if (!client.userPhone) return error(client, 'NEED_LOGIN');
  const gameId = Number(payload && payload.gameId);
  if (!Number.isFinite(gameId) || gameId <= 0) return error(client, 'INVALID_GAME_ID');
  const row = userDb.prepare('SELECT payload FROM game_records WHERE id = ?').get(gameId);
  if (!row) return error(client, 'HISTORY_NOT_FOUND');
  let gp = null;
  try { gp = JSON.parse(row.payload); } catch (e) { return error(client, 'HISTORY_NOT_FOUND'); }
  if (!gp) return error(client, 'HISTORY_NOT_FOUND');
  if (Array.isArray(gp.recaps) && gp.recaps.length > 0) {
    const detail = getHistoryDetailForPhone(client.userPhone, gameId);
    if (detail) send(client, { type: 'GAME_HISTORY_DETAIL', data: detail });
    return;
  }
  if (!generateHistoryRecap._inProgress) generateHistoryRecap._inProgress = new Set();
  if (generateHistoryRecap._inProgress.has(gameId)) return;
  generateHistoryRecap._inProgress.add(gameId);
  const players = Array.isArray(gp.players) ? gp.players : [];
  const maxPlayers = Number(gp.maxPlayers || 7);
  const seats = new Array(maxPlayers).fill(null);
  const assignments = {};
  const playersMap = new Map();
  for (const p of players) {
    if (p.faction === 'spectator') continue;
    const idx = Number(p.seat) - 1;
    if (idx >= 0 && idx < maxPlayers) seats[idx] = p.id;
    assignments[p.id] = p.role;
    playersMap.set(p.id, { id: p.id, nickname: p.nickname || `${p.seat}号`, isAI: !!p.isAI, spectator: false, phone: p.phone || null });
  }
  for (const p of players) {
    if (p.faction !== 'spectator') continue;
    playersMap.set(p.id, { id: p.id, nickname: p.nickname, isAI: false, spectator: true, phone: p.phone || null });
  }
  const merlinEntry = players.find((p) => p.role === '梅林');
  const assassinEntry = players.find((p) => p.role === '刺客');
  const roles = [...new Set(players.filter((p) => p.faction !== 'spectator').map((p) => p.role))];
  const fakeRoom = {
    code: `hist_${gameId}`,
    maxPlayers,
    seats,
    roles,
    forceRound: 5,
    players: playersMap,
    game: {
      winner: gp.winner || 'unknown',
      assignments,
      missionHistory: gp.missionHistory || [],
      voteHistory: gp.voteHistory || [],
      speakHistory: gp.speakHistory || {},
      assassination: gp.assassination || null,
      evilIntel: gp.evilIntel || [],
      merlinId: merlinEntry ? merlinEntry.id : null,
      assassinId: assassinEntry ? assassinEntry.id : null,
      trust: {},
      recapGenerated: false,
      recapGenerating: false,
      recap: [],
      historyGameId: gameId,
    },
    messages: [],
    phase: 'end',
    _historyMode: true,
  };
  send(client, { type: 'HISTORY_RECAP_GENERATING', data: { gameId } });
  fakeRoom.game.recapGenerated = false;
  _generateRecaps(fakeRoom);
  const checkDone = setInterval(() => {
    if (!fakeRoom.game.recapGenerating && fakeRoom.game.recapGenerated) {
      clearInterval(checkDone);
      generateHistoryRecap._inProgress.delete(gameId);
      const detail = getHistoryDetailForPhone(client.userPhone, gameId);
      if (detail) send(client, { type: 'GAME_HISTORY_DETAIL', data: detail });
    }
  }, 2000);
  setTimeout(() => {
    clearInterval(checkDone);
    generateHistoryRecap._inProgress.delete(gameId);
  }, 300000);
}

function fetchRoleStats(client) {
  if (!client.userPhone) return error(client, 'NEED_LOGIN');
  const stats = getRoleStatsForPhone(client.userPhone);
  send(client, { type: 'ROLE_STATS', data: stats });
}

// ── 导出 ──────────────────────────────────────────────────────────────────────
module.exports = {
  init,
  // 通信
  send, ok, error, broadcastRoom, publicRoom, publicGame,
  // 游戏状态
  startGameState, preselectTeam, nextLeader, setSpeakingStart,
  buildSeatSnapshot, buildGameHistoryPayload, persistGameHistory, updateGameHistoryPayload,
  // 阶段解析
  resolveVote, resolveMission, resolveAssassination,
  // 发言流程
  advanceSpeaker, scheduleSpeakTimeout, enterTeamPhase, interruptActiveFlowForAssassination,
  // 湖中仙女
  isLadyOfLakeEnabled, getLadyOfLakeEligibleTargets, shouldTriggerLadyOfLake,
  autoLadyOfLakeIfAi, resolveLadyOfLake, useLadyOfLake,
  // 大厅
  setProfile, cheatReveal, chooseSeat, updateSettings, viewRole,
  // 游戏控制
  startGame, resetGame, redealIdentities,
  // 发言控制
  nextSpeaker, hostSkipSpeaker, hostSkipToVote, startMissionPhase,
  // 玩家动作
  proposeTeam, updateTeam, voteTeam, executeMission, speak, endSpeak,
  // 刺杀
  startAssassination, assassinate,
  // 历史
  fetchHistoryList, fetchHistoryDetail, generateHistoryRecap, fetchRoleStats,
};
