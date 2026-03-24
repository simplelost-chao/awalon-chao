const express = require('express');
require('dotenv').config();
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.get('/health', (req, res) => res.json({ ok: true }));
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
  const resp = await fetch(url);
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
const MAX_ROUNDS = 5;
const sessions = new Map();
const parsedReconnectGraceMs = Number(process.env.RECONNECT_GRACE_MS || '');
const RECONNECT_GRACE_MS =
  Number.isFinite(parsedReconnectGraceMs) && parsedReconnectGraceMs > 0 ? parsedReconnectGraceMs : 30 * 60 * 1000;
const reconnectEntries = new Map();

const userDb = new Database(path.join(__dirname, 'users.sqlite'));
userDb.pragma('journal_mode = WAL');
userDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    phone TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    avatar TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS game_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    max_players INTEGER NOT NULL,
    winner TEXT NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS game_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    phone TEXT,
    client_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    seat INTEGER NOT NULL,
    role TEXT NOT NULL,
    faction TEXT NOT NULL,
    result TEXT NOT NULL,
    is_host INTEGER NOT NULL,
    is_ai INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_game_participants_phone ON game_participants(phone);
  CREATE INDEX IF NOT EXISTS idx_game_participants_game_id ON game_participants(game_id);
  CREATE INDEX IF NOT EXISTS idx_game_records_ended_at ON game_records(ended_at DESC);
  CREATE TABLE IF NOT EXISTS participant_medals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    phone TEXT,
    client_id TEXT NOT NULL,
    medal_code TEXT NOT NULL,
    medal_name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_participant_medals_phone ON participant_medals(phone);
  CREATE INDEX IF NOT EXISTS idx_participant_medals_game_id ON participant_medals(game_id);
  CREATE TABLE IF NOT EXISTS active_rooms (
    room_code TEXT PRIMARY KEY,
    snapshot TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS active_room_players (
    phone TEXT PRIMARY KEY,
    room_code TEXT NOT NULL,
    player_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_active_room_players_room_code ON active_room_players(room_code);
`);

const upsertActiveRoomStmt = userDb.prepare(`
  INSERT INTO active_rooms(room_code, snapshot, updated_at)
  VALUES(?,?,?)
  ON CONFLICT(room_code) DO UPDATE SET
    snapshot = excluded.snapshot,
    updated_at = excluded.updated_at
`);
const deleteActiveRoomStmt = userDb.prepare('DELETE FROM active_rooms WHERE room_code = ?');
const deleteActiveRoomPlayersByRoomStmt = userDb.prepare('DELETE FROM active_room_players WHERE room_code = ?');
const deleteActiveRoomPlayerByPhoneStmt = userDb.prepare('DELETE FROM active_room_players WHERE phone = ?');
const getActiveRoomPlayerByPhoneStmt = userDb.prepare(
  'SELECT phone, room_code AS roomCode, player_id AS playerId FROM active_room_players WHERE phone = ?'
);
const getActiveRoomSnapshotStmt = userDb.prepare(
  'SELECT room_code AS roomCode, snapshot FROM active_rooms WHERE room_code = ?'
);
const upsertActiveRoomPlayerStmt = userDb.prepare(`
  INSERT INTO active_room_players(phone, room_code, player_id, updated_at)
  VALUES(?,?,?,?)
  ON CONFLICT(phone) DO UPDATE SET
    room_code = excluded.room_code,
    player_id = excluded.player_id,
    updated_at = excluded.updated_at
`);
const persistActiveRoomTx = userDb.transaction((roomCode, snapshot, players, updatedAt) => {
  upsertActiveRoomStmt.run(roomCode, snapshot, updatedAt);
  deleteActiveRoomPlayersByRoomStmt.run(roomCode);
  for (const player of players) {
    upsertActiveRoomPlayerStmt.run(player.phone, roomCode, player.id, updatedAt);
  }
});
const deleteActiveRoomTx = userDb.transaction((roomCode) => {
  deleteActiveRoomPlayersByRoomStmt.run(roomCode);
  deleteActiveRoomStmt.run(roomCode);
});

const TEAM_SIZES = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

const FAIL_REQUIREMENT = {
  5: [1, 1, 1, 1, 1],
  6: [1, 1, 1, 1, 1],
  7: [1, 1, 1, 2, 1],
  8: [1, 1, 1, 2, 1],
  9: [1, 1, 1, 2, 1],
  10: [1, 1, 1, 2, 1],
};

const ROLE_FACTIONS = {
  梅林: 'good',
  派西维尔: 'good',
  忠臣: 'good',
  莫甘娜: 'evil',
  刺客: 'evil',
  莫德雷德: 'evil',
  奥伯伦: 'evil',
  爪牙: 'evil',
};

const MEDAL_DEFS = {
  good_blocker: { code: 'good_blocker', name: '挡刀侠', faction: 'good' },
  good_clean_captain: { code: 'good_clean_captain', name: '老司机', faction: 'good' },
  good_wolf_trust: { code: 'good_wolf_trust', name: '钻狼窝', faction: 'good' },
  merlin_survivor: { code: 'merlin_survivor', name: '梅林是狗', faction: 'good' },
  merlin_three_fail_lose: { code: 'merlin_three_fail_lose', name: '心累', faction: 'good' },
  good_clean_trust: { code: 'good_clean_trust', name: '开眼玩家', faction: 'good' },
  percival_morgana_trust: { code: 'percival_morgana_trust', name: '晕头转向', faction: 'good' },
  good_protect_round_fail_captain: { code: 'good_protect_round_fail_captain', name: '盲人骑瞎马', faction: 'good' },
  good_three_evil_team_captain: { code: 'good_three_evil_team_captain', name: '错到极致也是对', faction: 'good' },
  good_three_fail_lose: { code: 'good_three_fail_lose', name: '不嘻嘻', faction: 'good' },
  good_comeback_win: { code: 'good_comeback_win', name: '开往春田花花', faction: 'good' },
  good_three_success_participant: { code: 'good_three_success_participant', name: '好人王', faction: 'good' },
  assassin_early_hit_merlin: { code: 'assassin_early_hit_merlin', name: '刺客大师', faction: 'evil' },
  morgana_percival_fail_master: { code: 'morgana_percival_fail_master', name: '洗头大师', faction: 'evil' },
  oberon_no_fail_with_evil: { code: 'oberon_no_fail_with_evil', name: '找到组织', faction: 'evil' },
  oberon_double_fail_with_evil: { code: 'oberon_double_fail_with_evil', name: '撞车', faction: 'evil' },
  evil_protect_round_fail: { code: 'evil_protect_round_fail', name: '保护轮也炸了', faction: 'evil' },
  evil_three_fail_win: { code: 'evil_three_fail_win', name: '炸三塔', faction: 'evil' },
  evil_hide_votes_master: { code: 'evil_hide_votes_master', name: '藏票大师', faction: 'evil' },
  evil_all_fail_non_protect: { code: 'evil_all_fail_non_protect', name: '毫无默契', faction: 'evil' },
  evil_first_three_fail_win: { code: 'evil_first_three_fail_win', name: '车胎炸了', faction: 'evil' },
  evil_three_fail_participant: { code: 'evil_three_fail_participant', name: '狼王', faction: 'evil' },
  evil_no_fail_win: { code: 'evil_no_fail_win', name: '演技派', faction: 'evil' },
  evil_fake_good_voter: { code: 'evil_fake_good_voter', name: '我想当个好人', faction: 'evil' },
};

const {
  recordGameSummary,
  recordAiRecapMemory,
  decideSpeak,
  decideTeam,
  decideVote,
  decideMission,
  decideAssassinate,
  decideRecap,
  decideEvilIntel,
} = require('./ai');

const AI_NAMES = [
  '阿七',
  '小北',
  '阿蓝',
  '夜行',
  '风铃',
  '山鬼',
  '小满',
  '阿柒',
  '一诺',
  '小白',
  '北野',
  '星河',
];
let aiNameSeq = 1;

const AI_STYLES = [
  '激进冲锋，善于带节奏',
  '稳健保守，偏结构分析',
  '逻辑推理型，喜欢追投票与任务',
  '社交观察型，重视发言细节',
  '搅局误导型，擅长制造分歧',
  '冷静克制，少量但关键发言',
  '强势控场，偏主动组队',
  '谨慎试探，逐轮修正判断',
];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeId(len = 6) {
  const chars = '0123456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function now() {
  return Date.now();
}

function isValidPhone(phone) {
  return typeof phone === 'string' && /^1\d{10}$/.test(phone);
}

function makeToken() {
  return `${now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function getOrCreateUser(phone) {
  const row = userDb.prepare('SELECT phone, nickname, avatar FROM users WHERE phone = ?').get(phone);
  if (row) return row;
  const ts = now();
  const nickname = `玩家${phone.slice(-4)}`;
  const avatar = '🐺';
  userDb
    .prepare('INSERT INTO users(phone, nickname, avatar, created_at, updated_at) VALUES(?,?,?,?,?)')
    .run(phone, nickname, avatar, ts, ts);
  return { phone, nickname, avatar };
}

function updateUserProfile(phone, nickname, avatar) {
  const ts = now();
  userDb
    .prepare('UPDATE users SET nickname = ?, avatar = ?, updated_at = ? WHERE phone = ?')
    .run(nickname, avatar, ts, phone);
}

function login(client, payload) {
  const phone = String((payload && payload.phone) || '').trim();
  if (!isValidPhone(phone)) return error(client, 'INVALID_PHONE');
  const user = getOrCreateUser(phone);
  const token = makeToken();
  sessions.set(token, phone);
  client.userPhone = phone;
  client.authToken = token;
  const recovered = recoverClientPresence(client);
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
  const recovered = recoverClientPresence(client);
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

function createRoom(hostClient, payload) {
  if (!requireAuth(hostClient)) return error(hostClient, 'NEED_LOGIN');
  let roomCode = '';
  if (payload.roomCode !== undefined && payload.roomCode !== null && String(payload.roomCode).trim() !== '') {
    const requested = String(payload.roomCode).trim();
    if (!/^\d{5}$/.test(requested)) return error(hostClient, 'INVALID_ROOM_CODE');
    if (rooms.has(requested)) return error(hostClient, 'ROOM_EXISTS');
    roomCode = requested;
  } else {
    roomCode = makeId(5);
    while (rooms.has(roomCode)) roomCode = makeId(5);
  }

  const room = {
    code: roomCode,
    hostId: hostClient.id,
    createdAt: now(),
    maxPlayers: payload.maxPlayers || 7,
    speakingSeconds: payload.speakingSeconds || 180,
    roles: payload.roles || defaultRoles(payload.maxPlayers || 7),
    hostRole: payload.hostRole || null,
    ladyOfLakeEnabled: !!payload.ladyOfLakeEnabled && (payload.maxPlayers || 7) >= 8,
    seats: [],
    players: new Map(),
    started: false,
    phase: 'lobby',
    messages: [],
    game: null,
    aiNameRegistry: new Set(),
  };

  rooms.set(roomCode, room);
  joinRoom(hostClient, { roomCode, nickname: payload.nickname, avatar: payload.avatar });
  return roomCode;
}

function syncClientSeqWithRoom(room) {
  if (!room || !room.players) return;
  for (const player of room.players.values()) {
    const match = /^u(\d+)$/.exec(String(player.id || ''));
    if (!match) continue;
    clientSeq = Math.max(clientSeq, Number(match[1]) + 1);
  }
}

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
    seats: room.seats,
    started: room.started,
    phase: room.phase,
    messages: room.messages || [],
    speaking: room.speaking || null,
    players: Array.from(room.players.values()),
    game: room.game
      ? {
          startedAt: room.game.startedAt,
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
  const humanPlayers = Array.from(room.players.values()).filter((player) => !player.isAI && player.phone);
  if (humanPlayers.length === 0) {
    deleteActiveRoom(room.code);
    return;
  }
  persistActiveRoomTx(room.code, JSON.stringify(buildActiveRoomSnapshot(room)), humanPlayers, now());
}

function resumeActiveRoom(room) {
  if (!room) return;
  if (room.speakingTimeout) {
    clearTimeout(room.speakingTimeout);
    room.speakingTimeout = null;
  }
  if (!room.started || !room.game) return;
  if (room.phase === 'team') {
    const leader = room.players.get(room.game.leaderId);
    if (leader && leader.isAI) autoProposeIfAiLeader(room);
    return;
  }
  if (room.phase === 'speaking' && room.speaking) {
    scheduleSpeakTimeout(room);
    autoSpeakIfAi(room);
    return;
  }
  if (room.phase === 'voting') {
    autoVoteIfAi(room);
    return;
  }
  if (room.phase === 'mission') {
    autoMissionIfAi(room);
    return;
  }
  if (room.phase === 'assassination') {
    autoAssassinateIfAi(room);
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

  const room = {
    code: snapshot.code,
    hostId: snapshot.hostId || null,
    createdAt: snapshot.createdAt || now(),
    maxPlayers: snapshot.maxPlayers || 7,
    speakingSeconds: snapshot.speakingSeconds || 180,
    roles: Array.isArray(snapshot.roles) ? snapshot.roles : defaultRoles(snapshot.maxPlayers || 7),
    hostRole: snapshot.hostRole || null,
    ladyOfLakeEnabled: !!snapshot.ladyOfLakeEnabled && (snapshot.maxPlayers || 7) >= 8,
    seats: Array.isArray(snapshot.seats) ? snapshot.seats : [],
    players: new Map((Array.isArray(snapshot.players) ? snapshot.players : []).map((player) => [player.id, player])),
    started: !!snapshot.started,
    phase: snapshot.phase || 'lobby',
    messages: Array.isArray(snapshot.messages) ? snapshot.messages : [],
    game: snapshot.game || null,
    speaking: snapshot.speaking || null,
    aiNameRegistry: new Set(Array.isArray(snapshot.aiNameRegistry) ? snapshot.aiNameRegistry : []),
    speakingTimeout: null,
  };
  rooms.set(room.code, room);
  syncClientSeqWithRoom(room);
  resumeActiveRoom(room);
  return room;
}

function defaultRoles(count) {
  // user-defined defaults
  if (count === 6) return ['梅林', '派西维尔', '莫甘娜', '刺客', '忠臣', '忠臣'];
  if (count === 7) return ['梅林', '派西维尔', '莫甘娜', '刺客', '忠臣', '忠臣', '奥伯伦'];
  if (count === 8) return ['梅林', '派西维尔', '莫甘娜', '刺客', '爪牙', '忠臣', '忠臣', '忠臣'];
  if (count === 9) return padRoles(['梅林', '派西维尔', '莫甘娜', '莫德雷德', '奥伯伦', '忠臣', '忠臣', '忠臣'], count);
  if (count === 10) return padRoles(['梅林', '派西维尔', '莫甘娜', '莫德雷德', '刺客', '奥伯伦', '忠臣', '忠臣', '忠臣'], count);
  // fallback
  return Array.from({ length: count }, () => '忠臣');
}

function padRoles(roles, count) {
  const out = roles.slice();
  while (out.length < count) out.push('忠臣');
  return out;
}

function joinRoom(client, payload) {
  if (!requireAuth(client)) return error(client, 'NEED_LOGIN');
  const room = rooms.get(payload.roomCode);
  if (!room) return error(client, 'ROOM_NOT_FOUND');
  const existingPlayer = Array.from(room.players.values()).find(
    (player) => !player.isAI && player.phone && player.phone === client.userPhone
  );
  if (existingPlayer) {
    const user = getOrCreateUser(client.userPhone);
    existingPlayer.nickname = (payload.nickname || user.nickname || existingPlayer.nickname || '玩家').slice(0, 12);
    existingPlayer.avatar = payload.avatar || user.avatar || existingPlayer.avatar || '🐺';
    takeOverRoomPlayer(client, room, existingPlayer);
    return ok(client, { roomCode: room.code, recovered: true });
  }
  if (room.players.size >= room.maxPlayers) return error(client, 'ROOM_FULL');
  const user = getOrCreateUser(client.userPhone);
  const nickname = (payload.nickname || user.nickname || '玩家').slice(0, 12);
  const avatar = payload.avatar || user.avatar || '🐺';

  room.players.set(client.id, {
    id: client.id,
    nickname,
    avatar,
    phone: client.userPhone,
    seat: null,
    joinedAt: now(),
    isAI: false,
    offline: false,
  });
  client.roomCode = room.code;
  broadcastRoom(room);
  return ok(client, { roomCode: room.code });
}

function leaveRoom(client) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  removePlayerById(room, client.id);
  client.roomCode = null;
}

function clearReconnectEntry(phone) {
  if (!phone) return;
  const prev = reconnectEntries.get(phone);
  if (prev && prev.timer) clearTimeout(prev.timer);
  reconnectEntries.delete(phone);
}

function removePlayerById(room, playerId) {
  const player = room.players.get(playerId);
  if (player && player.phone) {
    clearReconnectEntry(player.phone);
    deleteActiveRoomPlayerByPhoneStmt.run(player.phone);
  }
  room.players.delete(playerId);
  room.seats = room.seats.map((id) => (id === playerId ? null : id));
  if (room.hostId === playerId) {
    const nextHost = room.players.values().next().value;
    room.hostId = nextHost ? nextHost.id : null;
  }
  const remainingHumans = Array.from(room.players.values()).filter((entry) => !entry.isAI);
  if (room.players.size === 0 || remainingHumans.length === 0) {
    rooms.delete(room.code);
    deleteActiveRoom(room.code);
    return;
  }
  broadcastRoom(room);
}

function scheduleReconnectRemoval(roomCode, playerId, phone) {
  clearReconnectEntry(phone);
  const expiresAt = now() + RECONNECT_GRACE_MS;
  const timer = setTimeout(() => {
    const current = reconnectEntries.get(phone);
    if (!current || current.playerId !== playerId || current.expiresAt !== expiresAt) return;
    reconnectEntries.delete(phone);

    const room = rooms.get(roomCode);
    if (!room) return;
    const player = room.players.get(playerId);
    if (!player || !player.offline) return;
    removePlayerById(room, playerId);
  }, RECONNECT_GRACE_MS);
  reconnectEntries.set(phone, { roomCode, playerId, expiresAt, timer });
}

function rebindClientId(client, targetId) {
  if (!targetId || client.id === targetId) return;
  const ws = clients.get(client.id);
  clients.delete(client.id);
  client.id = targetId;
  if (ws) clients.set(targetId, ws);
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
  const oldWs = clients.get(player.id);
  const nextWs = clients.get(client.id);
  if (oldWs && nextWs && oldWs !== nextWs) {
    detachSocketClient(oldWs);
    try {
      oldWs.close(4001, 'SESSION_TAKEN_OVER');
    } catch (e) {}
  }

  clearReconnectEntry(player.phone);
  rebindClientId(client, player.id);
  client.roomCode = room.code;
  player.offline = false;
  player.lastReconnectedAt = now();
  if (room.game && room.game.assignments && room.game.assignments[player.id]) {
    send({ id: player.id }, { type: 'PRIVATE_ROLE', role: room.game.assignments[player.id] });
  }
  broadcastRoom(room);
  return { roomCode: room.code, playerId: player.id };
}

function recoverClientPresence(client) {
  if (!client.userPhone) return null;
  const restoredRoom = restoreActiveRoomForPhone(client.userPhone);
  let found = null;
  if (restoredRoom) {
    for (const player of restoredRoom.players.values()) {
      if (!player.isAI && player.phone === client.userPhone && player.offline) {
        found = { roomCode: restoredRoom.code, playerId: player.id };
        break;
      }
    }
  }
  if (!found) {
    found = reconnectEntries.get(client.userPhone);
  }
  if (!found) {
    for (const room of rooms.values()) {
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

  const room = rooms.get(found.roomCode);
  const player = room ? room.players.get(found.playerId) : null;
  if (!room || !player) {
    clearReconnectEntry(client.userPhone);
    return null;
  }
  return takeOverRoomPlayer(client, room, player);
}

function handleSocketClose(client) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  const player = room.players.get(client.id);
  if (!player || player.isAI || !player.phone) {
    leaveRoom(client);
    return;
  }

  player.offline = true;
  player.lastDisconnectedAt = now();
  scheduleReconnectRemoval(room.code, player.id, player.phone);
  broadcastRoom(room);
}

function setProfile(client, payload) {
  if (!requireAuth(client)) return error(client, 'NEED_LOGIN');
  const room = rooms.get(client.roomCode);
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

function cheatReveal(client, payload) {
  if (!requireAuth(client)) return error(client, 'NEED_LOGIN');
  const room = rooms.get(client.roomCode);
  if (!room) return error(client, 'ROOM_NOT_FOUND');
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  if (!room.started || !room.game || !room.game.assignments) return error(client, 'NOT_STARTED');

  const targetId = String((payload && payload.targetId) || '');
  if (!targetId || !room.players.has(targetId)) return error(client, 'INVALID_TARGET');
  const role = room.game.assignments[targetId];
  if (!role) return error(client, 'ROLE_NOT_FOUND');

  send(client, { type: 'CHEAT_REVEAL_ROLE', data: { playerId: targetId, role } });
}

function buildGameHistoryPayload(room) {
  const assignments = (room.game && room.game.assignments) || {};
  const players = room.seats
    .map((id, idx) => {
      const p = room.players.get(id);
      const role = assignments[id] || '';
      return {
        id,
        seat: idx + 1,
        nickname: p ? p.nickname : `玩家${idx + 1}`,
        phone: p && !p.isAI ? p.phone || null : null,
        isAI: p ? !!p.isAI : false,
        isHost: id === room.hostId,
        role,
        faction: ROLE_FACTIONS[role] || 'good',
      };
    })
    .filter((x) => !!x.id);
  return {
    roomCode: room.code,
    maxPlayers: room.maxPlayers,
    startedAt: room.game.startedAt || room.createdAt || now(),
    endedAt: now(),
    winner: room.game.winner || 'unknown',
    players,
    voteHistory: room.game.voteHistory || [],
    missionHistory: room.game.missionHistory || [],
    speakHistory: room.game.speakHistory || {},
    messages: room.messages || [],
    assassination: room.game.assassination || null,
    recaps: room.game.recaps || [],
    evilIntel: room.game.evilIntel || [],
    ladyOfLake: room.game.ladyOfLake || null,
  };
}

function toSeatNoMap(payload) {
  const out = {};
  const players = Array.isArray(payload && payload.players) ? payload.players : [];
  players.forEach((p) => {
    if (!p || !p.id) return;
    const seat = Number(p.seat);
    out[p.id] = Number.isFinite(seat) ? seat : 0;
  });
  return out;
}

function roleByPlayerId(payload) {
  const out = {};
  const players = Array.isArray(payload && payload.players) ? payload.players : [];
  players.forEach((p) => {
    if (!p || !p.id) return;
    out[p.id] = p.role || '';
  });
  return out;
}

function evaluateMedalsForPayload(payload) {
  const result = {};
  const players = Array.isArray(payload && payload.players) ? payload.players : [];
  const voteHistory = Array.isArray(payload && payload.voteHistory) ? payload.voteHistory : [];
  const missionHistory = Array.isArray(payload && payload.missionHistory) ? payload.missionHistory : [];
  const assassination = payload && payload.assassination ? payload.assassination : null;
  const winner = payload && payload.winner ? payload.winner : '';
  const roleById = roleByPlayerId(payload);

  const missionByRound = {};
  missionHistory.forEach((m) => {
    const r = Number(m && m.round ? m.round : 0);
    if (r > 0 && !missionByRound[r]) missionByRound[r] = m;
  });

  const failedMissionCount = missionHistory.filter((m) => m && !m.success).length;
  const evilWonByThreeFails = winner === 'evil' && failedMissionCount >= 3;
  const firstThreeMissions = missionHistory
    .filter((m) => m && Number(m.round || 0) > 0)
    .slice()
    .sort((a, b) => Number(a.round || 0) - Number(b.round || 0))
    .slice(0, 3);
  const goodWonFirstThreeSuccess =
    winner === 'good' && firstThreeMissions.length >= 3 && firstThreeMissions.every((m) => !!m.success);
  const evilWonFirstThreeFails =
    winner === 'evil' && firstThreeMissions.length >= 3 && firstThreeMissions.every((m) => !m.success);

  const isGoodNonMerlin = (id) => {
    const role = roleById[id] || '';
    return role && role !== '梅林' && ROLE_FACTIONS[role] === 'good';
  };

  const ensure = (id, code) => {
    if (!id || !MEDAL_DEFS[code]) return;
    if (!result[id]) result[id] = [];
    if (!result[id].includes(code)) result[id].push(code);
  };

  const teamEvilCount = (team) =>
    (Array.isArray(team) ? team : []).filter((id) => ROLE_FACTIONS[roleById[id] || ''] === 'evil').length;
  const teamHasRole = (team, roleName) => (Array.isArray(team) ? team : []).some((id) => (roleById[id] || '') === roleName);

  players.forEach((p) => {
    const pid = p.id;
    const role = p.role || '';
    const faction = ROLE_FACTIONS[role] || '';
    if (!pid || !role || !faction) return;

    let cleanLeaderCount = 0;
    let trustWolfCount = 0;
    let trustCleanCount = 0;
    let merlinTrustWolfCount = 0;
    let percivalTrustMorganaCount = 0;
    let firstRoundCleanLeader = false;
    let threeEvilTeamLeader = false;
    let morganaPercivalFailCount = 0;
    let oberonNoFailWithEvil = false;
    let oberonDoubleFailWithEvil = false;
    let evilSuccessVoteStreak = 0;
    let evilSuccessVoteStreakMax = 0;
    let evilAllFailNonProtect = false;
    let successfulMissionParticipation = 0;
    let failedMissionParticipation = 0;
    let alwaysTrustedCleanTeam = true;
    let alwaysRejectedEvilTeam = true;
    let castAnyVote = false;
    let castMissionFail = false;

    voteHistory.forEach((v) => {
      if (!v || !Array.isArray(v.team) || !v.votes) return;
      const team = v.team;
      const playerVoteApprove = !!v.votes[pid];
      const evilCount = teamEvilCount(team);
      const isLeader = v.leaderId === pid;

      if (isLeader && isGoodNonMerlin(pid) && evilCount === 0) cleanLeaderCount += 1;
      if (isLeader && isGoodNonMerlin(pid) && evilCount >= 3) threeEvilTeamLeader = true;

      if (isGoodNonMerlin(pid) && playerVoteApprove && evilCount > 0) trustWolfCount += 1;
      if (role === '梅林' && playerVoteApprove && evilCount > 0) merlinTrustWolfCount += 1;

      if (isGoodNonMerlin(pid)) {
        castAnyVote = true;
        if (evilCount === 0) {
          if (!playerVoteApprove) alwaysTrustedCleanTeam = false;
        } else if (playerVoteApprove) {
          alwaysRejectedEvilTeam = false;
        }
      }

      if (ROLE_FACTIONS[role] === 'evil') {
        castAnyVote = true;
        if (evilCount === 0) {
          if (!playerVoteApprove) alwaysTrustedCleanTeam = false;
        } else if (playerVoteApprove) {
          alwaysRejectedEvilTeam = false;
        }
      }

      if (role === '派西维尔' && playerVoteApprove && teamHasRole(team, '莫甘娜')) {
        percivalTrustMorganaCount += 1;
      }

      if (role === '莫甘娜' && team.includes(pid) && playerVoteApprove) {
        const percivalId = players.find((x) => (x && x.role) === '派西维尔')?.id;
        const percivalApproved = !!(percivalId && v.votes[percivalId]);
        const mission = v.approved ? missionByRound[Number(v.round || 0)] : null;
        if (percivalApproved && mission && !mission.success) {
          morganaPercivalFailCount += 1;
        }
      }

      if (isLeader && isGoodNonMerlin(pid) && Number(v.round || 0) === 1 && evilCount === 0) {
        firstRoundCleanLeader = true;
      }
    });

    let evilProtectRoundFailed = false;

    missionHistory.forEach((m) => {
      if (!m || !Array.isArray(m.team) || !m.team.includes(pid)) return;
      const missionVotes = m.missionVotes || {};
      const myFail = !!missionVotes[pid];
      const fails = Number(m.fails || 0);
      const needFail = Number(m.needFail || 1);
      const team = m.team;

      if (m.success) successfulMissionParticipation += 1;
      if (!m.success) failedMissionParticipation += 1;

      if (ROLE_FACTIONS[role] === 'evil') {
        if (myFail) castMissionFail = true;
        if (!myFail) {
          evilSuccessVoteStreak += 1;
          if (evilSuccessVoteStreak > evilSuccessVoteStreakMax) evilSuccessVoteStreakMax = evilSuccessVoteStreak;
        } else {
          evilSuccessVoteStreak = 0;
        }

        if (needFail >= 2 && !m.success && myFail) {
          evilProtectRoundFailed = true;
        }

        if (needFail < 2) {
          const evilOnTeam = team.filter((id) => ROLE_FACTIONS[roleById[id] || ''] === 'evil');
          if (evilOnTeam.length > 0) {
            const allEvilFailed = evilOnTeam.every((id) => !!missionVotes[id]);
            if (allEvilFailed && evilOnTeam.includes(pid)) {
              evilAllFailNonProtect = true;
            }
          }
        }
      }

      if (role !== '奥伯伦') return;
      const evilMateCount = team.filter((id) => id !== pid && ROLE_FACTIONS[roleById[id] || ''] === 'evil').length;
      if (evilMateCount <= 0) return;
      if (!myFail && fails > 0) oberonNoFailWithEvil = true;
      if (myFail && fails > 1) oberonDoubleFailWithEvil = true;
    });

    if (assassination && assassination.targetId === pid && isGoodNonMerlin(pid)) {
      ensure(pid, 'good_blocker');
    }
    if (cleanLeaderCount >= 2 && isGoodNonMerlin(pid)) ensure(pid, 'good_clean_captain');
    if (trustWolfCount >= 5 && isGoodNonMerlin(pid)) ensure(pid, 'good_wolf_trust');
    if (role === '梅林' && merlinTrustWolfCount >= 3) ensure(pid, 'merlin_survivor');
    if (castAnyVote && alwaysTrustedCleanTeam && alwaysRejectedEvilTeam && isGoodNonMerlin(pid)) ensure(pid, 'good_clean_trust');
    if (role === '派西维尔' && percivalTrustMorganaCount >= 3) ensure(pid, 'percival_morgana_trust');
    if (firstRoundCleanLeader && isGoodNonMerlin(pid)) ensure(pid, 'good_protect_round_fail_captain');
    if (threeEvilTeamLeader && isGoodNonMerlin(pid)) ensure(pid, 'good_three_evil_team_captain');

    if (role === '梅林' && evilWonByThreeFails) ensure(pid, 'merlin_three_fail_lose');
    if (isGoodNonMerlin(pid) && evilWonByThreeFails) ensure(pid, 'good_three_fail_lose');
    if (ROLE_FACTIONS[role] === 'good' && goodWonFirstThreeSuccess) ensure(pid, 'good_comeback_win');
    if (ROLE_FACTIONS[role] === 'good' && successfulMissionParticipation >= 3) ensure(pid, 'good_three_success_participant');

    if (role === '刺客' && assassination && assassination.hit) {
      const successCount = missionHistory.filter((x) => x && x.success).length;
      if (successCount < 3) ensure(pid, 'assassin_early_hit_merlin');
    }
    if (role === '莫甘娜' && morganaPercivalFailCount >= 2) ensure(pid, 'morgana_percival_fail_master');
    if (role === '奥伯伦' && oberonNoFailWithEvil) ensure(pid, 'oberon_no_fail_with_evil');
    if (role === '奥伯伦' && oberonDoubleFailWithEvil) ensure(pid, 'oberon_double_fail_with_evil');
    if (ROLE_FACTIONS[role] === 'evil' && evilProtectRoundFailed) ensure(pid, 'evil_protect_round_fail');
    if (ROLE_FACTIONS[role] === 'evil' && evilWonByThreeFails) ensure(pid, 'evil_three_fail_win');
    if (ROLE_FACTIONS[role] === 'evil' && evilSuccessVoteStreakMax >= 2) ensure(pid, 'evil_hide_votes_master');
    if (ROLE_FACTIONS[role] === 'evil' && evilAllFailNonProtect) ensure(pid, 'evil_all_fail_non_protect');
    if (ROLE_FACTIONS[role] === 'evil' && evilWonFirstThreeFails) ensure(pid, 'evil_first_three_fail_win');
    if (ROLE_FACTIONS[role] === 'evil' && failedMissionParticipation >= 3) ensure(pid, 'evil_three_fail_participant');
    if (ROLE_FACTIONS[role] === 'evil' && winner === 'evil' && !castMissionFail) ensure(pid, 'evil_no_fail_win');
    if (ROLE_FACTIONS[role] === 'evil' && castAnyVote && alwaysTrustedCleanTeam && alwaysRejectedEvilTeam) ensure(pid, 'evil_fake_good_voter');
  });

  return result;
}

function persistGameHistory(room) {
  if (!room || !room.game || room.game.historySaved) return;
  try {
    const payload = buildGameHistoryPayload(room);
    const medalByPlayerId = evaluateMedalsForPayload(payload);
    const latestEarnedMedals = {};
    for (const p of payload.players) {
      const codes = medalByPlayerId[p.id] || [];
      latestEarnedMedals[p.id] = codes
        .map((code) => {
          const def = MEDAL_DEFS[code];
          if (!def) return null;
          return { code: def.code, name: def.name, faction: def.faction };
        })
        .filter(Boolean);
    }
    room.game.latestEarnedMedals = latestEarnedMedals;
    const insertGame = userDb.prepare(
      'INSERT INTO game_records(room_code, started_at, ended_at, max_players, winner, payload) VALUES(?,?,?,?,?,?)'
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
        payload.roomCode,
        payload.startedAt,
        payload.endedAt,
        payload.maxPlayers,
        payload.winner,
        JSON.stringify(payload)
      );
      const gameId = Number(res.lastInsertRowid);
      for (const p of payload.players) {
        const result =
          (payload.winner === 'good' && p.faction === 'good') || (payload.winner === 'evil' && p.faction === 'evil')
            ? 'win'
            : 'lose';
        insertParticipant.run(
          gameId,
          p.phone || null,
          p.id,
          p.nickname,
          p.seat,
          p.role,
          p.faction,
          result,
          p.isHost ? 1 : 0,
          p.isAI ? 1 : 0,
          payload.endedAt
        );
        const earnedCodes = medalByPlayerId[p.id] || [];
        for (const code of earnedCodes) {
          const def = MEDAL_DEFS[code];
          if (!def) continue;
          insertMedal.run(gameId, p.phone || null, p.id, code, def.name, payload.endedAt);
        }
      }
      room.game.historySaved = true;
      room.game.historyId = gameId;
    });
    tx();
  } catch (e) {
    // keep game flow alive
  }
}

function getHistoryListForPhone(phone, limit = 30, offset = 0) {
  const stmt = userDb.prepare(
    `SELECT
       gp.game_id AS gameId,
       gr.room_code AS roomCode,
       gr.ended_at AS playedAt,
       gr.max_players AS maxPlayers,
       gp.seat AS seat,
       gp.role AS role,
       gp.result AS result,
       gr.winner AS winner,
       (
         SELECT GROUP_CONCAT(pm.medal_code, '|')
         FROM participant_medals pm
         WHERE pm.game_id = gp.game_id AND pm.phone = gp.phone
       ) AS medalCodes,
       (
         SELECT GROUP_CONCAT(pm.medal_name, '|')
         FROM participant_medals pm
         WHERE pm.game_id = gp.game_id AND pm.phone = gp.phone
       ) AS medalNames
     FROM game_participants gp
     JOIN game_records gr ON gr.id = gp.game_id
     WHERE gp.phone = ?
     ORDER BY gr.ended_at DESC
     LIMIT ? OFFSET ?`
  );
  return stmt.all(phone, limit, offset).map((row) => ({
    ...row,
    medals: row.medalCodes
      ? row.medalCodes.split('|').filter(Boolean).map((code, idx) => ({
          code,
          name: (row.medalNames ? row.medalNames.split('|')[idx] : '') || (MEDAL_DEFS[code] && MEDAL_DEFS[code].name) || code,
        }))
      : [],
  }));
}

function getHistoryDetailForPhone(phone, gameId) {
  const row = userDb
    .prepare(
      `SELECT
         gp.role AS myRole,
         gp.result AS myResult,
         gp.seat AS mySeat,
         gr.payload AS payload
       FROM game_participants gp
       JOIN game_records gr ON gr.id = gp.game_id
       WHERE gp.phone = ? AND gp.game_id = ?
       LIMIT 1`
    )
    .get(phone, gameId);
  if (!row) return null;
  let payload = null;
  try {
    payload = JSON.parse(row.payload);
  } catch (e) {
    payload = null;
  }
  if (!payload) return null;
  const medals = userDb
    .prepare(
      `SELECT medal_code AS code, medal_name AS name
       FROM participant_medals
       WHERE game_id = ? AND phone = ?
       ORDER BY id ASC`
    )
    .all(gameId, phone);
  return {
    gameId,
    myRole: row.myRole,
    myResult: row.myResult,
    mySeat: row.mySeat,
    medals,
    detail: payload,
  };
}

function getRoleStatsForPhone(phone) {
  const rows = userDb
    .prepare(
      `SELECT
         role,
         COUNT(1) AS total,
         SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) AS wins
       FROM game_participants
       WHERE phone = ?
       GROUP BY role
       ORDER BY total DESC, role ASC`
    )
    .all(phone);
  const byRole = rows.map((r) => {
    const total = Number(r.total || 0);
    const wins = Number(r.wins || 0);
    const winRate = total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0;
    return { role: r.role, total, wins, winRate };
  });
  const totalGames = byRole.reduce((s, r) => s + r.total, 0);
  const totalWins = byRole.reduce((s, r) => s + r.wins, 0);
  const overallWinRate = totalGames > 0 ? Number(((totalWins / totalGames) * 100).toFixed(1)) : 0;
  const medalRows = userDb
    .prepare(
      `SELECT medal_code AS code, COUNT(1) AS total
       FROM participant_medals
       WHERE phone = ?
       GROUP BY medal_code
       ORDER BY total DESC, medal_code ASC`
    )
    .all(phone);
  const medals = medalRows.map((r) => {
    const def = MEDAL_DEFS[r.code];
    return {
      code: r.code,
      name: (def && def.name) || r.code,
      faction: (def && def.faction) || 'neutral',
      total: Number(r.total || 0),
    };
  });
  const totalMedals = medals.reduce((s, m) => s + m.total, 0);
  return { totalGames, totalWins, overallWinRate, byRole, medals, totalMedals };
}

function fetchHistoryList(client, payload) {
  if (!requireAuth(client)) return error(client, 'NEED_LOGIN');
  const limit = Math.min(100, Math.max(1, parseInt((payload && payload.limit) || 30, 10) || 30));
  const offset = Math.max(0, parseInt((payload && payload.offset) || 0, 10) || 0);
  const list = getHistoryListForPhone(client.userPhone, limit, offset);
  send(client, { type: 'GAME_HISTORY_LIST', data: { list, limit, offset } });
}

function fetchHistoryDetail(client, payload) {
  if (!requireAuth(client)) return error(client, 'NEED_LOGIN');
  const gameId = Number(payload && payload.gameId);
  if (!Number.isFinite(gameId) || gameId <= 0) return error(client, 'INVALID_GAME_ID');
  const detail = getHistoryDetailForPhone(client.userPhone, gameId);
  if (!detail) return error(client, 'HISTORY_NOT_FOUND');
  send(client, { type: 'GAME_HISTORY_DETAIL', data: detail });
}

function fetchRoleStats(client) {
  if (!requireAuth(client)) return error(client, 'NEED_LOGIN');
  const stats = getRoleStatsForPhone(client.userPhone);
  send(client, { type: 'ROLE_STATS', data: stats });
}

function chooseSeat(client, payload) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  if (room.started) return error(client, 'ALREADY_STARTED');

  const seatIndex = payload.seatIndex;
  if (typeof seatIndex !== 'number' || seatIndex < 0 || seatIndex >= room.maxPlayers) {
    return error(client, 'INVALID_SEAT');
  }
  while (room.seats.length < room.maxPlayers) room.seats.push(null);
  const oldSeatIndex = room.seats.findIndex((id) => id === client.id);
  const occupant = room.seats[seatIndex];

  // Empty seat: sit directly. If player already had a seat, vacate old seat.
  if (!occupant) {
    if (oldSeatIndex >= 0) room.seats[oldSeatIndex] = null;
    room.seats[seatIndex] = client.id;
    const p = room.players.get(client.id);
    if (p) p.seat = seatIndex;
    broadcastRoom(room);
    return;
  }

  // Clicking own seat: no-op
  if (occupant === client.id) {
    broadcastRoom(room);
    return;
  }

  // Player without a seat can抢占 AI seat (AI becomes unseated).
  if (oldSeatIndex < 0) {
    const occPlayer = room.players.get(occupant);
    if (!occPlayer || !occPlayer.isAI) return error(client, 'SEAT_TAKEN');
    room.seats[seatIndex] = client.id;
    const me = room.players.get(client.id);
    if (me) me.seat = seatIndex;
    occPlayer.seat = null;
    broadcastRoom(room);
    return;
  }

  room.seats[oldSeatIndex] = occupant;
  room.seats[seatIndex] = client.id;
  const me = room.players.get(client.id);
  const other = room.players.get(occupant);
  if (me) me.seat = seatIndex;
  if (other) other.seat = oldSeatIndex;
  broadcastRoom(room);
}

function updateSettings(client, payload) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  if (room.started) return error(client, 'ALREADY_STARTED');

  if (payload.maxPlayers && payload.maxPlayers >= room.players.size && payload.maxPlayers <= 10) {
    room.maxPlayers = payload.maxPlayers;
    while (room.seats.length > room.maxPlayers) room.seats.pop();
    if (room.maxPlayers < 8) room.ladyOfLakeEnabled = false;
  }
  if (payload.speakingSeconds && payload.speakingSeconds >= 10 && payload.speakingSeconds <= 300) {
    room.speakingSeconds = payload.speakingSeconds;
  }
  if (Array.isArray(payload.roles) && payload.roles.length === room.maxPlayers) {
    room.roles = payload.roles;
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
  broadcastRoom(room);
}

function startGame(client) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  if (room.started) return error(client, 'ALREADY_STARTED');
  // auto-seat humans, then fill AI for empty seats
  autoSeatHumans(room);
  fillAiPlayers(room);
  if (room.players.size < 5) return error(client, 'NOT_ENOUGH_PLAYERS');
  if (!room.seats.every((id) => id)) return error(client, 'SEATS_NOT_FULL');

  room.started = true;
  room.phase = 'team';
  startGameState(room);
  preselectTeam(room);
  room.messages.push({ ts: now(), from: '系统', text: '游戏开始，进入组队阶段' });
  if (room.game.ladyOfLake && room.game.ladyOfLake.holderId) {
    const holder = room.players.get(room.game.ladyOfLake.holderId);
    room.messages.push({ ts: now(), from: '系统', text: `本局开启湖中仙女，初始持有者为 ${holder ? holder.nickname : '未知玩家'}` });
  }
  broadcastRoom(room);
  sendPrivateRoles(room);
  const leader = room.players.get(room.game.leaderId);
  if (leader && leader.isAI) {
    autoProposeIfAiLeader(room);
  }
}

function resetGame(client) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  // reset game state but keep players/seats/settings
  room.started = false;
  room.phase = 'lobby';
  room.speaking = null;
  if (room.speakingTimeout) clearTimeout(room.speakingTimeout);
  room.speakingTimeout = null;
  room.messages = [];
  room.game = null;
  // Keep existing AI and keep all current seat assignments for rematch.
  // If any human has already left, their seat will already be null and next start will refill with AI.
  broadcastRoom(room);
}

function redealIdentities(client) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  if (!room.started) return error(client, 'NOT_STARTED');
  if (!room.seats.every((id) => id) || room.players.size < 5) return error(client, 'SEATS_NOT_FULL');

  if (room.speakingTimeout) clearTimeout(room.speakingTimeout);
  room.speakingTimeout = null;
  room.speaking = null;
  room.phase = 'team';
  room.messages = [{ ts: now(), from: '系统', text: '房主已重发身份，按当前配置重新开始本局' }];
  startGameState(room);
  preselectTeam(room);
  if (room.game.ladyOfLake && room.game.ladyOfLake.holderId) {
    const holder = room.players.get(room.game.ladyOfLake.holderId);
    room.messages.push({ ts: now(), from: '系统', text: `本局开启湖中仙女，初始持有者为 ${holder ? holder.nickname : '未知玩家'}` });
  }
  broadcastRoom(room);
  sendPrivateRoles(room);

  const leader = room.players.get(room.game.leaderId);
  if (leader && leader.isAI) {
    autoProposeIfAiLeader(room);
  }
}

