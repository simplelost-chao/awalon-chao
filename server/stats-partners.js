/**
 * stats-partners.js — Avalon partner analysis engine
 *
 * Exports buildPartners(phone, excludeAI) which analyses the last 100
 * completed games for `phone` and returns co-participation statistics
 * against every other real player encountered.
 */

const { userDb } = require('./db');

const ROLE_FACTIONS = {
  梅林: 'good',
  派西维尔: 'good',
  忠臣: 'good',
  '亚瑟的忠臣': 'good',
  '兰斯洛特（正义）': 'good',
  刺客: 'evil',
  莫甘娜: 'evil',
  莫德雷德: 'evil',
  奥伯伦: 'evil',
  爪牙: 'evil',
  '兰斯洛特（邪恶）': 'evil',
};

/**
 * Compute winRate as a percentage rounded to 1 decimal, or 0 if no games.
 */
function wr(wins, games) {
  if (!games) return 0;
  return Number(((wins / games) * 100).toFixed(1));
}

/**
 * Build partner stats for `phone` across last 100 completed games.
 *
 * @param {string}  phone      - Player phone number
 * @param {boolean} excludeAI  - true = PVP (no AI), false = PVE (has AI)
 * @returns {{ titles: Array, matrix: Array }}
 */
function buildPartners(phone, excludeAI) {
  // ── 1. Fetch last 100 completed games for this player ──────────────────────
  const gpFilter = excludeAI
    ? `AND NOT EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id = gp.game_id AND ai.is_ai = 1)`
    : `AND EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id = gp.game_id AND ai.is_ai = 1)`;

  const gameRows = userDb.prepare(
    `SELECT gp.game_id AS gameId, gp.role AS myRole, gp.result AS myResult, gr.payload AS payload
     FROM game_participants gp
     JOIN game_records gr ON gr.id = gp.game_id
     WHERE gp.phone = ?
       AND gp.role != '观战'
       AND COALESCE(gr.status, 'completed') = 'completed'
       ${gpFilter}
     ORDER BY gr.ended_at DESC
     LIMIT 100`
  ).all(phone);

  // ── 2. Collect all partner phones for bulk nickname/avatar lookup ──────────
  // partner data keyed by phone
  // partnerMap[theirPhone] = {
  //   sameTeam: { games, wins },
  //   sameGood:  { games, wins },
  //   sameEvil:  { games, wins },
  //   opponent:  { games, wins },
  //   combos: Map< `${myRole}|${theirRole}` , { games, wins } >
  //   // latest nickname/avatar from payload (fallback, will be overridden by DB)
  //   nickname, avatar
  // }
  const partnerMap = new Map();

  function getOrInit(theirPhone) {
    if (!partnerMap.has(theirPhone)) {
      partnerMap.set(theirPhone, {
        sameTeam: { games: 0, wins: 0 },
        sameGood:  { games: 0, wins: 0 },
        sameEvil:  { games: 0, wins: 0 },
        opponent:  { games: 0, wins: 0 },
        combos: new Map(),
        nickname: null,
        avatar: null,
      });
    }
    return partnerMap.get(theirPhone);
  }

  // ── 3. Process each game ───────────────────────────────────────────────────
  for (const row of gameRows) {
    let payload;
    try { payload = JSON.parse(row.payload); } catch (e) { continue; }
    if (!payload || !Array.isArray(payload.players)) continue;

    const winner = payload.winner; // 'good' | 'evil'
    const myRole = row.myRole;
    const myFaction = ROLE_FACTIONS[myRole] || null;
    const myWon = row.myResult === 'win';

    // Find "me" in players list — some old records may not have phone on every player
    // We rely on game_participants.role + result as the ground truth for me.
    // Iterate all other real (non-AI, non-spectator) players.
    for (const p of payload.players) {
      if (!p || !p.phone) continue;
      if (p.phone === phone) continue;      // skip self
      if (p.isAI) continue;                 // skip AI
      if (p.role === '观战') continue;      // skip spectators

      const theirPhone = p.phone;
      const theirRole = p.role;
      const theirFaction = ROLE_FACTIONS[theirRole] || null;

      const entry = getOrInit(theirPhone);

      // Update latest nickname / avatar from payload (DB lookup will override later)
      if (p.nickname) entry.nickname = p.nickname;
      if (p.avatar)   entry.avatar   = p.avatar;

      // Determine their result (same winner faction)
      // myFaction wins iff myWon
      const sameTeam = myFaction && theirFaction && myFaction === theirFaction;
      const isOpponent = myFaction && theirFaction && myFaction !== theirFaction;

      if (sameTeam) {
        entry.sameTeam.games += 1;
        if (myWon) entry.sameTeam.wins += 1;

        if (myFaction === 'good') {
          entry.sameGood.games += 1;
          if (myWon) entry.sameGood.wins += 1;
        } else if (myFaction === 'evil') {
          entry.sameEvil.games += 1;
          if (myWon) entry.sameEvil.wins += 1;
        }
      } else if (isOpponent) {
        entry.opponent.games += 1;
        if (myWon) entry.opponent.wins += 1;
      }

      // Role combo tracking (only when both roles are known)
      if (myRole && theirRole) {
        const comboKey = `${myRole}|${theirRole}`;
        if (!entry.combos.has(comboKey)) {
          entry.combos.set(comboKey, { myRole, theirRole, games: 0, wins: 0 });
        }
        const combo = entry.combos.get(comboKey);
        combo.games += 1;
        if (myWon) combo.wins += 1;
      }
    }
  }

  // ── 4. Bulk-lookup latest nickname / avatar from users table ───────────────
  const allPhones = Array.from(partnerMap.keys());
  if (allPhones.length > 0) {
    const placeholders = allPhones.map(() => '?').join(',');
    const userRows = userDb.prepare(
      `SELECT phone, nickname, avatar FROM users WHERE phone IN (${placeholders})`
    ).all(...allPhones);
    for (const u of userRows) {
      const entry = partnerMap.get(u.phone);
      if (entry) {
        if (u.nickname) entry.nickname = u.nickname;
        if (u.avatar)   entry.avatar   = u.avatar;
      }
    }
  }

  // ── 5. Build matrix (sorted by totalGames desc) ────────────────────────────
  const matrix = [];
  for (const [theirPhone, data] of partnerMap) {
    const totalGames =
      data.sameTeam.games + data.opponent.games;

    if (totalGames === 0) continue; // edge-case: unknown faction both sides

    // Top 3 combos by games desc
    const topCombos = Array.from(data.combos.values())
      .sort((a, b) => b.games - a.games || b.wins - a.wins)
      .slice(0, 3)
      .map(c => ({ myRole: c.myRole, theirRole: c.theirRole, games: c.games, wins: c.wins }));

    matrix.push({
      phone:     theirPhone,
      nickname:  data.nickname || `玩家${theirPhone.slice(-4)}`,
      avatar:    data.avatar   || '🐺',
      totalGames,
      sameTeam: {
        games:   data.sameTeam.games,
        wins:    data.sameTeam.wins,
        winRate: wr(data.sameTeam.wins, data.sameTeam.games),
      },
      sameGood: {
        games:   data.sameGood.games,
        wins:    data.sameGood.wins,
        winRate: wr(data.sameGood.wins, data.sameGood.games),
      },
      sameEvil: {
        games:   data.sameEvil.games,
        wins:    data.sameEvil.wins,
        winRate: wr(data.sameEvil.wins, data.sameEvil.games),
      },
      opponent: {
        games:   data.opponent.games,
        wins:    data.opponent.wins,
        winRate: wr(data.opponent.wins, data.opponent.games),
      },
      topCombos,
    });
  }

  matrix.sort((a, b) => b.totalGames - a.totalGames || a.phone.localeCompare(b.phone));

  // ── 6. Build titles ────────────────────────────────────────────────────────
  // Helper: pick best/worst from matrix using a getter for value and a games filter
  function pickBest(arr, gamesGetter, valueGetter, minGames, wantMax) {
    const candidates = arr.filter(p => gamesGetter(p) >= minGames);
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      const va = valueGetter(a), vb = valueGetter(b);
      return wantMax ? vb - va : va - vb;
    });
    return candidates[0];
  }

  function toTitle(type, partner, gamesGetter, winsGetter) {
    if (!partner) return { type, phone: null, nickname: null, avatar: null, winRate: null, games: null };
    const games = gamesGetter(partner);
    const wins  = winsGetter(partner);
    return {
      type,
      phone:    partner.phone,
      nickname: partner.nickname,
      avatar:   partner.avatar,
      winRate:  wr(wins, games),
      games,
    };
  }

  // golden: sameTeam winRate highest (min 3)
  const golden = pickBest(matrix,
    p => p.sameTeam.games,
    p => p.sameTeam.winRate,
    3, true);

  // bestWolf: sameEvil winRate highest (min 2 — 同为坏人概率低，门槛放宽)
  const bestWolf = pickBest(matrix,
    p => p.sameEvil.games,
    p => p.sameEvil.winRate,
    2, true);

  // bestKnight: sameGood winRate highest (min 2)
  const bestKnight = pickBest(matrix,
    p => p.sameGood.games,
    p => p.sameGood.winRate,
    2, true);

  // worstTeammate: sameTeam winRate lowest (min 3)
  const worstTeammate = pickBest(matrix,
    p => p.sameTeam.games,
    p => p.sameTeam.winRate,
    3, false);

  // worstWolf: sameEvil winRate lowest (min 2)
  const worstWolf = pickBest(matrix,
    p => p.sameEvil.games,
    p => p.sameEvil.winRate,
    2, false);

  // worstKnight: sameGood winRate lowest (min 2)
  const worstKnight = pickBest(matrix,
    p => p.sameGood.games,
    p => p.sameGood.winRate,
    2, false);

  const pairs = [
    {
      front: toTitle('golden', golden, p => p.sameTeam.games, p => p.sameTeam.wins),
      back:  toTitle('worstTeammate', worstTeammate, p => p.sameTeam.games, p => p.sameTeam.wins),
    },
    {
      front: toTitle('bestWolf', bestWolf, p => p.sameEvil.games, p => p.sameEvil.wins),
      back:  toTitle('worstWolf', worstWolf, p => p.sameEvil.games, p => p.sameEvil.wins),
    },
    {
      front: toTitle('bestKnight', bestKnight, p => p.sameGood.games, p => p.sameGood.wins),
      back:  toTitle('worstKnight', worstKnight, p => p.sameGood.games, p => p.sameGood.wins),
    },
  ];

  return { pairs, matrix };
}

module.exports = { buildPartners };
