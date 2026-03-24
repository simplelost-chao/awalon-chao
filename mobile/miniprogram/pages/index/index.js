const socket = require("../../utils/socket");
const { decorateMedals } = require("../../utils/medals");

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
const ROLE_ORDER = ["梅林", "派西维尔", "忠臣", "兰斯洛特（正义）", "刺客", "莫甘娜", "莫德雷德", "奥伯伦", "爪牙", "兰斯洛特（邪恶）"];

Page({
  data: {
    connected: false,
    hasWelcomed: false,
    statusBarHeight: 20,
    navBarHeight: 44,
    navTotalHeight: 64,
    wsUrl: "",
    clientId: "",
    authToken: "",
    loggedIn: false,
    nickname: "",
    avatar: "🐺",
    avatarImage: "",
    avatarText: "🐺",
    roomCodeInput: "",
    atHome: true,
    maxPlayersOptions: ["5人", "6人", "7人", "8人", "9人", "10人"],
    maxPlayersIndex: 2,
    allRoleOptions: [],
    selectedRoles: [],
    hostRole: "随机",
    hostRoleOptions: [],
    ladyOfLakeEnabled: false,
    room: null,
    teamPhaseKey: "",
    seatSlots: [],
    roundSeats: [],
    roleInfo: null,
    showRolePanel: false,
    roleVisibleSeats: [],
    roleInfoImage: "",
    roleInfoClass: "",
    roleRequested: false,
    myRole: "",
    selectedTeam: [],
    teamConfirmed: false,
    leaderActionText: "提交队伍",
    leaderActionDisabled: true,
    teamCandidates: [],
    currentVoteTeam: [],
    selectedAssassinate: "",
    speakText: "",
    speakingSeat: 0,
    speakingRemainingSec: 0,
    speakingTotalSec: 180,
    speakingProgress: 0,
    isMyTurn: false,
    speakMessages: [],
    speakKeys: [],
    speakRoundView: "",
    showSpeakPanel: true,
    showPlayerList: false,
    cheatPressingPlayerId: "",
    cheatPendingPlayerId: "",
    cheatRevealPlayerId: "",
    cheatRoles: {},
    gameTip: "开始游戏后，这里会显示阶段控制。",
    phase: "",
    isHost: false,
    isLeader: false,
    leaderSeat: 0,
    teamSize: 0,
    myVoted: false,
    inTeam: false,
    myMissionDone: false,
    isAssassin: false,
    isLadyHolder: false,
    ladyHolderName: "",
    ladyHistory: [],
    ladyTargets: [],
    roomConfigLines: [],
    playerCards: [],
    historyPage: 1,
    historyList: [],
    historyDetail: null,
    roleStats: null,
    missionRows: [],
    missionPills: [],
    missionAnimBootstrapped: false,
    missionAnimRoomCode: "",
    missionAnimLastKey: "",
    showMissionAnim: false,
    missionAnimText: "",
    missionAnimRound: 0,
    missionAnimClass: "",
    missionAnimImage: "",
    showCenterResult: false,
    centerResultText: "",
    centerResultSub: "",
    endMedals: [],
    loginTip: "请先登录，再做后续房间功能迁移。",
    roomTip: "登录后可创建或加入房间。"
  },

  onLoad() {
    const app = getApp();
    const wsUrl = app.globalData.wsUrl;
    const nav = app.globalData.nav || {};
    const token = wx.getStorageSync("awalonAuthToken") || "";
    const nickname = wx.getStorageSync("awalonNickname") || "";
    const avatar = wx.getStorageSync("awalonAvatar") || "🐺";
    const avatarMeta = this.avatarMeta(avatar);
    this.setData({
      wsUrl,
      authToken: token,
      nickname: nickname || "",
      avatar,
      avatarImage: avatarMeta.image,
      avatarText: avatarMeta.text,
      statusBarHeight: nav.statusBarHeight || 20,
      navBarHeight: nav.navBarHeight || 44,
      navTotalHeight: nav.navTotalHeight || 64,
      allRoleOptions: ROLE_ORDER.map((role) => ({
        role,
        image: this.roleImageFor(role)
      })),
      selectedRoles: this.defaultRolesForCount(7),
      hostRoleOptions: this.withRoleImages(this.uniqueRoles(this.defaultRolesForCount(7)))
    });
    this.connect(wsUrl);
    this._speakTicker = setInterval(() => {
      if (this.data.room && this.data.phase === "speaking") {
        this.refreshSpeakingProgress(this.data.room);
      }
    }, 1000);
  },

  onShow() {
    if (!this.data.wsUrl) return;
    if (!this.data.connected) {
      this.connect(this.data.wsUrl);
      return;
    }
    this.requestRoomRecovery();
  },

  onUnload() {
    if (this._missionAnimTimer) {
      clearTimeout(this._missionAnimTimer);
      this._missionAnimTimer = null;
    }
    if (this._speakTicker) {
      clearInterval(this._speakTicker);
      this._speakTicker = null;
    }
    if (this._cheatReqTimer) {
      clearTimeout(this._cheatReqTimer);
      this._cheatReqTimer = null;
    }
  },

  connect(url) {
    socket.connect(url, {
      onOpen: () => {
        this.setData({ connected: true });
        const token = this.data.authToken;
        if (token) {
          socket.send({ type: "AUTH", payload: { token } });
        }
      },
      onClose: () => {
        this.setData({ connected: false });
      },
      onError: () => {
        this.setData({ connected: false });
      },
      onMessage: (raw) => {
        let msg = null;
        try {
          msg = JSON.parse(raw);
        } catch (e) {}
        if (!msg) return;
        if (msg.type === "WELCOME") {
          if (msg.clientId) this.setData({ clientId: msg.clientId });
          if (!this.data.hasWelcomed) {
            this.setData({ hasWelcomed: true });
            wx.showToast({ title: "连接成功", icon: "success", duration: 800 });
          }
          return;
        }
        if (msg.type === "LOGIN_OK" || msg.type === "AUTH_OK") {
          const token = (msg.data && msg.data.token) || "";
          const user = (msg.data && msg.data.user) || {};
          const recovered = !!(msg.data && msg.data.recovered);
          const nick = user.nickname || this.data.nickname;
          const avatar = user.avatar || this.data.avatar || "🐺";
          const avatarMeta = this.avatarMeta(avatar);
          const isManualLogin = msg.type === "LOGIN_OK";
          this.setData({
            authToken: token || this.data.authToken,
            loggedIn: true,
            nickname: nick,
            avatar,
            avatarImage: avatarMeta.image,
            avatarText: avatarMeta.text,
            loginTip: isManualLogin
              ? `登录成功：${user.phone || ""}（${nick}）`
              : `已恢复登录：${user.phone || ""}（${nick}）`
          });
          if (token) wx.setStorageSync("awalonAuthToken", token);
          if (nick) wx.setStorageSync("awalonNickname", nick);
          wx.setStorageSync("awalonAvatar", avatar);
          if (isManualLogin) {
            wx.showToast({ title: "登录成功", icon: "success" });
          }
          if (!recovered) {
            this.requestRoomRecovery();
          }
          return;
        }
        if (msg.type === "ROOM_STATE" && msg.room) {
          const room = msg.room;
          const currentPhase = room.phase || "";
          const nextTeamPhaseKey =
            room && room.game && Number(room.game.round) && Number(room.game.attempt)
              ? `${room.game.round}-${room.game.attempt}`
              : "";
          const shouldResetTeam = !!(nextTeamPhaseKey && nextTeamPhaseKey !== this.data.teamPhaseKey);
          let selectedTeam = shouldResetTeam
            ? []
            : this.keepValidSelectedTeam(room, this.data.selectedTeam || []);
          const serverTeam = room && room.game && Array.isArray(room.game.team) ? this.keepValidSelectedTeam(room, room.game.team) : [];
          const isLeaderNow = !!(room && room.game && room.game.leaderId === this.data.clientId);
          if (isLeaderNow && (currentPhase === "team" || currentPhase === "speaking")) {
            // Leader keeps local draft during team/speaking; initialize from server only when entering a new round.
            if (shouldResetTeam) {
              selectedTeam = serverTeam;
            } else if (!selectedTeam.length && serverTeam.length) {
              selectedTeam = serverTeam;
            }
          } else if (serverTeam.length) {
            // Non-leader follows committed team from server.
            selectedTeam = serverTeam;
          }
          const teamSize = Number(room && room.game && room.game.teamSize ? room.game.teamSize : 0);
          const teamConfirmed =
            !!(isLeaderNow && currentPhase === "speaking" && serverTeam.length === teamSize && this.sameTeam(selectedTeam, serverTeam));
          const leaderAction = this.deriveLeaderAction(currentPhase, teamSize, selectedTeam, teamConfirmed);
          const selectedAssassinate =
            currentPhase === "assassination" && !(room.game && room.game.assassination)
              ? this.keepValidTarget(room, this.data.selectedAssassinate)
              : "";
          const seatSlots = this.buildSeatSlots(room, selectedTeam, selectedAssassinate);
          this.setData({
            room,
            ladyOfLakeEnabled: !!room.ladyOfLakeEnabled,
            teamPhaseKey: nextTeamPhaseKey || this.data.teamPhaseKey,
            selectedTeam,
            teamConfirmed,
            ...leaderAction,
            selectedAssassinate,
            seatSlots,
            roundSeats: this.buildRoundSeats(seatSlots, room.maxPlayers || 7),
            teamCandidates: this.buildTeamCandidates(room, selectedTeam),
            playerCards: this.buildPlayerCards(room),
            ...this.buildSpeakViewState(room, this.data.speakRoundView),
            roomTip: `已进入房间 ${room.code}`
          });
          this.refreshGameState(room);
          this.maybeShowMissionResultAnim(room);
          this.maybeShowPhasePrompt(room);
          return;
        }
        if (msg.type === "RECOVERED" && msg.data && msg.data.playerId) {
          const nextId = msg.data.playerId;
          this.setData({ clientId: nextId }, () => {
            const room = this.data.room;
            if (!room) return;
            const selectedTeam = this.keepValidSelectedTeam(room, this.data.selectedTeam || []);
            const selectedAssassinate = this.keepValidTarget(room, this.data.selectedAssassinate);
            const seatSlots = this.buildSeatSlots(room, selectedTeam, selectedAssassinate);
            this.setData({
              seatSlots,
              roundSeats: this.buildRoundSeats(seatSlots, room.maxPlayers || 7),
              roomTip: `已恢复房间 ${room.code}，可从首页重新进入`
            });
            this.refreshGameState(room);
          });
          return;
        }
        if (msg.type === "OK") {
          return;
        }
        if (msg.type === "GAME_HISTORY_LIST") {
          const data = msg.data || {};
          const list = Array.isArray(data.list) ? data.list : [];
          const page = Math.floor((Number(data.offset || 0) || 0) / Math.max(1, Number(data.limit || 10) || 10)) + 1;
          this.setData({
            historyList: list,
            historyPage: page
          });
          const app = getApp();
          app.globalData.latestHistoryList = { list, page, limit: Number(data.limit || 10) || 10, offset: Number(data.offset || 0) || 0 };
          if (typeof app.globalData.historyListListener === "function") {
            app.globalData.historyListListener(app.globalData.latestHistoryList);
          }
          return;
        }
        if (msg.type === "GAME_HISTORY_DETAIL") {
          const detail = msg.data || null;
          this.setData({ historyDetail: detail });
          const app = getApp();
          app.globalData.latestHistoryDetail = detail;
          if (typeof app.globalData.historyDetailListener === "function") {
            app.globalData.historyDetailListener(detail);
          }
          return;
        }
        if (msg.type === "ROLE_STATS") {
          const stats = msg.data || null;
          this.setData({ roleStats: stats });
          const app = getApp();
          app.globalData.latestRoleStats = stats;
          if (typeof app.globalData.roleStatsListener === "function") {
            app.globalData.roleStatsListener(stats);
          }
          return;
        }
        if (msg.type === "ROLE_INFO") {
          const info = (msg.data || {});
          const roleVisibleSeats = this.buildRoleVisibleSeats(info);
          this.setData({
            roleInfo: info,
            roleVisibleSeats,
            showRolePanel: this.data.showRolePanel,
            roleInfoImage: this.roleImageFor(info.role),
            roleInfoClass: this.roleClassFor(info.role),
            myRole: info.role || this.data.myRole,
            isAssassin: (info.role || this.data.myRole) === "刺客",
            gameTip: `身份：${info.role || "未知"}`
          });
          return;
        }
        if (msg.type === "LADY_OF_LAKE_RESULT") {
          const data = msg.data || {};
          const targetName = data.targetNickname || "未知玩家";
          const alignment = data.alignment === "evil" ? "坏人" : "好人";
          wx.showModal({
            title: "验人结果",
            content: `${targetName} 的阵营是：${alignment}`,
            showCancel: false,
            confirmText: "知道了"
          });
          return;
        }
        if (msg.type === "CHEAT_REVEAL_ROLE") {
          const data = msg.data || {};
          const pid = data.playerId || "";
          const role = data.role || "";
          if (pid && role) {
            const cheatRoles = { ...(this.data.cheatRoles || {}), [pid]: role };
            const nextState = {
              cheatRoles,
              cheatPendingPlayerId: this.data.cheatPendingPlayerId === pid ? "" : this.data.cheatPendingPlayerId
            };
            if (this.data.cheatPressingPlayerId === pid) {
              nextState.cheatRevealPlayerId = pid;
            }
            this.setData(nextState);
            if (this._cheatReqTimer) {
              clearTimeout(this._cheatReqTimer);
              this._cheatReqTimer = null;
            }
          }
          return;
        }
        if (msg.type === "ERROR") {
          const code = msg.code || (msg.data && msg.data.code) || "UNKNOWN_ERROR";
          const tip = `服务端错误：${code}`;
          const pendingId = this.data.cheatPendingPlayerId;
          if (pendingId) {
            this.setData({ cheatPendingPlayerId: "", cheatRevealPlayerId: "" });
            if (this._cheatReqTimer) {
              clearTimeout(this._cheatReqTimer);
              this._cheatReqTimer = null;
            }
            return;
          }
          this.setData({ loginTip: tip, roomTip: tip });
          if (code === "NOT_YOUR_TURN" || code === "NOT_SPEAKING_PHASE" || code === "ROOM_FULL") {
            this.requestRoomRecovery();
          }
          wx.showToast({ title: code, icon: "none", duration: 1500 });
        }
      }
    });
  },

  requestRoomRecovery() {
    const room = this.data.room;
    const roomCode = room && room.code ? String(room.code).trim() : "";
    if (!roomCode || !this.data.loggedIn || !this.data.connected) return;
    this.send("JOIN_ROOM", { roomCode, avatar: this.data.avatar || "🐺" });
  },

  keepValidSelectedTeam(room, selectedTeam) {
    if (!room || !room.game || !Array.isArray(room.players)) return [];
    const ids = new Set((room.players || []).map((p) => p.id));
    return (selectedTeam || []).filter((id) => ids.has(id));
  },

  keepValidTarget(room, targetId) {
    if (!room || !room.game || !targetId) return "";
    const ids = new Set((room.players || []).map((p) => p.id));
    return ids.has(targetId) ? targetId : "";
  },

  sameTeam(a = [], b = []) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    for (let i = 0; i < sa.length; i += 1) {
      if (sa[i] !== sb[i]) return false;
    }
    return true;
  },

  deriveLeaderAction(phase, teamSize, selectedTeam, teamConfirmed) {
    const selectedCount = (selectedTeam || []).length;
    if (selectedCount !== teamSize) {
      return {
        leaderActionText: `选择队员 ${selectedCount}/${teamSize}`,
        leaderActionDisabled: true
      };
    }
    if (phase === "team") {
      return {
        leaderActionText: "提交队伍",
        leaderActionDisabled: false
      };
    }
    if (phase === "speaking") {
      return {
        leaderActionText: teamConfirmed ? "发起队伍投票" : "提交队伍",
        leaderActionDisabled: false
      };
    }
    return {
      leaderActionText: `选择队员 ${selectedCount}/${teamSize}`,
      leaderActionDisabled: true
    };
  },

  refreshGameState(roomArg) {
    const room = roomArg || this.data.room;
    const clientId = this.data.clientId;
    const game = room && room.game ? room.game : null;
    const phase = room && room.phase ? room.phase : "";
    const isHost = !!(room && room.hostId === clientId);
    const isLeader = !!(game && game.leaderId === clientId);
    const leaderSeat = room && game && Array.isArray(room.seats) ? room.seats.findIndex((id) => id === game.leaderId) + 1 : 0;
    const teamSize = Number(game && game.teamSize ? game.teamSize : 0);
    const myVoted = !!(game && game.votes && game.votes[clientId] !== undefined);
    const inTeam = !!(game && Array.isArray(game.team) && game.team.includes(clientId));
    const myMissionDone = !!(game && game.missionVotes && game.missionVotes[clientId] !== undefined);
    const currentRole = (this.data.roleInfo && this.data.roleInfo.role) || this.data.myRole || "";
    const isAssassin = currentRole === "刺客";
    const missionRows = this.buildMissionRows(room);
    const missionPills = this.buildMissionPills(room);
    const resultInfo = this.buildCenterResult(room);
    const endMedals = this.buildEndMedals(room, clientId);
    const lady = game && game.ladyOfLake ? game.ladyOfLake : null;
    const ladyHolder = lady && Array.isArray(room.players) ? room.players.find((p) => p.id === lady.holderId) : null;
    const ladySeat = ladyHolder && Array.isArray(room.seats) ? room.seats.findIndex((id) => id === ladyHolder.id) + 1 : 0;
    const isLadyHolder = !!(phase === "lady" && lady && lady.holderId === clientId);
    const ladyTargets = this.buildLadyTargets(room);
    const ladyHistory = this.buildLadyHistory(room);
    const speakingSeat = room && room.speaking ? Number(room.speaking.index || 0) + 1 : 0;
    const speakingPlayerId = room && room.speaking && Array.isArray(room.seats) ? room.seats[room.speaking.index] : "";
    const isMyTurn = !!(phase === "speaking" && speakingPlayerId && speakingPlayerId === clientId);
    const speakingTotalSec = Number(room && room.speakingSeconds ? room.speakingSeconds : 180) || 180;
    let speakingRemainingSec = 0;
    if (phase === "speaking" && room && room.speaking && room.speaking.endAt) {
      speakingRemainingSec = Math.max(0, Math.floor((Number(room.speaking.endAt) - Date.now()) / 1000));
    }
    const speakingProgress = phase === "speaking" ? Math.max(0, Math.min(100, Math.floor((speakingRemainingSec / Math.max(1, speakingTotalSec)) * 100))) : 0;
    const selectedTeam = this.data.selectedTeam || [];
    const serverTeam = game && Array.isArray(game.team) ? this.keepValidSelectedTeam(room, game.team) : [];
    const teamConfirmed = !!(isLeader && phase === "speaking" && serverTeam.length === teamSize && this.sameTeam(selectedTeam, serverTeam));
    const leaderAction = this.deriveLeaderAction(phase, teamSize, selectedTeam, teamConfirmed);

    const speakView = this.buildSpeakViewState(room, this.data.speakRoundView);
    this.setData({
      phase,
      isHost,
      isLeader,
      leaderSeat,
      teamSize,
      myVoted,
      inTeam,
      myMissionDone,
      isAssassin,
      isLadyHolder,
      ladyHolderName: ladyHolder ? `${ladySeat}号 · ${ladyHolder.nickname}` : "",
      ladyTargets,
      ladyHistory,
      missionRows,
      missionPills,
      showCenterResult: resultInfo.show,
      centerResultText: resultInfo.title,
      centerResultSub: resultInfo.sub,
      endMedals,
      speakingSeat,
      speakingRemainingSec,
      speakingTotalSec,
      speakingProgress,
      isMyTurn,
      teamConfirmed,
      ...leaderAction,
      teamCandidates: this.buildTeamCandidates(room, selectedTeam),
      currentVoteTeam: this.buildCurrentVoteTeam(room),
      roomConfigLines: this.buildRoomConfig(room, leaderSeat),
      playerCards: this.buildPlayerCards(room),
      ...speakView
    });

    if (room && room.started && !currentRole && !this.data.roleRequested) {
      this.setData({ roleRequested: true });
      this.send("VIEW_ROLE");
    }
  },

  refreshSpeakingProgress(roomArg) {
    const room = roomArg || this.data.room;
    if (!room || room.phase !== "speaking" || !room.speaking || !room.speaking.endAt) {
      this.setData({ speakingRemainingSec: 0, speakingProgress: 0 });
      return;
    }
    const total = Number(room.speakingSeconds || this.data.speakingTotalSec || 180) || 180;
    const remaining = Math.max(0, Math.floor((Number(room.speaking.endAt) - Date.now()) / 1000));
    const progress = Math.max(0, Math.min(100, Math.floor((remaining / Math.max(1, total)) * 100)));
    this.setData({
      speakingRemainingSec: remaining,
      speakingTotalSec: total,
      speakingProgress: progress
    });
  },

  getLatestMissionRecord(room) {
    if (!room || !room.game || !Array.isArray(room.game.missionHistory) || !room.game.missionHistory.length) return null;
    const latest = room.game.missionHistory
      .slice()
      .sort((a, b) => Number(a.round || 0) - Number(b.round || 0))
      .pop();
    if (!latest) return null;
    const round = Number(latest.round || 0);
    const success = !!latest.success;
    const fails = Number(latest.fails || 0);
    return {
      key: `${round}-${success ? 1 : 0}-${fails}`,
      round,
      success
    };
  },

  maybeShowMissionResultAnim(room) {
    const roomCode = room && room.code ? room.code : "";
    const latest = this.getLatestMissionRecord(room);
    const latestKey = latest ? latest.key : "";

    if (!this.data.missionAnimBootstrapped || this.data.missionAnimRoomCode !== roomCode) {
      this.setData({
        missionAnimBootstrapped: true,
        missionAnimRoomCode: roomCode,
        missionAnimLastKey: latestKey,
        showMissionAnim: false
      });
      return;
    }

    if (!latest || latestKey === this.data.missionAnimLastKey) return;

    if (this._missionAnimTimer) {
      clearTimeout(this._missionAnimTimer);
      this._missionAnimTimer = null;
    }
    this.setData({
      missionAnimLastKey: latestKey,
      showMissionAnim: true,
      missionAnimText: latest.success ? "任务成功" : "任务失败",
      missionAnimRound: latest.round,
      missionAnimClass: latest.success ? "mission-anim-success" : "mission-anim-fail",
      missionAnimImage: latest.success ? "https://www.awalon.top/mp-assets/quest-success-420x300.png" : "https://www.awalon.top/mp-assets/quest-failed-420x300.png"
    });
    this._missionAnimTimer = setTimeout(() => {
      this.setData({ showMissionAnim: false });
      this._missionAnimTimer = null;
    }, 1800);
  },

  missionMetaByCount(count) {
    const sizes =
      {
        5: [2, 3, 2, 3, 3],
        6: [2, 3, 4, 3, 4],
        7: [2, 3, 3, 4, 4],
        8: [3, 4, 4, 5, 5],
        9: [3, 4, 4, 5, 5],
        10: [3, 4, 4, 5, 5]
      }[count] || [2, 3, 3, 4, 4];
    const fails =
      {
        5: [1, 1, 1, 1, 1],
        6: [1, 1, 1, 1, 1],
        7: [1, 1, 1, 2, 1],
        8: [1, 1, 1, 2, 1],
        9: [1, 1, 1, 2, 1],
        10: [1, 1, 1, 2, 1]
      }[count] || [1, 1, 1, 2, 1];
    return { sizes, fails };
  },

  buildMissionPills(room) {
    if (!room || !room.game) return [];
    const maxPlayers = Number(room.maxPlayers || 7);
    const meta = this.missionMetaByCount(maxPlayers);
    const map = {};
    (room.game.missionHistory || []).forEach((m) => {
      map[m.round] = m;
    });
    return meta.sizes.map((size, i) => {
      const round = i + 1;
      const rec = map[round] || null;
      const success = rec ? !!rec.success : null;
      const isCurrent = Number(room.game.round || 0) === round && room.phase !== "end";
      const cls = `${success === true ? "pill-success" : ""} ${success === false ? "pill-fail" : ""} ${
        isCurrent ? "pill-current" : ""
      }`.trim();
      return {
        round,
        size,
        failReq: meta.fails[i],
        success,
        isCurrent,
        cls
      };
    });
  },

  buildMissionRows(room) {
    if (!room || !room.game) return [];
    const players = Array.isArray(room.players) ? room.players : [];
    const byId = {};
    players.forEach((p) => (byId[p.id] = p));
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
      const leader = byId[v.leaderId] || null;
      const leaderSeat = leader && Number.isFinite(leader.seat) ? leader.seat + 1 : "?";
      const teamSeats = (v.team || [])
        .map((id) => {
          const p = byId[id];
          return p && Number.isFinite(p.seat) ? p.seat + 1 : "?";
        })
        .sort((a, b) => Number(a) - Number(b))
        .join(",");
      const approves = Object.entries(v.votes || {})
        .filter(([, val]) => !!val)
        .map(([id]) => (byId[id] && Number.isFinite(byId[id].seat) ? byId[id].seat + 1 : "?"))
        .sort((a, b) => Number(a) - Number(b))
        .join(",");
      const rejects = Object.entries(v.votes || {})
        .filter(([, val]) => !val)
        .map(([id]) => (byId[id] && Number.isFinite(byId[id].seat) ? byId[id].seat + 1 : "?"))
        .sort((a, b) => Number(a) - Number(b))
        .join(",");
      let resultText = "-";
      let resClass = "";
      if (mission) {
        resultText = mission.success ? `成功(${mission.fails || 0})` : `失败(${mission.fails || 0})`;
        resClass = mission.success ? "res-ok" : "res-fail";
      } else if (phase === "voting" && game && Number(game.round || 0) === Number(v.round || 0) && Number(game.attempt || 0) === Number(v.attempt || 0)) {
        resultText = "投票中";
        resClass = "res-pending";
      } else if (phase === "mission" && game && Number(game.round || 0) === Number(v.round || 0) && Number(game.attempt || 0) === Number(v.attempt || 0)) {
        resultText = "出征中";
        resClass = "res-pending";
      }
      return {
        key: `${v.round || 0}-${v.attempt || idx + 1}`,
        round: `${v.round || 0}-${v.attempt || idx + 1}`,
        leader: `${leaderSeat}号`,
        team: teamSeats || "-",
        approve: approves || "-",
        reject: rejects || "-",
        result: resultText,
        resClass
      };
    });
  },

  buildCenterResult(room) {
    if (!room || !room.game) return { show: false, title: "", sub: "" };
    const winner = room.game.winner || "";
    if (!winner && room.phase !== "end") return { show: false, title: "", sub: "" };
    const title = winner === "good" ? "好人胜利" : winner === "evil" ? "坏人胜利" : "对局结束";
    const ass = room.game.assassination || null;
    const sub = ass && ass.targetSeat ? `刺杀目标：${ass.targetSeat}号位` : "本局已结束";
    return { show: true, title, sub };
  },

  buildEndMedals(room, clientId) {
    if (!room || !room.game || !clientId) return [];
    const byPlayer = room.game.latestEarnedMedals || {};
    const list = Array.isArray(byPlayer[clientId]) ? byPlayer[clientId] : [];
    return decorateMedals(list);
  },

  buildSeatSlots(room, selectedTeam = [], selectedAssassinate = "") {
    const max = Number(room.maxPlayers || 0);
    const seats = Array.isArray(room.seats) ? room.seats : [];
    const players = Array.isArray(room.players) ? room.players : [];
    const game = room && room.game ? room.game : null;
    const phase = room && room.phase ? room.phase : "";
    const leaderId = game ? game.leaderId : "";
    const isLeaderNow = !!(this.data.clientId && leaderId && this.data.clientId === leaderId);
    const assTargetId = game && game.assassination ? game.assassination.targetId : "";
    const out = [];
    for (let i = 0; i < max; i += 1) {
      const pid = seats[i] || null;
      const p = pid ? players.find((it) => it.id === pid) : null;
      const avatarMeta = this.avatarMeta(p && p.avatar ? p.avatar : (p ? "🙂" : ""));
      let action = "";
      let actionDone = false;
      if (pid && game) {
        if (phase === "team" || phase === "speaking") {
          const tags = [];
          if (pid === leaderId) tags.push("队长");
          if (phase === "speaking" && room.speaking && room.seats[room.speaking.index] === pid) tags.push("发言中");
          action = tags.join(" · ");
          actionDone = false;
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
      out.push({
        index: i,
        seat: i + 1,
        name: p ? p.nickname : "空位",
        playerId: pid,
        avatarImage: avatarMeta.image,
        avatarText: avatarMeta.text || (p ? "🙂" : ""),
        offline: !!(p && p.offline),
        isMe: !!(pid && pid === this.data.clientId),
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
        roleLabel: this.getRevealedRoleLabel(room, pid),
        roleImage: this.roleImageFor(this.getRevealedRoleLabel(room, pid)),
        roleClass: this.roleClassFor(this.getRevealedRoleLabel(room, pid)),
        action,
        actionDone
      });
    }
    return out;
  },

  buildRoundSeats(seatSlots = [], maxPlayers = 7) {
    const n = Math.max(5, Number(maxPlayers) || 7);
    return seatSlots.map((s, idx) => {
      const angle = (2 * Math.PI * idx) / n - Math.PI / 2;
      const r = 39; // percent radius
      const cx = 50;
      const cy = 50;
      const left = cx + r * Math.cos(angle);
      const top = cy + r * Math.sin(angle);
      return {
        ...s,
        leftStyle: `left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;`
      };
    });
  },

  buildRoleVisibleSeats(info) {
    const seats = Array.isArray(info && info.seats) ? info.seats : [];
    const room = this.data.room;
    const currentRole = String((info && info.role) || this.data.myRole || "");
    const isMerlinView = currentRole === "梅林";
    if (!room || !Array.isArray(room.seats) || !Array.isArray(room.players)) return [];
    return seats
      .map((seatNo) => {
        const idx = Number(seatNo) - 1;
        if (idx < 0) return null;
        const pid = room.seats[idx];
        const p = room.players.find((it) => it.id === pid);
        const avatarMeta = this.avatarMeta(p && p.avatar ? p.avatar : (p ? "🙂" : ""));
        return {
          seat: seatNo,
          nickname: p ? p.nickname : "未知",
          avatarImage: avatarMeta.image,
          avatarText: avatarMeta.text || (p ? "🙂" : ""),
          evilVisible: isMerlinView
        };
      })
      .filter(Boolean);
  },

  roleImageFor(role) {
    return ROLE_IMAGE_MAP[role] || "";
  },

  roleClassFor(role) {
    if (!role) return "";
    return EVIL_ROLES.has(role) ? "role-evil" : "role-good";
  },

  buildPlayerCards(room) {
    if (!room || !Array.isArray(room.players)) return [];
    const seats = Array.isArray(room.seats) ? room.seats : [];
    const bySeat = {};
    seats.forEach((pid, idx) => {
      if (pid) bySeat[pid] = idx + 1;
    });
    const phase = room.phase || "";
    return room.players
      .map((p) => {
        const seat = Number.isFinite(p.seat) ? p.seat + 1 : bySeat[p.id] || 0;
        const role = this.getRevealedRoleLabel(room, p.id);
        const spectator = seat <= 0 || p.avatar === "👀";
        const offline = !!p.offline;
        let status = "准备中";
        let statusClass = "status-ready";
        if (offline) {
          status = "离线中";
          statusClass = "status-offline";
        } else if (spectator) {
          status = "观战中";
          statusClass = "status-watch";
        } else if (room.started && phase !== "end") {
          status = "正在游戏中";
          statusClass = "status-playing";
        } else if (room.started && phase === "end") {
          status = "已结束";
          statusClass = "status-ended";
        }
        const avatarMeta = this.avatarMeta(p.avatar || "🙂");
        return {
          id: p.id,
          seat,
          seatText: seat > 0 ? `${seat}号` : "未入座",
          nickname: p.nickname,
          avatar: p.avatar || "🙂",
          avatarImage: avatarMeta.image,
          avatarText: avatarMeta.text,
          isHost: p.id === room.hostId,
          isMe: p.id === this.data.clientId,
          offline,
          spectator,
          status,
          statusClass,
          role,
          roleImage: this.roleImageFor(role),
          roleClass: this.roleClassFor(role)
        };
      })
      .sort((a, b) => {
        const sa = a.seat > 0 ? a.seat : 999;
        const sb = b.seat > 0 ? b.seat : 999;
        if (sa !== sb) return sa - sb;
        return a.nickname.localeCompare(b.nickname);
      });
  },

  buildRoomConfig(room, leaderSeat) {
    if (!room) return [];
    const game = room.game || {};
    const phaseMap = {
      team: "组队中",
      speaking: "发言中",
      voting: "投票中",
      mission: "出征中",
      lady: "湖中仙女",
      assassination: "刺杀中",
      end: "已结束"
    };
    const phaseText = phaseMap[room.phase] || (room.started ? "进行中" : "未开始");
    const roleSummary = this.summarizeRoomRoles(room.roles);
    return [
      { label: "房间号", value: room.code || "-" },
      { label: "人数", value: `${room.maxPlayers || "-"}人` },
      { label: "状态", value: phaseText },
      { label: "轮次", value: room.started ? `${game.round || 1}-${game.attempt || 1}` : "-" },
      { label: "队长", value: leaderSeat ? `${leaderSeat}号` : "-" },
      { label: "发言时长", value: `${room.speakingSeconds || 180}s` },
      { label: "扩展", value: room.ladyOfLakeEnabled ? "湖中仙女" : "标准局" },
      { label: "角色配置", value: roleSummary || "-" }
    ];
  },

  buildLadyTargets(room) {
    if (!room || !room.game || !room.game.ladyOfLake || !Array.isArray(room.seats) || !Array.isArray(room.players)) return [];
    const lady = room.game.ladyOfLake;
    const previousHolders = new Set((lady.history || []).map((item) => item.holderId));
    if (lady.holderId) previousHolders.add(lady.holderId);
    return room.seats
      .map((pid, idx) => {
        if (!pid || pid === lady.holderId || previousHolders.has(pid)) return null;
        const player = room.players.find((it) => it.id === pid);
        if (!player) return null;
        const avatarMeta = this.avatarMeta(player.avatar || "🙂");
        return {
          id: pid,
          seat: idx + 1,
          nickname: player.nickname,
          avatarImage: avatarMeta.image,
          avatarText: avatarMeta.text || "🙂"
        };
      })
      .filter(Boolean);
  },

  buildLadyHistory(room) {
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
  },

  summarizeRoomRoles(roles = []) {
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
  },

  getRevealedRoleLabel(room, pid) {
    if (!room || !room.game || !pid) return "";
    const full = room.game.revealedRoles || null;
    if (full && full[pid]) return full[pid];
    const evil = room.game.revealedEvil || null;
    if (evil && evil[pid]) return evil[pid];
    return "";
  },

  buildSpeakViewState(room, preferKey) {
    const keys = this.buildSpeakRoundKeys(room);
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
      speakMessages: this.buildSpeakMessagesByRound(room, viewKey)
    };
  },

  buildSpeakRoundKeys(room) {
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
  },

  buildSpeakMessagesByRound(room, roundKey) {
    if (!room || !room.game || !room.game.speakHistory || !roundKey || !Array.isArray(room.players) || !Array.isArray(room.seats)) return [];
    const raw = Array.isArray(room.game.speakHistory[roundKey]) ? room.game.speakHistory[roundKey] : [];
    const byName = {};
    const byId = {};
    room.players.forEach((p) => {
      byName[p.nickname] = p;
      byId[p.id] = p;
    });
    return raw.map((m, idx) => {
      const p = (m && m.playerId && byId[m.playerId]) || byName[m.from];
      const seat = p ? room.seats.findIndex((id) => id === p.id) + 1 : 0;
      const mine = !!(p && p.id === this.data.clientId);
      return {
        key: `${m.ts || 0}-${idx}`,
        from: m.from || "系统",
        text: m.text || "",
        seat: seat > 0 ? seat : "",
        mine,
        system: !p
      };
    });
  },

  send(type, payload) {
    socket.send({ type, payload });
  },

  onReconnect() {
    this.setData({ connected: false });
    this.connect(this.data.wsUrl);
  },

  onRoomCodeInput(e) {
    const v = (e.detail.value || "").replace(/\D/g, "").slice(0, 5);
    this.setData({ roomCodeInput: v });
  },

  onMaxPlayersChange(e) {
    const idx = Number(e.detail.value);
    if (!Number.isFinite(idx)) return;
    this.setData({ maxPlayersIndex: idx });
  },

  onSelectMaxPlayers(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    if (!Number.isFinite(idx)) return;
    const maxPlayers = 5 + idx;
    const selectedRoles = this.defaultRolesForCount(maxPlayers);
    const next = {
      maxPlayersIndex: idx,
      selectedRoles,
      hostRoleOptions: this.withRoleImages(this.uniqueRoles(selectedRoles))
    };
    if (this.data.hostRole !== "随机" && !selectedRoles.includes(this.data.hostRole)) {
      next.hostRole = "随机";
    }
    if (maxPlayers < 8) {
      next.ladyOfLakeEnabled = false;
    }
    this.setData(next);
  },

  uniqueRoles(roles = []) {
    const seen = new Set();
    const out = [];
    (roles || []).forEach((r) => {
      if (!r || seen.has(r)) return;
      seen.add(r);
      out.push(r);
    });
    return out;
  },

  withRoleImages(roles = []) {
    return (roles || []).map((role) => ({
      role,
      image: this.roleImageFor(role)
    }));
  },

  defaultRolesForCount(count) {
    const n = Number(count) || 7;
    if (n === 5) return ["梅林", "派西维尔", "莫甘娜", "刺客", "忠臣"];
    if (n === 6) return ["梅林", "派西维尔", "莫甘娜", "刺客", "忠臣", "忠臣"];
    if (n === 7) return ["梅林", "派西维尔", "莫甘娜", "刺客", "忠臣", "忠臣", "奥伯伦"];
    if (n === 8) return ["梅林", "派西维尔", "莫甘娜", "刺客", "爪牙", "忠臣", "忠臣", "忠臣"];
    if (n === 9) return ["梅林", "派西维尔", "莫甘娜", "莫德雷德", "奥伯伦", "忠臣", "忠臣", "忠臣", "忠臣"];
    if (n === 10) return ["梅林", "派西维尔", "莫甘娜", "莫德雷德", "刺客", "奥伯伦", "忠臣", "忠臣", "忠臣", "忠臣"];
    return Array.from({ length: n }, () => "忠臣");
  },

  onPickHostRole(e) {
    const role = String(e.currentTarget.dataset.role || "随机");
    this.setData({ hostRole: role });
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

  async onWxLogin() {
    if (!this.data.connected) {
      wx.showToast({ title: "WS 未连接", icon: "none" });
      return;
    }
    let wxCode = "";
    try {
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          timeout: 10000,
          success: resolve,
          fail: reject
        });
      });
      wxCode = (loginRes && loginRes.code) || "";
    } catch (err) {
      this.setData({ loginTip: "微信登录失败：wx.login 调用失败" });
      wx.showToast({ title: "wx.login 失败", icon: "none" });
      return;
    }

    if (!wxCode) {
      this.setData({ loginTip: "微信登录失败：未获取到 code" });
      wx.showToast({ title: "未获取 code", icon: "none" });
      return;
    }

    const app = getApp();
    this.setData({ loginTip: "微信登录成功，正在换取身份..." });
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${app.globalData.apiBase}/api/wx/openid-login`,
          method: "POST",
          data: {
            code: wxCode,
            nickname: ""
          },
          header: {
            "Content-Type": "application/json"
          },
          success: resolve,
          fail: reject
        });
      });

      const body = res.data || {};
      if (res.statusCode !== 200 || !body.ok || !body.data || !body.data.phone) {
        const code = body.code || `HTTP_${res.statusCode}`;
        throw new Error(code);
      }

      this.send("LOGIN", { phone: body.data.phone });
      this.setData({ loginTip: `已登录 ${body.data.phone}，正在进入大厅...` });
    } catch (err) {
      const msg = (err && err.message) || "WX_OPENID_LOGIN_FAILED";
      this.setData({ loginTip: `微信登录失败：${msg}` });
      wx.showToast({ title: "登录失败", icon: "none" });
    }
  },

  onCreateRoom() {
    if (!this.data.loggedIn) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    const maxPlayers = 5 + Number(this.data.maxPlayersIndex || 0);
    const roles = this.defaultRolesForCount(maxPlayers);
    const payload = { avatar: this.data.avatar || "🐺", maxPlayers, roles };
    const hostRole = this.data.hostRole || "随机";
    if (hostRole !== "随机") {
      if (!roles.includes(hostRole)) {
        wx.showToast({ title: "房主身份不在当前配置中", icon: "none" });
        return;
      }
      payload.hostRole = hostRole;
    }
    payload.ladyOfLakeEnabled = !!this.data.ladyOfLakeEnabled && maxPlayers >= 8;
    this.send("CREATE_ROOM", payload);
    this.setData({ atHome: false, roomTip: `已创建${maxPlayers}人房间请求...` });
  },

  onToggleLadyMode(e) {
    const enabled = !!Number(e.currentTarget.dataset.enabled);
    const maxPlayers = 5 + Number(this.data.maxPlayersIndex || 0);
    if (enabled && maxPlayers < 8) {
      wx.showToast({ title: "仅支持8人及以上", icon: "none" });
      return;
    }
    this.setData({ ladyOfLakeEnabled: enabled });
  },

  onJoinRoomPrompt() {
    if (!this.data.loggedIn) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    wx.showModal({
      title: "加入房间",
      editable: true,
      placeholderText: "输入5位房间号",
      confirmText: "加入",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) return;
        const roomCode = String((res.content || "").trim());
        if (!/^\d{5}$/.test(roomCode)) {
          wx.showToast({ title: "请输入5位房间号", icon: "none" });
          return;
        }
        this.send("JOIN_ROOM", { roomCode, avatar: this.data.avatar || "🐺" });
        this.setData({ atHome: false, roomTip: `加入房间 ${roomCode} 请求已发送...` });
      }
    });
  },

  onWatchRoom() {
    if (!this.data.loggedIn) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    const roomCode = (this.data.roomCodeInput || "").trim();
    if (!/^\d{5}$/.test(roomCode)) {
      wx.showToast({ title: "观战需输入5位房间号", icon: "none" });
      return;
    }
    this.send("JOIN_ROOM", { roomCode, avatar: "👀" });
    this.setData({ atHome: false, roomTip: `观战模式（兼容）：已按普通加入进入 ${roomCode}` });
  },

  onLeaveRoom() {
    this.send("LEAVE_ROOM");
    this.setData({
      room: null,
      atHome: true,
      teamPhaseKey: "",
      seatSlots: [],
      roundSeats: [],
      roleInfo: null,
      showRolePanel: false,
      roleVisibleSeats: [],
      roleInfoImage: "",
      roleInfoClass: "",
      roleRequested: false,
      myRole: "",
      selectedTeam: [],
      teamConfirmed: false,
      leaderActionText: "提交队伍",
      leaderActionDisabled: true,
      teamCandidates: [],
      currentVoteTeam: [],
      isLadyHolder: false,
      ladyHolderName: "",
      ladyHistory: [],
      ladyTargets: [],
      selectedAssassinate: "",
      speakText: "",
      speakingSeat: 0,
      isMyTurn: false,
      speakMessages: [],
      speakKeys: [],
      speakRoundView: "",
      showSpeakPanel: true,
      showPlayerList: false,
      playerCards: [],
      cheatRevealPlayerId: "",
      cheatRoles: {},
      roomConfigLines: [],
      missionAnimBootstrapped: false,
      missionAnimRoomCode: "",
      missionAnimLastKey: "",
      showMissionAnim: false,
      missionAnimText: "",
      missionAnimRound: 0,
      missionAnimClass: "",
      missionAnimImage: "",
      endMedals: [],
      leaderSeat: 0,
      phase: "",
      roomTip: "已离开房间"
    });
  },

  onBackHome() {
    if (!this.data.room) return;
    this.setData({ atHome: true, cheatRevealPlayerId: "" });
  },

  onResumeRoom() {
    if (!this.data.room) return;
    this.setData({ atHome: false });
  },

  maybeShowPhasePrompt(roomArg) {
    const room = roomArg || this.data.room;
    if (!room || !room.game) return;
    const me = this.data.clientId;
    if (!me) return;
    const phase = room.phase || "";
    if (phase === "voting") {
      return;
    }
    if (phase === "mission") return;
  },

  toggleSpeakPanel() {
    this.setData({ showSpeakPanel: !this.data.showSpeakPanel });
  },

  prevSpeakRound() {
    const keys = this.data.speakKeys || [];
    const cur = this.data.speakRoundView || "";
    const idx = keys.indexOf(cur);
    if (idx <= 0) return;
    const nextKey = keys[idx - 1];
    this.setData({
      speakRoundView: nextKey,
      speakMessages: this.buildSpeakMessagesByRound(this.data.room, nextKey)
    });
  },

  nextSpeakRound() {
    const keys = this.data.speakKeys || [];
    const cur = this.data.speakRoundView || "";
    const idx = keys.indexOf(cur);
    if (idx < 0 || idx >= keys.length - 1) return;
    const nextKey = keys[idx + 1];
    this.setData({
      speakRoundView: nextKey,
      speakMessages: this.buildSpeakMessagesByRound(this.data.room, nextKey)
    });
  },

  togglePlayerList() {
    const next = !this.data.showPlayerList;
    this.setData({ showPlayerList: next, showRolePanel: next ? false : this.data.showRolePanel });
  },

  onPlayerNamePressStart(e) {
    if (!this.data.isHost) return;
    const playerId = String(e.currentTarget.dataset.id || "");
    const seatNo = Number(e.currentTarget.dataset.seat || 0);
    if (!playerId) return;
    if (!seatNo) return;
    this.setData({ cheatPressingPlayerId: playerId });
    if (this._cheatPressTimer) {
      clearTimeout(this._cheatPressTimer);
      this._cheatPressTimer = null;
    }
    this._cheatPressTimer = setTimeout(() => {
      this._cheatPressTimer = null;
      this.requestCheatReveal(playerId);
    }, 4000);
  },

  requestCheatReveal(playerId) {
    if (!playerId) return;
    this.setData({ cheatPendingPlayerId: playerId });
    this.send("CHEAT_REVEAL", { targetId: playerId });
    if (this._cheatReqTimer) clearTimeout(this._cheatReqTimer);
    this._cheatReqTimer = setTimeout(() => {
      if (this.data.cheatPendingPlayerId === playerId) {
        this.setData({ cheatPendingPlayerId: "", cheatRevealPlayerId: "" });
      }
      this._cheatReqTimer = null;
    }, 2500);
  },

  onPlayerNamePressEnd() {
    if (this._cheatPressTimer) {
      clearTimeout(this._cheatPressTimer);
      this._cheatPressTimer = null;
    }
    this.setData({ cheatPressingPlayerId: "", cheatRevealPlayerId: "" });
  },

  onChooseSeat(e) {
    const room = this.data.room;
    if (!room) return;
    const idx = Number(e.currentTarget.dataset.index);
    if (!Number.isFinite(idx)) return;
    if (!room.started) {
      this.send("CHOOSE_SEAT", { seatIndex: idx });
      return;
    }
    const slot = (this.data.seatSlots || [])[idx];
    const pid = slot && slot.playerId;
    if (!pid) return;
    if ((this.data.phase === "team" || this.data.phase === "speaking") && this.data.isLeader) {
      this.onToggleTeamById(pid);
      return;
    }
    if (this.data.phase === "lady" && this.data.isLadyHolder) {
      this.onUseLadyOfLake(pid);
      return;
    }
    if (this.data.phase === "assassination" && this.data.isAssassin) {
      this.setData({
        selectedAssassinate: pid,
        seatSlots: this.buildSeatSlots(room, this.data.selectedTeam, pid),
        roundSeats: this.buildRoundSeats(this.buildSeatSlots(room, this.data.selectedTeam, pid), room.maxPlayers || 7),
        gameTip: `已选择刺杀目标：${slot.name}`
      });
    }
  },

  onViewRole() {
    this.send("VIEW_ROLE");
  },

  toggleRolePanel() {
    if (this.data.showRolePanel) {
      this.setData({ showRolePanel: false });
      return;
    }
    const room = this.data.room;
    if (!room || !room.started) {
      wx.showToast({ title: "游戏开始后可查看身份", icon: "none" });
      return;
    }
    this.setData({ showRolePanel: true, showPlayerList: false });
    this.send("VIEW_ROLE");
  },

  onCloseRolePanel() {
    this.setData({ showRolePanel: false });
  },

  noop() {},

  onStartGame() {
    this.send("START_GAME");
    this.setData({ gameTip: "开始游戏请求已发送..." });
  },

  onStartMissionPhase() {
    this.send("START_MISSION_PHASE");
    this.setData({ gameTip: "已请求进入任务流程..." });
  },

  onToggleTeamById(arg) {
    const room = this.data.room;
    if (!room || !room.game) return;
    const pid = arg && arg.currentTarget && arg.currentTarget.dataset ? arg.currentTarget.dataset.id : arg;
    if (!pid) return;
    const teamSize = Number(room.game.teamSize || this.data.teamSize || 0);
    const current = [...(this.data.selectedTeam || [])];
    const exists = current.includes(pid);
    let next = current;
    if (exists) {
      next = current.filter((id) => id !== pid);
    } else if (current.length < teamSize) {
      next = [...current, pid];
    } else {
      wx.showToast({ title: `队伍人数为${teamSize}`, icon: "none" });
      return;
    }
    this.setData({
      selectedTeam: next,
      teamConfirmed: false,
      ...this.deriveLeaderAction(this.data.phase, teamSize, next, false),
      seatSlots: this.buildSeatSlots(room, next, this.data.selectedAssassinate),
      roundSeats: this.buildRoundSeats(this.buildSeatSlots(room, next, this.data.selectedAssassinate), room.maxPlayers || 7),
      teamCandidates: this.buildTeamCandidates(room, next),
      gameTip: `已选队伍：${next.length}/${teamSize}`
    });
  },

  buildTeamCandidates(room, selectedTeam = []) {
    if (!room || !Array.isArray(room.seats) || !Array.isArray(room.players)) return [];
    return room.seats
      .map((pid, idx) => {
        if (!pid) return null;
        const p = room.players.find((it) => it.id === pid);
        if (!p) return null;
        return {
          id: pid,
          seat: idx + 1,
          nickname: p.nickname,
          selected: selectedTeam.includes(pid)
        };
      })
      .filter(Boolean);
  },

  buildCurrentVoteTeam(room) {
    if (!room || !room.game || !Array.isArray(room.game.team) || !Array.isArray(room.seats) || !Array.isArray(room.players)) {
      return [];
    }
    return room.game.team
      .map((pid) => {
        if (!pid) return null;
        const seat = room.seats.findIndex((id) => id === pid) + 1;
        const player = room.players.find((it) => it.id === pid);
        if (!seat || !player) return null;
        const avatarMeta = this.avatarMeta(player.avatar || "🙂");
        return {
          id: pid,
          seat,
          nickname: player.nickname,
          avatarImage: avatarMeta.image,
          avatarText: avatarMeta.text || "🙂"
        };
      })
      .filter(Boolean);
  },

  onConfirmTeam() {
    const team = this.data.selectedTeam || [];
    if (!team.length) {
      wx.showToast({ title: "请先选择队伍", icon: "none" });
      return;
    }
    this.send("UPDATE_TEAM", { team });
    this.send("PROPOSE_TEAM", { team });
    this.setData({ gameTip: "已提交队伍，等待投票..." });
  },

  onLeaderTeamAction() {
    const room = this.data.room;
    if (!room || !room.game) return;
    const phase = this.data.phase;
    const teamSize = Number(this.data.teamSize || room.game.teamSize || 0);
    const team = this.data.selectedTeam || [];
    if (team.length !== teamSize) return;
    if (phase === "team") {
      this.send("PROPOSE_TEAM", { team });
      this.setData({ teamConfirmed: true, gameTip: "已提交队伍，进入发言阶段" });
      return;
    }
    if (phase === "speaking") {
      if (this.data.teamConfirmed) {
        this.send("PROPOSE_TEAM", { team });
        this.setData({ gameTip: "已发起队伍投票" });
      } else {
        this.send("UPDATE_TEAM", { team });
        this.setData({
          teamConfirmed: true,
          ...this.deriveLeaderAction(phase, teamSize, team, true),
          gameTip: "队伍已提交，可发起投票"
        });
      }
    }
  },

  onSpeakInput(e) {
    this.setData({ speakText: (e.detail.value || "").slice(0, 120) });
  },

  onSendSpeak() {
    const text = (this.data.speakText || "").trim();
    if (!text) {
      wx.showToast({ title: "请输入发言内容", icon: "none" });
      return;
    }
    this.send("SPEAK", { text });
    if (this.data.isLeader && this.data.phase === "speaking") {
      this.setData({ speakText: "", gameTip: "发言已发送，请在圆桌中心点击“发起队伍投票”" });
      return;
    }
    this.setData({ speakText: "", gameTip: "发言已发送，切换下一位..." });
    // Send speech first, then advance to the next speaker automatically.
    setTimeout(() => {
      this.send("END_SPEAK");
    }, 120);
  },

  onEndSpeak() {
    if (this.data.phase !== "speaking" || !this.data.isMyTurn) {
      this.requestRoomRecovery();
      wx.showToast({ title: "发言状态已更新", icon: "none", duration: 1200 });
      return;
    }
    this.send("END_SPEAK");
    this.setData({ gameTip: "已结束当前发言" });
  },

  onHostSkipSpeak() {
    this.send("HOST_SKIP_SPEAKER");
    wx.showToast({ title: "已请求跳过", icon: "none", duration: 900 });
  },

  onHostDirectVote() {
    this.send("HOST_SKIP_TO_VOTE");
    wx.showToast({ title: "已请求直接投票", icon: "none", duration: 900 });
  },

  onVoteApprove() {
    this.send("VOTE_TEAM", { approve: true });
    this.setData({ gameTip: "你已投：同意" });
  },

  onVoteReject() {
    this.send("VOTE_TEAM", { approve: false });
    this.setData({ gameTip: "你已投：反对" });
  },

  onMissionSuccess() {
    this.send("EXECUTE_MISSION", { fail: false });
    this.setData({ gameTip: "你已提交任务：成功" });
  },

  onMissionFail() {
    this.send("EXECUTE_MISSION", { fail: true });
    this.setData({ gameTip: "你已提交任务：失败" });
  },

  onStartAssassination() {
    wx.showModal({
      title: "确认发起刺杀",
      content: "发起后将进入刺杀阶段，是否继续？",
      confirmText: "确认发起",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) return;
        this.send("START_ASSASSINATION");
        this.setData({ gameTip: "已请求进入刺杀阶段" });
      }
    });
  },

  onConfirmAssassinate() {
    if (!this.data.selectedAssassinate) {
      wx.showToast({ title: "先选择刺杀目标", icon: "none" });
      return;
    }
    const target = (this.data.seatSlots || []).find((item) => item && item.playerId === this.data.selectedAssassinate);
    const targetText = target ? `${target.seat}号位 ${target.name}` : "当前目标";
    wx.showModal({
      title: "确认刺杀",
      content: `确认刺杀 ${targetText} 吗？`,
      confirmText: "确认刺杀",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) return;
        this.send("ASSASSINATE", { targetId: this.data.selectedAssassinate });
        this.setData({ gameTip: `刺杀请求已发送：${targetText}` });
      }
    });
  },

  onRedealIdentities() {
    wx.showModal({
      title: "确认重发身份",
      content: "将按当前配置重新开始本局并给所有玩家重新发身份，是否继续？",
      confirmText: "确认重发",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) return;
        this.send("REDEAL_IDENTITIES");
        this.setData({ gameTip: "已请求重发身份" });
      }
    });
  },

  onUseLadyOfLake(arg) {
    const room = this.data.room;
    if (!room || this.data.phase !== "lady" || !this.data.isLadyHolder) return;
    const targetId = arg && arg.currentTarget && arg.currentTarget.dataset ? String(arg.currentTarget.dataset.id || "") : String(arg || "");
    if (!targetId) return;
    const target = (this.data.ladyTargets || []).find((item) => item.id === targetId);
    const targetText = target ? `${target.seat}号位 ${target.nickname}` : "该玩家";
    wx.showModal({
      title: "确认验人",
      content: `确认查看 ${targetText} 是好人还是坏人吗？`,
      confirmText: "确认查看",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) return;
        this.send("USE_LADY_OF_LAKE", { targetId });
        this.setData({ gameTip: `已请求查看：${targetText}` });
      }
    });
  },

  openHistory(arg = 1) {
    wx.navigateTo({ url: "/pages/history/index/index" });
  },

  openHistoryDetail(e) {
    const gameId = Number(e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.gameid : e);
    if (!Number.isFinite(gameId)) return;
    this.requestHistoryDetail(gameId);
  },

  openRoleStats() {
    wx.navigateTo({ url: "/pages/role-stats/index/index" });
  },

  openRules() {
    wx.navigateTo({ url: "/pages/rules/index/index" });
  },

  avatarMeta(avatar) {
    const raw = String(avatar || "").trim();
    if (/^https?:\/\//i.test(raw)) {
      return { image: raw, text: "" };
    }
    return { image: "", text: raw || "🙂" };
  },

  async uploadAvatarFile(filePath) {
    const imageBase64 = await new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: "base64",
        success: (res) => resolve((res && res.data) || ""),
        fail: reject
      });
    });
    if (!imageBase64) throw new Error("EMPTY_IMAGE");

    const app = getApp();
    const res = await new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.apiBase}/api/profile/avatar`,
        method: "POST",
        data: {
          token: this.data.authToken,
          imageBase64,
          ext: "jpg"
        },
        header: {
          "Content-Type": "application/json"
        },
        success: resolve,
        fail: reject
      });
    });
    const body = res.data || {};
    const avatar = body && body.data && body.data.avatar ? String(body.data.avatar) : "";
    if (res.statusCode !== 200 || !body.ok || !avatar) {
      throw new Error((body && body.code) || `HTTP_${res.statusCode}`);
    }

    const avatarMeta = this.avatarMeta(avatar);
    this.send("SET_PROFILE", { avatar });
    this.setData({
      avatar,
      avatarImage: avatarMeta.image,
      avatarText: avatarMeta.text,
      loginTip: "头像已更新"
    });
    wx.setStorageSync("awalonAvatar", avatar);
  },

  onChangeNickname() {
    if (!this.data.loggedIn) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    wx.showModal({
      title: "修改昵称",
      editable: true,
      placeholderText: "输入新昵称（最多12字）",
      content: this.data.nickname || "",
      confirmText: "确认",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) return;
        const next = String((res.content || "").trim()).slice(0, 12);
        if (!next) {
          wx.showToast({ title: "昵称不能为空", icon: "none" });
          return;
        }
        this.send("SET_PROFILE", { nickname: next });
        this.setData({ nickname: next, loginTip: `昵称已更新：${next}` });
        wx.setStorageSync("awalonNickname", next);
        wx.showToast({ title: "昵称已修改", icon: "success" });
      }
    });
  },

  async onChangeAvatar() {
    if (!this.data.loggedIn) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    if (!this.data.authToken) {
      wx.showToast({ title: "登录态失效", icon: "none" });
      return;
    }
    try {
      const chooseRes = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sourceType: ["album", "camera"],
          success: resolve,
          fail: reject
        });
      });
      const filePath = (chooseRes && chooseRes.tempFilePaths && chooseRes.tempFilePaths[0]) || "";
      if (!filePath) return;
      wx.setStorageSync("awalonAvatarCropSource", filePath);
      wx.navigateTo({
        url: "/pages/avatarcrop/index",
        success: (res) => {
          const eventChannel = res && res.eventChannel;
          if (!eventChannel) {
            this.setData({ loginTip: "头像上传失败：CROP_PAGE_OPEN_FAILED" });
            return;
          }
          eventChannel.once("avatarCropped", async ({ filePath: croppedPath }) => {
            if (!croppedPath) return;
            try {
              wx.showLoading({ title: "上传中", mask: true });
              await this.uploadAvatarFile(croppedPath);
              wx.showToast({ title: "头像已修改", icon: "success" });
            } catch (err) {
              const msg = (err && err.message) || "AVATAR_UPLOAD_FAILED";
              wx.showToast({ title: msg.slice(0, 7) || "上传失败", icon: "none" });
              this.setData({ loginTip: `头像上传失败：${msg}` });
            } finally {
              wx.hideLoading();
            }
          });
        },
        fail: (err) => {
          const msg = (err && err.errMsg) || "CROP_PAGE_OPEN_FAILED";
          wx.showToast({ title: "打开裁剪失败", icon: "none" });
          this.setData({ loginTip: `头像上传失败：${msg}` });
        }
      });
    } catch (err) {
      const msg = (err && err.message) || "AVATAR_UPLOAD_FAILED";
      wx.showToast({ title: msg.slice(0, 7) || "打开失败", icon: "none" });
      this.setData({ loginTip: `头像上传失败：${msg}` });
    }
  },

  requestHistoryList(page = 1) {
    const p = Math.max(1, Number(page) || 1);
    this.send("GET_GAME_HISTORY_LIST", { limit: 10, offset: (p - 1) * 10 });
  },

  requestHistoryDetail(gameId) {
    const id = Number(gameId);
    if (!Number.isFinite(id)) return;
    this.send("GET_GAME_HISTORY_DETAIL", { gameId: id });
  },

  requestRoleStats() {
    this.send("GET_ROLE_STATS", {});
  }
});