function nextSpeaker(client) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  if (!room.started) return error(client, 'NOT_STARTED');
  if (room.phase !== 'speaking') return error(client, 'NOT_SPEAKING_PHASE');

  const currentId = room.seats[room.speaking.index];
  if (currentId && !room.game.spokeThisRound[currentId]) {
    return error(client, 'CURRENT_NOT_SPOKEN');
  }
  // if leader is current speaker, move to voting after leader spoke
  if (room.game.leaderId === currentId) {
    room.phase = 'voting';
    room.game.votes = {};
    room.messages.push({ ts: now(), from: '系统', text: '队长发言结束，进入投票' });
    broadcastRoom(room);
    autoVoteIfAi(room);
    return;
  }

  advanceSpeaker(room);
}

function hostSkipSpeaker(client) {
  const room = rooms.get(client.roomCode);
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
    autoVoteIfAi(room);
    return;
  }

  room.messages.push({ ts: now(), from: '系统', text: '房主跳过当前发言，切换下一位' });
  advanceSpeaker(room);
}

function hostSkipToVote(client) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  if (!room.started) return error(client, 'NOT_STARTED');
  if (room.phase !== 'speaking') return error(client, 'NOT_SPEAKING_PHASE');

  if (room.speakingTimeout) {
    clearTimeout(room.speakingTimeout);
    room.speakingTimeout = null;
  }
  room.speaking = null;
  room.game.votes = {};
  room.phase = 'voting';
  room.messages.push({ ts: now(), from: '系统', text: '房主已直接进入投票阶段' });
  broadcastRoom(room);
  autoVoteIfAi(room);
}

