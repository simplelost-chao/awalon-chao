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
  // Bayesian smoothing for partner win rates (same k=3 as radar)
  const SMOOTH_K = 3;
  function smoothWR(wins, games) {
    if (!games) return 50;
    const raw = (wins / games) * 100;
    return (raw * games + 50 * SMOOTH_K) / (games + SMOOTH_K);
  }

  // Helper: pick best/worst using Bayesian-smoothed win rate for ranking
  function pickBest(arr, gamesGetter, winsGetter, minGames, wantMax) {
    const candidates = arr.filter(p => gamesGetter(p) >= minGames);
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      const sa = smoothWR(winsGetter(a), gamesGetter(a));
      const sb = smoothWR(winsGetter(b), gamesGetter(b));
      return wantMax ? sb - sa : sa - sb;
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

  // golden: sameTeam smoothed winRate highest
  const golden = pickBest(matrix, p => p.sameTeam.games, p => p.sameTeam.wins, 1, true);
  // bestWolf: sameEvil smoothed winRate highest
  const bestWolf = pickBest(matrix, p => p.sameEvil.games, p => p.sameEvil.wins, 1, true);
  // bestKnight: sameGood smoothed winRate highest
  const bestKnight = pickBest(matrix, p => p.sameGood.games, p => p.sameGood.wins, 1, true);
  // worstTeammate: sameTeam smoothed winRate lowest
  const worstTeammate = pickBest(matrix, p => p.sameTeam.games, p => p.sameTeam.wins, 1, false);
  // worstWolf: sameEvil smoothed winRate lowest
  const worstWolf = pickBest(matrix, p => p.sameEvil.games, p => p.sameEvil.wins, 1, false);
  // worstKnight: sameGood smoothed winRate lowest
  const worstKnight = pickBest(matrix, p => p.sameGood.games, p => p.sameGood.wins, 1, false);

  // bestMerlinPerci / worstMerlinPerci: 梅林↔派西维尔 combo win rate
  const merlinPerciStats = new Map(); // phone -> { games, wins }
  for (const [theirPhone, data] of partnerMap) {
    let games = 0, wins = 0;
    for (const [, combo] of data.combos) {
      if ((combo.myRole === '梅林' && combo.theirRole === '派西维尔') ||
          (combo.myRole === '派西维尔' && combo.theirRole === '梅林')) {
        games += combo.games;
        wins += combo.wins;
      }
    }
    if (games > 0) merlinPerciStats.set(theirPhone, { games, wins, winRate: wr(wins, games) });
  }
  function pickMerlinPerci(wantMax) {
    let best = null;
    for (const [phone, mp] of merlinPerciStats) {
      if (mp.games < 1) continue;
      const m = matrix.find(p => p.phone === phone);
      if (!m) continue;
      const swr = smoothWR(mp.wins, mp.games);
      if (!best || (wantMax ? swr > best._swr : swr < best._swr)) {
        best = { phone: m.phone, nickname: m.nickname, avatar: m.avatar, winRate: wr(mp.wins, mp.games), games: mp.games, _swr: swr };
      }
    }
    return best;
  }
  const bestMP = pickMerlinPerci(true);
  const worstMP = pickMerlinPerci(false);
  function mpTitle(type, p) {
    if (!p) return { type, phone: null, nickname: null, avatar: null, winRate: null, games: null };
    return { type, phone: p.phone, nickname: p.nickname, avatar: p.avatar, winRate: p.winRate, games: p.games };
  }

  // nemesis (天生冤家): opponent winRate lowest / dominated (血脉压制): opponent winRate highest
  const nemesis = pickBest(matrix, p => p.opponent.games, p => p.opponent.wins, 1, false);
  const dominated = pickBest(matrix, p => p.opponent.games, p => p.opponent.wins, 1, true);

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
    {
      front: mpTitle('bestMerlinPerci', bestMP),
      back:  mpTitle('worstMerlinPerci', worstMP),
    },
    {
      front: toTitle('dominated', dominated, p => p.opponent.games, p => p.opponent.wins),
      back:  toTitle('nemesis', nemesis, p => p.opponent.games, p => p.opponent.wins),
    },
  ];

  return { pairs, matrix };
}

module.exports = { buildPartners };
