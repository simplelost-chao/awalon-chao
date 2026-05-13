Component({
  properties: {
    selectedRoles:       { type: Array,  value: [] },
    allRoleOptions:      { type: Array,  value: [] },
    maxPlayersIndex:     { type: Number, value: 0 },
    advancedRoleSummary: { type: String, value: '' },
    advancedQuotaText:   { type: String, value: '' },
  },

  methods: {
    onAddRole(e)    { this.triggerEvent('addrole',    e.currentTarget.dataset); },
    onRemoveRole(e) { this.triggerEvent('removerole', e.currentTarget.dataset); },
    onResetRoles()  { this.triggerEvent('resetroles'); },
  },
});