function startMissionPhase(client) {
  const room = rooms.get(client.roomCode);
  if (!room) return;
  if (room.hostId !== client.id) return error(client, 'HOST_ONLY');
  if (!room.started) return error(client, 'NOT_STARTED');
  enterTeamPhase(room, `进入第${room.game.round}轮组队`);
}

function proposeTeam(client, payload) {
  const room = rooms.get(client.roomCode);
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
    autoSpeakIfAi(room);
    return;
  }

  // Leader can submit final team during speaking and start voting immediately.
  if (room.speakingTimeout) {
    clearTimeout(room.speakingTimeout);
    room.speakingTimeout = null;
  }
  room.speaking = null;
  room.phase = 'voting';
  room.messages.push({ ts: now(), from: '系统', text: `队长已提交最终队伍（${team.length}人），进入投票` });
  broadcastRoom(room);
  autoVoteIfAi(room);
}

function updateTeam(client, payload) {
  const room = rooms.get(client.roomCode);
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
  const room = rooms.get(client.roomCode);
  if (!room || !room.game) return;
  if (room.phase !== 'voting') return error(client, 'NOT_VOTING_PHASE');
  const approve = !!payload.approve;
  room.game.votes[client.id] = approve;

  // check all votes in
  const allIds = room.seats.filter((id) => id);
  if (allIds.every((id) => room.game.votes[id] !== undefined)) {
    resolveVote(room);
  }
  broadcastRoom(room);
}

