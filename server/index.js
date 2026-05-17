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
  sendFriendRequest, respondFriendRequest, deleteFriend,
  getFriendsList, getPendingRequests, getSentRequests, getFriendPhones,
} = require('./friends');
const {
  init: initGameAi,
  AI_CHARACTERS,
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
app.use(express.json({ limit: '30mb' }));
app.get('/health', (req, res) => res.json({ ok: true, token: 'awalon-ok' }));
let runtimeReviewMode = process.env.REVIEW_MODE === 'true';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const SKIN_TOOL_DIR = path.join(__dirname, '../public/tools/skin-assets');
const REF_IMGS_DIR = path.join(SKIN_TOOL_DIR, 'ref-imgs');
const SKIN_GEN_DIR = path.join(SKIN_TOOL_DIR, 'generated');

function darkGoldToolAsset(kind, name) {
  return `/tools/skin-assets/dark-gold/${kind}/${name}`;
}

function buildDarkGoldBuiltinAssets() {
  return {
    'home-bg':       darkGoldToolAsset('assets', 'home-bg.jpg'),
    'in-game-bg':    darkGoldToolAsset('assets', 'in-game-bg.jpg'),
    table:           darkGoldToolAsset('assets', 'table.png'),
    'quest-success': darkGoldToolAsset('assets', 'quest-success.png'),
    'quest-fail':    darkGoldToolAsset('assets', 'quest-fail.png'),
    'kill-icon':     darkGoldToolAsset('assets', 'kill-icon.png'),
    'history-icon':  darkGoldToolAsset('assets', 'history-icon.png'),
    'stats-icon':    darkGoldToolAsset('assets', 'stats-icon.png'),
    merlin:          darkGoldToolAsset('roles', 'merlin.png'),
    percival:        darkGoldToolAsset('roles', 'percival.png'),
    arthur_loyal:    darkGoldToolAsset('roles', 'arthur_loyal.png'),
    lancelot_good:   darkGoldToolAsset('roles', 'lancelot_good.png'),
    assassin:        darkGoldToolAsset('roles', 'assassin.png'),
    morgana:         darkGoldToolAsset('roles', 'morgana.png'),
    mordred:         darkGoldToolAsset('roles', 'mordred.png'),
    oberon:          darkGoldToolAsset('roles', 'oberon.png'),
    minion:          darkGoldToolAsset('roles', 'minion.png'),
    lancelot_evil:   darkGoldToolAsset('roles', 'lancelot_evil.png'),
  };
}

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

// Proxy image fetch — used by Skin Studio to bypass CORS on Doubao TOS image URLs
app.post('/api/proxy-image', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'invalid url' });
    const imgRes = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!imgRes.ok) return res.status(502).json({ error: `upstream ${imgRes.status}` });
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
    res.json({ b64: buffer.toString('base64'), mimeType });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ─── Skin Studio Ref Images ───────────────────────────────────────────────────
fs.mkdirSync(REF_IMGS_DIR, { recursive: true });

// GET  /api/ref-imgs/:skinId  → { urls: [...] }
app.get('/api/ref-imgs/:skinId', (req, res) => {
  const { skinId } = req.params;
  if (!/^[\w-]+$/.test(skinId)) return res.status(400).json({ error: 'invalid skinId' });
  const dir = path.join(REF_IMGS_DIR, skinId);
  if (!fs.existsSync(dir)) return res.json({ urls: [] });
  const files = fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  const urls = files.map(f => `/tools/skin-assets/ref-imgs/${skinId}/${f}`);
  res.json({ urls });
});

// POST /api/ref-imgs/:skinId  body: { images: ['data:image/jpeg;base64,...'] }  → { urls: [...] }
app.post('/api/ref-imgs/:skinId', (req, res) => {
  const { skinId } = req.params;
  if (!/^[\w-]+$/.test(skinId)) return res.status(400).json({ error: 'invalid skinId' });
  const { images } = req.body || {};
  if (!Array.isArray(images) || !images.length) return res.status(400).json({ error: 'no images' });
  const dir = path.join(REF_IMGS_DIR, skinId);
  fs.mkdirSync(dir, { recursive: true });
  const urls = [];
  for (const b64 of images) {
    const m = b64.match(/^data:image\/(\w+);base64,(.+)$/s);
    if (!m) continue;
    const ext = m[1] === 'png' ? 'png' : m[1] === 'webp' ? 'webp' : 'jpeg';
    const fname = `ref-${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`;
    const buf = Buffer.from(m[2], 'base64');
    fs.writeFileSync(path.join(dir, fname), buf);
    urls.push(`/tools/skin-assets/ref-imgs/${skinId}/${fname}`);
  }
  res.json({ urls });
});

