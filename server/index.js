const express = require('express');
require('dotenv').config();
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { defaultRolesForCount, DEFAULT_ROLE_CONFIG } = require('./default-role-config');
const { MEDAL_DEFS, evaluateMedalsForPayload } = require('./medals');
const {
  MAX_ROUNDS, FORCE_ROUND_MODE_FIXED_5, FORCE_ROUND_MODE_EVIL_PLUS_ONE,
  TEAM_SIZES, FAIL_REQUIREMENT, ROLE_FACTIONS, EVIL_COUNT_BY_PLAYERS,
  now, shuffle, makeId, isValidPhone, makeToken,
  expectedEvilCount, countEvilRoles, normalizeForceRoundMode, deriveForcedRound, isValidRoleConfig,
  seatNumber, getTeamSize, getFailRequirement,
} = require('./constants');
const {
  userDb,
  deleteActiveRoomPlayerByPhoneStmt, getActiveRoomPlayerByPhoneStmt,
  getActiveRoomSnapshotStmt, getAllActiveRoomSnapshotsStmt,
  persistActiveRoomTx, deleteActiveRoomTx,
  getOrCreateUser, updateUserProfile,
} = require('./db');
const {
  summarizePeerVotes, getHistoryListForPhone, getHistoryDetailForPhone,
  getRoleStatsForPhone, savePeerVoteForHistory,
} = require('./history');
const {
  init: initGameAi,
  assassinAutoplayTimers,
  fillAiPlayers, autoSeatHumans,
  autoSpeakIfAi, aiSpeak, pushSpeak, canSpeak,
  autoVoteIfAi, aiVote, normalizeAiVote,
  autoMissionIfAi, aiMissionVote, normalizeAiMission,
  autoProposeIfAiLeader, aiPickTeam,
  autoAssassinateIfAi, aiAssassinate, scheduleAutoAssassinIfAutoplay,
  triggerAutoplayActions, autoplayPropose, autoplaySkipSpeak, autoplayVote, autoplayMission, autoplayLady,
  generateRecaps, roleInfoForRecap,
  gatherEvilIntel, revealAll, revealEvilToEvil, revealEvilToAll,
  inferAiKnowledge, inferSpeechClaimedEvilIds, inferMissionHardKnowledge, inferPublicSuspicion,
  getMerlinKnownEvilIds, extractVoteClaim, hasMerlinReasonContradiction, buildMerlinReason,
  resolveVoiceDone,
} = require('./game-ai');
const {
  init: initPresence,
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
} = require('./presence');
const {
  init: initRoom,
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
} = require('./room');
const {
  init: initGame,
  send, ok, error, broadcastRoom, publicRoom, publicGame,
  resolveVote, resolveMission, resolveAssassination,
  advanceSpeaker, scheduleSpeakTimeout, setSpeakingStart, updateGameHistoryPayload,
  startGame, resetGame, redealIdentities,
  proposeTeam, updateTeam, voteTeam, executeMission, speak, endSpeak,
  nextSpeaker, hostSkipSpeaker, hostSkipToVote, startMissionPhase,
  startAssassination, assassinate, useLadyOfLake, resolveLadyOfLake, getLadyOfLakeEligibleTargets,
  chooseSeat, updateSettings, setProfile, cheatReveal, viewRole,
  fetchHistoryList, fetchHistoryDetail, generateHistoryRecap, fetchRoleStats,
} = require('./game');

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.get('/health', (req, res) => res.json({ ok: true, token: 'awalon-ok' }));
let runtimeReviewMode = process.env.REVIEW_MODE === 'true';
const ADMIN_KEY = process.env.ADMIN_KEY || '';

app.get('/api/review-mode', (req, res) => res.json({ reviewMode: runtimeReviewMode }));

// Skin catalogue — edit statuses here to publish/unpublish skins
const SKIN_CATALOGUE = [
  { id: 'dark-gold',    name: '暗夜金',   status: 'published' },
  { id: 'celestial',   name: '仙境',     status: 'draft' },
  { id: 'ink-wash',    name: '水墨古风', status: 'draft' },
  { id: 'cyber-neon',  name: '赛博霓虹', status: 'draft' },
  { id: 'dark-dungeon',name: '暗黑地牢', status: 'draft' },
  { id: 'abyss',       name: '深渊',     status: 'draft' },
];

