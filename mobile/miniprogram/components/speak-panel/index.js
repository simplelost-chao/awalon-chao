Component({
  options: { styleIsolation: 'shared' },
  properties: {
    isMyTurn:           { type: Boolean, value: false },
    isHost:             { type: Boolean, value: false },
    isLeader:           { type: Boolean, value: false },
    speakingSeat:       { type: Number,  value: 0 },
    speakingAvatarImage:{ type: String,  value: '' },
    speakingAvatarText: { type: String,  value: '' },
    speakingProgress:   { type: Number,  value: 100 },
    speakingUrgent:     { type: Boolean, value: false },
    speakingTimerText:  { type: String,  value: '' },
    speakText:          { type: String,  value: '' },
    speakTextLen:       { type: Number,  value: 0 },
  },

  methods: {
    onInput(e) {
      this.triggerEvent('input', { value: e.detail.value });
    },
    onSend() {
      this.triggerEvent('send');
    },
    onEnd() {
      this.triggerEvent('end');
    },
    onSkipSpeak() {
      this.triggerEvent('skipspeak');
    },
    onDirectVote() {
      this.triggerEvent('directvote');
    },
  },
});
