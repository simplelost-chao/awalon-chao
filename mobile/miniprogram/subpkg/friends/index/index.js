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
    friends: [],
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
      const rawFriends = Array.isArray(msg.payload && msg.payload.friends) ? msg.payload.friends : [];
      // Sort: online/in-game first, then offline
      const sorted = rawFriends.slice().sort((a, b) => {
        const aOnline = a.online ? 1 : 0;
        const bOnline = b.online ? 1 : 0;
        return bOnline - aOnline;
      });
      const pendingRequests = Array.isArray(msg.payload && msg.payload.pendingRequests) ? msg.payload.pendingRequests : [];
      this.setData({ friends: sorted, pendingRequests, loading: false });
      return;
    }

    if (msg.type === 'FRIEND_STATUS') {
      const { userId, online, roomCode } = msg.payload || {};
      const friends = this.data.friends.map(f => {
        if (f.userId === userId) {
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
      const req = msg.payload;
      if (!req || !req.userId) return;
      const already = this.data.pendingRequests.some(r => r.userId === req.userId);
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

  onAcceptRequest(e) {
    const userId = e.currentTarget.dataset.userid;
    socket.send({ type: 'FRIEND_RESPOND', payload: { userId, action: 'accept' } });
    const pendingRequests = this.data.pendingRequests.filter(r => r.userId !== userId);
    this.setData({ pendingRequests });
    this.requestFriendsList();
  },

  onRejectRequest(e) {
    const userId = e.currentTarget.dataset.userid;
    socket.send({ type: 'FRIEND_RESPOND', payload: { userId, action: 'reject' } });
    const pendingRequests = this.data.pendingRequests.filter(r => r.userId !== userId);
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
    const userId = e.currentTarget.dataset.userid;
    const nickname = e.currentTarget.dataset.nickname || '该好友';
    wx.showModal({
      title: '删除好友',
      content: `确定要删除好友「${nickname}」吗？`,
      confirmText: '删除',
      confirmColor: '#dc5050',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return;
        socket.send({ type: 'FRIEND_DELETE', payload: { userId } });
        const friends = this.data.friends.filter(f => f.userId !== userId);
        this.setData({ friends });
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
