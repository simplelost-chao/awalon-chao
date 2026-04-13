/**
 * medals.js — Avalon medal definitions and evaluation logic
 *
 * All medal conditions, descriptions, and the evaluateMedalsForPayload()
 * function live here. Import this module in index.js to keep game-server
 * code separate from medal rules.
 */

// Duplicated from index.js intentionally — medals are a self-contained module.
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

// ─── Medal Definitions ────────────────────────────────────────────────────────
// Each entry: code, name (display), faction, description (icon hint + condition)

const MEDAL_DEFS = {
  // ── Good ──────────────────────────────────────────────────────────────────
  good_blocker: {
    code: 'good_blocker',
    name: '挡刀侠',
    faction: 'good',
    description: '图标：一把剑刺向好人。达成条件：非梅林的好人，被刺杀。',
  },
  good_clean_captain: {
    code: 'good_clean_captain',
    name: '老司机',
    faction: 'good',
    description: '图标：稳稳驾驶的司机。达成条件：非梅林的好人，作为队长至少2次组出全好人队伍。',
  },
  good_wolf_trust: {
    code: 'good_wolf_trust',
    name: '钻狼窝',
    faction: 'good',
    description: '图标：好人误入狼群。达成条件：非梅林的好人，5次为含坏人的队伍投赞成票。',
  },
  merlin_survivor: {
    code: 'merlin_survivor',
    name: '梅林是狗',
    faction: 'good',
    description: '图标：梅林假装不在意。达成条件：梅林，3次为含坏人的队伍投赞成票（假装不认识坏人）。',
  },
  merlin_three_fail_lose: {
    code: 'merlin_three_fail_lose',
    name: '心累',
    faction: 'good',
    description: '图标：好人带不动。达成条件：梅林，因为3次任务失败而输掉游戏。',
  },
  good_clean_trust: {
    code: 'good_clean_trust',
    name: '开眼玩家',
    faction: 'good',
    description: '图标：开了天眼的好人。达成条件：非梅林的好人，全程对含坏人队伍投反对，对全好人队伍投赞成。',
  },
  percival_morgana_trust: {
    code: 'percival_morgana_trust',
    name: '晕头转向',
    faction: 'good',
    description: '图标：混乱的派西维尔。达成条件：派西维尔，3次在含莫甘娜的队伍里投同意票。',
  },
  good_first_round_clean_captain: {
    code: 'good_first_round_clean_captain',
    name: '盲人骑瞎马',
    faction: 'good',
    description: '图标：蒙眼扔飞镖射中靶心。达成条件：非梅林的好人，在第一轮作为队长组出全好人队伍（无梅林视角却猜对了）。',
  },
  good_three_evil_team_captain: {
    code: 'good_three_evil_team_captain',
    name: '错到极致也是对',
    faction: 'good',
    description: '图标：全错反而全对。达成条件：非梅林的好人，作为队长组出含3个坏人的队伍。',
  },
  good_three_fail_lose: {
    code: 'good_three_fail_lose',
    name: '不嘻嘻',
    faction: 'good',
    description: '图标：憋屈的失败表情。达成条件：非梅林的好人，因为3次任务失败而输掉游戏。',
  },
  good_comeback_win: {
    code: 'good_comeback_win',
    name: '开往春田花花',
    faction: 'good',
    description: '图标：麦兜幼儿园。达成条件：好人阵营，前三局任务全部成功并获胜。',
  },
  good_three_success_participant: {
    code: 'good_three_success_participant',
    name: '好人王',
    faction: 'good',
    description: '图标：好人阵营的皇冠。达成条件：好人阵营，参与3次任务成功。',
  },

  // ── Evil ──────────────────────────────────────────────────────────────────
  assassin_early_hit_merlin: {
    code: 'assassin_early_hit_merlin',
    name: '刺客大师',
    faction: 'evil',
    description: '图标：匕首直刺梅林。达成条件：刺客，在游戏结束时成功刺中梅林。',
  },
  morgana_percival_fail_master: {
    code: 'morgana_percival_fail_master',
    name: '洗头大师',
    faction: 'evil',
    description: '图标：魅惑的莫甘娜。达成条件：莫甘娜，2次在派西维尔同意的队伍中自己投失败票导致任务失败。',
  },
  oberon_no_fail_with_evil: {
    code: 'oberon_no_fail_with_evil',
    name: '找到组织',
    faction: 'evil',
    description: '图标：奥伯伦终于找到坏人同伴。达成条件：奥伯伦，在跟坏人同队时自己没有投失败但任务失败。',
  },
  oberon_double_fail_with_evil: {
    code: 'oberon_double_fail_with_evil',
    name: '撞车',
    faction: 'evil',
    description: '图标：两辆车相撞。达成条件：奥伯伦，跟其他坏人同队时一起投了失败，任务失败票数超过1。',
  },
  evil_protect_round_fail: {
    code: 'evil_protect_round_fail',
    name: '保护轮也炸了',
    faction: 'evil',
    description: '图标：保护罩被击穿。达成条件：坏人阵营，在保护轮（需要2票失败的轮次）里让任务失败。',
  },
  evil_three_fail_win: {
    code: 'evil_three_fail_win',
    name: '炸三塔',
    faction: 'evil',
    description: '图标：三座塔依次爆炸。达成条件：坏人阵营，三次任务失败而赢得游戏。',
  },
  evil_hide_votes_master: {
    code: 'evil_hide_votes_master',
    name: '藏票大师',
    faction: 'evil',
    description: '图标：躲在阴影里的坏人。达成条件：坏人阵营，连续2次在任务中投成功票（隐藏身份）。',
  },
  evil_all_fail_non_protect: {
    code: 'evil_all_fail_non_protect',
    name: '毫无默契',
    faction: 'evil',
    description: '图标：两个坏人各自行动互不知情。达成条件：坏人阵营，非保护轮中同队的2个以上坏人全都投了失败票（暴露默契）。',
  },
  evil_first_three_fail_win: {
    code: 'evil_first_three_fail_win',
    name: '车胎炸了',
    faction: 'evil',
    description: '图标：车直接裂开。达成条件：坏人阵营，前三轮任务全部破坏导致获胜。',
  },
  evil_three_fail_participant: {
    code: 'evil_three_fail_participant',
    name: '狼王',
    faction: 'evil',
    description: '图标：狼王皇冠。达成条件：坏人阵营，亲自投了3次任务失败票。',
  },
  evil_no_fail_win: {
    code: 'evil_no_fail_win',
    name: '演技派',
    faction: 'evil',
    description: '图标：面具（无间道）。达成条件：坏人阵营，全程没有投失败票但最终获胜。',
  },
  evil_fake_good_voter: {
    code: 'evil_fake_good_voter',
    name: '我想当个好人',
    faction: 'evil',
    description: '图标：无间道。达成条件：坏人阵营，全程给好人队伍投赞成，给含坏人队伍投反对。',
  },
};

