// 游戏常量与纯工具函数

const MAX_ROUNDS = 5;
const FORCE_ROUND_MODE_FIXED_5 = 'fixed5';
const FORCE_ROUND_MODE_EVIL_PLUS_ONE = 'evil_plus_one';

const TEAM_SIZES = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};

const FAIL_REQUIREMENT = {
  5: [1, 1, 1, 1, 1],
  6: [1, 1, 1, 1, 1],
  7: [1, 1, 1, 2, 1],
  8: [1, 1, 1, 2, 1],
  9: [1, 1, 1, 2, 1],
  10: [1, 1, 1, 2, 1],
};

const ROLE_FACTIONS = {
  梅林: 'good',
  派西维尔: 'good',
  忠臣: 'good',
  莫甘娜: 'evil',
  刺客: 'evil',
  莫德雷德: 'evil',
  奥伯伦: 'evil',
  爪牙: 'evil',
};

const EVIL_COUNT_BY_PLAYERS = {
  5: 2,
  6: 2,
  7: 3,
  8: 3,
  9: 3,
  10: 4,
};

function now() { return Date.now(); }

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeId(len = 6) {
  const chars = '0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function isValidPhone(phone) {
  return typeof phone === 'string' && /^1\d{10}$/.test(phone);
}

function makeToken() {
  return `${now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function expectedEvilCount(maxPlayers) {
  return EVIL_COUNT_BY_PLAYERS[Number(maxPlayers)] || 3;
}

function countEvilRoles(roles) {
  return (Array.isArray(roles) ? roles : []).filter((r) => ROLE_FACTIONS[r] === 'evil').length;
}

function normalizeForceRoundMode(mode) {
  return mode === FORCE_ROUND_MODE_EVIL_PLUS_ONE ? FORCE_ROUND_MODE_EVIL_PLUS_ONE : FORCE_ROUND_MODE_FIXED_5;
}

function deriveForcedRound(maxPlayers, roles, mode) {
  const normalized = normalizeForceRoundMode(mode);
  if (normalized === FORCE_ROUND_MODE_EVIL_PLUS_ONE) {
    const evilCount = Array.isArray(roles) && roles.length ? countEvilRoles(roles) : expectedEvilCount(maxPlayers);
    return Math.max(1, Math.min(MAX_ROUNDS, evilCount + 1));
  }
  return MAX_ROUNDS;
}

function isValidRoleConfig(maxPlayers, roles) {
  const count = Number(maxPlayers) || 0;
  if (!Array.isArray(roles) || roles.length !== count) return false;
  if (!roles.every((r) => typeof r === 'string' && ROLE_FACTIONS[r])) return false;
  if (!roles.includes('梅林')) return false;
  return countEvilRoles(roles) === expectedEvilCount(count);
}

function seatNumber(room, playerId) {
  const idx = room.seats.findIndex((id) => id === playerId);
  return idx >= 0 ? idx + 1 : null;
}

function getTeamSize(room) {
  const round = (room.game && room.game.round) || 1;
  const sizes = TEAM_SIZES[room.maxPlayers] || TEAM_SIZES[7];
  return sizes[round - 1] || 3;
}

function getFailRequirement(room) {
  const round = (room.game && room.game.round) || 1;
  const reqs = FAIL_REQUIREMENT[room.maxPlayers] || FAIL_REQUIREMENT[7];
  return reqs[round - 1] || 1;
}

module.exports = {
  MAX_ROUNDS,
  FORCE_ROUND_MODE_FIXED_5,
  FORCE_ROUND_MODE_EVIL_PLUS_ONE,
  TEAM_SIZES,
  FAIL_REQUIREMENT,
  ROLE_FACTIONS,
  EVIL_COUNT_BY_PLAYERS,
  now,
  shuffle,
  makeId,
  isValidPhone,
  makeToken,
  expectedEvilCount,
  countEvilRoles,
  normalizeForceRoundMode,
  deriveForcedRound,
  isValidRoleConfig,
  seatNumber,
  getTeamSize,
  getFailRequirement,
};
