const socket = require("../../utils/socket");
const { decorateMedals } = require("../../utils/medals");
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
const {
  ROLE_IMAGE_MAP, EVIL_ROLES, roleImageFor, roleClassFor,
  missionMetaByCount, forcedRoundForRoom, isCurrentForcedAttempt,
  getLatestMissionRecord, buildMissionPills, formatRecapEntry,
} = require("../../utils/gameUtils");
const { getSkin } = require("../../skins");
const app = getApp();
const NOTE_LABELS_GOOD = ["梅林", "派西", "偏好", "正义", "排水"];
const NOTE_LABELS_EVIL = ["偏坏", "狼人", "奥伯伦"];
const NOTE_LABELS = [...NOTE_LABELS_GOOD, ...NOTE_LABELS_EVIL];
const NOTE_CHIP_CONFIG = {
  "梅林":  { icon: "✦", color: "#a78bfa", bg: "rgba(109,40,217,0.25)",  border: "rgba(167,139,250,0.55)" },
  "派西":  { icon: "⬟", color: "#a5b4fc", bg: "rgba(99,102,241,0.22)",  border: "rgba(165,180,252,0.5)"  },
  "偏好":  { icon: "△", color: "#86efac", bg: "rgba(21,128,61,0.18)",   border: "rgba(134,239,172,0.45)" },
  "正义":  { icon: "▲", color: "#4ade80", bg: "rgba(21,128,61,0.22)",   border: "rgba(74,222,128,0.5)"   },
  "排水":  { icon: "⊘", color: "#38bdf8", bg: "rgba(7,89,133,0.25)",    border: "rgba(56,189,248,0.5)"   },
  "偏坏":  { icon: "▽", color: "#fb923c", bg: "rgba(194,65,12,0.22)",   border: "rgba(251,146,60,0.5)"   },
  "狼人":  { icon: "▼", color: "#f87171", bg: "rgba(153,27,27,0.28)",   border: "rgba(248,113,113,0.55)" },
  "奥伯伦":{ icon: "◐", color: "#c084fc", bg: "rgba(88,28,135,0.25)",   border: "rgba(192,132,252,0.5)"  },
};
const NOTE_BADGE_STYLE = {
  "梅林":  "background:rgba(109,40,217,0.85);border-color:rgba(167,139,250,0.65);",
  "派西":  "background:rgba(99,102,241,0.85);border-color:rgba(165,180,252,0.6);",
  "偏好":  "background:rgba(21,128,61,0.8);border-color:rgba(134,239,172,0.55);",
  "正义":  "background:rgba(18,100,50,0.88);border-color:rgba(74,222,128,0.6);",
  "排水":  "background:rgba(7,89,133,0.85);border-color:rgba(56,189,248,0.6);",
  "偏坏":  "background:rgba(194,65,12,0.85);border-color:rgba(251,146,60,0.6);",
  "狼人":  "background:rgba(153,27,27,0.9);border-color:rgba(248,113,113,0.65);",
  "奥伯伦":"background:rgba(88,28,135,0.88);border-color:rgba(192,132,252,0.6);",
};
const NOTE_TEXT_STYLE = {
  "梅林":  "color:#d4aaff;",
  "派西":  "color:#c7d2fe;",
  "偏好":  "color:#bbf7d0;",
  "正义":  "color:#86efac;",
  "排水":  "color:#7dd3fc;",
  "偏坏":  "color:#fdba74;",
  "狼人":  "color:#fca5a5;",
  "奥伯伦":"color:#e9d5ff;",
};
const ROLE_ORDER = ["梅林", "派西维尔", "忠臣", "莫甘娜", "刺客", "莫德雷德", "奥伯伦", "爪牙"];
const ROLE_PRESETS = {
  7: [
    { name: '经典版', roles: ['梅林','派西维尔','忠臣','忠臣','莫甘娜','刺客','爪牙'], oberonVisibleEnabled: true },
    { name: '孤狼版', roles: ['梅林','派西维尔','忠臣','忠臣','莫甘娜','莫德雷德','奥伯伦'], oberonVisibleEnabled: false },
  ],
  8: [
    { name: '经典版', roles: ['梅林','派西维尔','忠臣','忠臣','忠臣','莫甘娜','刺客','爪牙'], oberonVisibleEnabled: true },
    { name: '竞技版', roles: ['梅林','派西维尔','忠臣','忠臣','忠臣','莫甘娜','莫德雷德','刺客'], oberonVisibleEnabled: true },
    { name: '孤狼版', roles: ['梅林','派西维尔','忠臣','忠臣','忠臣','莫甘娜','莫德雷德','奥伯伦'], oberonVisibleEnabled: false },
  ],
  9: [
    { name: '经典版', roles: ['梅林','派西维尔','忠臣','忠臣','忠臣','忠臣','莫甘娜','莫德雷德','刺客'], oberonVisibleEnabled: true },
    { name: '孤狼版', roles: ['梅林','派西维尔','忠臣','忠臣','忠臣','忠臣','莫甘娜','莫德雷德','奥伯伦'], oberonVisibleEnabled: false },
  ],
  10: [
    { name: '经典版', roles: ['梅林','派西维尔','忠臣','忠臣','忠臣','忠臣','莫甘娜','莫德雷德','奥伯伦','刺客'], oberonVisibleEnabled: true },
    { name: '孤狼版', roles: ['梅林','派西维尔','忠臣','忠臣','忠臣','忠臣','莫甘娜','莫德雷德','奥伯伦','刺客'], oberonVisibleEnabled: false },
  ],
};
const FORCE_ROUND_OPTIONS = [
  { value: "fixed5", label: "第5次组队判负" },
  { value: "evil_plus_one", label: "第(匪徒数+1)次组队判负" }
];
const SPEAKING_SECONDS_OPTIONS = [60, 90, 120, 180];
const ROLE_DESCRIPTION_MAP = {
  梅林: "正义核心：知道多数坏人，但不能暴露自己。",
  派西维尔: "正义信息位：看到梅林和莫甘娜，要分辨真假。",
  忠臣: "普通正义：没有夜晚信息，靠发言和投票推理。",
  "亚瑟的忠臣": "普通正义：没有夜晚信息，靠发言和投票推理。",
  "兰斯洛特（正义）": "正义变体位：看本局规则处理阵营变化。",
  刺客: "邪恶关键位：正义快赢时可刺杀梅林翻盘。",
  莫甘娜: "邪恶伪装位：会混进派西维尔看到的梅林候选。",
  莫德雷德: "邪恶隐匿位：通常不会被梅林看到。",
  奥伯伦: "邪恶变体位：是否暴露给队友看本局配置。",
  爪牙: "普通邪恶：配合队友干扰判断、制造失败任务。",
  "兰斯洛特（邪恶）": "邪恶变体位：看本局规则处理阵营变化。"
};
const ROLE_GUIDE_MAP = {
  梅林: "阵营：正义。\n你知道大多数邪恶玩家是谁，但通常看不到莫德雷德。\n你的目标不是直接跳出来报答案，而是用发言和投票悄悄带正义完成3次任务。\n终局如果刺客刺中你，邪恶会翻盘，所以越到后面越要藏好自己。",
  派西维尔: "阵营：正义。\n你会看到两个像梅林的人：真正的梅林和莫甘娜。\n你的任务是保护真正的梅林，同时别被莫甘娜带偏。\n新手可以多观察谁的信息更稳定、谁更像在保护正义任务。",
  忠臣: "阵营：正义。\n你没有额外信息，不知道谁好谁坏。\n你的主要玩法是听发言、看投票、看任务结果，慢慢排除嫌疑。\n不要因为自己没信息就随便跟票，正义阵营很需要普通忠臣的判断。",
  "亚瑟的忠臣": "阵营：正义。\n你没有额外信息，不知道谁好谁坏。\n你的主要玩法是听发言、看投票、看任务结果，慢慢排除嫌疑。\n不要因为自己没信息就随便跟票，正义阵营很需要普通忠臣的判断。",
  刺客: "阵营：邪恶。\n你和邪恶队友要阻止正义完成3次成功任务。\n如果正义先完成3次成功任务，你还有最后一次刺杀梅林的机会。\n新手刺客要重点记谁像在暗中带队、谁的信息太准。",
  莫甘娜: "阵营：邪恶。\n你会被派西维尔看到，和梅林一起成为两个候选人。\n你的玩法是装成梅林，让派西维尔和正义阵营分不清真假。\n发言时可以给一点似是而非的信息，但别暴露自己是邪恶。",
  莫德雷德: "阵营：邪恶。\n你通常不会被梅林看到，所以你比其他邪恶更隐蔽。\n你的玩法是利用这层保护，争取进入关键任务队伍或带偏正义判断。\n但你仍然要注意投票和任务行为，别因为太激进被推出去。",
  奥伯伦: "阵营：邪恶。\n奥伯伦是特殊邪恶位，具体是否和邪恶队友互相知道，要看本局配置。\n如果本局显示不翻牌，你更像孤狼：你不知道队友，队友也不能确认你。\n这种局里要靠任务、投票和发言自己判断谁可能是队友。",
  爪牙: "阵营：邪恶。\n你没有特殊技能，但你通常知道邪恶队友是谁。\n你的目标是配合队友让任务失败，或者混淆正义阵营的判断。\n新手可以先少暴露，多观察队友怎么发言和投票。",
  "兰斯洛特（正义）": "阵营：正义。\n这是变体角色，具体能力和阵营变化要看本局规则。\n新手先记住：你的目标仍然是帮助正义完成任务。\n如果规则涉及阵营变化，发言时要格外小心。",
  "兰斯洛特（邪恶）": "阵营：邪恶。\n这是变体角色，具体能力和阵营变化要看本局规则。\n你的目标是阻止正义完成任务，同时隐藏自己的邪恶身份。\n如果规则涉及阵营变化，尽量别让行为前后矛盾。"
};


