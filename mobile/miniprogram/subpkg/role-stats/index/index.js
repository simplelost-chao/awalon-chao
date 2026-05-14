const { ALL_MEDALS, decorateMedals } = require("../../../utils/medals");
const { SKINS, getSkin } = require("../../../skins");
const socket = require("../../../utils/socket");
const { drawRadar } = require("./radar");

const ROLE_IMAGE_MAP = {
  梅林: "https://www.awalon.top/mp-assets/role-split/merlin.png",
  派西维尔: "https://www.awalon.top/mp-assets/role-split/percival.png",
  忠臣: "https://www.awalon.top/mp-assets/role-split/arthur_loyal.png",
  "亚瑟的忠臣": "https://www.awalon.top/mp-assets/role-split/arthur_loyal.png",
  "兰斯洛特（正义）": "https://www.awalon.top/mp-assets/role-split/lancelot_good.png",
  莫甘娜: "https://www.awalon.top/mp-assets/role-split/morgana.png",
  刺客: "https://www.awalon.top/mp-assets/role-split/assassin.png",
  莫德雷德: "https://www.awalon.top/mp-assets/role-split/mordred.png",
  奥伯伦: "https://www.awalon.top/mp-assets/role-split/oberon.png",
  爪牙: "https://www.awalon.top/mp-assets/role-split/minion.png",
  "兰斯洛特（邪恶）": "https://www.awalon.top/mp-assets/role-split/lancelot_evil.png"
};

const ALL_ROLES = [
  "梅林", "派西维尔", "忠臣",
  "刺客", "莫甘娜", "莫德雷德", "奥伯伦", "爪牙"
];
const GOOD_ROLE_SET = new Set(["梅林", "派西维尔", "忠臣", "亚瑟的忠臣", "兰斯洛特（正义）"]);
const EVIL_ROLE_SET = new Set(["刺客", "莫甘娜", "莫德雷德", "奥伯伦", "爪牙", "兰斯洛特（邪恶）"]);

