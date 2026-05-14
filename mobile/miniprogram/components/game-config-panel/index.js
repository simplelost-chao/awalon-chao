Component({
  properties: {
    title:           { type: String,  value: '当前配置' },
    roleCards:       { type: Array,   value: [] },
    configLines:     { type: Array,   value: [] },
    isHost:          { type: Boolean, value: false },
    started:         { type: Boolean, value: false },
    phase:           { type: String,  value: '' },
    showHelp:        { type: Boolean, value: true },
    showActions:     { type: Boolean, value: true },
    myAutoplay:      { type: Boolean, value: false },
  },

  methods: {
    onTapRole(e)      { this.triggerEvent('taprole', e.currentTarget.dataset); },
    onTapHelp()       { this.triggerEvent('taphelp'); },
    onStartGame()     { this.triggerEvent('startgame'); },
    onRedeal()        { this.triggerEvent('redeal'); },
    onSettings()      { this.triggerEvent('settings'); },
    onToggleAutoplay() { this.triggerEvent('toggleautoplay'); },
  },
});