Page({
  data: {
    activeRooms: [],
    activeRoomsLoading: false,
    reviewMode: false,
    connected: false,
    hasWelcomed: false,
    statusBarHeight: 20,
    navBarHeight: 44,
    navTotalHeight: 64,
    wsUrl: "",
    skinId: 'dark-gold',
    skinHomeBg: 'https://www.awalon.top/mp-assets/home-bg-optimized.jpg',
    skinInGameBg: 'https://www.awalon.top/mp-assets/in-game-bg-optimized.jpg',
    skinTableUrl: 'https://www.awalon.top/mp-assets/table.png?v=8',
    skinQuestSuccess: 'https://www.awalon.top/mp-assets/quest-success-420x300.png?v=5',
    skinQuestFail: 'https://www.awalon.top/mp-assets/quest-failed-420x300.png?v=5',
    clientId: "",
    authToken: "",
    loggedIn: false,
    nickname: "",
    avatar: "🐺",
    avatarImage: "",
    avatarText: "🐺",
    shareImagePath: "",
    shareImageKey: "",
    roomCodeInput: "",
    pendingShareRoomCode: "",
    atHome: true,
    maxPlayersOptions: ["5人", "6人", "7人", "8人", "9人", "10人"],
    maxPlayersIndex: 2,
    rolePresets: [],
    selectedPresetIndex: 0,
    allRoleOptions: [],
    selectedRoles: [],
    hostRole: "随机",
    hostRoleOptions: [],
    ladyOfLakeEnabled: false,
    speakingSeconds: 120,
    speakingSecondsOptions: SPEAKING_SECONDS_OPTIONS,
    evilRoleVisibleEnabled: false,
    oberonVisibleEnabled: false,
    aiVoiceEnabled: false,
    forceRoundMode: "fixed5",
    forceRoundOptions: FORCE_ROUND_OPTIONS,
    showAdvancedSettings: false,
    room: null,
    teamPhaseKey: "",
    seatSlots: [],
    roundSeats: [],
    seatNotes: {},
    noteLabels: NOTE_LABELS,
    noteModal: { show: false, seatIndex: -1, seat: 0, name: "", label: "", ringStyle: "", labelColor: "", labelBg: "", labelBorder: "" },
    noteChipsGood: [],
    noteChipsEvil: [],
    assassinAnim: null,
    roleInfo: null,
    roleInfoLoading: false,
    assassinSeatNo: 0,
    showRolePanel: false,
    identityMode: false,
    canViewIdentity: false,
    roleVisibleSeats: [],
    roleInfoImage: "",
    roleInfoClass: "",
    roleFactionText: "",
    roleRequested: false,
    myRole: "",
    identityRevealSeen: false,
    identityRevealVisible: false,
    identityRevealPhase: "flip",
    selectedTeam: [],
    teamConfirmed: false,
    leaderActionText: "提交队伍",
    leaderActionDisabled: true,
    leaderActionClass: "",
    teamCandidates: [],
    currentVoteTeam: [],
    selectedAssassinate: "",
    assassinateCount: 0,
    speakText: "",
    speakTextLen: 0,
    speakingSeat: 0,
    speakingAvatarImage: '',
    speakingAvatarText: '🙂',
    speakingRemainingSec: 0,
    speakingTotalSec: 180,
    speakingProgress: 0,
    speakingUrgent: false,
    speakingTimerText: "0:00",
    isMyTurn: false,
    speakMessages: [],
    speakKeys: [],
    speakRoundView: "",
    speakRoundIdx: 0,
    showSpeakPanel: true,
    showPlayerList: false,
    showRoomSettings: false,
    showConfigHelp: false,
    roleGuideModal: null,
    cheatPressingPlayerId: "",
    cheatPendingPlayerId: "",
    cheatRevealPlayerId: "",
    cheatRoles: {},
    gameTip: "开始游戏后，这里会显示阶段控制。",
    phasePrompt: null,
    phase: "",
    isHost: false,
    isLeader: false,
    leaderSeat: 0,
    teamSize: 0,
    myVoted: false,
    inTeam: false,
    myMissionDone: false,
    isAssassin: false,
    myAutoplay: false,
    autoplayAssassinTarget: null,
    showAutoplayPicker: false,
    autoplayPickerSlots: [],
    hintVisible: false,
    hintKey: "",
    hintTitle: "",
    hintText: "",
    isLadyHolder: false,
    ladyHolderName: "",
    ladyHistory: [],
    ladyTargets: [],
    selectedLadyTarget: "",
    roomConfigLines: [],
    roomConfigHelpLines: [],
    roomRoleCards: [],
    advancedRoleSummary: "",
    advancedQuotaText: "",
    currentRoleChips: [],
    goodChipCount: 0,
    evilChipCount: 0,
    neededGood: 4,
    neededEvil: 3,
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
    isCurrentForcedAttempt: false,
    endMedals: [],
    loginTip: "请先登录，再做后续房间功能迁移。",
    roomTip: "登录后可创建或加入房间。",
    showRecapModal: false,
    recapReady: false,
    recapGenerating: false,
    recapRequested: false,
    recapList: [],
    recapIndex: 0,
    showMissionProgress: false,
    missionProgressTeam: [],
    missionVotedCount: 0,
    missionProgressRound: 0,
    missionAllVoted: false,
  },

  onLoad(options) {
    const app = getApp();
    const wsUrl = app.globalData.wsUrl;
    const nav = app.globalData.nav || {};
    // Load skin and register change listener
    const _skinId = app.globalData.skinId || 'dark-gold';
    const _skin = getSkin(_skinId);
    this.setData({ skinId: _skinId, skinHomeBg: _skin.homeBg, skinInGameBg: _skin.inGameBg, skinTableUrl: _skin.table, skinQuestSuccess: _skin.questSuccess, skinQuestFail: _skin.questFail });
    app.globalData.skinChangeListener = (newSkinId) => {
      const skin = getSkin(newSkinId);
      this.setData({ skinId: newSkinId, skinHomeBg: skin.homeBg, skinInGameBg: skin.inGameBg, skinTableUrl: skin.table, skinQuestSuccess: skin.questSuccess, skinQuestFail: skin.questFail });
    };
    // 审核模式：已加载则直接用，否则等回调
    if (app.globalData.reviewMode) {
      this.setData({ reviewMode: true });
    } else {
      app.globalData.reviewModeListener = (on) => this.setData({ reviewMode: on });
    }
    const token = wx.getStorageSync("awalonAuthToken") || "";
    const nickname = wx.getStorageSync("awalonNickname") || "";
    const avatar = wx.getStorageSync("awalonAvatar") || "🐺";
    const avatarMeta = this.avatarMeta(avatar);
    const sharedRoomCode = this.normalizeRoomCode(options && options.roomCode);
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
      roomCodeInput: sharedRoomCode || "",
      pendingShareRoomCode: sharedRoomCode || "",
      allRoleOptions: ROLE_ORDER.map((role) => ({
        role,
        image: roleImageFor(role)
      })),
      rolePresets: this.presetsForCount(7),
      selectedPresetIndex: 0,
      selectedRoles: this.presetsForCount(7)[0].roles.slice(),
      hostRoleOptions: this.withRoleImages(this.uniqueRoles(this.defaultRolesForCount(7))),
      advancedRoleSummary: this.formatAdvancedRoleSummary(this.defaultRolesForCount(7)),
      advancedQuotaText: this.formatAdvancedQuotaText(7),
      currentRoleChips: this.buildCurrentRoleChips(this.defaultRolesForCount(7)),
      goodChipCount: this.countRolesByFaction(this.defaultRolesForCount(7)).good,
      evilChipCount: this.countRolesByFaction(this.defaultRolesForCount(7)).evil,
      neededGood: this.expectedGoodCount(7),
      neededEvil: this.expectedEvilCount(7)
    });
    if (sharedRoomCode) {
      this.setData({ roomTip: `已识别分享房间 ${sharedRoomCode}，登录后将自动加入。` });
    }
    this.ensureShareInviteImage(null);
    // 若 roleConfig 已加载则立即重建，否则注册回调等 config 到达
    const existingConfig = app.globalData.roleConfig;
    if (existingConfig && Object.keys(existingConfig).length > 0) {
      this._rebuildRoleChips();
    } else {
      app.globalData.roleConfigListener = () => { this._rebuildRoleChips(); };
    }
    this.connect(wsUrl);
    this.fetchActiveRooms();
    this._speakTicker = setInterval(() => {
      if (this.data.room && this.data.phase === "speaking") {
        this.refreshSpeakingProgress(this.data.room);
      }
    }, 1000);
  },

  onShow() {
    if (!this.data.wsUrl) return;
    if (!this.data.connected) {
      // 切回前台时如果断连，短暂延迟后重连（给 CONNECTING 状态的连接一点时间建立）
      this._reconnectDelay = 1000;
      if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
      this._reconnectTimer = setTimeout(() => {
        this._reconnectTimer = null;
        if (!this.data.connected && this.data.wsUrl) this.connect(this.data.wsUrl);
      }, 300);
    } else {
      this.requestRoomRecovery();
    }
    this.startRoomsPolling();
  },

  onHide() {
    this.stopRoomsPolling();
  },

  startRoomsPolling() {
    this.stopRoomsPolling();
    this.fetchActiveRooms();
    this._roomsPoller = setInterval(() => {
      if (this.data.atHome) this.fetchActiveRooms();
    }, 10000);
  },

  stopRoomsPolling() {
    if (this._roomsPoller) {
      clearInterval(this._roomsPoller);
      this._roomsPoller = null;
    }
  },

  _handleAiVoiceRequest(personaKey, text, playerId, audioBase64) {
    const done = () => this.send('VOICE_DONE', {});
    const playFile = (tmpPath) => {
      if (this._aiAudioCtx) {
        try { this._aiAudioCtx.destroy(); } catch (e) {}
        this._aiAudioCtx = null;
      }
      const fs = wx.getFileSystemManager();
      const ctx = wx.createInnerAudioContext();
      ctx.src = tmpPath;
      ctx.onEnded(() => { ctx.destroy(); fs.unlink({ filePath: tmpPath, fail: () => {} }); done(); });
      ctx.onError((e) => { console.log('[voice] audio error', e); ctx.destroy(); fs.unlink({ filePath: tmpPath, fail: () => {} }); done(); });
      ctx.play();
      this._aiAudioCtx = ctx;
    };
    const saveAndPlay = (arrayBuffer) => {
      const fs = wx.getFileSystemManager();
      const tmpPath = `${wx.env.USER_DATA_PATH}/ai_voice_${Date.now()}.wav`;
      fs.writeFile({ filePath: tmpPath, data: arrayBuffer, success: () => playFile(tmpPath), fail: () => done() });
    };

    // 服务端已合成：直接解码播放，无需再调 voice service
    if (audioBase64) {
      console.log('[voice] server audio received, playing directly');
      try {
        const buf = wx.base64ToArrayBuffer(audioBase64);
        saveAndPlay(buf);
      } catch (e) {
        console.warn('[voice] base64 decode fail', e);
        done();
      }
      return;
    }

    // 兜底：服务端未合成时客户端自行合成（保留旧逻辑）
    console.log('[voice] no server audio, client synthesizing', personaKey);
    wx.request({
      url: 'https://voice.zhuchao.life/synthesize_cached',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { tts_text: text, contact_id: personaKey },
      responseType: 'arraybuffer',
      timeout: 60000,
      success: (res) => {
        if (res.statusCode !== 200) { done(); return; }
        saveAndPlay(res.data);
      },
      fail: (e) => { console.log('[voice] request fail', e); done(); },
    });
  },

  _prefetchAiVoice(personaKey, text, playerId) {
    if (!this._voiceCache) this._voiceCache = {};
    const cacheKey = playerId || personaKey;
    if (this._voiceCache[cacheKey]) return; // already prefetching
    console.log('[voice] prefetching', personaKey);
    const entry = { ready: false, path: null, onReady: null };
    this._voiceCache[cacheKey] = entry;
    const synText = text.slice(0, 40);
    wx.request({
      url: 'https://voice.zhuchao.life/synthesize_cached',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { tts_text: synText, contact_id: personaKey },
      responseType: 'arraybuffer',
      timeout: 60000,
      success: (res) => {
        if (res.statusCode !== 200) {
          entry.ready = true;
          if (entry.onReady) entry.onReady(null);
          return;
        }
        const fs = wx.getFileSystemManager();
        const tmpPath = `${wx.env.USER_DATA_PATH}/ai_voice_pre_${Date.now()}.wav`;
        fs.writeFile({
          filePath: tmpPath,
          data: res.data,
          success: () => {
            entry.path = tmpPath;
            entry.ready = true;
            console.log('[voice] prefetch ready', personaKey);
            if (entry.onReady) entry.onReady(tmpPath);
          },
          fail: () => {
            entry.ready = true;
            if (entry.onReady) entry.onReady(null);
          },
        });
      },
      fail: (e) => {
        console.log('[voice] prefetch fail', e);
        entry.ready = true;
        if (entry.onReady) entry.onReady(null);
      },
    });
  },

  _clearVoiceCache() {
    if (!this._voiceCache) return;
    const fs = wx.getFileSystemManager();
    for (const entry of Object.values(this._voiceCache)) {
      if (entry.ready && entry.path) {
        fs.unlink({ filePath: entry.path, fail: () => {} });
      }
    }
    this._voiceCache = {};
  },

  onUnload() {
    this._clearVoiceCache();
    this.stopRoomsPolling();
    if (this._identityRevealTimer) {
      clearTimeout(this._identityRevealTimer);
      this._identityRevealTimer = null;
    }
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
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  },

  normalizeRoomCode(roomCode) {
    const code = String(roomCode || "").trim();
    return /^\d{5}$/.test(code) ? code : "";
  },

  getSeatNo(room, playerId, snapshot) {
    if (!playerId) return null;
    const snapSeat = Number(snapshot && snapshot[playerId]);
    if (Number.isFinite(snapSeat) && snapSeat > 0) return snapSeat;
    const players = Array.isArray(room && room.players) ? room.players : [];
    const player = players.find((item) => item && item.id === playerId);
    if (player && Number.isFinite(player.seat)) return player.seat + 1;
    const seats = Array.isArray(room && room.seats) ? room.seats : [];
    const seatIndex = seats.findIndex((id) => id === playerId);
    return seatIndex >= 0 ? seatIndex + 1 : null;
  },

  formatSeatList(room, ids, snapshot) {
    const seats = (Array.isArray(ids) ? ids : [])
      .map((id) => this.getSeatNo(room, id, snapshot))
      .filter((seat) => Number.isFinite(seat) && seat > 0)
      .sort((a, b) => a - b);
    return seats.length ? seats.join(",") : "-";
  },

  isSpectatorInRoom(room, playerId) {
    if (!room || !playerId || !Array.isArray(room.players)) return false;
    const player = room.players.find((item) => item && item.id === playerId);
    if (!player) return false;
    if (player.spectator) return true;
    const seat = Number.isFinite(player.seat) ? player.seat + 1 : this.getSeatNo(room, playerId, null);
    return !seat || seat <= 0;
  },

  canViewIdentityInRoom(room, playerId) {
    if (!room || !room.started || !playerId) return false;
    return !this.isSpectatorInRoom(room, playerId);
  },

  tryJoinPendingSharedRoom() {
    const roomCode = this.normalizeRoomCode(this.data.pendingShareRoomCode);
    if (!roomCode || !this.data.loggedIn || this.data.room) return false;
    this.send("JOIN_ROOM", { roomCode, avatar: this.data.avatar || "🐺" });
    this.setData({
      pendingShareRoomCode: "",
      roomCodeInput: roomCode,
      atHome: false,
      roomTip: `加入房间 ${roomCode} 请求已发送...`
    });
    return true;
  },

  buildSharePayload() {
    const room = this.data.room || null;
    const roomCode = this.normalizeRoomCode(room && room.code);
    const modeText = room && room.ladyOfLakeEnabled ? "湖中仙女" : "标准局";
    const playerText = room && room.maxPlayers ? `${room.maxPlayers}人局` : "";
    const title = roomCode
      ? `${playerText} · ${modeText}｜房间 ${roomCode}，点击直接加入`
      : "来 Avalon 一起开一局";
    const path = roomCode ? `/pages/index/index?roomCode=${roomCode}` : "/pages/index/index";
    return {
      title,
      path,
      query: roomCode ? `roomCode=${roomCode}` : "",
      imageUrl: this.data.shareImagePath || ""
    };
  },

  async resolveShareAvatarPath() {
    const avatarUrl = this.data.avatarImage || "";
    if (!avatarUrl) return "";
    try {
      const info = await new Promise((resolve, reject) => {
        wx.getImageInfo({
          src: avatarUrl,
          success: resolve,
          fail: reject
        });
      });
      return (info && info.path) || "";
    } catch (err) {
      return "";
    }
  },

  drawRoundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  },

  getCanvas2DNode(selector, width, height) {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery().in(this);
      query.select(selector).fields({ node: true, size: true }).exec((res) => {
        const item = res && res[0];
        const canvas = item && item.node;
        if (!canvas) {
          reject(new Error(`CANVAS_NOT_FOUND:${selector}`));
          return;
        }
        const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || wx.getSystemInfoSync().pixelRatio || 1;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        resolve({ canvas, ctx, dpr });
      });
    });
  },

  loadCanvasImage(canvas, src) {
    return new Promise((resolve, reject) => {
      const image = canvas.createImage();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  },

  exportCanvasTempFile(canvas, width, height, quality) {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        x: 0,
        y: 0,
        width,
        height,
        destWidth: width,
        destHeight: height,
        fileType: "jpg",
        quality,
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      });
    });
  },

  async drawShareInviteCard(room, options) {
    const { canvas, ctx } = await this.getCanvas2DNode("#shareInviteCanvas", options.width, options.height);
    const avatarPath = options.avatarPath || "";

    const bg = ctx.createLinearGradient(0, 0, options.width, options.height);
    options.backgroundStops.forEach(([offset, color]) => bg.addColorStop(offset, color));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, options.width, options.height);

    if (options.glow) {
      const glow = ctx.createRadialGradient(
        options.glow.innerX,
        options.glow.innerY,
        options.glow.innerRadius,
        options.glow.outerX,
        options.glow.outerY,
        options.glow.outerRadius
      );
      options.glow.stops.forEach(([offset, color]) => glow.addColorStop(offset, color));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, options.width, options.height);
    }

    ctx.fillStyle = options.cardFill;
    this.drawRoundRect(ctx, options.cardRect.x, options.cardRect.y, options.cardRect.width, options.cardRect.height, options.cardRect.radius);
    ctx.fill();

    ctx.strokeStyle = options.cardStroke;
    ctx.lineWidth = options.cardStrokeWidth;
    this.drawRoundRect(ctx, options.cardRect.x, options.cardRect.y, options.cardRect.width, options.cardRect.height, options.cardRect.radius);
    ctx.stroke();

    if (options.innerStrokeRect) {
      ctx.strokeStyle = options.innerStrokeColor;
      ctx.lineWidth = options.innerStrokeWidth;
      this.drawRoundRect(
        ctx,
        options.innerStrokeRect.x,
        options.innerStrokeRect.y,
        options.innerStrokeRect.width,
        options.innerStrokeRect.height,
        options.innerStrokeRect.radius
      );
      ctx.stroke();
    }

    if (options.titleBadgeRect) {
      ctx.fillStyle = options.titleBadgeFill;
      this.drawRoundRect(
        ctx,
        options.titleBadgeRect.x,
        options.titleBadgeRect.y,
        options.titleBadgeRect.width,
        options.titleBadgeRect.height,
        options.titleBadgeRect.radius
      );
      ctx.fill();
    }

    ctx.fillStyle = options.titleColor;
    ctx.font = options.titleFont;
    ctx.fillText(options.titleText, options.titleX, options.titleY);

    if (options.decorations && options.decorations.length) {
      options.decorations.forEach((draw) => draw(ctx, room, options));
    }

    ctx.fillStyle = options.avatarFrameFill;
    this.drawRoundRect(
      ctx,
      options.avatarFrameRect.x,
      options.avatarFrameRect.y,
      options.avatarFrameRect.width,
      options.avatarFrameRect.height,
      options.avatarFrameRect.radius
    );
    ctx.fill();

    ctx.save();
    this.drawRoundRect(
      ctx,
      options.avatarClipRect.x,
      options.avatarClipRect.y,
      options.avatarClipRect.width,
      options.avatarClipRect.height,
      options.avatarClipRect.radius
    );
    ctx.clip();
    if (avatarPath) {
      const avatarImage = await this.loadCanvasImage(canvas, avatarPath);
      ctx.drawImage(avatarImage, options.avatarClipRect.x, options.avatarClipRect.y, options.avatarClipRect.width, options.avatarClipRect.height);
    } else {
      ctx.fillStyle = options.avatarFallbackFill;
      ctx.fillRect(options.avatarClipRect.x, options.avatarClipRect.y, options.avatarClipRect.width, options.avatarClipRect.height);
      ctx.fillStyle = options.avatarFallbackTextColor;
      ctx.font = options.avatarFallbackFont;
      ctx.fillText(this.data.avatarText || "🙂", options.avatarFallbackTextX, options.avatarFallbackTextY);
    }
    ctx.restore();

    options.textBlocks.forEach((block) => {
      ctx.fillStyle = block.color;
      ctx.font = block.font;
      ctx.fillText(block.text, block.x, block.y);
    });

    return this.exportCanvasTempFile(canvas, options.width, options.height, options.quality || 0.92);
  },

  async renderFallbackShareInviteImage(room, imageKey, taskId) {
    const roomCode = this.normalizeRoomCode(room && room.code);
    const width = 500;
    const height = 400;
    const modeText = room && room.ladyOfLakeEnabled ? "湖中仙女" : "标准局";
    const playerText = room && room.maxPlayers ? `${room.maxPlayers}人局` : "多人联机局";
    const avatarPath = await this.resolveShareAvatarPath();
    const tempFilePath = await this.drawShareInviteCard(room, {
      width,
      height,
      avatarPath,
      quality: 0.92,
      backgroundStops: [
        [0, "#1a2231"],
        [1, "#0d1118"]
      ],
      cardFill: "rgba(18,22,30,0.96)",
      cardRect: { x: 28, y: 28, width: 444, height: 344, radius: 30 },
      cardStroke: "rgba(228,194,129,0.5)",
      cardStrokeWidth: 2,
      titleText: "AWALON INVITE",
      titleColor: "#f0d8a3",
      titleFont: "24px sans-serif",
      titleX: 156,
      titleY: 84,
      avatarFrameFill: "rgba(228,194,129,0.12)",
      avatarFrameRect: { x: 58, y: 94, width: 78, height: 78, radius: 39 },
      avatarClipRect: { x: 62, y: 98, width: 70, height: 70, radius: 35 },
      avatarFallbackFill: "#243041",
      avatarFallbackTextColor: "#f6e7c7",
      avatarFallbackFont: "28px sans-serif",
      avatarFallbackTextX: 79,
      avatarFallbackTextY: 144,
      textBlocks: [
        { text: `${this.data.nickname || "Avalon 玩家"} 邀请你加入`, x: 156, y: 128, color: "rgba(238,241,247,0.82)", font: "24px sans-serif" },
        { text: `${playerText} · ${modeText}`, x: 156, y: 160, color: "rgba(238,241,247,0.82)", font: "20px sans-serif" },
        { text: roomCode ? "房间号" : "立即开局", x: 60, y: 250, color: "#d7b06a", font: "22px sans-serif" },
        { text: roomCode || "AWALON", x: 60, y: 325, color: "#ffffff", font: "72px sans-serif" },
        {
          text: roomCode ? "点击卡片后可直接加入该房间" : "点击卡片后可直接进入 Avalon",
          x: 60,
          y: 360,
          color: "rgba(238,241,247,0.72)",
          font: "20px sans-serif"
        }
      ]
    });
    if (this._shareImageTaskId !== taskId) return;
    this.setData({ shareImagePath: tempFilePath, shareImageKey: imageKey });
  },

  async ensureShareInviteImage(roomArg) {
    const room = roomArg || this.data.room;
    const roomCode = this.normalizeRoomCode(room && room.code);
    const imageKey = [
      roomCode || "default",
      (room && room.maxPlayers) || "",
      room && room.ladyOfLakeEnabled ? "lady" : "std",
      this.data.avatarImage || "",
      this.data.avatarText || ""
    ].join("|");
    if (this.data.shareImageKey === imageKey) return;
    const taskId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this._shareImageTaskId = taskId;
    try {
      const avatarPath = await this.resolveShareAvatarPath();
      const width = 500;
      const height = 400;
      const modeText = room && room.ladyOfLakeEnabled ? "湖中仙女" : "标准局";
      const playerText = room && room.maxPlayers ? `${room.maxPlayers}人局` : "多人联机局";
      const inviterText = `${this.data.nickname || "Avalon 玩家"} 邀请你加入`;
      const tempFilePath = await this.drawShareInviteCard(room, {
        width,
        height,
        avatarPath,
        quality: 0.92,
        backgroundStops: [
          [0, "#161d2b"],
          [0.55, "#0f1520"],
          [1, "#090d14"]
        ],
        glow: {
          innerX: 360,
          innerY: 90,
          innerRadius: 10,
          outerX: 360,
          outerY: 90,
          outerRadius: 220,
          stops: [
            [0, "rgba(217,179,107,0.22)"],
            [1, "rgba(217,179,107,0)"]
          ]
        },
        cardFill: (() => {
          const card = { x1: 34, y1: 34, x2: 466, y2: 366, stops: [[0, "rgba(27,34,47,0.98)"], [1, "rgba(14,18,26,0.98)"]] };
          return card;
        })(),
        cardRect: { x: 24, y: 24, width: 452, height: 352, radius: 30 },
        cardStroke: "rgba(228,194,129,0.7)",
        cardStrokeWidth: 2,
        innerStrokeRect: { x: 34, y: 34, width: 432, height: 332, radius: 24 },
        innerStrokeColor: "rgba(228,194,129,0.22)",
        innerStrokeWidth: 1,
        titleBadgeRect: { x: 52, y: 52, width: 190, height: 42, radius: 21 },
        titleBadgeFill: "rgba(228,194,129,0.16)",
        titleText: "AWALON INVITE",
        titleColor: "#f0d8a3",
        titleFont: "22px sans-serif",
        titleX: 72,
        titleY: 79,
        avatarFrameFill: "rgba(228,194,129,0.14)",
        avatarFrameRect: { x: 54, y: 116, width: 96, height: 96, radius: 48 },
        avatarClipRect: { x: 56, y: 120, width: 88, height: 88, radius: 44 },
        avatarFallbackFill: "#243041",
        avatarFallbackTextColor: "#f6e7c7",
        avatarFallbackFont: "34px sans-serif",
        avatarFallbackTextX: 81,
        avatarFallbackTextY: 175,
        decorations: [
          (ctxRef, currentRoom) => {
            ctxRef.fillStyle = "rgba(255,255,255,0.06)";
            ctxRef.beginPath();
            ctxRef.arc(352, 230, 92, 0, Math.PI * 2);
            ctxRef.fill();
            ctxRef.strokeStyle = "rgba(228,194,129,0.18)";
            ctxRef.lineWidth = 3;
            ctxRef.beginPath();
            ctxRef.arc(352, 230, 92, 0, Math.PI * 2);
            ctxRef.stroke();
            ctxRef.strokeStyle = "rgba(228,194,129,0.1)";
            ctxRef.lineWidth = 1;
            ctxRef.beginPath();
            ctxRef.arc(352, 230, 68, 0, Math.PI * 2);
            ctxRef.stroke();
            const seatDots = [
              [352, 126], [417, 155], [444, 222], [418, 288], [352, 318], [286, 288], [260, 222], [287, 155]
            ];
            seatDots.slice(0, Math.max(5, Math.min(seatDots.length, Number(currentRoom.maxPlayers) || 7))).forEach(([x, y]) => {
              ctxRef.fillStyle = "rgba(228,194,129,0.24)";
              ctxRef.beginPath();
              ctxRef.arc(x, y, 12, 0, Math.PI * 2);
              ctxRef.fill();
            });
          }
        ],
        textBlocks: [
          { text: inviterText, x: 168, y: 150, color: "#f7ead0", font: "26px sans-serif" },
          { text: `${playerText} · ${modeText}`, x: 168, y: 182, color: "rgba(238,241,247,0.72)", font: "20px sans-serif" },
          { text: "圆桌已就位", x: 310, y: 228, color: "#d7b06a", font: "18px sans-serif" },
          { text: "点击卡片后直接进入房间", x: 278, y: 254, color: "rgba(238,241,247,0.78)", font: "16px sans-serif" },
          { text: roomCode ? "房间号" : "立即开局", x: 56, y: 264, color: "#d7b06a", font: "22px sans-serif" },
          { text: roomCode || "AWALON", x: 56, y: 330, color: "#ffffff", font: "68px sans-serif" },
          {
            text: roomCode ? "微信打开后可直接加入该房间" : "微信打开后可直接进入 Avalon",
            x: 56,
            y: 362,
            color: "rgba(238,241,247,0.72)",
            font: "20px sans-serif"
          }
        ]
      });
      if (this._shareImageTaskId !== taskId) return;
      this.setData({ shareImagePath: tempFilePath, shareImageKey: imageKey });
    } catch (err) {
      try {
        await this.renderFallbackShareInviteImage(room, imageKey, taskId);
      } catch (fallbackErr) {
        if (this._shareImageTaskId !== taskId) return;
        this.setData({ shareImagePath: "", shareImageKey: imageKey });
      }
    }
  },

  connect(url) {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnectDelay = this._reconnectDelay || 1000;

    socket.connect(url, {
      onOpen: () => {
        this._reconnectDelay = 1000; // 重置退避延迟
        this.setData({ connected: true });
        const token = this.data.authToken;
        if (token) {
          socket.send({ type: "AUTH", payload: { token } });
        }
      },
      onClose: (code) => {
        this.setData({ connected: false });
        // 被其他设备顶掉，不重连，提示用户
        if (code === 4001) {
          wx.removeStorageSync('awalonAuthToken');
          this.setData({ atHome: true, room: null, loggedIn: false, loginTip: '账号已在其他设备登录' });
          wx.showModal({
            title: '已被顶替下线',
            content: '你的账号已在另一台设备登录，当前设备已退出。',
            showCancel: false,
          });
          return;
        }
        // 自动重连：指数退避，最长 16s
        const delay = this._reconnectDelay || 1000;
        this._reconnectDelay = Math.min(delay * 2, 16000);
        this._reconnectTimer = setTimeout(() => {
          if (!this.data.connected && this.data.wsUrl) {
            this.connect(this.data.wsUrl);
          }
        }, delay);
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
          if (this.tryJoinPendingSharedRoom()) {
            return;
          }
          if (!recovered) {
            this.requestRoomRecovery();
          }
          return;
        }
        if (msg.type === "ROOM_STATE" && msg.room) {
          const room = msg.room;
          const prevRoom = this.data.room;
          const prevPhase = prevRoom ? (prevRoom.phase || "") : "";
          // clear notes when game resets (started → not started)
          if (prevRoom && prevRoom.started && !room.started) {
            this.setData({ seatNotes: {}, myAutoplay: false, autoplayAssassinTarget: null });
            this.hideIdentityReveal(false);
            this.setData({ showRolePanel: false, identityMode: false });
          }
          // 新开局或重新发牌时，重置身份过场
          const isFreshGameStart = !!(prevRoom && !prevRoom.started && room.started);
          const prevGameVersion = prevRoom && prevRoom.game ? Number(prevRoom.game.gameVersion || 0) : 0;
          const nextGameVersion = room && room.game ? Number(room.game.gameVersion || 0) : 0;
          // 重新发牌会保持 started=true，但 gameVersion 会刷新
          const isRedealStart = !!(
            prevRoom &&
            prevRoom.started &&
            room.started &&
            prevGameVersion &&
            nextGameVersion &&
            nextGameVersion !== prevGameVersion
          );
          const shouldForceRefreshRole = !!(isFreshGameStart || isRedealStart);
          if (shouldForceRefreshRole) {
            this.clearRoleState(false);
          }
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
          const selectedLadyTarget =
            currentPhase === "lady"
              ? this.keepValidLadyTarget(room, this.data.selectedLadyTarget)
              : "";
          const isForcedAttempt = isCurrentForcedAttempt(room);
          const seatSlots = this.buildSeatSlots(room, selectedTeam, selectedAssassinate, null, selectedLadyTarget);
          const isSpectator = this.isSpectatorInRoom(room, this.data.clientId);
          const canViewIdentity = this.canViewIdentityInRoom(room, this.data.clientId);
          const playerCards = this.buildPlayerCards(room);
          const roomConfigState = this.data.showRoomSettings ? {} : this.buildEditableConfigFromRoom(room);
          this.setData({
            room,
            ...roomConfigState,
            teamPhaseKey: nextTeamPhaseKey || this.data.teamPhaseKey,
            selectedTeam,
            teamConfirmed,
            ...leaderAction,
            selectedAssassinate,
            selectedLadyTarget,
            assassinateCount: selectedAssassinate ? 1 : 0,
            isCurrentForcedAttempt: isForcedAttempt,
            seatSlots,
            roundSeats: this.buildRoundSeats(seatSlots, room.maxPlayers || 7),
            teamCandidates: this.buildTeamCandidates(room, selectedTeam),
            playerCards,
            ...this.buildSpeakViewState(room, this.data.speakRoundView),
            isSpectator,
            canViewIdentity,
            roomTip: isSpectator ? `正在观战房间 ${room.code}` : `已进入房间 ${room.code}`
          }, () => {
            if (shouldForceRefreshRole && room && room.started) {
              this.setData({ roleRequested: true });
              this.send("VIEW_ROLE");
            }
            this.ensureShareInviteImage(room);
          });
          this.refreshGameState(room);
          this.maybeShowMissionResultAnim(room);
          this.maybeShowPhasePrompt(room);
          this.maybeShowAssassinAnim(room, prevRoom);
          this.maybeShowRecap(room, prevRoom);
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
        if (msg.type === "HISTORY_RECAP_GENERATING") {
          const app = getApp();
          if (typeof app.globalData.historyRecapGeneratingListener === "function") {
            app.globalData.historyRecapGeneratingListener(msg.data && msg.data.gameId);
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
          const currentGameVersion = this.data.room && this.data.room.game ? Number(this.data.room.game.gameVersion || 0) : 0;
          const infoGameVersion = Number(info.gameVersion || 0);
          if (currentGameVersion && infoGameVersion && currentGameVersion !== infoGameVersion) {
            return;
          }
          const assassinSeatNo = Number(info.assassinSeatNo) || 0;
          const roleVisibleSeats = this.buildRoleVisibleSeats(info, assassinSeatNo);
          this.setData({
            roleInfo: info,
            roleInfoLoading: false,
            roleVisibleSeats,
            assassinSeatNo,
            roleInfoImage: roleImageFor(info.role),
            roleInfoClass: roleClassFor(info.role),
            roleFactionText: EVIL_ROLES.has(info.role) ? "邪恶阵营" : "正义阵营",
            myRole: info.role || this.data.myRole,
            isAssassin: !!info.isAssassin,
            gameTip: `身份：${info.role || "未知"}`
          });
          if (!this.data.identityRevealVisible || this.data.identityRevealSeen) {
            this.hideIdentityReveal(false);
          }
          // 用最新的 roleVisibleSeats 重建圆桌座位，使 identityClass 生效
          const room = this.data.room;
          if (room) {
            const seatSlots = this.buildSeatSlots(room, this.data.selectedTeam, this.data.selectedAssassinate, roleVisibleSeats);
            this.setData({ seatSlots, roundSeats: this.buildRoundSeats(seatSlots, room.maxPlayers || 7) });
          }
          return;
        }
        if (msg.type === "ROLE_RESET") {
          const nextGameVersion = Number(msg.data && msg.data.gameVersion || 0);
          const currentGameVersion = this.data.room && this.data.room.game ? Number(this.data.room.game.gameVersion || 0) : 0;
          if (currentGameVersion && nextGameVersion && nextGameVersion < currentGameVersion) {
            return;
          }
          this.clearRoleState(false);
          return;
        }
        if (msg.type === "LADY_OF_LAKE_RESULT") {
          const data = msg.data || {};
          const targetName = data.targetNickname || "未知玩家";
          const alignment = data.alignment === "evil" ? "邪恶" : "正义";
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
        if (msg.type === "KICKED") {
          this.setData({ room: null, atHome: true, seatNotes: {}, showMissionProgress: false, showMissionAnim: false });
          wx.showModal({ title: "已被踢出", content: "房主已将你移出房间", showCancel: false, confirmText: "好的" });
          return;
        }
        if (msg.type === "AI_VOICE_REQUEST") {
          this._handleAiVoiceRequest(msg.personaKey, msg.text, msg.playerId, msg.audioBase64);
          return;
        }
        if (msg.type === "AI_VOICE_PREFETCH") {
          this._prefetchAiVoice(msg.personaKey, msg.text, msg.playerId);
          return;
        }
        if (msg.type === "ROOM_DISSOLVED") {
          const reason = (msg.payload && msg.payload.reason) || "房间已解散";
          this.setData({ room: null, atHome: true, seatNotes: {}, showMissionProgress: false, showMissionAnim: false });
          wx.showToast({ title: reason, icon: "none", duration: 2000 });
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
          // 服务器重启导致 session 失效 → 自动退出登录状态，让用户重新登录
          if (code === "INVALID_TOKEN") {
            this.setData({ loggedIn: false, room: null, atHome: true, loginTip: "服务已重启，请重新登录", roomTip: "" });
            wx.removeStorageSync("awalonAuthToken");
            return;
          }
          this.setData({ loginTip: tip, roomTip: tip });
          if (code === "HISTORY_NOT_FOUND" || code === "INVALID_GAME_ID") {
            const app = getApp();
            if (typeof app.globalData.historyDetailListener === "function") {
              app.globalData.historyDetailListener(null);
            }
            return;
          }
          if (code === "ROOM_NOT_FOUND") {
            // 服务重启后房间已不存在，清空本地房间状态避免重连死循环
            this.setData({ room: null });
            wx.showToast({ title: "房间已不存在", icon: "none", duration: 2000 });
            return;
          }
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

  keepValidLadyTarget(room, targetId) {
    if (!targetId) return "";
    const targets = this.buildLadyTargets(room);
    return targets.some((item) => item.id === targetId) ? targetId : "";
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
        leaderActionDisabled: true,
        leaderActionClass: ""
      };
    }
    if (phase === "team") {
      return {
        leaderActionText: "提交队伍",
        leaderActionDisabled: false,
        leaderActionClass: ""
      };
    }
    if (phase === "speaking") {
      return {
        leaderActionText: teamConfirmed ? "发起队伍投票" : "提交队伍",
        leaderActionDisabled: false,
        leaderActionClass: teamConfirmed ? "center-leader-btn-vote" : ""
      };
    }
    return {
      leaderActionText: `选择队员 ${selectedCount}/${teamSize}`,
      leaderActionDisabled: true,
      leaderActionClass: ""
    };
  },

  refreshGameState(roomArg) {
    const room = roomArg || this.data.room;
    const clientId = this.data.clientId;
    const game = room && room.game ? room.game : null;
    const phase = room && room.phase ? room.phase : "";
    const isHost = !!(room && room.hostId === clientId);
    const isSuperPlayer = !!(room && room._isSuperPlayer);
    const isLeader = !!(game && game.leaderId === clientId);
    const leaderSeat = room && game && Array.isArray(room.seats) ? room.seats.findIndex((id) => id === game.leaderId) + 1 : 0;
    const teamSize = Number(game && game.teamSize ? game.teamSize : 0);
    const myVoted = !!(game && game.votes && game.votes[clientId] !== undefined);
    const inTeam = !!(game && Array.isArray(game.team) && game.team.includes(clientId));
    const myMissionDone = !!(game && game.missionVotes && game.missionVotes[clientId] !== undefined);
    const isAssassin = !!this.data.isAssassin;
    const myPlayer = room && Array.isArray(room.players) ? room.players.find((p) => p.id === clientId) : null;
    const canViewIdentity = this.canViewIdentityInRoom(room, clientId);
    const myAutoplay = myPlayer ? !!myPlayer.autoplay : this.data.myAutoplay;
    const missionRows = this.buildMissionRows(room);
    const missionPills = buildMissionPills(room);
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
    const speakingTotalSec = Number(room && room.speakingSeconds ? room.speakingSeconds : 120) || 120;
    let speakingRemainingSec = 0;
    if (phase === "speaking" && room && room.speaking && room.speaking.endAt) {
      speakingRemainingSec = Math.max(0, Math.floor((Number(room.speaking.endAt) - Date.now()) / 1000));
    }
    const speakingProgress = phase === "speaking" ? Math.max(0, Math.min(100, Math.floor((speakingRemainingSec / Math.max(1, speakingTotalSec)) * 100))) : 0;
    const speakingUrgent = speakingRemainingSec > 0 && speakingRemainingSec <= 15;
    const speakingTimerText = (() => { const s = speakingRemainingSec; return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); })();
    const speakingPlayer = speakingPlayerId && Array.isArray(room.players) ? room.players.find(p => p.id === speakingPlayerId) : null;
    const speakingAvatarMeta = speakingPlayer ? this.avatarMeta(speakingPlayer.avatar || '🙂', speakingPlayer) : null;
    const speakingAvatarImage = speakingAvatarMeta ? speakingAvatarMeta.image : '';
    const speakingAvatarText = speakingAvatarMeta ? (speakingAvatarMeta.text || '🙂') : '🙂';
    const selectedTeam = this.data.selectedTeam || [];
    const selectedLadyTarget = phase === "lady" ? this.keepValidLadyTarget(room, this.data.selectedLadyTarget) : "";
    const serverTeam = game && Array.isArray(game.team) ? this.keepValidSelectedTeam(room, game.team) : [];
    const teamConfirmed = !!(isLeader && phase === "speaking" && serverTeam.length === teamSize && this.sameTeam(selectedTeam, serverTeam));
    const leaderAction = this.deriveLeaderAction(phase, teamSize, selectedTeam, teamConfirmed);
    const phasePrompt = this.buildPhasePrompt(room, {
      phase,
      isLeader,
      leaderSeat,
      inTeam,
      myVoted,
      myMissionDone,
      isMyTurn,
      isLadyHolder,
      speakingPlayer,
      speakingSeat,
      ladyHolder,
      ladySeat,
      selectedLadyTarget,
      teamSize,
      selectedTeam,
      teamConfirmed
    });

    const speakView = this.buildSpeakViewState(room, this.data.speakRoundView);
    this.setData({
      phase,
      isHost,
      isSuperPlayer,
      isLeader,
      leaderSeat,
      teamSize,
      myVoted,
      inTeam,
      myMissionDone,
      isAssassin,
      canViewIdentity,
      myAutoplay,
      isLadyHolder,
      ladyHolderName: ladyHolder ? `${ladySeat}号 · ${ladyHolder.nickname}` : "",
      ladyTargets,
      ladyHistory,
      selectedLadyTarget,
      missionRows,
      missionPills,
      showCenterResult: resultInfo.show,
      centerResultText: resultInfo.title,
      centerResultSub: resultInfo.sub,
      endMedals,
      speakingSeat,
      speakingAvatarImage,
      speakingAvatarText,
      speakingRemainingSec,
      speakingTotalSec,
      speakingProgress,
      speakingUrgent,
      speakingTimerText,
      isMyTurn,
      phasePrompt,
      teamConfirmed,
      ...leaderAction,
      teamCandidates: this.buildTeamCandidates(room, selectedTeam),
      currentVoteTeam: this.buildCurrentVoteTeam(room),
      ...(() => {
        const mp = this.buildMissionProgress(room);
        const dismissed = this._missionProgressDismissedRound === mp.round;
        return {
          showMissionProgress: mp.show && !inTeam && !dismissed,
          missionProgressTeam: mp.team,
          missionVotedCount: mp.votedCount,
          missionProgressRound: mp.round,
          missionAllVoted: mp.allVoted,
        };
      })(),
      roomConfigLines: this.buildRoomConfig(room, leaderSeat),
      roomConfigHelpLines: this.buildRoomConfigHelp(room),
      roomRoleCards: this.buildRoomRoleCards(room),
      playerCards: this.buildPlayerCards(room),
      ...speakView
    });

    if (room && room.started && !this.data.myRole && !this.data.roleRequested) {
      this.setData({ roleRequested: true });
      this.send("VIEW_ROLE");
    }
    this.maybeShowGameHint(room, { phase, isLeader, isMyTurn, inTeam, myPlayer });
    this.maybeVibrate({ phase, isLeader, isMyTurn, inTeam, myMissionDone, myVoted, isAssassin, isLadyHolder, myPlayer });
  },

  buildPhasePrompt(room, state) {
    if (!room || !room.started || !room.game || state.phase === "end") return null;
    const formatPlayer = (player, seat) => {
      if (!player) return "等待玩家";
      return seat ? `${seat}号 · ${player.nickname || "玩家"}` : (player.nickname || "玩家");
    };

    if (state.phase === "lady") {
      const holderName = formatPlayer(state.ladyHolder, state.ladySeat);
      const target = state.selectedLadyTarget
        ? (this.buildLadyTargets(room).find((item) => item.id === state.selectedLadyTarget) || null)
        : null;
      const holderMeta = state.ladyHolder ? this.avatarMeta(state.ladyHolder.avatar || "🙂", state.ladyHolder) : { image: "", text: "?" };
      const chain = this.buildLadyChain(room, state.ladyHolder, state.ladySeat);
      return {
        title: "验人阶段",
        label: "湖中仙女",
        actor: holderName,
        holder: {
          name: state.ladyHolder ? (state.ladyHolder.nickname || "玩家") : "等待玩家",
          seat: state.ladySeat || 0,
          avatarImage: holderMeta.image,
          avatarText: holderMeta.text || "🙂"
        },
        target,
        chain,
        isHolder: !!state.isLadyHolder,
        canConfirm: !!(state.isLadyHolder && target),
        tone: state.isLadyHolder ? "mine" : "wait",
        hint: state.isLadyHolder
          ? (target ? "确认后将查看该玩家阵营，湖中仙女会传递给他。" : "点击圆桌上的可选玩家，选择本轮验人目标。")
          : `等待 ${holderName} 选择验人目标。`
      };
    }

    return null;
  },

  buildLadyChain(room, currentHolder, currentSeat) {
    if (!room || !room.game || !room.game.ladyOfLake || !Array.isArray(room.players) || !Array.isArray(room.seats)) return [];
    const history = Array.isArray(room.game.ladyOfLake.history) ? room.game.ladyOfLake.history : [];
    const chain = history.map((item) => {
      const holder = room.players.find((p) => p.id === item.holderId);
      const target = room.players.find((p) => p.id === item.targetId);
      const holderSeat = room.seats.findIndex((id) => id === item.holderId) + 1;
      const targetSeat = room.seats.findIndex((id) => id === item.targetId) + 1;
      return {
        key: `${item.round || 0}-${item.holderId || ""}-${item.targetId || ""}`,
        from: holder ? `${holderSeat}号 ${holder.nickname}` : "未知",
        to: target ? `${targetSeat}号 ${target.nickname}` : "未知"
      };
    });
    if (currentHolder) {
      chain.push({
        key: `current-${currentHolder.id}`,
        from: chain.length ? chain[chain.length - 1].to : "初始持有",
        to: `${currentSeat || ""}号 ${currentHolder.nickname || "玩家"}`,
        current: true
      });
    }
    return chain.slice(-3);
  },

  maybeVibrate({ phase, isLeader, isMyTurn, inTeam, myMissionDone, myVoted, isAssassin, isLadyHolder, myPlayer }) {
    if (!myPlayer || myPlayer.spectator || myPlayer.isAI) return;
    // 当前需要我操作的 key
    let actionKey = null;
    if (phase === 'team' && isLeader) actionKey = `team-lead-${this.data.room && this.data.room.game && this.data.room.game.round}-${this.data.room && this.data.room.game && this.data.room.game.attempt}`;
    else if (phase === 'speaking' && isMyTurn) actionKey = `speak-${this.data.speakingSeat}`;
    else if (phase === 'voting' && !myVoted) actionKey = `vote-${this.data.room && this.data.room.game && this.data.room.game.round}-${this.data.room && this.data.room.game && this.data.room.game.attempt}`;
    else if (phase === 'mission' && inTeam && !myMissionDone) actionKey = `mission-${this.data.room && this.data.room.game && this.data.room.game.round}`;
    else if (phase === 'assassination' && isAssassin) actionKey = 'assassination';
    else if (phase === 'lady' && isLadyHolder) actionKey = `lady-${this.data.room && this.data.room.game && this.data.room.game.ladyOfLake && this.data.room.game.ladyOfLake.round}`;

    if (actionKey && actionKey !== this._lastVibrateKey) {
      this._lastVibrateKey = actionKey;
      wx.vibrateShort({ type: 'heavy' });
    }
    if (!actionKey) this._lastVibrateKey = null;
  },

  refreshSpeakingProgress(roomArg) {
    const room = roomArg || this.data.room;
    if (!room || room.phase !== "speaking" || !room.speaking || !room.speaking.endAt) {
      this.setData({ speakingRemainingSec: 0, speakingProgress: 0 });
      return;
    }
    const total = Number(room.speakingSeconds || this.data.speakingTotalSec || 120) || 120;
    const remaining = Math.max(0, Math.floor((Number(room.speaking.endAt) - Date.now()) / 1000));
    const progress = Math.max(0, Math.min(100, Math.floor((remaining / Math.max(1, total)) * 100)));
    this.setData({
      speakingRemainingSec: remaining,
      speakingTotalSec: total,
      speakingProgress: progress,
      speakingUrgent: remaining > 0 && remaining <= 15,
      speakingTimerText: Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0'),
    });
  },

  maybeShowAssassinAnim(room, prevRoom) {
    const anim = room && room.game && room.game.assassination;
    if (!anim) return;
    const prevAnim = prevRoom && prevRoom.game && prevRoom.game.assassination;
    if (prevAnim) return; // already shown
    const players = Array.isArray(room.players) ? room.players : [];
    const target = players.find((p) => p.id === anim.targetId);
    const assassin = players.find((p) => p.id === anim.assassinId);
    const targetRole = this.getRevealedRoleLabel(room, anim.targetId);
    const targetMeta = this.avatarMeta(target && target.avatar ? target.avatar : '', target);
    this.setData({
      assassinAnim: {
        show: true,
        hit: anim.hit,
        targetName: target ? target.nickname : '目标',
        targetAvatar: targetMeta.image,
        targetAvatarText: targetMeta.text,
        targetRole,
        targetRoleImage: roleImageFor(targetRole),
        assassinName: assassin ? assassin.nickname : '刺客',
        resultText: anim.hit ? '刺中梅林！邪恶阵营胜利' : '刺杀失败！正义阵营胜利',
        resultClass: anim.hit ? 'assassin-result-evil' : 'assassin-result-good',
      }
    });
  },

  onCloseMissionProgress() {
    this._missionProgressDismissedRound = this.data.missionProgressRound;
    this.setData({ showMissionProgress: false });
  },

  onCloseMissionAnim() {
    if (this._missionAnimTimer) {
      clearTimeout(this._missionAnimTimer);
      this._missionAnimTimer = null;
    }
    this.setData({ showMissionAnim: false });
  },

  onCloseAssassinAnim() {
    this.setData({ assassinAnim: null });
  },

  maybeShowRecap(room, prevRoom) {
    // When transitioning away from 'end' (new game started), clear stale recap state
    if (room.phase !== "end") {
      if (this.data.recapReady || this.data._recapFingerprint) {
        this.setData({ recapReady: false, recapGenerating: false, recapRequested: false, recapList: [], _recapFingerprint: "" });
      }
      return;
    }
    const recapGenerating = !!(room.game && room.game.recapGenerating);
    const recap = room && room.game && Array.isArray(room.game.recap) ? room.game.recap : [];
    // Build a fingerprint from player IDs + count to detect genuinely new recap data
    const fingerprint = recap.map(r => (r.id || "") + ":" + (r.role || "")).join("|");
    if (fingerprint && fingerprint !== this.data._recapFingerprint) {
      const recapList = recap.map(r => formatRecapEntry(r));
      if (recapList.length) {
        this.setData({ recapReady: true, recapGenerating: false, recapRequested: false, recapList, recapIndex: 0, _recapFingerprint: fingerprint });
        return;
      }
    }
    // 服务端确认开始生成，清除本地 pending 标记
    if (recapGenerating) this.setData({ recapGenerating: true, recapRequested: false });
    // 只有服务端明确说"没在生成"且本地没有 pending 请求时才重置
    else if (!this.data.recapRequested && this.data.recapGenerating) {
      this.setData({ recapGenerating: false });
    }
  },

  onOpenRecap() {
    this.setData({ showRecapModal: true });
  },

  onRequestRecap() {
    if (this.data.recapRequested || this.data.recapGenerating) return;
    this.setData({ recapRequested: true });
    this.send("REQUEST_RECAP");
  },

  onRecapPrev() {
    const idx = Math.max(0, this.data.recapIndex - 1);
    this.setData({ recapIndex: idx });
  },

  onRecapNext() {
    const idx = Math.min(this.data.recapList.length - 1, this.data.recapIndex + 1);
    this.setData({ recapIndex: idx });
  },

  onToggleThink() {
    const list = this.data.recapList.slice();
    const idx = this.data.recapIndex;
    list[idx] = { ...list[idx], showThink: !list[idx].showThink };
    this.setData({ recapList: list });
  },

  onNoop() {},

  onCloseRecap() {
    this.setData({ showRecapModal: false });
  },

  maybeShowMissionResultAnim(room) {
    const roomCode = room && room.code ? room.code : "";
    const latest = getLatestMissionRecord(room);
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
      missionAnimSuccess: latest.success,
      missionAnimText: latest.success ? "任务成功" : "任务失败",
      missionAnimRound: latest.round,
      missionAnimFails: latest.fails,
      missionAnimFailsText: latest.fails === 0 ? "无失败票" : `${latest.fails} 张失败票`,
      missionAnimClass: latest.success ? "mission-anim-success" : "mission-anim-fail",
      missionAnimImage: latest.success ? this.data.skinQuestSuccess : this.data.skinQuestFail
    });
    this._missionAnimTimer = setTimeout(() => {
      this.setData({ showMissionAnim: false });
      this._missionAnimTimer = null;
    }, 2800);
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
    const seatCount = players.length || 0;
    return voteHistory.map((v, idx) => {
      const mission = v && v.approved ? missionByRound[Number(v.round || 0)] || null : null;
      const snapshot = (v && v.seatSnapshot) || (mission && mission.seatSnapshot) || null;
      const leaderSeat = this.getSeatNo(room, v && v.leaderId, snapshot) || 0;
      // team seat list as array
      const teamSeatList = (Array.isArray(v && v.team) ? v.team : [])
        .map((id) => this.getSeatNo(room, id, snapshot))
        .filter((s) => Number.isFinite(s) && s > 0)
        .sort((a, b) => a - b);
      // vote chips: one chip per seat 1..N
      const voteMap = v && v.votes ? v.votes : {};
      const voteSupportChips = [];
      const voteRejectChips = [];
      for (let seat = 1; seat <= seatCount; seat++) {
        // find player at this seat using snapshot or players list
        let pid = null;
        if (snapshot) {
          pid = Object.keys(snapshot).find((id) => Number(snapshot[id]) === seat) || null;
        }
        if (!pid) {
          const p = players.find((p) => this.getSeatNo(room, p.id, snapshot) === seat);
          pid = p ? p.id : null;
        }
        if (pid !== null) {
          const chip = { seat, supported: !!(voteMap[pid]), isLeaderSeat: seat === leaderSeat };
          if (chip.supported) voteSupportChips.push(chip);
          else voteRejectChips.push(chip);
        }
      }
      // result
      let result = "skipped";
      let failCount = 0;
      let approved = !!(v && v.approved);
      if (mission) {
        failCount = mission.fails || 0;
        result = mission.success ? "success" : "fail";
      } else if (
        approved &&
        phase !== "end" &&
        game &&
        Number(game.round || 0) === Number(v.round || 0) &&
        Number(game.attempt || 0) === Number(v.attempt || 0)
      ) {
        result = "pending";
      } else if (approved) {
        result = "pending";
      }
      const roundNum = Number(v.round || 0);
      const attemptNum = Number(v.attempt || 0);
      return {
        key: `${v.round || 0}-${v.attempt || idx + 1}`,
        round: roundNum,
        isForcedRound: roundNum > 0 && attemptNum > 0 && attemptNum === forcedRoundForRoom(room),
        leaderSeat,
        teamSeatList,
        voteSupportChips,
        voteRejectChips,
        result,
        failCount,
        approved,
      };
    });
  },

  buildCenterResult(room) {
    if (!room || !room.game) return { show: false, title: "", sub: "" };
    const winner = room.game.winner || "";
    if (!winner && room.phase !== "end") return { show: false, title: "", sub: "" };
    const title = winner === "good" ? "正义胜利" : winner === "evil" ? "邪恶胜利" : "对局结束";
    const ass = room.game.assassination || null;
    const endReason = room.game.endReason || null;
    let sub = "";
    if (ass && ass.targetSeat) {
      sub = `刺杀目标：${ass.targetSeat}号位`;
    } else if (endReason === "force_round") {
      sub = "强制轮发车失败";
    } else if (endReason === "missions_failed") {
      const failCount = Array.isArray(room.game.missionHistory) ? room.game.missionHistory.filter(m => !m.success).length : 3;
      sub = `${failCount} 轮任务失败`;
    } else if (endReason === "rounds_exhausted") {
      sub = "任务轮次已耗尽";
    }
    return { show: true, title, sub };
  },

  buildEndMedals(room, clientId) {
    if (!room || !room.game || !clientId) return [];
    const byPlayer = room.game.latestEarnedMedals || {};
    const list = Array.isArray(byPlayer[clientId]) ? byPlayer[clientId] : [];
    return decorateMedals(list);
  },

  buildSeatSlots(room, selectedTeam = [], selectedAssassinate = "", roleVisibleSeats = null, selectedLadyTarget = "") {
    const max = Number(room.maxPlayers || 0);
    const seats = Array.isArray(room.seats) ? room.seats : [];
    const players = Array.isArray(room.players) ? room.players : [];
    // 圆桌身份模式：建立座位号 → identityFaction 的查找表
    const rvs = roleVisibleSeats !== null ? roleVisibleSeats : (this.data.roleVisibleSeats || []);
    const idMap = {};
    rvs.forEach(vs => { idMap[vs.seat] = vs; });
    const game = room && room.game ? room.game : null;
    const endVotes = game && game.endVotes ? game.endVotes : {};
    const phase = room && room.phase ? room.phase : "";
    const leaderId = game ? game.leaderId : "";
    const isLeaderNow = !!(this.data.clientId && leaderId && this.data.clientId === leaderId);
    const assTargetId = game && game.assassination ? game.assassination.targetId : "";
    const out = [];
    for (let i = 0; i < max; i += 1) {
      const pid = seats[i] || null;
      const p = pid ? players.find((it) => it.id === pid) : null;
      const avatarMeta = p ? this.avatarMeta(p.avatar || "🙂", p) : { image: "", text: "" };
      let action = "";
      let actionDone = false;
      if (pid && game) {
        if (phase === "team" || phase === "speaking") {
          const tags = [];
          // 队长已有皇冠图标，不再显示文字
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
        avatarText: p ? (avatarMeta.text || "🙂") : "",
        offline: !!(p && p.offline),
        autoplay: !!(p && p.autoplay),
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
        selectedLadyTarget: !!(pid && selectedLadyTarget && selectedLadyTarget === pid),
        isAssassinated: !!(pid && assTargetId && pid === assTargetId),
        roleLabel: this.getRevealedRoleLabel(room, pid),
        roleImage: roleImageFor(this.getRevealedRoleLabel(room, pid)),
        roleClass: roleClassFor(this.getRevealedRoleLabel(room, pid)),
        factionClass: (() => {
          const rl = this.getRevealedRoleLabel(room, pid);
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
        identityLabel: idMap[i + 1]
          ? (idMap[i + 1].role || (idMap[i + 1].isSelf ? '' : '未知'))
          : '',
        identityRoleImage: idMap[i + 1] && idMap[i + 1].role ? roleImageFor(idMap[i + 1].role) : '',
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

  buildRoleVisibleSeats(info, assassinSeatNo) {
    const visibleSeatNos = Array.isArray(info && info.seats) ? info.seats.map(Number) : [];
    const room = this.data.room;
    const clientId = this.data.clientId;
    const currentRole = String((info && info.role) || this.data.myRole || "");
    const isEvilViewer = EVIL_ROLES.has(currentRole);
    const visibleAreEvil = !!(info && info.visibleFaction === 'evil');
    const roleDetails = (info && info.roleDetails) ? info.roleDetails : {};
    if (!room || !Array.isArray(room.seats) || !Array.isArray(room.players)) return [];

    // 自己的座位号
    const mySeatIdx = room.seats.indexOf(clientId);
    const mySeatNo = mySeatIdx >= 0 ? mySeatIdx + 1 : null;

    // 只展示：自己 + 能看到身份的玩家
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
        // 邪恶视角下 info.seats 都是邪恶队友；其他情况靠 roleDetails 里的角色判断
        const isEvil = isSelf ? EVIL_ROLES.has(currentRole) : (role ? EVIL_ROLES.has(role) : (!isSelf && (isEvilViewer || visibleAreEvil)));
        const isKnown = isSelf || !!role || isEvilViewer || visibleAreEvil;
        const rowClass = isEvil ? "role-seat-row-evil" : isKnown ? "role-seat-row-good" : "role-seat-row-unknown";
        const roleClass = isEvil ? "role-seat-role-evil" : isSelf ? "role-seat-role-self" : "role-seat-role-other";
        const avatarMeta = this.avatarMeta(p && p.avatar ? p.avatar : "🙂", p);
        // 圆桌身份模式用：每个可见座位的阵营颜色
        const identityFaction = isSelf
          ? (EVIL_ROLES.has(currentRole) ? 'evil' : 'good')
          : (isEvil ? 'evil' : 'good');
        return {
          seat: seatNo,
          nickname: p ? p.nickname : "未知",
          isSelf,
          role,
          roleImage,
          avatarImage: avatarMeta.image,
          avatarText: avatarMeta.text || "🙂",
          rowClass,
          roleClass,
          identityFaction,
          isAssassinSeat: assassinSeatNo && seatNo === assassinSeatNo,
        };
      })
      .filter(Boolean);
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
        const spectator = seat <= 0 || !!p.spectator;
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
        const avatarMeta = this.avatarMeta(p.avatar || "🙂", p);
        return {
          id: p.id,
          seat,
          seatText: seat > 0 ? `${seat}号` : "观战",
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
    const forcedRound = forcedRoundForRoom(room);
    const maxPlayers = Number(room.maxPlayers || (room.roles || []).length || 0);
    const hasOberon = Array.isArray(room.roles) && room.roles.includes("奥伯伦");
    return [
      { label: "人数", value: `${maxPlayers}人`, icon: "https://www.awalon.top/mp-assets/icons/meta-players.svg" },
      ...(maxPlayers >= 8 ? [{ label: "湖中仙女", value: room.ladyOfLakeEnabled ? "开启" : "关闭", icon: "https://www.awalon.top/mp-assets/icons/rule-lady.svg" }] : []),
      { label: "邪恶互认", value: room.evilRoleVisibleEnabled ? "显示身份" : "仅座位", icon: "https://www.awalon.top/mp-assets/icons/rule-evil.svg" },
      ...(hasOberon
        ? [{ label: "奥伯伦", value: room.oberonVisibleEnabled ? "翻牌" : "不翻牌", icon: "https://www.awalon.top/mp-assets/icons/meta-sword.svg" }]
        : []),
      { label: "强制轮", value: `第${forcedRound}次`, icon: "https://www.awalon.top/mp-assets/icons/rule-force.svg" },
      { label: "发言时长", value: `${room.speakingSeconds || 120}s`, icon: "https://www.awalon.top/mp-assets/icons/rule-timer.svg" }
    ];
  },

  buildRoomConfigHelp(room) {
    if (!room) return [];
    const maxPlayers = Number(room.maxPlayers || (room.roles || []).length || 0);
    const forcedRound = forcedRoundForRoom(room);
    const hasOberon = Array.isArray(room.roles) && room.roles.includes("奥伯伦");
    return [
      ...(maxPlayers >= 8 ? [{
        label: "湖中仙女",
        text: room.ladyOfLakeEnabled ? "第2到第4轮任务结束后，持有者可查一名玩家正邪，然后仙女交给被查的人。" : "本局不会出现额外验人；所有阵营信息只靠角色与发言判断。",
        icon: "https://www.awalon.top/mp-assets/icons/rule-lady.svg"
      }] : []),
      { label: "邪恶互认", text: room.evilRoleVisibleEnabled ? "坏人开局能看到队友是谁，以及队友具体是什么角色。" : "坏人开局只知道哪些座位是队友，不知道队友具体角色。", icon: "https://www.awalon.top/mp-assets/icons/rule-evil.svg" },
      ...(hasOberon ? [{
        label: "奥伯伦",
        text: room.oberonVisibleEnabled ? "本局奥伯伦参与邪恶互认，刺杀阶段会和其他邪恶一起翻牌。" : "本局奥伯伦是孤狼，不参与邪恶互认，刺杀阶段也不会提前翻牌。",
        icon: "https://www.awalon.top/mp-assets/icons/meta-sword.svg"
      }] : []),
      { label: "强制轮", text: `同一轮任务连续否决到第${forcedRound}次组队仍未通过，正义直接判负。`, icon: "https://www.awalon.top/mp-assets/icons/rule-force.svg" }
    ];
  },

  buildEditableConfigFromRoom(room) {
    if (!room) return {};
    const maxPlayers = Number(room.maxPlayers || (Array.isArray(room.roles) ? room.roles.length : 7)) || 7;
    const selectedRoles = Array.isArray(room.roles) && room.roles.length
      ? room.roles.slice()
      : this.defaultRolesForCount(maxPlayers);
    const rolePresets = this.presetsForCount(maxPlayers);
    const selectedPresetIndex = rolePresets.findIndex((preset) => {
      return this.sameRoleList(preset.roles, selectedRoles);
    });
    const selectedPreset = rolePresets[selectedPresetIndex] || rolePresets[0] || null;
    const counts = this.countRolesByFaction(selectedRoles);
    const oberonVisibleEnabled =
      typeof room.oberonVisibleEnabled === "boolean"
        ? !!room.oberonVisibleEnabled
        : this.defaultOberonVisibleForRoles(selectedRoles, selectedPreset);
    return {
      maxPlayersIndex: Math.max(0, Math.min(5, maxPlayers - 5)),
      rolePresets,
      selectedPresetIndex,
      selectedRoles,
      hostRole: room.hostRole || "随机",
      hostRoleOptions: this.withRoleImages(this.uniqueRoles(selectedRoles)),
      ladyOfLakeEnabled: !!room.ladyOfLakeEnabled,
      speakingSeconds: Number(room.speakingSeconds || 120) || 120,
      evilRoleVisibleEnabled: !!room.evilRoleVisibleEnabled,
      oberonVisibleEnabled,
      aiVoiceEnabled: !!room.aiVoiceEnabled,
      forceRoundMode: room.forceRoundMode || "fixed5",
      advancedRoleSummary: this.formatAdvancedRoleSummary(selectedRoles),
      advancedQuotaText: this.formatAdvancedQuotaText(maxPlayers),
      currentRoleChips: this.buildCurrentRoleChips(selectedRoles, oberonVisibleEnabled),
      goodChipCount: counts.good,
      evilChipCount: counts.evil,
      neededGood: this.expectedGoodCount(maxPlayers),
      neededEvil: this.expectedEvilCount(maxPlayers)
    };
  },

  sameRoleList(a = [], b = []) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    const aa = a.slice().sort();
    const bb = b.slice().sort();
    return aa.every((role, idx) => role === bb[idx]);
  },

  buildRoomRoleCards(room) {
    const roles = room && Array.isArray(room.roles) ? room.roles : [];
    if (!roles.length) return [];
    const hostRole = room && room.hostRole && room.hostRole !== "随机" ? String(room.hostRole) : "";
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
        isEvil: EVIL_ROLES.has(role),
        isHostRole: !!(hostRole && role === hostRole),
        roleClass: roleClassFor(role),
        roleBadgeText: this.roleBadgeText(role, roles, room.oberonVisibleEnabled),
        description: ROLE_DESCRIPTION_MAP[role] || "暂无角色说明"
      }));
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
        const avatarMeta = this.avatarMeta(player.avatar || "🙂", player);
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
    const phase = String(room.phase || "");
    // 邪恶翻牌仅在刺杀阶段/终局展示，避免开局或对局中提前在桌面暴露
    if (phase !== "assassination" && phase !== "end") return "";
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
      speakRoundIdx: keys.indexOf(viewKey),
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
      const isAI = !!(p && p.isAI);
      const text = m.text || "";
      const key = `${m.ts || 0}-${idx}`;
      const avatarMeta = this.avatarMeta((p && p.avatar) || "🙂", p);
      return {
        key,
        from: m.from || "系统",
        text,
        seat: seat > 0 ? seat : "",
        avatarImage: avatarMeta.image,
        avatarText: avatarMeta.text || "🙂",
        isAI,
        mine,
        system: !p
      };
    });
  },

  send(type, payload) {
    socket.send({ type, payload });
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
    const rolePresets = this.presetsForCount(maxPlayers);
    const selectedPreset = rolePresets.length ? rolePresets[0] : null;
    const selectedRoles = selectedPreset ? selectedPreset.roles.slice() : this.defaultRolesForCount(maxPlayers);
    const oberonVisibleEnabled = this.defaultOberonVisibleForRoles(selectedRoles, selectedPreset);
    const next = {
      maxPlayersIndex: idx,
      rolePresets,
      selectedPresetIndex: 0,
      selectedRoles,
      hostRoleOptions: this.withRoleImages(this.uniqueRoles(selectedRoles)),
      advancedRoleSummary: this.formatAdvancedRoleSummary(selectedRoles),
      advancedQuotaText: this.formatAdvancedQuotaText(maxPlayers),
      currentRoleChips: this.buildCurrentRoleChips(selectedRoles, oberonVisibleEnabled),
      goodChipCount: this.countRolesByFaction(selectedRoles).good,
      evilChipCount: this.countRolesByFaction(selectedRoles).evil,
      neededGood: this.expectedGoodCount(maxPlayers),
      neededEvil: this.expectedEvilCount(maxPlayers),
      oberonVisibleEnabled
    };
    if (this.data.hostRole !== "随机" && !selectedRoles.includes(this.data.hostRole)) {
      next.hostRole = "随机";
    }
    if (maxPlayers < 8) {
      next.ladyOfLakeEnabled = false;
    }
    this.setData(next);
  },

  onPickSpeakingSeconds(e) {
    const seconds = Number(e.detail.seconds || 120);
    if (!SPEAKING_SECONDS_OPTIONS.includes(seconds)) return;
    this.setData({ speakingSeconds: seconds });
  },

  onPickRoleChip(e) {
    const role = String(e.currentTarget.dataset.role || "");
    if (!role) return;
    this.setData({ hostRole: this.data.hostRole === role ? "随机" : role });
  },

  onToggleAdvancedSettings() {
    this.setData({ showAdvancedSettings: !this.data.showAdvancedSettings });
  },

  onPickForceRoundMode(e) {
    const mode = String(e.detail.mode || "fixed5");
    this.setData({ forceRoundMode: mode === "evil_plus_one" ? "evil_plus_one" : "fixed5" });
  },

  onPickEvilRoleVisible(e) {
    const enabled = !!Number(e.detail.enabled);
    this.setData({ evilRoleVisibleEnabled: enabled });
  },

  onToggleLadyDirect(e) {
    const enabled = !!Number(e.currentTarget.dataset.enabled);
    const maxPlayers = 5 + Number(this.data.maxPlayersIndex || 0);
    if (enabled && maxPlayers < 8) {
      wx.showToast({ title: "仅支持8人及以上", icon: "none" });
      return;
    }
    this.setData({ ladyOfLakeEnabled: enabled });
  },

  onPickForceRoundDirect(e) {
    const value = String(e.currentTarget.dataset.value || "fixed5");
    this.setData({ forceRoundMode: value === "evil_plus_one" ? "evil_plus_one" : "fixed5" });
  },

  onPickEvilVisibleDirect(e) {
    const enabled = e.currentTarget.dataset.value === "true";
    this.setData({ evilRoleVisibleEnabled: enabled });
  },

  onPickOberonVisibleDirect(e) {
    const enabled = e.currentTarget.dataset.value === "true";
    this.setData({ oberonVisibleEnabled: enabled });
  },

  onPickSpeakingSecondsDirect(e) {
    const seconds = Number(e.currentTarget.dataset.value);
    if (![60, 90, 120, 180].includes(seconds)) return;
    this.setData({ speakingSeconds: seconds });
  },

  onToggleAiVoiceDirect(e) {
    const enabled = !!Number(e.currentTarget.dataset.enabled);
    this.setData({ aiVoiceEnabled: enabled });
  },

  onPickOberonVisible(e) {
    const enabled = !!Number(e.detail.enabled);
    this.setData({ oberonVisibleEnabled: enabled });
  },

  onToggleAiVoice(e) {
    const enabled = !!Number(e.detail.enabled);
    this.setData({ aiVoiceEnabled: enabled });
  },

  onOpenConfigHelp() {
    this.setData({ showConfigHelp: true });
  },

  onCloseConfigHelp() {
    this.setData({ showConfigHelp: false });
  },

  onOpenRoomSettings() {
    const room = this.data.room;
    if (!room || !this.data.isHost) return;
    if (room.started && room.phase !== "end") {
      wx.showToast({ title: "本局进行中不能修改配置", icon: "none" });
      return;
    }
    this.setData({ ...this.buildEditableConfigFromRoom(room), showRoomSettings: true });
  },

  onCloseRoomSettings() {
    const room = this.data.room;
    this.setData({ ...(room ? this.buildEditableConfigFromRoom(room) : {}), showRoomSettings: false });
  },

  onApplyRoomSettings() {
    const room = this.data.room;
    if (!room || !this.data.isHost) return;
    if (room.started && room.phase !== "end") {
      wx.showToast({ title: "本局进行中不能修改配置", icon: "none" });
      return;
    }
    const maxPlayers = 5 + Number(this.data.maxPlayersIndex || 0);
    const roles = Array.isArray(this.data.selectedRoles) ? this.data.selectedRoles.slice() : [];
    const roleError = this.validateSelectedRoles(maxPlayers, roles);
    if (roleError) {
      wx.showToast({ title: roleError, icon: "none" });
      return;
    }
    const hostRole = this.data.hostRole || "随机";
    if (hostRole !== "随机" && !roles.includes(hostRole)) {
      wx.showToast({ title: "房主身份不在当前配置中", icon: "none" });
      return;
    }
    this.send("UPDATE_SETTINGS", {
      maxPlayers,
      roles,
      hostRole,
      speakingSeconds: Number(this.data.speakingSeconds || 120) || 120,
      ladyOfLakeEnabled: !!this.data.ladyOfLakeEnabled && maxPlayers >= 8,
      evilRoleVisibleEnabled: !!this.data.evilRoleVisibleEnabled,
      oberonVisibleEnabled: !!this.data.oberonVisibleEnabled,
      aiVoiceEnabled: !!this.data.aiVoiceEnabled,
      forceRoundMode: this.data.forceRoundMode || "fixed5"
    });
    this.setData({ showRoomSettings: false, gameTip: "已提交房间配置" });
  },

  onAddAdvancedRole(e) {
    const role = String(e.detail.role || "");
    if (!role) return;
    const maxPlayers = 5 + Number(this.data.maxPlayersIndex || 0);
    const selectedRoles = Array.isArray(this.data.selectedRoles) ? this.data.selectedRoles.slice() : [];
    if (selectedRoles.length >= maxPlayers) {
      wx.showToast({ title: "角色数量已满", icon: "none" });
      return;
    }
    const { good, evil } = this.countRolesByFaction(selectedRoles);
    if (EVIL_ROLES.has(role)) {
      if (evil >= this.expectedEvilCount(maxPlayers)) {
        wx.showToast({ title: "邪恶数量已满", icon: "none" });
        return;
      }
    } else if (good >= this.expectedGoodCount(maxPlayers)) {
      wx.showToast({ title: "正义数量已满", icon: "none" });
      return;
    }
    selectedRoles.push(role);
    const { good: newGood, evil: newEvil } = this.countRolesByFaction(selectedRoles);
    const unique = this.uniqueRoles(selectedRoles);
    const next = {
      selectedRoles,
      hostRoleOptions: this.withRoleImages(unique),
      advancedRoleSummary: this.formatAdvancedRoleSummary(selectedRoles),
      advancedQuotaText: this.formatAdvancedQuotaText(maxPlayers),
      currentRoleChips: this.buildCurrentRoleChips(selectedRoles, this.data.oberonVisibleEnabled),
      goodChipCount: newGood,
      evilChipCount: newEvil
    };
    if (this.data.hostRole !== "随机" && !unique.includes(this.data.hostRole)) {
      next.hostRole = "随机";
    }
    this.setData(next);
  },

  onRemoveAdvancedRole(e) {
    const idx = Number(e.detail.idx);
    const selectedRoles = Array.isArray(this.data.selectedRoles) ? this.data.selectedRoles.slice() : [];
    if (!Number.isInteger(idx) || idx < 0 || idx >= selectedRoles.length) return;
    selectedRoles.splice(idx, 1);
    const unique = this.uniqueRoles(selectedRoles);
    const next = {
      selectedRoles,
      hostRoleOptions: this.withRoleImages(unique),
      advancedRoleSummary: this.formatAdvancedRoleSummary(selectedRoles),
      advancedQuotaText: this.formatAdvancedQuotaText(5 + Number(this.data.maxPlayersIndex || 0)),
      currentRoleChips: this.buildCurrentRoleChips(selectedRoles, this.data.oberonVisibleEnabled),
      goodChipCount: this.countRolesByFaction(selectedRoles).good,
      evilChipCount: this.countRolesByFaction(selectedRoles).evil
    };
    if (this.data.hostRole !== "随机" && !unique.includes(this.data.hostRole)) {
      next.hostRole = "随机";
    }
    this.setData(next);
  },

  onResetAdvancedRoles() {
    const maxPlayers = 5 + Number(this.data.maxPlayersIndex || 0);
    const selectedRoles = this.defaultRolesForCount(maxPlayers);
    const rolePresets = this.presetsForCount(maxPlayers);
    const preset = rolePresets[Number(this.data.selectedPresetIndex || 0)] || rolePresets[0] || null;
    const oberonVisibleEnabled = this.defaultOberonVisibleForRoles(selectedRoles, preset);
    this.setData({
      selectedRoles,
      hostRole: "随机",
      hostRoleOptions: this.withRoleImages(this.uniqueRoles(selectedRoles)),
      advancedRoleSummary: this.formatAdvancedRoleSummary(selectedRoles),
      advancedQuotaText: this.formatAdvancedQuotaText(maxPlayers),
      currentRoleChips: this.buildCurrentRoleChips(selectedRoles, oberonVisibleEnabled),
      goodChipCount: this.countRolesByFaction(selectedRoles).good,
      evilChipCount: this.countRolesByFaction(selectedRoles).evil,
      oberonVisibleEnabled
    });
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
      image: roleImageFor(role)
    }));
  },

  _rebuildRoleChips() {
    const maxPlayers = 5 + Number(this.data.maxPlayersIndex || 0);
    const selectedRoles = this.defaultRolesForCount(maxPlayers);
    const rolePresets = this.presetsForCount(maxPlayers);
    const preset = rolePresets[Number(this.data.selectedPresetIndex || 0)] || rolePresets[0] || null;
    const oberonVisibleEnabled = this.defaultOberonVisibleForRoles(selectedRoles, preset);
    this.setData({
      selectedRoles,
      currentRoleChips: this.buildCurrentRoleChips(selectedRoles, oberonVisibleEnabled),
      hostRoleOptions: this.withRoleImages(this.uniqueRoles(selectedRoles)),
      advancedRoleSummary: this.formatAdvancedRoleSummary(selectedRoles),
      advancedQuotaText: this.formatAdvancedQuotaText(maxPlayers),
      goodChipCount: this.countRolesByFaction(selectedRoles).good,
      evilChipCount: this.countRolesByFaction(selectedRoles).evil,
      oberonVisibleEnabled
    });
  },

  buildCurrentRoleChips(roles = [], oberonVisibleEnabled = this.data.oberonVisibleEnabled) {
    const counts = {};
    (roles || []).forEach((r) => { counts[r] = (counts[r] || 0) + 1; });
    return ROLE_ORDER
      .filter((r) => counts[r])
      .map((r) => ({
        role: r,
        image: roleImageFor(r),
        isEvil: EVIL_ROLES.has(r),
        count: counts[r],
        roleBadgeText: this.roleBadgeText(r, roles, oberonVisibleEnabled)
      }));
  },

  roleBadgeText(role, roles = [], oberonVisibleEnabled) {
    if (role === "奥伯伦") return oberonVisibleEnabled ? "翻牌" : "不翻牌";
    const roleList = Array.isArray(roles) ? roles : [];
    const knifeRole = roleList.includes("刺客") ? "刺客" : (roleList.includes("莫德雷德") ? "莫德雷德" : "");
    if (role && role === knifeRole) return "带刀";
    return "";
  },

  presetsForCount(count) {
    const hardcoded = ROLE_PRESETS[Number(count)];
    if (hardcoded) return hardcoded;
    const defaults = this.defaultRolesForCount(count);
    return defaults.length ? [{ name: '默认', roles: defaults }] : [];
  },

  onSelectPreset(e) {
    const idx = Number(e.currentTarget.dataset.idx || 0);
    const presets = this.data.rolePresets;
    if (!presets[idx]) return;
    const preset = presets[idx];
    const selectedRoles = preset.roles.slice();
    const { good, evil } = this.countRolesByFaction(selectedRoles);
    const maxPlayers = 5 + Number(this.data.maxPlayersIndex || 0);
    const unique = this.uniqueRoles(selectedRoles);
    const oberonVisibleEnabled = this.defaultOberonVisibleForRoles(selectedRoles, preset);
    const next = {
      selectedPresetIndex: idx,
      selectedRoles,
      currentRoleChips: this.buildCurrentRoleChips(selectedRoles, oberonVisibleEnabled),
      hostRoleOptions: this.withRoleImages(unique),
      advancedRoleSummary: this.formatAdvancedRoleSummary(selectedRoles),
      goodChipCount: good,
      evilChipCount: evil,
      neededGood: this.expectedGoodCount(maxPlayers),
      neededEvil: this.expectedEvilCount(maxPlayers),
      oberonVisibleEnabled
    };
    if (this.data.hostRole !== "随机" && !unique.includes(this.data.hostRole)) {
      next.hostRole = "随机";
    }
    this.setData(next);
  },

  defaultOberonVisibleForRoles(roles = [], preset = null) {
    if (!Array.isArray(roles) || !roles.includes("奥伯伦")) return false;
    if (preset && typeof preset.oberonVisibleEnabled === "boolean") return !!preset.oberonVisibleEnabled;
    const presetName = preset && preset.name ? String(preset.name) : "";
    if (presetName.includes("孤狼")) return false;
    return true;
  },

  defaultRolesForCount(count) {
    const config = app.globalData.roleConfig || {};
    const roles = config[count] || config[String(count)];
    return Array.isArray(roles) ? roles.slice() : [];
  },

  expectedEvilCount(count) {
    return (
      {
        5: 2,
        6: 2,
        7: 3,
        8: 3,
        9: 3,
        10: 4
      }[Number(count) || 7] || 3
    );
  },

  expectedGoodCount(count) {
    const n = Number(count) || 7;
    return n - this.expectedEvilCount(n);
  },

  countRolesByFaction(roles = []) {
    let good = 0;
    let evil = 0;
    (roles || []).forEach((role) => {
      if (EVIL_ROLES.has(role)) {
        evil += 1;
      } else {
        good += 1;
      }
    });
    return { good, evil };
  },

  formatAdvancedRoleSummary(roles = []) {
    const counts = {};
    (roles || []).forEach((role) => {
      counts[role] = (counts[role] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => {
        const ai = ROLE_ORDER.indexOf(a[0]);
        const bi = ROLE_ORDER.indexOf(b[0]);
        if (ai !== bi) return ai - bi;
        return a[0].localeCompare(b[0]);
      })
      .map(([role, count]) => (count > 1 ? `${role}x${count}` : role))
      .join("、");
  },

  formatAdvancedQuotaText(maxPlayers) {
    return `本局需配置 ${this.expectedGoodCount(maxPlayers)} 个正义、${this.expectedEvilCount(maxPlayers)} 个邪恶，且必须包含梅林与刺客（或以莫德雷德代替刺客）。`;
  },

  validateSelectedRoles(maxPlayers, roles) {
    const selected = Array.isArray(roles) ? roles.slice() : [];
    const { good, evil } = this.countRolesByFaction(selected);
    if (selected.length !== maxPlayers) return `角色数量需为${maxPlayers}个`;
    if (!selected.includes("梅林")) return "高级配置必须包含梅林";
    if (!selected.includes("刺客") && !selected.includes("莫德雷德")) return "高级配置必须包含刺客（或以莫德雷德代替）";
    if (evil !== this.expectedEvilCount(maxPlayers)) return `邪恶数量需为${this.expectedEvilCount(maxPlayers)}个`;
    if (good !== this.expectedGoodCount(maxPlayers)) return `正义数量需为${this.expectedGoodCount(maxPlayers)}个`;
    return "";
  },

  onPickHostRole(e) {
    const role = String(e.currentTarget.dataset.role || "随机");
    this.setData({ hostRole: role });
  },

  onTapMedal(e) {
    const name = String(e.detail.name || "勋章");
    const description = String(e.detail.description || "暂无说明");
    wx.showModal({
      title: name,
      content: description,
      showCancel: false,
      confirmText: "知道了"
    });
  },

  onTapRoomRoleCard(e) {
    const role = String(e.detail.role || "角色");
    this.openRoleGuideModal(role);
  },

  onTapConfigRole(e) {
    const role = String((e.detail && e.detail.role) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.role) || "角色");
    this.openRoleGuideModal(role);
  },

  openRoleGuideModal(role) {
    const cards = this.buildRoleGuideCards(role);
    this.setData({
      roleGuideModal: {
        show: true,
        role,
        image: roleImageFor(role),
        isEvil: EVIL_ROLES.has(role),
        faction: EVIL_ROLES.has(role) ? "邪恶阵营" : "正义阵营",
        cards
      }
    });
  },

  onCloseRoleGuide() {
    this.setData({ roleGuideModal: null });
  },

  buildRoleGuideCards(role) {
    const fallback = [{ title: "说明", text: this.buildRoleGuide(role) }];
    const map = {
      梅林: [
        { title: "你知道什么", text: "你能看到多数邪恶玩家，但通常看不到莫德雷德。" },
        { title: "怎么玩", text: "别直接报答案，用投票和发言悄悄带正义完成任务。" },
        { title: "小心", text: "正义三次成功后，刺客刺中你会让邪恶翻盘。" }
      ],
      派西维尔: [
        { title: "你知道什么", text: "你会看到梅林和莫甘娜两个候选人。" },
        { title: "怎么玩", text: "判断谁更像真梅林，同时尽量保护真梅林。" },
        { title: "小心", text: "莫甘娜会故意装得像梅林，别太早站死边。" }
      ],
      忠臣: [
        { title: "你知道什么", text: "你没有额外信息，只能靠公开发言和投票判断。" },
        { title: "怎么玩", text: "记录谁上车、谁投票、任务成败，慢慢排坑。" },
        { title: "小心", text: "别因为没信息就乱跟票，普通正义的判断很关键。" }
      ],
      "亚瑟的忠臣": [
        { title: "你知道什么", text: "你没有额外信息，只能靠公开发言和投票判断。" },
        { title: "怎么玩", text: "记录谁上车、谁投票、任务成败，慢慢排坑。" },
        { title: "小心", text: "别因为没信息就乱跟票，普通正义的判断很关键。" }
      ],
      刺客: [
        { title: "你知道什么", text: "你是邪恶关键角色，通常知道邪恶队友。" },
        { title: "怎么玩", text: "阻止正义任务成功，并记下谁最像梅林。" },
        { title: "翻盘点", text: "正义三次成功后，你刺中梅林即可让邪恶获胜。" }
      ],
      莫甘娜: [
        { title: "你知道什么", text: "派西维尔会把你和梅林一起看到。" },
        { title: "怎么玩", text: "装成梅林候选，制造真假梅林的混乱。" },
        { title: "小心", text: "不要给出太硬的假信息，否则容易被反推。" }
      ],
      莫德雷德: [
        { title: "你知道什么", text: "你是邪恶，但通常不会被梅林看到。" },
        { title: "怎么玩", text: "利用隐蔽性进关键队伍，带偏正义判断。" },
        { title: "小心", text: "别因为安全就过度发力，投票和任务行为仍会暴露。" }
      ],
      奥伯伦: [
        { title: "你知道什么", text: this.data.room && this.data.room.oberonVisibleEnabled ? "本局你参与邪恶互认，队友能确认你。" : "本局你是孤狼，不参与邪恶互认。" },
        { title: "怎么玩", text: "观察投票和任务结果，判断谁可能是邪恶队友。" },
        { title: "小心", text: this.data.room && this.data.room.oberonVisibleEnabled ? "你会在刺杀阶段随邪恶一起翻牌。" : "你不会提前翻牌，队友也可能误判你。" }
      ],
      爪牙: [
        { title: "你知道什么", text: "你是普通邪恶，通常知道邪恶队友。" },
        { title: "怎么玩", text: "配合队友进任务队伍，制造失败或混淆视角。" },
        { title: "小心", text: "不要每次都急着投失败，行为太直会暴露阵营。" }
      ]
    };
    return map[role] || fallback;
  },

  buildRoleGuide(role) {
    if (role === "奥伯伦") {
      const room = this.data.room || {};
      const base = ROLE_GUIDE_MAP[role] || ROLE_DESCRIPTION_MAP[role] || "暂无角色说明";
      const configLine = room.oberonVisibleEnabled
        ? "本局配置：奥伯伦翻牌，参与邪恶互认，其他邪恶能确认你。"
        : "本局配置：奥伯伦不翻牌，不参与邪恶互认，更接近单独行动。";
      return `${base}\n\n${configLine}`;
    }
    return ROLE_GUIDE_MAP[role] || ROLE_DESCRIPTION_MAP[role] || "暂无角色说明";
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
          timeout: 10000,
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
      this.onWxLogin().then(() => { if (this.data.loggedIn) this.onCreateRoom(); });
      return;
    }
    const maxPlayers = 5 + Number(this.data.maxPlayersIndex || 0);
    const roles = Array.isArray(this.data.selectedRoles) ? this.data.selectedRoles.slice() : [];
    const roleError = this.validateSelectedRoles(maxPlayers, roles);
    if (roleError) {
      wx.showToast({ title: roleError, icon: "none" });
      return;
    }
    const payload = {
      avatar: this.data.avatar || "🐺",
      maxPlayers,
      roles,
      speakingSeconds: Number(this.data.speakingSeconds || 120) || 120,
      evilRoleVisibleEnabled: !!this.data.evilRoleVisibleEnabled,
      oberonVisibleEnabled: !!this.data.oberonVisibleEnabled,
      aiVoiceEnabled: !!this.data.aiVoiceEnabled,
      forceRoundMode: this.data.forceRoundMode || "fixed5"
    };
    console.log("[mp:createRoom:payload]", {
      maxPlayers: payload.maxPlayers,
      roles: payload.roles,
      oberonVisibleEnabled: payload.oberonVisibleEnabled,
      selectedPresetIndex: this.data.selectedPresetIndex
    });
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
    const enabled = !!Number(e.detail.enabled);
    const maxPlayers = 5 + Number(this.data.maxPlayersIndex || 0);
    if (enabled && maxPlayers < 8) {
      wx.showToast({ title: "仅支持8人及以上", icon: "none" });
      return;
    }
    this.setData({ ladyOfLakeEnabled: enabled });
  },

  onJoinRoomPrompt() {
    if (!this.data.loggedIn) {
      this.onWxLogin().then(() => { if (this.data.loggedIn) this.onJoinRoomPrompt(); });
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

  onShareAppMessage() {
    const payload = this.buildSharePayload();
    return {
      title: payload.title,
      path: payload.path,
      imageUrl: payload.imageUrl
    };
  },

  onShareTimeline() {
    const payload = this.buildSharePayload();
    return {
      title: payload.title,
      query: payload.query,
      imageUrl: payload.imageUrl
    };
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
    wx.showModal({
      title: "退出房间",
      content: "确认要退出当前房间吗？",
      confirmText: "退出",
      confirmColor: "#b02c34",
      success: (res) => {
        if (!res || !res.confirm) return;
        this.send("LEAVE_ROOM");
        this._missionProgressDismissedRound = undefined;
        this._identityRevealPending = false;
        this.setData({
          room: null,
          atHome: true,
          teamPhaseKey: "",
          seatSlots: [],
          roundSeats: [],
          seatNotes: {},
          roleInfo: null,
          assassinSeatNo: 0,
          isAssassin: false,
          showRolePanel: false,
          identityMode: false,
          identityRevealSeen: false,
          identityRevealVisible: false,
          identityRevealPhase: "flip",
          roleVisibleSeats: [],
          roleInfoImage: "",
          roleInfoClass: "",
          roleFactionText: "",
          roleRequested: false,
          myRole: "",
          selectedTeam: [],
          teamConfirmed: false,
          leaderActionText: "提交队伍",
          leaderActionDisabled: true,
          leaderActionClass: "",
          teamCandidates: [],
          currentVoteTeam: [],
          isLadyHolder: false,
          ladyHolderName: "",
          ladyHistory: [],
          ladyTargets: [],
          selectedLadyTarget: "",
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
          roomConfigHelpLines: [],
          roomRoleCards: [],
          missionAnimBootstrapped: false,
          missionAnimRoomCode: "",
          missionAnimLastKey: "",
          showMissionProgress: false,
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
      }
    });
  },

  onBackHome() {
    if (!this.data.room) return;
    this.setData({ atHome: true, cheatRevealPlayerId: "" });
  },

  onLogout() {
    wx.showModal({
      title: '确认登出',
      content: '登出后需要重新登录，当前房间数据不会丢失。',
      confirmText: '登出',
      confirmColor: '#c0392b',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync('awalonAuthToken');
        this.send('LEAVE_ROOM');
        if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
        const { close } = require('../../utils/socket');
        close();
        this.setData({ loggedIn: false, room: null, atHome: true, loginTip: '', authToken: '' });
      },
    });
  },

  onResumeRoom(e) {
    if (!this.data.room) {
      const code = e && e.detail && e.detail.code;
      if (code) {
        this.onJoinPublicRoom({ detail: { code } });
      }
      return;
    }
    this.setData({ atHome: false });
  },

  onLeaveRoomFromList() {
    this.onLeaveRoom();
  },

  // ─── 新手引导 ──────────────────────────────────────────────
  maybeShowHint(key, title, text) {
    const seen = wx.getStorageSync('seenHints') || {};
    if (seen[key]) return;
    if (this.data.hintVisible) return;
    this.setData({ hintVisible: true, hintKey: key, hintTitle: title, hintText: text });
  },

  onDismissHint() {
    const key = this.data.hintKey;
    if (!key) return;
    const seen = wx.getStorageSync('seenHints') || {};
    seen[key] = true;
    wx.setStorageSync('seenHints', seen);
    this.setData({ hintVisible: false, hintKey: '', hintTitle: '', hintText: '' });
  },

  maybeShowGameHint(room, { phase, isLeader, isMyTurn, inTeam, myPlayer }) {
    if (!room) return;
    if (!room.started) {
      if (myPlayer && myPlayer.seat === null && !myPlayer.spectator) {
        this.maybeShowHint('hint_seat', '找个位置坐下', '点击圆桌上的空位落座，等大家就位后由房主开始游戏。');
      }
      return;
    }
    if (phase === 'team' && isLeader) {
      this.maybeShowHint('hint_leader', '你是本轮队长', '点击圆桌上的玩家头像选择出征队员，选满人数后点击下方按钮提交队伍。');
    } else if (phase === 'voting') {
      this.maybeShowHint('hint_vote', '全员投票', '对当前提名的队伍表态。同意票过半队伍出发，否则轮换队长重新提名。连续 5 次否决邪恶直接获胜。');
    } else if (phase === 'mission' && inTeam) {
      this.maybeShowHint('hint_mission', '你在出征队伍里', '提交任务牌：正义只能出「成功」，邪恶可选「成功」或「失败」。结果匿名统计，谨慎选择。');
    } else if (phase === 'speaking' && isMyTurn) {
      this.maybeShowHint('hint_speak', '轮到你发言了', '输入你的判断和推理。发言会被保存，AI 复盘时会分析你的策略，别随便说话。');
    } else if (phase === 'assassination') {
      this.maybeShowHint('hint_assassin', '刺杀阶段', '正义完成了 3 次任务！刺客现在要指定一名玩家刺杀——若刺中梅林，邪恶翻盘获胜。');
    }
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
      speakRoundIdx: idx - 1,
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
      speakRoundIdx: idx + 1,
      speakMessages: this.buildSpeakMessagesByRound(this.data.room, nextKey)
    });
  },


  togglePlayerList() {
    const next = !this.data.showPlayerList;
    this.setData({ showPlayerList: next, showRolePanel: next ? false : this.data.showRolePanel });
  },

  onPlayerNamePressStart(e) {
    if (!this.data.isHost) return;
    const playerId = String(e.detail.id || "");
    const seatNo = Number(e.detail.seat || 0);
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
    const idx = Number(e.detail.index);
    if (!Number.isFinite(idx)) return;
    if (!room.started) {
      const seats = Array.isArray(room.seats) ? room.seats : [];
      const isMyOwnSeat = seats[idx] === this.data.clientId;
      if (isMyOwnSeat) {
        wx.showModal({
          title: "离开座位",
          content: "确认离开该座位？离开后可以切换为观战模式。",
          confirmText: "离开",
          cancelText: "取消",
          success: (res) => { if (res.confirm) this.send("CHOOSE_SEAT", { seatIndex: idx }); }
        });
        return;
      }
      this.send("CHOOSE_SEAT", { seatIndex: idx });
      return;
    }
    if (this.data.phase === "end") {
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
      const target = (this.data.ladyTargets || []).find((item) => item.id === pid);
      if (!target) {
        wx.showToast({ title: "该玩家不能被验", icon: "none" });
        return;
      }
      const seatSlots = this.buildSeatSlots(room, this.data.selectedTeam, this.data.selectedAssassinate, null, pid);
      const phasePrompt = this.buildPhasePrompt(room, {
        phase: this.data.phase,
        isLadyHolder: this.data.isLadyHolder,
        ladyHolder: room.players.find((p) => p.id === room.game.ladyOfLake.holderId),
        ladySeat: room.seats.findIndex((id) => id === room.game.ladyOfLake.holderId) + 1,
        selectedLadyTarget: pid
      });
      this.setData({
        selectedLadyTarget: pid,
        seatSlots,
        roundSeats: this.buildRoundSeats(seatSlots, room.maxPlayers || 7),
        phasePrompt,
        gameTip: `已选择验人目标：${target.seat}号 ${target.nickname}`
      });
      return;
    }
    if (this.data.phase === "assassination" && this.data.isAssassin) {
      if (pid === this.data.clientId) {
        wx.showToast({ title: "不能刺杀自己", icon: "none" });
        return;
      }
      const knownEvil = (this.data.roleVisibleSeats || []).some(
        vs => vs.identityFaction === "evil" && vs.seat === slot.seat
      );
      if (knownEvil) {
        wx.showToast({ title: "不能刺杀邪恶队友", icon: "none" });
        return;
      }
      this.setData({
        selectedAssassinate: pid,
        assassinateCount: 1,
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
    const room = this.data.room;
    if (!room || !this.data.canViewIdentity) return;
    if (!this.data.identityRevealSeen) {
      this.setData({
        showRolePanel: false,
        identityMode: false,
        showPlayerList: false,
        roleInfoLoading: !this.data.roleInfo,
        identityRevealVisible: true,
        identityRevealPhase: "flip"
      });
      if (this.data.roleInfo) {
        this.showIdentityReveal();
      } else {
        this._identityRevealPending = true;
        this.send("VIEW_ROLE");
      }
      return;
    }
    if (this.data.identityMode) {
      this.onCloseRolePanel();
      return;
    }
    this.setData({
      identityMode: true,
      showRolePanel: false,
      showPlayerList: false,
      roleInfoLoading: !this.data.roleInfo
    });
    if (!this.data.roleInfo) {
      this.send("VIEW_ROLE");
    }
  },

  onCloseRolePanel() {
    const shouldMarkSeen = !this.data.identityRevealSeen && this.data.identityRevealVisible;
    if (shouldMarkSeen) {
      this.setData({ identityRevealSeen: true });
    }
    this.hideIdentityReveal(shouldMarkSeen);
    this.setData({
      showRolePanel: false,
      identityMode: false
    });
  },

  clearRoleState(roleInfoLoading = false) {
    this.resetIdentityRevealState();
    const room = this.data.room;
    const seatSlots = room
      ? this.buildSeatSlots(room, this.data.selectedTeam, this.data.selectedAssassinate, [])
      : this.data.seatSlots;
    const nextState = {
      roleInfo: null,
      roleInfoImage: "",
      roleInfoClass: "",
      roleFactionText: "",
      roleVisibleSeats: [],
      roleInfoLoading,
      assassinSeatNo: 0,
      isAssassin: false,
      roleRequested: false,
      myRole: "",
      identityRevealSeen: false,
      showRolePanel: false,
      identityMode: false
    };
    if (room) {
      nextState.seatSlots = seatSlots;
      nextState.roundSeats = this.buildRoundSeats(seatSlots, room.maxPlayers || 7);
    }
    this.setData(nextState);
  },

  resetIdentityRevealState() {
    this._identityRevealPending = true;
    if (this._identityRevealTimer) {
      clearTimeout(this._identityRevealTimer);
      this._identityRevealTimer = null;
    }
    this.setData({
      identityRevealVisible: false,
      identityRevealPhase: "flip"
    });
  },

  showIdentityReveal() {
    if (this._identityRevealTimer) {
      clearTimeout(this._identityRevealTimer);
      this._identityRevealTimer = null;
    }
    this.setData({
      identityRevealVisible: true,
      identityRevealPhase: "flip"
    });
  },

  onTapIdentityReveal() {
    if (!this.data.identityRevealVisible || this.data.identityRevealSeen) return;
    if (this.data.roleInfoLoading || !this.data.roleInfo) return;
    if (this.data.identityRevealPhase === "revealed") {
      this.setData({
        identityRevealSeen: true,
        identityRevealVisible: false,
        identityRevealPhase: "flip",
        identityMode: true,
        showRolePanel: false,
        showPlayerList: false
      });
      return;
    }
    this.setData({ identityRevealPhase: "revealed" });
    if (this._identityRevealTimer) {
      clearTimeout(this._identityRevealTimer);
      this._identityRevealTimer = null;
    }
  },

  hideIdentityReveal(reset = true) {
    if (this._identityRevealTimer) {
      clearTimeout(this._identityRevealTimer);
      this._identityRevealTimer = null;
    }
    if (reset) {
      this._identityRevealPending = false;
    }
    this.setData({
      identityRevealVisible: false,
      identityRevealPhase: "flip"
    });
  },

  onSeatTouchStart(e) {
    const idx = Number(e.detail.index);
    this._seatLongPressTimer = setTimeout(() => {
      this._seatLongPressTimer = null;
      const room = this.data.room;
      const pid = room && Array.isArray(room.seats) ? room.seats[idx] : null;
      const player = pid && Array.isArray(room.players) ? room.players.find((p) => p.id === pid) : null;
      const existing = this.data.seatNotes[idx] || {};
      const currentLabel = existing.label || "";
      const cfg = NOTE_CHIP_CONFIG[currentLabel] || null;
      const avatarMeta = player ? this.avatarMeta(player.avatar || "", player) : { image: "", text: "" };
      this.setData({
        noteModal: {
          show: true,
          seatIndex: idx,
          seat: idx + 1,
          name: player ? player.nickname : `${idx + 1}号位`,
          label: currentLabel,
          targetId: pid || "",
          avatarImage: avatarMeta.image,
          avatarText: avatarMeta.text || String(idx + 1),
          ringStyle: cfg ? `border-color:${cfg.border};background:${cfg.bg};box-shadow:0 0 24rpx ${cfg.bg};` : "",
          labelColor: cfg ? cfg.color : "",
          labelBg: cfg ? cfg.bg : "",
          labelBorder: cfg ? cfg.border : "",
        },
        noteChipsGood: NOTE_LABELS_GOOD.map(l => ({ label: l, icon: NOTE_CHIP_CONFIG[l].icon, color: NOTE_CHIP_CONFIG[l].color, bg: NOTE_CHIP_CONFIG[l].bg, border: NOTE_CHIP_CONFIG[l].border, on: l === currentLabel })),
        noteChipsEvil: NOTE_LABELS_EVIL.map(l => ({ label: l, icon: NOTE_CHIP_CONFIG[l].icon, color: NOTE_CHIP_CONFIG[l].color, bg: NOTE_CHIP_CONFIG[l].bg, border: NOTE_CHIP_CONFIG[l].border, on: l === currentLabel })),
      });
    }, 400);
  },

  onSeatTouchEnd() {
    if (this._seatLongPressTimer) {
      clearTimeout(this._seatLongPressTimer);
      this._seatLongPressTimer = null;
    }
  },

  onSeatTouchCancel() {
    if (this._seatLongPressTimer) {
      clearTimeout(this._seatLongPressTimer);
      this._seatLongPressTimer = null;
    }
  },

  onPickNoteLabel(e) {
    const label = String(e.currentTarget.dataset.label || "");
    const { seatIndex, label: cur } = this.data.noteModal;
    if (seatIndex < 0) return;
    const notes = Object.assign({}, this.data.seatNotes);
    const newLabel = (label && label !== cur) ? label : "";
    if (!newLabel) {
      delete notes[seatIndex];
    } else {
      notes[seatIndex] = { label: newLabel, badgeStyle: NOTE_BADGE_STYLE[newLabel] || '', textStyle: NOTE_TEXT_STYLE[newLabel] || '' };
    }
    const cfg = NOTE_CHIP_CONFIG[newLabel] || null;
    this.setData({
      seatNotes: notes,
      "noteModal.show": false,
      "noteModal.label": newLabel,
      "noteModal.ringStyle": cfg ? `border-color:${cfg.border};background:${cfg.bg};box-shadow:0 0 24rpx ${cfg.bg};` : "",
      "noteModal.labelColor": cfg ? cfg.color : "",
      "noteModal.labelBg": cfg ? cfg.bg : "",
      "noteModal.labelBorder": cfg ? cfg.border : "",
    });
  },

  onCloseNoteModal() {
    this.setData({ "noteModal.show": false });
  },

  noteModalNoop() {},

  onKickFromList(e) {
    const targetId = String(e.detail.id || "");
    const name = String(e.detail.name || "该玩家");
    if (!targetId) return;
    wx.showModal({
      title: "踢出玩家",
      content: `确认将「${name}」踢出房间？`,
      confirmText: "确认",
      cancelText: "取消",
      success: (res1) => {
        if (!res1.confirm) return;
        wx.showModal({
          title: "再次确认",
          content: `踢出操作不可撤销，确定继续？`,
          confirmText: "踢出",
          confirmColor: "#c0392b",
          cancelText: "取消",
          success: (res2) => {
            if (res2.confirm) this.send("KICK_PLAYER", { targetId });
          }
        });
      }
    });
  },

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
        const avatarMeta = this.avatarMeta(player.avatar || "🙂", player);
        return {
          id: pid,
          seat,
          nickname: player.nickname,
          avatarImage: avatarMeta.image,
          avatarText: avatarMeta.text || "🙂"
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.seat - b.seat);
  },

  buildMissionProgress(room) {
    if (!room || !room.game || room.phase !== "mission") {
      return { show: false, team: [], votedCount: 0, round: 0, allVoted: false };
    }
    const game = room.game;
    const teamIds = Array.isArray(game.team) ? game.team : [];
    const missionVotes = game.missionVotes || {};
    const votedCount = teamIds.filter((id) => missionVotes[id] !== undefined).length;
    const team = teamIds.map((pid) => {
      const seat = Array.isArray(room.seats) ? room.seats.findIndex((id) => id === pid) + 1 : 0;
      const player = Array.isArray(room.players) ? room.players.find((p) => p.id === pid) : null;
      const avatarMeta = this.avatarMeta((player && player.avatar) || "🙂", player);
      return {
        id: pid,
        seat,
        nickname: player ? player.nickname : "?",
        avatarImage: avatarMeta.image,
        avatarText: avatarMeta.text || "🙂",
        voted: missionVotes[pid] !== undefined,
      };
    }).sort((a, b) => a.seat - b.seat);
    return {
      show: true,
      team,
      votedCount,
      round: Number(game.round || 0),
      allVoted: votedCount >= teamIds.length && teamIds.length > 0,
    };
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
    // 直接 input 事件：e.detail.value；组件 triggerEvent：e.detail.value（通过 detail 透传）
    const text = (e.detail.value || "").slice(0, 120);
    this.setData({ speakText: text, speakTextLen: text.length });
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

  onAutoplayToggle() {
    const on = !this.data.myAutoplay;
    if (!on) {
      this.send("AUTOPLAY_OFF");
      this.setData({ myAutoplay: false, autoplayAssassinTarget: null });
      return;
    }
    if (this.data.isAssassin) {
      const myId = this.data.clientId;
      const slots = (this.data.seatSlots || []).filter(s => s && s.playerId && s.playerId !== myId);
      this.setData({ showAutoplayPicker: true, autoplayPickerSlots: slots });
    } else {
      this.send("AUTOPLAY_ON");
      this.setData({ myAutoplay: true });
    }
  },

  onAutoplayPickerSelect(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const target = this.data.autoplayPickerSlots[idx];
    if (!target) return;
    this.send("AUTOPLAY_ON", { assassinTarget: target.playerId });
    this.setData({ myAutoplay: true, autoplayAssassinTarget: { seat: target.seat, name: target.name }, showAutoplayPicker: false, autoplayPickerSlots: [] });
  },

  onAutoplayPickerCancel() {
    this.setData({ showAutoplayPicker: false, autoplayPickerSlots: [] });
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
        this.setData({ gameTip: "已请求进入刺杀阶段", identityMode: false });
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
      title: "确认重新开始",
      content: "将按当前配置重新开一局，座位、AI和身份都会按最新配置重新生成，是否继续？",
      confirmText: "重新开始",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) return;
        this.send("REDEAL_IDENTITIES");
        this.clearRoleState(true);
        this.setData({ gameTip: "已请求重新开始", seatNotes: {} });
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
      content: `确认查看 ${targetText} 是正义还是邪恶吗？`,
      confirmText: "确认查看",
      cancelText: "取消",
      success: (res) => {
        if (!res.confirm) return;
        this.send("USE_LADY_OF_LAKE", { targetId });
        this.setData({ gameTip: `已请求查看：${targetText}` });
      }
    });
  },

  onConfirmLadyOfLake() {
    if (!this.data.selectedLadyTarget) {
      wx.showToast({ title: "先选择验人目标", icon: "none" });
      return;
    }
    this.onUseLadyOfLake(this.data.selectedLadyTarget);
  },

  openHistory(arg = 1) {
    wx.navigateTo({ url: "/subpkg/history/index/index" });
  },

  openHistoryDetail(e) {
    const gameId = Number(e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.gameid : e);
    if (!Number.isFinite(gameId)) return;
    this.requestHistoryDetail(gameId);
  },

  openRoleStats() {
    wx.navigateTo({ url: "/subpkg/role-stats/index/index" });
  },

  openRules() {
    wx.navigateTo({ url: "/subpkg/rules/index/index" });
  },

  fetchActiveRooms(showLoading = false) {
    const apiBase = getApp().globalData.apiBase;
    const token = this.data.authToken || wx.getStorageSync("awalonAuthToken") || "";
    const roomCode = this.data.room && this.data.room.code ? String(this.data.room.code) : "";
    if (showLoading) this.setData({ activeRoomsLoading: true });
    const done = () => { if (showLoading) this.setData({ activeRoomsLoading: false }); };
    wx.request({
      url: `${apiBase}/api/rooms${token ? `?token=${encodeURIComponent(token)}` : ""}`,
      timeout: 8000,
      success: (res) => {
        if (res.statusCode === 200 && res.data && Array.isArray(res.data.rooms)) {
          const rooms = res.data.rooms.map((item) => ({
            ...item,
            isCurrentRoom: !!(item && (item.isMine || (roomCode && String(item.code) === roomCode)))
          }));
          const next = JSON.stringify(rooms);
          if (next !== JSON.stringify(this.data.activeRooms)) {
            this.setData({ activeRooms: rooms });
          }
        }
        done();
      },
      fail: done,
    });
  },

  onJoinPublicRoom(e) {
    const code = (e.detail && e.detail.code) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.code);
    if (!code) return;
    if (!this.data.loggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    this.send('JOIN_ROOM', { roomCode: code, nickname: this.data.nickname, avatar: this.data.avatar });
    this.setData({ atHome: false, roomTip: `正在加入房间 ${code}...` });
  },

  onRefreshRooms() {
    this.fetchActiveRooms(true);
  },

  onExitReviewMode() {
    this.setData({ reviewMode: false });
  },

  avatarMeta(avatar, player) {
    const raw = String(avatar || "").trim();
    if (/^https?:\/\//i.test(raw)) {
      return { image: raw, text: "" };
    }
    if (player && player.isAI) {
      const seat = Number.isFinite(player.seat) ? player.seat : 0;
      return { image: AI_AVATAR_URLS[seat % AI_AVATAR_URLS.length], text: "" };
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
    }, () => {
      if (this.data.room) this.ensureShareInviteImage(this.data.room);
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
        this.setData({ nickname: next, loginTip: `昵称已更新：${next}` }, () => {
          this.ensureShareInviteImage(this.data.room || null);
        });
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
        url: "/subpkg/avatarcrop/index",
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

  requestHistoryRecap(gameId) {
    const id = Number(gameId);
    if (!Number.isFinite(id)) return;
    this.send("REQUEST_HISTORY_RECAP", { gameId: id });
  },

  requestRoleStats() {
    this.send("GET_ROLE_STATS", {});
  }
});
