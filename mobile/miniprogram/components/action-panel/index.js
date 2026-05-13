Component({
  options: { styleIsolation: 'shared' },
  properties: {
    mode: { type: String, value: '' }, // 'vote' | 'mission' | 'lady'
    team: { type: Array,  value: [] },
    prompt: { type: Object, value: null },
  },

  methods: {
    onApprove()  { this.triggerEvent('approve'); },
    onReject()   { this.triggerEvent('reject');  },
    onSuccess()  { this.triggerEvent('success'); },
    onFail()     { this.triggerEvent('fail');    },
    onConfirmLady() { this.triggerEvent('confirmlady'); },
  },
});
