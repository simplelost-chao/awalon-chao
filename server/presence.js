// presence.js — WebSocket 连接生命周期、断线重连、玩家状态管理

const { ROLE_FACTIONS, now } = require('./constants');
const { deleteActiveRoomPlayerByPhoneStmt } = require('./db');

// ── 共享状态（由 index.js 通过 import 访问）──────────────────────────────────
const parsedReconnectGraceMs = Number(process.env.RECONNECT_GRACE_MS || '');
const RECONNECT_GRACE_MS =
  Number.isFinite(parsedReconnectGraceMs) && parsedReconnectGraceMs > 0
    ? parsedReconnectGraceMs
    : 30 * 60 * 1000;

const reconnectEntries = new Map(); // phone → { roomCode, playerId, expiresAt, timer }
const autoplayTimers = new Map();   // phone → timer（断线后自动开托管）

// ── 依赖注入 ──────────────────────────────────────────────────────────────────
let _rooms, _clients, _deleteActiveRoom, _persistActiveRoom,
    _restoreActiveRoomForPhone, _leaveRoom, _broadcastRoom, _send, _resolveMission;

function init(ctx) {
  ({
    rooms: _rooms,
    clients: _clients,
    deleteActiveRoom: _deleteActiveRoom,
    persistActiveRoom: _persistActiveRoom,
    restoreActiveRoomForPhone: _restoreActiveRoomForPhone,
    leaveRoom: _leaveRoom,
    broadcastRoom: _broadcastRoom,
    send: _send,
    resolveMission: _resolveMission,
  } = ctx);
}

// ── 断线条目管理 ───────────────────────────────────────────────────────────────

function clearReconnectEntry(phone) {
  if (!phone) return;
  const prev = reconnectEntries.get(phone);
  if (prev && prev.timer) clearTimeout(prev.timer);
  reconnectEntries.delete(phone);
}

function scheduleReconnectOfflineMark(roomCode, playerId, phone) {
  clearReconnectEntry(phone);
  const expiresAt = now() + RECONNECT_GRACE_MS;
  const timer = setTimeout(() => {
    const current = reconnectEntries.get(phone);
    if (!current || current.playerId !== playerId || current.expiresAt !== expiresAt) return;
    reconnectEntries.delete(phone); // 先删自己的条目，再检查是否还有其他人在宽限期

    const room = _rooms.get(roomCode);
    if (!room) return;
    const player = room.players.get(playerId);
    if (!player || player.offline) return;
    player.offline = true;

    // 是否还有人在线（已连接）
    const anyConnected = Array.from(room.players.values()).some(
      (p) => !p.isAI && !p.offline && _clients.has(p.id)
    );
    // 是否还有人在宽限期内（断线但可能回来）
    const anyInGrace = Array.from(reconnectEntries.values()).some((e) => e.roomCode === roomCode);

    if (!anyConnected && !anyInGrace) {
      // 真正无人，清理房间
      _rooms.delete(roomCode);
      _deleteActiveRoom(roomCode);
      return;
    }

    _persistActiveRoom(room);
    _broadcastRoom(room);
  }, RECONNECT_GRACE_MS);
  reconnectEntries.set(phone, { roomCode, playerId, expiresAt, timer });
}

// ── 玩家移除 ──────────────────────────────────────────────────────────────────

function removePlayerById(room, playerId) {
  const player = room.players.get(playerId);
  if (player && player.phone) {
    clearReconnectEntry(player.phone);
    deleteActiveRoomPlayerByPhoneStmt.run(player.phone);
  }

  room.players.delete(playerId);
  room.seats = room.seats.map((id) => (id === playerId ? null : id));
  if (room.hostId === playerId) {
    const nextHost = Array.from(room.players.values()).find((entry) => !entry.isAI) || null;
    room.hostId = nextHost ? nextHost.id : null;
  }
  const remainingHumans = Array.from(room.players.values()).filter((entry) => !entry.isAI);
  if (room.players.size === 0 || remainingHumans.length === 0) {
    _rooms.delete(room.code);
    _deleteActiveRoom(room.code);
    return;
  }
  _broadcastRoom(room);
}

// ── clientId 重绑与接管 ──────────────────────────────────────────────────────

