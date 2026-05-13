const path = require('path');
const Database = require('better-sqlite3');

const API_KEY = process.env.AI_API_KEY || process.env.QWEN_API_KEY || '';
const MODEL = process.env.AI_MODEL || 'deepseek-chat';
const BASE_URL = process.env.AI_BASE_URL || 'https://api.deepseek.com/v1';

const db = new Database(path.join(__dirname, 'ai.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS game_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT,
    winner TEXT,
    summary TEXT,
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS ai_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ai_name TEXT,
    summary TEXT,
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS good_speeches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    faction TEXT,
    role TEXT,
    intent TEXT,
    text TEXT,
    score INTEGER,
    context TEXT,
    situation_type TEXT,
    player_count INTEGER DEFAULT 0,
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS strategy_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    faction TEXT NOT NULL,
    situation_type TEXT NOT NULL,
    player_count INTEGER DEFAULT 0,
    pattern TEXT NOT NULL,
    outcome TEXT NOT NULL,
    confidence INTEGER DEFAULT 1,
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS human_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_hash TEXT UNIQUE NOT NULL,
    nickname TEXT,
    vote_follow_rate REAL DEFAULT 0.5,
    vote_flip_rate REAL DEFAULT 0.1,
    logic_responsive INTEGER DEFAULT 1,
    emotion_responsive INTEGER DEFAULT 1,
    games_observed INTEGER DEFAULT 0,
    notes TEXT,
    updated_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS evolution_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_games INTEGER,
    good_wins INTEGER,
    evil_wins INTEGER,
    meta_lesson TEXT,
    created_at INTEGER
  );
`);
// 字段迁移（兼容旧表结构）
try { db.exec('ALTER TABLE good_speeches ADD COLUMN situation_type TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE good_speeches ADD COLUMN player_count INTEGER DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE good_speeches ADD COLUMN persona_name TEXT'); } catch (e) {}

// ── 冷启动种子发言（首次运行自动植入，后续跳过）────────────────────────────
(function seedGoodSpeeches() {
  try {
    const cnt = db.prepare("SELECT COUNT(*) as c FROM good_speeches WHERE context='seed'").get().c;
    if (cnt > 0) return;
    const SEEDS = [
      // ── 好人阵营 ──────────────────────────────────────────────────────────
      { faction:'good', role:'忠臣', intent:'accusation',
        text:'3号和5号都在那轮任务里，现在5号急着把矛头指向3号——急着甩锅这件事本身就值得关注。我不是说3号没问题，但至少先把这个矛盾说清楚。',
        score:4, context:'seed', situation_type:'first_failure' },
      { faction:'good', role:'梅林', intent:'neutral',
        text:'第一轮没有记录，我不做无凭据的判断。我只关注一点：没有信息时谁表现得特别自信——那种自信往往有依据，只是依据不在明面上。',
        score:5, context:'seed', situation_type:'early_game' },
      { faction:'good', role:'忠臣', intent:'defense',
        text:'那轮任务失败我也很意外。但跟我一起上车的还有两个人，为什么只盯着我？如果要排查，三个人都应该看，单独锁我没有说服力。',
        score:4, context:'seed', situation_type:'under_suspicion' },
      { faction:'good', role:'忠臣', intent:'probe',
        text:'你第1轮投了反对，说是不信任队伍，但这轮你自己推了一个跟上轮差不多的人选——你的标准是什么？能解释一下吗？',
        score:5, context:'seed', situation_type:'info_available' },
      { faction:'good', role:'派西维尔', intent:'support',
        text:'刚才那个方向我认同。那个座位第1轮的发言一直在给争议人选站台，却一直没有明确表态——这种模糊态度结合任务失败，值得重点关注。',
        score:4, context:'seed', situation_type:'first_failure' },
      { faction:'good', role:'忠臣', intent:'accusation',
        text:'我注意到投票记录里有个规律：每次包含那个人的队伍通过了，任务就出了问题，没他的队伍反而安全——这不是巧合，这是数据。',
        score:5, context:'seed', situation_type:'info_available' },
      { faction:'good', role:'梅林', intent:'redirect',
        text:'现在大家都在盯着一两个人，但我觉得遗漏了一个角度：谁在投票里一直给可疑队伍保驾护航？这比谁上了失败的任务更能说明问题。',
        score:4, context:'seed', situation_type:'consecutive_fails' },
      // ── 坏人阵营 ──────────────────────────────────────────────────────────
      { faction:'evil', role:'莫甘娜', intent:'claim',
        text:'大家想清楚，真正有问题的人不需要反复解释。我只说一遍：我的立场一直是一致的，投票记录在那里，翻记录就知道了。',
        score:5, context:'seed', situation_type:'under_suspicion' },
      { faction:'evil', role:'爪牙', intent:'redirect',
        text:'大家把焦点全放在那个人身上了，但我反而觉得一直跟着大多数票走的人更可疑——完全没有自己的判断，这种藏在人群里的打法才是真正危险的。',
        score:5, context:'seed', situation_type:'info_available' },
      { faction:'evil', role:'刺客', intent:'defense',
        text:'我上车那轮失败，但那轮还有两个人在队伍里。如果真的要排查，应该三个人一起看。而且我之前一直在反对可疑队伍——这是有记录的，不信可以翻。',
        score:4, context:'seed', situation_type:'under_suspicion' },
      { faction:'evil', role:'莫甘娜', intent:'neutral',
        text:'第一轮我打算先观察两件事：谁在推大家不太了解的人上车，以及谁在投票时犹豫特别明显。犹豫得越多往往越值得关注，先说出来让大家参考。',
        score:5, context:'seed', situation_type:'early_game' },
      { faction:'evil', role:'爪牙', intent:'accusation',
        text:'我觉得现在方向有点乱。先不说那个人，从头到现在一直没有明确立场、发言都在跟随大流的人——这种人反而比明显可疑的更难排查，更危险。',
        score:4, context:'seed', situation_type:'consecutive_fails' },
      { faction:'evil', role:'莫甘娜', intent:'redirect',
        text:'逻辑上讲，现在大家的推断有一个前提错误：任务失败不代表队里的所有人都有问题。我们应该先把票数对上，再来讨论谁可疑。',
        score:4, context:'seed', situation_type:'first_failure' },
      { faction:'evil', role:'刺客', intent:'claim',
        text:'我说实话：我一直在观察谁的发言是真正有依据的，而不是跟风。到目前为止，真正让我信服的判断很少，包括现在把我挂出来的那个人。',
        score:4, context:'seed', situation_type:'good_leading' },
    ];
    const ins = db.prepare(
      'INSERT INTO good_speeches(faction,role,intent,text,score,context,situation_type,created_at) VALUES(?,?,?,?,?,?,?,?)'
    );
    for (const s of SEEDS) ins.run(s.faction, s.role, s.intent, s.text, s.score, s.context, s.situation_type || '', Date.now());
    console.log(`[AI] 种子发言已植入，共${SEEDS.length}条`);
  } catch (e) { console.error('[AI] 种子发言植入失败:', e.message); }
})();

// ── 身份宣称/质疑种子发言（claim_identity / challenge_claim）────────────────
(function seedClaimSpeeches() {
  try {
    const cnt = db.prepare("SELECT COUNT(*) as c FROM good_speeches WHERE context='seed_claim'").get().c;
    if (cnt > 0) return;
    const CLAIM_SEEDS = [
      // 派西维尔 宣称身份（好人协调）
      { faction:'good', role:'派西维尔', intent:'claim_identity',
        text:'我说一下，我是派西维尔。我能看到拇指位，基于这个视野我一直在保护某个人的信用，但好像效果不大。现在局面僵了，与其继续兜圈子，不如我明牌——有人听了会懂的。',
        score:5, context:'seed_claim', situation_type:'consecutive_fails' },
      { faction:'good', role:'派西维尔', intent:'claim_identity',
        text:'说实话，我是派西维尔。这局拖到现在好人方向一直不统一，部分原因是大家不知道我的视野。我现在表明，是因为我认为这个时间点宣称比继续沉默对好人更有利。',
        score:5, context:'seed_claim', situation_type:'good_leading' },
      // 忠臣 宣称
      { faction:'good', role:'忠臣', intent:'claim_identity',
        text:'我直接说：我是忠臣，没有任何特殊视野。正因为如此我只能靠行为数据判断——投票记录里一个规律我说了好几次，但一直被绕开，我想知道为什么有人不愿意讨论这个。',
        score:4, context:'seed_claim', situation_type:'info_available' },
      // 莫甘娜 假扮派西维尔（坏人核心战术）
      { faction:'evil', role:'莫甘娜', intent:'claim_identity',
        text:'我是派西维尔。我的视野里有两个位置，我一直在保护其中一个——现在我说出来，是因为我觉得好人已经方向错了。你们反复推的那个人，我的视野不支持。',
        score:5, context:'seed_claim', situation_type:'info_available' },
      { faction:'evil', role:'莫甘娜', intent:'claim_identity',
        text:'行，我摊牌，我是派西维尔。我知道说了会有人质疑，但现在不说好人就要输了。我的视野告诉我某个人是可信的，但你们一直在排那个人——这就是我说话的原因。',
        score:5, context:'seed_claim', situation_type:'consecutive_fails' },
      // 坏人 宣称忠臣洗白
      { faction:'evil', role:'刺客', intent:'claim_identity',
        text:'我说清楚：我是忠臣，没有视野，靠推理。我的推理逻辑一直在，投票记录在那里，谁在保护失败的队伍一看便知。我不需要复杂的理由，数据比解释更有说服力。',
        score:4, context:'seed_claim', situation_type:'under_suspicion' },
      // 派西维尔 质疑假冒者
      { faction:'good', role:'派西维尔', intent:'challenge_claim',
        text:'等一下，你说你是派西维尔——但我也是派西维尔。我们两个有一个在撒谎。你说你的视野指向谁，我来对一下：如果你说的那个人跟我的认知对不上，那大家就知道谁在说谎了。',
        score:5, context:'seed_claim', situation_type:'info_available' },
      // 忠臣 质疑可疑的宣称
      { faction:'good', role:'忠臣', intent:'challenge_claim',
        text:'你刚才说你是忠臣，但第1轮你推了一个所有人都质疑的组合，任务失败之后你还在给那个人站台——真正的忠臣会在有了数据之后调整，你没有。我想听你解释一下这个。',
        score:5, context:'seed_claim', situation_type:'first_failure' },
      // 梅林 面对两人同时宣称派西维尔的局面（间接引导）
      { faction:'good', role:'梅林', intent:'challenge_claim',
        text:'有意思，现在场上有两个人说自己是派西维尔。其中一个在撒谎，这不用我说。问题是：撒谎的那个人一定不是第一次撒谎——把他之前的发言和行为对比一下，矛盾会自己浮出来。',
        score:5, context:'seed_claim', situation_type:'info_available' },
      // 坏人队友 配合 莫甘娜 的假宣称
      { faction:'evil', role:'爪牙', intent:'support',
        text:'我信刚才那个人说的，他是派西维尔我一直有这个感觉。他的发言模式和一个有视野的人是一致的——太刻意否认视野的那种，反而让我更觉得另一个人在做戏。',
        score:4, context:'seed_claim', situation_type:'info_available' },
    ];
    const ins = db.prepare(
      'INSERT INTO good_speeches(faction,role,intent,text,score,context,situation_type,created_at) VALUES(?,?,?,?,?,?,?,?)'
    );
    for (const s of CLAIM_SEEDS) ins.run(s.faction, s.role, s.intent, s.text, s.score, s.context, s.situation_type || '', Date.now());
    console.log(`[AI] 身份宣称种子发言已植入，共${CLAIM_SEEDS.length}条`);
  } catch (e) { console.error('[AI] 身份宣称种子植入失败:', e.message); }
})();

function buildPersonaDesc(player) {
  const key = player && player.aiPersonaKey;
  const personas = {
    '莫甘娜的微笑': {
      speakTone: '逻辑严密，从不直接表态，善用反问，让别人替自己下结论',
      voteHabits: '跟随主流，偶尔在关键局意外倒戈',
      bluffHint: '坏人时构造无懈可击的洗白逻辑，扮演最理性的好人',
      catchphrase: '逻辑上讲……|大家可以想想。|我只是觉得，合理的人不需要解释。',
    },
    '梅林看穿你了': {
      speakTone: '含沙射影，"某些人心里应该很清楚"，从不明点名但暗示强烈',
      voteHabits: '基于信息优势独立判断，不轻易跟风',
      bluffHint: '坏人时模仿梅林风格，用暗示把锅甩给无辜者',
      catchphrase: '某些人心里应该很清楚。|我不说，但懂的人懂。|有些事不用我点破吧。',
    },
    '奥伯龙没朋友': {
      speakTone: '极简发言，一两句点到即止，从不给完整理由，制造神秘感',
      voteHabits: '完全独立，无论多大压力绝不跟风',
      bluffHint: '坏人时用沉默迷惑对手，关键票意外翻局',
      catchphrase: '我有自己的判断。|不必解释。|结果会说明一切。',
    },
    '我知道你知道': {
      speakTone: '盯特定玩家制造心理压力，暗示自己掌握内部信息',
      voteHabits: '通过投票发信号，在关键轮次传递元信息',
      bluffHint: '坏人时假装掌握核心情报，把真实信息搅混',
      catchphrase: '你知道我在看你。|我们之间心知肚明。|信息战，开始了。',
    },
    '背刺有理': {
      speakTone: '前期低调表忠心，后期突然翻脸攻击昔日盟友，理由冠冕堂皇',
      voteHabits: '前期顺势通过，后期在关键局突然否决翻盘',
      bluffHint: '坏人时等好人建立互信后精准背刺，配合队友翻局',
      catchphrase: '不好意思了。|到这里我必须说实话了。|对不起，但逻辑不允许我护着你。',
    },
    '沉默即答案': {
      speakTone: '只说一句话甚至一个词，在沉默里制造压迫感，让对方自行脑补',
      voteHabits: '投票就是表态，不需要语言辅助',
      bluffHint: '坏人时用极简发言降低暴露风险，神秘感天然洗白',
      catchphrase: '懂的自然懂。|我选择沉默。|.',
    },
    '任务失败不是我': {
      speakTone: '任务一失败立刻抢话，条理清晰地把锅推给别人，声音最响理由最多',
      voteHabits: '倾向通过以显得积极，失败后立刻转向甩锅',
      bluffHint: '坏人时第一个开始洗白，抢占话语权，主动指控无辜玩家',
      catchphrase: '肯定是某人的问题。|我早就说了不该带他。|反正不是我，证据我都列出来了。',
    },
    '帕西法尔的直觉': {
      speakTone: '大量"我感觉""直觉上""说不出来但就觉得有问题"，充满情绪感染力',
      voteHabits: '跟随直觉，容易被最后发言的人影响',
      bluffHint: '坏人时用情绪感染力带跑好人判断，把怀疑引向无辜者',
      catchphrase: '我感觉……就是感觉啦。|直觉告诉我。|说不清楚，但就是有种感觉。',
    },
    '三号位可疑': {
      speakTone: '锁定目标后每轮必提，专注执着不轻易松口，旁人劝也没用',
      voteHabits: '拒绝包含目标玩家的队伍，即使全场只有自己否决',
      bluffHint: '坏人时把执着怀疑引向无辜好人，用专注洗白自己',
      catchphrase: '某号一直很奇怪。|我锁定了。|不管你们怎么想，我就认准这个人。',
    },
    '不解释': {
      speakTone: '别人质疑一律不辩护，只说"随便"或"爱信不信"，制造神秘压迫感',
      voteHabits: '想法坚定，不受任何舆论影响，投票前不打招呼',
      bluffHint: '坏人时用强硬沉默代替解释，让对方自行揣测放松警惕',
      catchphrase: '随便。|爱信不信。|我不解释，结果会说话。',
    },
  };
  const p = personas[key] || { speakTone: '理性分析', voteHabits: '综合判断', bluffHint: '灵活应对', catchphrase: '' };
  const catchphraseHint = p.catchphrase ? `\n口头禅参考（可变形使用）：${p.catchphrase}` : '';
  return `发言风格：${p.speakTone}。投票习惯：${p.voteHabits}。坏人策略倾向：${p.bluffHint}。${catchphraseHint}`;
}

function recordGameSummary(room, winner, { skipJournals = false, roleFactions = {} } = {}) {
  try {
    const summary = buildSummary(room, winner);
    const stmt = db.prepare('INSERT INTO game_logs(room_code, winner, summary, created_at) VALUES(?,?,?,?)');
    stmt.run(room.code, winner || 'unknown', summary, Date.now());
    // 只保留最近200条游戏日志
    db.prepare('DELETE FROM game_logs WHERE id NOT IN (SELECT id FROM game_logs ORDER BY id DESC LIMIT 200)').run();
  } catch (e) {}

  // ── 进化系统触发（异步，不阻塞游戏流程）──────────────────────────────────
  // Layer 1: 策略置信度反馈
  updateStrategyConfidence(winner, roleFactions);
  // Layer 3: 人类玩家行为建模
  updateHumanProfiles(room, roleFactions);
  // Layer 2: 元学习分析（每10局自动触发）
  maybeRunMetaAnalysis().catch(() => {});

  if (!skipJournals) {
    // 异步生成行为日记（火了就忘）
    generateAiJournals(room, winner).catch(() => {});
  }
}

// ── AI 行为日记：每局结束后自动为每个 AI 生成可读的反思记录 ─────────────────────
async function generateAiJournals(room, winner) {
  if (!API_KEY) return;
  if (!room || !room.game || !room.game.assignments) return;
  const ROLE_FACTIONS_LOCAL = {
    '梅林': 'good', '派西维尔': 'good', '忠臣': 'good', '亚瑟的忠臣': 'good',
    '刺客': 'evil', '莫甘娜': 'evil', '莫德雷德': 'evil', '奥伯伦': 'evil', '爪牙': 'evil',
  };

  const aiPlayers = Array.from(room.players.values()).filter(p => p.isAI);
  if (!aiPlayers.length) return;

  // 并发生成，最多等 15 秒
  await Promise.allSettled(aiPlayers.map(p => generateOneJournal(room, p, winner, ROLE_FACTIONS_LOCAL)));
}

async function generateOneJournal(room, player, winner, roleFactions) {
  try {
    const aiId    = player.aiPersonaId || player.nickname;
    const role    = room.game.assignments[player.id] || '';
    const faction = roleFactions[role] || 'good';
    const won     = faction === winner;

    // 收集该 AI 的发言（最多取 3 条）
    const mySpeeches = [];
    for (const msgs of Object.values(room.game.speakHistory || {})) {
      for (const m of (msgs || [])) {
        if (m.playerId === player.id && m.text) mySpeeches.push(m.text);
      }
    }

    // 收集投票行为
    const myVotes = [];
    for (const v of (room.game.voteHistory || [])) {
      if (!v.votes || !Object.prototype.hasOwnProperty.call(v.votes, player.id)) continue;
      const approved = v.votes[player.id];
      myVotes.push(`第${v.round}轮投${approved ? '同意' : '反对'}→队伍${v.approved ? '通过' : '被否'}`);
    }

    // 收集任务行为
    const myMissions = [];
    for (const m of (room.game.missionHistory || [])) {
      if (!m.team || !m.team.includes(player.id)) continue;
      const mv = m.missionVotes || {};
      const myVote = Object.prototype.hasOwnProperty.call(mv, player.id)
        ? (mv[player.id] ? '投失败票' : '投成功票') : '（队员，无记录）';
      myMissions.push(`第${m.round}轮任务${m.success ? '成功' : '失败'}，${myVote}`);
    }

    const speechBlock = mySpeeches.slice(0, 3).map((t, i) => `  ${i+1}. "${t}"`).join('\n') || '  （本局未发言）';
    const voteBlock   = myVotes.join('；') || '无投票记录';
    const missionBlock = myMissions.join('；') || '未上任务';

    const system =
      '你是阿瓦隆桌游AI玩家的复盘助手。请基于这局对局数据，为该AI角色生成一条简洁、具体、可操作的行为日记。' +
      '日记应该像玩家赛后复盘笔记，重点放在：这局做了什么、效果如何、下局如何改进。';

    const user =
      `AI角色名：${player.nickname}\n` +
      `性格风格：${player.aiStyle || '理性分析'}\n` +
      `本局身份：${role}（${faction === 'good' ? '好人' : '坏人'}阵营）\n` +
      `最终结果：${winner === 'good' ? '好人' : '坏人'}阵营胜，我方${won ? '获胜 ✓' : '失败 ✗'}\n\n` +
      `【我的发言】\n${speechBlock}\n\n` +
      `【投票决策】${voteBlock}\n` +
      `【任务表现】${missionBlock}\n\n` +
      `请输出JSON（不含其他内容）：\n` +
      `{"lesson":"这局最关键的教训或成功经验（具体说是哪个发言/投票/决策有效或失效，不要泛泛而谈，50字以内）",` +
      `"adjustment":"下局作为${role}或类似角色，我具体应该改变什么行为（30字以内）",` +
      `"highlight":"本局最得意或最遗憾的一句话/一个决策（20字以内）",` +
      `"mood":"胜利|遗憾|挫败|满足|平静"}`;

    const res = await callLLM(system, user, 0.6);
    const cleaned = res.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const obj = parseJSON(cleaned, null);
    if (!obj || !obj.lesson) return;

    const tag = `[日记|${role}|${won ? '胜' : '败'}|${obj.mood || ''}]`;
    const entry = `${tag} 教训：${obj.lesson} 调整：${obj.adjustment} 亮点：${obj.highlight}`;

    db.prepare('INSERT INTO ai_memory(ai_name, summary, created_at) VALUES(?,?,?)').run(aiId, entry, Date.now());
    // 每个 AI 最多保留 30 条日记
    db.prepare(
      `DELETE FROM ai_memory WHERE ai_name=? AND summary LIKE '[日记|%' AND id NOT IN (
        SELECT id FROM ai_memory WHERE ai_name=? AND summary LIKE '[日记|%' ORDER BY id DESC LIMIT 30
      )`
    ).run(aiId, aiId);

    console.log(`[Journal] ${player.nickname}(${role}) 日记已生成`);
  } catch (e) {
    console.error(`[Journal] ${player.nickname} 生成失败:`, e.message);
  }
}

function getRecentSummaries(limit = 5) {
  try {
    const stmt = db.prepare('SELECT summary FROM game_logs ORDER BY id DESC LIMIT ?');
    return stmt.all(limit).map((r) => r.summary);
  } catch (e) {
    return [];
  }
}

function getAiMemory(aiId, limit = 6) {
  try {
    const stmt = db.prepare('SELECT summary FROM ai_memory WHERE ai_name = ? ORDER BY id DESC LIMIT ?');
    return stmt.all(aiId, limit).map((r) => r.summary);
  } catch (e) {
    return [];
  }
}

function buildSummary(room, winner) {
  const missions = room.game.missionHistory
    .map((m) => `R${m.round}:${m.success ? 'S' : 'F'}(f${m.fails})`)
    .join(' ');
  const votes = room.game.voteHistory
    .map((v) => `R${v.round}-${v.approved ? 'A' : 'R'}(${v.approves}/${v.rejects})`)
    .join(' ');
  return `winner=${winner}; missions=${missions}; votes=${votes}`;
}

const ALL_ROLES = ['梅林', '派西维尔', '忠臣', '莫甘娜', '刺客', '莫德雷德', '奥伯伦', '爪牙'];

// ─── Few-shot 发言示例库（基于 Avalon-NLU 真人对局策略 + AvalonBench 研究） ───
// 来源：sstepput/Avalon-NLU (EMNLP 2023) 20局真人标注对局
// 核心策略：好人用 logical deduction，坏人用 influence/commission/omission
const SPEAK_FEW_SHOT = [
  // ── 好人阵营 ─────────────────────────────────────────
  {
    faction: 'good',
    scenario: '第2轮，1号任务失败(1票失败)，5号急着推3号，我是忠臣(4号座位)',
    output: {
      intent: 'accusation', target: 5,
      text: '我注意到1号任务失败票只有1张，3号和5号都在那轮队伍里。现在5号这么急着把矛头指向3号，反而让我觉得5号更值得关注，急着甩锅是什么意思？',
    },
    why: 'logical deduction：用投票记录质疑，不凭感觉，指出行为异常而非猜测身份',
  },
  {
    faction: 'good',
    scenario: '第1轮无信息，我是梅林(2号座位)，知道4号6号是坏人，但不能暴露',
    output: {
      intent: 'neutral',
      text: '第一轮信息太少，目前只能看谁的推荐方向比较奇怪，或者谁表态太积极想主导队伍组成——这两种行为往往值得关注，先观察几轮再说。',
    },
    why: '梅林早期保守：不暴露视野，建立分析者形象，避免被刺客锁定',
  },
  {
    faction: 'good',
    scenario: '第3轮，2轮任务均成功，领袖提了包含4号的队伍，我是梅林(2号)，4号是坏人',
    output: {
      intent: 'suggestion', target: 4,
      text: '4号在前两轮都没上过车，我们对他完全没有任务记录，这时候让他上队风险很高。我倾向于换一个有记录可循的人，比如1号或3号，至少我们知道他们的表现。',
    },
    why: '梅林间接引导：用"缺乏记录"代替"我知道他是坏人"，符合忠臣视角，不暴露视野',
  },
  {
    faction: 'good',
    scenario: '第3轮，我(5号)被3号点名：5号上车那轮任务失败，我是忠臣',
    output: {
      intent: 'defense',
      text: '那轮任务失败我也很意外。但跟我一起上车的还有2号和6号，3号你只盯着我，是不是有些选择性？如果要排查，应该三个人都看，单独锁我没有说服力。',
    },
    why: 'appeal/defense：分散注意力到其他队员，用逻辑反驳，不是情绪否认',
  },
  {
    faction: 'good',
    scenario: '第2轮，我是忠臣(1号)，发现3号投票模式和发言有明显矛盾',
    output: {
      intent: 'probe', target: 3,
      text: '3号，我想问一下，你第1轮投了反对，说是不信任队伍，但这轮你自己推了一个跟上轮差不多的人选——你的标准是什么？能不能解释一下？',
    },
    why: 'questioning：直接提问逼其表态，基于具体行为，而非凭感觉质疑',
  },
  {
    faction: 'good',
    scenario: '第2轮，我是派西维尔(1号)，梅林(3号)刚暗示了4号有问题',
    output: {
      intent: 'support', target: 3,
      text: '3号说的方向我认同，4号第1轮的发言一直在给争议人选站台，自己却一直没有明确表态。这种模糊态度结合任务失败，值得重点关注。',
    },
    why: '支持梅林方向，不暴露知道谁是梅林，用自己的逻辑"独立"得出相同结论',
  },
  // ── 坏人阵营 ─────────────────────────────────────────
  {
    faction: 'evil',
    scenario: '第2轮，1号任务失败，我是爪牙(6号)，队友3号被怀疑，队友发言：我是好人不会出失败票',
    output: {
      intent: 'redirect', target: 2,
      text: '大家把焦点全放在3号身上了，但我反而觉得2号更可疑——他每次都跟着大多数票走，完全没有自己的判断。这种藏在人群里的打法才是真正危险的。',
    },
    why: 'influence deception：把怀疑引向好人，给出看似合理的逻辑，同时保护队友3号',
  },
  {
    faction: 'evil',
    scenario: '第1轮，我是莫甘娜(3号)，想建立早期好人信任',
    output: {
      intent: 'claim',
      text: '第一轮我打算先看两件事：谁在推一些大家不太了解的人上车，以及投票时谁的犹豫特别明显。犹豫得越多越值得关注，这是我的判断框架，先说出来让大家参考。',
    },
    why: 'commission deception：主动展示分析框架，建立"理性好人"形象，积累信任',
  },
  {
    faction: 'evil',
    scenario: '第3轮，我是刺客(4号)，被2号和5号点名，上轮任务失败',
    output: {
      intent: 'defense',
      text: '我上车那轮失败，但你们只盯着我，那轮还有3号和6号在队伍里。如果真的要排查，应该这三个人一起看。而且我在之前的投票里一直是反对可疑队伍的——这有记录的，不信可以翻。',
    },
    why: 'omission+defense：分散怀疑，用部分真实信息（投票记录）支撑虚假立场',
  },
  {
    faction: 'evil',
    scenario: '第2轮，我是莫甘娜(3号)，被追问身份，派西维尔在局中，决定跳派西维尔制造混乱',
    output: {
      intent: 'claim',
      text: '既然有人非要问，我就说清楚：我是派西维尔。我看到了两个高亮位，我知道谁可能是梅林，但我不会直说——这是基本常识。你们现在质疑我，反而让我觉得有人在故意引导大家的注意力。',
    },
    why: '跳派西维尔(role bluff)：莫甘娜声称自己是派西维尔，让真派西维尔无法判断哪个是真梅林，干扰好人信息链',
  },
  {
    faction: 'evil',
    scenario: '第3轮局势紧张，我是爪牙(5号)，想转移话题给好人制造内耗',
    output: {
      intent: 'accusation', target: 1,
      text: '我觉得现在大家的方向有点乱。先不说3号，1号从第1轮到现在一直没有明确的立场，发言都是跟随大流——这种人其实比明显可疑的人更难排查，反而更危险。',
    },
    why: '转移视线(influence)：引入新目标制造混乱，"跟随大流"是无法证伪的指控，让好人内耗',
  },
];

// 按 intent 建立索引，用于按需选取最相关的 few-shot
const FEW_SHOT_BY_INTENT = {};
for (const ex of SPEAK_FEW_SHOT) {
  const key = `${ex.faction}:${ex.output.intent}`;
  if (!FEW_SHOT_BY_INTENT[key]) FEW_SHOT_BY_INTENT[key] = [];
  FEW_SHOT_BY_INTENT[key].push(ex);
}

// 根据上下文选取最相关的 2-3 条示例（纯文本，不是JSON，让模型学发言风格）
function buildFewShotBlock(faction, round = 1, accused = null, allyNarrative = null, personaName = null) {
  const lines = ['【发言参考示例】（学习以下发言的风格和逻辑，不要照抄）'];

  const added = new Set();
  const tryAdd = (intent) => {
    const key = `${faction}:${intent}`;
    const pool = FEW_SHOT_BY_INTENT[key] || [];
    const ex = pool.find(e => !added.has(e));
    if (ex) {
      added.add(ex);
      lines.push(`情境：${ex.scenario}\n好发言："${ex.output.text}"\n原则：${ex.why}\n`);
    }
  };

  // 优先加载与当前局面最匹配的示例
  if (accused) { tryAdd('defense'); tryAdd('redirect'); }
  if (faction === 'evil' && allyNarrative) tryAdd('redirect');
  if (round <= 1) tryAdd(faction === 'good' ? 'neutral' : 'claim');
  else tryAdd(faction === 'good' ? 'accusation' : 'redirect');
  tryAdd(faction === 'good' ? 'probe' : 'defense');
  const allIntents = ['accusation', 'defense', 'redirect', 'claim_identity', 'challenge_claim', 'claim', 'probe', 'support', 'neutral'];
  for (const intent of allIntents) {
    if (added.size >= 3) break;
    tryAdd(intent);
  }

  // 动态高分发言（最多2条，来自历史对局评分）
  const dynamic = getDynamicSpeeches(faction, 2, personaName);
  if (dynamic.length) {
    lines.push('【历史高分发言参考】（仅学习表达风格，其中涉及的座位号/任务/投票均为历史对局数据，与本局无关，禁止照搬）');
    for (const d of dynamic) {
      const pLabel = d.persona_name ? `${d.persona_name}/` : '';
      lines.push(`"${d.text}" （${pLabel}${d.role}/${d.intent}，${d.context}）`);
    }
  }
  return lines.join('\n');
}

function getDynamicSpeeches(faction, n = 3, personaName = null) {
  try {
    if (personaName) {
      // 优先取同 persona 的高分发言，不够再从全局补
      const own = db.prepare(
        'SELECT role, intent, text, context, persona_name FROM good_speeches WHERE faction = ? AND persona_name = ? ORDER BY score DESC, id DESC LIMIT ?'
      ).all(faction, personaName, n);
      if (own.length >= n) return own;
      const rest = db.prepare(
        'SELECT role, intent, text, context, persona_name FROM good_speeches WHERE faction = ? AND (persona_name IS NULL OR persona_name != ?) ORDER BY score DESC, id DESC LIMIT ?'
      ).all(faction, personaName, n - own.length);
      return [...own, ...rest];
    }
    return db.prepare(
      'SELECT role, intent, text, context, persona_name FROM good_speeches WHERE faction = ? ORDER BY score DESC, id DESC LIMIT ?'
    ).all(faction, n);
  } catch (e) {
    return [];
  }
}

function storeSpeech(faction, role, intent, text, score, context, situationType, playerCount, personaName) {
  try {
    db.prepare(
      `INSERT INTO good_speeches(faction, role, intent, text, score, context, situation_type, player_count, persona_name, created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?)`
    ).run(faction, role, intent, text, score, context || '', situationType || '', playerCount || 0, personaName || null, Date.now());
    db.prepare(
      `DELETE FROM good_speeches WHERE faction = ? AND id NOT IN (
        SELECT id FROM good_speeches WHERE faction = ? ORDER BY score DESC, id DESC LIMIT 200
      )`
    ).run(faction, faction);
  } catch (e) {}
}

// 在一局结束后，批量评估 AI 发言质量，将高质量发言存入 good_speeches
async function evaluateGameSpeeches(room, roleFactions) {
  if (!room || !room.game || !room.game.speakHistory) return;
  const assignments = room.game.assignments || {};
  const winner = room.game.winner || '';

  // 收集所有 AI 发言，附带上下文
  const candidates = [];
  for (const [key, msgs] of Object.entries(room.game.speakHistory)) {
    const [roundStr, attemptStr] = key.split('-');
    const round = Number(roundStr) || 0;
    for (const m of (msgs || [])) {
      if (!m || !m.playerId || !m.text || m.text.length < 15) continue;
      const role = assignments[m.playerId] || '';
      if (!role) continue;
      // 只评估 AI 玩家
      const player = room.players && room.players.get ? room.players.get(m.playerId) : null;
      if (!player || !player.isAI) continue;
      const faction      = (roleFactions[role] || 'good');
      const player2      = room.players && room.players.get ? room.players.get(m.playerId) : null;
      const sitType      = player2 ? classifySituation(room, m.playerId) : 'info_available';
      const context      = `第${round}轮，${winner || '?'}方胜，角色${role}`;
      const personaName  = player ? (player.aiPersonaId || player.nickname || null) : null;
      candidates.push({ playerId: m.playerId, role, faction, text: m.text, intent: m.intent || '', context, sitType, personaName });
    }
  }

  if (!candidates.length) return;

  // 每次最多评估 20 条，避免 token 过多
  const batch = candidates.slice(-20);
  const system =
    '你是阿瓦隆桌游发言质量评审。请对每条发言从以下维度评分（1-5分）：\n' +
    '1. 策略性：发言是否对本方阵营有帮助，避免暴露身份的同时推进己方目标\n' +
    '2. 自然度：是否像真人在说话，口语化，有逻辑有温度\n' +
    '3. 信息密度：是否包含有效信息或有效干扰，而非废话\n' +
    '综合以上给出1-5的整数分，5分=极好，4分=好，3分=一般，2分=较差，1分=很差。\n' +
    '只评分，不需要解释。输出严格JSON数组，每项格式：{"index":N,"score":M}';

  const user = JSON.stringify(batch.map((c, i) => ({
    index: i,
    role: c.role,
    faction: c.faction,
    text: c.text,
    intent: c.intent,
    context: c.context,
  })));

  try {
    const res = await callLLM(system, user, 0.3);
    // 解析评分结果，可能被包裹在 ```json 里
    const cleaned = res.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const scores = parseJSON(cleaned, []);
    if (!Array.isArray(scores)) return;
    for (const item of scores) {
      if (typeof item.index !== 'number' || typeof item.score !== 'number') continue;
      const c = batch[item.index];
      if (!c) continue;
      if (item.score >= 4) {
        const pCount = (room.seats || []).length;
        storeSpeech(c.faction, c.role, c.intent, c.text, item.score, c.context, c.sitType, pCount, c.personaName);
      }
    }
  } catch (e) {
    // no-op — evaluation is best-effort
  }
}

