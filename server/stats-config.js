// server/stats-config.js — 统计系统可配置参数
// 从 admin-config.json 读取，后台管理页可修改，改完即时生效

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'admin-config.json');

const DEFAULTS = {
  statsRadarMaxGames: 100,
  statsRadarSmoothK: 3,
  statsPartnerMaxGames: 20,
  statsPartnerMinGames: 1,
  statsPartnerSmoothK: 3,
  statsTrendMaxGames: 15,
};

function get() {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (_) {}
  return {
    radarMaxGames:   cfg.statsRadarMaxGames   ?? DEFAULTS.statsRadarMaxGames,
    radarSmoothK:    cfg.statsRadarSmoothK    ?? DEFAULTS.statsRadarSmoothK,
    partnerMaxGames: cfg.statsPartnerMaxGames ?? DEFAULTS.statsPartnerMaxGames,
    partnerMinGames: cfg.statsPartnerMinGames ?? DEFAULTS.statsPartnerMinGames,
    partnerSmoothK:  cfg.statsPartnerSmoothK  ?? DEFAULTS.statsPartnerSmoothK,
    trendMaxGames:   cfg.statsTrendMaxGames   ?? DEFAULTS.statsTrendMaxGames,
  };
}

// 导出 getter，每次调用读取最新值（admin 改了即时生效）
module.exports = {
  get radarMaxGames()   { return get().radarMaxGames; },
  get radarSmoothK()    { return get().radarSmoothK; },
  get partnerMaxGames() { return get().partnerMaxGames; },
  get partnerMinGames() { return get().partnerMinGames; },
  get partnerSmoothK()  { return get().partnerSmoothK; },
  get trendMaxGames()   { return get().trendMaxGames; },
  DEFAULTS,
};
