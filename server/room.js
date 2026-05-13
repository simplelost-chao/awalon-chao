// room.js — 房间生命周期：创建、加入、离开、踢人、快照持久化

const { defaultRolesForCount } = require('./default-role-config');
const {
  FORCE_ROUND_MODE_FIXED_5, MAX_ROUNDS,
  normalizeForceRoundMode, deriveForcedRound, isValidRoleConfig,
  makeId, now,
} = require('./constants');
const {
  deleteActiveRoomTx, persistActiveRoomTx, getOrCreateUser,
} = require('./db');

// ── 依赖注入 ──────────────────────────────────────────────────────────────────
let _rooms, _clients, _broadcastRoom, _send, _error, _ok, _removePlayerById, _takeOverRoomPlayer;

function init(ctx) {
  ({
    rooms: _rooms,
    clients: _clients,
    broadcastRoom: _broadcastRoom,
    send: _send,
    error: _error,
    ok: _ok,
    removePlayerById: _removePlayerById,
    takeOverRoomPlayer: _takeOverRoomPlayer,
  } = ctx);
}

// ── 纯辅助 ────────────────────────────────────────────────────────────────────

function defaultRoles(count) {
  return defaultRolesForCount(count);
}

function padRoles(roles, count) {
  const out = roles.slice();
  while (out.length < count) out.push('忠臣');
  return out;
}

function isSpectatorPlayer(player) {
  return !!(player && player.spectator);
}

function countSeatedPlayers(room) {
  if (!room || !Array.isArray(room.seats)) return 0;
  return room.seats.filter((id) => !!id).length;
}

// ── 快照 / 持久化 ─────────────────────────────────────────────────────────────

function buildActiveRoomSnapshot(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    createdAt: room.createdAt,
    maxPlayers: room.maxPlayers,
    speakingSeconds: room.speakingSeconds,
    roles: room.roles,
    hostRole: room.hostRole || null,
    ladyOfLakeEnabled: !!room.ladyOfLakeEnabled,
    evilRoleVisibleEnabled: !!room.evilRoleVisibleEnabled,
    oberonVisibleEnabled: !!room.oberonVisibleEnabled,
    aiVoiceEnabled: !!room.aiVoiceEnabled,
    forceRoundMode: room.forceRoundMode || FORCE_ROUND_MODE_FIXED_5,
    forceRound: room.forceRound || MAX_ROUNDS,
    seats: room.seats,
    started: room.started,
    phase: room.phase,
    messages: room.messages || [],
    speaking: room.speaking || null,
    gameVersionSeq: Number(room.gameVersionSeq || 0) || 0,
    players: Array.from(room.players.values()),
    game: room.game
      ? {
          startedAt: room.game.startedAt,
          gameVersion: Number(room.game.gameVersion || 0) || 0,
          round: room.game.round,
          attempt: room.game.attempt,
          leaderIndex: room.game.leaderIndex,
          leaderId: room.game.leaderId,
          team: room.game.team || [],
          votes: room.game.votes || {},
          voteHistory: room.game.voteHistory || [],
          missionHistory: room.game.missionHistory || [],
          rejectsInRow: room.game.rejectsInRow || 0,
          assignments: room.game.assignments || {},
          missionVotes: room.game.missionVotes || {},
          speakHistory: room.game.speakHistory || {},
          claims: room.game.claims || {},
          trust: room.game.trust || {},
          revealedRoles: room.game.revealedRoles || null,
          spokeThisRound: room.game.spokeThisRound || {},
          assassinId: room.game.assassinId || null,
          merlinId: room.game.merlinId || null,
          assassination: room.game.assassination || null,
          assassinationCandidates: room.game.assassinationCandidates || [],
          revealedEvil: room.game.revealedEvil || null,
          winner: room.game.winner || null,
          recap: room.game.recap || [],
          evilIntel: room.game.evilIntel || [],
          ladyOfLake: room.game.ladyOfLake || null,
          latestEarnedMedals: room.game.latestEarnedMedals || {},
          historySaved: !!room.game.historySaved,
          historyId: room.game.historyId || null,
          recapGenerating: !!room.game.recapGenerating,
        }
      : null,
    aiNameRegistry: Array.from(room.aiNameRegistry || []),
  };
}

function deleteActiveRoom(roomCode) {
  if (!roomCode) return;
  deleteActiveRoomTx(roomCode);
}