function rebindClientId(client, targetId) {
  if (!targetId || client.id === targetId) return;
  const ws = _clients.get(client.id);
  _clients.delete(client.id);
  client.id = targetId;
  if (ws) _clients.set(targetId, ws);
}

function detachSocketClient(ws) {
  if (!ws) return;
  const priorClient = ws._clientRef;
  if (!priorClient) return;
  priorClient.detached = true;
  priorClient.roomCode = null;
}

function takeOverRoomPlayer(client, room, player) {
  if (!room || !player) return null;
  const oldWs = _clients.get(player.id);
  const nextWs = _clients.get(client.id);
  if (oldWs && nextWs && oldWs !== nextWs) {
    detachSocketClient(oldWs);
    try { oldWs.close(4001, 'SESSION_TAKEN_OVER'); } catch (e) {}
  }

  clearReconnectEntry(player.phone);
  const apTimer = autoplayTimers.get(player.phone);
  if (apTimer) { clearTimeout(apTimer); autoplayTimers.delete(player.phone); }

  rebindClientId(client, player.id);
  client.roomCode = room.code;
  player.offline = false;
  player.lastReconnectedAt = now();
  _broadcastRoom(room);
  return { roomCode: room.code, playerId: player.id };
}

// ── 重连恢复 ──────────────────────────────────────────────────────────────────

function recoverClientPresence(client) {
  if (!client.userPhone) return null;
  const restoredRoom = _restoreActiveRoomForPhone(client.userPhone);
  let found = null;
  if (restoredRoom) {
    for (const player of restoredRoom.players.values()) {
      if (!player.isAI && player.phone === client.userPhone && player.offline) {
        found = { roomCode: restoredRoom.code, playerId: player.id };
        break;
      }
    }
  }
  if (!found) found = reconnectEntries.get(client.userPhone);
  if (!found) {
    for (const room of _rooms.values()) {
      for (const player of room.players.values()) {
        if (!player.isAI && player.phone === client.userPhone && player.offline) {
          found = { roomCode: room.code, playerId: player.id };
          break;
        }
      }
      if (found) break;
    }
  }
  if (!found) return null;

  const room = _rooms.get(found.roomCode);
  const player = room ? room.players.get(found.playerId) : null;
  if (!room || !player) {
    clearReconnectEntry(client.userPhone);
    return null;
  }
  return takeOverRoomPlayer(client, room, player);
}

// ── 断线处理 ──────────────────────────────────────────────────────────────────

function handleSocketClose(client) {
  const room = _rooms.get(client.roomCode);
  if (!room) return;
  const player = room.players.get(client.id);
  if (!player || player.isAI || !player.phone) {
    _leaveRoom(client);
    return;
  }

  // 不在这里改 offline 状态，也不立即删房间。
  // 统一走宽限期：宽限到期且无人时才清理。
  player.lastDisconnectedAt = now();
  _persistActiveRoom(room);
  scheduleReconnectOfflineMark(room.code, player.id, player.phone);

  // 出征阶段：断线玩家30秒未回来自动代为出牌
  if (room.phase === 'mission' && room.game && Array.isArray(room.game.team) && room.game.team.includes(client.id)) {
    const pid = client.id;
    setTimeout(() => {
      const r = _rooms.get(room.code);
      if (!r || r.phase !== 'mission' || !r.game) return;
      if (r.game.missionVotes && r.game.missionVotes[pid] !== undefined) return;
      const p = r.players.get(pid);
      if (p && !p.offline && _clients.has(pid)) return;
      r.game.missionVotes[pid] = false;
      r.messages.push({ ts: now(), from: '系统', text: `${p ? p.nickname : '玩家'} 断线，已自动代为出牌` });
      if (r.game.team.every((id) => r.game.missionVotes[id] !== undefined)) {
        _resolveMission(r);
      }
      _broadcastRoom(r);
    }, 30000);
  }
}

// ── 导出 ──────────────────────────────────────────────────────────────────────
module.exports = {
  init,
  RECONNECT_GRACE_MS,
  reconnectEntries,
  autoplayTimers,
  clearReconnectEntry,
  removePlayerById,
  scheduleReconnectOfflineMark,
  rebindClientId,
  detachSocketClient,
  takeOverRoomPlayer,
  recoverClientPresence,
  handleSocketClose,
};
