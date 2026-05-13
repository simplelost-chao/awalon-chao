// 游戏纯计算工具函数（不依赖 this/setData）

const { decorateMedals } = require('./medals');
const { roleImageFor: roleImageForSkin } = require('../skins');

const ROLE_IMAGE_MAP = {
  梅林: "https://www.awalon.top/mp-assets/role-split/merlin.png",
  派西维尔: "https://www.awalon.top/mp-assets/role-split/percival.png",
  忠臣: "https://www.awalon.top/mp-assets/role-split/arthur_loyal.png",
  "亚瑟的忠臣": "https://www.awalon.top/mp-assets/role-split/arthur_loyal.png",
  "兰斯洛特（正义）": "https://www.awalon.top/mp-assets/role-split/lancelot_good.png",
  莫甘娜: "https://www.awalon.top/mp-assets/role-split/morgana.png",
  刺客: "https://www.awalon.top/mp-assets/role-split/assassin.png",
  莫德雷德: "https://www.awalon.top/mp-assets/role-split/mordred.png",
  奥伯伦: "https://www.awalon.top/mp-assets/role-split/oberon.png",
  爪牙: "https://www.awalon.top/mp-assets/role-split/minion.png",
  "兰斯洛特（邪恶）": "https://www.awalon.top/mp-assets/role-split/lancelot_evil.png"
};

const EVIL_ROLES = new Set(["刺客", "莫甘娜", "莫德雷德", "奥伯伦", "爪牙", "兰斯洛特（邪恶）"]);

const MISSION_SIZES = {
  5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5],
};
const MISSION_FAILS = {
  5: [1, 1, 1, 1, 1], 6: [1, 1, 1, 1, 1], 7: [1, 1, 1, 2, 1],
  8: [1, 1, 1, 2, 1], 9: [1, 1, 1, 2, 1], 10: [1, 1, 1, 2, 1],
};

const ROLE_ORDER = ["梅林", "派西维尔", "忠臣", "刺客", "莫甘娜", "莫德雷德", "奥伯伦", "爪牙"];

const ROLE_DESCRIPTION_MAP = {
  梅林: "知道大部分邪恶身份，但必须隐藏自己，避免在终局被刺客识破。",
  派西维尔: "能看到梅林与莫甘娜，但无法区分谁是真梅林，职责是保护关键正义位。",
  忠臣: "没有额外信息，依靠发言、投票和任务结果帮助正义阵营推进。",
  "亚瑟的忠臣": "没有额外信息，依靠发言、投票和任务结果帮助正义阵营推进。",
  "兰斯洛特（正义）": "特殊规则角色，可能带来阵营扰动，需要结合局势判断信息真伪。",
  刺客: "邪恶核心角色。若正义先完成三次任务成功，刺客仍可通过刺杀梅林翻盘。",
  莫甘娜: "会被派西维尔误认为可能的梅林，适合伪装和带偏判断。",
  莫德雷德: "通常不会被梅林看到，隐蔽性强，适合潜伏带队或控场。",
  奥伯伦: "属于邪恶阵营，但通常不与其他邪恶互通信息，容易形成信息断层。",
  爪牙: "标准邪恶位，没有额外能力，主要负责配合队友制造失败任务和混淆视角。",
  "兰斯洛特（邪恶）": "特殊规则角色，阵营关系更复杂，需要结合对局规则和信息变化判断。"
};

function roleImageFor(role, skinId) {
  // Use skin-aware lookup; fall back to static map for unknown roles
  const skinUrl = roleImageForSkin(role, skinId);
  if (skinUrl) return skinUrl;
  return ROLE_IMAGE_MAP[role] || "";
}

function roleClassFor(role) {
  if (!role) return "";
  return EVIL_ROLES.has(role) ? "role-evil" : "role-good";
}

function missionMetaByCount(count) {
  return {
    sizes: MISSION_SIZES[count] || MISSION_SIZES[7],
    fails: MISSION_FAILS[count] || MISSION_FAILS[7],
  };
}

function forcedRoundForRoom(room) {
  if (!room) return 5;
  const n = Number(room.forceRound || 0);
  return n >= 1 ? n : 5;
}

