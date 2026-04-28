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

    // 皮肤
    const savedSkin = wx.getStorageSync('selectedSkin') || 'dark-gold';
    this.globalData.skinId = savedSkin;

    // 审核模式开关
    wx.request({
      url: this.globalData.apiBase + '/api/review-mode',
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          this.globalData.reviewMode = !!res.data.reviewMode;
          if (typeof this.globalData.reviewModeListener === 'function') {
            this.globalData.reviewModeListener(this.globalData.reviewMode);
          }
        }
      }
    });
    // 角色配置
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
    // 已发布皮肤列表
    wx.request({
      url: this.globalData.apiBase + '/api/skins',
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.skins) {
          const published = res.data.skins
            .filter((s) => s.status === 'published')
            .map((s) => s.id);
          this.globalData.publishedSkinIds = published;
          if (typeof this.globalData.skinsLoadedListener === 'function') {
            this.globalData.skinsLoadedListener(published);
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
    skinId: 'dark-gold',
    skinChangeListener: null,
    publishedSkinIds: ['dark-gold'],
    skinsLoadedListener: null,
    reviewMode: false,
    reviewModeListener: null,
    roleConfigListener: null,
    latestHistoryList: null,
    latestHistoryDetail: null,
    latestRoleStats: null,
    historyListListener: null,
    historyDetailListener: null,
    roleStatsListener: null
  }
});
