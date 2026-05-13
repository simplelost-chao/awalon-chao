Component({
  options: { styleIsolation: 'shared' },
  properties: {
    pills: { type: Array, value: [] },
    embedded: { type: Boolean, value: false },
  },
  data: { showLegend: false },
  methods: {
    onLegendShow() { this.setData({ showLegend: true }); },
    onLegendHide() { this.setData({ showLegend: false }); },
  },
});
