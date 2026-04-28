// mobile/miniprogram/skins.js

const CDN = 'https://www.awalon.top/mp-assets';

const ROLE_FILE_MAP = {
  '梅林':    'merlin',
  '派西维尔': 'percival',
  '忠臣':    'arthur_loyal',
  '亚瑟的忠臣': 'arthur_loyal',
  '刺客':    'assassin',
  '莫甘娜':  'morgana',
  '莫德雷德': 'mordred',
  '奥伯伦':  'oberon',
  '爪牙':    'minion',
  '兰斯洛特（正义）': 'lancelot_good',
  '兰斯洛特（邪恶）': 'lancelot_evil',
};

const SKINS = [
  {
    id: 'dark-gold',
    name: '暗夜金',
    isDark: true,
    cssClass: 'theme-dark-gold',
    colors: { bg: '#0f1115', panel: 'rgba(19,23,31,0.82)', accent: '#d9b36b' },
    homeBg:    `${CDN}/home-bg-optimized.jpg`,
    inGameBg:  `${CDN}/in-game-bg-optimized.jpg`,
    imageBase: null,
  },
  {
    id: 'celestial',
    name: '仙境',
    isDark: false,
    cssClass: 'theme-celestial',
    colors: { bg: '#ddeeff', panel: 'rgba(255,255,255,0.75)', accent: '#2e7fc8' },
    homeBg:    `${CDN}/skins/celestial/home-bg.jpg`,
    inGameBg:  `${CDN}/skins/celestial/in-game-bg.jpg`,
    imageBase: `${CDN}/skins/celestial/role-split`,
  },
  {
    id: 'ink-wash',
    name: '水墨古风',
    isDark: false,
    cssClass: 'theme-ink-wash',
    colors: { bg: '#f4f0ea', panel: 'rgba(244,240,234,0.88)', accent: '#2d2520' },
    homeBg:    `${CDN}/skins/ink-wash/home-bg.jpg`,
    inGameBg:  `${CDN}/skins/ink-wash/in-game-bg.jpg`,
    imageBase: `${CDN}/skins/ink-wash/role-split`,
  },
  {
    id: 'cyber-neon',
    name: '赛博霓虹',
    isDark: true,
    cssClass: 'theme-cyber-neon',
    colors: { bg: '#0d0b16', panel: 'rgba(20,16,40,0.88)', accent: '#e879f9' },
    homeBg:    `${CDN}/skins/cyber-neon/home-bg.jpg`,
    inGameBg:  `${CDN}/skins/cyber-neon/in-game-bg.jpg`,
    imageBase: `${CDN}/skins/cyber-neon/role-split`,
  },
  {
    id: 'dark-dungeon',
    name: '暗黑地牢',
    isDark: true,
    cssClass: 'theme-dark-dungeon',
    colors: { bg: '#0e0a07', panel: 'rgba(20,14,8,0.90)', accent: '#c8902a' },
    homeBg:    `${CDN}/skins/dark-dungeon/home-bg.jpg`,
    inGameBg:  `${CDN}/skins/dark-dungeon/in-game-bg.jpg`,
    imageBase: `${CDN}/skins/dark-dungeon/role-split`,
  },
  {
    id: 'abyss',
    name: '深渊',
    isDark: true,
    cssClass: 'theme-abyss',
    colors: { bg: '#050507', panel: 'rgba(8,8,16,0.92)', accent: '#4060c0' },
    homeBg:    `${CDN}/skins/abyss/home-bg.jpg`,
    inGameBg:  `${CDN}/skins/abyss/in-game-bg.jpg`,
    imageBase: `${CDN}/skins/abyss/role-split`,
  },
];

function getSkin(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}

function roleImageFor(role, skinId) {
  const file = ROLE_FILE_MAP[role];
  if (!file) return '';
  const skin = getSkin(skinId);
  const base = (skin && skin.imageBase) ? skin.imageBase : `${CDN}/role-split`;
  return `${base}/${file}.png`;
}

module.exports = { SKINS, getSkin, roleImageFor };