function isCurrentForcedAttempt(room) {
  if (!room || !room.game) return false;
  const phase = String(room.phase || "");
  if (!["team", "speaking", "voting"].includes(phase)) return false;
  return Number(room.game.attempt || 0) === forcedRoundForRoom(room);
}

function getLatestMissionRecord(room) {
  if (!room || !room.game || !Array.isArray(room.game.missionHistory) || !room.game.missionHistory.length) return null;
  const latest = room.game.missionHistory.slice().sort((a, b) => Number(a.round || 0) - Number(b.round || 0)).pop();
  if (!latest) return null;
  const round = Number(latest.round || 0);
  const success = !!latest.success;
  const fails = Number(latest.fails || 0);
  return { key: `${round}-${success ? 1 : 0}-${fails}`, round, success, fails };
}

function buildMissionPills(room) {
  if (!room || !room.game) return [];
  const maxPlayers = Number(room.maxPlayers || 7);
  const meta = missionMetaByCount(maxPlayers);
  const map = {};
  (room.game.missionHistory || []).forEach((m) => { map[m.round] = m; });
  return meta.sizes.map((size, i) => {
    const round = i + 1;
    const rec = map[round] || null;
    const success = rec ? !!rec.success : null;
    const isPast = success !== null;
    const isCurrent = Number(room.game.round || 0) === round && room.phase !== "end";
    const isFuture = !isPast && !isCurrent;
    const isProtected = meta.fails[i] === 2;
    const cardCls = [
      isPast && success ? "mc-past mc-success" : "",
      isPast && !success ? "mc-past mc-fail" : "",
      isCurrent ? "mc-current" : "",
      isFuture ? "mc-future" : "",
    ].filter(Boolean).join(" ");
    return { round, size, failReq: meta.fails[i], success, isPast, isCurrent, isFuture, isProtected, cardCls };
  });
}

function formatRecapEntry(r) {
  if (!r) return null;
  const review = r.review || {};
  const sections = [];
  if (review.overview) sections.push({ label: "总体复盘", text: review.overview });
  if (Array.isArray(review.keyMoments) && review.keyMoments.length) {
    sections.push({
      label: "关键节点",
      text: review.keyMoments.map(m => `第${m.round}轮：${m.decision} → ${m.outcome}\n${m.assessment}`).join('\n\n'),
    });
  }
  if (Array.isArray(review.playerAnalysis) && review.playerAnalysis.length) {
    sections.push({ label: "读人分析", text: review.playerAnalysis.map(p => `${p.seat}号：${p.assessment}`).join('\n') });
  }
  if (review.speak && review.speak.summary) {
    const lines = [review.speak.summary];
    if (review.speak.bestMove) lines.push(`✓ ${review.speak.bestMove}`);
    if (review.speak.mistake) lines.push(`✗ ${review.speak.mistake}`);
    sections.push({ label: "发言复盘", text: lines.join('\n') });
  }
  if (review.vote && review.vote.summary) {
    const lines = [review.vote.summary];
    if (review.vote.keyVote) lines.push(`关键一票：${review.vote.keyVote}`);
    sections.push({ label: "投票复盘", text: lines.join('\n') });
  }
  if (review.mission && review.mission.summary) sections.push({ label: "任务复盘", text: review.mission.summary });
  if (review.nextGamePlan) sections.push({ label: "下局计划", text: review.nextGamePlan });
  return {
    nickname: r.nickname || "",
    seat: r.seat || 0,
    role: r.role || "",
    reason: "",
    think: r.think || "",
    showThink: false,
    knownInfo: r.knownInfo || "",
    sections,
  };
}

const AI_AVATAR_URLS = [
  "https://www.awalon.top/mp-assets/ai-avatars/ai-01-wizard.jpg?v=3",
  "https://www.awalon.top/mp-assets/ai-avatars/ai-02-knight.jpg?v=3",
  "https://www.awalon.top/mp-assets/ai-avatars/ai-03-assassin.jpg?v=3",
  "https://www.awalon.top/mp-assets/ai-avatars/ai-04-noble.jpg?v=3",
  "https://www.awalon.top/mp-assets/ai-avatars/ai-05-archer.jpg?v=3",
  "https://www.awalon.top/mp-assets/ai-avatars/ai-06-mage.jpg?v=3",
  "https://www.awalon.top/mp-assets/ai-avatars/ai-07-paladin.jpg?v=3",
  "https://www.awalon.top/mp-assets/ai-avatars/ai-08-witch.jpg?v=3",
  "https://www.awalon.top/mp-assets/ai-avatars/ai-09-guard.jpg?v=3",
  "https://www.awalon.top/mp-assets/ai-avatars/ai-10-oracle.jpg?v=3",
];

