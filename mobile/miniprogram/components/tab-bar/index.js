Component({
  properties: {
    active: {
      type: String,
      value: 'home'
    }
  },

  data: {
    tabs: [
      { key: 'home',    icon: '🏠', label: '首页',  url: '/pages/index/index' },
      { key: 'friends', icon: '👥', label: '好友',  url: '/subpkg/friends/index/index' },
      { key: 'history', icon: '📋', label: '历史',  url: '/subpkg/history/index/index' },
      { key: 'mine',    icon: '👤', label: '我的',  url: '/subpkg/role-stats/index/index' }
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