// Keep old code key for backwards-compat display in older history records
MEDAL_DEFS['good_protect_round_fail_captain'] = MEDAL_DEFS['good_first_round_clean_captain'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roleByPlayerId(payload) {
  const out = {};
  const players = Array.isArray(payload && payload.players) ? payload.players : [];
  players.forEach((p) => {
    if (!p || !p.id) return;
    out[p.id] = p.role || '';
  });
  return out;
}

// ─── Medal Evaluation ────────────────────────────────────────────────────────

/**
 * Returns { [playerId]: string[] } — a map of player IDs to the medal codes
 * they earned in this game.
 *
 * @param {object} payload  — output of buildGameHistoryPayload()
 */
function evaluateMedalsForPayload(payload) {
  const result = {};
  const players = Array.isArray(payload && payload.players) ? payload.players : [];
  const voteHistory = Array.isArray(payload && payload.voteHistory) ? payload.voteHistory : [];
  const missionHistory = Array.isArray(payload && payload.missionHistory) ? payload.missionHistory : [];
  const assassination = payload && payload.assassination ? payload.assassination : null;
  const winner = payload && payload.winner ? payload.winner : '';
  const roleById = roleByPlayerId(payload);

  // ── Global aggregates ──────────────────────────────────────────────────────

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

  // ── Utilities ──────────────────────────────────────────────────────────────

  const isGoodNonMerlin = (id) => {
    const role = roleById[id] || '';
    return role && role !== '梅林' && ROLE_FACTIONS[role] === 'good';
  };
  const teamEvilCount = (team) =>
    (Array.isArray(team) ? team : []).filter((id) => ROLE_FACTIONS[roleById[id] || ''] === 'evil').length;
  const teamHasRole = (team, roleName) =>
    (Array.isArray(team) ? team : []).some((id) => (roleById[id] || '') === roleName);

  const ensure = (id, code) => {
    if (!id || !MEDAL_DEFS[code]) return;
    if (!result[id]) result[id] = [];
    if (!result[id].includes(code)) result[id].push(code);
  };

  // ── Per-player evaluation ──────────────────────────────────────────────────

  players.forEach((p) => {
    const pid = p.id;
    const role = p.role || '';
    const faction = ROLE_FACTIONS[role] || '';
    if (!pid || !role || !faction) return;

    // Counters reset per player
    let cleanLeaderCount = 0;
    let trustWolfCount = 0;
    let merlinTrustWolfCount = 0;
    let percivalTrustMorganaCount = 0;
    let firstRoundCleanLeader = false;
    let threeEvilTeamLeader = false;
    let morganaPercivalFailCount = 0;
    let evilSuccessVoteStreak = 0;
    let evilSuccessVoteStreakMax = 0;
    let evilAllFailNonProtect = false;
    let successfulMissionParticipation = 0;
    let failedMissionVoteCount = 0;  // missions where THIS player voted fail
    let alwaysTrustedCleanTeam = true;
    let alwaysRejectedEvilTeam = true;
    let castAnyVote = false;
    let castMissionFail = false;
    let oberonNoFailWithEvil = false;
    let oberonDoubleFailWithEvil = false;

    // ── Vote history pass ──────────────────────────────────────────────────

    voteHistory.forEach((v) => {
      if (!v || !Array.isArray(v.team) || !v.votes) return;
      const team = v.team;
      const playerVoteApprove = !!v.votes[pid];
      const evilCount = teamEvilCount(team);
      const isLeader = v.leaderId === pid;

      if (isLeader && isGoodNonMerlin(pid) && evilCount === 0) cleanLeaderCount += 1;
      if (isLeader && isGoodNonMerlin(pid) && evilCount >= 3) threeEvilTeamLeader = true;
      if (isLeader && isGoodNonMerlin(pid) && Number(v.round || 0) === 1 && evilCount === 0) {
        firstRoundCleanLeader = true;
      }

      if (isGoodNonMerlin(pid) && playerVoteApprove && evilCount > 0) trustWolfCount += 1;
      if (role === '梅林' && playerVoteApprove && evilCount > 0) merlinTrustWolfCount += 1;

      // Track "always clean voter" for both factions
      if (isGoodNonMerlin(pid) || ROLE_FACTIONS[role] === 'evil') {
        castAnyVote = true;
        if (evilCount === 0) {
          if (!playerVoteApprove) alwaysTrustedCleanTeam = false;
        } else if (playerVoteApprove) {
          alwaysRejectedEvilTeam = false;
        }
      }

      // Percival trusting Morgana
      if (role === '派西维尔' && playerVoteApprove && teamHasRole(team, '莫甘娜')) {
        percivalTrustMorganaCount += 1;
      }

      // Morgana: Percival approved a team Morgana was on AND the mission failed
      // (checked later in mission history for whether Morgana herself voted fail)
    });

    // ── Mission history pass ───────────────────────────────────────────────

    let evilProtectRoundFailed = false;

    missionHistory.forEach((m) => {
      if (!m || !Array.isArray(m.team) || !m.team.includes(pid)) return;
      const missionVotes = m.missionVotes || {};
      const myFail = !!missionVotes[pid];
      const fails = Number(m.fails || 0);
      const needFail = Number(m.needFail || 1);
      const team = m.team;

      if (m.success) successfulMissionParticipation += 1;

      if (ROLE_FACTIONS[role] === 'evil') {
        if (myFail) {
          castMissionFail = true;
          failedMissionVoteCount += 1;  // player actually voted fail
        }

        // Consecutive success-vote streak (藏票大师)
        if (!myFail) {
          evilSuccessVoteStreak += 1;
          if (evilSuccessVoteStreak > evilSuccessVoteStreakMax) evilSuccessVoteStreakMax = evilSuccessVoteStreak;
        } else {
          evilSuccessVoteStreak = 0;
        }

        // 保护轮也炸了: player voted fail in a protect round that failed
        if (needFail >= 2 && !m.success && myFail) {
          evilProtectRoundFailed = true;
        }

        // 毫无默契: ≥2 evil on non-protect mission, ALL voted fail, and the mission actually failed
        if (needFail < 2 && !m.success) {
          const evilOnTeam = team.filter((id) => ROLE_FACTIONS[roleById[id] || ''] === 'evil');
          if (evilOnTeam.length >= 2) {
            const allEvilFailed = evilOnTeam.every((id) => !!missionVotes[id]);
            if (allEvilFailed && evilOnTeam.includes(pid)) {
              evilAllFailNonProtect = true;
            }
          }
        }
      }

      // 莫甘娜: she voted fail, Percival approved the same vote round, mission failed
      if (role === '莫甘娜' && myFail && !m.success) {
        const voteRoundsForMission = voteHistory.filter(
          (v) => v && v.approved && Number(v.round || 0) === Number(m.round || 0)
        );
        const percivalId = players.find((x) => x && x.role === '派西维尔')?.id;
        if (percivalId) {
          const percivalApprovedThisMission = voteRoundsForMission.some((v) => !!v.votes?.[percivalId]);
          if (percivalApprovedThisMission) {
            morganaPercivalFailCount += 1;
          }
        }
      }

      // 奥伯伦 checks
      if (role === '奥伯伦') {
        const evilMateCount = team.filter(
          (id) => id !== pid && ROLE_FACTIONS[roleById[id] || ''] === 'evil'
        ).length;
        if (evilMateCount > 0) {
          if (!myFail && fails > 0) oberonNoFailWithEvil = true;
          if (myFail && fails > 1) oberonDoubleFailWithEvil = true;
        }
      }
    });

    // ── Award medals ──────────────────────────────────────────────────────

    // Good
    if (assassination && assassination.targetId === pid && isGoodNonMerlin(pid)) {
      ensure(pid, 'good_blocker');
    }
    if (cleanLeaderCount >= 2 && isGoodNonMerlin(pid)) ensure(pid, 'good_clean_captain');
    if (trustWolfCount >= 5 && isGoodNonMerlin(pid)) ensure(pid, 'good_wolf_trust');
    if (role === '梅林' && merlinTrustWolfCount >= 3) ensure(pid, 'merlin_survivor');
    if (role === '梅林' && evilWonByThreeFails) ensure(pid, 'merlin_three_fail_lose');
    if (castAnyVote && alwaysTrustedCleanTeam && alwaysRejectedEvilTeam && isGoodNonMerlin(pid)) {
      ensure(pid, 'good_clean_trust');
    }
    if (role === '派西维尔' && percivalTrustMorganaCount >= 3) ensure(pid, 'percival_morgana_trust');
    if (firstRoundCleanLeader && isGoodNonMerlin(pid)) ensure(pid, 'good_first_round_clean_captain');
    if (threeEvilTeamLeader && isGoodNonMerlin(pid)) ensure(pid, 'good_three_evil_team_captain');
    if (isGoodNonMerlin(pid) && evilWonByThreeFails) ensure(pid, 'good_three_fail_lose');
    if (ROLE_FACTIONS[role] === 'good' && goodWonFirstThreeSuccess) ensure(pid, 'good_comeback_win');
    if (ROLE_FACTIONS[role] === 'good' && successfulMissionParticipation >= 3) {
      ensure(pid, 'good_three_success_participant');
    }

    // Evil
    if (role === '刺客' && assassination && assassination.hit) {
      // Assassin found and killed Merlin — no additional condition needed
      ensure(pid, 'assassin_early_hit_merlin');
    }
    if (role === '莫甘娜' && morganaPercivalFailCount >= 2) ensure(pid, 'morgana_percival_fail_master');
    if (role === '奥伯伦' && oberonNoFailWithEvil) ensure(pid, 'oberon_no_fail_with_evil');
    if (role === '奥伯伦' && oberonDoubleFailWithEvil) ensure(pid, 'oberon_double_fail_with_evil');
    if (ROLE_FACTIONS[role] === 'evil' && evilProtectRoundFailed) ensure(pid, 'evil_protect_round_fail');
    if (ROLE_FACTIONS[role] === 'evil' && evilWonByThreeFails) ensure(pid, 'evil_three_fail_win');
    if (ROLE_FACTIONS[role] === 'evil' && evilSuccessVoteStreakMax >= 2) ensure(pid, 'evil_hide_votes_master');
    if (ROLE_FACTIONS[role] === 'evil' && evilAllFailNonProtect) ensure(pid, 'evil_all_fail_non_protect');
    if (ROLE_FACTIONS[role] === 'evil' && evilWonFirstThreeFails) ensure(pid, 'evil_first_three_fail_win');
    if (ROLE_FACTIONS[role] === 'evil' && failedMissionVoteCount >= 3) ensure(pid, 'evil_three_fail_participant');
    if (ROLE_FACTIONS[role] === 'evil' && winner === 'evil' && !castMissionFail) ensure(pid, 'evil_no_fail_win');
    if (ROLE_FACTIONS[role] === 'evil' && castAnyVote && alwaysTrustedCleanTeam && alwaysRejectedEvilTeam) {
      ensure(pid, 'evil_fake_good_voter');
    }
  });

  return result;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { MEDAL_DEFS, evaluateMedalsForPayload };