// DELETE /api/ref-imgs/:skinId/:filename
app.delete('/api/ref-imgs/:skinId/:filename', (req, res) => {
  const { skinId, filename } = req.params;
  if (!/^[\w-]+$/.test(skinId) || !/^[\w.\-]+$/.test(filename)) return res.status(400).json({ error: 'invalid params' });
  const fpath = path.join(REF_IMGS_DIR, skinId, filename);
  if (fs.existsSync(fpath)) fs.unlinkSync(fpath);
  res.json({ ok: true });
});


// ─── Skin Studio: save generated asset to disk ───────────────────────────────
fs.mkdirSync(SKIN_GEN_DIR, { recursive: true });

// POST /api/save-asset  body: { skinId, assetId, dataUrl } OR { skinId, assetId, url }
app.post('/api/save-asset', async (req, res) => {
  try {
    const { skinId, assetId, url, dataUrl } = req.body || {};
    if (!skinId || !assetId) return res.status(400).json({ error: 'missing params' });
    if (!/^[\w-]+$/.test(skinId) || !/^[\w-]+$/.test(assetId)) return res.status(400).json({ error: 'invalid id' });
    let buf, ext;
    if (dataUrl) {
      const m = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/s);
      if (!m) return res.status(400).json({ error: 'invalid dataUrl' });
      ext = m[1] === 'png' ? 'png' : m[1] === 'webp' ? 'webp' : 'jpeg';
      buf = Buffer.from(m[2], 'base64');
    } else if (url) {
      if (!/^https?:\/\//.test(url)) return res.status(400).json({ error: 'invalid url' });
      const imgRes = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!imgRes.ok) return res.status(502).json({ error: `upstream ${imgRes.status}` });
      buf = Buffer.from(await imgRes.arrayBuffer());
      const ct = imgRes.headers.get('content-time') || 'image/jpeg';
      ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpeg';
    } else {
      return res.status(400).json({ error: 'provide url or dataUrl' });
    }
    const dir = path.join(SKIN_GEN_DIR, skinId);
    fs.mkdirSync(dir, { recursive: true });
    const fname = `${assetId}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(dir, fname), buf);
    res.json({ assetUrl: `/tools/skin-assets/generated/${skinId}/${fname}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// GET /api/skin-generated/:skinId → { assets: { assetId: url } } (latest per assetId)
app.get('/api/skin-generated/:skinId', (req, res) => {
  const { skinId } = req.params;
  if (!/^[\w-]+$/.test(skinId)) return res.status(400).json({ error: 'invalid skinId' });
  const dir = path.join(SKIN_GEN_DIR, skinId);
  // Built-in assets for dark-gold (default skin)
  const DARK_GOLD_BUILTIN = buildDarkGoldBuiltinAssets();
  const assets = skinId === 'dark-gold' ? { ...DARK_GOLD_BUILTIN } : {};
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
    const latest = {};
    for (const f of files) {
      const m = f.match(/^(.+)-\d+\.(jpe?g|png|webp)$/i);
      if (!m) continue;
      const id = m[1];
      if (!latest[id] || f > latest[id]) latest[id] = f;
    }
    for (const [id, fname] of Object.entries(latest)) {
      assets[id] = `/tools/skin-assets/generated/${skinId}/${fname}`;
    }
  }
  res.json({ assets });
});



// ── AI 配色中继 ──────────────────────────────────────────────────────────────
// 浏览器 → POST /api/ai-analyze → 服务器存队列
// 本地客户端轮询 GET /api/ai-pending → 取任务 → 处理
// 本地客户端 → POST /api/ai-result → 服务器存结果
// 浏览器轮询 GET /api/ai-result/:skinId → 取结果
// aiQueue key = `${skinId}:${type}`，type = 'theme' | 'qa'
const aiQueue = {};

app.post('/api/ai-analyze', (req, res) => {
  const { skinId, type = 'theme', styleDesc } = req.body || {};
  if (!skinId) return res.status(400).json({ error: 'missing skinId' });
  const key = `${skinId}:${type}`;
  aiQueue[key] = { skinId, type, styleDesc, ts: Date.now(), status: 'pending' };
  res.json({ ok: true, status: 'pending' });
});

app.get('/api/ai-pending', (req, res) => {
  const pending = Object.values(aiQueue).filter(v => v.status === 'pending');
  res.json({ pending });
});

app.post('/api/ai-progress', (req, res) => {
  const { skinId, type = 'qa', progress } = req.body || {};
  if (!skinId) return res.status(400).json({ error: 'missing skinId' });
  const key = `${skinId}:${type}`;
  if (aiQueue[key]) aiQueue[key].progress = progress;
  res.json({ ok: true });
});

app.post('/api/ai-result', (req, res) => {
  const { skinId, type = 'theme', ok, result, error } = req.body || {};
  if (!skinId) return res.status(400).json({ error: 'missing skinId' });
  const key = `${skinId}:${type}`;
  aiQueue[key] = { skinId, type, ts: Date.now(), status: ok ? 'done' : 'error', result, error };
  res.json({ ok: true });
});

app.get('/api/ai-result/:skinId', (req, res) => {
  const { skinId } = req.params;
  const type = req.query.type || 'theme';
  const entry = aiQueue[`${skinId}:${type}`];
  if (!entry) return res.json({ status: 'none' });
  res.json(entry);
});

app.post('/api/admin/set-mode', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  const mode = req.body && req.body.mode;
  if (mode !== 'review' && mode !== 'game') return res.status(400).json({ error: 'invalid mode' });
  runtimeReviewMode = (mode === 'review');
  console.log(`[Admin] 切换至${runtimeReviewMode ? '审核' : '游戏'}模式`);
  res.json({ ok: true, reviewMode: runtimeReviewMode });
});

