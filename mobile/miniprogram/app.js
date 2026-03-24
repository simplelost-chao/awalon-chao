App({
  onLaunch() {
    let statusBarHeight = 20;
    let navBarHeight = 44;
    try {
      const sys = wx.getSystemInfoSync();
      statusBarHeight = sys.statusBarHeight || statusBarHeight;
      const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
      if (menu && menu.height && menu.top) {
        navBarHeight = menu.height + (menu.top - statusBarHeight) * 2;
      }
    } catch (e) {}
    this.globalData.nav = {
      statusBarHeight,
      navBarHeight,
      navTotalHeight: statusBarHeight + navBarHeight
    };
  },
  globalData: {
    wsUrl: "wss://www.awalon.top/ws",
    apiBase: "https://www.awalon.top",
    nav: {
      statusBarHeight: 20,
      navBarHeight: 44,
      navTotalHeight: 64
    },
    theme: {
      bg: "#0f1115",
      panel: "rgba(19,23,31,0.82)",
      border: "rgba(255,255,255,0.1)",
      text: "#eef1f7",
      subText: "#aeb6c7",
      accent: "#d9b36b"
    },
    latestHistoryList: null,
    latestHistoryDetail: null,
    latestRoleStats: null,
    historyListListener: null,
    historyDetailListener: null,
    roleStatsListener: null
  }
});