function persistActiveRoom(room) {
  if (!room || !room.code) return;
  // 游戏已结束（historySaved）时，从 active_rooms 中删除，防止重启后幽灵游戏
  if (room.game && room.game.historySaved) {
    deleteActiveRoom(room.code);
    return;
  }
  const humanPlayers = Array.from(room.players.values()).filter((player) => !player.isAI && player.phone);
  if (humanPlayers.length === 0) {
    deleteActiveRoom(room.code);
    return;
  }
  persistActiveRoomTx(room.code, JSON.stringify(buildActiveRoomSnapshot(room)), humanPlayers, now());
}

function hydrateRoomFromSnapshot(snapshot, options = {}) {
  if (!snapshot || !snapshot.code) return null;
  const forceHumansOffline = options.forceHumansOffline !== false;
  const oberonVisibleEnabled = !!snapshot.oberonVisibleEnabled;
  const players = (Array.isArray(snapshot.players) ? snapshot.players : []).map((player) => {
    const next = { ...player };
    if (!next.isAI && next.phone && forceHumansOffline) {
      next.offline = true;
    }
    return next;
  });
  return {
    code: snapshot.code,
    hostId: snapshot.hostId || null,
    createdAt: snapshot.createdAt || now(),
    maxPlayers: snapshot.maxPlayers || 7,
    speakingSeconds: snapshot.speakingSeconds || 120,
    roles: Array.isArray(snapshot.roles) ? snapshot.roles : defaultRoles(snapshot.maxPlayers || 7),
    hostRole: snapshot.hostRole || null,
    ladyOfLakeEnabled: !!snapshot.ladyOfLakeEnabled && (snapshot.maxPlayers || 7) >= 8,
    evilRoleVisibleEnabled: !!snapshot.evilRoleVisibleEnabled,
    oberonVisibleEnabled,
    aiVoiceEnabled: !!snapshot.aiVoiceEnabled,
    forceRoundMode: normalizeForceRoundMode(snapshot.forceRoundMode),
    forceRound: deriveForcedRound(
      snapshot.maxPlayers || 7,
      Array.isArray(snapshot.roles) ? snapshot.roles : defaultRoles(snapshot.maxPlayers || 7),
      snapshot.forceRoundMode
    ),
    seats: Array.isArray(snapshot.seats) ? snapshot.seats : [],
    players: new Map(players.map((player) => [player.id, player])),
    started: !!snapshot.started,
    phase: snapshot.phase || 'lobby',
    messages: Array.isArray(snapshot.messages) ? snapshot.messages : [],
    gameVersionSeq: Number(snapshot.gameVersionSeq || 0) || 0,
    game: snapshot.game || null,
    speaking: snapshot.speaking || null,
    aiNameRegistry: new Set(Array.isArray(snapshot.aiNameRegistry) ? snapshot.aiNameRegistry : []),
    speakingTimeout: null,
  };
}

// ── 房间操作 ──────────────────────────────────────────────────────────────────

function createRoom(hostClient, payload) {
  if (!hostClient.userPhone) return _error(hostClient, 'NEED_LOGIN');
  if (hostClient.roomCode) {
    leaveRoom(hostClient);
  }
  let roomCode = '';
  if (payload.roomCode !== undefined && payload.roomCode !== null && String(payload.roomCode).trim() !== '') {
    const requested = String(payload.roomCode).trim();
    if (!/^\d{5}$/.test(requested)) return _error(hostClient, 'INVALID_ROOM_CODE');
    if (_rooms.has(requested)) return _error(hostClient, 'ROOM_EXISTS');
    roomCode = requested;
  } else {
    roomCode = makeId(5);
    while (_rooms.has(roomCode)) roomCode = makeId(5);
  }

  const maxPlayers = Number(payload.maxPlayers || 7);
  const roles = Array.isArray(payload.roles) && payload.roles.length ? payload.roles : defaultRoles(maxPlayers);
  console.log('[createRoom]', {
    maxPlayers,
    oberonVisibleEnabled: payload.oberonVisibleEnabled,
    roles,
  });
  if (!isValidRoleConfig(maxPlayers, roles)) return _error(hostClient, 'INVALID_ROLE_CONFIG');
  const forceRoundMode = normalizeForceRoundMode(payload.forceRoundMode);
  const oberonVisibleEnabled = !!payload.oberonVisibleEnabled;
  const room = {
    code: roomCode,
    hostId: hostClient.id,
    createdAt: now(),
    maxPlayers,
    speakingSeconds: Number(payload.speakingSeconds) >= 10 ? Number(payload.speakingSeconds) : 120,
    roles,
    hostRole: payload.hostRole || null,
    ladyOfLakeEnabled: !!payload.ladyOfLakeEnabled && maxPlayers >= 8,
    evilRoleVisibleEnabled: !!payload.evilRoleVisibleEnabled,
    oberonVisibleEnabled,
    aiVoiceEnabled: !!payload.aiVoiceEnabled,
    forceRoundMode,
    forceRound: deriveForcedRound(maxPlayers, roles, forceRoundMode),
    seats: [],
    players: new Map(),
    started: false,
    phase: 'lobby',
    messages: [],
    gameVersionSeq: 0,
    game: null,
    aiNameRegistry: new Set(),
  };

  _rooms.set(roomCode, room);
  joinRoom(hostClient, { roomCode, nickname: payload.nickname, avatar: payload.avatar });
  return roomCode;
}

