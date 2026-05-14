const { userDb } = require('./db');
const { MEDAL_DEFS } = require('./medals');
const { buildRadar } = require('./stats-radar');
const { buildPartners } = require('./stats-partners');
const { trendMaxGames } = require('./stats-config');

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
     WHERE gp.phone = ? AND COALESCE(gr.status,'completed') = 'completed'
     AND NOT EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id = gp.game_id AND ai.is_ai = 1)
     ORDER BY gr.ended_at DESC
     LIMIT ? OFFSET ?`
  );
  return stmt.all(phone, limit, offset).map((row) => ({
    ...row,
    seat: row.seat === 0 ? null : row.seat,
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
  try { payload = JSON.parse(row.payload); } catch (e) { payload = null; }
  if (!payload) return null;

  // 补全真实玩家头像（旧记录没有 avatar 字段时从 users 表查）
  if (Array.isArray(payload.players)) {
    const phones = payload.players.map(p => p.phone).filter(Boolean);
    if (phones.length) {
      const avatarMap = {};
      const placeholders = phones.map(() => '?').join(',');
      const rows = userDb.prepare(`SELECT phone, avatar FROM users WHERE phone IN (${placeholders})`).all(...phones);
      rows.forEach(r => { avatarMap[r.phone] = r.avatar; });
      payload.players = payload.players.map(p => ({
        ...p,
        avatar: p.avatar || (p.phone && avatarMap[p.phone]) || (p.isAI || !p.phone ? '🤖' : '')
      }));
    }
  }

  const medals = userDb
    .prepare(`SELECT medal_code AS code, medal_name AS name FROM participant_medals WHERE game_id = ? AND phone = ? ORDER BY id ASC`)
    .all(gameId, phone);
  return { gameId, myRole: row.myRole, myResult: row.myResult, mySeat: row.mySeat, medals, detail: payload };
}

function _buildStats(phone, excludeAI) {
  // excludeAI: true = PVP (no AI), false = PVE (has AI)
  const gpFilter = excludeAI
    ? `AND NOT EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id = gp.game_id AND ai.is_ai = 1)`
    : `AND EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id = gp.game_id AND ai.is_ai = 1)`;
  const pmFilter = excludeAI
    ? `AND NOT EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id = pm.game_id AND ai.is_ai = 1)`
    : `AND EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id = pm.game_id AND ai.is_ai = 1)`;

  const recentRows = userDb.prepare(
    `SELECT gp.role, gp.result, gr.ended_at
     FROM game_participants gp
     JOIN game_records gr ON gr.id = gp.game_id
     WHERE gp.phone = ? AND gp.role != '观战' AND COALESCE(gr.status,'completed') = 'completed'
     ${gpFilter}
     ORDER BY gr.ended_at DESC LIMIT 10`
  ).all(phone);
  const recentGames = recentRows.map(r => ({ role: r.role, result: r.result }));
  let streakType = null, streakCount = 0;
  if (recentGames.length) {
    streakType = recentGames[0].result === 'win' ? 'win' : 'lose';
    for (const g of recentGames) {
      if ((streakType === 'win') === (g.result === 'win')) streakCount++;
      else break;
    }
  }
  const rows = userDb.prepare(
    `SELECT gp.role AS role, COUNT(1) AS total, SUM(CASE WHEN gp.result = 'win' THEN 1 ELSE 0 END) AS wins
     FROM game_participants gp
     JOIN game_records gr ON gr.id = gp.game_id
     WHERE gp.phone = ? AND gp.role != '观战' AND COALESCE(gr.status,'completed') = 'completed'
     ${gpFilter}
     GROUP BY gp.role ORDER BY total DESC, gp.role ASC`
  ).all(phone);
  const byRole = rows.map((r) => {
    const total = Number(r.total || 0);
    const wins = Number(r.wins || 0);
    return { role: r.role, total, wins, winRate: total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0 };
  });
  const totalGames = byRole.reduce((s, r) => s + r.total, 0);
  const totalWins = byRole.reduce((s, r) => s + r.wins, 0);
  const overallWinRate = totalGames > 0 ? Number(((totalWins / totalGames) * 100).toFixed(1)) : 0;
  const medalRows = userDb.prepare(
    `SELECT pm.medal_code AS code, COUNT(1) AS total
     FROM participant_medals pm
     JOIN game_records gr ON gr.id = pm.game_id
     WHERE pm.phone = ? AND COALESCE(gr.status,'completed') = 'completed'
     ${pmFilter}
     GROUP BY pm.medal_code ORDER BY total DESC, pm.medal_code ASC`
  ).all(phone);
  const medals = medalRows.map((r) => {
    const def = MEDAL_DEFS[r.code];
    return { code: r.code, name: (def && def.name) || r.code, faction: (def && def.faction) || 'neutral', total: Number(r.total || 0) };
  });
  const totalMedals = medals.reduce((s, m) => s + m.total, 0);

  // 趋势图：最近 N 局按阵营分的逐局胜负（从旧到新）
  const GOOD_ROLES = new Set(['梅林','派西维尔','忠臣','亚瑟的忠臣','兰斯洛特（正义）']);
  const trendRows = userDb.prepare(
    `SELECT gp.role, gp.result
     FROM game_participants gp
     JOIN game_records gr ON gr.id = gp.game_id
     WHERE gp.phone = ? AND gp.role != '观战' AND COALESCE(gr.status,'completed') = 'completed'
     ${gpFilter}
     ORDER BY gr.ended_at DESC LIMIT ${trendMaxGames}`
  ).all(phone);
  const goodTrend = []; // 每个元素: 1=win, 0=lose, null=没打好人
  const evilTrend = [];
  let goodW = 0, goodT = 0, evilW = 0, evilT = 0;
  for (let i = trendRows.length - 1; i >= 0; i--) {
    const r = trendRows[i];
    const isGood = GOOD_ROLES.has(r.role);
    const win = r.result === 'win' ? 1 : 0;
    if (isGood) {
      goodT++; goodW += win;
      goodTrend.push(Math.round(goodW / goodT * 100));
      evilTrend.push(evilTrend.length ? evilTrend[evilTrend.length - 1] : null);
    } else {
      evilT++; evilW += win;
      evilTrend.push(Math.round(evilW / evilT * 100));
      goodTrend.push(goodTrend.length ? goodTrend[goodTrend.length - 1] : null);
    }
  }
  const trend = { good: goodTrend, evil: evilTrend };

  const radar = buildRadar(phone, excludeAI);
  const partners = buildPartners(phone, excludeAI);
  return { totalGames, totalWins, overallWinRate, byRole, medals, totalMedals, recentGames, streakType, streakCount, trend, radar, partners };
}

function getRoleStatsForPhone(phone) {
  return {
    pvp: _buildStats(phone, true),
    pve: _buildStats(phone, false),
  };
}

module.exports = {
  getHistoryListForPhone,
  getHistoryDetailForPhone,
  getRoleStatsForPhone,
};
