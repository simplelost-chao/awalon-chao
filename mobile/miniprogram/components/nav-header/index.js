Component({
  properties: {
    title: { type: String, value: '' },
    statusBarHeight: { type: Number, value: 20 },
    navBarHeight: { type: Number, value: 44 },
    showBack: { type: Boolean, value: false },
  },
  methods: {
    onBack() {
      this.triggerEvent('back');
    },
  },
});