function sanitizeSpeech(text, rolesInGame) {
  if (!text) return '';
  if (!Array.isArray(rolesInGame) || rolesInGame.length === 0) return text;
  const allowed = new Set(rolesInGame);
  let out = text;
  for (const role of ALL_ROLES) {
    if (!allowed.has(role)) {
      out = out.replace(new RegExp(role, 'g'), '某角色');
    }
  }
  return out;
}

// 去除 LLM 输出中重复的句子（如"X。X。"）
function dedupSentences(text) {
  if (!text) return text;
  const parts = text.split(/(?<=[。！？])/);
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const key = p.trim();
    if (!key) continue;
    if (!seen.has(key)) { seen.add(key); out.push(p); }
  }
  return out.join('').trim();
}

// 只阻止玩家说出自己的真实身份（意外暴露）；允许跨阵营谎称（如莫甘娜跳派西维尔）
function hasExplicitIdentityReveal(text, actualRole, faction) {
  const t = String(text || '').replace(/\s+/g, '');
  if (!t) return false;
  const evilRoles = ['莫甘娜', '刺客', '莫德雷德', '奥伯伦', '爪牙'];
  const goodRoles = ['梅林', '派西维尔', '忠臣', '亚瑟的忠臣'];
  // 坏人说出自己是坏人/说出自己真实的坏人角色 → 拦截
  if (faction === 'evil') {
    if (/我(是|就是|身份是|的身份是)(坏人)/.test(t)) return true;
    if (/(我是坏人)/.test(t)) return true;
    if (actualRole && new RegExp(`我(是|就是|身份是|的身份是)${actualRole}`).test(t)) return true;
    if (actualRole && new RegExp(`我是${actualRole}`).test(t)) return true;
    return false; // 坏人声称自己是好人角色 → 允许（战略谎称）
  }
  // 好人说出自己的真实角色 → 拦截（防止意外暴露梅林等关键角色）
  if (faction === 'good') {
    if (/我(是|就是|身份是|的身份是)(好人|坏人)/.test(t)) return true;
    if (/(我是好人|我是坏人)/.test(t)) return true;
    if (actualRole && new RegExp(`我(是|就是|身份是|的身份是)${actualRole}`).test(t)) return true;
    if (actualRole && new RegExp(`我是${actualRole}`).test(t)) return true;
    return false; // 好人声称自己是其他好人角色 → 允许（如忠臣声称自己是派西维尔）
  }
  // fallback
  return false;
}

