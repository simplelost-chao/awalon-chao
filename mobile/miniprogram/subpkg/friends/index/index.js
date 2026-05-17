const { getSkin } = require("../../../skins");
const socket = require("../../../utils/socket");

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
    skinInGameBg: 'https://www.awalon.top/mp-assets/in-game-bg-optimized.jpg',
    friendTab: 'list',
    friends: [],
    pagedFriends: [],
    friendPage: 1,
    friendPageDisplay: '01',
    totalPages: 1,
    pageSize: 10,
    sentRequests: [],
    pendingRequests: [],
    loading: true
  },

  onLoad() {
    const app = getApp();
    const nav = (app.globalData && app.globalData.nav) || {};
    const skinId = (app.globalData && app.globalData.skinId) || 'dark-gold';
    this.setData({
      statusBarHeight: nav.statusBarHeight || 20,
      navBarHeight: nav.navBarHeight || 44,
      navTotalHeight: nav.navTotalHeight || 64,
      skinId,
      skinInGameBg: getSkin(skinId).inGameBg
    });
  },

  onShow() {
    const app = getApp();
    const skinId = (app.globalData && app.globalData.skinId) || 'dark-gold';
    this.setData({ skinId, skinInGameBg: getSkin(skinId).inGameBg });

    app.globalData.friendsListener = (msg) => this.onFriendsMessage(msg);

    this.requestFriendsList();
  },

  onUnload() {
    const app = getApp();
    if (app.globalData.friendsListener) app.globalData.friendsListener = null;
  },

  requestFriendsList() {
    const sent = socket.send({ type: 'GET_FRIENDS', payload: {} });
    if (!sent) {
      this.setData({ loading: false });
    }
  },

  onFriendsMessage(msg) {
    if (!msg || !msg.type) return;

    if (msg.type === 'FRIENDS_LIST') {
      const d = msg.data || msg.payload || {};
      const rawFriends = Array.isArray(d.friends) ? d.friends : [];
      const sorted = rawFriends.slice().sort((a, b) => {
        const aOnline = a.online ? 1 : 0;
        const bOnline = b.online ? 1 : 0;
        return bOnline - aOnline;
      });
      const pendingRequests = Array.isArray(d.pending) ? d.pending : [];
      const sentRequests = Array.isArray(d.sent) ? d.sent : [];
      this.setData({ friends: sorted, pendingRequests, sentRequests, loading: false, friendPage: 1 });
      this._updatePage();
      return;
    }

    if (msg.type === 'FRIEND_STATUS') {
      const { phone, online, roomCode } = msg.data || msg.payload || {};
      const friends = this.data.friends.map(f => {
        if (f.phone === phone) {
          return { ...f, online: !!online, roomCode: roomCode || null };
        }
        return f;
      });
      const sorted = friends.slice().sort((a, b) => {
        const aOnline = a.online ? 1 : 0;
        const bOnline = b.online ? 1 : 0;
        return bOnline - aOnline;
      });
      this.setData({ friends: sorted });
      return;
    }

    if (msg.type === 'FRIEND_REQUEST_RECEIVED') {
      const req = msg.data || msg.payload;
      if (!req || !req.fromPhone) return;
      const already = this.data.pendingRequests.some(r => r.phone === req.fromPhone);
      if (!already) {
        this.setData({ pendingRequests: this.data.pendingRequests.concat([req]) });
      }
      return;
    }

    if (msg.type === 'FRIEND_RESPONSE') {
      // Refresh full list after a response (accept/reject from other side)
      this.requestFriendsList();
    }
  },

  _updatePage() {
    const { friends, friendPage, pageSize } = this.data;
    const totalPages = Math.max(1, Math.ceil(friends.length / pageSize));
    const page = Math.min(friendPage, totalPages);
    const start = (page - 1) * pageSize;
    const pagedFriends = friends.slice(start, start + pageSize);
    this.setData({ pagedFriends, friendPage: page, friendPageDisplay: String(page).padStart(2, '0'), totalPages });
  },

  onPrevPage() {
    if (this.data.friendPage <= 1) return;
    this.setData({ friendPage: this.data.friendPage - 1 });
    this._updatePage();
  },

  onNextPage() {
    if (this.data.friendPage >= this.data.totalPages) return;
    this.setData({ friendPage: this.data.friendPage + 1 });
    this._updatePage();
  },

  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.friendTab) return;
    this.setData({ friendTab: tab });
  },

  onAcceptRequest(e) {
    const phone = e.currentTarget.dataset.phone;
    if (!phone) return;
    socket.send({ type: 'FRIEND_RESPOND', payload: { phone, accept: true } });
    const pendingRequests = this.data.pendingRequests.filter(r => r.phone !== phone);
    this.setData({ pendingRequests });
    setTimeout(() => this.requestFriendsList(), 500);
  },

  onRejectRequest(e) {
    const phone = e.currentTarget.dataset.phone;
    if (!phone) return;
    socket.send({ type: 'FRIEND_RESPOND', payload: { phone, accept: false } });
    const pendingRequests = this.data.pendingRequests.filter(r => r.phone !== phone);
    this.setData({ pendingRequests });
  },

  onJoinRoom(e) {
    const roomCode = e.currentTarget.dataset.roomcode;
    if (!roomCode) return;
    const indexPage = getIndexPage();
    if (indexPage && typeof indexPage.joinRoomByCode === 'function') {
      indexPage.joinRoomByCode(roomCode);
    } else {
      socket.send({ type: 'JOIN_ROOM', payload: { roomCode } });
    }
    wx.reLaunch({ url: '/pages/index/index' });
  },

  onDeleteFriend(e) {
    const phone = e.currentTarget.dataset.phone;
    const nickname = e.currentTarget.dataset.nickname || '该好友';
    wx.showModal({
      title: '删除好友',
      content: `确定要删除好友「${nickname}」吗？`,
      confirmText: '删除',
      confirmColor: '#dc5050',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return;
        socket.send({ type: 'FRIEND_DELETE', payload: { phone } });
        const friends = this.data.friends.filter(f => f.phone !== phone);
        this.setData({ friends });
        this._updatePage();
      }
    });
  },

  onBackHome() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
