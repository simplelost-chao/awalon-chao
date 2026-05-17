Component({
  data: {
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
    onTap(e) {
      if (this.data.cooldown) return;
      const emojiId = e.currentTarget.dataset.id;
      this.setData({ cooldown: true });
      this.triggerEvent('send', { emojiId });
      setTimeout(() => {
        this.setData({ cooldown: false });
      }, 3000);
    },
  },
});
