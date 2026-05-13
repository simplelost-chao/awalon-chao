Component({
  properties: {
    title: { type: String, value: '' },
    statusBarHeight: { type: Number, value: 20 },
    navBarHeight: { type: Number, value: 44 },
  },
  methods: {
    onBack() {
      this.triggerEvent('back');
    },
  },
});
