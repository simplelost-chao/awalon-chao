Component({
  properties: {
    roomRoleCards:        { type: Array,   value: [] },
    playerCards:          { type: Array,   value: [] },
    roomConfigLines:      { type: Array,   value: [] },
    isHost:               { type: Boolean, value: false },
    isAssassin:           { type: Boolean, value: false },
    myAutoplay:           { type: Boolean, value: false },
    autoplayAssassinTarget: { type: Object, value: null },
    roomStarted:          { type: Boolean, value: false },
    phase:                { type: String,  value: '' },
    isSuperPlayer:        { type: Boolean, value: false },
    cheatRevealPlayerId:  { type: String,  value: '' },
    cheatRoles:           { type: Object,  value: {} },
  },

  methods: {
    onStartGame()         { this.triggerEvent('startgame'); },
    onRedealIdentities()  { this.triggerEvent('redeal'); },
    onSettings()          { this.triggerEvent('settings'); },
    onToggleAutoplay()    { this.triggerEvent('toggleautoplay'); },
    onTapRoleCard(e)      { this.triggerEvent('taprolecard', e.detail || e.currentTarget.dataset); },
    onKickPlayer(e)       { this.triggerEvent('kickplayer', e.currentTarget.dataset); },
    onPlayerPressStart(e) { this.triggerEvent('playerpressstart', e.currentTarget.dataset); },
    onPlayerPressEnd(e)   { this.triggerEvent('playerpressend',   e.currentTarget.dataset); },
  },
});
