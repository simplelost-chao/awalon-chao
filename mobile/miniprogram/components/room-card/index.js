Component({
  properties: {
    roomData: { type: Object, value: {} },
    isCurrentRoom: { type: Boolean, value: false },
  },
  methods: {
    onResumeTap() {
      this.triggerEvent('resume', { code: this.properties.roomData.code });
    },
    onJoinTap() {
      this.triggerEvent('join', { code: this.properties.roomData.code });
    },
  },
});
