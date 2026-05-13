const Database = require('better-sqlite3');
const db = new Database('./users.sqlite');

const startedAt = 1776398000000;
const endedAt   = 1776400000000;

const players = [
  { id: 'u2101', seat: 1, nickname: '滑不',     phone: '19775399900', role: '刺客',    faction: 'evil', isHost: 0 },
  { id: 'u1795', seat: 2, nickname: '溜秋',     phone: '10638785133', role: '派西维尔', faction: 'good', isHost: 0 },
  { id: 'u61',   seat: 3, nickname: '丹',       phone: '12115144988', role: '忠臣',    faction: 'good', isHost: 0 },
  { id: 'u79',   seat: 4, nickname: '农民',     phone: '13989489888', role: '忠臣',    faction: 'good', isHost: 0 },
  { id: 'u2019', seat: 5, nickname: '这车真好', phone: '16281750011', role: '忠臣',    faction: 'good', isHost: 0 },
  { id: 'u2111', seat: 6, nickname: '老Hank',   phone: '14575089300', role: '莫甘娜',  faction: 'evil', isHost: 0 },
  { id: 'u64',   seat: 7, nickname: '今天乱玩', phone: '16317110611', role: '梅林',    faction: 'good', isHost: 0 },
  { id: 'u2094', seat: 8, nickname: 'CHAO',     phone: '12068234822', role: '爪牙',    faction: 'evil', isHost: 1 },
];

const assassination = {
  targetId: 'u64',
  assassinId: 'u2101',
  hit: true,
  merlinSeat: 7,
  candidateSeats: [],
  evilIntel: [],
  reasoning: null,
};

const payload = {
  roomCode: '06417',
  maxPlayers: 8,
  startedAt,
  endedAt,
  winner: 'evil',
  players: players.map((p) => ({
    id: p.id, seat: p.seat, nickname: p.nickname, phone: p.phone,
    isAI: false, isHost: !!p.isHost, role: p.role, faction: p.faction,
  })),
  voteHistory: [],
  missionHistory: [],
  speakHistory: {},
  messages: [
    { ts: startedAt, from: '系统', text: '游戏开始，进入组队阶段' },
    { ts: endedAt,   from: '系统', text: '刺客选择刺杀，刺中梅林，邪恶阵营获胜' },
  ],
  assassination,
  recaps: [],
  evilIntel: [],
  ladyOfLake: null,
  endVotes: {},
};

// 1. 插入 game_records
db.prepare(
  'INSERT INTO game_records(room_code, started_at, ended_at, max_players, winner, payload) VALUES(?, ?, ?, 8, ?, ?)'
).run('06417', startedAt, endedAt, 'evil', JSON.stringify(payload));
const newId = db.prepare('SELECT last_insert_rowid() AS id').get().id;
console.log('Inserted as game_records id:', newId);
console.log('game_records 19 inserted');

// 2. 插入 game_participants
const insertPart = db.prepare(
  'INSERT INTO game_participants(game_id, phone, client_id, nickname, seat, role, faction, result, is_host, is_ai, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)'
);
for (const p of players) {
  const result = p.faction === 'evil' ? 'win' : 'lose';
  insertPart.run(newId, p.phone, p.id, p.nickname, p.seat, p.role, p.faction, result, p.isHost, endedAt);
}
console.log('game_participants inserted:', players.length);

// 3. 插入勋章
const MEDAL_NAMES = {
  assassin_early_hit_merlin: '刺客大师',
  evil_no_fail_win: '演技派',
};
const medalData = [
  { id: 'u2101', phone: '19775399900', codes: ['assassin_early_hit_merlin', 'evil_no_fail_win'] },
  { id: 'u2111', phone: '14575089300', codes: ['evil_no_fail_win'] },
  { id: 'u2094', phone: '12068234822', codes: ['evil_no_fail_win'] },
];
const insertMedal = db.prepare(
  'INSERT INTO participant_medals(game_id, phone, client_id, medal_code, medal_name, created_at) VALUES(?, ?, ?, ?, ?, ?)'
);
for (const m of medalData) {
  for (const code of m.codes) {
    insertMedal.run(newId, m.phone, m.id, code, MEDAL_NAMES[code], endedAt);
    console.log('medal:', m.id, code, MEDAL_NAMES[code]);
  }
}

// 4. 验证
console.log('\n=== 验证结果 ===');
const rec = db.prepare('SELECT id, winner, started_at, ended_at FROM game_records WHERE id = ?').get(newId);
console.log('game_records:', rec);
const parts = db.prepare('SELECT seat, nickname, role, faction, result FROM game_participants WHERE game_id = ? ORDER BY seat').all(newId);
parts.forEach((p) => console.log(`  座${p.seat} ${p.nickname} ${p.role}(${p.faction}) -> ${p.result}`));
const meds = db.prepare('SELECT client_id, medal_code, medal_name FROM participant_medals WHERE game_id = ?').all(newId);
meds.forEach((m) => console.log(`  ${m.client_id} ${m.medal_code} ${m.medal_name}`));
