Component({
  options: { styleIsolation: 'shared' },
  properties: {
    rows: { type: Array, value: [] },
    maxPlayers: { type: Number, value: 0 },
    embedded: { type: Boolean, value: false },
  },
  data: { showLegend: false },
  methods: {
    onLegendShow() { this.setData({ showLegend: true }); },
    onLegendHide() { this.setData({ showLegend: false }); },
  },
});
