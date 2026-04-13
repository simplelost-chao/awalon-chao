// Node.js v22+ localStorage polyfill for miniprogram-ci compatibility
const _store = {};
global.localStorage = {
  getItem: (k) => Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null,
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: (k) => { delete _store[k]; },
  clear: () => { Object.keys(_store).forEach(k => delete _store[k]); },
  get length() { return Object.keys(_store).length; },
};