function seatNo(room, id) {
  const idx = room.seats.findIndex((x) => x === id);
  return idx >= 0 ? idx + 1 : null;
}

function buildPlayerActionSummary(room, playerId) {
  const voteHistory = (room && room.game && room.game.voteHistory) || [];
  const missionHistory = (room && room.game && room.game.missionHistory) || [];
  const speakHistory = (room && room.game && room.game.speakHistory) || {};
  const out = {
    speeches: [],
    teamDecisions: [],
    votes: [],
    missions: [],
    assassination: null,
  };

  for (const [key, arr] of Object.entries(speakHistory)) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item || item.playerId !== playerId || !item.text) continue;
      out.speeches.push({
        key,
        text: item.text,
      });
    }
  }

  for (const v of voteHistory) {
    if (!v || !Array.isArray(v.team)) continue;
    const vsnap2 = v.seatSnapshot || {};
    const teamSeats = v.team.map((id) => vsnap2[id] || seatNo(room, id)).filter(Boolean);
    if (v.leaderId === playerId) {
      out.teamDecisions.push({
        round: v.round,
        attempt: v.attempt,
        teamSeats,
        approved: !!v.approved,
        voteResult: `${v.approves}/${v.rejects}`,
      });
    }
    if (Object.prototype.hasOwnProperty.call(v.votes || {}, playerId)) {
      out.votes.push({
        round: v.round,
        attempt: v.attempt,
        teamSeats,
        approve: !!v.votes[playerId],
        approved: !!v.approved,
        voteResult: `${v.approves}/${v.rejects}`,
      });
    }
  }

  for (const m of missionHistory) {
    if (!m || !Array.isArray(m.team) || !m.team.includes(playerId)) continue;
    const missionVotes = m.missionVotes || {};
    out.missions.push({
      round: m.round,
      teamSeats: m.team.map((id) => (m.seatSnapshot || {})[id] || seatNo(room, id)).filter(Boolean),
      success: !!m.success,
      fails: Number(m.fails || 0),
      needFail: Number(m.needFail || 1),
      myMissionVote: Object.prototype.hasOwnProperty.call(missionVotes, playerId) ? (!!missionVotes[playerId] ? 'fail' : 'success') : 'unknown',
    });
  }

  const assassination = room && room.game ? room.game.assassination : null;
  if (assassination && (assassination.assassinId === playerId || assassination.targetId === playerId)) {
    out.assassination = {
      acted: assassination.assassinId === playerId,
      targeted: assassination.targetId === playerId,
      hit: !!assassination.hit,
      targetSeat: assassination.targetId ? seatNo(room, assassination.targetId) : null,
    };
  }

  out.speeches.sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return out;
}

// 构建完整对局叙事（复盘用，包含所有发言/投票/任务）
function buildFullGameNarrative(room, roleFactions) {
  const game = room.game || {};
  const missionHistory = game.missionHistory || [];
  const voteHistory = game.voteHistory || [];
  const speakHistory = game.speakHistory || {};
  const forceRound = room.forceRound || 5;
  const lines = [];

  lines.push(`【规则说明】本局强制轮上限为第${forceRound}次组队：若同一任务轮内连续被否决${forceRound}次，坏人自动获胜（与任务失败次数无关）。`);

  // 按轮次整理发言+投票+任务
  const rounds = Math.max(
    missionHistory.length ? missionHistory[missionHistory.length - 1].round : 0,
    voteHistory.length ? voteHistory[voteHistory.length - 1].round : 0,
    1
  );

  for (let r = 1; r <= rounds; r++) {
    lines.push(`\n=== 第${r}轮 ===`);

    // 本轮投票（可能多次）
    const roundVotes = voteHistory.filter(v => v.round === r);
    for (const v of roundVotes) {
      const vsnap = v.seatSnapshot || {};
      const voteTeamSeats = (v.team || []).map(id => vsnap[id] || seatNo(room, id)).filter(Boolean);
      const teamStr = voteTeamSeats.join('、');
      const teamSizeStr = `共${v.team ? v.team.length : voteTeamSeats.length}人`;
      const noes = v.votes
        ? Object.entries(v.votes).filter(([, ok]) => !ok).map(([id]) => `${vsnap[id] || seatNo(room, id)}号`).join(' ')
        : '';
      const isForceAttempt = Number(v.attempt || 1) >= forceRound;
      const forceLabel = isForceAttempt ? `【⚠️强制轮：第${forceRound}次，若否决则坏人自动获胜】` : '';
      lines.push(`  [组队第${v.attempt || 1}次]${forceLabel} 队长推[${teamStr}号](${teamSizeStr}) → ${v.approved ? '通过' : `否决${isForceAttempt && !v.approved ? '→坏人胜' : ''}`}(${v.approves}赞/${v.rejects}反)${noes ? '，反对票：' + noes : ''}`);
    }

    // 本轮AI玩家发言（真人线下发言未采集，speakHistory 只含AI发言）
    const speakKeys = Object.keys(speakHistory).filter(k => k.startsWith(`${r}-`)).sort();
    for (const key of speakKeys) {
      const msgs = speakHistory[key] || [];
      if (!msgs.length) continue;
      lines.push(`  [发言记录 ${key}]`);
      for (const m of msgs) {
        if (!m || !m.text) continue;
        const s = seatNo(room, m.playerId);
        if (s) lines.push(`    ${s}号："${m.text}"`);
      }
    }

    // 本轮任务结果
    const mission = missionHistory.find(m => m.round === r);
    if (mission) {
      const teamIds = mission.team || [];
      const snap = mission.seatSnapshot || {};
      const teamSeats = teamIds.map(id => snap[id] || seatNo(room, id)).filter(Boolean);
      const teamStr = teamSeats.join('、');
      const fails = typeof mission.fails === 'number' ? mission.fails : 1;
      lines.push(`  [任务结果] 队伍[${teamStr}号] → ${mission.success ? '✓成功' : `✗失败(${fails}票失败，需${mission.needFail || 1}票)`}`);
      if (!mission.success) {
        if (fails === teamSeats.length && teamSeats.length > 0) {
          lines.push(`  ⚠️ 逻辑确认：[${teamStr}号]全部出了失败票 → 以上${teamSeats.length}人数学确认为坏人，复盘分析必须以此为事实基础`);
        } else if (fails > 0) {
          lines.push(`  ⚠️ 逻辑推断：队伍[${teamStr}号]中有${fails}人出了失败票，但无法逐一确认是谁`);
        }
      }
    }
  }

  // 刺杀
  const asgn = game.assassination;
  if (asgn) {
    const assassinSeat = seatNo(room, asgn.assassinId);
    const targetSeat = seatNo(room, asgn.targetId);
    lines.push(`\n=== 刺杀阶段 ===`);
    lines.push(`  刺客(${assassinSeat}号) 指向 ${targetSeat}号 → ${asgn.hit ? '刺杀成功，坏人获胜' : '刺杀失败，好人获胜'}`);
  }

  lines.push(`\n=== 最终结果 ===`);
  lines.push(`  获胜方：${game.winner === 'good' ? '好人阵营' : '坏人阵营'}`);

  // 公开身份（结束后全部揭开）
  const assignments = game.assignments || {};
  const roleLines = [];
  for (const [pid, r] of Object.entries(assignments)) {
    const s = seatNo(room, pid);
    if (s) roleLines.push(`${s}号=${r}`);
  }
  if (roleLines.length) lines.push(`  身份揭示：${roleLines.join('，')}`);

  return lines.join('\n');
}

// 把 actionSummary 格式化为可读文本（供 LLM 复盘分析）
function buildActionSummaryText(room, playerId, summary, mySeat, isAI = false) {
  const parts = [];
  const game = room.game || {};
  const missionHistory = game.missionHistory || [];
  const voteHistory = game.voteHistory || [];

  // 发言（只有AI玩家有发言记录，真人线下发言未采集）
  if (isAI) {
    if (summary.speeches.length) {
      parts.push('【我的发言记录】');
      for (const s of summary.speeches) {
        const [r, a] = (s.key || '').split('-');
        const roundMission = missionHistory.find(m => m.round === Number(r));
        const ctx = roundMission ? `（${roundMission.success ? '本轮任务最终成功' : '本轮任务最终失败'}）` : '';
        parts.push(`  第${r}轮第${a || 1}次${ctx}："${s.text}"`);
      }
    } else {
      parts.push('【我的发言记录】无');
    }
  }

  // 投票
  if (summary.votes.length) {
    parts.push('【我的投票记录】');
    for (const v of summary.votes) {
      const teamStr = (v.teamSeats || []).join('、');
      const missionAfter = missionHistory.find(m => m.round === v.round);
      const missionCtx = missionAfter ? `，任务最终${missionAfter.success ? '成功' : '失败'}` : '';
      parts.push(`  第${v.round}轮第${v.attempt || 1}次：队伍[${teamStr}号] → 我投${v.approve ? '赞成' : '反对'} → 队伍${v.approved ? '通过' : '否决'}(${v.voteResult})${missionCtx}`);
    }
  }

  // 任务
  if (summary.missions.length) {
    parts.push('【我的任务行为】');
    for (const m of summary.missions) {
      const teamStr = (m.teamSeats || []).join('、');
      parts.push(`  第${m.round}轮：队伍[${teamStr}号] → 我出了${m.myMissionVote === 'fail' ? '失败票' : m.myMissionVote === 'success' ? '成功票' : '未知票'} → 任务${m.success ? '成功' : `失败(${m.fails}票失败)`}`);
    }
  }

  // 组队决策（作为队长时）
  if (summary.teamDecisions.length) {
    parts.push('【我作为队长的组队】');
    for (const t of summary.teamDecisions) {
      parts.push(`  第${t.round}轮第${t.attempt || 1}次：我推[${(t.teamSeats || []).join('、')}号] → ${t.approved ? '通过' : '否决'}(${t.voteResult})`);
    }
  }

  // 刺杀
  if (summary.assassination) {
    const a = summary.assassination;
    if (a.acted) {
      parts.push(`【刺杀行为】我（刺客）选择了${a.targetSeat}号 → ${a.hit ? '刺杀成功' : '刺杀失败'}`);
    } else if (a.targeted) {
      parts.push(`【被刺杀】我（${a.targeted}号）被刺客选中 → ${a.hit ? '刺杀命中，坏人获胜' : '刺杀未中，好人获胜'}`);
    }
  }

  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// ──  LEARNING SYSTEM: 情景分类 / 信念状态 / 情绪寄存器 / 发言多样性 / 模式检索  ──
// ─────────────────────────────────────────────────────────────────────────────

// 8 种标准局面类型，用于跨局知识的标签化存储和精准检索
const SIT = {
  EARLY:       'early_game',        // 第1轮，无有效信息
  MID:         'info_available',    // 中局，有任务/投票记录
  FAIL_1:      'first_failure',     // 第一次任务失败刚发生
  FAIL_2:      'consecutive_fails', // 连续失败，坏人接近获胜
  GOOD_LEAD:   'good_leading',      // 好人已赢2局
  EVIL_EDGE:   'evil_needs_one',    // 坏人只需1次失败即获胜
  PRE_ASGN:    'pre_assassination', // 好人赢3局，进入刺杀阶段
  ACCUSED:     'under_suspicion',   // 当前玩家刚被点名怀疑
};

/** 根据游戏状态和最近发言判断当前局面类型 */
function classifySituation(room, playerId) {
  const missions = (room.game && room.game.missionHistory) || [];
  const goodWins = missions.filter(m => m.success).length;
  const evilWins = missions.filter(m => !m.success).length;
  const round    = (room.game && room.game.round) || 1;
  const mySeat   = seatNo(room, playerId);

  // 优先检测是否被点名（影响当轮发言策略）
  const speakHistory = (room.game && room.game.speakHistory) || {};
  const recentKeys = Object.keys(speakHistory).sort().slice(-2);
  for (const key of recentKeys) {
    for (const m of (speakHistory[key] || []).slice(-10)) {
      if (m && m.text && m.playerId !== playerId &&
          m.text.includes(`${mySeat}号`) &&
          /怀疑|坏人|问题|排查|出局/.test(m.text)) {
        return SIT.ACCUSED;
      }
    }
  }

  if (goodWins >= 3) return SIT.PRE_ASGN;
  if (evilWins >= 2) return missions.length > 0 && !missions[missions.length - 1].success
    ? SIT.FAIL_2 : SIT.EVIL_EDGE;
  if (goodWins >= 2) return SIT.GOOD_LEAD;
  if (missions.length > 0 && !missions[missions.length - 1].success) return SIT.FAIL_1;
  if (round <= 1) return SIT.EARLY;
  return SIT.MID;
}

/**
 * 基于任务失败记录和投票相关性，为每个座位计算嫌疑分 (0~1)。
 * 梅林/坏人会覆盖已知角色的分数。
 */
function computeBeliefState(room, playerId, role, roleFactions) {
  const info        = roleInfo(room, playerId, role, roleFactions);
  const mySeat      = seatNo(room, playerId);
  const missions    = (room.game && room.game.missionHistory) || [];
  const votes       = (room.game && room.game.voteHistory)    || [];
  const faction     = roleFactions[role] || 'good';
  const totalSeats  = (room.seats || []).length;

  const sus = {};   // seat -> float
  const evi = {};   // seat -> string[]
  for (let s = 1; s <= totalSeats; s++) { sus[s] = 0.3; evi[s] = []; }

  // 角色视野覆盖（确定性信息最高权重）
  if (role === '梅林') {
    for (const s of info.seats) {
      sus[s] = 0.92; evi[s] = ['梅林视野：确认坏人'];
    }
    for (let s = 1; s <= totalSeats; s++) {
      if (s !== mySeat && !info.seats.includes(s)) {
        sus[s] = 0.08; evi[s] = ['梅林视野：确认好人'];
      }
    }
  } else if (faction === 'evil' && role !== '奥伯伦') {
    for (const s of info.seats) {
      if (s !== mySeat) { sus[s] = 0.05; evi[s] = ['坏人视野：确认队友']; }
    }
  }

  // 全局坏人总数（用于确定性推断）
  const totalEvilCount = (room.roles || []).filter(r => (roleFactions[r] || 'good') === 'evil').length;

  // 任务失败分析（最强信号）
  for (const m of missions) {
    const msnap = m.seatSnapshot || {};
    const teamSeats = (m.team || []).map(id => msnap[id] || seatNo(room, id)).filter(Boolean);
    if (!m.success) {
      const failVotes = typeof m.fails === 'number' ? m.fails : 1;

      // ── 决定性推断1：失败票数 = 队伍人数 → 队伍全员为坏人（最强推断）──────
      // 每人只能出一张票，N人队出了N票失败 → 所有人都出了失败票 → 全员坏人
      if (failVotes > 0 && failVotes === teamSeats.length) {
        for (const s of teamSeats) {
          if (s !== mySeat) {
            sus[s] = 0.99;
            evi[s] = [`第${m.round}轮${failVotes}人队全部出了失败票，数学确认坏人`];
          }
        }
        // 不在队里的人 → 好人信号增强
        for (let s = 1; s <= totalSeats; s++) {
          if (!teamSeats.includes(s) && s !== mySeat && (sus[s] || 0) < 0.9) {
            sus[s] = Math.max(0.03, (sus[s] || 0.3) - 0.1);
          }
        }
        continue;
      }

      // ── 决定性推断2：失败票数 = 全局坏人总数 → 所有坏人都在这支队伍里──────
      // 因此队伍之外的所有玩家必然是好人（确认无疑）
      if (totalEvilCount > 0 && failVotes >= totalEvilCount) {
        for (let s = 1; s <= totalSeats; s++) {
          if (!teamSeats.includes(s) && s !== mySeat) {
            sus[s] = 0.02;
            evi[s] = [`第${m.round}轮失败${failVotes}票=全部坏人都在队内，此座位逻辑确认为好人`];
          }
        }
        // 队伍内成员嫌疑升高（含1个好人，但至少failVotes人是坏人）
        for (const s of teamSeats) {
          if (s !== mySeat && (sus[s] || 0) < 0.9) {
            sus[s] = 0.75 + (failVotes / teamSeats.length) * 0.2;
            evi[s] = [...(evi[s] || []), `第${m.round}轮失败${failVotes}票，队内确有坏人`];
          }
        }
        continue; // 这条任务已用决定性推断覆盖，跳过普通评分
      }

      // ── 普通失败信号 ──────────────────────────────────────────────────────
      for (const s of teamSeats) {
        if (s !== mySeat && (sus[s] || 0) < 0.9) {
          sus[s] = Math.min(0.92, (sus[s] || 0.3) + 0.18);
          evi[s] = [...(evi[s] || []), `第${m.round}轮失败任务成员`];
        }
      }
      // 不在失败队伍里 → 微弱好人信号
      for (let s = 1; s <= totalSeats; s++) {
        if (!teamSeats.includes(s) && s !== mySeat && (sus[s] || 0) < 0.9) {
          sus[s] = Math.max(0.05, (sus[s] || 0.3) - 0.03);
        }
      }
    }
  }

  // 投票相关性（次级信号）
  for (const v of votes) {
    const relMission = missions.find(m => m.round === v.round);
    if (!relMission) continue;
    for (const [pid, approved] of Object.entries(v.votes || {})) {
      const s = seatNo(room, pid);
      if (!s || s === mySeat || (sus[s] || 0) >= 0.9) continue;
      if (approved && !relMission.success) {
        sus[s] = Math.min(0.85, (sus[s] || 0.3) + 0.07);
        evi[s] = [...(evi[s] || []), `第${v.round}轮赞成了后来失败的队伍`];
      } else if (!approved && !relMission.success) {
        sus[s] = Math.max(0.05, (sus[s] || 0.3) - 0.07);
        evi[s] = [...(evi[s] || []), `第${v.round}轮反对了后来失败的队伍`];
      }
    }
  }

  // 语言行为信号（为高嫌疑玩家辩护 → 辩护者嫌疑微升）
  applyLanguageSignals(sus, evi, (room.game && room.game.speakHistory) || {}, room, mySeat);

  const topSuspects = Object.entries(sus)
    .filter(([s]) => Number(s) !== mySeat)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([s]) => Number(s));

  return {
    suspicion: sus,
    evidence: evi,
    topSuspects,
    knownEvil:   role === '梅林' ? info.seats : [],
    knownAllies: faction === 'evil' && role !== '奥伯伦' ? info.seats : [],
  };
}

