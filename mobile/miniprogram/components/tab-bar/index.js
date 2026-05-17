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
      if (key === 'home') {
        wx.reLaunch({ url });
      } else {
        wx.redirectTo({ url });
      }
    }
  }
});