function executeMission(client, payload) {
  const room = rooms.get(client.roomCode);
  if (!room || !room.game) return;
  if (room.phase !== 'mission') return error(client, 'NOT_MISSION_PHASE');
  if (!room.game.team.includes(client.id)) return error(client, 'NOT_IN_TEAM');

  const role = room.game.assignments[client.id];
  const faction = ROLE_FACTIONS[role] || 'good';
  let fail = !!payload.fail;
  if (faction === 'good') fail = false;

  room.game.missionVotes[client.id] = fail;
  const teamIds = room.game.team;
  if (teamIds.every((id) => room.game.missionVotes[id] !== undefined)) {
    resolveMission(room);
  }
  broadcastRoom(room);
}

function broadcastRoom(room) {
  persistActiveRoom(room);
  const payload = {
    type: 'ROOM_STATE',
    room: publicRoom(room),
  };
  for (const client of room.players.values()) {
    const ws = clients.get(client.id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
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
    started: room.started,
    phase: room.phase,
    speaking: room.speaking || null,
    seats: room.seats,
    players: Array.from(room.players.values()),
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
    assassination: room.game.assassination || null,
    recap: room.game.recap || [],
    evilIntel: room.game.evilIntel || [],
    ladyOfLake,
    trust: room.game.trust || {},
    latestEarnedMedals: room.game.latestEarnedMedals || {},
  };
}

function ok(client, data) {
  send(client, { type: 'OK', data });
}

function error(client, code) {
  send(client, { type: 'ERROR', code });
}

function send(client, msg) {
  const ws = clients.get(client.id);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function seatNumber(room, playerId) {
  const idx = room.seats.findIndex((id) => id === playerId);
  return idx >= 0 ? idx + 1 : null;
}

function viewRole(client) {
  const room = rooms.get(client.roomCode);
  if (!room || !room.game) return;
  const myRole = room.game.assignments[client.id];
  const info = { role: myRole, seats: [] };
  if (myRole === '派西维尔') {
    // Merlin + Morgana seats (two thumbs)
    const seats = [];
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      if (r === '梅林' || r === '莫甘娜') seats.push(seatNumber(room, id));
    }
    info.seats = seats.filter(Boolean);
  } else if (myRole === '梅林') {
    // sees evil except Mordred
    const seats = [];
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      if (ROLE_FACTIONS[r] === 'evil' && r !== '莫德雷德') seats.push(seatNumber(room, id));
    }
    info.seats = seats.filter(Boolean);
  } else if (ROLE_FACTIONS[myRole] === 'evil') {
    // evil sees evil teammates (not specific roles), except Oberon sees nobody
    if (myRole === '奥伯伦') {
      info.seats = [];
      return send(client, { type: 'ROLE_INFO', data: info });
    }
    const seats = [];
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      // evil do not see Oberon, and Oberon does not see them
      if (ROLE_FACTIONS[r] === 'evil' && r !== '奥伯伦' && id !== client.id) seats.push(seatNumber(room, id));
    }
    info.seats = seats.filter(Boolean);
  }
  send(client, { type: 'ROLE_INFO', data: info });
}

