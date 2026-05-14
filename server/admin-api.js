const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { userDb } = require('./db');

// AI database (read-only access for admin)
const aiDb = new Database(path.join(__dirname, 'ai.sqlite'), { readonly: true, fileMustExist: false });

const CONFIG_PATH = path.join(__dirname, 'admin-config.json');

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (_) { return {}; }
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function adminRoutes(app, { ADMIN_KEY, getRooms, getRuntimeReviewMode, setRuntimeReviewMode, SKIN_CATALOGUE, AI_CHARACTERS, getDefaultRoleConfig }) {

  function requireAdmin(req, res, next) {
    if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
    next();
  }

  // ── Dashboard Stats ──────────────────────────────────────────────
  app.get('/api/admin/dashboard-stats', requireAdmin, (req, res) => {
    try {
      const totalGames = userDb.prepare("SELECT COUNT(*) as c FROM game_records WHERE COALESCE(status,'completed')='completed'").get().c;
      const totalPlayers = userDb.prepare('SELECT COUNT(*) as c FROM users').get().c;
      const wins = userDb.prepare("SELECT winner, COUNT(*) as c FROM game_records WHERE COALESCE(status,'completed')='completed' AND winner IN ('good','evil') GROUP BY winner").all();
      const winMap = {};
      wins.forEach(r => { winMap[r.winner] = r.c; });
      const total = (winMap.good || 0) + (winMap.evil || 0);
      const recentGames = userDb.prepare(
        'SELECT id, room_code as roomCode, max_players as maxPlayers, winner, ended_at as endedAt, status FROM game_records ORDER BY id DESC LIMIT 10'
      ).all();
      const activeRoomsList = [];
      for (const room of getRooms().values()) {
        if (room._historyMode || room.phase === 'end' || String(room.code).startsWith('hist')) continue;
        if (!room.hostId || !room.players) continue;
        const host = room.players.get(room.hostId);
        const humanCount = Array.from(room.players.values()).filter(p => !p.isAI && !p.spectator).length;
        activeRoomsList.push({
          code: room.code,
          hostName: host ? (host.nickname || '玩家') : '?',
          playerCount: humanCount,
          maxPlayers: room.maxPlayers,
          started: !!room.started,
          phase: room.phase || 'waiting',
        });
      }
      res.json({
        totalGames,
        totalPlayers,
        activeRooms: activeRoomsList.length,
        goodWinRate: total > 0 ? Number(((winMap.good || 0) * 100 / total).toFixed(1)) : 0,
        evilWinRate: total > 0 ? Number(((winMap.evil || 0) * 100 / total).toFixed(1)) : 0,
        recentGames,
        activeRoomsList,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Room Detail ──────────────────────────────────────────────────
  app.get('/api/admin/rooms/:code', requireAdmin, (req, res) => {
    const room = getRooms().get(req.params.code);
    if (!room || !room.players) return res.status(404).json({ error: 'room not found' });
    const assignments = (room.game && room.game.assignments) || {};
    const ROLE_FACTIONS = { '梅林':'good','派西维尔':'good','忠臣':'good','莫甘娜':'evil','刺客':'evil','莫德雷德':'evil','奥伯伦':'evil','爪牙':'evil' };
    const players = [];
    for (const [id, p] of room.players.entries()) {
      const role = assignments[id] || p.role || '';
      players.push({
        id,
        nickname: p.nickname || '?',
        avatar: p.avatar || '',
        seat: p.seat,
        role,
        faction: ROLE_FACTIONS[role] || '',
        isAI: !!p.isAI,
        isHost: id === room.hostId,
        spectator: !!p.spectator,
        phone: p.phone || '',
      });
    }
    players.sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99));
    const game = room.game || {};
    const missionHistory = game.missionHistory || [];
    const round = game.round || 0;
    const attempt = game.attempt || 0;
    const leaderId = game.leaderId || '';
    const team = game.selectedTeam || [];
    res.json({
      code: room.code,
      phase: room.phase || 'lobby',
      started: !!room.started,
      maxPlayers: room.maxPlayers,
      players,
      round,
      attempt,
      leaderId,
      leaderName: (room.players.get(leaderId) || {}).nickname || '',
      team: team.map(id => ({ id, nickname: (room.players.get(id) || {}).nickname || '?' })),
      missionHistory: missionHistory.map(m => ({ round: m.round, success: m.success, fails: m.fails })),
      speakingSeconds: room.speakingSeconds,
      ladyOfLakeEnabled: !!room.ladyOfLakeEnabled,
      oberonVisibleEnabled: !!room.oberonVisibleEnabled,
    });
  });

  // ── Games List ───────────────────────────────────────────────────
  app.get('/api/admin/games', requireAdmin, (req, res) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      let where = 'WHERE 1=1';
      const params = [];
      if (req.query.status) { where += " AND COALESCE(status,'completed')=?"; params.push(req.query.status); }
      if (req.query.winner) { where += ' AND winner=?'; params.push(req.query.winner); }
      const total = userDb.prepare(`SELECT COUNT(*) as c FROM game_records ${where}`).get(...params).c;
      const rows = userDb.prepare(
        `SELECT id, room_code as roomCode, max_players as maxPlayers, winner, ended_at as endedAt, started_at as startedAt, status
         FROM game_records ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
      ).all(...params, limit, offset);
      const games = rows.map(r => {
        const pc = userDb.prepare("SELECT COUNT(*) as c FROM game_participants WHERE game_id=? AND COALESCE(role,'')!='观战'").get(r.id);
        return { ...r, playerCount: pc.c };
      });
      res.json({ games, total, page, limit });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Game Detail ──────────────────────────────────────────────────
  app.get('/api/admin/games/:id', requireAdmin, (req, res) => {
    try {
      const row = userDb.prepare('SELECT * FROM game_records WHERE id=?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'not found' });
      let payload = null;
      try { payload = JSON.parse(row.payload); } catch (_) {}
      const participants = userDb.prepare(
        'SELECT client_id as clientId, nickname, seat, role, faction, result, is_host as isHost, is_ai as isAI FROM game_participants WHERE game_id=? ORDER BY seat'
      ).all(row.id);
      const medals = userDb.prepare(
        'SELECT phone, client_id as clientId, medal_code as code, medal_name as name FROM participant_medals WHERE game_id=?'
      ).all(row.id);
      res.json({
        game: { id: row.id, roomCode: row.room_code, winner: row.winner, status: row.status, startedAt: row.started_at, endedAt: row.ended_at },
        participants, medals, payload,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Fix Assassination Result ──────────────────────────────────────
  app.post('/api/admin/games/:id/fix-assassination', requireAdmin, (req, res) => {
    try {
      const { MEDAL_DEFS, evaluateMedalsForPayload } = require('./medals');
      const gameId = Number(req.params.id);
      const { targetId, hit } = req.body || {};
      if (!targetId || typeof hit !== 'boolean') return res.status(400).json({ error: 'need targetId and hit (boolean)' });

      const row = userDb.prepare('SELECT * FROM game_records WHERE id=?').get(gameId);
      if (!row) return res.status(404).json({ error: 'game not found' });
      const payload = JSON.parse(row.payload);
      if (!payload.assassination) return res.status(400).json({ error: 'this game has no assassination phase' });

      // 1. Update payload assassination
      payload.assassination.targetId = targetId;
      payload.assassination.hit = hit;

      // 2. Determine new winner
      const newWinner = hit ? 'evil' : 'good';
      payload.winner = newWinner;
      payload.endReason = 'assassination';

      // 3. Update game_records
      userDb.prepare('UPDATE game_records SET payload=?, winner=? WHERE id=?').run(JSON.stringify(payload), newWinner, gameId);

      // 4. Update participants result
      userDb.prepare("UPDATE game_participants SET result='win' WHERE game_id=? AND faction=?").run(gameId, newWinner);
      userDb.prepare("UPDATE game_participants SET result='lose' WHERE game_id=? AND faction!=? AND role NOT IN ('观战','')").run(gameId, newWinner);

      // 5. Recalculate medals
      userDb.prepare('DELETE FROM participant_medals WHERE game_id=?').run(gameId);
      const medalMap = evaluateMedalsForPayload(payload);
      const parts = userDb.prepare('SELECT client_id, phone FROM game_participants WHERE game_id=?').all(gameId);
      const phoneById = {};
      parts.forEach(p => { phoneById[p.client_id] = p.phone || ''; });
      const ins = userDb.prepare('INSERT INTO participant_medals(game_id, phone, client_id, medal_code, medal_name, created_at) VALUES(?,?,?,?,?,?)');
      let medalCount = 0;
      for (const [playerId, codes] of Object.entries(medalMap)) {
        for (const code of codes) {
          const def = MEDAL_DEFS[code];
          if (!def) continue;
          ins.run(gameId, phoneById[playerId] || '', playerId, code, def.name, Date.now());
          medalCount++;
        }
      }

      res.json({ ok: true, winner: newWinner, medalsInserted: medalCount });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Players List ─────────────────────────────────────────────────
  app.get('/api/admin/players', requireAdmin, (req, res) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      let where = 'WHERE 1=1';
      const params = [];
      if (req.query.search) {
        where += ' AND (nickname LIKE ? OR phone LIKE ?)';
        const q = `%${req.query.search}%`;
        params.push(q, q);
      }
      const total = userDb.prepare(`SELECT COUNT(*) as c FROM users ${where}`).get(...params).c;
      const rows = userDb.prepare(`SELECT phone, nickname, avatar, created_at as createdAt FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
      const players = rows.map(u => {
        const stats = userDb.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins FROM game_participants WHERE phone=? AND role NOT IN ('观战','') AND game_id IN (SELECT id FROM game_records WHERE COALESCE(status,'completed')='completed')").get(u.phone);
        const medalCount = userDb.prepare('SELECT COUNT(*) as c FROM participant_medals WHERE phone=?').get(u.phone).c;
        const topRoles = userDb.prepare(
          "SELECT role, COUNT(*) as cnt FROM game_participants WHERE phone=? AND role NOT IN ('观战','') AND game_id IN (SELECT id FROM game_records WHERE COALESCE(status,'completed')='completed') GROUP BY role ORDER BY cnt DESC LIMIT 3"
        ).all(u.phone);
        const t = Number(stats.total || 0);
        const w = Number(stats.wins || 0);
        return {
          phone: u.phone,
          nickname: u.nickname,
          avatar: u.avatar,
          totalGames: t,
          winRate: t > 0 ? Number((w * 100 / t).toFixed(1)) : 0,
          medalCount,
          topRoles: topRoles.map(r => `${r.role}(${r.cnt})`),
          createdAt: u.createdAt,
        };
      });
      res.json({ players, total, page, limit });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Player Detail ────────────────────────────────────────────────
  app.get('/api/admin/players/:phone', requireAdmin, (req, res) => {
    try {
      const phone = req.params.phone;
      const user = userDb.prepare('SELECT phone, nickname, avatar, created_at as createdAt FROM users WHERE phone=?').get(phone);
      if (!user) return res.status(404).json({ error: 'not found' });
      const { MEDAL_DEFS } = require('./medals');

      function buildStats(excludeAI) {
        const aiFilter = excludeAI
          ? 'AND NOT EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id=gp.game_id AND ai.is_ai=1)'
          : 'AND EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id=gp.game_id AND ai.is_ai=1)';
        const medalAiFilter = excludeAI
          ? 'AND NOT EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id=pm.game_id AND ai.is_ai=1)'
          : 'AND EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id=pm.game_id AND ai.is_ai=1)';
        const byRole = userDb.prepare(
          `SELECT gp.role, COUNT(*) as total, SUM(CASE WHEN gp.result='win' THEN 1 ELSE 0 END) as wins
           FROM game_participants gp JOIN game_records gr ON gr.id=gp.game_id
           WHERE gp.phone=? AND gp.role NOT IN ('观战','') AND COALESCE(gr.status,'completed')='completed' ${aiFilter}
           GROUP BY gp.role ORDER BY total DESC`
        ).all(phone);
        const medalRows = userDb.prepare(
          `SELECT pm.medal_code as code, COUNT(*) as total
           FROM participant_medals pm JOIN game_records gr ON gr.id=pm.game_id
           WHERE pm.phone=? AND COALESCE(gr.status,'completed')='completed' ${medalAiFilter}
           GROUP BY pm.medal_code ORDER BY total DESC`
        ).all(phone);
        const medals = medalRows.map(r => {
          const def = MEDAL_DEFS[r.code];
          return { code: r.code, name: def ? def.name : r.code, faction: def ? def.faction : '', description: def ? def.description : '', total: r.total };
        });
        const recentGames = userDb.prepare(
          `SELECT gp.game_id as gameId, gr.room_code as roomCode, gp.role, gp.result, gr.winner, gr.ended_at as endedAt
           FROM game_participants gp JOIN game_records gr ON gr.id=gp.game_id
           WHERE gp.phone=? AND COALESCE(gr.status,'completed')='completed' ${aiFilter}
           ORDER BY gr.ended_at DESC LIMIT 10`
        ).all(phone);
        const totalGames = byRole.reduce((s, r) => s + Number(r.total || 0), 0);
        const totalWins = byRole.reduce((s, r) => s + Number(r.wins || 0), 0);
        const winRate = totalGames > 0 ? Number((totalWins * 100 / totalGames).toFixed(1)) : 0;
        const medalCount = medals.reduce((s, m) => s + Number(m.total || 0), 0);
        let streak = 0, streakType = null;
        const validRecent = recentGames.filter(g => g.result === 'win' || g.result === 'lose');
        if (validRecent.length) {
          streakType = validRecent[0].result;
          for (const g of validRecent) {
            if (g.result === streakType) streak++;
            else break;
          }
          if (streakType === 'lose') streak = -streak;
        }
        const { buildRadar } = require('./stats-radar');
        const { buildPartners } = require('./stats-partners');
        const radar = buildRadar(phone, excludeAI);
        const partners = buildPartners(phone, excludeAI);
        return { byRole, medals, recentGames, totalGames, wins: totalWins, winRate, medalCount, currentStreak: streak, radar, partners };
      }
      res.json({ user, pvp: buildStats(true), pve: buildStats(false) });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Player Games (paginated) ──────────────────────────────────────
  app.get('/api/admin/players/:phone/games', requireAdmin, (req, res) => {
    try {
      const phone = req.params.phone;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const mode = req.query.mode; // 'pvp' or 'pve'
      let aiFilter = '';
      if (mode === 'pvp') aiFilter = 'AND NOT EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id=gp.game_id AND ai.is_ai=1)';
      else if (mode === 'pve') aiFilter = 'AND EXISTS (SELECT 1 FROM game_participants ai WHERE ai.game_id=gp.game_id AND ai.is_ai=1)';
      const total = userDb.prepare(
        `SELECT COUNT(*) as c FROM game_participants gp JOIN game_records gr ON gr.id=gp.game_id WHERE gp.phone=? AND gp.role NOT IN ('观战','') AND COALESCE(gr.status,'completed')='completed' ${aiFilter}`
      ).get(phone).c;
      const games = userDb.prepare(
        `SELECT gp.game_id as gameId, gr.room_code as roomCode, gp.role, gp.result, gr.winner, gr.ended_at as endedAt
         FROM game_participants gp JOIN game_records gr ON gr.id=gp.game_id
         WHERE gp.phone=? AND gp.role NOT IN ('观战','') AND COALESCE(gr.status,'completed')='completed' ${aiFilter}
         ORDER BY gr.ended_at DESC LIMIT ? OFFSET ?`
      ).all(phone, limit, offset);
      res.json({ games, total, page, limit });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── AI Games (paginated) ─────────────────────────────────────────
  app.get('/api/admin/ai/:name/games', requireAdmin, (req, res) => {
    try {
      const name = req.params.name;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      const total = userDb.prepare(
        "SELECT COUNT(*) as c FROM game_participants gp JOIN game_records gr ON gr.id=gp.game_id WHERE gp.nickname=? AND gp.is_ai=1 AND gp.role NOT IN ('观战','') AND COALESCE(gr.status,'completed')='completed'"
      ).get(name).c;
      const games = userDb.prepare(
        `SELECT gp.game_id as gameId, gr.room_code as roomCode, gp.role, gp.result, gr.winner, gr.ended_at as endedAt
         FROM game_participants gp JOIN game_records gr ON gr.id=gp.game_id
         WHERE gp.nickname=? AND gp.is_ai=1 AND gp.role NOT IN ('观战','') AND COALESCE(gr.status,'completed')='completed'
         ORDER BY gr.ended_at DESC LIMIT ? OFFSET ?`
      ).all(name, limit, offset);
      res.json({ games, total, page, limit });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── AI Data ──────────────────────────────────────────────────────
  app.get('/api/admin/ai/speeches', requireAdmin, (req, res) => {
    try {
      let where = 'WHERE 1=1';
      const params = [];
      if (req.query.faction) { where += ' AND faction=?'; params.push(req.query.faction); }
      if (req.query.intent) { where += ' AND intent=?'; params.push(req.query.intent); }
      const rows = aiDb.prepare(`SELECT * FROM good_speeches ${where} ORDER BY id DESC LIMIT 50`).all(...params);
      res.json({ speeches: rows });
    } catch (e) { res.json({ speeches: [], error: e.message }); }
  });

  app.get('/api/admin/ai/strategies', requireAdmin, (req, res) => {
    try {
      let where = 'WHERE 1=1';
      const params = [];
      if (req.query.faction) { where += ' AND faction=?'; params.push(req.query.faction); }
      if (req.query.role) { where += ' AND role=?'; params.push(req.query.role); }
      const rows = aiDb.prepare(`SELECT * FROM strategy_patterns ${where} ORDER BY id DESC LIMIT 50`).all(...params);
      res.json({ strategies: rows });
    } catch (e) { res.json({ strategies: [], error: e.message }); }
  });

  app.get('/api/admin/ai/profiles', requireAdmin, (req, res) => {
    try {
      const rows = aiDb.prepare('SELECT * FROM human_profiles ORDER BY id DESC LIMIT 100').all();
      res.json({ profiles: rows });
    } catch (e) { res.json({ profiles: [], error: e.message }); }
  });

  app.get('/api/admin/ai/characters', requireAdmin, (req, res) => {
    const { MEDAL_DEFS } = require('./medals');
    const chars = Object.entries(AI_CHARACTERS || {}).map(([name, c]) => ({ name, ...c }));
    // Stats from game_participants (users.sqlite)
    const aiStats = {};
    try {
      const rows = userDb.prepare(
        "SELECT nickname, COUNT(*) as games, SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins FROM game_participants WHERE is_ai=1 AND role NOT IN ('观战','') AND game_id IN (SELECT id FROM game_records WHERE COALESCE(status,'completed')='completed') GROUP BY nickname"
      ).all();
      rows.forEach(r => { aiStats[r.nickname] = { games: r.games, wins: Number(r.wins || 0) }; });
    } catch (_) {}
    // Role breakdown per AI
    const aiRoles = {};
    try {
      const rows = userDb.prepare(
        "SELECT nickname, role, COUNT(*) as total, SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins FROM game_participants WHERE is_ai=1 AND role NOT IN ('观战','') AND game_id IN (SELECT id FROM game_records WHERE COALESCE(status,'completed')='completed') GROUP BY nickname, role ORDER BY nickname, total DESC"
      ).all();
      rows.forEach(r => {
        if (!aiRoles[r.nickname]) aiRoles[r.nickname] = [];
        aiRoles[r.nickname].push({ role: r.role, total: r.total, wins: Number(r.wins || 0) });
      });
    } catch (_) {}
    // Medals per AI
    const aiMedals = {};
    try {
      const rows = userDb.prepare(
        "SELECT gp.nickname, pm.medal_code as code, COUNT(*) as total FROM participant_medals pm JOIN game_participants gp ON gp.game_id=pm.game_id AND gp.client_id=pm.client_id WHERE gp.is_ai=1 GROUP BY gp.nickname, pm.medal_code ORDER BY gp.nickname, total DESC"
      ).all();
      rows.forEach(r => {
        if (!aiMedals[r.nickname]) aiMedals[r.nickname] = [];
        const def = MEDAL_DEFS[r.code];
        aiMedals[r.nickname].push({ code: r.code, name: def ? def.name : r.code, faction: def ? def.faction : '', description: def ? def.description : '', total: r.total });
      });
    } catch (_) {}
    // Memory from ai.sqlite
    const aiMemory = {};
    try {
      const rows = aiDb.prepare("SELECT id, ai_name, summary, created_at FROM ai_memory WHERE ai_name != '__meta__' ORDER BY ai_name, id DESC").all();
      rows.forEach(r => {
        if (!aiMemory[r.ai_name]) aiMemory[r.ai_name] = [];
        aiMemory[r.ai_name].push({ id: r.id, value: r.summary, created_at: r.created_at });
      });
    } catch (_) {}
    res.json({ characters: chars.map(c => ({
      ...c,
      stats: aiStats[c.name] || { games: 0, wins: 0 },
      byRole: aiRoles[c.name] || [],
      medals: aiMedals[c.name] || [],
      memory: aiMemory[c.name] || [],
    })) });
  });

  app.post('/api/admin/ai/characters/:name', requireAdmin, (req, res) => {
    try {
      const { name } = req.params;
      const updates = req.body || {};
      const cfg = loadConfig();
      if (!cfg.aiCharacterOverrides) cfg.aiCharacterOverrides = {};
      cfg.aiCharacterOverrides[name] = { ...(cfg.aiCharacterOverrides[name] || {}), ...updates };
      saveConfig(cfg);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/ai/evolution-log', requireAdmin, (req, res) => {
    try {
      const rows = aiDb.prepare('SELECT * FROM evolution_log ORDER BY id DESC LIMIT 20').all();
      res.json({ logs: rows });
    } catch (e) { res.json({ logs: [], error: e.message }); }
  });

  app.get('/api/admin/ai/memory', requireAdmin, (req, res) => {
    try {
      const rows = aiDb.prepare('SELECT * FROM ai_memory ORDER BY id DESC').all();
      res.json({ memories: rows });
    } catch (e) { res.json({ memories: [], error: e.message }); }
  });

  // ── Config ───────────────────────────────────────────────────────
  app.get('/api/admin/config', requireAdmin, (req, res) => {
    const cfg = loadConfig();
    cfg.reviewMode = getRuntimeReviewMode();
    cfg.defaultRoleConfig = getDefaultRoleConfig();
    // Merge saved role config overrides
    if (cfg.roleConfigOverrides) {
      for (const [k, v] of Object.entries(cfg.roleConfigOverrides)) {
        cfg.defaultRoleConfig[k] = v;
      }
    }
    res.json(cfg);
  });

  app.post('/api/admin/config', requireAdmin, (req, res) => {
    try {
      const updates = req.body || {};
      if (updates.reviewMode !== undefined) {
        setRuntimeReviewMode(!!updates.reviewMode);
        delete updates.reviewMode;
      }
      const cfg = loadConfig();
      Object.assign(cfg, updates);
      saveConfig(cfg);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/admin/config/roles', requireAdmin, (req, res) => {
    try {
      const { playerCount, roles } = req.body || {};
      if (!playerCount || !Array.isArray(roles)) return res.status(400).json({ error: 'need playerCount and roles array' });
      const cfg = loadConfig();
      if (!cfg.roleConfigOverrides) cfg.roleConfigOverrides = {};
      cfg.roleConfigOverrides[String(playerCount)] = roles;
      saveConfig(cfg);
      const drc = getDefaultRoleConfig();
      drc[String(playerCount)] = roles;
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/admin/config/presets', requireAdmin, (req, res) => {
    const cfg = loadConfig();
    // Hardcoded defaults (same as miniprogram ROLE_PRESETS)
    const defaults = {
      5: [
        { name: '经典版', roles: ['梅林','派西维尔','莫甘娜','刺客','忠臣'], oberonVisibleEnabled: true },
      ],
      6: [
        { name: '经典版', roles: ['梅林','派西维尔','莫甘娜','刺客','忠臣','忠臣'], oberonVisibleEnabled: true },
      ],
      7: [
        { name: '经典版', roles: ['梅林','派西维尔','忠臣','忠臣','莫甘娜','刺客','爪牙'], oberonVisibleEnabled: true },
        { name: '孤狼版', roles: ['梅林','派西维尔','忠臣','忠臣','莫甘娜','莫德雷德','奥伯伦'], oberonVisibleEnabled: false },
      ],
      8: [
        { name: '经典版', roles: ['梅林','派西维尔','忠臣','忠臣','忠臣','莫甘娜','刺客','爪牙'], oberonVisibleEnabled: true },
        { name: '竞技版', roles: ['梅林','派西维尔','忠臣','忠臣','忠臣','莫甘娜','莫德雷德','刺客'], oberonVisibleEnabled: true },
        { name: '孤狼版', roles: ['梅林','派西维尔','忠臣','忠臣','忠臣','莫甘娜','莫德雷德','奥伯伦'], oberonVisibleEnabled: false },
      ],
      9: [
        { name: '经典版', roles: ['梅林','派西维尔','忠臣','忠臣','忠臣','忠臣','莫甘娜','莫德雷德','刺客'], oberonVisibleEnabled: true },
        { name: '孤狼版', roles: ['梅林','派西维尔','忠臣','忠臣','忠臣','忠臣','莫甘娜','莫德雷德','奥伯伦'], oberonVisibleEnabled: false },
      ],
      10: [
        { name: '经典版', roles: ['梅林','派西维尔','忠臣','忠臣','忠臣','忠臣','莫甘娜','莫德雷德','奥伯伦','刺客'], oberonVisibleEnabled: true },
        { name: '孤狼版', roles: ['梅林','派西维尔','忠臣','忠臣','忠臣','忠臣','莫甘娜','莫德雷德','奥伯伦','刺客'], oberonVisibleEnabled: false },
      ],
    };
    // Merge overrides
    const presets = cfg.rolePresets || {};
    const merged = {};
    for (const n of ['5','6','7','8','9','10']) {
      merged[n] = presets[n] || defaults[n] || [];
    }
    res.json({ presets: merged });
  });

  app.post('/api/admin/config/presets', requireAdmin, (req, res) => {
    try {
      const { playerCount, presets } = req.body || {};
      if (!playerCount || !Array.isArray(presets)) return res.status(400).json({ error: 'need playerCount and presets array' });
      const cfg = loadConfig();
      if (!cfg.rolePresets) cfg.rolePresets = {};
      cfg.rolePresets[String(playerCount)] = presets;
      saveConfig(cfg);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Super Players ────────────────────────────────────────────────
  app.get('/api/admin/config/super-players', requireAdmin, (req, res) => {
    const cfg = loadConfig();
    res.json({ superPlayers: cfg.superPlayers || [] });
  });

  app.post('/api/admin/config/super-players', requireAdmin, (req, res) => {
    try {
      const cfg = loadConfig();
      cfg.superPlayers = Array.isArray(req.body.superPlayers) ? req.body.superPlayers : [];
      saveConfig(cfg);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Stats Config ─────────────────────────────────────────────────
  app.get('/api/admin/config/stats', requireAdmin, (req, res) => {
    const { DEFAULTS } = require('./stats-config');
    const cfg = loadConfig();
    const result = {};
    for (const key of Object.keys(DEFAULTS)) {
      result[key] = cfg[key] !== undefined ? cfg[key] : DEFAULTS[key];
    }
    res.json(result);
  });

  app.post('/api/admin/config/stats', requireAdmin, (req, res) => {
    try {
      const { DEFAULTS } = require('./stats-config');
      const cfg = loadConfig();
      const body = req.body || {};
      for (const key of Object.keys(DEFAULTS)) {
        if (body[key] !== undefined) cfg[key] = Number(body[key]);
      }
      saveConfig(cfg);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Assets ───────────────────────────────────────────────────────
  app.get('/api/admin/assets', requireAdmin, (req, res) => {
    const assetsRoot = path.join(__dirname, '..', 'public', 'mp-assets');
    const fsStat = require('fs');
    try {
      const categories = [];
      const entries = fsStat.readdirSync(assetsRoot, { withFileTypes: true });
      entries.forEach(e => {
        if (e.isDirectory()) {
          const dirPath = path.join(assetsRoot, e.name);
          const files = [];
          try {
            fsStat.readdirSync(dirPath, { withFileTypes: true }).forEach(f => {
              if (f.isFile()) {
                const fPath = path.join(dirPath, f.name);
                const stat = fsStat.statSync(fPath);
                files.push({ name: f.name, size: stat.size, url: `/mp-assets/${e.name}/${f.name}` });
              }
            });
          } catch (_) {}
          const totalSize = files.reduce((s, f) => s + f.size, 0);
          categories.push({ name: e.name, files, count: files.length, totalSize });
        } else if (e.isFile()) {
          const fPath = path.join(assetsRoot, e.name);
          const stat = fsStat.statSync(fPath);
          if (!categories.find(c => c.name === '_root')) categories.push({ name: '_root', files: [], count: 0, totalSize: 0 });
          const root = categories.find(c => c.name === '_root');
          root.files.push({ name: e.name, size: stat.size, url: `/mp-assets/${e.name}` });
          root.count++;
          root.totalSize += stat.size;
        }
      });
      categories.sort((a, b) => b.totalSize - a.totalSize);
      res.json({ categories });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Skins ────────────────────────────────────────────────────────
  app.get('/api/admin/skins', requireAdmin, (req, res) => {
    const cfg = loadConfig();
    const skinStatus = cfg.skinStatus || {};
    const skins = (SKIN_CATALOGUE || []).map(s => ({
      ...s,
      status: skinStatus[s.id] || s.status,
    }));
    res.json({ skins });
  });

  app.post('/api/admin/skins/:id/status', requireAdmin, (req, res) => {
    try {
      const { status } = req.body || {};
      if (status !== 'published' && status !== 'draft') return res.status(400).json({ error: 'invalid status' });
      const cfg = loadConfig();
      if (!cfg.skinStatus) cfg.skinStatus = {};
      cfg.skinStatus[req.params.id] = status;
      saveConfig(cfg);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

module.exports = { adminRoutes };
