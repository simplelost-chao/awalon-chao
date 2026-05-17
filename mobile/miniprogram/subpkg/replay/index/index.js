const socket = require("../../../utils/socket");
const { getSkin } = require("../../../skins");
const { buildRoundSeats } = require("../../../utils/gameUtils");

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
    skinTableUrl: "https://www.awalon.top/mp-assets/table.png",
    gameId: 0,
    loading: true,
    tablePlayers: [],
    replaySeats: [],
    steps: [],
    stepIndex: 0,
    currentStep: null,
    stepTotal: 0,
    stepProgress: "0/0"
  },

  onLoad: function (options) {
    var app = getApp();
    var nav = (app.globalData && app.globalData.nav) || {};
    var skinId = (app.globalData && app.globalData.skinId) || "dark-gold";

    this.setData({
      statusBarHeight: nav.statusBarHeight || 20,
      navBarHeight: nav.navBarHeight || 44,
      navTotalHeight: nav.navTotalHeight || 64,
      skinId: skinId,
      skinInGameBg: getSkin(skinId).inGameBg,
      gameId: Number(options && options.gameId) || 0
    });

    // Set up listener for history detail response
    app.globalData.historyDetailListener = function (msg) {
      this.onHistoryDetail(msg);
    }.bind(this);

    // Request game history detail
    var gameId = Number(options && options.gameId) || 0;
    if (gameId) {
      socket.send({
        type: "GET_GAME_HISTORY_DETAIL",
        payload: { gameId: gameId }
      });
    }
  },

  onUnload: function () {
    var app = getApp();
    if (app.globalData.historyDetailListener) {
      app.globalData.historyDetailListener = null;
    }
  },

  onHistoryDetail: function (msg) {
    if (!msg || !msg.detail) {
      this.setData({ loading: false });
      wx.showToast({ title: "记录不存在", icon: "none" });
      return;
    }

    var payload = msg.detail;
    console.log('[replay] ladyOfLake:', JSON.stringify(payload.ladyOfLake));
    var players = Array.isArray(payload.players) ? payload.players : [];
    var voteHistory = Array.isArray(payload.voteHistory) ? payload.voteHistory : [];
    var missionHistory = Array.isArray(payload.missionHistory) ? payload.missionHistory : [];

    var byId = {};
    players.forEach(function (p) { byId[p.id] = p; });

    var tablePlayers = this._buildTablePlayers(players);
    var steps = this._buildSteps(byId, voteHistory, missionHistory, payload);
    console.log('[replay] steps:', steps.length, steps.map(function(s) { return s.type + '(r' + (s.round||'') + ')'; }).join(', '));
    this._rawPlayers = players;
    this._byId = byId;
    this._maxPlayers = Number(payload.maxPlayers) || players.length;

    this.setData({
      loading: false,
      tablePlayers: tablePlayers,
      steps: steps,
      stepTotal: steps.length,
      stepIndex: 0
    });

    if (steps.length > 0) {
      this._applyStep(0);
    }
  },

  _buildTablePlayers: function (players) {
    var seated = players
      .filter(function (p) { return p.role !== "观战"; })
      .sort(function (a, b) { return (a.seat || 0) - (b.seat || 0); });

    var count = seated.length;

    return seated.map(function (p, idx) {
      var av = String(p.avatar || "");
      var isUrl = /^https?:\/\//i.test(av);
      var fallback = (p.isAI || !p.phone) ? "🤖" : String(p.nickname || "玩").charAt(0);
      var isEvil = EVIL_ROLES.has(p.role);
      var factionClass = p.role === "梅林" ? "merlin" : isEvil ? "evil" : "good";

      // Calculate circular position
      var angle = (2 * Math.PI * idx) / count - Math.PI / 2;
      var r = 38;
      var left = 50 + r * Math.cos(angle);
      var top = 50 + r * Math.sin(angle);
      var posStyle = "left:" + left.toFixed(1) + "%;top:" + top.toFixed(1) + "%;";

      return {
        seat: p.seat,
        id: p.id,
        nickname: p.nickname || "玩家",
        role: p.role || "",
        roleImage: ROLE_IMAGE_MAP[p.role] || "",
        faction: isEvil ? "evil" : "good",
        factionClass: factionClass,
        avatarImage: isUrl ? av : "",
        avatarText: isUrl ? "" : (av || fallback),
        posStyle: posStyle,
        isInTeam: false,
        isLeader: false,
        voteLabel: "",
        missionLabel: ""
      };
    });
  },

  _buildSteps: function (byId, voteHistory, missionHistory, payload) {
    var steps = [];

    var missionByRound = {};
    missionHistory.forEach(function (m) {
      missionByRound[Number(m.round || 0)] = m;
    });

    // Sort vote history by round ASC, then attempt ASC
    var sorted = voteHistory.slice().sort(function (a, b) {
      var ar = Number(a.round || 0);
      var br = Number(b.round || 0);
      if (ar !== br) return ar - br;
      return Number(a.attempt || 0) - Number(b.attempt || 0);
    });

    sorted.forEach(function (v) {
      var round = Number(v.round || 0);
      var attempt = Number(v.attempt || 0);
      var leader = byId[v.leaderId] || {};
      var leaderSeat = leader.seat || "?";
      var leaderName = leader.nickname || "未知";
      var leaderIsEvil = EVIL_ROLES.has(leader.role);
      var leaderFaction = leaderIsEvil ? "evil" : "good";

      // Build team members
      var teamMembers = (v.team || []).map(function (pid) {
        var p = byId[pid] || {};
        var isEvil = EVIL_ROLES.has(p.role);
        return {
          seat: p.seat || "?",
          id: pid,
          nickname: p.nickname || "未知",
          faction: isEvil ? "evil" : "good",
          factionClass: p.role === "梅林" ? "merlin" : isEvil ? "evil" : "good"
        };
      }).sort(function (a, b) { return Number(a.seat) - Number(b.seat); });

      // Team step
      steps.push({
        type: "team",
        round: round,
        attempt: attempt,
        leaderName: leaderName,
        leaderSeat: leaderSeat,
        leaderId: v.leaderId,
        leaderFaction: leaderFaction,
        teamMembers: teamMembers
      });

      // Vote step
      var approveCount = 0;
      var rejectCount = 0;
      var votes = Object.keys(v.votes || {}).map(function (pid) {
        var p = byId[pid] || {};
        var approved = !!(v.votes[pid]);
        if (approved) approveCount++; else rejectCount++;
        var isEvil = EVIL_ROLES.has(p.role);
        return {
          seat: p.seat || "?",
          id: pid,
          nickname: p.nickname || "未知",
          role: p.role || "",
          approved: approved,
          faction: isEvil ? "evil" : "good",
          factionClass: p.role === "梅林" ? "merlin" : isEvil ? "evil" : "good"
        };
      }).sort(function (a, b) { return Number(a.seat) - Number(b.seat); });

      steps.push({
        type: "vote",
        round: round,
        attempt: attempt,
        leaderId: v.leaderId,
        teamIds: v.team || [],
        votes: votes,
        approveCount: approveCount,
        rejectCount: rejectCount,
        passed: !!v.approved
      });

      // Mission step (if vote passed)
      if (v.approved) {
        var m = missionByRound[round];
        if (m) {
          var missionVotes = (v.team || []).map(function (pid) {
            var p = byId[pid] || {};
            var votedFail = !!(m.missionVotes && m.missionVotes[pid]);
            var isEvil = EVIL_ROLES.has(p.role);
            return {
              seat: p.seat || "?",
              id: pid,
              nickname: p.nickname || "未知",
              role: p.role || "",
              votedFail: votedFail,
              faction: isEvil ? "evil" : "good",
              factionClass: p.role === "梅林" ? "merlin" : isEvil ? "evil" : "good"
            };
          }).sort(function (a, b) { return Number(a.seat) - Number(b.seat); });

          steps.push({
            type: "mission",
            round: round,
            leaderId: v.leaderId,
            success: !!m.success,
            fails: m.fails || 0,
            votes: missionVotes,
            teamMembers: teamMembers
          });

          // 湖中仙女（该轮任务后验人）
          var ladyHistory = payload.ladyOfLake && Array.isArray(payload.ladyOfLake.history) ? payload.ladyOfLake.history : [];
          ladyHistory.forEach(function (lh) {
            if (Number(lh.round) === round) {
              var holder = byId[lh.holderId] || {};
              var ladyTarget = byId[lh.targetId] || {};
              steps.push({
                type: "lady",
                round: round,
                holderId: lh.holderId,
                holderName: (holder.seat || "?") + "号 " + (holder.nickname || "未知"),
                targetId: lh.targetId,
                targetName: (ladyTarget.seat || "?") + "号 " + (ladyTarget.nickname || "未知"),
                targetRole: ladyTarget.role || "",
                alignment: lh.alignment || "unknown"
              });
            }
          });
        }
      }
    });

    // Assassination step
    if (payload.assassination) {
      var assassin = byId[payload.assassination.assassinId] || {};
      var target = byId[payload.assassination.targetId] || {};
      steps.push({
        type: "assassination",
        assassinName: (assassin.seat || "?") + "号 " + (assassin.nickname || "刺客"),
        assassinId: payload.assassination.assassinId,
        targetName: (target.seat || "?") + "号 " + (target.nickname || "未知"),
        targetId: payload.assassination.targetId,
        targetRole: target.role || "",
        hit: !!payload.assassination.hit
      });
    }

    // End step
    steps.push({
      type: "end",
      winner: payload.winner || "",
      endReason: payload.endReason || ""
    });

    return steps;
  },

  _applyStep: function (index) {
    var steps = this.data.steps;
    if (index < 0 || index >= steps.length) return;

    var step = steps[index];
    var tablePlayers = this.data.tablePlayers.slice();

    // Reset all highlights
    for (var i = 0; i < tablePlayers.length; i++) {
      tablePlayers[i] = Object.assign({}, tablePlayers[i], {
        isInTeam: false,
        isLeader: false,
        isLadyHolder: false,
        isAssassinated: false,
        voteLabel: "",
        missionLabel: ""
      });
    }

    // Build seat-to-index lookup
    var seatIdx = {};
    tablePlayers.forEach(function (p, idx) {
      seatIdx[String(p.seat)] = idx;
      if (p.id) seatIdx["id_" + p.id] = idx;
    });

    // 队长标志始终显示（team/vote/mission 步骤都有 leaderId）
    if (step.leaderId) {
      var lKey = "id_" + step.leaderId;
      if (seatIdx[lKey] !== undefined) {
        tablePlayers[seatIdx[lKey]] = Object.assign({}, tablePlayers[seatIdx[lKey]], { isLeader: true });
      }
    }

    if (step.type === "team") {
      // Highlight leader
      var leaderKey = "id_" + step.leaderId;
      if (seatIdx[leaderKey] !== undefined) {
        tablePlayers[seatIdx[leaderKey]] = Object.assign({}, tablePlayers[seatIdx[leaderKey]], { isLeader: true });
      }
      // Highlight team members
      step.teamMembers.forEach(function (m) {
        var key = m.id ? "id_" + m.id : String(m.seat);
        if (seatIdx[key] !== undefined) {
          tablePlayers[seatIdx[key]] = Object.assign({}, tablePlayers[seatIdx[key]], { isInTeam: true });
        }
      });
    } else if (step.type === "vote") {
      // 高亮队伍成员
      (step.teamIds || []).forEach(function (pid) {
        var key = "id_" + pid;
        if (seatIdx[key] !== undefined) {
          tablePlayers[seatIdx[key]] = Object.assign({}, tablePlayers[seatIdx[key]], { isInTeam: true });
        }
      });
      // 显示投票结果
      step.votes.forEach(function (v) {
        var key = v.id ? "id_" + v.id : String(v.seat);
        if (seatIdx[key] !== undefined) {
          tablePlayers[seatIdx[key]] = Object.assign({}, tablePlayers[seatIdx[key]], {
            voteLabel: v.approved ? "赞成" : "反对"
          });
        }
      });
    } else if (step.type === "mission") {
      // Highlight team members and show mission labels
      step.votes.forEach(function (v) {
        var key = v.id ? "id_" + v.id : String(v.seat);
        if (seatIdx[key] !== undefined) {
          tablePlayers[seatIdx[key]] = Object.assign({}, tablePlayers[seatIdx[key]], {
            isInTeam: true,
            missionLabel: v.votedFail ? "失败" : "成功"
          });
        }
      });
    } else if (step.type === "lady") {
      // 湖女：持有者显示湖女标记，目标高亮
      if (step.holderId) {
        var hKey = "id_" + step.holderId;
        if (seatIdx[hKey] !== undefined) {
          tablePlayers[seatIdx[hKey]] = Object.assign({}, tablePlayers[seatIdx[hKey]], { isLadyHolder: true });
        }
      }
      if (step.targetId) {
        var ltKey = "id_" + step.targetId;
        if (seatIdx[ltKey] !== undefined) {
          tablePlayers[seatIdx[ltKey]] = Object.assign({}, tablePlayers[seatIdx[ltKey]], { isInTeam: true });
        }
      }
    } else if (step.type === "assassination") {
      // 被刺杀目标：显示 kill 效果（跟游戏中一样）
      if (step.targetId) {
        var tKey = "id_" + step.targetId;
        if (seatIdx[tKey] !== undefined) {
          tablePlayers[seatIdx[tKey]] = Object.assign({}, tablePlayers[seatIdx[tKey]], { isAssassinated: true });
        }
      }
    }

    // 构建 round-table seats
    var maxP = this._maxPlayers || tablePlayers.length;
    var seatSlots = [];
    for (var si = 0; si < maxP; si++) {
      var tp = tablePlayers[si];
      if (!tp) {
        seatSlots.push({ index: si, seat: si + 1, name: '空位', playerId: null, avatarImage: '', avatarText: '', offline: false, autoplay: false, isMe: false, isLeader: false, isLadyHolder: false, selectedTeam: false, selectedAssassinate: false, isAssassinated: false, roleLabel: '', roleImage: '', roleClass: '', identityClass: '', identityLabel: '', identityRoleImage: '', factionClass: '', action: '', actionDone: false, badgeType: '' });
        continue;
      }
      var revClass = tp.role === '梅林' ? 'rev-merlin' : (EVIL_ROLES.has(tp.role) ? 'rev-evil' : 'rev-good');
      var idClass = tp.role === '梅林' ? 'id-merlin' : (EVIL_ROLES.has(tp.role) ? 'id-evil' : 'id-good');
      var actionText = tp.voteLabel || tp.missionLabel || '';
      seatSlots.push({
        index: si,
        seat: tp.seat,
        name: tp.nickname,
        playerId: tp.id,
        avatarImage: tp.avatarImage,
        avatarText: tp.avatarText || '🐺',
        offline: false,
        autoplay: false,
        isMe: false,
        isLeader: tp.isLeader,
        isLadyHolder: !!tp.isLadyHolder,
        selectedTeam: tp.isInTeam,
        selectedAssassinate: false,
        isAssassinated: !!tp.isAssassinated,
        roleLabel: tp.role,
        roleImage: tp.roleImage,
        roleClass: revClass,
        identityClass: idClass,
        identityLabel: tp.role,
        identityRoleImage: tp.roleImage,
        factionClass: revClass,
        action: actionText === '赞成' ? '✓' : actionText === '反对' ? '✗' : actionText === '成功' ? '✓' : actionText === '失败' ? '✗' : actionText,
        actionDone: actionText === '赞成' || actionText === '成功',
        badgeType: '',
      });
    }

    this.setData({
      stepIndex: index,
      currentStep: step,
      stepProgress: (index + 1) + "/" + steps.length,
      tablePlayers: tablePlayers,
      replaySeats: buildRoundSeats(seatSlots, maxP)
    });
  },

  onPrevStep: function () {
    if (this.data.stepIndex > 0) {
      this._applyStep(this.data.stepIndex - 1);
    }
  },

  onNextStep: function () {
    if (this.data.stepIndex < this.data.stepTotal - 1) {
      this._applyStep(this.data.stepIndex + 1);
    }
  },

  onBackHome: function () {
    var pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.reLaunch({ url: "/pages/index/index" });
  }
});