function startGameState(room) {
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
  const assassinId = seatIds.find((id) => assignments[id] === '刺客') || null;
  const merlinId = seatIds.find((id) => assignments[id] === '梅林') || null;

  room.game = {
    startedAt: now(),
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
    ladyOfLake:
      room.ladyOfLakeEnabled && room.maxPlayers >= 8
        ? {
            enabled: true,
            holderId: null,
            history: [],
          }
        : null,
  };
  room.game.leaderId = seatIds[room.game.leaderIndex];
  if (room.game.ladyOfLake && seatIds.length > 0) {
    const initialHolderIndex = (room.game.leaderIndex + seatIds.length - 1) % seatIds.length;
    room.game.ladyOfLake.holderId = seatIds[initialHolderIndex];
  }
  for (const id of seatIds) {
    room.game.trust[id] = 0;
  }
}

function sendPrivateRoles(room) {
  for (const player of room.players.values()) {
    if (player.isAI) continue;
    const role = room.game.assignments[player.id];
    send({ id: player.id }, { type: 'PRIVATE_ROLE', role });
  }
}

function getTeamSize(room) {
  const sizes = TEAM_SIZES[room.maxPlayers] || TEAM_SIZES[7];
  return sizes[room.game.round - 1];
}

function getFailRequirement(room) {
  const reqs = FAIL_REQUIREMENT[room.maxPlayers] || FAIL_REQUIREMENT[7];
  return reqs[room.game.round - 1];
}