function joinRoom(client, payload) {
  if (!client.userPhone) return _error(client, 'NEED_LOGIN');
  const room = _rooms.get(payload.roomCode);
  if (!room) return _error(client, 'ROOM_NOT_FOUND');
  // 如果玩家当前在另一个房间，先离开
  if (client.roomCode && client.roomCode !== payload.roomCode) {
    leaveRoom(client);
  }
  const existingPlayer = Array.from(room.players.values()).find(
    (player) => !player.isAI && player.phone && player.phone === client.userPhone
  );
  if (existingPlayer) {
    const user = getOrCreateUser(client.userPhone);
    existingPlayer.nickname = (payload.nickname || user.nickname || existingPlayer.nickname || '玩家').slice(0, 12);
    existingPlayer.avatar = payload.avatar || user.avatar || existingPlayer.avatar || '🐺';
    _takeOverRoomPlayer(client, room, existingPlayer);
    return _ok(client, { roomCode: room.code, recovered: true });
  }
  const forceSpectator = !!room.started || countSeatedPlayers(room) >= room.maxPlayers || payload.avatar === '👀';
  const user = getOrCreateUser(client.userPhone);
  const nickname = (payload.nickname || user.nickname || '玩家').slice(0, 12);
  const avatar = (payload.avatar && payload.avatar !== '👀') ? payload.avatar : (user.avatar || '🐺');

  room.players.set(client.id, {
    id: client.id,
    nickname,
    avatar,
    phone: client.userPhone,
    seat: null,
    joinedAt: now(),
    isAI: false,
    spectator: forceSpectator,
    offline: false,
    autoplay: false,
  });
  // If joining as spectator during a live game, add to snapshot immediately so history records them even if they leave early
  if (forceSpectator && room.started && room.game && client.userPhone) {
    const snap = room.game.spectatorSnapshot = room.game.spectatorSnapshot || [];
    if (!snap.some((s) => s.id === client.id)) {
      snap.push({ id: client.id, nickname, phone: client.userPhone });
    }
  }
  client.roomCode = room.code;
  _broadcastRoom(room);
  return _ok(client, { roomCode: room.code, spectator: forceSpectator });
}

function kickPlayer(client, payload) {
  const room = _rooms.get(client.roomCode);
  if (!room || room.hostId !== client.id) return;
  const { targetId } = payload;
  if (!targetId || targetId === client.id) return;
  const target = room.players.get(targetId);
  if (!target) return;
  // Notify the kicked player before removing
  _send({ id: targetId }, { type: 'KICKED' });
  const kickedClient = _clients.get(targetId);
  if (kickedClient) kickedClient.roomCode = null;
  _removePlayerById(room, targetId);
}

function leaveRoom(client) {
  const room = _rooms.get(client.roomCode);
  if (!room) return;
  _removePlayerById(room, client.id);
  client.roomCode = null;
}

// ── 导出 ──────────────────────────────────────────────────────────────────────
module.exports = {
  init,
  defaultRoles,
  padRoles,
  isSpectatorPlayer,
  countSeatedPlayers,
  buildActiveRoomSnapshot,
  deleteActiveRoom,
  persistActiveRoom,
  hydrateRoomFromSnapshot,
  createRoom,
  joinRoom,
  kickPlayer,
  leaveRoom,
};
