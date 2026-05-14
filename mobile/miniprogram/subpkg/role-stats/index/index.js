const { ALL_MEDALS, decorateMedals } = require("../../../utils/medals");
const { SKINS, getSkin } = require("../../../skins");
const socket = require("../../../utils/socket");
const { drawRadar } = require("./radar");

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

const ALL_ROLES = [
  "梅林", "派西维尔", "忠臣",
  "刺客", "莫甘娜", "莫德雷德", "奥伯伦", "爪牙"
];
const GOOD_ROLE_SET = new Set(["梅林", "派西维尔", "忠臣", "亚瑟的忠臣", "兰斯洛特（正义）"]);
const EVIL_ROLE_SET = new Set(["刺客", "莫甘娜", "莫德雷德", "奥伯伦", "爪牙", "兰斯洛特（邪恶）"]);

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
    skins: [],
    skinInGameBg: 'https://www.awalon.top/mp-assets/in-game-bg-optimized.jpg',
    loading: true,
    mode: 'pvp',
    profileNickname: '',
    avatarImage: '',
    avatarText: '🐺',
    roleStats: null,
    statsList: [],
    goodSummary: { total: 0, wins: 0, winRate: 0 },
    evilSummary: { total: 0, wins: 0, winRate: 0 },
    factionBarGoodPct: 50,
    factionBarEvilPct: 50,
    medalTotal: 0,
    goodMedals: [],
    evilMedals: [],
    roleMedals: [],
    recentGames: [],
    recentDotsText: '',
    streakLabel: '',
    streakType: null,
    streakCount: 0,
    radarFaction: 'good',
    radarData: null,
    detailTab: 'roles',
    partnerTitles: [],
    partnerMatrix: [],
    expandedPartner: null,
    radarTipVisible: false,
    radarTipTitle: '',
    radarTipItems: []
  },

  onLoad() {
    const app = getApp();
    const nav = (app.globalData && app.globalData.nav) || {};
    const skinId = (app.globalData && app.globalData.skinId) || 'dark-gold';
    const publishedIds = (app.globalData && app.globalData.publishedSkinIds) || ['dark-gold'];
    const skins = SKINS
      .filter((s) => publishedIds.includes(s.id))
      .map((s) => ({ id: s.id, name: s.name, bg: s.colors.bg, panel: s.colors.panel, accent: s.colors.accent }));
    const skinInGameBg = getSkin(skinId).inGameBg;
    const nickname = wx.getStorageSync('awalonNickname') || '未登录';
    const avatar = wx.getStorageSync('awalonAvatar') || '🐺';
    const isUrl = avatar.startsWith('http') || avatar.startsWith('/');
    this.setData({
      statusBarHeight: nav.statusBarHeight || 20,
      navBarHeight: nav.navBarHeight || 44,
      navTotalHeight: nav.navTotalHeight || 64,
      skinId,
      skins,
      skinInGameBg,
      profileNickname: nickname,
      avatarImage: isUrl ? avatar : '',
      avatarText: isUrl ? '' : avatar,
    });
    // Re-filter when API response arrives after page load
    app.globalData.skinsLoadedListener = (published) => {
      const filtered = SKINS
        .filter((s) => published.includes(s.id))
        .map((s) => ({ id: s.id, name: s.name, bg: s.colors.bg, panel: s.colors.panel, accent: s.colors.accent }));
      this.setData({ skins: filtered });
    };
  },

  onShow() {
    const app = getApp();
    // Sync skinId in case it changed
    const skinId = (app.globalData && app.globalData.skinId) || 'dark-gold';
    const skinInGameBg = getSkin(skinId).inGameBg;
    this.setData({ skinId, skinInGameBg });

    app.globalData.roleStatsListener = (raw) => {
      this._rawStats = raw;
      this.applyStats(raw);
    };

    if (app.globalData.latestRoleStats) {
      this._rawStats = app.globalData.latestRoleStats;
      this.applyStats(app.globalData.latestRoleStats);
      return;
    }
    const indexPage = getIndexPage();
    if (indexPage && typeof indexPage.requestRoleStats === "function") {
      this.setData({ loading: true });
      indexPage.requestRoleStats();
      return;
    }
    this.setData({ loading: true });
    const sent = socket.send({ type: "GET_ROLE_STATS", payload: {} });
    if (!sent) {
      this.setData({ loading: false });
      wx.showToast({ title: "连接未就绪", icon: "none" });
    }
  },

  onUnload() {
    const app = getApp();
    if (app.globalData.roleStatsListener) app.globalData.roleStatsListener = null;
    if (app.globalData.skinsLoadedListener) app.globalData.skinsLoadedListener = null;
  },

  applyStats(raw) {
    // raw = { pvp: {...}, pve: {...} } 或旧格式兼容
    const mode = this.data.mode;
    const roleStats = (raw && raw.pvp) ? raw[mode] : raw;
    if (!roleStats) { this.setData({ roleStats: null, loading: false }); return; }
    const byRoleMap = new Map(((roleStats.byRole) || []).map((item) => [item.role, item]));
    const statsList = ALL_ROLES.map((role) => {
      const found = byRoleMap.get(role) || null;
      const total = found ? Number(found.total || 0) : 0;
      const wins = found ? Number(found.wins || 0) : 0;
      const winRate = total > 0 ? Number((wins * 100 / total).toFixed(1)) : 0;
      const faction = GOOD_ROLE_SET.has(role) ? "good" : EVIL_ROLE_SET.has(role) ? "evil" : "good";
      return {
        role, total, wins, winRate,
        roleImage: ROLE_IMAGE_MAP[role] || "",
        rateDeg: Number((winRate * 3.6).toFixed(1)),
        winRateClass: winRate >= 50 ? "rate-good" : "rate-bad",
        roleNameClass: faction === "evil" ? "role-name-evil" : "role-name-good",
        faction
      };
    });
    const good = statsList.filter((item) => item.faction === "good");
    const evil = statsList.filter((item) => item.faction === "evil");
    const goodTotal = good.reduce((s, item) => s + Number(item.total || 0), 0);
    const goodWins = good.reduce((s, item) => s + Number(item.wins || 0), 0);
    const evilTotal = evil.reduce((s, item) => s + Number(item.total || 0), 0);
    const evilWins = evil.reduce((s, item) => s + Number(item.wins || 0), 0);
    const goodSummary = {
      total: goodTotal, wins: goodWins,
      winRate: goodTotal > 0 ? Number((goodWins * 100 / goodTotal).toFixed(1)) : 0
    };
    const evilSummary = {
      total: evilTotal, wins: evilWins,
      winRate: evilTotal > 0 ? Number((evilWins * 100 / evilTotal).toFixed(1)) : 0
    };
    const rawMedalMap = new Map(((roleStats.medals) || []).map((m) => [m.code, Number(m.total || 0)]));
    const legacyMerge = { good_protect_round_fail_captain: "good_first_round_clean_captain" };
    for (const [legacyCode, newCode] of Object.entries(legacyMerge)) {
      const legacyCount = rawMedalMap.get(legacyCode) || 0;
      if (legacyCount > 0) rawMedalMap.set(newCode, (rawMedalMap.get(newCode) || 0) + legacyCount);
    }
    const medalList = decorateMedals(ALL_MEDALS.filter((m) => !m.hidden).map((m) => ({
      ...m, total: rawMedalMap.get(m.code) || 0
    })));
    const goodMedals = medalList.filter((m) => m.faction === "good" && !m.role);
    const evilMedals = medalList.filter((m) => m.faction === "evil" && !m.role);
    const roleMedals = medalList.filter((m) => !!m.role);
    const barTotal = goodTotal + evilTotal || 1;
    const factionBarGoodPct = Number((goodTotal * 100 / barTotal).toFixed(1));
    const factionBarEvilPct = Number((100 - factionBarGoodPct).toFixed(1));
    const recentGames = ((roleStats.recentGames) || []).slice().reverse();
    const recentDotsText = recentGames.map(g => g.result === 'win' ? '◆' : '◇').join('');
    const streakType = roleStats.streakType || null;
    const streakCount = Number(roleStats.streakCount || 0);
    this.setData({
      roleStats, statsList, goodSummary, evilSummary,
      factionBarGoodPct, factionBarEvilPct,
      medalTotal: Number(roleStats.totalMedals || 0),
      goodMedals, evilMedals, roleMedals, loading: false,
      recentGames, recentDotsText, streakType, streakCount,
      radarData: roleStats.radar || null,
      partnerTitles: this._buildPartnerTitles(roleStats.partners),
      partnerMatrix: this._buildPartnerMatrix(roleStats.partners)
    }, () => {
      if (roleStats.radar) this._drawRadarChart();
    });
  },

  onSwitchMode(e) {
    const mode = String(e.currentTarget.dataset.mode || 'pvp');
    if (mode === this.data.mode) return;
    this.setData({ mode });
    if (this._rawStats) this.applyStats(this._rawStats);
  },

  onPickSkin(e) {
    const skinId = String(e.currentTarget.dataset.id || 'dark-gold');
    const app = getApp();
    wx.setStorageSync('selectedSkin', skinId);
    app.globalData.skinId = skinId;
    const skin = getSkin(skinId);
    this.setData({ skinId, skinInGameBg: skin.inGameBg });
    // Notify index page
    if (typeof app.globalData.skinChangeListener === 'function') {
      app.globalData.skinChangeListener(skinId);
    }
  },

  onTapMedal(e) {
    const name = String(e.currentTarget.dataset.name || "勋章");
    const description = String(e.currentTarget.dataset.description || "暂无说明");
    wx.showModal({ title: name, content: description, showCancel: false, confirmText: "知道了" });
  },

  onBackHome() {
    const pages = getCurrentPages();
    if (pages.length > 1) { wx.navigateBack({ delta: 1 }); return; }
    wx.reLaunch({ url: "/pages/index/index" });
  },

  onSwitchRadar(e) {
    const faction = e.currentTarget.dataset.faction;
    this.setData({ radarFaction: faction }, () => this._drawRadarChart());
  },

  onToggleRadarTip() {
    if (this.data.radarTipVisible) {
      this.setData({ radarTipVisible: false });
      return;
    }
    const isGood = this.data.radarFaction === 'good';
    const items = isGood
      ? [
          { name: '识人能力', desc: '非梅林时，含坏人队伍投反对的比例' },
          { name: '领袖力', desc: '当队长时队伍被投票通过的比例' },
          { name: '表水能力', desc: '非队长时被别人选入队伍的频率' },
          { name: '挡刀能力', desc: '非梅林时被刺客选为刺杀目标的比例' },
          { name: '躲刀能力', desc: '梅林牌时没有被刺杀的比例' },
          { name: '好人胜率', desc: '正义阵营时的胜率' },
        ]
      : [
          { name: '冲锋能力', desc: '含坏人队友的队伍被提出时，投赞成且通过的比例' },
          { name: '隐秘性', desc: '在队伍中出成功票隐藏身份的比例' },
          { name: '表水能力', desc: '非队长时自己能上车的频率' },
          { name: '刺杀能力', desc: '带刀时刺中梅林的比例' },
          { name: '破坏力', desc: '作为坏人上过车的局中，出过失败票的局数比例' },
          { name: '坏人胜率', desc: '邪恶阵营时的胜率' },
        ];
    this.setData({ radarTipVisible: true, radarTipItems: items });
  },

  onTapTitle(e) {
    const type = e.currentTarget.dataset.type;
    const label = e.currentTarget.dataset.label;
    const descriptions = {
      golden: '同阵营（不分好人坏人）时胜率最高的搭档',
      bestWolf: '同为坏人时胜率最高的搭档',
      bestKnight: '同为好人时胜率最高的搭档',
      bestMerlinPerci: '你梅林他派西（或反过来）时胜率最高的搭档',
      nemesis: '对面阵营时你胜率最低的对手，最怕遇到的人',
      worstTeammate: '同阵营时胜率最低的搭档',
    };
    wx.showModal({
      title: label,
      content: descriptions[type] || '',
      showCancel: false,
      confirmText: '知道了',
    });
  },

  onSwitchDetailTab(e) {
    this.setData({ detailTab: e.currentTarget.dataset.tab });
  },

  onTogglePartner(e) {
    const phone = e.currentTarget.dataset.phone;
    this.setData({ expandedPartner: this.data.expandedPartner === phone ? null : phone });
  },

  _drawRadarChart() {
    const query = this.createSelectorQuery();
    query.select('#radarCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo().pixelRatio || 2;
        canvas.width = 320 * dpr;
        canvas.height = 320 * dpr;
        const faction = this.data.radarFaction;
        const radar = this.data.radarData;
        if (!radar) return;
        const data = faction === 'good' ? radar.good : radar.evil;
        drawRadar(ctx, data, faction, 320);
      });
  },

  _buildPartnerTitles(partners) {
    if (!partners || !partners.titles) return [];
    const TITLE_LABELS = {
      golden: '黄金搭档', bestWolf: '最佳狼队友', bestKnight: '最佳骑士搭档',
      bestMerlinPerci: '最佳梅林&派西', nemesis: '天生冤家', worstTeammate: '最坑队友',
    };
    return partners.titles.map(t => {
      const isUrl = t.avatar && (t.avatar.startsWith('http') || t.avatar.startsWith('/'));
      return { ...t, label: TITLE_LABELS[t.type] || t.type, avatarImage: isUrl ? t.avatar : '', avatarText: isUrl ? '' : (t.avatar || '🐺') };
    });
  },

  _buildPartnerMatrix(partners) {
    if (!partners || !partners.matrix) return [];
    return partners.matrix.slice(0, 30).map(p => {
      const isUrl = p.avatar && (p.avatar.startsWith('http') || p.avatar.startsWith('/'));
      return { ...p, avatarImage: isUrl ? p.avatar : '', avatarText: isUrl ? '' : (p.avatar || '🐺') };
    });
  }
});
