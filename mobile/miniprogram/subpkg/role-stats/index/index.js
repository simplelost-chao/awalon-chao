const { ALL_MEDALS, decorateMedals } = require("../../../utils/medals");
const { SKINS } = require("../../../skins");

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
  "梅林", "派西维尔", "忠臣", "兰斯洛特（正义）",
  "刺客", "莫甘娜", "莫德雷德", "奥伯伦", "爪牙", "兰斯洛特（邪恶）"
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
    loading: true,
    roleStats: null,
    statsList: [],
    goodSummary: { total: 0, wins: 0, winRate: 0 },
    evilSummary: { total: 0, wins: 0, winRate: 0 },
    factionBarGoodPct: 50,
    factionBarEvilPct: 50,
    medalTotal: 0,
    goodMedals: [],
    evilMedals: []
  },

  onLoad() {
    const app = getApp();
    const nav = (app.globalData && app.globalData.nav) || {};
    const skinId = (app.globalData && app.globalData.skinId) || 'dark-gold';
    const skins = SKINS.map((s) => ({
      id: s.id,
      name: s.name,
      bg: s.colors.bg,
      panel: s.colors.panel,
      accent: s.colors.accent,
    }));
    this.setData({
      statusBarHeight: nav.statusBarHeight || 20,
      navBarHeight: nav.navBarHeight || 44,
      navTotalHeight: nav.navTotalHeight || 64,
      skinId,
      skins,
    });
  },

  onShow() {
    const app = getApp();
    // Sync skinId in case it changed
    const skinId = (app.globalData && app.globalData.skinId) || 'dark-gold';
    this.setData({ skinId });

    app.globalData.roleStatsListener = (stats) => {
      const roleStats = stats || null;
      const byRoleMap = new Map(
        (((roleStats && roleStats.byRole) || [])).map((item) => [item.role, item])
      );
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
      const rawMedalMap = new Map((((roleStats && roleStats.medals) || [])).map((m) => [m.code, Number(m.total || 0)]));
      const legacyMerge = { good_protect_round_fail_captain: "good_first_round_clean_captain" };
      for (const [legacyCode, newCode] of Object.entries(legacyMerge)) {
        const legacyCount = rawMedalMap.get(legacyCode) || 0;
        if (legacyCount > 0) rawMedalMap.set(newCode, (rawMedalMap.get(newCode) || 0) + legacyCount);
      }
      const medalList = decorateMedals(ALL_MEDALS.filter((m) => !m.hidden).map((m) => ({
        ...m, total: rawMedalMap.get(m.code) || 0
      })));
      const goodMedals = medalList.filter((m) => m.faction === "good");
      const evilMedals = medalList.filter((m) => m.faction === "evil");
      const barTotal = goodTotal + evilTotal || 1;
      const factionBarGoodPct = Number((goodTotal * 100 / barTotal).toFixed(1));
      const factionBarEvilPct = Number((100 - factionBarGoodPct).toFixed(1));
      this.setData({
        roleStats, statsList, goodSummary, evilSummary,
        factionBarGoodPct, factionBarEvilPct,
        medalTotal: Number((roleStats && roleStats.totalMedals) || 0),
        goodMedals, evilMedals, loading: false
      });
    };

    if (app.globalData.latestRoleStats) {
      app.globalData.roleStatsListener(app.globalData.latestRoleStats);
      return;
    }
    const indexPage = getIndexPage();
    if (indexPage && typeof indexPage.requestRoleStats === "function") {
      this.setData({ loading: true });
      indexPage.requestRoleStats();
    }
  },

  onUnload() {
    const app = getApp();
    if (app.globalData.roleStatsListener) app.globalData.roleStatsListener = null;
  },

  onPickSkin(e) {
    const skinId = String(e.currentTarget.dataset.id || 'dark-gold');
    const app = getApp();
    wx.setStorageSync('selectedSkin', skinId);
    app.globalData.skinId = skinId;
    this.setData({ skinId });
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
  }
});