function isLadyOfLakeEnabled(room) {
  return !!(room && room.game && room.game.ladyOfLake && room.game.ladyOfLake.enabled);
}

function getLadyOfLakeEligibleTargets(room) {
  if (!isLadyOfLakeEnabled(room)) return [];
  const holderId = room.game.ladyOfLake.holderId;
  const previousHolders = new Set((room.game.ladyOfLake.history || []).map((entry) => entry.holderId));
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
    if (leader && leader.isAI) autoProposeIfAiLeader(room);
    return;
  }
  setTimeout(() => {
    const stillRoom = rooms.get(room.code);
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
  room.game.ladyOfLake.history.push({
    round: room.game.round,
    holderId,
    targetId,
    alignment,
  });
  send(
    { id: holderId },
    {
      type: 'LADY_OF_LAKE_RESULT',
      data: {
        round: room.game.round,
        targetId,
        targetNickname: target.nickname,
        alignment,
      },
    }
  );
  room.game.ladyOfLake.holderId = targetId;
  room.phase = 'team';
  room.messages.push({
    ts: now(),
    from: '系统',
    text: `湖中仙女已查验 ${target.nickname}，标记传递给 ${target.nickname}，进入第${room.game.round}-${room.game.attempt}轮组队`,
  });
  broadcastRoom(room);
  const leader = room.players.get(room.game.leaderId);
  if (leader && leader.isAI) autoProposeIfAiLeader(room);
  return true;
}

function useLadyOfLake(client, payload) {
  const room = rooms.get(client.roomCode);
  if (!room || !room.game) return;
  if (room.phase !== 'lady' || !room.game.ladyOfLake) return error(client, 'NOT_LADY_OF_LAKE_PHASE');
  if (room.game.ladyOfLake.holderId !== client.id) return error(client, 'LADY_OF_LAKE_ONLY');
  const targetId = String((payload && payload.targetId) || '');
  if (!resolveLadyOfLake(room, targetId)) return error(client, 'INVALID_LADY_OF_LAKE_TARGET');
}

function enterTeamPhase(room, msg) {
  room.phase = 'team';
  room.messages.push({ ts: now(), from: '系统', text: msg });
  preselectTeam(room);
  broadcastRoom(room);
  const leader = room.players.get(room.game.leaderId);
  if (leader && leader.isAI) {
    autoProposeIfAiLeader(room);
  }
}

function advanceSpeaker(room) {
  const nextIndex = (room.speaking.index + 1) % room.maxPlayers;
  room.speaking.index = nextIndex;
  room.speaking.endAt = now() + room.speakingSeconds * 1000;
  broadcastRoom(room);
  scheduleSpeakTimeout(room);
  autoSpeakIfAi(room);
}

function scheduleSpeakTimeout(room) {
  if (room.speakingTimeout) clearTimeout(room.speakingTimeout);
  if (!room.speaking) return;
  const currentId = room.seats[room.speaking.index];
  if (!currentId) return;
  const remainingMs = room.speaking.endAt ? Math.max(0, room.speaking.endAt - now()) : room.speakingSeconds * 1000;
  room.speakingTimeout = setTimeout(() => {
    const stillRoom = rooms.get(room.code);
  if (!stillRoom || stillRoom.phase !== 'speaking') return;
  const current = stillRoom.seats[stillRoom.speaking.index];
  if (!current) return;
  if (!stillRoom.game.spokeThisRound[current]) {
    stillRoom.game.spokeThisRound[current] = true;
  }
  if (stillRoom.game.leaderId === current) {
    stillRoom.phase = 'voting';
    stillRoom.game.votes = {};
    stillRoom.messages.push({ ts: now(), from: '系统', text: '队长发言结束，进入投票' });
    broadcastRoom(stillRoom);
    autoVoteIfAi(stillRoom);
  } else {
    advanceSpeaker(stillRoom);
  }
}, remainingMs);
}

function preselectTeam(room) {
  if (!room || !room.game) return;
  // New rule: entering team phase starts with an empty proposal.
  // Human leaders manually select members; AI leaders think first and then submit.
  room.game.team = [];
  room.game.votes = {};
}

function resolveVote(room) {
  if (!room || !room.game || room.phase !== 'voting') return;
  const votes = room.game.votes;
  const allIds = room.seats.filter((id) => id);
  const approves = allIds.filter((id) => votes[id]).length;
  const rejects = allIds.length - approves;
  const approved = approves > rejects;
  room.game.voteHistory.push({
    round: room.game.round,
    attempt: room.game.attempt,
    leaderId: room.game.leaderId,
    team: room.game.team,
    votes: { ...votes },
    approves,
    rejects,
    approved,
  });
  if (approved) {
    room.phase = 'mission';
    room.game.missionVotes = {};
    room.messages.push({ ts: now(), from: '系统', text: `队伍通过（${approves}赞成 / ${rejects}反对），开始任务` });
    autoMissionIfAi(room);
  } else {
    room.game.rejectsInRow += 1;
    room.messages.push({ ts: now(), from: '系统', text: `队伍被否决（${approves}赞成 / ${rejects}反对）` });
    if (room.game.rejectsInRow >= 5) {
      room.phase = 'end';
      revealAll(room);
      room.game.winner = 'evil';
      recordGameSummary(room, 'evil');
      generateRecaps(room);
      persistGameHistory(room);
      room.messages.push({ ts: now(), from: '系统', text: '连续5次否决，坏人阵营胜利（已亮明身份）' });
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
      if (leader && leader.isAI) {
        autoProposeIfAiLeader(room);
      }
    }
  }

  // update trust based on claimed stance vs actual vote
  const key = `${room.game.round}-${room.game.attempt}`;
  const claims = room.game.claims ? room.game.claims[key] || {} : {};
  for (const id of Object.keys(votes)) {
    const claim = claims[id];
    if (!claim) continue;
    const votedApprove = votes[id] ? 'approve' : 'reject';
    if (claim === votedApprove) {
      room.game.trust[id] = (room.game.trust[id] || 0) + 1;
    } else {
      room.game.trust[id] = (room.game.trust[id] || 0) - 1;
    }
  }
}

function resolveMission(room) {
  if (!room || !room.game || room.phase !== 'mission') return;
  const votes = room.game.missionVotes;
  const teamIds = room.game.team;
  const fails = teamIds.filter((id) => votes[id]).length;
  const needFail = getFailRequirement(room);
  const success = fails < needFail;
  room.game.missionHistory.push({
    round: room.game.round,
    team: teamIds,
    fails,
    needFail,
    missionVotes: { ...votes },
    success,
  });
  room.messages.push({
    ts: now(),
    from: '系统',
    text: `任务${success ? '成功' : '失败'}（失败票 ${fails} / 需求 ${needFail}）`,
  });
  const successCount = room.game.missionHistory.filter((m) => m.success).length;
  const failCount = room.game.missionHistory.filter((m) => !m.success).length;
  if (successCount >= 3) {
    room.phase = 'assassination';
    revealEvilToAll(room);
    room.messages.push({ ts: now(), from: '系统', text: '好人完成三次任务，进入刺杀阶段' });
    gatherEvilIntel(room);
    autoAssassinateIfAi(room);
  } else if (failCount >= 3) {
    room.phase = 'end';
    revealAll(room);
    room.game.winner = 'evil';
    recordGameSummary(room, 'evil');
    generateRecaps(room);
    persistGameHistory(room);
    room.messages.push({ ts: now(), from: '系统', text: '坏人阵营胜利（已亮明身份）' });
  } else {
    const completedRound = room.game.round;
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
      room.messages.push({
        ts: now(),
        from: '系统',
        text: `进入湖中仙女阶段，由 ${holder ? holder.nickname : '未知玩家'} 查验一名玩家阵营`,
      });
      broadcastRoom(room);
      autoLadyOfLakeIfAi(room);
    } else {
      room.phase = 'team';
      room.messages.push({ ts: now(), from: '系统', text: `进入第${room.game.round}-${room.game.attempt}轮组队` });
      broadcastRoom(room);
      const leader = room.players.get(room.game.leaderId);
      if (leader && leader.isAI) {
        autoProposeIfAiLeader(room);
      }
    }
  }
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

function fillAiPlayers(room) {
  const existingCount = room.players.size;
  const toAdd = room.maxPlayers - existingCount;
  if (toAdd <= 0) return;
  const usedNames = new Set(Array.from(room.players.values()).map((p) => p.nickname));
  if (room.aiNameRegistry) {
    for (const name of room.aiNameRegistry) usedNames.add(name);
  }
  let styleIndex = Math.floor(Math.random() * AI_STYLES.length);
  for (let i = 0; i < toAdd; i++) {
    const id = `ai${existingCount + i + 1}`;
    const aiName = randomAiName(usedNames);
    const fullName = `${aiName}·AI`;
    usedNames.add(fullName);
    if (room.aiNameRegistry) room.aiNameRegistry.add(fullName);
    const aiPersonaId = fullName;
    room.players.set(id, {
      id,
      nickname: fullName,
      avatar: '🤖',
      seat: null,
      joinedAt: now(),
      isAI: true,
      aiStyle: AI_STYLES[styleIndex % AI_STYLES.length],
      aiPersonaId,
    });
    styleIndex += 1;
  }
  // fill empty seats with AI
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
  const humans = Array.from(room.players.values()).filter((p) => !p.isAI);
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

function autoSpeakIfAi(room) {
  const seatId = room.seats[room.speaking.index];
  const player = room.players.get(seatId);
  if (!player || !player.isAI || !room.game) return;
  const role = room.game.assignments[player.id];
  (async () => {
    let msg = '';
    try {
      msg = await decideSpeak({ room, player, role, roleFactions: ROLE_FACTIONS });
    } catch (e) {
      msg = '';
    }
    if (!msg) msg = aiSpeak(room, player, role);
    if (!canSpeak(room, player.id)) return;
    pushSpeak(room, player.nickname, msg, player.id);
    room.messages.push({ ts: now(), from: player.nickname, text: msg });
    room.game.spokeThisRound[player.id] = true;
    broadcastRoom(room);
    if (room.speakingTimeout) clearTimeout(room.speakingTimeout);
    if (room.game.leaderId === player.id) {
      room.phase = 'voting';
      room.game.votes = {};
      room.messages.push({ ts: now(), from: '系统', text: '队长发言结束，进入投票' });
      broadcastRoom(room);
      autoVoteIfAi(room);
    } else {
      advanceSpeaker(room);
    }
  })();
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

function interruptActiveFlowForAssassination(room) {
  if (!room || !room.game) return;
  if (room.speakingTimeout) {
    clearTimeout(room.speakingTimeout);
    room.speakingTimeout = null;
  }
  room.speaking = null;
  room.game.spokeThisRound = {};
  // Stop in-flight stage completion from using stale partial inputs.
  room.game.votes = {};
  room.game.missionVotes = {};
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
      `第${round}轮不要盲信“安全人”，我更看重结构。`,
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
      `别把“表忠”当成证据，结构更重要。`,
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

function startAssassination(client) {
  const room = rooms.get(client.roomCode);
  if (!room || !room.game) return;
  if (!room.started) return error(client, 'NOT_STARTED');
  const role = room.game.assignments[client.id];
  if (role !== '刺客') return error(client, 'ASSASSIN_ONLY');
  if (room.phase === 'end') return error(client, 'ALREADY_ENDED');
  interruptActiveFlowForAssassination(room);
  room.phase = 'assassination';
  room.messages.push({ ts: now(), from: '系统', text: '刺客选择提前刺杀' });
  revealEvilToAll(room);
  broadcastRoom(room);
  gatherEvilIntel(room);
  autoAssassinateIfAi(room);
}

function assassinate(client, payload) {
  const room = rooms.get(client.roomCode);
  if (!room || !room.game) return;
  const role = room.game.assignments[client.id];
  if (role !== '刺客') return error(client, 'ASSASSIN_ONLY');
  if (room.phase === 'end') return error(client, 'ALREADY_ENDED');
  if (room.phase !== 'assassination') {
    interruptActiveFlowForAssassination(room);
    room.phase = 'assassination';
    room.messages.push({ ts: now(), from: '系统', text: '刺客选择提前刺杀' });
  }
  revealEvilToAll(room);
  const candidateSeats = room.seats
    .map((id, idx) => ({ id, seat: idx + 1 }))
    .filter((s) => s.id && ROLE_FACTIONS[room.game.assignments[s.id]] !== 'evil' && s.id !== client.id)
    .map((s) => s.seat);
  room.game.assassinationCandidates = candidateSeats;
  const targetId = payload && payload.targetId;
  if (!targetId || !room.players.has(targetId)) return error(client, 'INVALID_TARGET');
  resolveAssassination(room, targetId, client.id, null);
}

function resolveAssassination(room, targetId, assassinId, reasoning) {
  const targetRole = room.game.assignments[targetId];
  const hit = targetRole === '梅林';
  room.phase = 'end';
  revealAll(room);
  const merlinId = room.game.merlinId;
  const merlinSeat = merlinId ? seatNumber(room, merlinId) : null;
  room.game.assassination = {
    targetId,
    assassinId,
    hit,
    reasoning,
    merlinSeat,
    candidateSeats: room.game.assassinationCandidates || [],
    evilIntel: room.game.evilIntel || [],
  };
  room.game.winner = hit ? 'evil' : 'good';
  recordGameSummary(room, room.game.winner);
  generateRecaps(room);
  persistGameHistory(room);
  room.messages.push({
    ts: now(),
    from: '系统',
    text: `刺杀结果：${hit ? '命中梅林，坏人胜利' : '刺杀失败，好人胜利'}（已亮明身份）`,
  });
  broadcastRoom(room);
}

function generateRecaps(room) {
  if (!room || !room.game) return;
  if (room.game.recapGenerated) return;
  const gameRef = room.game;
  room.game.recapGenerated = true;
  const recaps = [];
  const tasks = [];
  for (const p of room.players.values()) {
    if (!p.isAI) continue;
    const role = room.game.assignments[p.id];
    tasks.push(
      (async () => {
        let suspicious = [];
        let reason = '';
        let recap = {};
        let review = null;
        let actionSummary = null;
        // Always use server-side authoritative private info. Do not trust model-returned info fields.
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
        // normalize role-specific recap
        const rolesInGame = new Set(room.roles || []);
        if (role === '梅林') {
          // Merlin's known evil seats are deterministic; never let the model overwrite them.
          const evilSeats = Array.isArray(info.seats) ? info.seats.slice().sort((a, b) => a - b) : [];
          const guessMordredSeat = rolesInGame.has('莫德雷德') ? recap.merlin?.guessMordredSeat || null : null;
          reason = recap.merlin?.reason || reason;
          // sanitize: do not label known evil as good in reason
          if (reason && evilSeats && evilSeats.length) {
            for (const seat of evilSeats) {
              const seatStr = String(seat);
              reason = reason.replace(new RegExp(`${seatStr}是(忠臣|派西维尔|梅林)`, 'g'), `${seatStr}是坏人`);
              reason = reason.replace(new RegExp(`认为${seatStr}是(忠臣|派西维尔|梅林)`, 'g'), `认为${seatStr}是坏人`);
            }
          }
          if (hasMerlinReasonContradiction(reason, evilSeats)) {
            reason = '';
          }
          if (!reason) {
            reason = buildMerlinReason(room, evilSeats, guessMordredSeat);
          }
          suspicious = evilSeats;
          recaps.push({
            id: p.id,
            nickname: p.nickname,
            seat: seatNumber(room, p.id),
            info,
            merlin: {
              evilSeats,
              guessMordredSeat,
            },
            reason,
            review,
            actionSummary,
          });
          recordAiRecapMemory(room, p, role, { review });
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
            id: p.id,
            nickname: p.nickname,
            seat: seatNumber(room, p.id),
            info,
            percival: {
              guessMerlinSeat,
              guessMorganaSeat,
            },
            reason: reason || '结合拇指位发言强度与投票倾向做判断。',
            review,
            actionSummary,
          });
          recordAiRecapMemory(room, p, role, { review });
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
            id: p.id,
            nickname: p.nickname,
            seat: seatNumber(room, p.id),
            info,
            evil: {
              teammateRoles: normalizedTeammates,
              guessMerlinSeat,
            },
            reason: reason || '结合好人站队与投票表现，推测梅林位置。',
            review,
            actionSummary,
          });
          recordAiRecapMemory(room, p, role, { review });
          return;
        }
        // loyal / other good
        suspicious = Array.isArray(recap.loyal?.suspicious) ? recap.loyal.suspicious : suspicious;
        reason = recap.loyal?.reason || reason;
        recaps.push({
          id: p.id,
          nickname: p.nickname,
          seat: seatNumber(room, p.id),
          info,
          loyal: {
            suspicious,
            guessMerlinSeat: recap.loyal?.guessMerlinSeat || null,
          },
          reason: reason || '依据任务失败与投票对立判断可疑位。',
          review,
          actionSummary,
        });
        recordAiRecapMemory(room, p, role, { review });
      })()
    );
  }
  Promise.all(tasks).then(() => {
    if (!room || !room.game || room.game !== gameRef) return;
    room.game.recap = recaps.sort((a, b) => (a.seat || 0) - (b.seat || 0));
    broadcastRoom(room);
  });
}

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
    const candidateSeats = room.seats
      .map((id, idx) => ({ id, seat: idx + 1 }))
      .filter((s) => s.id && ROLE_FACTIONS[room.game.assignments[s.id]] !== 'evil' && s.id !== assassinId)
      .map((s) => s.seat);
    room.game.assassinationCandidates = candidateSeats;
    try {
      const res = await decideAssassinate({
        room,
        assassinId,
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
      if (targetFaction === 'evil' || targetId === assassinId) {
        targetId = null;
      }
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
  })();
}

