const socket = require("../../../utils/socket");
const { getSkin } = require("../../../skins");

const ROLE_IMAGE_MAP = {
  梅林: "https://www.awalon.top/mp-assets/role-split/merlin.png",
  派西维尔: "https://www.awalon.top/mp-assets/role-split/percival.png",
  忠臣: "https://www.awalon.top/mp-assets/role-split/arthur_loyal.png",
  "亚瑟的忠臣": "https://www.awalon.top/mp-assets/role-split/arthur_loyal.png",
  莫甘娜: "https://www.awalon.top/mp-assets/role-split/morgana.png",
  刺客: "https://www.awalon.top/mp-assets/role-split/assassin.png",
  莫德雷德: "https://www.awalon.top/mp-assets/role-split/mordred.png",
  奥伯伦: "https://www.awalon.top/mp-assets/role-split/oberon.png",
  爪牙: "https://www.awalon.top/mp-assets/role-split/minion.png",
  "兰斯洛特（邪恶）": "https://www.awalon.top/mp-assets/role-split/lancelot_evil.png",
  "兰斯洛特（正义）": "https://www.awalon.top/mp-assets/role-split/lancelot_good.png"
};

const EVIL_ROLES = new Set(["刺客", "莫甘娜", "莫德雷德", "奥伯伦", "爪牙", "兰斯洛特（邪恶）"]);

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    navTotalHeight: 64,
    skinId: "dark-gold",
    skinInGameBg: "https://www.awalon.top/mp-assets/in-game-bg-optimized.jpg",
    gameId: 0,
    loading: true,
    identityBar: [],
    rounds: [],
    endCard: null,
    currentRound: 0
  },

  onLoad(options) {
    const app = getApp();
    const nav = (app.globalData && app.globalData.nav) || {};
    const skinId = (app.globalData && app.globalData.skinId) || "dark-gold";

    this.setData({
      statusBarHeight: nav.statusBarHeight || 20,
      navBarHeight: nav.navBarHeight || 44,
      navTotalHeight: nav.navTotalHeight || 64,
      skinId: skinId,
      skinInGameBg: getSkin(skinId).inGameBg,
      gameId: Number(options && options.gameId) || 0
    });

    // Set up listener for history detail response
    app.globalData.historyDetailListener = (msg) => {
      this.onHistoryDetail(msg);
    };

    // Request game history detail
    const gameId = Number(options && options.gameId) || 0;
    if (gameId) {
      socket.send({
        type: "GET_GAME_HISTORY_DETAIL",
        payload: { gameId: gameId }
      });
    }
  },

  onUnload() {
    const app = getApp();
    if (app.globalData.historyDetailListener) {
      app.globalData.historyDetailListener = null;
    }
  },

  onHistoryDetail(msg) {
    if (!msg || !msg.detail) {
      this.setData({ loading: false });
      wx.showToast({ title: "记录不存在", icon: "none" });
      return;
    }

    const payload = msg.detail;
    const players = Array.isArray(payload.players) ? payload.players : [];
    const voteHistory = Array.isArray(payload.voteHistory) ? payload.voteHistory : [];
    const missionHistory = Array.isArray(payload.missionHistory) ? payload.missionHistory : [];

    const identityBar = this._buildIdentityBar(players);
    const rounds = this._buildRounds(players, voteHistory, missionHistory);
    const endCard = this._buildEndCard(payload, players);

    this.setData({
      loading: false,
      identityBar: identityBar,
      rounds: rounds,
      endCard: endCard,
      currentRound: 0
    });
  },

  _buildIdentityBar(players) {
    return players
      .filter(function(p) { return p.role !== "观战"; })
      .sort(function(a, b) { return (a.seat || 0) - (b.seat || 0); })
      .map(function(p) {
        var av = String(p.avatar || "");
        var isUrl = /^https?:\/\//i.test(av);
        var fallback = (p.isAI || !p.phone) ? "🤖" : String(p.nickname || "玩").charAt(0);
        var isEvil = EVIL_ROLES.has(p.role);
        var factionClass = p.role === "梅林" ? "merlin" : isEvil ? "evil" : "good";
        return {
          seat: p.seat,
          nickname: p.nickname || "玩家",
          role: p.role || "",
          roleImage: ROLE_IMAGE_MAP[p.role] || "",
          faction: isEvil ? "evil" : "good",
          factionClass: factionClass,
          avatarImage: isUrl ? av : "",
          avatarText: isUrl ? "" : (av || fallback)
        };
      });
  },

  _buildRounds(players, voteHistory, missionHistory) {
    var byId = {};
    players.forEach(function(p) { byId[p.id] = p; });

    var missionByRound = {};
    missionHistory.forEach(function(m) {
      missionByRound[Number(m.round || 0)] = m;
    });

    // Sort by round ASC, then attempt ASC
    var sorted = voteHistory.slice().sort(function(a, b) {
      var ar = Number(a.round || 0);
      var br = Number(b.round || 0);
      if (ar !== br) return ar - br;
      return Number(a.attempt || 0) - Number(b.attempt || 0);
    });

    return sorted.map(function(v, idx) {
      var round = Number(v.round || 0);
      var attempt = Number(v.attempt || 0);
      var leader = byId[v.leaderId] || {};
      var leaderSeat = leader.seat || "?";
      var leaderName = leader.nickname || "未知";

      // Build team
      var team = (v.team || []).map(function(pid) {
        var p = byId[pid] || {};
        var isEvil = EVIL_ROLES.has(p.role);
        return {
          seat: p.seat || "?",
          nickname: p.nickname || "未知",
          faction: isEvil ? "evil" : "good",
          factionClass: p.role === "梅林" ? "merlin" : isEvil ? "evil" : "good"
        };
      }).sort(function(a, b) { return Number(a.seat) - Number(b.seat); });

      // Build votes
      var approveCount = 0;
      var rejectCount = 0;
      var votes = Object.keys(v.votes || {}).map(function(pid) {
        var p = byId[pid] || {};
        var approved = !!(v.votes[pid]);
        if (approved) approveCount++; else rejectCount++;
        var isEvil = EVIL_ROLES.has(p.role);
        return {
          seat: p.seat || "?",
          nickname: p.nickname || "未知",
          role: p.role || "",
          approved: approved,
          faction: isEvil ? "evil" : "good",
          factionClass: p.role === "梅林" ? "merlin" : isEvil ? "evil" : "good"
        };
      }).sort(function(a, b) { return Number(a.seat) - Number(b.seat); });

      // Build mission if approved
      var mission = null;
      if (v.approved) {
        var m = missionByRound[round];
        if (m) {
          var missionVotes = (v.team || []).map(function(pid) {
            var p = byId[pid] || {};
            var votedFail = !!(m.missionVotes && m.missionVotes[pid]);
            var isEvil = EVIL_ROLES.has(p.role);
            return {
              seat: p.seat || "?",
              nickname: p.nickname || "未知",
              role: p.role || "",
              votedFail: votedFail,
              faction: isEvil ? "evil" : "good",
              factionClass: p.role === "梅林" ? "merlin" : isEvil ? "evil" : "good"
            };
          }).sort(function(a, b) { return Number(a.seat) - Number(b.seat); });

          mission = {
            success: !!m.success,
            fails: m.fails || 0,
            votes: missionVotes
          };
        }
      }

      return {
        key: round + "-" + attempt,
        round: round,
        attempt: attempt,
        leaderSeat: leaderSeat,
        leaderName: leaderName,
        team: team,
        votes: votes,
        approveCount: approveCount,
        rejectCount: rejectCount,
        approved: !!v.approved,
        mission: mission
      };
    });
  },

  _buildEndCard(payload, players) {
    var byId = {};
    players.forEach(function(p) { byId[p.id] = p; });

    var endCard = {
      winner: payload.winner || "",
      endReason: payload.endReason || ""
    };

    if (payload.assassination) {
      var assassin = byId[payload.assassination.assassinId] || {};
      var target = byId[payload.assassination.targetId] || {};
      endCard.assassination = {
        assassinName: (assassin.seat || "?") + "号 " + (assassin.nickname || "刺客"),
        targetName: (target.seat || "?") + "号 " + (target.nickname || "未知"),
        targetRole: target.role || "",
        hit: !!payload.assassination.hit
      };
    } else {
      endCard.assassination = null;
    }

    return endCard;
  },

  onSwiperChange(e) {
    this.setData({ currentRound: e.detail.current || 0 });
  },

  onBackHome() {
    var pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.reLaunch({ url: "/pages/index/index" });
  }
});
