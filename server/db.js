const path = require('path');
const Database = require('better-sqlite3');
const { now } = require('./constants');

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
  CREATE TABLE IF NOT EXISTS participant_peer_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    voter_phone TEXT,
    voter_client_id TEXT NOT NULL,
    target_phone TEXT,
    target_client_id TEXT NOT NULL,
    vote_type TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(game_id, voter_client_id)
  );
  CREATE INDEX IF NOT EXISTS idx_participant_peer_votes_target_phone ON participant_peer_votes(target_phone);
  CREATE INDEX IF NOT EXISTS idx_participant_peer_votes_game_id ON participant_peer_votes(game_id);
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

// ── 迁移：game_records 加 status 字段（留局标记）──────────────────
try {
  userDb.prepare("ALTER TABLE game_records ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'").run();
  userDb.prepare("CREATE INDEX IF NOT EXISTS idx_game_records_status ON game_records(status)").run();
} catch (_) { /* 字段已存在，忽略 */ }

// ── 活跃房间语句 ──────────────────────────────────────────────────
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
const getAllActiveRoomSnapshotsStmt = userDb.prepare(
  'SELECT room_code AS roomCode, snapshot FROM active_rooms ORDER BY updated_at DESC'
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

// ── 用户 CRUD ─────────────────────────────────────────────────────
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
  userDb
    .prepare('UPDATE users SET nickname = ?, avatar = ?, updated_at = ? WHERE phone = ?')
    .run(nickname, avatar, now(), phone);
}

module.exports = {
  userDb,
  // 语句（index.js 中直接使用）
  upsertActiveRoomStmt,
  deleteActiveRoomStmt,
  deleteActiveRoomPlayersByRoomStmt,
  deleteActiveRoomPlayerByPhoneStmt,
  getActiveRoomPlayerByPhoneStmt,
  getActiveRoomSnapshotStmt,
  getAllActiveRoomSnapshotsStmt,
  upsertActiveRoomPlayerStmt,
  persistActiveRoomTx,
  deleteActiveRoomTx,
  // 函数
  getOrCreateUser,
  updateUserProfile,
};
