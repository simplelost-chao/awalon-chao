const { getSkin, buildVarString } = require('../skins');

function getActiveSkin() {
  try {
    const app = getApp();
    const id = (app && app.globalData && app.globalData.skinId) || 'dark-gold';
    return getSkin(id);
  } catch (e) {
    return getSkin('dark-gold');
  }
}

function applyNewSkin(skinId) {
  try {
    const app = getApp();
    wx.setStorageSync('selectedSkin', skinId);
    if (app && app.globalData) app.globalData.skinId = skinId;
    if (app && typeof app.globalData.skinChangeListener === 'function') {
      app.globalData.skinChangeListener(skinId);
    }
  } catch (e) {}
  return getSkin(skinId);
}

module.exports = { getActiveSkin, applyNewSkin, buildVarString };