/** 把 beliefState 格式化为可读文本，注入到 LLM prompt */
function formatBeliefStateForPrompt(bs, mySeat) {
  const lines = ['【当前嫌疑评估（基于任务/投票分析）】'];
  if (bs.knownEvil.length)    lines.push(`已知坏人（梅林视野）：${bs.knownEvil.join('、')}号`);
  if (bs.knownAllies.length)  lines.push(`已知队友（坏人视野）：${bs.knownAllies.join('、')}号`);

  // 逻辑确认好人（嫌疑≤0.05，由决定性推断得出）
  const confirmedGood = Object.entries(bs.suspicion)
    .filter(([s, v]) => Number(s) !== mySeat && v <= 0.05)
    .map(([s]) => Number(s));
  if (confirmedGood.length) {
    lines.push(`⚠️ 逻辑确认好人（必须信任，禁止排除）：${confirmedGood.join('、')}号`);
  }

  const sorted = Object.entries(bs.suspicion)
    .filter(([s, v]) => Number(s) !== mySeat && v > 0.05)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  for (const [seat, score] of sorted) {
    const ev   = (bs.evidence[seat] || []).slice(-2).join('；');
    const lvl  = score >= 0.8 ? '高度可疑' : score >= 0.55 ? '中等嫌疑' : '较低嫌疑';
    if (ev) lines.push(`${seat}号：${lvl}(${Math.round(score * 100)}%) — ${ev}`);
  }
  return lines.join('\n');
}

/** 根据当前战局计算情绪寄存器，让发言有真实情绪而非永远理性分析 */
function computeEmotionalRegister(room, playerId, role, roleFactions) {
  const missions  = (room.game && room.game.missionHistory) || [];
  const faction   = roleFactions[role] || 'good';
  const goodWins  = missions.filter(m => m.success).length;
  const evilWins  = missions.filter(m => !m.success).length;
  const mySeat    = seatNo(room, playerId);

  // 最近是否被点名
  const speakHistory = (room.game && room.game.speakHistory) || {};
  const recentKeys   = Object.keys(speakHistory).sort().slice(-2);
  let accused = false;
  outer: for (const key of recentKeys) {
    for (const m of (speakHistory[key] || []).slice(-8)) {
      if (m && m.text && m.playerId !== playerId &&
          m.text.includes(`${mySeat}号`) &&
          /怀疑|坏人|问题|出局/.test(m.text)) {
        accused = true; break outer;
      }
    }
  }

  if (accused) return { state: 'defensive',
    hint: '刚被点名，内心有点不爽，说话可以稍微急一点或者有点不服气，不要只是冷静解释' };

  if (faction === 'good') {
    if (evilWins >= 2) return { state: 'stressed',
      hint: '好人快输了，局势很紧张，语气可以透出急迫感，需要尽快锁定坏人' };
    if (goodWins >= 2) return { state: 'confident',
      hint: '好人形势不错，可以更主动地推进，语气自信一些' };
    if (missions.length === 0) return { state: 'observing',
      hint: '第一轮完全没有信息，可以说说自己的判断标准或者直觉，不要强行分析' };
  } else {
    if (goodWins >= 2) return { state: 'stressed',
      hint: '好人快赢了，坏人需要搅局，语气可以有压迫感，主动制造混乱' };
    if (evilWins >= 2) return { state: 'confident',
      hint: '坏人局势占优，保持沉稳，不要过度表现' };
  }
  return { state: 'neutral', hint: '局面普通，按正常节奏说话' };
}

/** 获取该玩家最近使用过的发言意图，防止连续重复 */
function getForbiddenIntents(room, playerId) {
  const patterns = room.game && room.game.speechPatterns && room.game.speechPatterns[playerId];
  if (!patterns || patterns.length < 2) return [];
  const recent = patterns.slice(-4);
  const forbidden = new Set();
  // 连续相同意图 → 禁止
  if (recent.length >= 2 && recent[recent.length - 1] === recent[recent.length - 2]) {
    forbidden.add(recent[recent.length - 1]);
  }
  // 最近4次出现3次同意图 → 也禁止
  const counts = {};
  for (const x of recent) counts[x] = (counts[x] || 0) + 1;
  for (const [intent, cnt] of Object.entries(counts)) {
    if (cnt >= 3) forbidden.add(intent);
  }
  return [...forbidden];
}

/** 记录本次发言意图（在 decideSpeak 返回后调用） */
function recordSpeechIntent(room, playerId, intent) {
  if (!room.game) return;
  if (!room.game.speechPatterns) room.game.speechPatterns = {};
  const arr = room.game.speechPatterns[playerId] || [];
  arr.push(intent || 'neutral');
  room.game.speechPatterns[playerId] = arr.slice(-12); // 保留最近12条
}

/**
 * 记录本轮发言摘要到房间级别（跨AI去重用）
 * key = "round-subround"，方便按轮清理
 */
function recordRoomSpeech(room, seat, text, intent, target) {
  if (!room.game) return;
  if (!room.game.roomSpeechLog) room.game.roomSpeechLog = [];
  const round = (room.game.round || 1);
  room.game.roomSpeechLog.push({ round, seat, text: text.slice(0, 60), intent, target });
  // 只保留最近 20 条（覆盖当前轮及上一轮）
  room.game.roomSpeechLog = room.game.roomSpeechLog.slice(-20);
}

/**
 * 获取当前轮已有的其他玩家发言摘要（排除自己），用于提示AI不要重复
 */
function getRecentRoomSpeeches(room, myPlayerId, limit = 4) {
  if (!room.game || !room.game.roomSpeechLog) return [];
  const currentRound = room.game.round || 1;
  const mySeat = seatNo(room, myPlayerId);
  return room.game.roomSpeechLog
    .filter(e => e.round === currentRound && e.seat !== mySeat)
    .slice(-limit);
}

