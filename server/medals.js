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
    description: '非梅林的正义，被刺客刺杀（替梅林挡刀）。',
  },
  good_clean_captain: {
    code: 'good_clean_captain',
    name: '老司机',
    faction: 'good',
    description: '非梅林的正义，作为队长至少2次组出全正义队伍。',
  },
  good_wolf_trust: {
    code: 'good_wolf_trust',
    name: '钻狼窝',
    faction: 'good',
    description: '非梅林的正义，5次为含邪恶的队伍投赞成票。',
  },
  merlin_survivor: {
    code: 'merlin_survivor',
    name: '梅林是狗',
    faction: 'good',
    description: '梅林，3次为含邪恶的队伍投赞成票（伪装不认识邪恶）。',
  },
  merlin_three_fail_lose: {
    code: 'merlin_three_fail_lose',
    name: '心累',
    faction: 'good',
    description: '梅林，因3次任务失败而输掉游戏。',
  },
  good_clean_trust: {
    code: 'good_clean_trust',
    name: '开眼玩家',
    faction: 'good',
    description: '非梅林的正义，全程对含邪恶队伍投反对、对全正义队伍投赞成。',
  },
  percival_morgana_trust: {
    code: 'percival_morgana_trust',
    name: '晕头转向',
    faction: 'good',
    description: '派西维尔，3次在含莫甘娜的队伍里投赞成票。',
  },
  good_first_round_clean_captain: {
    code: 'good_first_round_clean_captain',
    name: '盲人骑瞎马',
    faction: 'good',
    description: '非梅林的正义，在第一轮作为队长组出全正义队伍。',
  },
  good_three_evil_team_captain: {
    code: 'good_three_evil_team_captain',
    name: '错到极致也是对',
    faction: 'good',
    description: '非梅林的正义，作为队长组出含3个邪恶的队伍。',
  },
  good_three_success_participant: {
    code: 'good_three_success_participant',
    name: '正义王',
    faction: 'good',
    description: '正义阵营，亲自参与3次成功的任务。',
  },

  // ── Evil ──────────────────────────────────────────────────────────────────
  assassin_early_hit_merlin: {
    code: 'assassin_early_hit_merlin',
    name: '刺客大师',
    faction: 'evil',
    description: '刺客，在刺杀阶段成功刺中梅林。',
  },
  morgana_percival_fail_master: {
    code: 'morgana_percival_fail_master',
    name: '洗头大师',
    faction: 'evil',
    description: '莫甘娜，2次在派西维尔投赞成的队伍中投失败票且任务失败。',
  },
  oberon_no_fail_with_evil: {
    code: 'oberon_no_fail_with_evil',
    name: '找到组织',
    faction: 'evil',
    description: '奥伯伦，与其他邪恶同队时自己没投失败但任务仍然失败。',
  },
  oberon_double_fail_with_evil: {
    code: 'oberon_double_fail_with_evil',
    name: '撞车',
    faction: 'evil',
    description: '奥伯伦，与其他邪恶同队时都投了失败，失败票数超过1。',
  },
  evil_protect_round_fail: {
    code: 'evil_protect_round_fail',
    name: '保护轮也炸了',
    faction: 'evil',
    description: '邪恶阵营，在保护轮（需2票失败的轮次）中投失败票且任务失败。',
  },
  evil_three_fail_win: {
    code: 'evil_three_fail_win',
    name: '炸三塔',
    faction: 'evil',
    description: '邪恶阵营，通过3次任务失败赢得游戏。',
  },
  evil_hide_votes_master: {
    code: 'evil_hide_votes_master',
    name: '藏票大师',
    faction: 'evil',
    description: '邪恶阵营，连续2次在任务中投成功票隐藏身份。',
  },
  evil_all_fail_non_protect: {
    code: 'evil_all_fail_non_protect',
    name: '毫无默契',
    faction: 'evil',
    description: '邪恶阵营，非保护轮中2个以上同队邪恶全都投了失败票。',
  },
  evil_three_fail_participant: {
    code: 'evil_three_fail_participant',
    name: '狼王',
    faction: 'evil',
    description: '邪恶阵营，亲自投了3次任务失败票。',
  },
  evil_no_fail_win: {
    code: 'evil_no_fail_win',
    name: '演技派',
    faction: 'evil',
    description: '邪恶阵营，全程没有投失败票但最终获胜。',
  },
  evil_assassin_killed_ally: {
    code: 'evil_assassin_killed_ally',
    name: '同室操戈',
    faction: 'evil',
    description: '刺客（或莫德雷德代刺），刺杀阶段刺中了邪恶阵营的队友。',
  },

  // ── New medals ────────────────────────────────────────────────────────────
  merlin_perfect_vote: {
    code: 'merlin_perfect_vote',
    name: '看破红尘',
    faction: 'good',
    description: '梅林，全程对含邪恶队伍投反对、对全正义队伍投赞成。',
  },
  good_no_fail_missions: {
    code: 'good_no_fail_missions',
    name: '天选之人',
    faction: 'good',
    description: '正义阵营，参与≥2次任务且全部成功。',
  },
  good_win_after_two_fails: {
    code: 'good_win_after_two_fails',
    name: '绝地反杀',
    faction: 'good',
    description: '正义阵营，前两轮任务都失败但最终正义获胜。',
  },
  good_five_evil_reject: {
    code: 'good_five_evil_reject',
    name: '鹰眼',
    faction: 'good',
    description: '非梅林的正义，至少5次对含邪恶队伍投反对票。',
  },
  good_captain_clean_record: {
    code: 'good_captain_clean_record',
    name: '金牌队长',
    faction: 'good',
    description: '正义阵营，作为队长至少2次带队且任务从未失败。',
  },
  good_decisive_win: {
    code: 'good_decisive_win',
    name: '决战时刻',
    faction: 'good',
    description: '正义阵营获胜，且恰好有2次任务失败（3-2逆转）。',
  },
  evil_captain_sneak: {
    code: 'evil_captain_sneak',
    name: '黑心队长',
    faction: 'evil',
    description: '邪恶阵营，作为队长至少2次带出含邪恶的队伍且被投票通过。',
  },
  evil_lone_bomber: {
    code: 'evil_lone_bomber',
    name: '孤勇者',
    faction: 'evil',
    description: '邪恶阵营，有其他邪恶同队时独自一人投失败票。',
  },
  evil_good_disguise: {
    code: 'evil_good_disguise',
    name: '完美伪装',
    faction: 'evil',
    description: '邪恶（非奥伯伦），参与≥3次任务且全部成功。',
  },
  evil_reject_clean_team: {
    code: 'evil_reject_clean_team',
    name: '搅局者',
    faction: 'evil',
    description: '邪恶阵营，至少3次对全正义队伍投反对票。',
  },

  // ── 湖中仙女 & 特殊勋章 ──────────────────────────────────────────────────
  lady_catch_mordred: {
    code: 'lady_catch_mordred',
    name: '湖底捞月',
    faction: 'good',
    description: '正义阵营，使用湖中仙女验到莫德雷德。',
  },
  good_reject_all: {
    code: 'good_reject_all',
    name: '我反对一切',
    faction: 'good',
    description: '正义阵营，反对票数≥总投票次数的80%（至少投票4次）。',
  },
  good_never_on_mission: {
    code: 'good_never_on_mission',
    name: '板凳王',
    faction: 'good',
    description: '正义阵营，整局没有参与任何任务但正义获胜。',
  },
  good_unanimous_approve: {
    code: 'good_unanimous_approve',
    name: '众望所归',
    faction: 'good',
    description: '正义阵营，作为队长组队时获得全票通过（所有人投赞成）。',
  },
  evil_on_all_missions: {
    code: 'evil_on_all_missions',
    name: '无处不在',
    faction: 'evil',
    description: '邪恶阵营，参与了所有已完成的任务，且任务≥3轮。',
  },
  evil_force_reject: {
    code: 'evil_force_reject',
    name: '拖延战术',
    faction: 'evil',
    description: '邪恶阵营，通过连续组队被否决触发强制判负而获胜。',
  },
  oberon_first_blood: {
    code: 'oberon_first_blood',
    name: '第一滴血',
    faction: 'evil',
    description: '奥伯伦，在第一轮任务中投失败票且任务失败。',
  },
  evil_last_mission_bomb: {
    code: 'evil_last_mission_bomb',
    name: '绝杀',
    faction: 'evil',
    description: '邪恶阵营，在最后一轮任务中投失败票且任务失败，邪恶获胜。',
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
  const endReason = payload && payload.endReason ? payload.endReason : '';
  const ladyOfLake = payload && payload.ladyOfLake ? payload.ladyOfLake : null;
  const ladyHistory = (ladyOfLake && Array.isArray(ladyOfLake.history)) ? ladyOfLake.history : [];
  const roleById = roleByPlayerId(payload);

  // ── Global aggregates ──────────────────────────────────────────────────────

  const missionByRound = {};
  missionHistory.forEach((m) => {
    const r = Number(m && m.round ? m.round : 0);
    if (r > 0 && !missionByRound[r]) missionByRound[r] = m;
  });

  const failedMissionCount = missionHistory.filter((m) => m && !m.success).length;
  const evilWonByThreeFails = winner === 'evil' && failedMissionCount >= 3;

  // First two missions (sorted by round) both failed
  const sortedMissions = missionHistory
    .filter((m) => m && Number(m.round || 0) > 0)
    .slice()
    .sort((a, b) => Number(a.round || 0) - Number(b.round || 0));
  const firstTwoMissions = sortedMissions.slice(0, 2);
  const firstTwoMissionsFailed =
    firstTwoMissions.length >= 2 && firstTwoMissions.every((m) => !m.success);

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

    // New counters for the 11 additional medals
    let merlinCastAnyVote = false;
    let merlinAlwaysTrustedCleanTeam = true;
    let merlinAlwaysRejectedEvilTeam = true;
    let missionParticipation = 0;
    let failedMissionParticipation = 0;
    let evilTeamRejectCount = 0;
    let captainApprovedMissions = 0;
    let captainFailedMissions = 0;
    let evilCaptainPassCount = 0;
    let loneFailVote = false;
    let goodTeamRejectCount = 0;
    let totalVotes = 0;
    let rejectVotes = 0;
    let unanimousApprove = false;

    // ── Vote history pass ──────────────────────────────────────────────────

    voteHistory.forEach((v) => {
      if (!v || !Array.isArray(v.team) || !v.votes) return;
      // Track total/reject votes for this player
      if (v.votes.hasOwnProperty(pid)) {
        totalVotes += 1;
        if (!v.votes[pid]) rejectVotes += 1;
      }
      // Check unanimous approve for this player as leader
      const isLeaderHere = v.leaderId === pid;
      if (isLeaderHere && v.approved && ROLE_FACTIONS[role] === 'good') {
        const allApproved = Object.values(v.votes).every((vote) => !!vote);
        if (allApproved) unanimousApprove = true;
      }
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

      // merlin_perfect_vote: separate Merlin-specific vote tracking
      if (role === '梅林') {
        merlinCastAnyVote = true;
        if (evilCount === 0) {
          if (!playerVoteApprove) merlinAlwaysTrustedCleanTeam = false;
        } else if (playerVoteApprove) {
          merlinAlwaysRejectedEvilTeam = false;
        }
      }

      // good_five_evil_reject: non-Merlin good player rejected evil-containing team
      if (isGoodNonMerlin(pid) && !playerVoteApprove && evilCount > 0) {
        evilTeamRejectCount += 1;
      }

      // good_captain_clean_record: leader who got approved — check mission outcome later
      if (isLeader && v.approved && ROLE_FACTIONS[role] === 'good') {
        const missionRound = Number(v.round || 0);
        if (missionRound > 0 && missionByRound[missionRound]) {
          captainApprovedMissions += 1;
          if (!missionByRound[missionRound].success) captainFailedMissions += 1;
        }
      }

      // evil_captain_sneak: evil leader approved with evil in team
      if (isLeader && v.approved && ROLE_FACTIONS[role] === 'evil' && evilCount > 0) {
        evilCaptainPassCount += 1;
      }

      // evil_reject_clean_team: evil player rejected a fully-good team
      if (ROLE_FACTIONS[role] === 'evil' && !playerVoteApprove && evilCount === 0) {
        goodTeamRejectCount += 1;
      }
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

      // good_no_fail_missions / evil_good_disguise / evil_mission_infiltrator
      missionParticipation += 1;
      if (!m.success) failedMissionParticipation += 1;

      // evil_lone_bomber: voted fail solo while ≥1 other evil teammate chose NOT to fail
      if (ROLE_FACTIONS[role] === 'evil' && myFail && fails === 1) {
        const otherEvilOnTeam = team.filter(
          (id) => id !== pid && ROLE_FACTIONS[roleById[id] || ''] === 'evil'
        );
        const otherEvilAlsofailed = otherEvilOnTeam.some((id) => !!(missionVotes || {})[id]);
        if (otherEvilOnTeam.length >= 1 && !otherEvilAlsofailed) {
          loneFailVote = true;
        }
      }

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
    if (ROLE_FACTIONS[role] === 'good' && successfulMissionParticipation >= 3) {
      ensure(pid, 'good_three_success_participant');
    }

    // Evil
    if (role === '刺客' && assassination && assassination.hit) {
      // Assassin found and killed Merlin — no additional condition needed
      ensure(pid, 'assassin_early_hit_merlin');
    }
    const isAssassinRole = role === '刺客' || (role === '莫德雷德' && assassination && assassination.assassinId === pid);
    if (isAssassinRole && assassination && assassination.targetId) {
      const targetRole = roleById[assassination.targetId];
      if (targetRole && ROLE_FACTIONS[targetRole] === 'evil') {
        ensure(pid, 'evil_assassin_killed_ally');
      }
    }
    if (role === '莫甘娜' && morganaPercivalFailCount >= 2) ensure(pid, 'morgana_percival_fail_master');
    if (role === '奥伯伦' && oberonNoFailWithEvil) ensure(pid, 'oberon_no_fail_with_evil');
    if (role === '奥伯伦' && oberonDoubleFailWithEvil) ensure(pid, 'oberon_double_fail_with_evil');
    if (ROLE_FACTIONS[role] === 'evil' && evilProtectRoundFailed) ensure(pid, 'evil_protect_round_fail');
    if (ROLE_FACTIONS[role] === 'evil' && evilWonByThreeFails) ensure(pid, 'evil_three_fail_win');
    if (ROLE_FACTIONS[role] === 'evil' && evilSuccessVoteStreakMax >= 2) ensure(pid, 'evil_hide_votes_master');
    if (ROLE_FACTIONS[role] === 'evil' && evilAllFailNonProtect) ensure(pid, 'evil_all_fail_non_protect');
    if (ROLE_FACTIONS[role] === 'evil' && failedMissionVoteCount >= 3) ensure(pid, 'evil_three_fail_participant');
    if (ROLE_FACTIONS[role] === 'evil' && winner === 'evil' && !castMissionFail) ensure(pid, 'evil_no_fail_win');

    // ── New medals ────────────────────────────────────────────────────────

    // merlin_perfect_vote: Merlin voted correctly on all teams all game
    if (role === '梅林' && merlinCastAnyVote && merlinAlwaysTrustedCleanTeam && merlinAlwaysRejectedEvilTeam) {
      ensure(pid, 'merlin_perfect_vote');
    }

    // good_no_fail_missions: good player on ≥2 missions, never in a failed one
    if (ROLE_FACTIONS[role] === 'good' && missionParticipation >= 2 && failedMissionParticipation === 0) {
      ensure(pid, 'good_no_fail_missions');
    }

    // good_win_after_two_fails: good player, first two missions failed, good wins
    if (ROLE_FACTIONS[role] === 'good' && winner === 'good' && firstTwoMissionsFailed) {
      ensure(pid, 'good_win_after_two_fails');
    }

    // good_five_evil_reject: non-Merlin good, rejected evil teams ≥5 times
    if (isGoodNonMerlin(pid) && evilTeamRejectCount >= 5) {
      ensure(pid, 'good_five_evil_reject');
    }

    // good_captain_clean_record: good, led ≥2 approved missions, none failed
    if (ROLE_FACTIONS[role] === 'good' && captainApprovedMissions >= 2 && captainFailedMissions === 0) {
      ensure(pid, 'good_captain_clean_record');
    }

    // good_decisive_win: good wins with exactly 2 failed missions
    if (ROLE_FACTIONS[role] === 'good' && winner === 'good' && failedMissionCount === 2) {
      ensure(pid, 'good_decisive_win');
    }

    // evil_captain_sneak: evil, led ≥2 approved teams containing evil
    if (ROLE_FACTIONS[role] === 'evil' && evilCaptainPassCount >= 2) {
      ensure(pid, 'evil_captain_sneak');
    }

    // evil_lone_bomber: evil, at least once the sole fail voter in a mission
    if (ROLE_FACTIONS[role] === 'evil' && loneFailVote) {
      ensure(pid, 'evil_lone_bomber');
    }


    // evil_good_disguise: evil (not 奥伯伦), ≥3 missions all succeeded
    if (ROLE_FACTIONS[role] === 'evil' && role !== '奥伯伦' &&
        missionParticipation >= 3 && failedMissionParticipation === 0) {
      ensure(pid, 'evil_good_disguise');
    }

    // evil_reject_clean_team: evil, rejected fully-good teams ≥3 times
    if (ROLE_FACTIONS[role] === 'evil' && goodTeamRejectCount >= 3) {
      ensure(pid, 'evil_reject_clean_team');
    }

    // ── 湖中仙女 & 特殊勋章 ──────────────────────────────────────────────

    // lady_catch_mordred: good player used Lady of Lake and caught Mordred
    const ladyChecks = ladyHistory.filter((e) => e.holderId === pid);
    if (ROLE_FACTIONS[role] === 'good' && ladyChecks.length > 0) {
      const caughtMordred = ladyChecks.some((e) => (roleById[e.targetId] || '') === '莫德雷德');
      if (caughtMordred) ensure(pid, 'lady_catch_mordred');
    }

    // good_reject_all: good player, reject rate ≥80% with ≥4 votes
    if (ROLE_FACTIONS[role] === 'good' && totalVotes >= 4 && (rejectVotes / totalVotes) >= 0.8) {
      ensure(pid, 'good_reject_all');
    }

    // good_never_on_mission: good, never on any mission, good wins
    if (ROLE_FACTIONS[role] === 'good' && winner === 'good' && missionParticipation === 0) {
      ensure(pid, 'good_never_on_mission');
    }

    // good_unanimous_approve: good captain, got unanimous approval at least once
    if (ROLE_FACTIONS[role] === 'good' && unanimousApprove) {
      ensure(pid, 'good_unanimous_approve');
    }

    // evil_on_all_missions: evil, on ALL completed missions and ≥3 missions total
    if (ROLE_FACTIONS[role] === 'evil' && missionHistory.length >= 3 && missionParticipation === missionHistory.length) {
      ensure(pid, 'evil_on_all_missions');
    }

    // evil_force_reject: evil wins by force round (consecutive team rejections)
    if (ROLE_FACTIONS[role] === 'evil' && winner === 'evil' && endReason === 'force_round') {
      ensure(pid, 'evil_force_reject');
    }

    // oberon_first_blood: Oberon voted fail in round 1 mission and it failed
    if (role === '奥伯伦') {
      const round1 = sortedMissions.find((m) => Number(m.round || 0) === 1);
      if (round1 && !round1.success && round1.team.includes(pid) && round1.missionVotes && round1.missionVotes[pid]) {
        ensure(pid, 'oberon_first_blood');
      }
    }

    // evil_last_mission_bomb: evil, voted fail in the last mission, mission failed, evil wins
    if (ROLE_FACTIONS[role] === 'evil' && winner === 'evil' && sortedMissions.length > 0) {
      const lastMission = sortedMissions[sortedMissions.length - 1];
      if (lastMission && !lastMission.success && lastMission.team.includes(pid) &&
          lastMission.missionVotes && lastMission.missionVotes[pid]) {
        ensure(pid, 'evil_last_mission_bomb');
      }
    }
  });

  return result;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { MEDAL_DEFS, evaluateMedalsForPayload };
