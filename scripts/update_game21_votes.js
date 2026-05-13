const Database = require('better-sqlite3');
const db = new Database('./users.sqlite');

// 从 95129 房间快照取 voteHistory / missionHistory
const row = db.prepare('SELECT snapshot FROM active_rooms WHERE room_code = ?').get('95129');
const snap = JSON.parse(row.snapshot);
const vh = snap.game.voteHistory;
const mh = snap.game.missionHistory;

// 座位映射：95129 ID → 第21局 ID
const idMap = {
  u1797: 'u2101',
  u1798: 'u2019',
  u1792: 'u2111',
  u1787: 'u2094',
  // 以下相同，保留
  u1795: 'u1795',
  u61:   'u61',
  u79:   'u79',
  u64:   'u64',
};

function mapId(id) { return idMap[id] || id; }

function mapArray(arr) {
  return (arr || []).map(mapId);
}

function mapVotes(votes) {
  const out = {};
  for (const [k, v] of Object.entries(votes || {})) out[mapId(k)] = v;
  return out;
}

function mapSnap(snap) {
  const out = {};
  for (const [k, v] of Object.entries(snap || {})) out[mapId(k)] = v;
  return out;
}

const newVoteHistory = vh.map(v => ({
  ...v,
  leaderId: mapId(v.leaderId),
  team: mapArray(v.team),
  votes: mapVotes(v.votes),
  seatSnapshot: mapSnap(v.seatSnapshot),
}));

const newMissionHistory = mh.map(m => ({
  ...m,
  team: mapArray(m.team),
  missionVotes: mapVotes(m.missionVotes),
  seatSnapshot: mapSnap(m.seatSnapshot),
}));

// 读取现有 game_records 21 payload
const rec = db.prepare('SELECT payload FROM game_records WHERE id = 21').get();
const payload = JSON.parse(rec.payload);

// 更新
payload.voteHistory = newVoteHistory;
payload.missionHistory = newMissionHistory;

db.prepare('UPDATE game_records SET payload = ? WHERE id = 21').run(JSON.stringify(payload));
console.log('Updated game_records 21 with voteHistory:', newVoteHistory.length, 'missionHistory:', newMissionHistory.length);

// 重新计算勋章（medals.js 逻辑）
const { evaluateMedalsForPayload } = require('./medals');
const medalByPlayerId = evaluateMedalsForPayload(payload);
console.log('Medals:', JSON.stringify(medalByPlayerId, null, 2));

// 删掉旧勋章，写新勋章
db.prepare('DELETE FROM participant_medals WHERE game_id = 21').run();
const insertMedal = db.prepare(
  'INSERT INTO participant_medals(game_id, phone, client_id, medal_code, medal_name, created_at) VALUES(21, ?, ?, ?, ?, ?)'
);
const { MEDAL_DEFS } = require('./medals');

const players = payload.players;
for (const p of players) {
  const codes = medalByPlayerId[p.id] || [];
  for (const code of codes) {
    const name = (MEDAL_DEFS[code] && MEDAL_DEFS[code].name) || code;
    insertMedal.run(p.phone, p.id, code, name, payload.endedAt);
    console.log('medal:', p.nickname, code, name);
  }
}

console.log('\nDone.');
