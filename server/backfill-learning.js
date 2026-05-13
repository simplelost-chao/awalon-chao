/**
 * backfill-learning.js
 * 对历史对局中已有 recap 但尚未进入 AI 学习系统的局次进行补填。
 *
 * 运行方式（在 server/ 目录下）：
 *   node backfill-learning.js [--dry-run]
 */
'use strict';

const Database = require('better-sqlite3');
const path     = require('path');

const ROLE_FACTIONS = {
  '梅林':   'good', '派西维尔': 'good', '忠臣': 'good', '亚瑟的忠臣': 'good',
  '刺客':   'evil', '莫甘娜':   'evil', '莫德雷德': 'evil', '奥伯伦': 'evil', '爪牙': 'evil',
};

const DRY_RUN = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('[backfill] DRY RUN 模式，不写入数据库');

// ── 直接引入 ai.js 的核心函数 ──────────────────────────────────────────────
const {
  recordGameSummary,
  storeRecapInsights,
  evaluateGameSpeeches,
  extractStrategyPatterns,
} = require('./ai');

const usersDb = new Database(path.join(__dirname, 'users.sqlite'));
const aiDb    = new Database(path.join(__dirname, 'ai.sqlite'));

// ── 找出未进入 game_logs 的已完成对局 ────────────────────────────────────────
const loggedRooms = new Set(
  aiDb.prepare('SELECT room_code FROM game_logs').all().map(r => r.room_code)
);

const allCompleted = usersDb.prepare(
  'SELECT id, room_code, winner, payload FROM game_records WHERE status = ? ORDER BY id ASC'
).all('completed');

const missing = allCompleted.filter(r => !loggedRooms.has(r.room_code));
console.log(`[backfill] 共 ${allCompleted.length} 局完成，已学习 ${loggedRooms.size} 局，待补填 ${missing.length} 局`);

if (missing.length === 0) {
  console.log('[backfill] 无需补填，退出');
  process.exit(0);
}

// ── 从 payload 重建 room 对象（最小结构，满足 ai.js 各函数需求）────────────
function rebuildRoom(payload) {
  const players = payload.players || [];

  // seats 数组：按座位号排列，索引0=座位1
  const maxSeat = players.reduce((m, p) => Math.max(m, p.seat || 0), 0);
  const seats = new Array(maxSeat).fill(null);
  for (const p of players) {
    if (p.seat) seats[p.seat - 1] = p.id;
  }

  // players Map
  const playersMap = new Map();
  for (const p of players) {
    playersMap.set(p.id, {
      id:          p.id,
      nickname:    p.nickname,
      isAI:        !!p.isAI,
      spectator:   false,
      aiPersonaKey:  p.nickname, // 在 game-ai.js 里 aiPersonaKey === nickname 对于 AI 角色
      aiPersonaId:   p.nickname,
      aiStyle:       p.nickname,
    });
  }

  // assignments: playerId → role
  const assignments = {};
  for (const p of players) assignments[p.id] = p.role;

  // roles 数组
  const roles = [...new Set(players.map(p => p.role).filter(Boolean))];

  const game = {
    winner:         payload.winner,
    assignments,
    missionHistory: payload.missionHistory || [],
    voteHistory:    payload.voteHistory    || [],
    speakHistory:   payload.speakHistory   || {},
    speechPatterns: {},
    recapGenerated: true,
  };

  return {
    code:    payload.roomCode,
    seats,
    players: playersMap,
    roles,
    game,
    forceRound: 5,
  };
}

// ── 主补填逻辑 ────────────────────────────────────────────────────────────────
async function backfill() {
  let processed = 0, skipped = 0;

  for (const record of missing) {
    let payload;
    try {
      payload = JSON.parse(record.payload);
    } catch (e) {
      console.warn(`[backfill] ${record.room_code} payload 解析失败，跳过`);
      skipped++;
      continue;
    }

    const winner  = payload.winner || record.winner;
    const recaps  = payload.recaps || [];
    const room    = rebuildRoom(payload);

    console.log(`\n[backfill] 处理 ${record.room_code}（${winner}方胜，${recaps.length} 个复盘，${room.players.size} 名玩家）`);

    if (DRY_RUN) {
      console.log(`  [dry] 跳过写入`);
      processed++;
      continue;
    }

    // 1. 写入 game_logs（注册局次，触发置信度反馈、人类画像更新、元学习）
    recordGameSummary(room, winner, { skipJournals: true, roleFactions: ROLE_FACTIONS });
    console.log(`  ✓ game_logs 写入`);

    // 2. 利用已有 recap 数据写入学习系统
    let recapCount = 0;
    for (const recap of recaps) {
      const player = room.players.get(recap.id);
      if (!player || !player.isAI) continue; // 只处理 AI 玩家的复盘
      const role = room.game.assignments[recap.id];
      if (!role) continue;

      // recap 结构与 decideRecap 返回值相同，直接传入 storeRecapInsights
      try {
        await storeRecapInsights(room, player, role, recap, ROLE_FACTIONS);
        recapCount++;
      } catch (e) {
        console.warn(`  ✗ storeRecapInsights ${player.nickname}(${role}):`, e.message);
      }
    }
    console.log(`  ✓ storeRecapInsights: ${recapCount} 个 AI 复盘已写入`);

    // 3. 评估本局发言质量 → good_speeches
    try {
      await evaluateGameSpeeches(room, ROLE_FACTIONS);
      console.log(`  ✓ evaluateGameSpeeches 完成`);
    } catch (e) {
      console.warn(`  ✗ evaluateGameSpeeches:`, e.message);
    }

    // 4. 提炼战略规律 → strategy_patterns
    try {
      await extractStrategyPatterns(room, ROLE_FACTIONS);
      console.log(`  ✓ extractStrategyPatterns 完成`);
    } catch (e) {
      console.warn(`  ✗ extractStrategyPatterns:`, e.message);
    }

    processed++;
    // 避免并发请求过多，逐局处理
    await new Promise(r => setTimeout(r, 500));
  }

  // 最终统计
  const aiCounts = {
    game_logs:         aiDb.prepare('SELECT COUNT(*) as c FROM game_logs').get().c,
    strategy_patterns: aiDb.prepare('SELECT COUNT(*) as c FROM strategy_patterns').get().c,
    good_speeches:     aiDb.prepare('SELECT COUNT(*) as c FROM good_speeches').get().c,
    ai_memory:         aiDb.prepare('SELECT COUNT(*) as c FROM ai_memory').get().c,
  };

  console.log(`\n[backfill] 完成：处理 ${processed} 局，跳过 ${skipped} 局`);
  console.log('[backfill] 学习库现状:', aiCounts);
}

backfill().catch(e => {
  console.error('[backfill] 致命错误:', e);
  process.exit(1);
});