app.get('/api/skins', (req, res) => {
  res.json({ skins: SKIN_CATALOGUE });
});

app.post('/api/admin/set-mode', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  const mode = req.body && req.body.mode;
  if (mode !== 'review' && mode !== 'game') return res.status(400).json({ error: 'invalid mode' });
  runtimeReviewMode = (mode === 'review');
  console.log(`[Admin] 切换至${runtimeReviewMode ? '审核' : '游戏'}模式`);
  res.json({ ok: true, reviewMode: runtimeReviewMode });
});

app.get('/admin', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).send('forbidden');
  const mode = runtimeReviewMode ? 'review' : 'game';
  const key = req.query.key;
  res.send(`<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Awalon 管理</title>
<style>
  body{font-family:-apple-system,sans-serif;background:#0d1117;color:#e6edf3;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;gap:24px}
  h2{margin:0;font-size:20px;color:#8b949e}
  .badge{padding:8px 22px;border-radius:999px;font-size:18px;font-weight:700}
  .badge.review{background:#3d1a00;color:#f0883e;border:1px solid #f0883e55}
  .badge.game{background:#0d2d0d;color:#3fb950;border:1px solid #3fb95055}
  .btns{display:flex;gap:16px}
  button{padding:12px 32px;border-radius:10px;border:none;font-size:16px;font-weight:600;cursor:pointer;transition:.15s}
  .btn-review{background:#f0883e;color:#0d1117}
  .btn-game{background:#3fb950;color:#0d1117}
  button:hover{opacity:.85}
  .hint{font-size:13px;color:#484f58;margin-top:8px}
</style>
</head>
<body>
<h2>Awalon 模式控制</h2>
<div class="badge ${mode}">${mode === 'review' ? '🔒 审核模式' : '🎮 游戏模式'}</div>
<div class="btns">
  <button class="btn-review" onclick="setMode('review')">切换为审核模式</button>
  <button class="btn-game" onclick="setMode('game')">切换为游戏模式</button>
</div>
<div class="hint">切换立即生效，无需重启服务</div>
<script>
async function setMode(mode){
  const r=await fetch('/api/admin/set-mode?key=${key}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode})});
  if(r.ok) location.reload();
}
</script>
</body>
</html>`);
});
app.get('/api/admin/ai-stats', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  try { res.json(getAiLearningStats()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/admin/ai', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).send('forbidden');
  res.sendFile(path.join(__dirname, 'ai-dashboard.html'));
});
app.post('/api/admin/trigger-meta', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  maybeRunMetaAnalysis(true).then(() => res.json({ ok: true })).catch(e => res.status(500).json({ error: e.message }));
});

app.get('/api/role-config', (req, res) => res.json(DEFAULT_ROLE_CONFIG));
app.get('/api/rooms', (req, res) => {
  const list = [];
  for (const room of rooms.values()) {
    if (room._historyMode) continue;
    if (!room.hostId || String(room.code).startsWith('hist')) continue;
    if (room.phase === 'end') continue;
    const host = room.players.get(room.hostId);
    if (!host) continue; // 无有效房主的房间不展示
    const humanPlayers = Array.from(room.players.values()).filter(p => !p.isAI && !p.spectator);
    const seatedCount = (room.seats || []).filter(Boolean).length;
    const joinable = !room.started && seatedCount < room.maxPlayers;
    const avatarRaw = host.avatar || '🐺';
    const avatarIsImage = avatarRaw.startsWith('http');
    const missionMap = {};
    ((room.game && room.game.missionHistory) || []).forEach((m) => { missionMap[m.round] = m.success; });
    const missionSegs = [1, 2, 3, 4, 5].map((r) =>
      missionMap[r] === true ? 'win' : missionMap[r] === false ? 'lose' : 'pending'
    );
    list.push({
      code: room.code,
      hostName: host.nickname || '玩家',
      hostAvatarText: avatarIsImage ? '' : avatarRaw,
      hostAvatarImage: avatarIsImage ? avatarRaw : '',
      playerCount: humanPlayers.length,
      seatedCount,
      maxPlayers: room.maxPlayers,
      started: !!room.started,
      joinable,
      missionSegs,
    });
  }
  list.sort((a, b) => (b.joinable ? 1 : 0) - (a.joinable ? 1 : 0));
  res.json({ rooms: list });
});
const uploadRoot = path.join(__dirname, 'uploads');
const avatarUploadDir = path.join(uploadRoot, 'avatars');
fs.mkdirSync(avatarUploadDir, { recursive: true });
app.use('/uploads', express.static(uploadRoot));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;
const WX_APPID = process.env.WX_APPID || '';
const WX_APPSECRET = process.env.WX_APPSECRET || '';
let wxTokenCache = { token: '', expireAt: 0 };

