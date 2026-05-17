Component({
  data: {
    open: false,
    cooldown: false,
    emojis: [
      { id: 'good',  label: '我是好人', image: 'https://www.awalon.top/mp-assets/emoji/good.png?v=4' },
      { id: 'ride',  label: '我要上车', image: 'https://www.awalon.top/mp-assets/emoji/ride.png?v=4' },
      { id: 'vote',  label: '冲一票',   image: 'https://www.awalon.top/mp-assets/emoji/vote.png?v=4' },
      { id: 'wolf',  label: '这车藏匪', image: 'https://www.awalon.top/mp-assets/emoji/wolf.png?v=4' },
      { id: 'perci', label: '听派指车', image: 'https://www.awalon.top/mp-assets/emoji/perci.png?v=4' },
      { id: 'angry', label: '我不满意', image: 'https://www.awalon.top/mp-assets/emoji/angry.png?v=4' },
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
