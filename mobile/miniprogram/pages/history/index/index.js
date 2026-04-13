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

function formatFriendlyTime(ts) {
  if (!ts) return '-';
  const now = Date.now();
  const diff = now - ts;
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (diff < 60000) return '刚刚';
  if (min < 60) return `${min}分钟前`;
  if (hour < 24) return `${hour}小时前`;
  if (day === 1) {
    const d = new Date(ts);
    return `昨天 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  if (day < 7) return `${day}天前`;
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

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
    list: [],
    page: 1,
    hasMore: true,
    loading: false
  },

  onLoad() {
    const nav = (getApp().globalData && getApp().globalData.nav) || {};
    this.setData({
      statusBarHeight: nav.statusBarHeight || 20,
      navBarHeight: nav.navBarHeight || 44,
      navTotalHeight: nav.navTotalHeight || 64
    });
  },

  onShow() {
    const app = getApp();
    app.globalData.historyListListener = (payload) => {
      const rawList = Array.isArray(payload && payload.list) ? payload.list : [];
      const userAvatar = (app.globalData.userInfo && app.globalData.userInfo.avatar) || '';
      const list = rawList.map((item) => ({
        ...item,
        roleImage: item.result === 'spectator' ? '' : (ROLE_IMAGE_MAP[item.role] || ''),
        spectatorAvatar: item.result === 'spectator' ? userAvatar : '',
        friendlyTime: formatFriendlyTime(item.playedAt),
        medals: decorateMedals(item.medals),
        peerVoteSummary: this.formatPeerVoteSummary(item.peerVotes || {})
      }));
      const page = Number(payload && payload.page) || 1;
      const limit = Number(payload && payload.limit) || 10;
      this.setData({
        list,
        page,
        hasMore: list.length >= limit,
        loading: false
      });
    };

    // 每次进入历史页都强制从服务器拉最新数据，避免缓存导致新记录不显示
    this.fetchPage(1);
  },

  onUnload() {
    const app = getApp();
    if (app.globalData.historyListListener) app.globalData.historyListListener = null;
  },

  onBackHome() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.reLaunch({ url: "/pages/index/index" });
  },

  formatPeerVoteSummary(summary = {}) {
    const parts = [];
    if (summary.c_le) parts.push(`C麻了 ${summary.c_le}`);
    if (summary.blame) parts.push(`背锅侠 ${summary.blame}`);
    if (summary.effort) parts.push(`尽力 ${summary.effort}`);
    return parts.join(" · ");
  },

  fetchPage(page) {
    const p = Math.max(1, Number(page) || 1);
    const indexPage = getIndexPage();
    if (!indexPage || typeof indexPage.requestHistoryList !== "function") {
      wx.showToast({ title: "首页未就绪", icon: "none" });
      return;
    }
    this.setData({ loading: true });
    indexPage.requestHistoryList(p);
  },

  onPrev() {
    const p = Math.max(1, (Number(this.data.page) || 1) - 1);
    if (p === this.data.page) return;
    this.fetchPage(p);
  },

  onNext() {
    if (!this.data.hasMore) return;
    const p = (Number(this.data.page) || 1) + 1;
    this.fetchPage(p);
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

  onOpenDetail(e) {
    const gameId = Number(e.currentTarget.dataset.gameid);
    if (!Number.isFinite(gameId)) return;
    const indexPage = getIndexPage();
    if (indexPage && typeof indexPage.requestHistoryDetail === "function") {
      indexPage.requestHistoryDetail(gameId);
    }
    wx.navigateTo({ url: `/pages/history-detail/index/index?gameId=${gameId}` });
  }
});
