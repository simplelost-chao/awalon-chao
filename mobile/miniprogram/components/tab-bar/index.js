Component({
  properties: {
    active: {
      type: String,
      value: 'home'
    }
  },

  data: {
    tabs: [
      { key: 'home',    icon: 'https://www.awalon.top/mp-assets/icons/nav-home.svg',    label: '首页',  url: '/pages/index/index' },
      { key: 'friends', icon: 'https://www.awalon.top/mp-assets/icons/nav-friends.svg', label: '好友',  url: '/subpkg/friends/index/index' },
      { key: 'history', icon: 'https://www.awalon.top/mp-assets/icons/nav-history.svg', label: '历史',  url: '/subpkg/history/index/index' },
      { key: 'mine',    icon: 'https://www.awalon.top/mp-assets/icons/nav-mine.svg',    label: '我的',  url: '/subpkg/role-stats/index/index' }
    ]
  },

  methods: {
    onTap(e) {
      const { key, url } = e.currentTarget.dataset;
      if (key === this.properties.active) return;
      const pages = getCurrentPages();
      if (key === 'home') {
        // 回首页：navigateBack 到首页层
        const homeIdx = pages.findIndex(p => p.route === 'pages/index/index');
        if (homeIdx >= 0) {
          wx.navigateBack({ delta: pages.length - 1 - homeIdx });
        } else {
          wx.reLaunch({ url });
        }
      } else {
        // 子页面切换：如果当前不在首页，先回首页再跳
        const cur = pages[pages.length - 1];
        if (cur && cur.route !== 'pages/index/index') {
          // 当前在其他子页面，先 back 到首页再 navigate
          const homeIdx = pages.findIndex(p => p.route === 'pages/index/index');
          if (homeIdx >= 0) {
            wx.navigateBack({
              delta: pages.length - 1 - homeIdx,
              success: () => setTimeout(() => wx.navigateTo({ url }), 50),
            });
          } else {
            wx.redirectTo({ url });
          }
        } else {
          wx.navigateTo({ url });
        }
      }
    }
  }
});