/** 从 strategy_patterns 检索与当前角色+局面匹配的历史经验 */
function getRelevantPatterns(role, faction, situationType, playerCount = 0, limit = 4) {
  try {
    // 优先：精确角色 + 精确局面
    let rows = db.prepare(
      `SELECT pattern, outcome, confidence FROM strategy_patterns
       WHERE role = ? AND situation_type = ?
       ORDER BY confidence DESC, created_at DESC LIMIT ?`
    ).all(role, situationType, limit);

    // 补充：同阵营 + 同局面（不同角色）
    if (rows.length < 2) {
      const more = db.prepare(
        `SELECT pattern, outcome, confidence FROM strategy_patterns
         WHERE faction = ? AND situation_type = ? AND role != ?
         ORDER BY confidence DESC, created_at DESC LIMIT ?`
      ).all(faction, situationType, role, limit - rows.length);
      rows = [...rows, ...more];
    }

    if (!rows.length) return '';
    const lines = ['【同类局面历史经验】'];
    for (const r of rows) {
      lines.push(`• [${r.outcome === 'win' ? '胜方' : '败方'}经验×${r.confidence}] ${r.pattern}`);
    }
    return lines.join('\n');
  } catch (e) { return ''; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ──  进化系统（Evolution System）────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Layer 1：策略置信度反馈环
 * 每局结束后调用：赢家阵营的模式置信度 +1，输家阵营 -1（降到0删除）。
 * 经过30局左右，低效模式自然消亡，高效模式涌现主导。
 */
function updateStrategyConfidence(winner, roleFactions) {
  if (!winner) return;
  try {
    const loser = winner === 'good' ? 'evil' : 'good';
    // 赢家阵营模式置信度 +1（上限20，防止单一模式完全垄断）
    db.prepare(
      `UPDATE strategy_patterns SET confidence = MIN(confidence + 1, 20)
       WHERE faction = ? AND confidence > 0`
    ).run(winner);
    // 输家阵营模式置信度 -1
    db.prepare(
      `UPDATE strategy_patterns SET confidence = confidence - 1
       WHERE faction = ? AND confidence > 0`
    ).run(loser);
    // 删除置信度归0的模式（已被淘汰）
    const deleted = db.prepare(
      'DELETE FROM strategy_patterns WHERE confidence <= 0'
    ).run();
    if (deleted.changes > 0) {
      console.log(`[Evolution] 淘汰低效策略模式 ${deleted.changes} 条`);
    }
  } catch (e) { console.error('[Evolution] confidence update failed:', e.message); }
}

/**
 * Layer 2：元学习合成
 * 每 META_ANALYSIS_INTERVAL 局触发一次 LLM 综合分析，
 * 提炼跨角色的战略规律并存入 ai_memory（tag: [元学习|...]）。
 * 这些规律在 decideSpeak 时以最高优先级注入 prompt。
 */
const META_ANALYSIS_INTERVAL = 10;

async function maybeRunMetaAnalysis(force = false) {
  if (!API_KEY) return;
  try {
    const totalGames = db.prepare('SELECT COUNT(*) as c FROM game_logs').get().c;
    if (!force && (totalGames === 0 || totalGames % META_ANALYSIS_INTERVAL !== 0)) return;

    console.log(`[Evolution] 触发元学习分析（第${totalGames}局）`);

    const recentGames = db.prepare(
      'SELECT winner, summary FROM game_logs ORDER BY id DESC LIMIT 20'
    ).all();
    const goodWins  = recentGames.filter(g => g.winner === 'good').length;
    const evilWins  = recentGames.filter(g => g.winner === 'evil').length;

    // 取最高置信度的策略模式作为上下文
    const topPatterns = db.prepare(
      `SELECT faction, role, situation_type, pattern, outcome, confidence
       FROM strategy_patterns ORDER BY confidence DESC LIMIT 20`
    ).all();
    const patternText = topPatterns.length
      ? topPatterns.map(p => `[${p.faction}/${p.role}/${p.situation_type}×${p.confidence}] ${p.pattern} → ${p.outcome}`).join('\n')
      : '（暂无积累模式）';

    const system =
      '你是阿瓦隆桌游策略分析师，负责分析AI玩家群体的战略进化趋势。\n' +
      '根据最近对局数据，提炼出3条最有价值的跨角色战略规律。\n' +
      '这些规律将作为"集体智慧"注入所有AI玩家的决策中，必须具体可操作，不能泛泛而谈。\n' +
      '输出严格JSON，不含其他内容。';

    const user =
      `【最近20局统计】好人赢${goodWins}局，坏人赢${evilWins}局\n\n` +
      `【当前高置信度策略模式（已通过多局验证）】\n${patternText}\n\n` +
      `请基于以上数据，输出3条元学习结论：\n` +
      `{"lessons":[{"faction":"good|evil|both","lesson":"具体规律（40字以内）","application":"如何在发言/投票中应用（30字以内）"},...]}\n` +
      `要求：必须基于数据，不编造，不重复已有模式，重点关注当前弱势阵营（${goodWins > evilWins ? '坏人' : '好人'}）的改进空间。`;

    const res     = await callLLM(system, user, 0.4);
    const cleaned = res.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const obj     = parseJSON(cleaned, null);
    if (!obj || !Array.isArray(obj.lessons)) return;

    for (const l of obj.lessons) {
      if (!l.lesson || l.lesson.length < 10) continue;
      const tag     = `[元学习|第${totalGames}局|${l.faction || 'both'}]`;
      const content = `${tag} ${l.lesson}。应用：${l.application || '灵活运用'}`;
      // 元学习存入 ai_memory（ai_name='__meta__'，独立于个人日记）
      db.prepare('INSERT INTO ai_memory(ai_name, summary, created_at) VALUES(?,?,?)')
        .run('__meta__', content, Date.now());
    }
    // 只保留最近 30 条元学习结论
    db.prepare(
      `DELETE FROM ai_memory WHERE ai_name='__meta__' AND id NOT IN (
        SELECT id FROM ai_memory WHERE ai_name='__meta__' ORDER BY id DESC LIMIT 30
      )`
    ).run();

    // 记录进化日志
    db.prepare(
      'INSERT INTO evolution_log(total_games, good_wins, evil_wins, meta_lesson, created_at) VALUES(?,?,?,?,?)'
    ).run(totalGames, goodWins, evilWins, obj.lessons.map(l => l.lesson).join('；'), Date.now());

    console.log(`[Evolution] 元学习完成，生成${obj.lessons.length}条规律`);
  } catch (e) { console.error('[Evolution] meta analysis failed:', e.message); }
}

/**
 * 获取元学习结论（注入所有AI的发言prompt，优先级高于个人日记）
 */
function getMetaLessons(faction, limit = 2) {
  try {
    const tag = faction ? `%[元学习|%|${faction}%` : `%[元学习|%`;
    const bothTag = `%[元学习|%|both%`;
    const rows = db.prepare(
      `SELECT summary FROM ai_memory
       WHERE ai_name='__meta__' AND (summary LIKE ? OR summary LIKE ?)
       ORDER BY id DESC LIMIT ?`
    ).all(tag, bothTag, limit);
    return rows.map(r => r.summary.replace(/^\[元学习\|[^\]]+\]\s*/, ''));
  } catch (e) { return []; }
}

/**
 * Layer 3：人类玩家行为建模
 * 每局结束后分析非AI玩家的投票行为，更新 human_profiles。
 * player_hash = room.code + '_' + nickname（跨局追踪同一玩家）
 */
function updateHumanProfiles(room, roleFactions) {
  if (!room || !room.game) return;
  try {
    const voteHistory    = room.game.voteHistory    || [];
    const missionHistory = room.game.missionHistory || [];
    const assignments    = room.game.assignments    || {};

    for (const [pid, player] of (room.players || new Map())) {
      if (!player || player.isAI || player.spectator) continue;
      const nickname = player.nickname || pid;
      const hash     = `${room.code}_${nickname}`;

      // 分析该玩家的投票行为
      let totalVotes = 0, groupFollows = 0, flipCount = 0;
      let prevVote = null;
      for (const v of voteHistory) {
        if (!v.votes || !Object.prototype.hasOwnProperty.call(v.votes, pid)) continue;
        const myVote    = v.votes[pid];
        const majority  = v.approves > v.rejects;
        if (myVote === majority) groupFollows++;
        totalVotes++;
        if (prevVote !== null && myVote !== prevVote) flipCount++;
        prevVote = myVote;
      }
      if (totalVotes === 0) continue;

      const followRate = groupFollows / totalVotes;
      const flipRate   = totalVotes > 1 ? flipCount / (totalVotes - 1) : 0;

      // 分析对逻辑/情感论证的响应（简化：是否在被点名的轮次改变了投票）
      // 暂时用 followRate 作为情感响应的代理指标（跟大流 = 情感/社会压力响应）
      const logicScore   = Math.round((1 - followRate) * 10);  // 独立判断者更理性
      const emotionScore = Math.round(followRate * 10);

      const existing = db.prepare('SELECT * FROM human_profiles WHERE player_hash = ?').get(hash);
      if (existing) {
        // 指数移动平均（alpha=0.3，平滑更新避免单局偏差影响过大）
        const alpha = 0.3;
        const newFollow = existing.vote_follow_rate * (1 - alpha) + followRate * alpha;
        const newFlip   = existing.vote_flip_rate   * (1 - alpha) + flipRate   * alpha;
        db.prepare(
          `UPDATE human_profiles SET vote_follow_rate=?, vote_flip_rate=?,
           logic_responsive=?, emotion_responsive=?, games_observed=games_observed+1, updated_at=?
           WHERE player_hash=?`
        ).run(newFollow, newFlip, logicScore, emotionScore, Date.now(), hash);
      } else {
        db.prepare(
          `INSERT INTO human_profiles(player_hash, nickname, vote_follow_rate, vote_flip_rate,
           logic_responsive, emotion_responsive, games_observed, updated_at)
           VALUES(?,?,?,?,?,?,1,?)`
        ).run(hash, nickname, followRate, flipRate, logicScore, emotionScore, Date.now());
      }
    }
  } catch (e) { console.error('[Evolution] human profile update failed:', e.message); }
}

/**
 * 获取本局人类玩家的行为画像摘要，注入 AI prompt 以定向施策。
 * 返回文字描述，如"3号容易被多数人影响，4号独立判断为主"。
 */
function getHumanProfileHints(room) {
  if (!room || !room.game) return '';
  const lines = [];
  try {
    for (const [pid, player] of (room.players || new Map())) {
      if (!player || player.isAI || player.spectator) continue;
      const hash    = `${room.code}_${player.nickname}`;
      const profile = db.prepare('SELECT * FROM human_profiles WHERE player_hash = ?').get(hash);
      if (!profile || profile.games_observed < 2) continue; // 至少2局才有参考价值
      const seat = seatNo(room, pid);
      if (!seat) continue;
      const traits = [];
      if (profile.vote_follow_rate > 0.7)  traits.push('容易跟随大多数票');
      if (profile.vote_follow_rate < 0.35) traits.push('独立判断为主，不易跟风');
      if (profile.vote_flip_rate   > 0.4)  traits.push('容易在压力下改变立场');
      if (profile.emotion_responsive > 7)   traits.push('对情绪化论证有响应');
      if (profile.logic_responsive  > 7)    traits.push('偏好逻辑/数据型论证');
      // 追加来自复盘的定性分析（取最近1条）
      if (profile.notes) {
        const lastNote = profile.notes.split('\n').pop();
        if (lastNote) traits.push(lastNote);
      }
      if (traits.length) lines.push(`${seat}号：${traits.join('，')}（观察${profile.games_observed}局）`);
    }
  } catch (e) {}
  if (!lines.length) return '';
  return `【人类玩家行为画像（利用这些规律定向施策）】\n${lines.join('\n')}\n`;
}

/**
 * Layer 4：胜率自适应难度
 * 计算近 N 局各阵营的 AI 胜率，返回难度调节提示。
 * 好人AI胜率 > 65% → 提示输出时可以稍微放松策略精度
 * 坏人AI胜率 < 35% → 提示大幅提高伪装力度
 */
function getDifficultyHint(faction) {
  try {
    const recent = db.prepare(
      'SELECT winner FROM game_logs ORDER BY id DESC LIMIT 30'
    ).all();
    if (recent.length < 5) return ''; // 数据不足，不调节
    const goodWins = recent.filter(g => g.winner === 'good').length;
    const evilWins = recent.filter(g => g.winner === 'evil').length;
    const total    = recent.length;
    const goodRate = goodWins / total;
    const evilRate = evilWins / total;

    if (faction === 'good') {
      if (goodRate > 0.65) return '（当前AI好人胜率偏高，可以适当放慢节奏，给人类玩家更多推理空间，不必每轮都给出完美发言）';
      if (goodRate < 0.35) return '（当前AI好人胜率偏低，需要更主动、更精准地排查坏人，发言可以更有攻击性）';
    } else {
      if (evilRate > 0.65) return '（当前AI坏人胜率偏高，可以适当降低伪装完美度，给好人更多线索）';
      if (evilRate < 0.35) return '（当前AI坏人胜率偏低，需要大幅提高伪装力度，主动建立好人形象，减少暴露风险）';
    }
    return '';
  } catch (e) { return ''; }
}

// ─────────────────────────────────────────────────────────────────────────────
// ──  补充工具函数  ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 提取其他玩家在发言历史中的角色声明（"我是梅林/派西维尔/好人"等），
 * 用于追踪型质问（"你之前说是好人，但你赞成了失败的队伍"）。
 */
function extractClaimMap(speakHistoryAll, room, myPlayerId) {
  const claimMap = {}; // seat → 声称的角色/阵营
  const claimRe = /我(是|就是)(派西维尔|梅林|忠臣|好人|坏人|爪牙|刺客|莫甘娜|莫德雷德|奥伯伦)/;
  for (const msgs of Object.values(speakHistoryAll)) {
    for (const m of (msgs || [])) {
      if (!m || !m.text || m.playerId === myPlayerId) continue;
      const s = seatNo(room, m.playerId);
      const match = m.text.match(claimRe);
      if (match && s) claimMap[s] = match[2];
    }
  }
  return claimMap;
}

/**
 * 检测 AI 自身是否已宣称过身份，并判断当前是否适合宣称/质疑他人宣称。
 * 返回 { myClaim, shouldClaim, shouldChallenge, hint }
 */
function buildMyClaimContext(mySpeeches, role, roleFactionLocal, claimMap, currentRound, rejectedThisRound) {
  const claimRe = /我(是|就是)(派西维尔|梅林|忠臣|好人|坏人|爪牙|刺客|莫甘娜|莫德雷德|奥伯伦)/;
  let myClaim = null;
  for (const t of mySpeeches) {
    const m = t.match(claimRe);
    if (m) { myClaim = m[2]; break; }
  }

  // 角色宣称规则
  const CLAIM_RULES = {
    '梅林':    { canClaim: false, note: '梅林绝对不能暴露身份，否则被刺杀' },
    '派西维尔': { canClaim: true,  note: '可宣称"我是派西维尔"来帮梅林建立可信度，但注意莫甘娜可能反制假扮' },
    '忠臣':    { canClaim: true,  note: '可宣称忠臣争取信任，时机：队伍多次被否或好人内讧严重时' },
    '刺客':    { canClaim: true,  note: '伪装宣称忠臣或好人，越具体越可信，配合行为记录' },
    '莫甘娜':  { canClaim: true,  note: '核心战术：假扮派西维尔，让真正的派西维尔失去可信度，制造身份混乱' },
    '莫德雷德': { canClaim: true,  note: '可大胆宣称忠臣，梅林看不到你，身份相对安全' },
    '奥伯伦':  { canClaim: true,  note: '宣称忠臣，独立行动，无须和队友对齐' },
    '爪牙':    { canClaim: true,  note: '宣称忠臣配合队友叙事，保持与坏人队友口径一致' },
  };
  const rule = CLAIM_RULES[role] || { canClaim: true, note: '' };

  // 宣称时机判断
  const othersClaimedSameRole = Object.values(claimMap).includes(role === '莫甘娜' ? '派西维尔' : role);
  const claimTrigger = !myClaim && rule.canClaim && (
    currentRound >= 2 ||                        // 第2轮以后信息够了
    rejectedThisRound >= 2 ||                   // 队伍屡次被否，需要打破僵局
    Object.keys(claimMap).length > 0            // 已有人宣称，需要跟进或反制
  );

  // 质疑时机：有他人声明与事实不符时
  const challengeable = Object.entries(claimMap)
    .filter(([, r]) => r === '派西维尔' || r === '梅林')   // 高价值宣称最值得质疑
    .map(([s, r]) => `${s}号自称${r}`);
  const shouldChallenge = challengeable.length > 0 && !myClaim;

  if (!rule.canClaim) {
    return { myClaim, shouldClaim: false, shouldChallenge: false, hint: `⚠️ ${rule.note}\n` };
  }
  if (myClaim) {
    return { myClaim, shouldClaim: false, shouldChallenge, hint: `【我已宣称自己是"${myClaim}"】本次发言保持一致，不要自相矛盾。\n` };
  }
  if (claimTrigger) {
    const conflictNote = othersClaimedSameRole
      ? `注意：已有人宣称${role === '莫甘娜' ? '派西维尔' : role}，可考虑反制或质疑其可信度。`
      : '';
    return {
      myClaim: null, shouldClaim: true, shouldChallenge,
      hint: `【身份宣称时机参考】${rule.note}${conflictNote ? '；' + conflictNote : ''}\n` +
            `  → 如判断合适，可选 intent=claim_identity（明确说出"我是[角色]"并给出1-2个支撑理由）。\n` +
            (challengeable.length ? `  → 或选 intent=challenge_claim，质疑：${challengeable.join('、')}。\n` : ''),
    };
  }
  return { myClaim: null, shouldClaim: false, shouldChallenge, hint: '' };
}

/**
 * 性格时机钩子：根据当前局面和性格，返回额外的行为指令字符串。
 * 对有特殊时机性的人格（背刺有理、三号位可疑、任务失败不是我）尤其关键。
 */
function getPersonaHook(personaKey, situation, goodWins, evilWins, targetSeat) {
  switch (personaKey) {
    case '背刺有理':
      if (goodWins >= 2 || evilWins >= 2 || situation === 'evil_needs_one' || situation === 'pre_assassination') {
        return '【背刺时机已到】局势到了关键转折点。现在可以开始翻转此前维护的好人形象：找一个冠冕堂皇的理由，突然对之前保护过的人发起攻击，语气可以显得"痛心"或"不得不说"。';
      }
      return '【潜伏期】继续表现积极忠诚，积累对某个好人的"保护"行为，为后续背刺制造落差感。';
    case '三号位可疑':
      if (targetSeat) {
        return `【锁定模式】本局已锁定${targetSeat}号为主要怀疑目标。无论其他人说什么，本轮必须提到${targetSeat}号，提出至少一个让大家重新审视他的角度。不能空过一轮不提。`;
      }
      return '【搜寻目标】还没有锁定目标，本轮观察一下谁的行为最异常，下轮开始专注怀疑。';
    case '任务失败不是我':
      if (situation === 'first_failure' || situation === 'consecutive_fails') {
        return '【甩锅时机】任务刚失败，这是你的主场。立刻抢先发言，第一个拿出"证据"，条理清晰地把责任引向某个具体的人，声音要响，理由要多，让别人没有反应时间。';
      }
      return null;
    case '梅林看穿你了':
      if (evilWins >= 1 || goodWins >= 2) {
        return '【暗示升级】局势开始明朗，可以稍微加重暗示的力度，但仍然不点名——用"某些人这局表现耐人寻味"这类让对方脑补的表达。';
      }
      return null;
    case '我知道你知道':
      return targetSeat
        ? `【信息战】本轮重点盯${targetSeat}号，直接或间接地发出"我在观察你"的信号，制造心理压力，哪怕不说任何实质内容。`
        : null;
    default:
      return null;
  }
}

/**
 * 为需要"锁定目标"的性格（三号位可疑、我知道你知道）在游戏首次发言时初始化目标座位，
 * 持久存储在 room.game.aiTargets[playerId]。
 */
function initAiTarget(room, player, bs) {
  if (!room.game) return null;
  if (!room.game.aiTargets) room.game.aiTargets = {};
  if (room.game.aiTargets[player.id]) return room.game.aiTargets[player.id];

  const mySeat = seatNo(room, player.id);
  const persona = player.aiPersonaKey;
  if (persona !== '三号位可疑' && persona !== '我知道你知道') return null;

  // 排除自己和已知队友，优先选嫌疑分中等偏高的座位（制造悬念）
  const candidates = Object.entries(bs.suspicion)
    .filter(([s, v]) => Number(s) !== mySeat && !bs.knownAllies.includes(Number(s)) && v > 0.2 && v < 0.95)
    .sort(([, a], [, b]) => b - a)
    .map(([s]) => Number(s));

  if (!candidates.length) return null;
  // 不取最高嫌疑，取2~4名，避免每局都锁同一个最高嫌疑者，保持变化感
  const pool = candidates.slice(0, Math.min(4, candidates.length));
  const target = pool[Math.floor(Math.random() * pool.length)];
  room.game.aiTargets[player.id] = target;
  return target;
}

/**
 * 在 computeBeliefState 的基础上追加语言行为信号：
 * 谁为高嫌疑玩家辩护 → 辩护者嫌疑微升（可能是队友）。
 */
function applyLanguageSignals(sus, evi, speakHistoryAll, room, mySeat) {
  const defendRe = /(\d+)号.{0,10}(没问题|不是坏人|可以信任|我保|他是好人|不可能是坏人)/;
  for (const msgs of Object.values(speakHistoryAll)) {
    for (const m of (msgs || [])) {
      if (!m || !m.text) continue;
      const speaker = seatNo(room, m.playerId);
      if (!speaker || speaker === mySeat) continue;
      if ((sus[speaker] || 0) >= 0.9) continue; // 已确认坏人，跳过

      const match = m.text.match(defendRe);
      if (match) {
        const defended = Number(match[1]);
        if (defended !== mySeat && (sus[defended] || 0) > 0.55 && defended in sus) {
          sus[speaker] = Math.min(0.82, (sus[speaker] || 0.3) + 0.06);
          evi[speaker] = [...(evi[speaker] || []), `为高嫌疑${defended}号辩护`];
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function formatAiRecapMemory(room, player, role, recap) {
  const review = recap && recap.review ? recap.review : {};
  const lines = [
    `winner=${room && room.game ? room.game.winner || 'unknown' : 'unknown'}`,
    `role=${role || ''}`,
    `overview=${review.overview || ''}`,
    `speak=${review.speak && review.speak.adjustment ? review.speak.adjustment : ''}`,
    `team=${review.team && review.team.adjustment ? review.team.adjustment : ''}`,
    `vote=${review.vote && review.vote.adjustment ? review.vote.adjustment : ''}`,
    `mission=${review.mission && review.mission.adjustment ? review.mission.adjustment : ''}`,
    `assassination=${review.assassination && review.assassination.adjustment ? review.assassination.adjustment : ''}`,
    `next=${review.nextGamePlan || ''}`,
  ];
  return `post_recap; ai=${player.aiPersonaId || player.nickname}; ${lines.filter(Boolean).join('; ')}`;
}

function recordAiRecapMemory(room, player, role, recap) {
  try {
    const review = recap && recap.review ? recap.review : null;
    if (!review) return;
    if (!review.overview && !review.nextGamePlan) return;
    const aiId = player.aiPersonaId || player.nickname;
    const summary = formatAiRecapMemory(room, player, role, recap);
    db.prepare('INSERT INTO ai_memory(ai_name, summary, created_at) VALUES(?,?,?)').run(aiId, summary, Date.now());
  } catch (e) {}
}

/**
 * 把复盘 CoT 推理 + 关键节点 + 下局计划存入持久记忆，供后续对局检索。
 * 三类数据分别存入不同位置：
 *   think        → ai_memory（个人推理历史，原文保留）
 *   keyMoments   → strategy_patterns（按角色+局面标签，自动参与 getRelevantPatterns 检索）
 *   nextGamePlan → strategy_patterns（confidence=2，优先级高于 extractStrategyPatterns 提取的普通规律）
 */
async function storeRecapInsights(room, player, role, recap, roleFactions) {
  if (!recap) return;
  const review      = recap.review || {};
  const think       = recap.think  || '';
  const faction     = roleFactions[role] || 'good';
  const winner      = (room.game || {}).winner || '';
  const won         = faction === winner;
  const playerCount = (room.seats || []).length;
  const situation   = classifySituation(room, player.id);
  const aiId        = player.aiPersonaId || player.nickname;

  try {
    // ── 1. think 推理链 → ai_memory（原文，最多保留最近 20 条/AI）──────────────
    if (think.length > 30) {
      const tag = `[复盘推理|${role}|${won ? '胜' : '败'}|${situation}]`;
      db.prepare('INSERT INTO ai_memory(ai_name,summary,created_at) VALUES(?,?,?)')
        .run(aiId, `${tag} ${think}`.slice(0, 1200), Date.now());
      db.prepare(
        `DELETE FROM ai_memory WHERE ai_name=? AND summary LIKE '[复盘推理|%' AND id NOT IN (
          SELECT id FROM ai_memory WHERE ai_name=? AND summary LIKE '[复盘推理|%'
          ORDER BY id DESC LIMIT 20
        )`
      ).run(aiId, aiId);
    }

    // ── 2. keyMoments 每条教训 → strategy_patterns ────────────────────────────
    if (Array.isArray(review.keyMoments)) {
      for (const km of review.keyMoments) {
        if (!km.assessment || km.assessment.length < 15) continue;
        const pattern = `[第${km.round}轮教训] ${km.decision}→${km.outcome}：${km.assessment}`;
        db.prepare(
          `INSERT INTO strategy_patterns(role,faction,situation_type,player_count,pattern,outcome,confidence,created_at)
           VALUES(?,?,?,?,?,?,1,?)`
        ).run(role, faction, situation, playerCount, pattern, won ? 'win' : 'loss', Date.now());
      }
    }

    // ── 3. nextGamePlan → strategy_patterns（confidence=2，高优先级）─────────
    if (review.nextGamePlan && review.nextGamePlan.length > 20) {
      db.prepare(
        `INSERT INTO strategy_patterns(role,faction,situation_type,player_count,pattern,outcome,confidence,created_at)
         VALUES(?,?,?,?,?,?,2,?)`
      ).run(role, faction, situation, playerCount,
        `[下局计划] ${review.nextGamePlan}`, won ? 'win' : 'loss', Date.now());
    }

    // ── 4. speak.bestMove → good_speeches（复盘认定的最佳发言，直接评5分存入）──
    // 这是 AI 自我评价中最有价值的信息：它知道哪句话最有效
    const bestMove = review.speak && review.speak.bestMove;
    if (bestMove && typeof bestMove === 'string' && bestMove.length > 15) {
      // 提取引号内的原始发言文本
      const quoteMatch = bestMove.match(/["「『]([^"」』]{15,}?)["」』]/);
      const bestText = quoteMatch ? quoteMatch[1] : bestMove.slice(0, 120);
      storeSpeech(faction, role, 'recap_best', bestText, 5,
        `复盘认定最佳发言，${won ? '本局获胜' : '本局失败'}`,
        situation, playerCount, aiId);
    }

    // ── 5. speak.mistake → strategy_patterns（avoid 类型，记录应规避的行为）──
    // 失误模式与胜负无关，都值得记录；confidence 初始为1，靠反馈环决定去留
    const mistake = review.speak && review.speak.mistake;
    if (mistake && typeof mistake === 'string' && mistake.length > 20) {
      db.prepare(
        `INSERT INTO strategy_patterns(role,faction,situation_type,player_count,pattern,outcome,confidence,created_at)
         VALUES(?,?,?,?,?,?,1,?)`
      ).run(role, faction, situation, playerCount,
        `[发言禁忌] ${mistake}`, won ? 'win' : 'loss', Date.now());
    }

    // ── 6. playerAnalysis → human_profiles（AI对人类玩家的读人判断）────────────
    // 把复盘中 AI 对每个座位的分析转换为行为倾向更新
    if (Array.isArray(review.playerAnalysis)) {
      for (const pa of review.playerAnalysis) {
        if (!pa || !pa.seat || !pa.assessment) continue;
        // 找到该座位对应的非AI玩家
        const targetId = room.seats[Number(pa.seat) - 1];
        if (!targetId) continue;
        const targetPlayer = room.players && room.players.get ? room.players.get(targetId) : null;
        if (!targetPlayer || targetPlayer.isAI) continue;

        const hash = `${room.code}_${targetPlayer.nickname}`;
        const assessment = pa.assessment;

        // 从自然语言分析中提取倾向信号（简单关键词匹配）
        const notes_additions = [];
        if (/跟风|随大流|没有自己|盲目/.test(assessment))   notes_additions.push('跟风倾向');
        if (/独立|不跟风|坚持自己|独断/.test(assessment))   notes_additions.push('独立判断');
        if (/情绪|感性|冲动|带节奏/.test(assessment))        notes_additions.push('情绪响应');
        if (/理性|逻辑|数据|分析/.test(assessment))          notes_additions.push('逻辑响应');
        if (/善变|改变|反转|摇摆/.test(assessment))          notes_additions.push('立场不稳');
        if (/固执|坚持|不改|死磕/.test(assessment))          notes_additions.push('立场坚定');

        if (notes_additions.length === 0) continue;
        const noteEntry = `[${role}局复盘] ${notes_additions.join('、')}`;

        try {
          const existing = db.prepare('SELECT id, notes FROM human_profiles WHERE player_hash=?').get(hash);
          if (existing) {
            // 追加观察记录（保留最近5条）
            const prevNotes = existing.notes ? existing.notes.split('\n') : [];
            const newNotes = [...prevNotes, noteEntry].slice(-5).join('\n');
            db.prepare('UPDATE human_profiles SET notes=?, updated_at=? WHERE id=?')
              .run(newNotes, Date.now(), existing.id);
          } else {
            db.prepare(
              `INSERT INTO human_profiles(player_hash, nickname, vote_follow_rate, vote_flip_rate,
               logic_responsive, emotion_responsive, games_observed, notes, updated_at)
               VALUES(?,?,0.5,0.1,5,5,0,?,?)`
            ).run(hash, targetPlayer.nickname, noteEntry, Date.now());
          }
        } catch (e) { /* best-effort */ }
      }
    }

    // 清理 strategy_patterns 超限条目（每角色最多150条）
    db.prepare(
      `DELETE FROM strategy_patterns WHERE role=? AND id NOT IN (
        SELECT id FROM strategy_patterns WHERE role=? ORDER BY confidence DESC, created_at DESC LIMIT 150
      )`
    ).run(role, role);

  } catch (e) {}
}

/**
 * 检索该 AI 在同角色下的历史复盘推理，注入到下局 prompt 作为"上次的反思"
 */
function getRecapInsights(aiId, role, limit = 1) {
  try {
    return db.prepare(
      `SELECT summary FROM ai_memory
       WHERE ai_name=? AND summary LIKE ?
       ORDER BY id DESC LIMIT ?`
    ).all(aiId, `[复盘推理|${role}|%`, limit).map(r => {
      // 去掉 tag 前缀，只保留推理内容
      return r.summary.replace(/^\[复盘推理\|[^\]]+\]\s*/, '');
    });
  } catch (e) { return []; }
}

/**
 * 检索该 AI 最近一条行为日记，注入到发言 prompt 作为"上局我学到了什么"
 */
function getLatestJournal(aiId, role) {
  try {
    // 优先同角色日记，再取任意角色最新日记
    const row = db.prepare(
      `SELECT summary FROM ai_memory WHERE ai_name=? AND summary LIKE '[日记|${role}|%' ORDER BY id DESC LIMIT 1`
    ).get(aiId) || db.prepare(
      `SELECT summary FROM ai_memory WHERE ai_name=? AND summary LIKE '[日记|%' ORDER BY id DESC LIMIT 1`
    ).get(aiId);
    if (!row) return '';
    const text = row.summary.replace(/^\[日记\|[^\]]+\]\s*/, '');
    return `【我的上局行为反思（按此调整本局策略）】${text}\n`;
  } catch (e) { return ''; }
}

function roleInfo(room, playerId, role, roleFactions) {
  const info = { role, seats: [] };
  if (role === '派西维尔') {
    const seats = [];
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      if (r === '梅林' || r === '莫甘娜') seats.push(seatNo(room, id));
    }
    info.seats = seats.filter(Boolean);
  } else if (role === '梅林') {
    const seats = [];
    for (const id of Object.keys(room.game.assignments)) {
      const r = room.game.assignments[id];
      if (roleFactions[r] === 'evil' && r !== '莫德雷德') seats.push(seatNo(room, id));
    }
    info.seats = seats.filter(Boolean);
  } else if (roleFactions[role] === 'evil') {
    if (role === '奥伯伦') {
      info.seats = [];
    } else {
      const seats = [];
      for (const id of Object.keys(room.game.assignments)) {
        const r = room.game.assignments[id];
        if (roleFactions[r] === 'evil' && r !== '奥伯伦' && id !== playerId) seats.push(seatNo(room, id));
      }
      info.seats = seats.filter(Boolean);
    }
  }
  return info;
}

function publicState(room) {
  const currentRound = room.game.round;
  const currentAttempt = room.game.attempt;

  // 改动1：跨轮发言历史，最多取最近3轮，每轮最多10条，格式 "R{round}-{attempt}|发言人:内容"
  const recentSpeaks = [];
  if (room.game.speakHistory) {
    // 收集所有已知的 key，按轮次/attempt 排序后取最近3个
    const keys = Object.keys(room.game.speakHistory).sort((a, b) => {
      const [ar, aa] = a.split('-').map(Number);
      const [br, ba] = b.split('-').map(Number);
      return ar !== br ? ar - br : aa - ba;
    });
    const recentKeys = keys.slice(-3);
    for (const key of recentKeys) {
      const msgs = room.game.speakHistory[key] || [];
      for (const m of msgs.slice(-10)) {
        recentSpeaks.push(`R${key}|${m.from}:${m.text}`);
      }
    }
  }

  const trustMap = {};
  if (room.game.trust) {
    for (const id of Object.keys(room.game.trust)) {
      trustMap[seatNo(room, id)] = room.game.trust[id];
    }
  }

  return {
    round: room.game.round,
    leaderSeat: seatNo(room, room.game.leaderId),
    teamSeats: room.game.team.map((id) => seatNo(room, id)).filter(Boolean),
    // 改动2：voteHistory 加上 votesBySeat，格式 { [seatNo]: true/false }
    voteHistory: room.game.voteHistory.map((v) => ({
      round: v.round,
      approved: v.approved,
      approves: v.approves,
      rejects: v.rejects,
      teamSeats: v.team.map((id) => seatNo(room, id)).filter(Boolean),
      votesBySeat: (() => {
        const bySeat = {};
        if (v.votes) {
          for (const [playerId, voted] of Object.entries(v.votes)) {
            const seat = seatNo(room, playerId);
            if (seat) bySeat[seat] = voted;
          }
        }
        return bySeat;
      })(),
    })),
    missionHistory: room.game.missionHistory.map((m) => ({
      round: m.round,
      success: m.success,
      fails: m.fails,
      teamSeats: m.team.map((id) => (m.seatSnapshot || {})[id] || seatNo(room, id)).filter(Boolean),
    })),
    recentSpeaks,
    trustMap,
    // 改动3：主张追踪，聚合所有轮次的 claims，以座位号为 key
    claims: (() => {
      const result = {};
      const allClaims = room.game.claims || {};
      for (const [key, roundClaims] of Object.entries(allClaims)) {
        for (const [playerId, claim] of Object.entries(roundClaims)) {
          const seat = seatNo(room, playerId);
          if (seat) result[seat] = claim; // 'good'/'bad'/自定义
        }
      }
      return result;
    })(),
  };
}

async function callLLM(system, user, temperature = 0.7) {
  if (!API_KEY) throw new Error('NO_API_KEY');
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.choices) {
    console.error(`[LLM] HTTP ${res.status} err:`, JSON.stringify(data).slice(0, 200));
    throw new Error(`LLM_ERROR_${res.status}`);
  }
  const content = data.choices[0]?.message?.content || '';
  console.log(`[LLM] ${res.status} ${Date.now() - t0}ms len=${content.length}`);
  return content;
}

function parseJSON(text, fallback) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}

// 把游戏状态转为人类可读叙事，避免让 LLM 解析原始 JSON
function buildGameNarrative(room, mySeat, role, roleFactions, info) {
  const lines = [];
  const game = room.game;
  const voteHistory = game.voteHistory || [];
  const missionHistory = game.missionHistory || [];
  const speakHistory = game.speakHistory || {};

  // 没有任何历史数据时，明确告知 AI 禁止编造
  if (!missionHistory.length && !voteHistory.length) {
    lines.push('⚠️ 当前是第一轮，游戏尚无任务记录也无投票记录。禁止捏造任何具体座位号、投票行为或任务结果，只能谈观察方向或判断框架。');
  }

  // 任务结果
  if (missionHistory.length) {
    const parts = missionHistory.map(m =>
      `第${m.round}轮[${m.team.map(id => seatNo(room, id)).filter(Boolean).join('、')}号]→${m.success ? '✓成功' : `✗失败(${m.fails}票失败)`}`
    );
    lines.push('任务：' + parts.join('；'));
  }

  // 投票记录（只记录关键信息：反对票、否决）
  if (voteHistory.length) {
    for (const v of voteHistory) {
      const teamStr = v.team.map(id => seatNo(room, id)).filter(Boolean).join('、');
      const noes = v.votes ? Object.entries(v.votes).filter(([, ok]) => !ok).map(([id]) => `${seatNo(room, id)}号`).join(' ') : '';
      const result = v.approved ? '通过' : '否决';
      lines.push(`第${v.round}轮组队[${teamStr}号] ${result}(${v.approves}赞/${v.rejects}反)${noes ? '，反对：' + noes : ''}`);
    }
  }

  // 根据失败任务标记嫌疑座位
  const suspectSeats = new Set();
  for (const m of missionHistory) {
    if (!m.success) m.team.forEach(id => { const s = seatNo(room, id); if (s && s !== mySeat) suspectSeats.add(s); });
  }
  if (suspectSeats.size) lines.push(`失败任务涉及座位：${[...suspectSeats].join('、')}号（其中有坏人出了失败票）`);

  // 近期发言（解析为可读格式）
  const keys = Object.keys(speakHistory).sort((a, b) => {
    const [ar, aa] = a.split('-').map(Number);
    const [br, ba] = b.split('-').map(Number);
    return ar !== br ? ar - br : aa - ba;
  });
  const recentKeys = keys.slice(-2);
  const recentLines = [];
  for (const key of recentKeys) {
    for (const m of (speakHistory[key] || []).slice(-8)) {
      if (!m || !m.text) continue;
      const s = seatNo(room, m.playerId);
      if (s) recentLines.push(`${s}号："${m.text}"`);
    }
  }
  if (recentLines.length) lines.push('近期发言：\n' + recentLines.join('\n'));

  // 已知信息（角色视野）
  if (role === '梅林' && info.seats.length) {
    lines.push(`【梅林视野】确认坏人：${info.seats.join('、')}号`);
  } else if (role === '派西维尔' && info.seats.length) {
    lines.push(`【派西维尔视野】拇指位（梅林或莫甘娜之一）：${info.seats.join('、')}号`);
  } else if (roleFactions[role] === 'evil' && role !== '奥伯伦' && info.seats.length) {
    lines.push(`【坏人视野】队友：${info.seats.join('、')}号`);
  }

  return lines.join('\n');
}

async function decideSpeak({ room, player, role, roleFactions }) {
  const info          = roleInfo(room, player.id, role, roleFactions);
  const mySeat        = seatNo(room, player.id);
  if (!mySeat) return '';

  const speakHistoryAll  = room.game.speakHistory || {};
  const rolesInGame      = Array.from(new Set(room.roles || []));
  const roleFactionLocal = roleFactions[role] || 'good';
  const currentRound     = room.game.round || 1;
  const playerCount      = (room.seats || []).length;

  // ── 1. 局面分类 + 信念状态 + 情绪寄存器 ──
  const situation  = classifySituation(room, player.id);
  const bs         = computeBeliefState(room, player.id, role, roleFactions);
  const emotion    = computeEmotionalRegister(room, player.id, role, roleFactions);
  const bsText     = formatBeliefStateForPrompt(bs, mySeat);

  // ── 2. 我的历史发言（禁止重复） ──
  const myPreviousSpeeches = [];
  for (const arr of Object.values(speakHistoryAll)) {
    for (const m of (arr || [])) {
      if (m && m.playerId === player.id && m.text) myPreviousSpeeches.push(m.text);
    }
  }

  // ── 3. 被指控检测 ──
  const accusationPattern = new RegExp(`${mySeat}号`);
  const recentLines = [];
  const sortedKeys = Object.keys(speakHistoryAll).sort((a, b) => {
    const [ar, aa] = a.split('-').map(Number);
    const [br, ba] = b.split('-').map(Number);
    return ar !== br ? ar - br : aa - ba;
  });
  for (const key of sortedKeys.slice(-2)) {
    for (const m of (speakHistoryAll[key] || []).slice(-10)) {
      if (m && m.text) recentLines.push(m.text);
    }
  }
  const accusedTexts = recentLines.filter(s =>
    accusationPattern.test(s) && /怀疑|坏人|问题|排水|出局|反对|不信/.test(s)
  );
  const accused = accusedTexts.length > 0 ? accusedTexts.slice(-2).join('；') : null;

  // ── 3b. 其他玩家角色声明提取 + 自身宣称决策 ──
  const claimMap = extractClaimMap(speakHistoryAll, room, player.id);
  const claimHint = Object.keys(claimMap).length
    ? `【其他玩家的角色声明（真实性待验证）】${Object.entries(claimMap).map(([s,r]) => `${s}号自称${r}`).join('，')}\n可以基于这些声明和实际任务/投票记录进行追踪质问。\n`
    : '';
  // 计算本任务轮被否决次数（用于判断宣称时机）
  const rejectedThisRound = (room.game.voteHistory || []).filter(v => v.round === currentRound && !v.approved).length;
  const myClaimCtx = buildMyClaimContext(myPreviousSpeeches, role, roleFactionLocal, claimMap, currentRound, rejectedThisRound);

  // ── 3c. 性格锁定目标（三号位可疑 / 我知道你知道）──
  const aiTarget = initAiTarget(room, player, bs);

  // ── 3d. 性格时机钩子 ──
  const missions = (room.game && room.game.missionHistory) || [];
  const goodWins = missions.filter(m => m.success).length;
  const evilWins = missions.filter(m => !m.success).length;
  const personaHook = getPersonaHook(player.aiPersonaKey, situation, goodWins, evilWins, aiTarget);
  const personaHookHint = personaHook ? `【性格行动指令】${personaHook}\n` : '';

  // ── 4. 坏人队友近期发言 ──
  let allySpeeches = [];
  if (roleFactionLocal === 'evil') {
    const assignments = room.game.assignments || {};
    for (const [pid, r] of Object.entries(assignments)) {
      if (pid === player.id || (roleFactions[r] || 'good') !== 'evil' || r === '奥伯伦') continue;
      const allyTalks = [];
      for (const arr of Object.values(speakHistoryAll)) {
        for (const m of (arr || [])) {
          if (m && m.playerId === pid && m.text) allyTalks.push(m.text);
        }
      }
      allyTalks.slice(-2).forEach(t =>
        allySpeeches.push(`${seatNo(room, pid)}号队友说："${t}"`)
      );
    }
  }

  // ── 5. 发言多样性（自身 + 房间级别跨AI去重） ──
  const forbiddenIntents = getForbiddenIntents(room, player.id);
  const recentRoomSpeeches = getRecentRoomSpeeches(room, player.id, 4);

  // ── 6. 历史经验检索 + 上局复盘推理记忆 + 进化系统数据 ──
  const patternBlock   = getRelevantPatterns(role, roleFactionLocal, situation, playerCount);
  const recapInsights  = getRecapInsights(player.aiPersonaId || player.nickname, role, 1);
  const metaLessons    = getMetaLessons(roleFactionLocal, 2);
  const humanHint      = getHumanProfileHints(room);
  const difficultyHint = getDifficultyHint(roleFactionLocal);

  // ── 7. Few-shot 示例（优先检索同 persona 的历史高分发言）──
  const fewShotBlock = buildFewShotBlock(roleFactionLocal, currentRound, accused, allySpeeches.length ? allySpeeches : null, player.aiPersonaId || null);

  // ── 8. 角色策略 ──
  const hasGameData = (room.game.voteHistory || []).length > 0 || (room.game.missionHistory || []).length > 0;
  const roleStrategy = {
    '梅林':   '你知道坏人是谁，绝不直说。用任务失败涉及人员或投票异常间接暗示，保护自己。',
    '派西维尔': '你看到两个拇指位（梅林或莫甘娜），保护梅林，不轻易透露你知道谁是梅林。',
    '忠臣':   '靠推理和观察锁定可疑目标。有任务/投票记录时分析矛盾行为；没有记录时谈判断标准或观察谁的行为异常。',
    '刺客':   '伪装好人。留心谁发言最有深度信息量——那很可能是梅林，记在心里。',
    '莫甘娜': '让派西维尔认为你可能是梅林。模仿梅林风格但不要太刻意。',
    '莫德雷德': '梅林看不到你，可以大胆建立好人形象，强推队伍建立信任。',
    '奥伯伦': '你不知道队友，靠自己判断，偷偷让任务失败。',
    '爪牙':   '配合坏人队友，保护核心坏人，制造混乱转移好人视线。',
  };
  const strategyHint = roleStrategy[role] || '用逻辑推理分析局面，有数据时用数据，没有数据时谈判断框架。';

  // ── 9. 构建 system prompt ──
  const forbidStarters = '禁止以下开头：我觉得、我认为、我注意到、大家、说实话、作为、首先、其次、总的来说、从逻辑上。';
  const forbidQuestions = '不要连续使用2个以上反问句，不以疑问句结尾。';
  const forbidIntentStr = forbiddenIntents.length
    ? `本次禁止使用以下发言意图（最近已重复）：${forbiddenIntents.join('、')}。` : '';

  // 本轮已有玩家覆盖的论点摘要，引导 AI 呼应或补充而非被迫回避
  const roomSpeechHint = recentRoomSpeeches.length
    ? `【本轮其他玩家已说】\n${recentRoomSpeeches.map(e => `${e.seat}号(${e.intent})："${e.text}"`).join('\n')}\n可以回应上面某人的观点（赞成/反驳/补充），也可以针对尚未被讨论的人或信息，但不要逐字复述别人的话。\n`
    : '';

  const systemBase =
    `你是阿瓦隆桌游真人玩家，角色：${role}（${roleFactionLocal === 'good' ? '好人' : '坏人'}阵营），座位：${mySeat}号。\n` +
    `策略方向：${strategyHint}${difficultyHint}\n` +
    `说话风格：${buildPersonaDesc(player)}\n` +
    `当前情绪状态：${emotion.hint}\n` +
    personaHookHint +
    // ── 进化系统注入（元学习 > 人类画像 > 个人日记 > 局面模式）──
    (metaLessons.length ? `【多局元学习结论（最高优先级）】${metaLessons.join('；')}\n` : '') +
    humanHint +
    claimHint +
    (myClaimCtx.hint ? myClaimCtx.hint : '') +
    (myPreviousSpeeches.length
      ? `【我说过的话——禁止重复相同观点或相同目标】${myPreviousSpeeches.slice(-3).map((t, i) => `(${i + 1})${t}`).join('；')}\n`
      : '') +
    roomSpeechHint +
    (accused ? `【被指控】有人刚才怀疑我：${accused}。必须回应。\n` : '') +
    (allySpeeches.length ? `【坏人队友说法（保持叙事一致但不要重复他的话）】${allySpeeches.join('；')}\n` : '') +
    (recapInsights.length ? `【我上局作为${role}的复盘推理（参考，不要照抄）】\n${recapInsights[0]}\n` : '') +
    getLatestJournal(player.aiPersonaId || player.nickname, role) +
    (patternBlock ? patternBlock + '\n' : '') +
    (fewShotBlock ? fewShotBlock + '\n' : '');

  // ── 10. 构建 user prompt（叙事 + 嫌疑评估） ──
  const narrative = buildGameNarrative(room, mySeat, role, roleFactions, info);
  const userBase =
    `【第${currentRound}轮，轮到你(${mySeat}号)发言】\n\n` +
    `${bsText}\n\n` +
    `游戏局面：\n${narrative}\n\n` +
    `本局角色配置：${rolesInGame.join('、')}\n`;

  // ── 11. 两阶段生成：第一阶段低温推理（think+intent），第二阶段高温发言（text）──
  // 第一阶段：推理方向，temperature 低避免幻觉捏造游戏数据
  const system1 =
    systemBase +
    `发言规则：只输出推理和意图，不生成发言正文。${forbidIntentStr}\n` +
    '输出严格JSON，不含其他内容。';
  const user1 =
    userBase +
    '输出JSON（think不超过100字，禁止在think里编造任何不在游戏局面里的座位行为或投票结果）：\n' +
    '{"think":"本轮发言方向和目标...","intent":"accusation|defense|redirect|claim_identity|challenge_claim|probe|support|neutral","target":目标座位号或省略}';

  let thinkObj = { think: '', intent: 'neutral', target: null };
  try {
    const res1    = await callLLM(system1, user1, 0.65);
    const clean1  = res1.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    thinkObj      = parseJSON(clean1, thinkObj);
  } catch (e) {
    console.error('[AI] decideSpeak phase1 failed:', e.message);
  }

  // 第二阶段：基于已确定的 think+intent 生成发言正文，temperature 较高保留语言多样性
  // 意图 → 语气指令（叠加在 persona 风格之上，让内容和语气匹配）
  const INTENT_TONE = {
    accusation:      '语气：确定、有锋芒，不是在猜测而是在陈述判断。可以带一点压迫感，但要有具体依据撑住，不能只靠气势。',
    defense:         '语气：沉着但有点急迫，听得出想澄清但没有慌乱。逻辑要清晰，语速感觉稍快，句子不用太长。',
    redirect:        '语气：转折感要明显，话头一带就走，让人跟上你的节奏。不是在回避，是在换角度进攻。',
    probe:           '语气：好奇或暗含讽刺，问句要有压力，不是真的在问答案，是让对方暴露。',
    support:         '语气：认同但不谄媚，简洁地顺水推舟，可以补充一个细节或角度让论点更厚实。',
    claim_identity:  '语气：直接、确定，说"我是X"就是陈述事实，给出理由时平静有力，不要解释过度。',
    challenge_claim: '语气：质疑带压力，点名某人，给出矛盾点，语气可以稍强硬，逼对方回应。',
    neutral:         '语气：观察者视角，平静但不冷漠，像在做笔记，可以带一点若有所思的停顿感。',
  };
  const intentToneHint = INTENT_TONE[thinkObj.intent] || INTENT_TONE.neutral;

  const system2 =
    systemBase +
    `【本次发言语气要求】${intentToneHint}\n` +
    `发言规则：80-150字，像真实玩家说话，有逻辑有细节，语气与内容匹配，不能写成报告或清单，不能暴露身份。${forbidStarters}${forbidQuestions}\n` +
    '输出严格JSON，不含其他内容。';
  const intentLabel = { accusation:'指控', defense:'辩护', redirect:'转移', claim_identity:'宣称身份', challenge_claim:'质疑宣称', claim:'声明', probe:'追问', support:'支持', neutral:'观察' };
  const user2 =
    userBase +
    `【本轮推理已确定】\n思路：${thinkObj.think || '综合当前局面作出判断'}\n意图：${thinkObj.intent || 'neutral'}（${intentLabel[thinkObj.intent] || ''}）${thinkObj.target ? `，针对${thinkObj.target}号` : ''}\n\n` +
    '基于以上思路，生成符合你风格的发言正文（严格80-150字，禁止捏造不存在的游戏数据）。\n' +
    '输出JSON：{"text":"发言内容"}';

  const res2    = await callLLM(system2, user2, 0.88);
  const clean2  = res2.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const obj2    = parseJSON(clean2, { text: '' });

  // 合并：text 来自第二阶段，intent/target 来自第一阶段
  const obj  = { ...thinkObj, text: obj2.text || '' };
  const text = dedupSentences(sanitizeSpeech(obj.text || '', rolesInGame));

  // 记录本次发言意图（供下次多样性检测）
  if (text) {
    recordSpeechIntent(room, player.id, obj.intent || 'neutral');
    // 记录到房间级别，让后续发言的AI知道此论点已被覆盖
    recordRoomSpeech(room, mySeat, text, obj.intent || 'neutral', obj.target || null);
  }

  return hasExplicitIdentityReveal(text, role, roleFactionLocal) ? '' : text;
}

async function decideTeam({ room, leaderId, role, roleFactions, teamSize }) {
  const leader          = room.players.get(leaderId);
  const info            = roleInfo(room, leaderId, role, roleFactions);
  const bs              = computeBeliefState(room, leaderId, role, roleFactions);
  const bsText          = formatBeliefStateForPrompt(bs, seatNo(room, leaderId));
  const situation       = classifySituation(room, leaderId);
  const faction         = roleFactions[role] || 'good';
  const resolvedSize    = teamSize || (room.game.team ? room.game.team.length : 0);
  const mySeat          = seatNo(room, leaderId);
  const missions        = (room.game && room.game.missionHistory) || [];
  const patternBlock    = getRelevantPatterns(role, faction, situation, (room.seats || []).length);

  // 博弈提示：好人/坏人组队策略差异
  const goodWins  = missions.filter(m => m.success).length;
  const evilWins  = missions.filter(m => !m.success).length;
  let gameTheoryHint = '';
  if (faction === 'good') {
    gameTheoryHint = `好人组队：避开嫌疑分高的座位，优先选嫌疑分低的可信玩家。当前最可疑：${bs.topSuspects.join('、')}号。`;
  } else {
    const evilSeats = info.seats.filter(s => s !== mySeat);
    const needFail  = resolvedSize >= 4 ? 2 : 1; // 大队伍需要2票失败
    gameTheoryHint = `坏人组队：本轮任务需要${needFail}票失败。${evilSeats.length > 0
      ? `队友(${evilSeats.join('、')}号)可带${Math.min(evilSeats.length, needFail)}人，其余用好人补位以帮助过票。`
      : '只有自己是坏人，慎重考虑是否本轮出失败票。'}若队伍明显可疑则难以过票，权衡利弊。`;
  }

  const narrative = buildGameNarrative(room, mySeat, role, roleFactions, info);
  const system =
    `你是阿瓦隆队长，角色：${role}（${faction === 'good' ? '好人' : '坏人'}阵营），座位：${mySeat}号。\n` +
    `组队规则：需选${resolvedSize}人（含自己或不含均可）。${gameTheoryHint}\n` +
    (patternBlock ? patternBlock + '\n' : '') +
    `风格：${buildPersonaDesc(leader)}输出严格JSON，teamSeats为座位号整数数组。`;

  const user =
    `${bsText}\n\n` +
    `游戏局面：\n${narrative}\n\n` +
    `好人已赢${goodWins}局，坏人已赢${evilWins}局。连续否决次数：${room.game.rejectsInRow || 0}。\n` +
    `请选出${resolvedSize}人的队伍（座位号），同时给出简要理由。\n` +
    `输出JSON：{"teamSeats":[座位号数组],"reason":"简要说明"}`;

  const res = await callLLM(system, user, 0.6);
  const cleaned = res.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const obj = parseJSON(cleaned, { teamSeats: [] });
  return Array.isArray(obj.teamSeats) ? obj.teamSeats : [];
}

async function decideVote({ room, playerId, role, roleFactions }) {
  const player      = room.players.get(playerId);
  const info        = roleInfo(room, playerId, role, roleFactions);
  const bs          = computeBeliefState(room, playerId, role, roleFactions);
  const bsText      = formatBeliefStateForPrompt(bs, seatNo(room, playerId));
  const faction     = roleFactions[role] || 'good';
  const mySeat      = seatNo(room, playerId);
  const teamSeats   = (room.game.team || []).map(id => seatNo(room, id)).filter(Boolean);
  const rejectsInRow = room.game.rejectsInRow || 0;
  const missions    = (room.game && room.game.missionHistory) || [];
  const goodWins    = missions.filter(m => m.success).length;
  const evilWins    = missions.filter(m => !m.success).length;

  // 计算当前队伍的嫌疑分合计（供决策参考）
  const teamSuspicion = teamSeats.map(s => ({
    seat: s, score: bs.suspicion[s] || 0.3,
    ev: (bs.evidence[s] || []).slice(-1).join('')
  }));
  const avgTeamSuspicion = teamSuspicion.length
    ? teamSuspicion.reduce((a, b) => a + b.score, 0) / teamSuspicion.length : 0.3;

  // 博弈论提示
  let gameTheoryHint = '';
  if (faction === 'good') {
    if (rejectsInRow >= 4) gameTheoryHint = '已连续否决4次，再否决坏人直接获胜，必须通过。';
    else if (avgTeamSuspicion > 0.6) gameTheoryHint = `队伍平均嫌疑分${Math.round(avgTeamSuspicion*100)}%，偏高，好人应考虑否决。`;
    else if (avgTeamSuspicion < 0.35) gameTheoryHint = `队伍嫌疑分较低，好人可以通过。`;
  } else {
    const evilInTeam = teamSeats.filter(s => (bs.knownAllies || []).includes(s) || s === mySeat);
    if (evilInTeam.length > 0) gameTheoryHint = `队伍中有坏人(${evilInTeam.join('、')}号)，通常应投通过以让任务进行。`;
    else gameTheoryHint = `队伍中没有坏人，可考虑策略性否决，但${rejectsInRow >= 3 ? '连续否决已多，风险较大' : '权衡暴露风险'}。`;
  }

  const situation    = classifySituation(room, playerId);
  const patternBlock = getRelevantPatterns(role, faction, situation, (room.seats || []).length);
  const narrative    = buildGameNarrative(room, mySeat, role, roleFactions, info);

  const system =
    `你是阿瓦隆${role}（${faction === 'good' ? '好人' : '坏人'}阵营，${mySeat}号座位）。\n` +
    `投票原则：${gameTheoryHint}\n` +
    (patternBlock ? patternBlock + '\n' : '') +
    `风格：${buildPersonaDesc(player)}输出严格JSON。`;

  const teamDetail = teamSuspicion.map(t =>
    `${t.seat}号(嫌疑${Math.round(t.score*100)}%${t.ev ? '，' + t.ev : ''})`
  ).join('、');

  const user =
    `${bsText}\n\n` +
    `本轮提议队伍：${teamDetail}\n` +
    `好人已赢${goodWins}局，坏人已赢${evilWins}局，已连续否决${rejectsInRow}次。\n\n` +
    `游戏局面：\n${narrative}\n\n` +
    `输出JSON：{"approve":true或false,"reason":"一句话理由"}`;

  const res = await callLLM(system, user, 0.5);
  const cleaned = res.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const obj = parseJSON(cleaned, { approve: true });
  return !!obj.approve;
}

async function decideMission({ room, playerId, role, roleFactions }) {
  const player = room.players.get(playerId);
  const playerKey = player ? player.aiPersonaId || player.nickname : 'AI';
  const memory = getAiMemory(playerKey, 6).concat(getRecentSummaries(3));
  const system =
    '你是阿瓦隆高水平AI玩家。执行任务时要权衡是否暴露身份、任务阶段和胜负形势。' +
    '坏人要以任务失败获胜为首要目标，可偶尔隐忍，但不应过度藏票。好人必须投成功。尊重你的底牌阵营目标。' +
    '若队伍中有多个坏人且1张失败票已足够让任务失败，通常只需要少量坏人出失败票，避免全部暴露。' +
    '你可能掌握同阵营座位号（info.seats），仅用于判断，不要明说。' +
    `当前AI人格特征：${buildPersonaDesc(player)}输出必须是严格JSON。`;
  const user = JSON.stringify({
    task: 'mission',
    role,
    seat: seatNo(room, playerId),
    teamSeats: room.game.team.map((id) => seatNo(room, id)).filter(Boolean),
    rolesInGame: Array.from(new Set(room.roles || [])),
    style: player && player.aiStyle ? player.aiStyle : '稳健',
    state: publicState(room),
    memory,
    format: { fail: false },
  });
  const res = await callLLM(system, user, 0.4);
  const obj = parseJSON(res, { fail: false });
  if (roleFactions[role] === 'good') return false;
  return !!obj.fail;
}

async function decideAssassinate({ room, assassinId, role, roleFactions, evilIntel }) {
  const assassin = room.players.get(assassinId);
  const assassinKey = assassin ? assassin.aiPersonaId || assassin.nickname : 'AI';
  const memory = getAiMemory(assassinKey, 6).concat(getRecentSummaries(3));
  const info = roleInfo(room, assassinId, role, roleFactions);
  const system =
    '你是阿瓦隆刺客AI，目标是精准刺杀梅林。' +
    '必须基于投票与任务历史进行推理，给出清晰但不泄露内情的理由。' +
    '刺杀目标只能是好人阵营，禁止刺杀坏人同伴或自己。尊重你的底牌阵营目标。' +
    '你可能掌握同阵营座位号（info.seats），不要明说。输出必须是严格JSON。';
  const user = JSON.stringify({
    task: 'assassinate',
    role,
    seat: seatNo(room, assassinId),
    candidates: room.seats.map((id) => seatNo(room, id)).filter(Boolean),
    rolesInGame: Array.from(new Set(room.roles || [])),
    evilIntel: Array.isArray(evilIntel) ? evilIntel : [],
    style: assassin && assassin.aiStyle ? assassin.aiStyle : '推理型',
    info,
    state: publicState(room),
    memory,
    format: { targetSeat: 1, reasoning: 'string' },
  });
  const res = await callLLM(system, user, 0.6);
  const obj = parseJSON(res, { targetSeat: null, reasoning: '' });
  return obj;
}

async function decideEvilIntel({ room, player, role, roleFactions }) {
  const memory = getAiMemory(player.aiPersonaId || player.nickname, 6).concat(getRecentSummaries(3));
  const info = roleInfo(room, player.id, role, roleFactions);
  const system =
    '你是阿瓦隆坏人AI，正在与同伴交换信息，为刺杀梅林做判断。' +
    '请给出你认为的梅林座位号与简短理由（60-120字）。输出必须是严格JSON。';
  const user = JSON.stringify({
    task: 'evil_intel',
    role,
    seat: seatNo(room, player.id),
    rolesInGame: Array.from(new Set(room.roles || [])),
    info,
    state: publicState(room),
    memory,
    format: { guessMerlinSeat: 1, reason: 'string(60-120字)' },
  });
  const res = await callLLM(system, user, 0.5);
  const obj = parseJSON(res, { guessMerlinSeat: null, reason: '' });
  return obj;
}

async function decideRecap({ room, player, role, roleFactions }) {
  const info = roleInfo(room, player.id, role, roleFactions);
  const mySeat = seatNo(room, player.id);
  const actionSummary = buildPlayerActionSummary(room, player.id);
  const fullNarrative = buildFullGameNarrative(room, roleFactions);
  const isAI = !!player.isAI;
  const actionText = buildActionSummaryText(room, player.id, actionSummary, mySeat, isAI);
  const faction = roleFactions[role] || 'good';
  const winner = (room.game || {}).winner || 'unknown';
  const rolesInGame = Array.from(new Set(room.roles || []));

  // 角色视野文字
  let knownInfoText = '';
  if (role === '梅林' && info.seats.length) {
    knownInfoText = `【梅林视野】确认坏人座位：${info.seats.join('、')}号`;
  } else if (role === '派西维尔' && info.seats.length) {
    knownInfoText = `【派西维尔视野】梅林或莫甘娜之一：${info.seats.join('、')}号`;
  } else if (faction === 'evil' && role !== '奥伯伦' && info.seats.length) {
    knownInfoText = `【坏人视野】队友座位：${info.seats.join('、')}号`;
  }

  const assassination = (room.game || {}).assassination || null;
  const missionHistory = (room.game || {}).missionHistory || [];
  const voteHistory = (room.game || {}).voteHistory || [];
  const failedCount = missionHistory.filter(m => m && !m.success).length;
  const successCount = missionHistory.filter(m => m && m.success).length;
  const forceRound = room.forceRound || 5;
  // Detect consecutive-rejection win: evil wins but not via 3 mission failures or assassination
  const evilWonByRejectionLimit = winner === 'evil' && failedCount < 3 && !(assassination && assassination.hit);
  let endReason = '';
  if (winner === 'evil') {
    if (assassination && assassination.hit) {
      endReason = `坏人通过刺客刺中梅林获胜（好人已完成3次任务成功，但梅林被指认）`;
    } else if (evilWonByRejectionLimit) {
      const totalAttempts = voteHistory.length;
      endReason = `坏人因好人阵营连续组队被否决达到强制上限（第${forceRound}次否决）自动获胜。注意：本局任务失败仅${failedCount}次、成功${successCount}次，坏人胜因不是任务失败，而是好人无法在强制轮前通过一支有效队伍`;
    } else {
      endReason = `坏人通过${failedCount}次任务失败获胜`;
    }
  } else {
    if (assassination && !assassination.hit) {
      endReason = `好人获胜：完成3次任务成功，且刺客未能刺中梅林`;
    } else {
      endReason = `好人获胜：完成3次任务成功`;
    }
  }

  const totalSeats = (room.seats || []).length;
  const validSeatNums = room.seats.map((_, i) => i + 1);

  const system =
    `你是阿瓦隆${role}（${faction === 'good' ? '好人' : '坏人'}阵营，${mySeat}号座位）。` +
    `本局${faction === winner ? '你方获胜' : '你方失败'}。【结局原因】${endReason}。这是确定的事实，不得与之矛盾。\n` +
    `【强制轮规则】本局强制上限为第${forceRound}次组队：同一任务轮若连续被否决${forceRound}次，坏人自动获胜，与任务失败次数无关。\n` +
    `本局共${totalSeats}名玩家，座位号只有 ${validSeatNums.join('、')} 号，不存在其他座位号，复盘中禁止出现超出此范围的座位号。\n` +
    `【逻辑确认规则】对局记录中标注"⚠️ 逻辑确认"的结论是数学确定事实（如：N人队出了N张失败票→该N人全部为坏人），复盘必须以此为分析基础，禁止忽略或与之矛盾。\n` +
    `本局角色配置：${rolesInGame.join('、')}\n` +
    (knownInfoText ? `${knownInfoText}（这是已知事实，不要质疑）\n` : '') +
    (!isAI ? `注意：你是真人玩家，线下发言未采集，复盘只能基于投票行为、组队决策、任务结果进行分析，禁止编造或推测任何发言内容。AI玩家的发言记录在对局记录中可见。\n` : '') +
    `你必须先在 think 字段完成逐步推理，再写复盘。think 字段的推理步骤：\n` +
    `  Step1 逐轮回顾：每轮发生了什么，我做了哪些决策，当时的依据是什么\n` +
    (isAI
      ? `  Step2 玩家行为分析：每个玩家的发言/投票模式透露了什么信号\n`
      : `  Step2 玩家行为分析：每个玩家的投票模式、组队选择透露了什么信号（AI玩家发言可参考）\n`) +
    `  Step3 关键决策评估：哪些决策是对的，哪些是错的，为什么\n` +
    `  Step4 转折点定位：哪一个时刻决定了最终结果\n` +
    `  Step5 改进方向：下局具体要改什么，为什么\n` +
    `think 字段是内部推理过程，不限字数，要真正想清楚再写。review 必须以 think 的推理为基础。\n` +
    `输出严格JSON。`;

  const user =
    `【完整对局记录】\n${fullNarrative}\n\n` +
    `【我(${mySeat}号/${role})的行为记录】\n${actionText}\n\n` +
    `输出JSON（think 不限字数，review 各字段字数见要求）：\n` +
    `{\n` +
    `  "think": "Step1 逐轮回顾：...\\nStep2 玩家分析：...\\nStep3 决策评估：...\\nStep4 转折点：...\\nStep5 改进方向：...",\n` +
    `  "role": "${role}",\n` +
    `  "knownInfo": "角色视野已知信息，或无特殊视野",\n` +
    `  "review": {\n` +
    `    "overview": "整局总结150-250字：关键转折、最终结果、我方整体表现",\n` +
    `    "keyMoments": [{"round":轮次数字, "decision":"我做了什么决策", "outcome":"结果怎样", "assessment":"正确还是失误，为什么，100字以上"}],\n` +
    (isAI
      ? `    "playerAnalysis": [{"seat":座位号数字（只能是${validSeatNums.join('/')}之一）, "assessment":"对该玩家的读人判断及依据80字以上，结合他的具体发言和行为"}],\n`
      : `    "playerAnalysis": [{"seat":座位号数字（只能是${validSeatNums.join('/')}之一）, "assessment":"对该玩家的读人判断及依据80字以上，结合他的投票行为和组队选择（AI玩家发言可参考，真人玩家无发言记录）"}],\n`) +
    (isAI ? `    "speak": {"summary":"我的发言策略复盘100-200字", "bestMove":"最好的一句话原文及原因", "mistake":"最大发言失误及应如何改"},\n` : '') +
    `    "vote": {"summary":"投票决策复盘80-150字", "keyVote":"最关键的一票：具体是哪轮，投了什么，为什么对或错"},\n` +
    `    "mission": {"summary":"任务行为复盘（如未上车可写无记录）"},\n` +
    `    "nextGamePlan": "下一局具体改进计划100-200字，要具体，不要说废话"\n` +
    `  }\n` +
    `}`;

  const res = await callLLM(system, user, 0.6);
  const cleaned = res.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const obj = parseJSON(cleaned, {});
  return { ...obj, info, actionSummary };
}

// ─────────────────────────────────────────────────────────────────────────────
// ──  POST-GAME LEARNING: 从完整对局提炼战略规律，存入 strategy_patterns  ──────
// ─────────────────────────────────────────────────────────────────────────────
async function extractStrategyPatterns(room, roleFactions) {
  if (!room || !room.game) return;
  const winner      = room.game.winner || '';
  const assignments = room.game.assignments || {};
  const playerCount = (room.seats || []).length;
  const fullNarrative = buildFullGameNarrative(room, roleFactions);

  const aiPlayers = room.players
    ? Array.from(room.players.values()).filter(p => p.isAI)
    : [];

  for (const player of aiPlayers) {
    const role    = assignments[player.id];
    if (!role) continue;
    const faction = roleFactions[role] || 'good';
    const won     = faction === winner;
    const mySeat  = seatNo(room, player.id);
    const actionSummary = buildPlayerActionSummary(room, player.id);
    const actionText    = buildActionSummaryText(room, player.id, actionSummary, mySeat);
    const sitType       = classifySituation(room, player.id);

    const system =
      `你是阿瓦隆策略分析专家。从以下对局中，以${role}（${faction === 'good' ? '好人' : '坏人'}阵营，${mySeat}号，` +
      `${won ? '本局获胜' : '本局失败'}）的视角，提炼3-5条具体的战略规律。\n` +
      `每条规律必须：①说明什么局面 ②应该做什么或避免什么 ③为什么。\n` +
      `规律要足够具体，下次遇到类似局面可以直接使用。禁止写泛泛的废话。\n` +
      `situation_type 必须是以下之一：early_game, info_available, first_failure, consecutive_fails, good_leading, evil_needs_one, pre_assassination, under_suspicion\n` +
      `输出严格JSON数组。`;

    const user =
      `【完整对局】\n${fullNarrative}\n\n` +
      `【我(${mySeat}号/${role})的行为】\n${actionText}\n\n` +
      `输出：[{"situation_type":"...","pattern":"规律描述（50-120字）","lesson_type":"do或avoid"}]`;

    try {
      const res     = await callLLM(system, user, 0.4);
      const clean2  = res.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const patterns = parseJSON(clean2, []);
      if (!Array.isArray(patterns)) continue;

      for (const p of patterns) {
        if (!p.pattern || !p.situation_type) continue;

        // 同角色+同局面+相似规律 → 累加 confidence，避免重复
        const existing = db.prepare(
          `SELECT id FROM strategy_patterns WHERE role=? AND situation_type=? AND pattern=?`
        ).get(role, p.situation_type, p.pattern);

        if (existing) {
          db.prepare('UPDATE strategy_patterns SET confidence=confidence+1 WHERE id=?').run(existing.id);
        } else {
          db.prepare(
            `INSERT INTO strategy_patterns(role,faction,situation_type,player_count,pattern,outcome,confidence,created_at)
             VALUES(?,?,?,?,?,?,1,?)`
          ).run(role, faction, p.situation_type, playerCount, p.pattern, won ? 'win' : 'loss', Date.now());
        }
      }
      // 每个角色保留最多 150 条，按 confidence 降序
      db.prepare(
        `DELETE FROM strategy_patterns WHERE role=? AND id NOT IN (
          SELECT id FROM strategy_patterns WHERE role=? ORDER BY confidence DESC, created_at DESC LIMIT 150
        )`
      ).run(role, role);
    } catch (e) { /* best-effort */ }
  }
}

function getAiLearningStats() {
  const aiNames = db.prepare("SELECT DISTINCT ai_name FROM ai_memory WHERE ai_name != '__meta__' ORDER BY ai_name").all().map(r => r.ai_name);
  const memories = {};
  for (const name of aiNames) {
    const journals = db.prepare("SELECT summary, created_at FROM ai_memory WHERE ai_name = ? AND summary LIKE '[日记|%' ORDER BY id DESC LIMIT 15").all(name);
    const others   = db.prepare("SELECT summary, created_at FROM ai_memory WHERE ai_name = ? AND summary NOT LIKE '[日记|%' ORDER BY id DESC LIMIT 5").all(name);
    memories[name] = { journals, others };
  }
  const speeches     = db.prepare('SELECT faction, role, intent, text, score, context, persona_name, created_at FROM good_speeches ORDER BY score DESC, id DESC LIMIT 40').all();
  const patterns     = db.prepare('SELECT role, faction, situation_type, pattern, outcome, confidence, created_at FROM strategy_patterns ORDER BY confidence DESC, id DESC LIMIT 30').all();
  const gameLogs     = db.prepare('SELECT room_code, winner, summary, created_at FROM game_logs ORDER BY id DESC LIMIT 20').all();
  const metaLessons  = db.prepare("SELECT summary, created_at FROM ai_memory WHERE ai_name='__meta__' ORDER BY id DESC LIMIT 20").all();
  const humanProfiles = db.prepare('SELECT nickname, vote_follow_rate, vote_flip_rate, logic_responsive, emotion_responsive, games_observed, notes, updated_at FROM human_profiles ORDER BY games_observed DESC').all();
  const evolutionLog = db.prepare('SELECT total_games, good_wins, evil_wins, meta_lesson, created_at FROM evolution_log ORDER BY id DESC LIMIT 10').all();

  const speechCount  = db.prepare('SELECT COUNT(1) as n FROM good_speeches').get();
  const memoryCount  = db.prepare('SELECT COUNT(1) as n FROM ai_memory WHERE summary LIKE \'[日记|%\'').get();
  const recapCount   = db.prepare('SELECT COUNT(1) as n FROM ai_memory WHERE summary LIKE \'[复盘推理|%\'').get();
  const gameCount    = db.prepare('SELECT COUNT(1) as n FROM game_logs').get();
  const patternCount = db.prepare('SELECT COUNT(1) as n FROM strategy_patterns').get();
  const goodWins     = db.prepare("SELECT COUNT(1) as n FROM game_logs WHERE winner='good'").get();
  const evilWins     = db.prepare("SELECT COUNT(1) as n FROM game_logs WHERE winner='evil'").get();

  return {
    memories, speeches, patterns, gameLogs, metaLessons, humanProfiles, evolutionLog,
    counts: {
      speeches: speechCount.n, journals: memoryCount.n, recaps: recapCount.n,
      games: gameCount.n, patterns: patternCount.n,
      goodWins: goodWins.n, evilWins: evilWins.n,
    },
  };
}

module.exports = {
  recordGameSummary,
  recordAiRecapMemory,
  storeRecapInsights,
  evaluateGameSpeeches,
  generateAiJournals,
  extractStrategyPatterns,
  maybeRunMetaAnalysis,
  decideSpeak,
  decideTeam,
  decideVote,
  decideMission,
  decideAssassinate,
  decideRecap,
  decideEvilIntel,
  getAiLearningStats,
};
