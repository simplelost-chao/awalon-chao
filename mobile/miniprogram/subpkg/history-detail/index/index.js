const { decorateMedals } = require("../../../utils/medals");
const { buildMissionPills } = require("../../../utils/gameUtils");

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
    skinId: 'dark-gold',
    gameId: 0,
    loading: true,
    historyDetail: null,
    myRoleImage: "",
    myNickname: "",
    myFactionClass: "ghc-good",
    myResultClass: "ghc-result-win",
    winnerText: "",
    winnerReason: "",
    winnerClass: "",
    assassinationText: "",
    assassinationResultClass: "",
    assassinationTargetText: "",
    assassinationTargetRole: "",
    assassinationTargetRoleImage: "",
    assassinName: "",
    assassinSeat: "",
    roundSeats: [],
    missionPills: [],
    missionRows: [],
    speakRows: [],
    speakPageIdx: 0,
    currentSpeakRow: null,
    recapRows: [],
    recapExpanded: {},
    recapGenerating: false,
    myVoteText: ""
  },

  onLoad(query) {
    const app = getApp();
    const nav = (app.globalData && app.globalData.nav) || {};
    this.setData({
      statusBarHeight: nav.statusBarHeight || 20,
      navBarHeight: nav.navBarHeight || 44,
      navTotalHeight: nav.navTotalHeight || 64,
      skinId: (app.globalData && app.globalData.skinId) || 'dark-gold',
      gameId: Number(query && query.gameId) || 0
    });
  },

  onShow() {
    const app = getApp();
    const expected = Number(this.data.gameId) || 0;

    app.globalData.historyDetailListener = (detail) => {
      if (!detail) {
        this.setData({ loading: false, historyDetail: null });
        wx.showToast({ title: '记录不存在', icon: 'none' });
        return;
      }
      // 如果复盘已经生成，清除持久化状态
      const rows = this.buildRecapRows(detail);
      if (rows.length > 0) {
        app.globalData.recapGeneratingGameId = null;
        this._stopRecapPolling();
        this.setData({ recapGenerating: false });
      }
      this.applyDetail(detail);
    };
    app.globalData.historyRecapGeneratingListener = () => {
      app.globalData.recapGeneratingGameId = expected;
      this.setData({ recapGenerating: true });
    };

    // 恢复生成中状态（切走再回来时），并重启轮询
    if (app.globalData.recapGeneratingGameId === expected) {
      this.setData({ recapGenerating: true });
      this._startRecapPolling(expected);
    }

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
    this._stopRecapPolling();
    const app = getApp();
    if (app.globalData.historyDetailListener) app.globalData.historyDetailListener = null;
    if (app.globalData.historyRecapGeneratingListener) app.globalData.historyRecapGeneratingListener = null;
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

  onRequestHistoryRecap() {
    const indexPage = getIndexPage();
    if (!indexPage || typeof indexPage.requestHistoryRecap !== 'function') {
      wx.showToast({ title: '请先打开游戏主页', icon: 'none' });
      return;
    }
    const gameId = Number(this.data.gameId);
    getApp().globalData.recapGeneratingGameId = gameId;
    this.setData({ recapGenerating: true });
    indexPage.requestHistoryRecap(gameId);
    this._startRecapPolling(gameId);
  },

  _startRecapPolling(gameId) {
    this._stopRecapPolling();
    const indexPage = getIndexPage();
    if (!indexPage) return;
    this._recapPollTimer = setInterval(() => {
      if (!this.data.recapGenerating) {
        this._stopRecapPolling();
        return;
      }
      indexPage.requestHistoryDetail(gameId);
    }, 5000);
    // 最长等 6 分钟
    this._recapPollStop = setTimeout(() => this._stopRecapPolling(), 360000);
  },

  _stopRecapPolling() {
    if (this._recapPollTimer) { clearInterval(this._recapPollTimer); this._recapPollTimer = null; }
    if (this._recapPollStop) { clearTimeout(this._recapPollStop); this._recapPollStop = null; }
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
    return EVIL_ROLES.has(role) ? "rev-evil" : "rev-good";
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
      if (!p) return { seat: i + 1, nickname: "空位", role: "", roleImage: "", roleClass: "", avatarImage: "", avatarText: "" };
      const av = String(p.avatar || "");
      const isUrl = /^https?:\/\//i.test(av);
      const fallback = (p.isAI || !p.phone) ? "🤖" : (String(p.nickname || "玩").charAt(0));
      return {
        seat: i + 1,
        nickname: p.nickname || "玩家",
        role: p.role || "",
        roleImage: this.roleImageFor(p.role),
        roleClass: this.roleClassFor(p.role),
        avatarImage: isUrl ? av : "",
        avatarText: isUrl ? "" : (av || fallback)
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
      const approved = !!v.approved;
      let resText = null;
      let resClass = '';
      if (!approved) {
        resText = null;
        resClass = '';
      } else if (mission) {
        const fails = mission.fails || 0;
        resText = mission.success ? (fails > 0 ? `✓ ${fails}` : '✓') : `✗ ${fails}`;
        resClass = mission.success ? 'pill-ok' : 'pill-ng';
      } else {
        resText = '···';
        resClass = 'pill-wait';
      }
      return {
        key: `${v.round || 0}-${v.attempt || idx + 1}`,
        round: `${v.round || 0}-${v.attempt || idx + 1}`,
        leader: `${leaderSeat}号`,
        team: team || "-",
        approve: approves || "-",
        reject: rejects || "-",
        approved,
        resText,
        resClass,
      };
    });
  },

  buildSpeakRows(detailObj) {
    const payload = detailObj && detailObj.detail ? detailObj.detail : {};
    const speakHistory = payload.speakHistory || {};
    const players = Array.isArray(payload.players) ? payload.players : [];
    const maxPlayers = Number(payload.maxPlayers || 7);
    const mySeat = detailObj && detailObj.mySeat ? Number(detailObj.mySeat) : 0;

    // 建立 id/nickname -> player 映射
    const byId = {}, byName = {};
    players.forEach(p => { byId[p.id] = p; byName[p.nickname || p.from || ''] = p; });

    const keys = Object.keys(speakHistory).sort((a, b) => {
      const [ar, aa] = a.split('-').map(Number);
      const [br, ba] = b.split('-').map(Number);
      return ar !== br ? ar - br : aa - ba;
    });
    return keys.map(key => {
      const messages = (speakHistory[key] || []).map((s, idx) => {
        const p = (s.playerId && byId[s.playerId]) || byName[s.from] || null;
        const seatRaw = p ? p.seat : null;
        const seat = seatRaw != null ? this.seatNoFromRaw(seatRaw, maxPlayers) : '';
        const mine = mySeat > 0 && Number(seat) === mySeat;
        const isAI = !!(p && (p.isAI || !p.phone));
        const av = String((p && p.avatar) || '');
        const isUrl = /^https?:\/\//i.test(av);
        const fallback = isAI ? '🤖' : (String(p && p.nickname || s.from || '玩').charAt(0));
        const text = s.text || s.msg || '';
        if (!text) return null;
        return {
          key: `${key}-${idx}`,
          from: s.from || (p && p.nickname) || '玩家',
          text,
          seat,
          avatarImage: isUrl ? av : '',
          avatarText: isUrl ? '' : (av || fallback),
          isAI,
          mine,
          system: !p,
        };
      }).filter(Boolean);
      return { key, label: `第 ${key.split('-')[0]} 轮 · 第 ${key.split('-')[1]} 次`, messages };
    }).filter(r => r.messages.length > 0);
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
        const sections = [];
        if (review.overview) sections.push({ label: '总体复盘', text: review.overview });
        if (Array.isArray(review.keyMoments) && review.keyMoments.length) {
          const text = review.keyMoments.map(m =>
            `第${m.round}轮：${m.decision} → ${m.outcome}\n${m.assessment}`
          ).join('\n\n');
          sections.push({ label: '关键节点', text });
        }
        if (Array.isArray(review.playerAnalysis) && review.playerAnalysis.length) {
          const text = review.playerAnalysis.map(p => `${p.seat}号：${p.assessment}`).join('\n');
          sections.push({ label: '读人分析', text });
        }
        if (review.speak && review.speak.summary) {
          const lines = [review.speak.summary];
          if (review.speak.bestMove) lines.push(`✓ ${review.speak.bestMove}`);
          if (review.speak.mistake) lines.push(`✗ ${review.speak.mistake}`);
          sections.push({ label: '发言复盘', text: lines.join('\n') });
        }
        if (review.vote && review.vote.summary) {
          const lines = [review.vote.summary];
          if (review.vote.keyVote) lines.push(`关键一票：${review.vote.keyVote}`);
          sections.push({ label: '投票复盘', text: lines.join('\n') });
        }
        if (review.mission && review.mission.summary) {
          sections.push({ label: '任务复盘', text: review.mission.summary });
        }
        if (review.nextGamePlan) sections.push({ label: '下局计划', text: review.nextGamePlan });
        return {
          key: r.playerId || String(seat),
          seat,
          role: r.role || '',
          nickname: (player && player.nickname) || r.nickname || `${seat}号`,
          sections,
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
    const winnerText = winner === "good" ? "正义胜利" : winner === "evil" ? "邪恶胜利" : "对局结束";
    const winnerClass = winner === "evil" ? "winner-evil" : "winner-good";
    const assassination = detail.detail && detail.detail.assassination ? detail.detail.assassination : null;
    const missionHistory = Array.isArray(detail.detail && detail.detail.missionHistory) ? detail.detail.missionHistory : [];
    const voteHistory = Array.isArray(detail.detail && detail.detail.voteHistory) ? detail.detail.voteHistory : [];
    const missionPills = buildMissionPills({
      maxPlayers: detail.detail.maxPlayers || 7,
      phase: 'end',
      game: { round: 999, missionHistory },
    });

    // 胜负原因
    let winnerReason = "";
    if (winner === "good") {
      if (assassination && !assassination.hit) {
        winnerReason = "刺客落空";
      } else {
        const successCount = missionHistory.filter(m => m.success).length;
        winnerReason = `${successCount} 轮任务成功`;
      }
    } else if (winner === "evil") {
      const endReason = detail.detail && detail.detail.endReason;
      if (assassination && assassination.hit) {
        winnerReason = "刺杀梅林";
      } else if (endReason === "force_round") {
        winnerReason = "强制轮发车失败";
      } else if (endReason === "rounds_exhausted") {
        winnerReason = "任务轮次已耗尽";
      } else {
        const failCount = missionHistory.filter(m => !m.success).length;
        winnerReason = failCount > 0 ? `${failCount} 轮任务失败` : "邪恶阵营胜利";
      }
    }

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
        ? "MVP"
        : myVote && myVote.voteType === "blame"
          ? "背锅侠"
          : myVote && myVote.voteType === "effort"
            ? "尽力位"
            : "";
    const myVoteTarget =
      myVote && detail.detail && Array.isArray(detail.detail.players)
        ? detail.detail.players.find((player) => player.id === myVote.targetId)
        : null;
    // 玩家昵称：从 players 里按座位找
    const players = (detail.detail && Array.isArray(detail.detail.players)) ? detail.detail.players : [];
    const maxP = Number((detail.detail && detail.detail.maxPlayers) || 7);
    const myPlayer = players.find(p => this.seatNoFromRaw(p.seat, maxP) === Number(detail.mySeat));
    const myNickname = (myPlayer && myPlayer.nickname) || "";

    // 阵营：控制头像光环 / 结果标签颜色
    const myFactionClass = detail.myResult === "spectator" ? "ghc-spec"
      : EVIL_ROLES.has(detail.myRole || "") ? "ghc-evil" : "ghc-good";
    // 结果：控制卡片背景 / 水印 / 装饰条颜色
    const myResultClass = detail.myResult === "spectator" ? "ghc-result-neutral"
      : detail.myResult === "win" ? "ghc-result-win" : "ghc-result-lose";

    const speakRows = this.buildSpeakRows(detail);
    const recapRows = this.buildRecapRows(detail);
    this.setData({
      historyDetail,
      myRoleImage: this.roleImageFor(detail.myRole || ""),
      myNickname,
      myFactionClass,
      myResultClass,
      winnerText,
      winnerReason,
      winnerClass,
      assassinationText,
      assassinationResultClass,
      assassinationTargetText,
      assassinationTargetRole,
      assassinationTargetRoleImage,
      assassinName,
      assassinSeat,
      roundSeats: this.buildRoundSeats(detail),
      missionPills,
      missionRows: this.buildMissionRows(detail),
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
