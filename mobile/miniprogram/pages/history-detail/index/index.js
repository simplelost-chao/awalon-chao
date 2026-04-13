const { decorateMedals } = require("../../../utils/medals");

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

function getIndexPage() {
  const pages = getCurrentPages();
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    if (pages[i].route === "pages/index/index") return pages[i];
  }
  return null;
}

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    navTotalHeight: 64,
    gameId: 0,
    loading: true,
    historyDetail: null,
    myRoleImage: "",
    winnerText: "",
    winnerClass: "",
    assassinationText: "",
    assassinationResultClass: "",
    assassinationTargetText: "",
    assassinationTargetRole: "",
    assassinationTargetRoleImage: "",
    assassinName: "",
    assassinSeat: "",
    roundSeats: [],
    missionRows: [],
    peerVoteRows: [],
    speakRows: [],
    speakPageIdx: 0,
    currentSpeakRow: null,
    recapRows: [],
    recapExpanded: {},
    myVoteText: ""
  },

  onLoad(query) {
    const nav = (getApp().globalData && getApp().globalData.nav) || {};
    this.setData({
      statusBarHeight: nav.statusBarHeight || 20,
      navBarHeight: nav.navBarHeight || 44,
      navTotalHeight: nav.navTotalHeight || 64,
      gameId: Number(query && query.gameId) || 0
    });
  },

  onShow() {
    const app = getApp();
    app.globalData.historyDetailListener = (detail) => {
      this.applyDetail(detail);
    };

    const expected = Number(this.data.gameId) || 0;
    const latest = app.globalData.latestHistoryDetail;
    if (latest && Number(latest.gameId) === expected) {
      this.applyDetail(latest);
      return;
    }

    const indexPage = getIndexPage();
    if (indexPage && typeof indexPage.requestHistoryDetail === "function" && expected > 0) {
      indexPage.requestHistoryDetail(expected);
    }
  },

  onUnload() {
    const app = getApp();
    if (app.globalData.historyDetailListener) app.globalData.historyDetailListener = null;
  },

  onBackHome() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.reLaunch({ url: "/pages/index/index" });
  },

  onSpeakPrev() {
    const idx = Math.max(0, (this.data.speakPageIdx || 0) - 1);
    const rows = this.data.speakRows || [];
    this.setData({ speakPageIdx: idx, currentSpeakRow: rows[idx] || null });
  },

  onSpeakNext() {
    const rows = this.data.speakRows || [];
    const idx = Math.min(rows.length - 1, (this.data.speakPageIdx || 0) + 1);
    this.setData({ speakPageIdx: idx, currentSpeakRow: rows[idx] || null });
  },

  onToggleRecap(e) {
    const key = String(e.currentTarget.dataset.key);
    const expanded = Object.assign({}, this.data.recapExpanded);
    expanded[key] = !expanded[key];
    this.setData({ recapExpanded: expanded });
  },

  onTapMedal(e) {
    const name = String(e.currentTarget.dataset.name || "勋章");
    const description = String(e.currentTarget.dataset.description || "暂无说明");
    wx.showModal({
      title: name,
      content: description,
      showCancel: false,
      confirmText: "知道了"
    });
  },

  roleImageFor(role) {
    return ROLE_IMAGE_MAP[role] || "";
  },

  roleClassFor(role) {
    if (!role) return "";
    return EVIL_ROLES.has(role) ? "role-evil" : "role-good";
  },

  seatIndexFromRaw(rawSeat, maxPlayers) {
    const n = Number(rawSeat);
    if (!Number.isFinite(n)) return -1;
    if (n >= 1 && n <= maxPlayers) return n - 1;
    if (n >= 0 && n < maxPlayers) return n;
    return -1;
  },

  seatNoFromRaw(rawSeat, maxPlayers) {
    const idx = this.seatIndexFromRaw(rawSeat, maxPlayers);
    return idx >= 0 ? idx + 1 : 0;
  },

  buildRoundSeats(detailObj) {
    const payload = detailObj && detailObj.detail ? detailObj.detail : {};
    const maxPlayers = Number(payload.maxPlayers || 7) || 7;
    const players = Array.isArray(payload.players) ? payload.players : [];
    const seatsByIndex = Array.from({ length: maxPlayers }, () => null);
    players.forEach((p) => {
      const idx = this.seatIndexFromRaw(p && p.seat, maxPlayers);
      if (idx >= 0 && idx < maxPlayers && !seatsByIndex[idx]) {
        seatsByIndex[idx] = p;
      }
    });
    const mySeatIndex = this.seatIndexFromRaw(detailObj && detailObj.mySeat, maxPlayers);
    if (mySeatIndex >= 0 && mySeatIndex < maxPlayers && !seatsByIndex[mySeatIndex]) {
      seatsByIndex[mySeatIndex] = {
        seat: mySeatIndex + 1,
        nickname: "你",
        role: detailObj && detailObj.myRole ? detailObj.myRole : ""
      };
    }
    const bySeat = Array.from({ length: maxPlayers }, (_, i) => {
      const p = seatsByIndex[i];
      return p
        ? {
            seat: i + 1,
            nickname: p.nickname || "玩家",
            role: p.role || "",
            roleImage: this.roleImageFor(p.role),
            roleClass: this.roleClassFor(p.role)
          }
        : {
            seat: i + 1,
            nickname: "空位",
            role: "",
            roleImage: "",
            roleClass: ""
          };
    });

    const assassination = payload && payload.assassination ? payload.assassination : null;
    const assassinatedId = assassination && assassination.targetId ? assassination.targetId : "";
    const assassinId = assassination && assassination.assassinId ? assassination.assassinId : "";

    return bySeat.map((item, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(5, maxPlayers) - Math.PI / 2;
      const r = 39;
      const left = 50 + r * Math.cos(angle);
      const top = 50 + r * Math.sin(angle);
      const p = seatsByIndex[idx];
      return {
        ...item,
        isAssassinated: !!(p && assassinatedId && p.id === assassinatedId),
        isAssassin: !!(p && assassinId && p.id === assassinId),
        leftStyle: `left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;`
      };
    });
  },

  buildMissionRows(detailObj) {
    const payload = detailObj && detailObj.detail ? detailObj.detail : {};
    const maxPlayers = Number(payload.maxPlayers || 7) || 7;
    const players = Array.isArray(payload.players) ? payload.players : [];
    const byId = {};
    players.forEach((p) => {
      byId[p.id] = p;
    });
    const voteHistory = Array.isArray(payload.voteHistory) ? payload.voteHistory.slice() : [];
    const missionHistory = Array.isArray(payload.missionHistory) ? payload.missionHistory : [];
    const missionByRound = {};
    missionHistory.forEach((m) => {
      missionByRound[Number(m.round || 0)] = m;
    });

    voteHistory.sort((a, b) => {
      const ar = Number(a && a.round ? a.round : 0);
      const br = Number(b && b.round ? b.round : 0);
      if (ar !== br) return br - ar;
      const aa = Number(a && a.attempt ? a.attempt : 0);
      const ba = Number(b && b.attempt ? b.attempt : 0);
      return ba - aa;
    });

    return voteHistory.map((v, idx) => {
      const mission = v && v.approved ? missionByRound[Number(v.round || 0)] || null : null;
      const leader = byId[v.leaderId] || null;
      const leaderSeat = leader ? this.seatNoFromRaw(leader.seat, maxPlayers) || "?" : "?";
      const team = (v.team || [])
        .map((id) => (byId[id] ? this.seatNoFromRaw(byId[id].seat, maxPlayers) || "?" : "?"))
        .sort((a, b) => Number(a) - Number(b))
        .join(",");
      const approves = Object.entries(v.votes || {})
        .filter(([, val]) => !!val)
        .map(([id]) => (byId[id] ? this.seatNoFromRaw(byId[id].seat, maxPlayers) || "?" : "?"))
        .sort((a, b) => Number(a) - Number(b))
        .join(",");
      const rejects = Object.entries(v.votes || {})
        .filter(([, val]) => !val)
        .map(([id]) => (byId[id] ? this.seatNoFromRaw(byId[id].seat, maxPlayers) || "?" : "?"))
        .sort((a, b) => Number(a) - Number(b))
        .join(",");
      return {
        key: `${v.round || 0}-${v.attempt || idx + 1}`,
        round: `${v.round || 0}-${v.attempt || idx + 1}`,
        leader: `${leaderSeat}号`,
        team: team || "-",
        approve: approves || "-",
        reject: rejects || "-",
        result: mission ? (mission.success ? `成功(${mission.fails || 0})` : `失败(${mission.fails || 0})`) : (v.approved ? "未执行" : "未通过"),
        resClass: mission ? (mission.success ? "res-ok" : "res-fail") : "res-pending"
      };
    });
  },

  buildPeerVoteRows(detailObj) {
    const payload = detailObj && detailObj.detail ? detailObj.detail : {};
    const players = Array.isArray(payload.players) ? payload.players : [];
    const peerVotes = Array.isArray(detailObj && detailObj.peerVotes) ? detailObj.peerVotes : [];
    return players
      .map((player) => {
        const summary = { c_le: 0, blame: 0, effort: 0 };
        peerVotes.forEach((vote) => {
          if (!vote || vote.targetId !== player.id) return;
          if (summary[vote.voteType] !== undefined) summary[vote.voteType] += 1;
        });
        const parts = [];
        if (summary.c_le) parts.push(`C麻了 ${summary.c_le}`);
        if (summary.blame) parts.push(`背锅侠 ${summary.blame}`);
        if (summary.effort) parts.push(`尽力 ${summary.effort}`);
        return {
          id: player.id,
          seat: this.seatNoFromRaw(player.seat, Number(payload.maxPlayers || 7)) || "?",
          nickname: player.nickname || "玩家",
          summary: parts.join(" · ")
        };
      })
      .filter((item) => !!item.summary)
      .sort((a, b) => Number(a.seat) - Number(b.seat));
  },

  buildSpeakRows(detailObj) {
    const payload = detailObj && detailObj.detail ? detailObj.detail : {};
    const speakHistory = payload.speakHistory || {};
    const keys = Object.keys(speakHistory).sort((a, b) => {
      const [ar, aa] = a.split('-').map(Number);
      const [br, ba] = b.split('-').map(Number);
      return ar !== br ? ar - br : aa - ba;
    });
    return keys.map(key => ({
      key,
      label: `第 ${key.split('-')[0]} 轮 · 第 ${key.split('-')[1]} 次`,
      lines: (speakHistory[key] || []).map(s => ({
        nickname: s.nickname || s.from || '玩家',
        text: s.text || s.msg || ''
      })).filter(s => s.text)
    })).filter(r => r.lines.length > 0);
  },

  buildRecapRows(detailObj) {
    const payload = detailObj && detailObj.detail ? detailObj.detail : {};
    const recaps = Array.isArray(payload.recaps) ? payload.recaps : [];
    const players = Array.isArray(payload.players) ? payload.players : [];
    const maxPlayers = Number(payload.maxPlayers || 7);
    return recaps
      .filter(r => r && (r.review || r.overview))
      .map(r => {
        const review = r.review || {};
        const player = players.find(p => p.id === r.playerId);
        const seat = player ? this.seatNoFromRaw(player.seat, maxPlayers) : (r.seat || '?');
        return {
          key: r.playerId || String(seat),
          seat,
          role: r.role || '',
          nickname: (player && player.nickname) || r.nickname || `${seat}号`,
          overview: review.overview || r.overview || '',
          speakSummary: (review.speak && review.speak.summary) || '',
          nextPlan: review.nextGamePlan || ''
        };
      })
      .sort((a, b) => Number(a.seat) - Number(b.seat));
  },

  applyDetail(detail) {
    if (!detail || !detail.detail) return;
    const historyDetail = {
      ...detail,
      medals: decorateMedals(detail.medals)
    };
    const winner = (detail.detail && detail.detail.winner) || "";
    const winnerText = winner === "good" ? "好人胜利" : winner === "evil" ? "坏人胜利" : "对局结束";
    const winnerClass = winner === "evil" ? "winner-evil" : "winner-good";
    const assassination = detail.detail && detail.detail.assassination ? detail.detail.assassination : null;
    let assassinationText = "";
    let assassinationResultClass = "";
    let assassinationTargetText = "";
    let assassinationTargetRole = "";
    let assassinationTargetRoleImage = "";
    let assassinName = "";
    let assassinSeat = "";
    if (assassination) {
      const maxP = Number(detail.detail.maxPlayers || 7);
      const players = detail.detail.players || [];
      const targetPlayer = players.find((p) => p.id === assassination.targetId);
      const assassinPlayer = players.find((p) => p.id === assassination.assassinId);
      const seat = targetPlayer ? this.seatNoFromRaw(targetPlayer.seat, maxP) : 0;
      const targetName = targetPlayer && targetPlayer.nickname ? targetPlayer.nickname : "未知玩家";
      assassinationText = assassination.hit ? "刺杀命中" : "刺杀失败";
      assassinationTargetText = seat ? `${seat}号  ${targetName}` : targetName;
      assassinationResultClass = assassination.hit ? "assassination-hit" : "assassination-miss";
      assassinationTargetRole = (targetPlayer && targetPlayer.role) || "";
      assassinationTargetRoleImage = this.roleImageFor(assassinationTargetRole);
      if (assassinPlayer) {
        const aSeat = this.seatNoFromRaw(assassinPlayer.seat, maxP);
        assassinName = assassinPlayer.nickname || "刺客";
        assassinSeat = aSeat ? `${aSeat}号` : "";
      }
    }
    const myVote = detail.myVote || null;
    const myVoteLabel =
      myVote && myVote.voteType === "c_le"
        ? "C麻了"
        : myVote && myVote.voteType === "blame"
          ? "背锅侠"
          : myVote && myVote.voteType === "effort"
            ? "尽力位"
            : "";
    const myVoteTarget =
      myVote && detail.detail && Array.isArray(detail.detail.players)
        ? detail.detail.players.find((player) => player.id === myVote.targetId)
        : null;
    const speakRows = this.buildSpeakRows(detail);
    const recapRows = this.buildRecapRows(detail);
    this.setData({
      historyDetail,
      myRoleImage: this.roleImageFor(detail.myRole || ""),
      winnerText,
      winnerClass,
      assassinationText,
      assassinationResultClass,
      assassinationTargetText,
      assassinationTargetRole,
      assassinationTargetRoleImage,
      assassinName,
      assassinSeat,
      roundSeats: this.buildRoundSeats(detail),
      missionRows: this.buildMissionRows(detail),
      peerVoteRows: this.buildPeerVoteRows(detail),
      speakRows,
      speakPageIdx: 0,
      currentSpeakRow: speakRows[0] || null,
      recapRows,
      recapExpanded: {},
      myVoteText: myVoteLabel && myVoteTarget ? `你投给了 ${myVoteTarget.nickname}：${myVoteLabel}` : "",
      loading: false
    });
  }
});
