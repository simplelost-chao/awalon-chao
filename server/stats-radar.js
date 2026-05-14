/**
 * stats-radar.js — Avalon radar chart dimension calculator
 *
 * Exports buildRadar(phone, excludeAI) which queries the player's last 100
 * completed games and computes 6 good + 6 evil dimension scores (0-100 or -1).
 */

'use strict';

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

// Minimum sample count to produce a meaningful score (< this → return -1)
const MIN_SAMPLES = 3;

/**
 * Scale a ratio (0–1) to a 0–100 integer, clamped.
 */
function pct(num, den) {
  if (den === 0) return -1;
  return Math.round(Math.min(1, Math.max(0, num / den)) * 100);
}

/**
 * Return score only if we have enough samples, otherwise -1.
 */
function scored(value, sampleCount) {
  return sampleCount >= MIN_SAMPLES ? value : -1;
}

/**
 * Build radar dimension scores for a player.
 *
 * @param {string}  phone      — player phone number
 * @param {boolean} excludeAI  — true = only human-only games; false = AI-present games
 * @returns {{ good: object, evil: object }}
 */
function buildRadar(phone, excludeAI) {
  // ── 1. Fetch last 100 completed games for this player ──────────────────────

  const gpFilter = excludeAI
    ? `AND NOT EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id = gp.game_id AND ai.is_ai = 1)`
    : `AND EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id = gp.game_id AND ai.is_ai = 1)`;

  const rows = userDb.prepare(`
    SELECT gp.game_id, gp.role, gp.faction, gp.result, gr.payload
    FROM game_participants gp
    JOIN game_records gr ON gr.id = gp.game_id
    WHERE gp.phone = ?
      AND gp.role != '观战'
      AND COALESCE(gr.status,'completed') = 'completed'
      ${gpFilter}
    ORDER BY gr.ended_at DESC
    LIMIT 100
  `).all(phone);

  // ── 2. Accumulators ────────────────────────────────────────────────────────

  // Good accumulators
  const g = {
    // recognition: non-梅林, vote accuracy (reject evil teams + approve clean teams) / total votes
    recognitionCorrect: 0,  // correct votes (reject evil team OR approve clean team)
    recognitionTotal: 0,    // total votes cast

    // leadership: as leader, how many teams got approved
    leaderApproved: 0,
    leaderTotal: 0,

    // trustworthiness (good): % of approved teams that included me
    goodTrustIncluded: 0,   // approved teams where I was on the team
    goodTrustTotal: 0,      // total approved teams

    // shield: non-梅林 good, was I the assassination target?
    shieldTargeted: 0,      // games where I (non-梅林) was assassination target
    shieldGames: 0,         // games where I was non-梅林 good and assassination existed

    // dodge: as 梅林, % of games where assassination missed
    dodgeMissed: 0,
    dodgeGames: 0,

    // winRate
    goodWins: 0,
    goodGames: 0,
  };

  // Evil accumulators
  const e = {
    // charge: voted approve on teams containing other evil
    chargeApproved: 0,      // times I voted approve on evil-containing teams
    chargeTotal: 0,         // total times I voted on evil-containing teams

    // stealth: in missions, % of times evil player voted success (true=fail, false=success)
    stealthSuccess: 0,      // times I voted success (false)
    stealthMissions: 0,     // total missions I participated in as evil

    // trustworthiness (evil): non-leader, % of approved teams that included me
    evilTrustIncluded: 0,
    evilTrustTotal: 0,

    // incite (煽动): as evil leader, team approval rate
    inciteApproved: 0,
    inciteTotal: 0,

    // destruction: games where I cast at least one fail vote / total evil games I was on missions
    destructionSabotaged: 0,    // games where I voted fail at least once
    destructionGames: 0,        // evil games where I participated in at least one mission

    // winRate
    evilWins: 0,
    evilGames: 0,
  };

  // ── 3. Process each game ───────────────────────────────────────────────────

  for (const row of rows) {
    let payload;
    try {
      payload = JSON.parse(row.payload);
    } catch (_) {
      continue;
    }

    const { players = [], voteHistory = [], missionHistory = [], assassination } = payload;
    const winner = payload.winner || '';

    // Find this player's entry in the payload players array
    const me = players.find((p) => p && p.phone === phone);
    if (!me) continue;

    const myId = me.id;
    const myRole = me.role || row.role || '';
    const myFaction = ROLE_FACTIONS[myRole] || row.faction || '';

    // Build a role→faction lookup by player id
    const roleById = {};
    const factionById = {};
    for (const p of players) {
      if (!p || !p.id) continue;
      roleById[p.id] = p.role || '';
      factionById[p.id] = ROLE_FACTIONS[p.role || ''] || '';
    }

    const teamEvilCount = (team) =>
      (Array.isArray(team) ? team : []).filter((id) => factionById[id] === 'evil').length;

    // ── Good faction dimensions ──────────────────────────────────────────────
    if (myFaction === 'good') {
      g.goodGames += 1;
      if (winner === 'good') g.goodWins += 1;

      const isMerlin = myRole === '梅林';

      // recognition: non-梅林, vote accuracy across all teams
      if (!isMerlin) {
        for (const v of voteHistory) {
          if (!v || !v.votes || !Array.isArray(v.team)) continue;
          if (!(myId in v.votes)) continue;
          g.recognitionTotal += 1;
          const hasEvil = teamEvilCount(v.team) > 0;
          const voted = v.votes[myId]; // true = approve, false = reject
          if ((hasEvil && !voted) || (!hasEvil && voted)) g.recognitionCorrect += 1;
        }
      }

      // leadership: as leader, teams approved
      for (const v of voteHistory) {
        if (!v || v.leaderId !== myId) continue;
        g.leaderTotal += 1;
        if (v.approved) g.leaderApproved += 1;
      }

      // trustworthiness (good): % of approved teams including me
      for (const v of voteHistory) {
        if (!v || !Array.isArray(v.team) || !v.approved) continue;
        g.goodTrustTotal += 1;
        if (v.team.includes(myId)) g.goodTrustIncluded += 1;
      }

      // shield: non-梅林, was I assassination target?
      if (!isMerlin && assassination) {
        g.shieldGames += 1;
        if (assassination.targetId === myId) g.shieldTargeted += 1;
      }

      // dodge: as 梅林, did assassination miss?
      if (isMerlin && assassination) {
        g.dodgeGames += 1;
        if (!assassination.hit) g.dodgeMissed += 1;
      }
    }

    // ── Evil faction dimensions ──────────────────────────────────────────────
    if (myFaction === 'evil') {
      e.evilGames += 1;
      if (winner === 'evil') e.evilWins += 1;

      // charge: when a team has other evil on it, did I vote approve?
      for (const v of voteHistory) {
        if (!v || !Array.isArray(v.team) || !v.votes) continue;
        if (!(myId in v.votes)) continue;
        const hasEvil = v.team.some((id) => factionById[id] === 'evil');
        if (!hasEvil) continue;
        e.chargeTotal += 1;
        if (v.votes[myId]) e.chargeApproved += 1; // true = approve
      }

      // stealth: in missions I participated in, voted success (false)
      for (const m of missionHistory) {
        if (!m || !Array.isArray(m.team) || !m.team.includes(myId)) continue;
        const mVotes = m.missionVotes || {};
        if (!(myId in mVotes)) continue;
        e.stealthMissions += 1;
        if (!mVotes[myId]) e.stealthSuccess += 1; // false = success vote
      }

      // trustworthiness (evil): % of approved teams including me
      for (const v of voteHistory) {
        if (!v || !Array.isArray(v.team) || !v.approved) continue;
        e.evilTrustTotal += 1;
        if (v.team.includes(myId)) e.evilTrustIncluded += 1;
      }

      // incite (煽动): as evil leader, team got approved
      for (const v of voteHistory) {
        if (!v || v.leaderId !== myId) continue;
        e.inciteTotal += 1;
        if (v.approved) e.inciteApproved += 1;
      }

      // destruction: per-game, did I cast at least one fail vote?
      {
        let wasOnMission = false;
        let castFail = false;
        for (const m of missionHistory) {
          if (!m || !Array.isArray(m.team) || !m.team.includes(myId)) continue;
          wasOnMission = true;
          const mv = m.missionVotes || {};
          if (mv[myId]) castFail = true; // true = fail vote
        }
        if (wasOnMission) {
          e.destructionGames += 1;
          if (castFail) e.destructionSabotaged += 1;
        }
      }
    }
  }

  // ── 4. Compute final scores ────────────────────────────────────────────────

  // Good
  const recognition    = scored(pct(g.recognitionCorrect, g.recognitionTotal),  g.recognitionTotal);
  const leadership     = scored(pct(g.leaderApproved,    g.leaderTotal),         g.leaderTotal);
  const goodTrust      = scored(pct(g.goodTrustIncluded, g.goodTrustTotal),      g.goodTrustTotal);
  const shield         = scored(pct(g.shieldTargeted,    g.shieldGames),         g.shieldGames);
  const dodge          = scored(pct(g.dodgeMissed,       g.dodgeGames),          g.dodgeGames);
  const goodWinRate    = scored(pct(g.goodWins,          g.goodGames),           g.goodGames);

  const charge         = scored(pct(e.chargeApproved,            e.chargeTotal),         e.chargeTotal);

  const stealth        = scored(pct(e.stealthSuccess,           e.stealthMissions),     e.stealthMissions);
  const evilTrust      = scored(pct(e.evilTrustIncluded,        e.evilTrustTotal),      e.evilTrustTotal);
  const incite         = scored(pct(e.inciteApproved,           e.inciteTotal),         e.inciteTotal);
  const destruction    = scored(pct(e.destructionSabotaged,      e.destructionGames),    e.destructionGames);
  const evilWinRate    = scored(pct(e.evilWins,                 e.evilGames),           e.evilGames);

  return {
    good: {
      recognition,
      leadership,
      trustworthiness: goodTrust,
      shield,
      dodge,
      winRate: goodWinRate,
    },
    evil: {
      charge,
      incite,
      trustworthiness: evilTrust,
      stealth,
      destruction,
      winRate: evilWinRate,
    },
  };
}

module.exports = { buildRadar };