async function getWxAccessToken() {
  if (!WX_APPID || !WX_APPSECRET) throw new Error('WX_CONFIG_MISSING');
  const nowTs = Date.now();
  if (wxTokenCache.token && nowTs < wxTokenCache.expireAt) return wxTokenCache.token;

  const resp = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WX_APPID}&secret=${WX_APPSECRET}`
  );
  const data = await resp.json();
  if (!resp.ok || data.errcode) {
    throw new Error(`WX_TOKEN_ERROR:${data.errcode || resp.status}`);
  }

  const expiresIn = Number(data.expires_in || 7200);
  wxTokenCache = {
    token: data.access_token,
    expireAt: nowTs + Math.max(300, expiresIn - 300) * 1000,
  };
  return wxTokenCache.token;
}

async function getWxOpenIdByCode(code) {
  if (!WX_APPID || !WX_APPSECRET) throw new Error('WX_CONFIG_MISSING');
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_APPSECRET}&js_code=${code}&grant_type=authorization_code`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = await resp.json();
  if (!resp.ok || data.errcode || !data.openid) {
    throw new Error(`WX_CODE2SESSION_ERROR:${data.errcode || resp.status}`);
  }
  return String(data.openid);
}

function pseudoPhoneFromOpenId(openid) {
  // Keep existing login protocol unchanged: map openid to deterministic 11-digit pseudo phone.
  let hash = 0;
  for (let i = 0; i < openid.length; i++) hash = (hash * 131 + openid.charCodeAt(i)) % 1000000000;
  const tail9 = String(hash).padStart(9, '0');
  return `1${tail9}${Math.floor(Math.abs(hash) % 10)}`.slice(0, 11);
}