function getIndexPage() {
  const pages = getCurrentPages();
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    if (pages[i].route === "pages/index/index") return pages[i];
  }
  return null;
}

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    navTotalHeight: 64,
    skinId: 'dark-gold',
    skins: [],
    skinInGameBg: 'https://www.awalon.top/mp-assets/in-game-bg-optimized.jpg',
    loading: true,
    mode: 'pvp',
    profileNickname: '',
    avatarImage: '',
    avatarText: '🐺',
    roleStats: null,
    statsList: [],
    goodSummary: { total: 0, wins: 0, winRate: 0 },
    evilSummary: { total: 0, wins: 0, winRate: 0 },
    factionBarGoodPct: 50,
    factionBarEvilPct: 50,
    medalTotal: 0,
    goodMedals: [],
    evilMedals: [],
    roleMedals: [],
    recentGames: [],
    recentDotsText: '',
    streakLabel: '',
    streakType: null,
    streakCount: 0,
    radarFaction: 'good',
    radarData: null,
    detailTab: 'roles',
    partnerTitles: [],
    partnerMatrix: [],
    expandedPartner: null,
    trendData: null,
    helpVisible: false,
    helpTitle: '',
    helpItems: [],
  },

  onLoad() {
    const app = getApp();
    const nav = (app.globalData && app.globalData.nav) || {};
    const skinId = (app.globalData && app.globalData.skinId) || 'dark-gold';
    const publishedIds = (app.globalData && app.globalData.publishedSkinIds) || ['dark-gold'];
    const skins = SKINS
      .filter((s) => publishedIds.includes(s.id))
      .map((s) => ({ id: s.id, name: s.name, bg: s.colors.bg, panel: s.colors.panel, accent: s.colors.accent }));
    const skinInGameBg = getSkin(skinId).inGameBg;
    const nickname = wx.getStorageSync('awalonNickname') || '未登录';
    const avatar = wx.getStorageSync('awalonAvatar') || '🐺';
    const isUrl = avatar.startsWith('http') || avatar.startsWith('/');
    this.setData({
      statusBarHeight: nav.statusBarHeight || 20,
      navBarHeight: nav.navBarHeight || 44,
      navTotalHeight: nav.navTotalHeight || 64,
      skinId,
      skins,
      skinInGameBg,
      profileNickname: nickname,
      avatarImage: isUrl ? avatar : '',
      avatarText: isUrl ? '' : avatar,
    });
    // Re-filter when API response arrives after page load
    app.globalData.skinsLoadedListener = (published) => {
      const filtered = SKINS
        .filter((s) => published.includes(s.id))
        .map((s) => ({ id: s.id, name: s.name, bg: s.colors.bg, panel: s.colors.panel, accent: s.colors.accent }));
      this.setData({ skins: filtered });
    };
  },

  onShow() {
    const app = getApp();
    // Sync skinId in case it changed
    const skinId = (app.globalData && app.globalData.skinId) || 'dark-gold';
    const skinInGameBg = getSkin(skinId).inGameBg;
    this.setData({ skinId, skinInGameBg });

    app.globalData.roleStatsListener = (raw) => {
      this._rawStats = raw;
      app.globalData.latestRoleStats = raw;
      this.applyStats(raw);
    };

    // 每次进入都重新请求（不用缓存，确保配置变更即时生效）
    app.globalData.latestRoleStats = null;
    const indexPage = getIndexPage();
    if (indexPage && typeof indexPage.requestRoleStats === "function") {
      this.setData({ loading: true });
      indexPage.requestRoleStats();
      return;
    }
    this.setData({ loading: true });
    const sent = socket.send({ type: "GET_ROLE_STATS", payload: {} });
    if (!sent) {
      this.setData({ loading: false });
      wx.showToast({ title: "连接未就绪", icon: "none" });
    }
  },

  onUnload() {
    const app = getApp();
    if (app.globalData.roleStatsListener) app.globalData.roleStatsListener = null;
    if (app.globalData.skinsLoadedListener) app.globalData.skinsLoadedListener = null;
  },

  applyStats(raw) {
    // raw = { pvp: {...}, pve: {...} } 或旧格式兼容
    const mode = this.data.mode;
    const roleStats = (raw && raw.pvp) ? raw[mode] : raw;
    if (!roleStats) { this.setData({ roleStats: null, loading: false }); return; }
    const byRoleMap = new Map(((roleStats.byRole) || []).map((item) => [item.role, item]));
    const statsList = ALL_ROLES.map((role) => {
      const found = byRoleMap.get(role) || null;
      const total = found ? Number(found.total || 0) : 0;
      const wins = found ? Number(found.wins || 0) : 0;
      const winRate = total > 0 ? Number((wins * 100 / total).toFixed(1)) : 0;
      const faction = GOOD_ROLE_SET.has(role) ? "good" : EVIL_ROLE_SET.has(role) ? "evil" : "good";
      return {
        role, total, wins, winRate,
        roleImage: ROLE_IMAGE_MAP[role] || "",
        rateDeg: Number((winRate * 3.6).toFixed(1)),
        winRateClass: winRate >= 50 ? "rate-good" : "rate-bad",
        roleNameClass: faction === "evil" ? "role-name-evil" : "role-name-good",
        faction
      };
    });
    const good = statsList.filter((item) => item.faction === "good");
    const evil = statsList.filter((item) => item.faction === "evil");
    const goodTotal = good.reduce((s, item) => s + Number(item.total || 0), 0);
    const goodWins = good.reduce((s, item) => s + Number(item.wins || 0), 0);
    const evilTotal = evil.reduce((s, item) => s + Number(item.total || 0), 0);
    const evilWins = evil.reduce((s, item) => s + Number(item.wins || 0), 0);
    const goodSummary = {
      total: goodTotal, wins: goodWins,
      winRate: goodTotal > 0 ? Number((goodWins * 100 / goodTotal).toFixed(1)) : 0
    };
    const evilSummary = {
      total: evilTotal, wins: evilWins,
      winRate: evilTotal > 0 ? Number((evilWins * 100 / evilTotal).toFixed(1)) : 0
    };
    const rawMedalMap = new Map(((roleStats.medals) || []).map((m) => [m.code, Number(m.total || 0)]));
    const legacyMerge = { good_protect_round_fail_captain: "good_first_round_clean_captain" };
    for (const [legacyCode, newCode] of Object.entries(legacyMerge)) {
      const legacyCount = rawMedalMap.get(legacyCode) || 0;
      if (legacyCount > 0) rawMedalMap.set(newCode, (rawMedalMap.get(newCode) || 0) + legacyCount);
    }
    const medalList = decorateMedals(ALL_MEDALS.filter((m) => !m.hidden).map((m) => ({
      ...m, total: rawMedalMap.get(m.code) || 0
    })));
    const goodMedals = medalList.filter((m) => m.faction === "good" && !m.role);
    const evilMedals = medalList.filter((m) => m.faction === "evil" && !m.role);
    const roleMedals = medalList.filter((m) => !!m.role);
    const barTotal = goodTotal + evilTotal || 1;
    const factionBarGoodPct = Number((goodTotal * 100 / barTotal).toFixed(1));
    const factionBarEvilPct = Number((100 - factionBarGoodPct).toFixed(1));
    const recentGames = ((roleStats.recentGames) || []).slice().reverse();
    const recentDotsText = recentGames.map(g => g.result === 'win' ? '◆' : '◇').join('');
    const streakType = roleStats.streakType || null;
    const streakCount = Number(roleStats.streakCount || 0);
    this.setData({
      roleStats, statsList, goodSummary, evilSummary,
      factionBarGoodPct, factionBarEvilPct,
      medalTotal: Number(roleStats.totalMedals || 0),
      goodMedals, evilMedals, roleMedals, loading: false,
      recentGames, recentDotsText, streakType, streakCount,
      radarData: roleStats.radar || null,
      trendData: roleStats.trend || null,
      partnerTitles: this._buildPartnerTitles(roleStats.partners),
      partnerMinGames: (roleStats.partners && roleStats.partners._minGames) || 1,
      partnerMatrix: this._buildPartnerMatrix(roleStats.partners)
    }, () => {
      if (roleStats.radar) this._drawRadarChart();
      if (roleStats.trend) this._drawTrendChart();
    });
  },

  onSwitchMode(e) {
    const mode = String(e.currentTarget.dataset.mode || 'pvp');
    if (mode === this.data.mode) return;
    this.setData({ mode });
    if (this._rawStats) this.applyStats(this._rawStats);
  },

  onToggleMode() {
    const mode = this.data.mode === 'pvp' ? 'pve' : 'pvp';
    this.setData({ mode });
    if (this._rawStats) this.applyStats(this._rawStats);
  },

  onPickSkin(e) {
    const skinId = String(e.currentTarget.dataset.id || 'dark-gold');
    const app = getApp();
    wx.setStorageSync('selectedSkin', skinId);
    app.globalData.skinId = skinId;
    const skin = getSkin(skinId);
    this.setData({ skinId, skinInGameBg: skin.inGameBg });
    // Notify index page
    if (typeof app.globalData.skinChangeListener === 'function') {
      app.globalData.skinChangeListener(skinId);
    }
  },

  onTapMedal(e) {
    const name = String(e.currentTarget.dataset.name || "勋章");
    const description = String(e.currentTarget.dataset.description || "暂无说明");
    wx.showModal({ title: name, content: description, showCancel: false, confirmText: "知道了" });
  },

  onBackHome() {
    const pages = getCurrentPages();
    if (pages.length > 1) { wx.navigateBack({ delta: 1 }); return; }
    wx.reLaunch({ url: "/pages/index/index" });
  },

  onSwitchRadar(e) {
    const faction = e.currentTarget.dataset.faction;
    const wasVisible = this.data.radarTipVisible;
    this.setData({ radarFaction: faction, radarTipVisible: false }, () => {
      this._drawRadarChart();
      if (wasVisible) this.onToggleRadarTip();
    });
  },

  onRadarHelp() {
    const isGood = this.data.radarFaction === 'good';
    const s = this.data.roleStats;
    const radarGames = s && s.radar && s.radar._maxGames || '?';
    const items = isGood
      ? [
          { name: '识人', desc: '非梅林时，坏车投反对+好车投赞成的准确率' },
          { name: '领袖', desc: '好人当队长时队伍被投票通过的比例' },
          { name: '表水', desc: '所有通过的队伍中包含自己的比例' },
          { name: '挡刀', desc: '非梅林时被刺客选为刺杀目标的比例' },
          { name: '躲刀', desc: '梅林时刺杀未命中的比例' },
          { name: '胜率', desc: '正义阵营时的总胜率' },
          { name: '说明', desc: `基于最近${radarGames}局，分数经贝叶斯平滑（局数少时偏向50分）` },
        ]
      : [
          { name: '冲锋', desc: '含坏人（含自己）的队伍投赞成的比例' },
          { name: '煽动', desc: '坏人当队长时队伍被投票通过的比例' },
          { name: '表水', desc: '所有通过的队伍中包含自己的比例' },
          { name: '隐秘', desc: '上车后出成功票隐藏身份的比例' },
          { name: '破坏', desc: '上过车的局中出过至少一次失败票的比例' },
          { name: '胜率', desc: '邪恶阵营时的总胜率' },
          { name: '说明', desc: `基于最近${radarGames}局，分数经贝叶斯平滑（局数少时偏向50分）` },
        ];
    this.setData({ helpVisible: true, helpTitle: isGood ? '正义能力维度' : '邪恶能力维度', helpItems: items });
  },

  onFlipTitle(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const pairs = this.data.partnerTitles.slice();
    if (pairs[idx]) {
      pairs[idx] = { ...pairs[idx], flipped: !pairs[idx].flipped };
      this.setData({ partnerTitles: pairs });
    }
  },

  onPartnerHelp() {
    const s = this.data.roleStats;
    const pGames = s && s.partners && s.partners._maxGames || '?';
    const pMin = s && s.partners && s.partners._minGames || '?';
    this.setData({
      helpVisible: true,
      helpTitle: '搭档称号说明',
      helpItems: [
        { name: '黄金搭档', desc: '同阵营胜率最高的搭档' },
        { name: '最坑队友', desc: '同阵营胜率最低的搭档' },
        { name: '最佳狼队友', desc: '同为坏人时胜率最高' },
        { name: '最差狼队友', desc: '同为坏人时胜率最低' },
        { name: '最佳骑士', desc: '同为好人时胜率最高' },
        { name: '最差骑士', desc: '同为好人时胜率最低' },
        { name: '最佳梅派', desc: '梅林+派西组合胜率最高' },
        { name: '最坑梅派', desc: '梅林+派西组合胜率最低' },
        { name: '血脉压制', desc: '对面阵营时我胜率最高' },
        { name: '天生冤家', desc: '对面阵营时我胜率最低' },
        { name: '说明', desc: `基于最近${pGames}局，至少同场${pMin}局才出称号，点击卡片可翻转` },
      ],
    });
  },

  onCloseHelp() {
    this.setData({ helpVisible: false });
  },

  onSwitchDetailTab(e) {
    this.setData({ detailTab: e.currentTarget.dataset.tab });
  },

  onTogglePartner(e) {
    const phone = e.currentTarget.dataset.phone;
    this.setData({ expandedPartner: this.data.expandedPartner === phone ? null : phone });
  },

  _drawRadarChart() {
    const query = this.createSelectorQuery();
    query.select('#radarCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo().pixelRatio || 2;
        canvas.width = 320 * dpr;
        canvas.height = 320 * dpr;
        const faction = this.data.radarFaction;
        const radar = this.data.radarData;
        if (!radar) return;
        const data = faction === 'good' ? radar.good : radar.evil;
        drawRadar(ctx, data, faction, 320);
      });
  },

  _drawTrendChart() {
    const trend = this.data.trendData;
    if (!trend) return;
    const query = this.createSelectorQuery();
    query.select('#trendCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo().pixelRatio || 2;
        const W = 320, H = 100;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.clearRect(0, 0, W * dpr, H * dpr);
        ctx.save();
        ctx.scale(dpr, dpr);

        const n = Math.max(trend.good.length, trend.evil.length);
        if (n < 2) { ctx.restore(); return; }
        const padL = 28, padR = 28, padT = 8, padB = 8;
        const cw = W - padL - padR, ch = H - padT - padB;

        // Y 轴坐标 + 网格线（跳过 0%）
        ctx.font = '9px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        for (let p = 25; p <= 100; p += 25) {
          const y = padT + ch * (1 - p / 100);
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(W - padR, y);
          ctx.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.textAlign = 'right';
          ctx.fillText(p + '%', padL - 4, y);
          ctx.textAlign = 'left';
          ctx.fillText(p + '%', W - padR + 4, y);
        }

        function getPoints(data) {
          const pts = [];
          for (let i = 0; i < n; i++) {
            const v = data[i];
            if (v === null || v === undefined) continue;
            pts.push({ x: padL + (i / (n - 1)) * cw, y: padT + ch * (1 - v / 100), v });
          }
          return pts;
        }

        function drawArea(pts, r, g, b) {
          if (pts.length < 2) return;
          // 渐变填充
          ctx.beginPath();
          ctx.moveTo(pts[0].x, padT + ch);
          pts.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.lineTo(pts[pts.length - 1].x, padT + ch);
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, padT, 0, padT + ch);
          grad.addColorStop(0, `rgba(${r},${g},${b},0.15)`);
          grad.addColorStop(1, `rgba(${r},${g},${b},0.01)`);
          ctx.fillStyle = grad;
          ctx.fill();
          // 线
          ctx.beginPath();
          pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
          ctx.strokeStyle = `rgba(${r},${g},${b},0.8)`;
          ctx.lineWidth = 1.5;
          ctx.lineJoin = 'round';
          ctx.stroke();
          // 每局圆点
          pts.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r},${g},${b},0.9)`;
            ctx.fill();
          });
        }

        drawArea(getPoints(trend.good), 78, 158, 255);
        drawArea(getPoints(trend.evil), 220, 80, 80);

        ctx.restore();
      });
  },

  _buildPartnerTitles(partners) {
    if (!partners || !partners.pairs) return [];
    const CDN = 'https://www.awalon.top/mp-assets/titles';
    const TITLE_META = {
      golden:           { label: '黄金搭档',      icon: `${CDN}/golden.svg` },
      bestWolf:         { label: '最佳狼队友',    icon: `${CDN}/best_wolf.svg` },
      bestKnight:       { label: '最佳骑士',      icon: `${CDN}/best_knight.svg` },
      bestMerlinPerci:  { label: '最佳梅派',      icon: `${CDN}/merlin_perci.svg` },
      dominated:        { label: '血脉压制',      icon: `${CDN}/nemesis.svg` },
      worstTeammate:    { label: '最坑队友',      icon: `${CDN}/worst_teammate.svg` },
      worstWolf:        { label: '最差狼队友',    icon: `${CDN}/worst_teammate.svg` },
      worstKnight:      { label: '最差骑士',      icon: `${CDN}/worst_teammate.svg` },
      worstMerlinPerci: { label: '最坑梅派',      icon: `${CDN}/worst_teammate.svg` },
      nemesis:          { label: '天生冤家',      icon: `${CDN}/nemesis.svg` },
    };
    function decorateTitle(t) {
      const meta = TITLE_META[t.type] || { label: t.type, icon: '' };
      const isUrl = t.avatar && (t.avatar.startsWith('http') || t.avatar.startsWith('/'));
      return { ...t, label: meta.label, iconUrl: meta.icon, avatarImage: isUrl ? t.avatar : '', avatarText: isUrl ? '' : (t.avatar || '🐺') };
    }
    return (partners.pairs || []).map(p => ({
      front: decorateTitle(p.front),
      back: decorateTitle(p.back),
      flipped: false,
    }));
  },

  _buildPartnerMatrix(partners) {
    if (!partners || !partners.matrix) return [];
    return partners.matrix.slice(0, 30).map(p => {
      const isUrl = p.avatar && (p.avatar.startsWith('http') || p.avatar.startsWith('/'));
      return { ...p, avatarImage: isUrl ? p.avatar : '', avatarText: isUrl ? '' : (p.avatar || '🐺') };
    });
  }
});
