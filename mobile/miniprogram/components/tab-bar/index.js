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
      const isOnHome = pages[pages.length - 1].route === 'pages/index/index';

      if (key === 'home') {
        // 回首页：navigateBack（快速，无黑屏）
        if (!isOnHome) {
          wx.navigateBack({ delta: pages.length - 1 });
        }
      } else if (isOnHome) {
        // 从首页去子页面：navigateTo（首页留在栈里保持 WS）
        wx.navigateTo({ url });
      } else {
        // 子页面之间切换：redirectTo（替换当前页，栈不增长）
        wx.redirectTo({ url });
      }
    }
  }
});