async function getPhoneFromWxCode(phoneCode) {
  const accessToken = await getWxAccessToken();
  const resp = await fetch(
    `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: phoneCode }),
    }
  );
  const data = await resp.json();
  if (!resp.ok || data.errcode) {
    throw new Error(`WX_PHONE_ERROR:${data.errcode || resp.status}`);
  }
  const phone = String((data.phone_info && (data.phone_info.purePhoneNumber || data.phone_info.phoneNumber)) || '').trim();
  if (!/^1\d{10}$/.test(phone)) throw new Error('WX_PHONE_INVALID');
  return phone;
}

function userFromToken(token) {
  const safeToken = String(token || '').trim();
  if (!safeToken || !sessions.has(safeToken)) return null;
  const phone = sessions.get(safeToken);
  if (!isValidPhone(phone)) return null;
  return { phone, user: getOrCreateUser(phone) };
}

function avatarPublicUrl(req, fileName) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || '';
  return `${proto}://${host}/uploads/avatars/${fileName}`;
}

function removeLocalAvatarIfOwned(avatar) {
  const text = String(avatar || '');
  const match = /\/uploads\/avatars\/([^/?#]+)$/.exec(text);
  if (!match) return;
  const localPath = path.join(avatarUploadDir, match[1]);
  if (!localPath.startsWith(avatarUploadDir)) return;
  try {
    fs.unlinkSync(localPath);
  } catch (e) {}
}

app.post('/api/profile/avatar', async (req, res) => {
  try {
    const auth = userFromToken(req.body && req.body.token);
    if (!auth) return res.status(401).json({ ok: false, code: 'INVALID_TOKEN' });

    const imageBase64 = String((req.body && req.body.imageBase64) || '').trim();
    if (!imageBase64) return res.status(400).json({ ok: false, code: 'MISSING_IMAGE' });

    const buffer = Buffer.from(imageBase64, 'base64');
    if (!buffer.length) return res.status(400).json({ ok: false, code: 'INVALID_IMAGE' });
    if (buffer.length > 3 * 1024 * 1024) {
      return res.status(400).json({ ok: false, code: 'IMAGE_TOO_LARGE' });
    }

    const fileName = `${auth.phone}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const filePath = path.join(avatarUploadDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const avatar = avatarPublicUrl(req, fileName);
    removeLocalAvatarIfOwned(auth.user.avatar);
    updateUserProfile(auth.phone, auth.user.nickname, avatar);
    return res.json({ ok: true, data: { avatar } });
  } catch (e) {
    return res.status(400).json({ ok: false, code: e.message || 'AVATAR_UPLOAD_FAILED' });
  }
});

app.post('/api/wx/openid-login', async (req, res) => {
  try {
    const code = String((req.body && req.body.code) || '').trim();
    const nicknameInput = String((req.body && req.body.nickname) || '').trim();
    if (!code) return res.status(400).json({ ok: false, code: 'MISSING_CODE' });

    const openid = await getWxOpenIdByCode(code);
    const phone = pseudoPhoneFromOpenId(openid);
    const user = getOrCreateUser(phone);
    const nickname = nicknameInput ? nicknameInput.slice(0, 12) : user.nickname;
    if (nickname !== user.nickname) {
      updateUserProfile(phone, nickname, user.avatar);
    }

    return res.json({ ok: true, data: { phone, openid, user: { ...user, nickname } } });
  } catch (e) {
    return res.status(400).json({ ok: false, code: e.message || 'WX_OPENID_LOGIN_FAILED' });
  }
});

app.post('/api/wx/phone-login', async (req, res) => {
  try {
    const code = String((req.body && req.body.code) || '').trim();
    const nicknameInput = String((req.body && req.body.nickname) || '').trim();
    if (!code) return res.status(400).json({ ok: false, code: 'MISSING_CODE' });

    const phone = await getPhoneFromWxCode(code);
    const user = getOrCreateUser(phone);
    const nickname = nicknameInput ? nicknameInput.slice(0, 12) : user.nickname;
    if (nickname !== user.nickname) {
      updateUserProfile(phone, nickname, user.avatar);
    }

    return res.json({ ok: true, data: { phone, user: { ...user, nickname } } });
  } catch (e) {
    return res.status(400).json({ ok: false, code: e.message || 'WX_LOGIN_FAILED' });
  }
});


// In-memory state
const rooms = new Map();
const sessions = new Map();
const phoneClients = new Map(); // phone → clientId，用于单设备登录踢出



const {
  recordGameSummary,
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
  getAiLearningStats,
  maybeRunMetaAnalysis,
} = require('./ai');

// AI 角色库：名字即人设，每个角色有独特发言风格与博弈习惯
function kickOldSession(phone, newClient) {
  const oldClientId = phoneClients.get(phone);
  if (oldClientId && oldClientId !== newClient.id) {
    const oldWs = clients.get(oldClientId);
    if (oldWs) {
      // 踢出前先持久化旧连接所在的房间，让新设备登录后能恢复
      const oldClient = oldWs._clientRef;
      if (oldClient && oldClient.roomCode) {
        const oldRoom = rooms.get(oldClient.roomCode);
        if (oldRoom) persistActiveRoom(oldRoom);
      }
      detachSocketClient(oldWs);
      try { oldWs.close(4001, 'SESSION_TAKEN_OVER'); } catch (e) {}
    }
  }
  phoneClients.set(phone, newClient.id);
}

function login(client, payload) {
  const phone = String((payload && payload.phone) || '').trim();
  if (!isValidPhone(phone)) return error(client, 'INVALID_PHONE');
  const user = getOrCreateUser(phone);
  const token = makeToken();
  sessions.set(token, phone);
  client.userPhone = phone;
  client.authToken = token;
  kickOldSession(phone, client);
  const recovered = recoverClientPresence(client);
  phoneClients.set(phone, client.id); // rebindClientId 可能改变了 client.id，更新映射
  send(client, {
    type: 'LOGIN_OK',
    data: {
      token,
      user,
      recovered: !!recovered,
      recoveredPlayerId: recovered ? recovered.playerId : null,
    },
  });
  if (recovered) {
    send(client, { type: 'WELCOME', clientId: client.id, recovered: true });
    send(client, { type: 'RECOVERED', data: recovered });
  }
}

function auth(client, payload) {
  const token = String((payload && payload.token) || '').trim();
  if (!token || !sessions.has(token)) return error(client, 'INVALID_TOKEN');
  const phone = sessions.get(token);
  const user = getOrCreateUser(phone);
  client.userPhone = phone;
  client.authToken = token;
  kickOldSession(phone, client);
  const recovered = recoverClientPresence(client);
  phoneClients.set(phone, client.id); // rebindClientId 可能改变了 client.id，更新映射
  send(client, {
    type: 'AUTH_OK',
    data: {
      token,
      user,
      recovered: !!recovered,
      recoveredPlayerId: recovered ? recovered.playerId : null,
    },
  });
  if (recovered) {
    send(client, { type: 'WELCOME', clientId: client.id, recovered: true });
    send(client, { type: 'RECOVERED', data: recovered });
  }
}

function requireAuth(client) {
  return !!client.userPhone;
}

function syncClientSeqWithRoom(room) {
  if (!room || !room.players) return;
  for (const player of room.players.values()) {
    const match = /^u(\d+)$/.exec(String(player.id || ''));
    if (!match) continue;
    clientSeq = Math.max(clientSeq, Number(match[1]) + 1);
  }
}

function resumeActiveRoom(room) {
  if (!room) return;
  if (room.speakingTimeout) {
    clearTimeout(room.speakingTimeout);
    room.speakingTimeout = null;
  }
  if (!room.started || !room.game) return;
  if (room.game.historySaved) return; // 游戏已结束，禁止恢复以防幽灵游戏
  if (room.phase === 'team') {
    const leader = room.players.get(room.game.leaderId);
    if (leader && leader.isAI) autoProposeIfAiLeader(room);
    autoplayPropose(room);
    return;
  }
  if (room.phase === 'speaking' && room.speaking) {
    scheduleSpeakTimeout(room);
    autoSpeakIfAi(room);
    return;
  }
  if (room.phase === 'voting') {
    autoVoteIfAi(room); autoplayVote(room);
    return;
  }
  if (room.phase === 'mission') {
    autoMissionIfAi(room); autoplayMission(room);
    return;
  }
  if (room.phase === 'assassination') {
    autoAssassinateIfAi(room); scheduleAutoAssassinIfAutoplay(room);
  }
}

function restoreActiveRoomForPhone(phone) {
  if (!phone) return null;
  const ref = getActiveRoomPlayerByPhoneStmt.get(phone);
  if (!ref || !ref.roomCode) return null;
  const inMemoryRoom = rooms.get(ref.roomCode);
  if (inMemoryRoom) return inMemoryRoom;

  const row = getActiveRoomSnapshotStmt.get(ref.roomCode);
  if (!row || !row.snapshot) {
    deleteActiveRoomPlayerByPhoneStmt.run(phone);
    return null;
  }

  let snapshot = null;
  try {
    snapshot = JSON.parse(row.snapshot);
  } catch (e) {
    deleteActiveRoom(ref.roomCode);
    return null;
  }

  if (!snapshot || !snapshot.code) {
    deleteActiveRoom(ref.roomCode);
    return null;
  }

  const room = hydrateRoomFromSnapshot(snapshot, { forceHumansOffline: true });
  if (!room) {
    deleteActiveRoom(ref.roomCode);
    return null;
  }
  rooms.set(room.code, room);
  syncClientSeqWithRoom(room);
  resumeActiveRoom(room);
  return room;
}

function loadPersistedActiveRooms() {
  const rows = getAllActiveRoomSnapshotsStmt.all();
  for (const row of rows) {
    if (!row || !row.snapshot) continue;
    let snapshot = null;
    try {
      snapshot = JSON.parse(row.snapshot);
    } catch (e) {
      if (row.roomCode) deleteActiveRoom(row.roomCode);
      continue;
    }
    const room = hydrateRoomFromSnapshot(snapshot, { forceHumansOffline: true });
    if (!room || !room.code || rooms.has(room.code)) continue;
    rooms.set(room.code, room);
    syncClientSeqWithRoom(room);
    resumeActiveRoom(room);
  }
}

// ─── 托管（Autoplay）核心逻辑 ────────────────────────────────────────────────


const clients = new Map();
let clientSeq = 1;

// 注入 game.js 所需的运行时状态与 AI 函数
initGame({
  rooms,
  clients,
  fillAiPlayers, autoSeatHumans,
  autoProposeIfAiLeader, autoplayPropose, autoplaySkipSpeak,
  autoSpeakIfAi, autoVoteIfAi, autoplayVote,
  autoMissionIfAi, autoplayMission,
  autoAssassinateIfAi, scheduleAutoAssassinIfAutoplay,
  generateRecaps, gatherEvilIntel,
  revealAll, revealEvilToAll,
});

// 注入 presence.js 所需的副作用函数
initPresence({
  rooms,
  clients,
  deleteActiveRoom,
  persistActiveRoom,
  restoreActiveRoomForPhone,
  leaveRoom,
  broadcastRoom,
  send,
  resolveMission,
});

// 注入 room.js 所需的副作用函数
initRoom({
  rooms,
  clients,
  broadcastRoom,
  send,
  error,
  ok,
  removePlayerById,
  takeOverRoomPlayer,
});

// 注入 game-ai.js 所需的副作用函数
initGameAi({
  broadcastRoom,
  advanceSpeaker,
  scheduleSpeakTimeout,
  setSpeakingStart,
  resolveVote,
  resolveMission,
  resolveAssassination,
  resolveLadyOfLake,
  getLadyOfLakeEligibleTargets,
  send,
  updateGameHistoryPayload,
});

wss.on('connection', (ws) => {
  const client = { id: `u${clientSeq++}`, roomCode: null };
  ws._clientRef = client;
  clients.set(client.id, ws);
  ws.send(JSON.stringify({ type: 'WELCOME', clientId: client.id }));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (e) {
      return;
    }
    const { type, payload } = msg || {};
    console.log(`[WS] ${client.id} -> ${type}`);
    if (type !== 'LOGIN' && type !== 'AUTH' && !requireAuth(client)) {
      return error(client, 'NEED_LOGIN');
    }
    switch (type) {
      case 'LOGIN':
        login(client, payload || {});
        break;
      case 'AUTH':
        auth(client, payload || {});
        break;
      case 'CREATE_ROOM':
        createRoom(client, payload || {});
        break;
      case 'JOIN_ROOM':
        joinRoom(client, payload || {});
        break;
      case 'LEAVE_ROOM':
        leaveRoom(client);
        break;
      case 'KICK_PLAYER':
        kickPlayer(client, payload || {});
        break;
      case 'VOICE_DONE':
        resolveVoiceDone(client.roomCode);
        break;
      case 'SET_PROFILE':
        setProfile(client, payload || {});
        break;
      case 'CHEAT_REVEAL':
        cheatReveal(client, payload || {});
        break;
      case 'CHOOSE_SEAT':
        chooseSeat(client, payload || {});
        break;
      case 'UPDATE_SETTINGS':
        updateSettings(client, payload || {});
        break;
      case 'START_GAME':
        startGame(client, payload);
        break;
      case 'RESET_GAME':
        resetGame(client);
        break;
      case 'REDEAL_IDENTITIES':
        redealIdentities(client);
        break;
      case 'NEXT_SPEAKER':
        nextSpeaker(client);
        break;
      case 'HOST_SKIP_SPEAKER':
        hostSkipSpeaker(client);
        break;
      case 'HOST_SKIP_TO_VOTE':
        hostSkipToVote(client);
        break;
      case 'START_MISSION_PHASE':
        startMissionPhase(client);
        break;
      case 'PROPOSE_TEAM':
        proposeTeam(client, payload || {});
        break;
      case 'UPDATE_TEAM':
        updateTeam(client, payload || {});
        break;
      case 'VOTE_TEAM':
        voteTeam(client, payload || {});
        break;
      case 'END_SPEAK':
        endSpeak(client);
        break;
      case 'EXECUTE_MISSION':
        executeMission(client, payload || {});
        break;
      case 'START_ASSASSINATION':
        startAssassination(client);
        break;
      case 'USE_LADY_OF_LAKE':
        useLadyOfLake(client, payload || {});
        break;
      case 'ASSASSINATE':
        assassinate(client, payload || {});
        break;
      case 'SPEAK':
        speak(client, payload || {});
        break;
      case 'VIEW_ROLE':
        viewRole(client);
        break;
      case 'GET_GAME_HISTORY_LIST':
        fetchHistoryList(client, payload || {});
        break;
      case 'GET_GAME_HISTORY_DETAIL':
        fetchHistoryDetail(client, payload || {});
        break;
      case 'REQUEST_HISTORY_RECAP':
        generateHistoryRecap(client, payload || {});
        break;
      case 'GET_ROLE_STATS':
        fetchRoleStats(client);
        break;
      case 'AUTOPLAY_ON': {
        const apRoom = rooms.get(client.roomCode);
        const apPlayer = apRoom && apRoom.players.get(client.id);
        if (!apPlayer || apPlayer.isAI) break;
        apPlayer.autoplay = true;
        if (payload && payload.assassinTarget && apRoom.game && apRoom.game.assassinId === client.id) {
          apPlayer.autoplayTarget = payload.assassinTarget;
        }
        if (apPlayer.phone) {
          const t = autoplayTimers.get(apPlayer.phone);
          if (t) { clearTimeout(t); autoplayTimers.delete(apPlayer.phone); }
        }
        apRoom.messages.push({ ts: now(), from: '系统', text: `${apPlayer.nickname} 已开启托管` });
        broadcastRoom(apRoom);
        triggerAutoplayActions(apRoom);
        break;
      }
      case 'AUTOPLAY_OFF': {
        const apRoom = rooms.get(client.roomCode);
        const apPlayer = apRoom && apRoom.players.get(client.id);
        if (!apPlayer || apPlayer.isAI) break;
        apPlayer.autoplay = false;
        const act = assassinAutoplayTimers.get(apRoom.code);
        if (act) { clearTimeout(act); assassinAutoplayTimers.delete(apRoom.code); }
        apRoom.messages.push({ ts: now(), from: '系统', text: `${apPlayer.nickname} 已关闭托管` });
        broadcastRoom(apRoom);
        break;
      }
      case 'REQUEST_RECAP': {
        const rrRoom = rooms.get(client.roomCode);
        if (!rrRoom || !rrRoom.game || rrRoom.phase !== 'end') break;
        if (rrRoom.game.recapGenerating) {
          // 已在生成中，告知客户端当前状态
          send(client, { type: 'ROOM_STATE', room: publicRoom(rrRoom) });
          break;
        }
        // 允许重试：上次生成过但结果为空（LLM 失败），重置 recapGenerated
        if (rrRoom.game.recapGenerated && !(rrRoom.game.recap || []).length) {
          rrRoom.game.recapGenerated = false;
        }
        if (rrRoom.game.recapGenerated) break; // 已有结果，不重复生成
        generateRecaps(rrRoom);
        break;
      }
      default:
        break;
    }
  });

  ws.on('close', () => {
    if (!client.detached) {
      handleSocketClose(client);
    }
    if (clients.get(client.id) === ws) {
      clients.delete(client.id);
    }
    // 清理 phoneClients，避免旧 clientId 残留
    if (client.userPhone && phoneClients.get(client.userPhone) === client.id) {
      phoneClients.delete(client.userPhone);
    }
  });
});

loadPersistedActiveRooms();

server.listen(PORT, () => {
  console.log(`Avalon server running on :${PORT}`);
});