function avatarMeta(avatar, player) {
  const raw = String(avatar || "").trim();
  if (/^https?:\/\//i.test(raw)) {
    return { image: raw, text: "" };
  }
  if (player && player.isAI) {
    // Use seat index (0-based, server-assigned) for collision-free assignment
    const seat = Number.isFinite(player.seat) ? player.seat : 0;
    return { image: AI_AVATAR_URLS[seat % AI_AVATAR_URLS.length], text: "" };
  }
  return { image: "", text: raw || "🙂" };
}

function getSeatNo(room, playerId, snapshot) {
  if (!playerId) return null;
  const snapSeat = Number(snapshot && snapshot[playerId]);
  if (Number.isFinite(snapSeat) && snapSeat > 0) return snapSeat;
  const players = Array.isArray(room && room.players) ? room.players : [];
  const player = players.find((item) => item && item.id === playerId);
  if (player && Number.isFinite(player.seat)) return player.seat + 1;
  const seats = Array.isArray(room && room.seats) ? room.seats : [];
  const seatIndex = seats.findIndex((id) => id === playerId);
  return seatIndex >= 0 ? seatIndex + 1 : null;
}

function formatSeatList(room, ids, snapshot) {
  const seats = (Array.isArray(ids) ? ids : [])
    .map((id) => getSeatNo(room, id, snapshot))
    .filter((seat) => Number.isFinite(seat) && seat > 0)
    .sort((a, b) => a - b);
  return seats.length ? seats.join(",") : "-";
}

function getRevealedRoleLabel(room, pid) {
  if (!room || !room.game || !pid) return "";
  const full = room.game.revealedRoles || null;
  if (full && full[pid]) return full[pid];
  const evil = room.game.revealedEvil || null;
  if (evil && evil[pid]) return evil[pid];
  return "";
}

function buildCenterResult(room) {
  if (!room || !room.game) return { show: false, title: "", sub: "" };
  const winner = room.game.winner || "";
  if (!winner && room.phase !== "end") return { show: false, title: "", sub: "" };
  const title = winner === "good" ? "正义胜利" : winner === "evil" ? "邪恶胜利" : "对局结束";
  const ass = room.game.assassination || null;
  const sub = ass && ass.targetSeat ? `刺杀目标：${ass.targetSeat}号位` : "";
  return { show: true, title, sub };
}

function buildEndMedals(room, clientId) {
  if (!room || !room.game || !clientId) return [];
  const byPlayer = room.game.latestEarnedMedals || {};
  const list = Array.isArray(byPlayer[clientId]) ? byPlayer[clientId] : [];
  return decorateMedals(list);
}

function buildRoundSeats(seatSlots, maxPlayers) {
  const n = Math.max(5, Number(maxPlayers) || 7);
  return (seatSlots || []).map((s, idx) => {
    const angle = (2 * Math.PI * idx) / n - Math.PI / 2;
    const r = 43;
    const cx = 50;
    const cy = 50;
    const left = cx + r * Math.cos(angle);
    const top = cy + r * Math.sin(angle);
    return { ...s, leftStyle: `left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;` };
  });
}

function buildLadyHistory(room) {
  if (!room || !room.game || !room.game.ladyOfLake || !Array.isArray(room.game.ladyOfLake.history) || !Array.isArray(room.players)) return [];
  return room.game.ladyOfLake.history.map((item) => {
    const holder = room.players.find((p) => p.id === item.holderId);
    const target = room.players.find((p) => p.id === item.targetId);
    return {
      key: `${item.round || 0}-${item.holderId || ""}-${item.targetId || ""}`,
      round: item.round || 0,
      holderName: holder ? holder.nickname : "未知玩家",
      targetName: target ? target.nickname : "未知玩家"
    };
  });
}