// ── Admin Dashboard ──────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});
app.get('/api/admin/ai-stats', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  try { res.json(getAiLearningStats()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/trigger-meta', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
  maybeRunMetaAnalysis(true).then(() => res.json({ ok: true })).catch(e => res.status(500).json({ error: e.message }));
});

// Mount admin API routes
const { adminRoutes } = require('./admin-api');
adminRoutes(app, {
  ADMIN_KEY,
  getRooms: () => rooms,
  getRuntimeReviewMode: () => runtimeReviewMode,
  setRuntimeReviewMode: (v) => { runtimeReviewMode = v; },
  SKIN_CATALOGUE,
  AI_CHARACTERS,
  getDefaultRoleConfig: () => DEFAULT_ROLE_CONFIG,
});

app.get('/api/role-config', (req, res) => res.json(DEFAULT_ROLE_CONFIG));
app.get('/api/rooms', (req, res) => {
  const list = [];
  const authHeader = String(req.headers.authorization || '');
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const viewerToken = String((req.query && req.query.token) || bearerToken || '').trim();
  const viewerPhone = viewerToken && sessions.has(viewerToken) ? sessions.get(viewerToken) : '';
  for (const room of rooms.values()) {
    if (room._historyMode) continue;
    if (!room.hostId || String(room.code).startsWith('hist')) continue;
    if (room.phase === 'end') continue;
    const host = room.players.get(room.hostId);
    if (!host) continue; // 无有效房主的房间不展示
    const humanPlayers = Array.from(room.players.values()).filter(p => !p.isAI && !p.spectator);
    const viewerPlayer = viewerPhone
      ? Array.from(room.players.values()).find((p) => !p.isAI && p.phone === viewerPhone)
      : null;
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
      joinable: !!(joinable && !viewerPlayer),
      isMine: !!viewerPlayer,
      isHostRoom: !!(viewerPlayer && viewerPlayer.id === room.hostId),
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
  autoAssassinateIfAi, scheduleAutoAssassinIfAutoplay, autoplayLady,
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
    try {
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
      case 'GET_FRIENDS': {
        if (!client.userPhone) { send(client, { type: 'ERROR', data: { code: 'NEED_LOGIN' } }); break; }
        const fl = getFriendsList(client.userPhone);
        const fp = getPendingRequests(client.userPhone);
        const fs = getSentRequests(client.userPhone);
        const friendsData = fl.map(f => {
          let online = false, fRoomCode = null;
          for (const [, r] of rooms) {
            for (const [, p] of r.players) {
              if (p.phone === f.phone && !p.offline) { online = true; fRoomCode = r.code; break; }
            }
            if (online) break;
          }
          const isUrl = f.avatar && (f.avatar.startsWith('http') || f.avatar.startsWith('/'));
          return { ...f, online, roomCode: fRoomCode, avatarImage: isUrl ? f.avatar : '', avatarText: isUrl ? '' : (f.avatar || '🐺') };
        });
        const pendingData = fp.map(p => {
          const isUrl = p.avatar && (p.avatar.startsWith('http') || p.avatar.startsWith('/'));
          return { ...p, avatarImage: isUrl ? p.avatar : '', avatarText: isUrl ? '' : (p.avatar || '🐺') };
        });
        const sentData = fs.map(s => {
          const isUrl = s.avatar && (s.avatar.startsWith('http') || s.avatar.startsWith('/'));
          return { ...s, avatarImage: isUrl ? s.avatar : '', avatarText: isUrl ? '' : (s.avatar || '🐺') };
        });
        send(client, { type: 'FRIENDS_LIST', data: { friends: friendsData, pending: pendingData, sent: sentData } });
        break;
      }
      case 'FRIEND_REQUEST': {
        if (!client.userPhone) break;
        const frTargetPhone = payload && payload.targetPhone;
        if (!frTargetPhone) break;
        const frResult = sendFriendRequest(client.userPhone, frTargetPhone);
        if (frResult.ok) {
          const frUser = userDb.prepare('SELECT nickname, avatar FROM users WHERE phone=?').get(client.userPhone);
          for (const [, ws] of clients) {
            if (ws.userPhone === frTargetPhone) {
              send(ws, { type: 'FRIEND_REQUEST_RECEIVED', data: { fromPhone: client.userPhone, fromNickname: frUser ? frUser.nickname : '玩家', fromAvatar: frUser ? frUser.avatar : '' } });
            }
          }
        }
        send(client, { type: 'FRIEND_REQUEST_RESULT', data: frResult });
        break;
      }
      case 'FRIEND_RESPOND': {
        if (!client.userPhone) break;
        const frRespPhone = payload && payload.phone;
        const frAccept = !!(payload && payload.accept);
        if (!frRespPhone) break;
        const frRespResult = respondFriendRequest(client.userPhone, frRespPhone, frAccept);
        if (frRespResult.ok && frRespResult.accepted) {
          for (const [, ws] of clients) {
            if (ws.userPhone === frRespPhone) {
              send(ws, { type: 'FRIEND_RESPONSE', data: { phone: client.userPhone, accepted: true } });
            }
          }
        }
        send(client, { type: 'FRIEND_RESPOND_RESULT', data: frRespResult });
        break;
      }
      case 'FRIEND_DELETE': {
        if (!client.userPhone) break;
        const frDelPhone = payload && payload.phone;
        if (!frDelPhone) break;
        deleteFriend(client.userPhone, frDelPhone);
        break;
      }
      case 'SEND_EMOJI': {
        const emojiRoom = rooms.get(client.roomCode);
        if (!emojiRoom || !emojiRoom.started) break;
        const emojiPlayer = emojiRoom.players.get(client.id);
        if (!emojiPlayer || emojiPlayer.spectator) break;
        const emojiId = payload && payload.emojiId;
        if (!emojiId) break;
        const emojiNow = Date.now();
        if (emojiPlayer._lastEmoji && emojiNow - emojiPlayer._lastEmoji < 3000) break;
        emojiPlayer._lastEmoji = emojiNow;
        const emojiSeat = Array.isArray(emojiRoom.seats) ? emojiRoom.seats.indexOf(client.id) : -1;
        for (const ep of emojiRoom.players.values()) {
          send(ep, { type: 'EMOJI', data: { playerId: client.id, emojiId, seat: emojiSeat } });
        }
        break;
      }
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
    } catch (e) {
      console.error(`[WS] handler error type=${type} client=${client.id}:`, e && (e.stack || e.message || e));
      error(client, 'SERVER_ERROR');
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
