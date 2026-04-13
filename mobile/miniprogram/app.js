App({
  onLaunch() {
    let statusBarHeight = 20;
    let navBarHeight = 44;
    try {
      const win = wx.getWindowInfo();
      statusBarHeight = win.statusBarHeight || statusBarHeight;
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
    // 从服务端拉取角色配置，作为唯一配置来源
    wx.request({
      url: this.globalData.apiBase + '/api/role-config',
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          this.globalData.roleConfig = res.data;
          if (typeof this.globalData.roleConfigListener === 'function') {
            this.globalData.roleConfigListener(res.data);
          }
        }
      }
    });
  },
  globalData: {
    wsUrl: "wss://www.awalon.top/ws",
    apiBase: "https://www.awalon.top",
    roleConfig: {},
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
    roleConfigListener: null,
    latestHistoryList: null,
    latestHistoryDetail: null,
    latestRoleStats: null,
    historyListListener: null,
    historyDetailListener: null,
    roleStatsListener: null
  }
});