function aiAssassinate(room, assassinId) {
  const allIds = room.seats.filter((id) => id);
  const voteHistory = room.game.voteHistory || [];
  const missionHistory = room.game.missionHistory || [];
  const scores = {};
  for (const id of allIds) scores[id] = 0;
  // heuristic: people who pushed teams that succeeded are more likely Merlin
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
  const candidates = allIds.filter((id) => {
    if (id === assassinId) return false;
    const role = room.game.assignments[id];
    const faction = ROLE_FACTIONS[role] || 'good';
    return faction !== 'evil';
  });
  candidates.sort((a, b) => scores[b] - scores[a]);
  const targetId = candidates[0] || allIds.find((id) => id !== assassinId);
  const targetName = room.players.get(targetId)?.nickname || '玩家';
  const reasoning = `根据投票与任务记录，${targetName}在多次成功队伍中出现，嫌疑最高。`;
  return { targetId, reasoning };
}

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
    if (role === '奥伯伦') {
      info.seats = [];
      return info;
    }
    const seats = [];
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      if (ROLE_FACTIONS[r] === 'evil' && r !== '奥伯伦' && id !== playerId) seats.push(seatNumber(room, id));
    }
    info.seats = seats.filter(Boolean).sort((a, b) => a - b);
    return info;
  }
  return info;
}

function speak(client, payload) {
  const room = rooms.get(client.roomCode);
  if (!room || !room.game) return;
  if (!room.started) return error(client, 'NOT_STARTED');
  if (room.phase !== 'speaking') return error(client, 'NOT_SPEAKING_PHASE');
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
  const room = rooms.get(client.roomCode);
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
    autoVoteIfAi(room);
    return;
  }
  advanceSpeaker(room);
}

function canSpeak(room, playerId) {
  if (!room || !room.game || room.phase !== 'speaking') return false;
  const currentSeatId = room.seats[room.speaking.index];
  if (currentSeatId !== playerId) return false;
  return !room.game.spokeThisRound[playerId];
}


