Component({
  data: {
    open: false,
    cooldown: false,
    emojis: [
      { id: 'good',  label: '我是好人', image: 'https://www.awalon.top/mp-assets/emoji/good.png' },
      { id: 'ride',  label: '我要上车', image: 'https://www.awalon.top/mp-assets/emoji/ride.png' },
      { id: 'vote',  label: '冲一票',   image: 'https://www.awalon.top/mp-assets/emoji/vote.png' },
      { id: 'wolf',  label: '这车有狼', image: 'https://www.awalon.top/mp-assets/emoji/wolf.png' },
      { id: 'perci', label: '听派指车', image: 'https://www.awalon.top/mp-assets/emoji/perci.png' },
      { id: 'angry', label: '我不满意', image: 'https://www.awalon.top/mp-assets/emoji/angry.png' },
    ],
  },

  methods: {
    onToggle() {
      this.setData({ open: !this.data.open });
    },
    onTap(e) {
      if (this.data.cooldown) return;
      const emojiId = e.currentTarget.dataset.id;
      this.triggerEvent('send', { emojiId });
      this.setData({ cooldown: true, open: false });
      setTimeout(() => this.setData({ cooldown: false }), 3000);
    },
  },
});
