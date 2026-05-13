Component({
  properties: {
    roleInfo:         { type: Object,  value: null },
    roleInfoLoading:  { type: Boolean, value: false },
    roleVisibleSeats: { type: Array,   value: [] },
    isAssassin:       { type: Boolean, value: false },
    phase:            { type: String,  value: '' },
    assassinSeatNo:   { type: Number,  value: 0 },
  },

  methods: {
    onStartAssassination() { this.triggerEvent('startassassination'); },
  },
});