function autoProposeIfAiLeader(room) {
  const leader = room.players.get(room.game.leaderId);
  if (!leader || !leader.isAI) return;
  const teamSize = getTeamSize(room);
  (async () => {
    let teamSeats = [];
    try {
      teamSeats = await decideTeam({
        room,
        leaderId: leader.id,
        role: room.game.assignments[leader.id],
        roleFactions: ROLE_FACTIONS,
        teamSize,
      });
    } catch (e) {
      teamSeats = [];
    }
    if (!teamSeats || teamSeats.length === 0) {
      teamSeats = aiPickTeam(room, leader, teamSize)
        .map((id) => seatNumber(room, id))
        .filter(Boolean);
    }
    const idMap = {};
    room.seats.forEach((id, idx) => (idMap[idx + 1] = id));
    const teamIds = teamSeats.map((s) => idMap[s]).filter(Boolean);
    const unique = [];
    for (const id of teamIds) {
      if (!unique.includes(id)) unique.push(id);
    }
    // AI leaders should generally include themselves in the team unless a later rule rewrites the proposal.
    if (!unique.includes(leader.id)) {
      unique.unshift(leader.id);
    }
    // Hard logic correction: if mission history proves some seats are evil, good AI leaders should avoid reusing them when alternatives exist.
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
    room.game.team = unique.slice(0, teamSize);
    room.phase = 'speaking';
    room.game.votes = {};
    room.game.spokeThisRound = {};
    setSpeakingStart(room);
    room.messages.push({ ts: now(), from: '系统', text: `AI队长已确定队伍（${room.game.team.length}人），进入发言阶段` });
    broadcastRoom(room);
    scheduleSpeakTimeout(room);
    autoSpeakIfAi(room);
  })();
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
  // good: include self + random
  const knownGood = new Set(hard.knownGoodIds);
  const knownEvil = new Set([...hard.knownEvilIds, ...aiKnowledge.knownEvilIds]);
  if (role === '梅林') {
    for (const id of getMerlinKnownEvilIds(room, leader.id)) knownEvil.add(id);
  }
  const team = [leader.id];
  candidates = candidates.filter((id) => id !== leader.id);

  // Prefer known-good seats from failed/success missions' hard deductions.
  const knownGoodCandidates = candidates.filter((id) => knownGood.has(id));
  for (const id of knownGoodCandidates) {
    if (team.length >= teamSize) break;
    if (!team.includes(id)) team.push(id);
  }

  // Avoid mission-proven evil seats if enough alternatives exist.
  let cleanCandidates = candidates
    .filter((id) => !team.includes(id) && !knownEvil.has(id))
    .sort((a, b) => (suspicion[a] || 0) - (suspicion[b] || 0));
  while (team.length < teamSize && cleanCandidates.length > 0) {
    team.push(cleanCandidates.splice(Math.floor(Math.random() * cleanCandidates.length), 1)[0]);
  }

  // Only if still insufficient, backfill from unknown/known-evil remaining pool.
  candidates = candidates
    .filter((id) => !team.includes(id))
    .sort((a, b) => (suspicion[a] || 0) - (suspicion[b] || 0));
  while (team.length < teamSize) {
    team.push(candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0]);
  }
  return team;
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

function inferAiKnowledge(room, playerId, role) {
  const knownEvil = new Set();
  const knownGood = new Set();
  if (!room || !room.game) return { knownEvilIds: [], knownGoodIds: [] };

  // Priority 1: private role information
  for (const id of knownEvilIds(room, playerId, role)) knownEvil.add(id);

  // Priority 2: mission hard logic (self-involved, self alignment known)
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

  // Priority 3: speech self-claim / self-expose
  for (const id of inferSpeechClaimedEvilIds(room)) {
    if (id && id !== playerId) knownEvil.add(id);
  }

  return { knownEvilIds: Array.from(knownEvil), knownGoodIds: Array.from(knownGood) };
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

function isSelfEvilClaim(text) {
  const t = String(text || '').replace(/\s+/g, '');
  if (!t) return false;
  if (/我(是|就是)(坏人|反派|狼|匪)/.test(t)) return true;
  if (/我(是|就是)(刺客|莫甘娜|莫德雷德|奥伯伦|爪牙)/.test(t)) return true;
  return false;
}

function inferMissionHardKnowledge(room) {
  const knownGoodIds = new Set();
  const knownEvilIds = new Set();
  const missions = (room && room.game && room.game.missionHistory) || [];
  for (const m of missions) {
    if (!m || !Array.isArray(m.team) || m.team.length === 0) continue;
    const fails = Number(m.fails || 0);
    // Important: fails===0 does NOT prove all-good in Avalon because evil may choose to hide.
    // Strict logic we can safely use publicly:
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

  // Mission evidence dominates: failed missions increase suspicion, successful missions reduce suspicion.
  for (const m of missions) {
    if (!m || !Array.isArray(m.team) || m.team.length === 0) continue;
    if (m.success) {
      for (const id of m.team) scores[id] = (scores[id] || 0) - 0.55;
    } else {
      const weight = 1 + (Number(m.fails || 0) / Math.max(1, m.team.length));
      for (const id of m.team) scores[id] = (scores[id] || 0) + weight;
    }
  }

  // Voting evidence: supporting failed approved teams is suspicious; rejecting clean successful teams is mildly suspicious.
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

function autoVoteIfAi(room) {
  if (!room || !room.game || room.phase !== 'voting') return;
  const gameRef = room.game;
  const allIds = room.seats.filter((id) => id);
  for (const id of allIds) {
    const player = room.players.get(id);
    if (player && player.isAI) {
      (async () => {
        let approve = null;
        try {
          approve = await decideVote({
            room,
            playerId: id,
            role: room.game.assignments[id],
            roleFactions: ROLE_FACTIONS,
          });
        } catch (e) {
          approve = null;
        }
        if (!room.game || room.game !== gameRef || room.phase !== 'voting') return;
        if (approve === null) approve = aiVote(room, player);
        if (!room.game || room.game !== gameRef || room.phase !== 'voting') return;
        room.game.votes[id] = normalizeAiVote(room, id, approve);
        if (!room.game || room.game !== gameRef || room.phase !== 'voting') return;
        if (allIds.every((pid) => room.game.votes[pid] !== undefined)) {
          resolveVote(room);
        }
        if (room.game && room.game === gameRef) broadcastRoom(room);
      })();
    }
  }
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
  if (rejectsInRow >= 3) {
    return true;
  }
  if (faction === 'evil') {
    const hasEvil = room.game.team.some((id) => ROLE_FACTIONS[room.game.assignments[id]] === 'evil');
    if (hasEvil) {
      if (rejectsInRow < 3 && Math.random() < 0.35) return false;
      return true;
    }
    // avoid auto-loss on 5th reject
    if (rejectsInRow >= 4) return true;
    return Math.random() < 0.35;
  }
  // good: strongly use mission/vote evidence
  if (room.game.team.some((id) => knownEvil.has(id))) return false;
  if (room.game.team.every((id) => knownGood.has(id))) return true;
  const teamRisk = room.game.team.reduce((s, id) => s + Math.max(0, suspicion[id] || 0), 0);
  if (teamRisk >= Math.max(2.2, room.game.team.length * 0.95)) return false;
  if (teamRisk <= 0.3) return true;
  // fallback: approve if self in team or small randomness
  if (room.game.team.includes(player.id)) return true;
  if (rejectsInRow >= 2) return true;
  return Math.random() < 0.5;
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
  if (ROLE_FACTIONS[role] === 'evil' && role !== '奥伯伦') {
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      if (ROLE_FACTIONS[r] === 'evil' && r !== '奥伯伦' && id !== playerId) ids.push(id);
    }
    return ids;
  }
  return ids;
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
      if (rejectsInRow >= 4) return true; // avoid 5th reject auto-loss edge case
      return false;
    }
    if (team.length > 0 && team.every((id) => hardKnownGood.has(id))) return true;
    const teamRisk = team.reduce((s, id) => s + Math.max(0, suspicion[id] || 0), 0);
    if (teamRisk >= Math.max(2.2, team.length * 0.95) && rejectsInRow < 4) return false;
    if (teamRisk <= 0.3) return true;
    // Merlin may approve risky team to hide, with small probability
    if (teamHasKnownEvil) {
      if (role === '梅林' && Math.random() < 0.25) return true;
      return false;
    }
    // prefer approve if self in team, but still allow strategy
    if (team.includes(playerId) && Math.random() < 0.8) return true;
    if (rejectsInRow >= 3) return true;
    return approve;
  }
  // evil
  const teamHasEvil = team.some((id) => ROLE_FACTIONS[room.game.assignments[id]] === 'evil');
  if (teamHasEvil) {
    if (rejectsInRow < 4 && Math.random() < 0.28) return false;
    return true;
  }
  if (rejectsInRow >= 4) return true;
  return approve;
}

function autoMissionIfAi(room) {
  if (!room || !room.game || room.phase !== 'mission') return;
  const gameRef = room.game;
  const teamIds = room.game.team;
  const tasks = teamIds.map(async (id) => {
    const player = room.players.get(id);
    if (!player || !player.isAI) return;
    let fail = null;
    try {
      fail = await decideMission({
        room,
        playerId: id,
        role: room.game.assignments[id],
        roleFactions: ROLE_FACTIONS,
      });
    } catch (e) {
      fail = null;
    }
    if (!room.game || room.game !== gameRef || room.phase !== 'mission') return;
    if (fail === null) fail = aiMissionVote(room, player);
    if (!room.game || room.game !== gameRef || room.phase !== 'mission') return;
    room.game.missionVotes[id] = normalizeAiMission(room, id, fail);
  });
  Promise.all(tasks).then(() => {
    if (!room.game || room.game !== gameRef || room.phase !== 'mission') return;
    if (teamIds.every((id) => room.game.missionVotes[id] !== undefined)) {
      resolveMission(room);
    }
    if (room.game && room.game === gameRef) broadcastRoom(room);
  });
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
  // if failing can win soon, prioritize fail
  if (failCount >= 2) return true;
  // if evil can swing by failing, prefer fail
  if (needFail === 1) {
    if (evilOnTeam >= 2) return Math.random() < 0.58 ? true : fail;
    return Math.random() < 0.9 ? true : fail;
  }
  // needFail == 2: be cautious if only one evil on team
  if (needFail === 2 && evilOnTeam <= 1) return Math.random() < 0.45 ? true : fail;
  return Math.random() < 0.75 ? true : fail;
}

function revealAll(room) {
  const revealed = {};
  for (const p of room.players.values()) {
    revealed[p.id] = room.game.assignments[p.id];
  }
  room.game.revealedRoles = revealed;
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

function randomAiName(used) {
  const pool = AI_NAMES.filter((n) => !used.has(`${n}·AI`));
  if (pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  let name;
  do {
    name = `小AI${aiNameSeq++}`;
  } while (used.has(`${name}·AI`));
  return name;
}

function revealEvilToEvil(room) {
  const evilIds = Object.keys(room.game.assignments).filter((id) => ROLE_FACTIONS[room.game.assignments[id]] === 'evil');
  const reveal = {};
  for (const id of evilIds) {
    reveal[id] = room.game.assignments[id];
  }
  for (const id of evilIds) {
    const player = room.players.get(id);
    if (!player || player.isAI) continue;
    send({ id }, { type: 'EVIL_REVEAL', data: reveal });
  }
}

function revealEvilToAll(room) {
  const evilIds = Object.keys(room.game.assignments).filter((id) => ROLE_FACTIONS[room.game.assignments[id]] === 'evil');
  const reveal = {};
  for (const id of evilIds) {
    reveal[id] = room.game.assignments[id];
  }
  room.game.revealedEvil = reveal;
}

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

const clients = new Map();
let clientSeq = 1;

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
        startGame(client);
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
      case 'GET_ROLE_STATS':
        fetchRoleStats(client);
        break;
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
  });
});

server.listen(PORT, () => {
  console.log(`Avalon server running on :${PORT}`);
});
