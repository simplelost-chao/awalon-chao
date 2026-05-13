# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page admin dashboard (admin.html) with 6 modules: Dashboard, Games, Players, AI, Config, Skins.

**Architecture:** Single HTML file served at `/admin?key=ADMIN_KEY`. New REST APIs in `server/index.js` under `/api/admin/*`. Config persisted to `server/admin-config.json`. Existing `ai-dashboard.html` deprecated.

**Tech Stack:** Plain HTML/CSS/JS, SQLite queries via better-sqlite3, Express REST APIs.

---

### Task 1: Admin API — Dashboard Stats, Games, Players

**Files:**
- Create: `server/admin-api.js`
- Modify: `server/index.js` (import + mount routes)

- [ ] **Step 1: Create `server/admin-api.js` with all admin API routes**

```javascript
const { userDb, aiDb } = require('./db');

function adminRoutes(app, { ADMIN_KEY, getRooms, getRuntimeReviewMode, setRuntimeReviewMode }) {

  function requireAdmin(req, res, next) {
    if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).json({ error: 'forbidden' });
    next();
  }

  // ── Dashboard Stats ──
  app.get('/api/admin/dashboard-stats', requireAdmin, (req, res) => {
    try {
      const totalGames = userDb.prepare('SELECT COUNT(*) as c FROM game_records WHERE COALESCE(status,"completed")="completed"').get().c;
      const totalPlayers = userDb.prepare('SELECT COUNT(*) as c FROM users').get().c;
      const wins = userDb.prepare('SELECT winner, COUNT(*) as c FROM game_records WHERE COALESCE(status,"completed")="completed" AND winner IN ("good","evil") GROUP BY winner').all();
      const winMap = {};
      wins.forEach(r => { winMap[r.winner] = r.c; });
      const total = (winMap.good || 0) + (winMap.evil || 0);
      const recentGames = userDb.prepare(
        'SELECT id, room_code as roomCode, max_players as maxPlayers, winner, ended_at as endedAt, status FROM game_records ORDER BY id DESC LIMIT 10'
      ).all();
      res.json({
        totalGames,
        totalPlayers,
        activeRooms: getRooms().size,
        goodWinRate: total > 0 ? Number(((winMap.good || 0) * 100 / total).toFixed(1)) : 0,
        evilWinRate: total > 0 ? Number(((winMap.evil || 0) * 100 / total).toFixed(1)) : 0,
        recentGames,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Games List ──
  app.get('/api/admin/games', requireAdmin, (req, res) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const offset = (page - 1) * limit;
      let where = 'WHERE 1=1';
      const params = [];
      if (req.query.status) { where += ' AND COALESCE(status,"completed")=?'; params.push(req.query.status); }
      if (req.query.winner) { where += ' AND winner=?'; params.push(req.query.winner); }
      const total = userDb.prepare(`SELECT COUNT(*) as c FROM game_records ${where}`).get(...params).c;
      const rows = userDb.prepare(
        `SELECT id, room_code as roomCode, max_players as maxPlayers, winner, ended_at as endedAt, started_at as startedAt, status
         FROM game_records ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
      ).all(...params, limit, offset);
      // Attach player count per game
      const games = rows.map(r => {
        const pc = userDb.prepare('SELECT COUNT(*) as c FROM game_participants WHERE game_id=? AND COALESCE(role,"")!="观战"').get(r.id);
        return { ...r, playerCount: pc.c };
      });
      res.json({ games, total, page, limit });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Game Detail ──
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
        'SELECT phone, medal_code as code, medal_name as name FROM participant_medals WHERE game_id=?'
      ).all(row.id);
      res.json({ game: { id: row.id, roomCode: row.room_code, winner: row.winner, status: row.status, startedAt: row.started_at, endedAt: row.ended_at }, participants, medals, payload });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Players List ──
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
        const stats = userDb.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN result="win" THEN 1 ELSE 0 END) as wins FROM game_participants WHERE phone=? AND role!="观战" AND game_id IN (SELECT id FROM game_records WHERE COALESCE(status,"completed")="completed")').get(u.phone);
        const medalCount = userDb.prepare('SELECT COUNT(*) as c FROM participant_medals WHERE phone=?').get(u.phone).c;
        const t = Number(stats.total || 0);
        const w = Number(stats.wins || 0);
        return {
          phone: u.phone ? u.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '',
          phoneRaw: u.phone,
          nickname: u.nickname,
          avatar: u.avatar,
          totalGames: t,
          winRate: t > 0 ? Number((w * 100 / t).toFixed(1)) : 0,
          medalCount,
          createdAt: u.createdAt,
        };
      });
      res.json({ players, total, page, limit });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── Player Detail ──
  app.get('/api/admin/players/:phone', requireAdmin, (req, res) => {
    try {
      const phone = req.params.phone;
      const user = userDb.prepare('SELECT phone, nickname, avatar, created_at as createdAt FROM users WHERE phone=?').get(phone);
      if (!user) return res.status(404).json({ error: 'not found' });
      const byRole = userDb.prepare(
        `SELECT role, COUNT(*) as total, SUM(CASE WHEN result='win' THEN 1 ELSE 0 END) as wins
         FROM game_participants WHERE phone=? AND role!='观战' AND game_id IN (SELECT id FROM game_records WHERE COALESCE(status,'completed')='completed')
         GROUP BY role ORDER BY total DESC`
      ).all(phone);
      const medals = userDb.prepare(
        `SELECT medal_code as code, COUNT(*) as total FROM participant_medals WHERE phone=? GROUP BY medal_code ORDER BY total DESC`
      ).all(phone);
      const recentGames = userDb.prepare(
        `SELECT gp.game_id as gameId, gr.room_code as roomCode, gp.role, gp.result, gr.winner, gr.ended_at as endedAt
         FROM game_participants gp JOIN game_records gr ON gr.id=gp.game_id
         WHERE gp.phone=? AND COALESCE(gr.status,'completed')='completed'
         ORDER BY gr.ended_at DESC LIMIT 10`
      ).all(phone);
      res.json({ user, byRole, medals, recentGames });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ── AI Data ──
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

  // ── Config ──
  const fs = require('fs');
  const path = require('path');
  const CONFIG_PATH = path.join(__dirname, 'admin-config.json');

  function loadConfig() {
    try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (_) { return {}; }
  }
  function saveConfig(cfg) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  }

  app.get('/api/admin/config', requireAdmin, (req, res) => {
    const cfg = loadConfig();
    cfg.reviewMode = getRuntimeReviewMode();
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

  // ── Skins ──
  app.get('/api/admin/skins', requireAdmin, (req, res) => {
    const cfg = loadConfig();
    const skinStatus = cfg.skinStatus || {};
    const { SKIN_CATALOGUE } = require('./index');
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
```

- [ ] **Step 2: Mount admin routes in `server/index.js`**

Add after existing admin routes (around line 360). Import and call:

```javascript
// Near top imports:
const { adminRoutes } = require('./admin-api');

// After app setup, before server.listen:
adminRoutes(app, {
  ADMIN_KEY,
  getRooms: () => _rooms,
  getRuntimeReviewMode: () => runtimeReviewMode,
  setRuntimeReviewMode: (v) => { runtimeReviewMode = v; },
});
```

Also export `SKIN_CATALOGUE` from index.js:

```javascript
module.exports = { SKIN_CATALOGUE };
```

- [ ] **Step 3: Create initial `server/admin-config.json`**

```json
{}
```

- [ ] **Step 4: Deploy and verify APIs work**

```bash
scp server/admin-api.js server/admin-config.json awalon:/opt/avalon-online/server/
scp server/index.js awalon:/opt/avalon-online/server/
ssh awalon "pm2 restart avalon-server"
# Test:
curl "https://www.awalon.top/api/admin/dashboard-stats?key=YOUR_KEY"
```

- [ ] **Step 5: Commit**

```bash
git add server/admin-api.js server/admin-config.json server/index.js
git commit -m "feat(admin): add admin REST APIs for dashboard, games, players, AI, config, skins"
```

---

### Task 2: Admin Dashboard HTML — Layout & Dashboard Module

**Files:**
- Create: `server/admin.html`

- [ ] **Step 1: Create `server/admin.html` with full dashboard**

This is a large single-file HTML with all 6 modules. The file structure:

```
<html>
  <style>  — all CSS (sidebar, panels, tables, forms)
  <body>
    <div id="login">     — password input
    <div id="app">       — sidebar + content area
      <div id="mod-dashboard">
      <div id="mod-games">
      <div id="mod-players">
      <div id="mod-ai">
      <div id="mod-config">
      <div id="mod-skins">
  <script> — API calls, tab switching, rendering
```

Write the complete file (this will be large, ~800-1000 lines). Key sections:

**CSS:** Dark theme with `#0a0c14` background, `#d8b06b` accent, panel cards with gold borders, tables with alternating rows.

**Sidebar:** Fixed left, 200px, module list with icons (emoji), active state highlight.

**Dashboard module:** Stats grid (4 cards), recent games table.

**Games module:** Filter bar (status/winner dropdowns), paginated table, expandable detail rows showing participants, vote history, mission history from payload.

**Players module:** Search bar, paginated table, expandable detail showing role stats and recent games.

**AI module:** Sub-tabs (Overview/Speeches/Strategies/Profiles/Evolution/Memory), data tables with filters.

**Config module:** Toggle switches, JSON editor textarea, save button.

**Skins module:** Grid of skin cards with color preview and publish/draft toggle.

- [ ] **Step 2: Update `/admin` route in `server/index.js` to serve the HTML file**

Replace the inline HTML at line 316 with:

```javascript
app.get('/admin', (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.status(403).send('forbidden');
  res.sendFile(require('path').join(__dirname, 'admin.html'));
});
```

Remove the old `/admin/ai` route that serves `ai-dashboard.html` (merged into new admin.html).

- [ ] **Step 3: Deploy and test**

```bash
scp server/admin.html server/index.js awalon:/opt/avalon-online/server/
ssh awalon "pm2 restart avalon-server"
```

Visit `https://www.awalon.top/admin?key=YOUR_KEY`

- [ ] **Step 4: Commit**

```bash
git add server/admin.html server/index.js
git commit -m "feat(admin): add full admin dashboard with 6 modules"
```

---

### Task 3: Testing & Polish

**Files:**
- Modify: `server/admin.html` (fixes from testing)
- Modify: `server/admin-api.js` (fixes from testing)

- [ ] **Step 1: Test each module end-to-end**

Manually verify in browser:
1. Dashboard — stats load, recent games show
2. Games — pagination works, detail expands with vote/mission/speak data
3. Players — search works, detail shows role breakdown
4. AI — all sub-tabs load data from ai.sqlite
5. Config — review mode toggle works, config saves
6. Skins — list shows, status toggle persists

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Final deploy**

```bash
scp server/admin.html server/admin-api.js server/index.js awalon:/opt/avalon-online/server/
ssh awalon "pm2 restart avalon-server"
```

- [ ] **Step 4: Commit**

```bash
git add server/
git commit -m "fix(admin): polish admin dashboard after testing"
```