function buildSpeakRoundKeys(room) {
  const map = room && room.game && room.game.speakHistory ? room.game.speakHistory : null;
  if (!map) return [];
  const keys = Object.keys(map);
  keys.sort((a, b) => {
    const [ar, aa] = String(a).split("-").map((v) => Number(v) || 0);
    const [br, ba] = String(b).split("-").map((v) => Number(v) || 0);
    if (ar !== br) return ar - br;
    return aa - ba;
  });
  return keys;
}

function summarizeRoomRoles(roles) {
  if (!Array.isArray(roles) || !roles.length) return "";
  const counts = new Map();
  const order = [];
  roles.forEach((role) => {
    const name = String(role || "").trim();
    if (!name) return;
    if (!counts.has(name)) order.push(name);
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return order
    .map((name) => {
      const count = counts.get(name) || 0;
      return count > 1 ? `${name}x${count}` : name;
    })
    .join("、");
}

function buildMissionRows(room) {
  if (!room || !room.game) return [];
  const voteHistory = Array.isArray(room.game.voteHistory) ? room.game.voteHistory.slice() : [];
  voteHistory.sort((a, b) => {
    const ar = Number(a && a.round ? a.round : 0);
    const br = Number(b && b.round ? b.round : 0);
    if (ar !== br) return br - ar;
    const aa = Number(a && a.attempt ? a.attempt : 0);
    const ba = Number(b && b.attempt ? b.attempt : 0);
    return ba - aa;
  });
  const missionHistory = Array.isArray(room.game.missionHistory) ? room.game.missionHistory : [];
  const missionByRound = {};
  missionHistory.forEach((m) => {
    const r = Number(m && m.round ? m.round : 0);
    if (r > 0) missionByRound[r] = m;
  });
  const phase = room.phase || "";
  const game = room.game || null;
  return voteHistory.map((v, idx) => {
    const mission = v && v.approved ? missionByRound[Number(v.round || 0)] || null : null;
    const snapshot = (v && v.seatSnapshot) || (mission && mission.seatSnapshot) || null;
    const leaderSeat = getSeatNo(room, v && v.leaderId, snapshot) || "-";
    const teamSeats = formatSeatList(room, v && v.team, snapshot);
    const approves = formatSeatList(
      room,
      Object.entries(v && v.votes ? v.votes : {}).filter(([, val]) => !!val).map(([id]) => id),
      snapshot
    );
    const rejects = formatSeatList(
      room,
      Object.entries(v && v.votes ? v.votes : {}).filter(([, val]) => !val).map(([id]) => id),
      snapshot
    );
    let resText = "";
    let resClass = "";
    let approved = !!(v && v.approved);
    if (mission) {
      const fails = mission.fails || 0;
      resText = mission.success ? (fails > 0 ? `✓ ${fails}` : "✓") : `✗ ${fails}`;
      resClass = mission.success ? "pill-ok" : "pill-ng";
    } else if (phase === "voting" && game && Number(game.round || 0) === Number(v.round || 0) && Number(game.attempt || 0) === Number(v.attempt || 0)) {
      resText = "···"; resClass = "pill-wait"; approved = true;
    } else if (phase === "mission" && game && Number(game.round || 0) === Number(v.round || 0) && Number(game.attempt || 0) === Number(v.attempt || 0)) {
      resText = "···"; resClass = "pill-wait"; approved = true;
    }
    const roundNum = Number(v.round || 0);
    const attemptNum = Number(v.attempt || 0);
    return {
      key: `${v.round || 0}-${v.attempt || idx + 1}`,
      isForcedRound: roundNum > 0 && attemptNum > 0 && attemptNum === forcedRoundForRoom(room),
      leader: `${leaderSeat}`,
      team: teamSeats || "-",
      approve: approves || "-",
      reject: rejects || "-",
      approved,
      resText,
      resClass
    };
  });
}

function buildLadyTargets(room) {
  if (!room || !room.game || !room.game.ladyOfLake || !Array.isArray(room.seats) || !Array.isArray(room.players)) return [];
  const lady = room.game.ladyOfLake;
  const previousHolders = new Set((lady.history || []).map((item) => item.holderId));
  if (lady.holderId) previousHolders.add(lady.holderId);
  return room.seats
    .map((pid, idx) => {
      if (!pid || pid === lady.holderId || previousHolders.has(pid)) return null;
      const player = room.players.find((it) => it.id === pid);
      if (!player) return null;
      const meta = avatarMeta(player.avatar || "🙂", player);
      return { id: pid, seat: idx + 1, nickname: player.nickname, avatarImage: meta.image, avatarText: meta.text || "🙂" };
    })
    .filter(Boolean);
}

function buildRoomConfig(room) {
  if (!room) return [];
  const forcedRound = forcedRoundForRoom(room);
  return [
    { label: "扩展", value: room.ladyOfLakeEnabled ? "湖中仙女" : "标准局" },
    { label: "邪恶互认", value: room.evilRoleVisibleEnabled ? "显示具体身份" : "仅显示队友座位" },
    { label: "强制轮", value: `第${forcedRound}次组队` },
    { label: "发言时长", value: `${room.speakingSeconds || 120}s` }
  ];
}

function buildRoomRoleCards(room) {
  const roles = room && Array.isArray(room.roles) ? room.roles : [];
  if (!roles.length) return [];
  const counts = new Map();
  roles.forEach((role) => {
    const name = String(role || "").trim();
    if (!name) return;
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => {
      const ai = ROLE_ORDER.indexOf(a[0]);
      const bi = ROLE_ORDER.indexOf(b[0]);
      if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
    .map(([role, count]) => ({
      role,
      count,
      image: roleImageFor(role),
      roleClass: roleClassFor(role),
      description: ROLE_DESCRIPTION_MAP[role] || "暂无角色说明"
    }));
}

function buildSeatSlots(room, selectedTeam, selectedAssassinate, roleVisibleSeats, clientId) {
  selectedTeam = selectedTeam || [];
  selectedAssassinate = selectedAssassinate || "";
  const rvs = roleVisibleSeats || [];
  const max = Number(room.maxPlayers || 0);
  const seats = Array.isArray(room.seats) ? room.seats : [];
  const players = Array.isArray(room.players) ? room.players : [];
  const idMap = {};
  rvs.forEach(vs => { idMap[vs.seat] = vs; });
  const game = room.game || null;
  const phase = room.phase || "";
  const leaderId = game ? game.leaderId : "";
  const isLeaderNow = !!(clientId && leaderId && clientId === leaderId);
  const assTargetId = game && game.assassination ? game.assassination.targetId : "";
  const out = [];
  for (let i = 0; i < max; i += 1) {
    const pid = seats[i] || null;
    const p = pid ? players.find((it) => it.id === pid) : null;
    const meta = p ? avatarMeta(p.avatar || "🙂", p) : { image: "", text: "" };
    let action = "";
    let actionDone = false;
    if (pid && game) {
      if (phase === "team" || phase === "speaking") {
        const tags = [];
        if (phase === "speaking" && room.speaking && room.seats[room.speaking.index] === pid) tags.push("发言中");
        action = tags.join(" · ");
      } else if (phase === "voting") {
        const voted = game.votes && game.votes[pid] !== undefined;
        action = voted ? "已投票" : "投票中";
        actionDone = !!voted;
      } else if (phase === "mission" && Array.isArray(game.team) && game.team.includes(pid)) {
        const done = game.missionVotes && game.missionVotes[pid] !== undefined;
        action = done ? "出征完毕" : "出征中";
        actionDone = !!done;
      }
    }
    const rl = getRevealedRoleLabel(room, pid);
    out.push({
      index: i,
      seat: i + 1,
      name: p ? p.nickname : "空位",
      playerId: pid,
      avatarImage: meta.image,
      avatarText: p ? (meta.text || "🙂") : "",
      offline: !!(p && p.offline),
      autoplay: !!(p && p.autoplay),
      isMe: !!(pid && pid === clientId),
      isLeader: !!(pid && pid === leaderId),
      isLadyHolder: !!(game && game.ladyOfLake && game.ladyOfLake.holderId === pid),
      selectedTeam: !!(
        pid &&
        ["team", "speaking", "voting", "mission"].includes(phase) &&
        ((phase === "team" || phase === "speaking")
          ? (isLeaderNow ? selectedTeam.includes(pid) : (Array.isArray(game.team) && game.team.includes(pid)))
          : (Array.isArray(game.team) && game.team.includes(pid)))
      ),
      selectedAssassinate: !!(pid && selectedAssassinate && selectedAssassinate === pid),
      isAssassinated: !!(pid && assTargetId && pid === assTargetId),
      roleLabel: rl,
      roleImage: roleImageFor(rl),
      roleClass: roleClassFor(rl),
      factionClass: (() => {
        if (!rl) return '';
        if (rl === '梅林') return 'rev-merlin';
        return EVIL_ROLES.has(rl) ? 'rev-evil' : 'rev-good';
      })(),
      action,
      actionDone,
      badgeType: (() => {
        if (p && p.autoplay) return 'autoplay';
        if (!action) return '';
        if (action.includes('发言中')) return 'speak';
        if (action === '投票中') return 'voting';
        if (action === '已投票') return 'voted';
        if (action === '出征中') return 'mission';
        if (action === '出征完毕') return 'mission-done';
        return '';
      })(),
      identityClass: idMap[i + 1] ? `id-${idMap[i + 1].identityFaction}` : 'id-unknown',
      identityLabel: idMap[i + 1] ? (idMap[i + 1].role || (idMap[i + 1].isSelf ? '' : '未知')) : '',
    });
  }
  return out;
}

function buildRoleVisibleSeats(info, room, clientId, myRole) {
  const visibleSeatNos = Array.isArray(info && info.seats) ? info.seats.map(Number) : [];
  const currentRole = String((info && info.role) || myRole || "");
  const isEvilViewer = EVIL_ROLES.has(currentRole);
  const visibleAreEvil = !!(info && info.visibleFaction === 'evil');
  const roleDetails = (info && info.roleDetails) ? info.roleDetails : {};
  if (!room || !Array.isArray(room.seats) || !Array.isArray(room.players)) return [];
  const mySeatIdx = room.seats.indexOf(clientId);
  const mySeatNo = mySeatIdx >= 0 ? mySeatIdx + 1 : null;
  const seatNosToShow = mySeatNo
    ? [mySeatNo, ...visibleSeatNos.filter(s => s !== mySeatNo)]
    : visibleSeatNos;
  return seatNosToShow
    .map((seatNo) => {
      const idx = Number(seatNo) - 1;
      if (idx < 0) return null;
      const pid = room.seats[idx];
      const p = room.players.find((it) => it.id === pid);
      const isSelf = pid === clientId;
      const role = isSelf ? currentRole : (pid && roleDetails[pid] ? roleDetails[pid] : "");
      const roleImage = role ? roleImageFor(role) : "";
      const isEvil = isSelf ? EVIL_ROLES.has(currentRole) : (role ? EVIL_ROLES.has(role) : (!isSelf && (isEvilViewer || visibleAreEvil)));
      const isKnown = isSelf || !!role || isEvilViewer || visibleAreEvil;
      const rowClass = isEvil ? "role-seat-row-evil" : isKnown ? "role-seat-row-good" : "role-seat-row-unknown";
      const roleClass = isEvil ? "role-seat-role-evil" : isSelf ? "role-seat-role-self" : "role-seat-role-other";
      const meta = avatarMeta(p && p.avatar ? p.avatar : "🙂", p);
      const identityFaction = isSelf
        ? (EVIL_ROLES.has(currentRole) ? 'evil' : 'good')
        : (isEvil ? 'evil' : 'good');
      return {
        seat: seatNo,
        nickname: p ? p.nickname : "未知",
        isSelf,
        role,
        roleImage,
        avatarImage: meta.image,
        avatarText: meta.text || "🙂",
        rowClass,
        roleClass,
        identityFaction,
      };
    })
    .filter(Boolean);
}

function buildPlayerCards(room, clientId) {
  if (!room || !Array.isArray(room.players)) return [];
  const seats = Array.isArray(room.seats) ? room.seats : [];
  const bySeat = {};
  seats.forEach((pid, idx) => { if (pid) bySeat[pid] = idx + 1; });
  const phase = room.phase || "";
  return room.players
    .map((p) => {
      const seat = Number.isFinite(p.seat) ? p.seat + 1 : bySeat[p.id] || 0;
      const role = getRevealedRoleLabel(room, p.id);
      const spectator = seat <= 0 || !!p.spectator;
      const offline = !!p.offline;
      let status = "准备中";
      let statusClass = "status-ready";
      if (offline) { status = "离线中"; statusClass = "status-offline"; }
      else if (spectator) { status = "观战中"; statusClass = "status-watch"; }
      else if (room.started && phase !== "end") { status = "正在游戏中"; statusClass = "status-playing"; }
      else if (room.started && phase === "end") { status = "已结束"; statusClass = "status-ended"; }
      const meta = avatarMeta(p.avatar || "🙂", p);
      return {
        id: p.id,
        seat,
        seatText: seat > 0 ? `${seat}号` : "观战",
        nickname: p.nickname,
        avatar: p.avatar || "🙂",
        avatarImage: meta.image,
        avatarText: meta.text,
        isHost: p.id === room.hostId,
        isMe: p.id === clientId,
        offline,
        spectator,
        status,
        statusClass,
        role,
        roleImage: roleImageFor(role),
        roleClass: roleClassFor(role),
      };
    })
    .sort((a, b) => {
      const sa = a.seat > 0 ? a.seat : 999;
      const sb = b.seat > 0 ? b.seat : 999;
      if (sa !== sb) return sa - sb;
      return a.nickname.localeCompare(b.nickname);
    });
}

function buildSpeakMessagesByRound(room, roundKey, clientId) {
  if (!room || !room.game || !room.game.speakHistory || !roundKey || !Array.isArray(room.players) || !Array.isArray(room.seats)) return [];
  const raw = Array.isArray(room.game.speakHistory[roundKey]) ? room.game.speakHistory[roundKey] : [];
  const byName = {};
  const byId = {};
  room.players.forEach((p) => { byName[p.nickname] = p; byId[p.id] = p; });
  return raw.map((m, idx) => {
    const p = (m && m.playerId && byId[m.playerId]) || byName[m.from];
    const seat = p ? room.seats.findIndex((id) => id === p.id) + 1 : 0;
    const mine = !!(p && p.id === clientId);
    const isAI = !!(p && p.isAI);
    const meta = avatarMeta((p && p.avatar) || "🙂", p);
    return {
      key: `${m.ts || 0}-${idx}`,
      from: m.from || "系统",
      text: m.text || "",
      seat: seat > 0 ? seat : "",
      avatarImage: meta.image,
      avatarText: meta.text || "🙂",
      isAI,
      mine,
      system: !p
    };
  });
}

function buildSpeakViewState(room, preferKey, clientId) {
  const keys = buildSpeakRoundKeys(room);
  let viewKey = preferKey || "";
  const latestKey = keys.length ? keys[keys.length - 1] : "";
  if (room && room.phase === "speaking") {
    viewKey = latestKey;
  } else if (!viewKey || !keys.includes(viewKey)) {
    viewKey = latestKey;
  }
  return {
    speakKeys: keys,
    speakRoundView: viewKey,
    speakRoundIdx: keys.indexOf(viewKey),
    speakMessages: buildSpeakMessagesByRound(room, viewKey, clientId)
  };
}

module.exports = {
  ROLE_IMAGE_MAP,
  EVIL_ROLES,
  MISSION_SIZES,
  MISSION_FAILS,
  ROLE_ORDER,
  ROLE_DESCRIPTION_MAP,
  roleImageFor,
  roleClassFor,
  missionMetaByCount,
  forcedRoundForRoom,
  isCurrentForcedAttempt,
  getLatestMissionRecord,
  buildMissionPills,
  formatRecapEntry,
  avatarMeta,
  getSeatNo,
  formatSeatList,
  getRevealedRoleLabel,
  buildCenterResult,
  buildEndMedals,
  buildRoundSeats,
  buildLadyHistory,
  buildSpeakRoundKeys,
  summarizeRoomRoles,
  buildMissionRows,
  buildLadyTargets,
  buildRoomConfig,
  buildRoomRoleCards,
  buildSeatSlots,
  buildRoleVisibleSeats,
  buildPlayerCards,
  buildSpeakMessagesByRound,
  buildSpeakViewState,
};
