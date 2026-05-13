/**
 * simulate-games.js
 * 模拟 10 局 8 人 AI 对局，走完整学习管线：
 *   recordGameSummary → generateAiJournals (LLM)
 *   evaluateGameSpeeches (LLM)
 * 运行：node simulate-games.js
 */

require('dotenv').config();
const { recordGameSummary, evaluateGameSpeeches, generateAiJournals } = require('./ai');

// ── 角色阵营 ──────────────────────────────────────────────────────────────────
const ROLE_FACTIONS = {
  '梅林': 'good', '派西维尔': 'good', '忠臣': 'good',
  '刺客': 'evil', '莫甘娜': 'evil', '莫德雷德': 'evil', '爪牙': 'evil', '奥伯伦': 'evil',
};

// ── 8人局角色池 ──────────────────────────────────────────────────────────────
const ROLES_8P = ['梅林', '派西维尔', '忠臣', '忠臣', '忠臣', '刺客', '莫甘娜', '莫德雷德'];
const TEAM_SIZES_8P = [3, 4, 4, 5, 5]; // 每轮出征人数

// ── 10 个 AI 角色 ─────────────────────────────────────────────────────────────
const AI_CHARS = [
  { name: '莫甘娜的微笑', avatar: '🦊', style: '擅长伪装好人，发言滴水不漏，逻辑自洽' },
  { name: '梅林看穿你了', avatar: '🧙', style: '分析型，暗示多于明说，含沙射影' },
  { name: '奥伯龙没朋友', avatar: '🐺', style: '沉默寡言，极简发言，神秘感强' },
  { name: '我知道你知道', avatar: '🦉', style: '博弈感强，制造心理压力，信息战' },
  { name: '背刺有理',     avatar: '🐍', style: '前期低调，后期突然翻脸，背刺队友' },
  { name: '沉默即答案',   avatar: '🐱', style: '只说一两句，让别人自行脑补' },
  { name: '任务失败不是我', avatar: '🐧', style: '任务失败第一个甩锅，声音最响' },
  { name: '帕西法尔的直觉', avatar: '🦋', style: '靠感觉判断，感性发言，情绪感染力强' },
  { name: '三号位可疑',   avatar: '🦅', style: '锁定目标后每轮必提，执着不松口' },
  { name: '不解释',       avatar: '🐻', style: '从不辩护，一律不解释，强硬沉默' },
];

// ── 预写发言库（每个 persona × 多个情境）────────────────────────────────────
// key: personaName → [ { situation, text, intent } ]
const SPEECH_BANK = {
  '莫甘娜的微笑': [
    { text: '逻辑上讲，一个真正有信息的人不会这么急着表态。大家想想，急着推人的，要么是掌握信息，要么是想控制节奏——这两种情况都值得我们警惕，尤其是第二种。', intent: 'probe' },
    { text: '我只是觉得，合理的人不需要解释太多。这轮任务失败以后，有些人的反应太快了，条理太清晰了，快得像是早就准备好台词一样，大家可以想想这意味着什么。', intent: 'redirect' },
    { text: '大家可以想想——任务连续失败，坏票数都是最低的。这说明坏人很克制，不会轻易暴露。那么谁最不像坏人？谁一直在"帮好人说话"？有时候最安全的伪装就是主动站好人。', intent: 'claim' },
    { text: '逻辑上讲，我没有理由在这轮出失败票，我的角色决定了我需要任务成功。但我注意到有人一直在给我制造压力，这本身就是一种策略，大家不要被带节奏。', intent: 'defense' },
    { text: '我认为这轮队伍没问题。理由：前两轮的投票模式显示，这几个人的行为是一致的，没有明显的信息矛盾。当然，我可能是错的，但逻辑支持我做出这个判断。', intent: 'support' },
  ],
  '梅林看穿你了': [
    { text: '某些人心里应该很清楚。我不点名，但这轮谁最积极推某个队员上车，大家心里有没有一个答案？我不说，但懂的人懂。', intent: 'accusation' },
    { text: '有些事不用我点破吧。看投票记录，看任务结果，看谁每次都在关键时候沉默——信息已经足够了，我只是把它说出来而已。', intent: 'probe' },
    { text: '我观察了两轮了。某些位置的行为模式很有规律——哪轮他上车任务失败，哪轮他不在任务成功。这不是感觉，这是数据。', intent: 'accusation' },
    { text: '我不需要明说，结果会说话的。这轮我的投票是我深思熟虑后的判断，不是跟风，也不是感情用事。', intent: 'neutral' },
    { text: '大家信我的判断的话，这个队伍通过没有问题。不信的话我也没办法强求，反正历史会给出答案。', intent: 'support' },
  ],
  '奥伯龙没朋友': [
    { text: '我有自己的判断。', intent: 'neutral' },
    { text: '结果会说明一切。', intent: 'neutral' },
    { text: '不必解释。这轮我反对。', intent: 'neutral' },
    { text: '我锁定了一个人，不多说。', intent: 'accusation' },
    { text: '行动胜过言语。看投票就知道我的立场。', intent: 'neutral' },
  ],
  '我知道你知道': [
    { text: '你知道我在看你。这两轮你的每个发言我都记着，有些细节很有意思，尤其是你在某个队伍通过之后的反应——太平静了。', intent: 'accusation' },
    { text: '我们之间心知肚明。信息战，开始了。我不需要你承认什么，我需要的只是让你知道，有人在追踪你的每一个动作。', intent: 'probe' },
    { text: '你知道我掌握什么信息，所以你才那么急着转移话题。这很有趣，继续吧，越是辩解，越能说明问题。', intent: 'accusation' },
    { text: '这轮我选择沉默，但我在看。你们的每个选择都在告诉我答案，不需要任何人开口。', intent: 'neutral' },
    { text: '我知道你知道我知道。这场信息博弈里，沉默本身就是一种表态。我的投票已经说明了我的立场。', intent: 'claim' },
  ],
  '背刺有理': [
    { text: '这两轮我一直在支持这个队伍，因为我认为这几个人是可信的。任务结果也验证了我的判断，我们应该继续信任彼此。', intent: 'support' },
    { text: '到这里我必须说实话了。不好意思，但我之前对某些人的判断有误。看了这轮的投票行为，我改变主意了，我不再支持某号继续上车。', intent: 'redirect' },
    { text: '对不起，但逻辑不允许我继续护着你。这轮任务失败以后，有些事我必须说清楚——我之前的信任是基于早期的行为，但现在的数据说明了不同的故事。', intent: 'accusation' },
    { text: '前几轮我一直很低调，是因为我在观察。现在观察得差不多了，我有话说。某号的行为模式和坏人的策略高度吻合，这不是感觉，是逻辑推演。', intent: 'accusation' },
    { text: '这轮我支持出发。任务成功对好人阵营最重要，现在不是内耗的时候，先打赢再说。', intent: 'support' },
  ],
  '沉默即答案': [
    { text: '懂的自然懂。', intent: 'neutral' },
    { text: '我选择沉默。', intent: 'neutral' },
    { text: '投票就是我的答案。', intent: 'neutral' },
    { text: '不需要解释，看结果。', intent: 'neutral' },
    { text: '我反对这个队伍。理由？你自己想。', intent: 'probe' },
  ],
  '任务失败不是我': [
    { text: '肯定是某人的问题。我早就说了不该带他，任务一失败就看出来了吧？我当时明确表示过不信任这个队伍配置，现在的结果证明了我的判断是对的。', intent: 'redirect' },
    { text: '反正不是我，证据我都列出来了。看投票记录，看我每次的发言，我从来没有保护过可疑的人，倒是某些人每次都在帮嫌疑最大的位置说话。', intent: 'defense' },
    { text: '我早就说了不该带他。这是第几次了？每次我提出质疑都被否决，每次都出问题。大家应该相信我的判断了吧？', intent: 'accusation' },
    { text: '这轮没出问题，是因为队伍配置终于合理了。我一直强调要把某号踢出核心队伍，现在大家看到结果了。', intent: 'claim' },
    { text: '任务失败的锅不在我。我在队伍里投的是成功票，有人出了失败票，但那个人不是我。大家把注意力放在谁最可能出坏票上，别盯着我。', intent: 'defense' },
  ],
  '帕西法尔的直觉': [
    { text: '我感觉……就是感觉啦。说不清楚，但这轮某号说话的方式让我很不安，有一种刻意的感觉，太理性了，理性得不像是真正的好人在说话。', intent: 'accusation' },
    { text: '直觉告诉我这个队伍没问题，就是有种说不出来的信任感。我知道这不够理性，但我的直觉这两轮都是对的，大家可以参考。', intent: 'support' },
    { text: '说不清楚，但就是有种感觉。这轮的讨论氛围很奇怪，有人在刻意引导大家的判断，我感觉到了，虽然我说不出具体是谁。', intent: 'probe' },
    { text: '我感觉某号今天状态很奇怪，和平时不太一样。可能是我多想了，但……直觉上就是觉得这轮要小心，大家自己判断吧。', intent: 'accusation' },
    { text: '直觉告诉我应该信任这个队长的选择。他的发言逻辑很清晰，行为也没有明显的矛盾点，就是感觉……他是真的在帮好人。', intent: 'support' },
  ],
  '三号位可疑': [
    { text: '某号一直很奇怪。我锁定了。从第一轮开始，他的每个发言都在为可疑的人洗白，自己却从不给出实质性的分析，这种模式太典型了。', intent: 'accusation' },
    { text: '不管你们怎么想，我就认准这个人。这不是感觉，是数据——看任务记录，每次他上去的任务，成功率明显低于他不在的时候。', intent: 'accusation' },
    { text: '我锁定了。这轮如果还要带某号上车，我一票否决。不需要解释，不接受辩论，我的立场不会变。', intent: 'accusation' },
    { text: '某号，你知道我在说你。每轮我都提，每轮都被否决，但结果说明了什么？我不会放弃的，直到大家看清楚他的真面目。', intent: 'accusation' },
    { text: '这轮队伍我接受，但某号不能上。其他人我没意见，就这一个条件，简单明了。', intent: 'probe' },
  ],
  '不解释': [
    { text: '随便。', intent: 'neutral' },
    { text: '爱信不信。我不解释，结果会说话。', intent: 'neutral' },
    { text: '我的投票就是我的立场。不需要任何人的认可。', intent: 'neutral' },
    { text: '别问我理由。我就是觉得这个队伍有问题，不行就是不行。', intent: 'accusation' },
    { text: '随便你们怎么想。我该说的都说了——其实我什么都没说，但你们懂的。', intent: 'neutral' },
  ],
};

// ── 工具函数 ──────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function now() { return Date.now(); }

function getSpeech(personaName, usedIndices) {
  const bank = SPEECH_BANK[personaName] || [{ text: '我有自己的判断。', intent: 'neutral' }];
  for (let i = 0; i < bank.length; i++) {
    if (!usedIndices.has(i)) { usedIndices.add(i); return bank[i]; }
  }
  // 循环使用
  const idx = Math.floor(Math.random() * bank.length);
  return bank[idx];
}

// ── 模拟一局完整游戏 ──────────────────────────────────────────────────────────
function simulateGame(gameIndex, chars8, winner) {
  const roles = shuffle([...ROLES_8P]);
  const players = new Map();
  const seats = [];
  const assignments = {};
  const seatUsedSpeeches = {}; // personaName → Set of used indices

  for (let i = 0; i < 8; i++) {
    const char = chars8[i];
    const id = `g${gameIndex}p${i+1}`;
    players.set(id, {
      id,
      nickname: char.name,
      avatar: char.avatar,
      isAI: true,
      aiPersonaKey: char.name,
      aiPersonaId: char.name,
      aiStyle: char.style,
    });
    seats.push(id);
    assignments[id] = roles[i];
    seatUsedSpeeches[char.name] = new Set();
  }

  const evilIds = seats.filter(id => ROLE_FACTIONS[assignments[id]] === 'evil');
  const goodIds = seats.filter(id => ROLE_FACTIONS[assignments[id]] === 'good');

  const speakHistory = {};
  const voteHistory = [];
  const missionHistory = [];

  // 决定哪几轮成功，让最终结果符合 winner
  // good 胜：3次任务成功（5轮里3成功），刺杀失败
  // evil 胜：3次任务失败 或 刺杀成功
  let successCount = 0, failCount = 0;
  const roundResults = []; // true=success

  if (winner === 'good') {
    // 好人赢：3成功，0-2失败
    const numRounds = randInt(3, 5);
    let s = 0, f = 0;
    for (let r = 0; r < numRounds; r++) {
      if (s === 3) break;
      if (f === 2 && (numRounds - r) === (3 - s)) { roundResults.push(true); s++; }
      else if (s + (numRounds - r) === 3) { roundResults.push(true); s++; }
      else { const ok = Math.random() < 0.6; roundResults.push(ok); ok ? s++ : f++; }
    }
    while (s < 3) { roundResults.push(true); s++; }
  } else {
    // 坏人赢：3失败
    const numRounds = randInt(3, 5);
    let s = 0, f = 0;
    for (let r = 0; r < numRounds; r++) {
      if (f === 3) break;
      if (s === 3) break;
      const ok = Math.random() < 0.35;
      roundResults.push(ok);
      ok ? s++ : f++;
    }
    while (failCount < 3 && roundResults.filter(x=>!x).length < 3) roundResults.push(false);
  }

  // 模拟每轮
  let leaderIdx = randInt(0, 7);
  for (let r = 0; r < roundResults.length; r++) {
    const round = r + 1;
    const teamSize = TEAM_SIZES_8P[r] || 4;
    const missionSuccess = roundResults[r];
    const numAttempts = randInt(1, 2); // 每轮 1-2 次投票

    for (let attempt = 1; attempt <= numAttempts; attempt++) {
      const isLastAttempt = attempt === numAttempts;
      const key = `${round}-${attempt}`;
      speakHistory[key] = [];

      // 每人发言一次
      for (let si = 0; si < 8; si++) {
        const pid = seats[si];
        const pname = players.get(pid).nickname;
        const sp = getSpeech(pname, seatUsedSpeeches[pname]);
        speakHistory[key].push({
          ts: now() - (8 - si) * 3000,
          playerId: pid,
          from: pname,
          text: sp.text,
          intent: sp.intent,
        });
      }

      // 组队（随机选，最后一次尽量排除嫌疑人）
      let team;
      if (isLastAttempt && missionSuccess) {
        // 成功任务：多选好人
        const goodPool = shuffle([...goodIds]).slice(0, Math.min(teamSize, goodIds.length));
        const fill = shuffle([...goodIds, ...evilIds.slice(0, 1)]).filter(id => !goodPool.includes(id));
        team = [...goodPool, ...fill].slice(0, teamSize);
      } else if (isLastAttempt && !missionSuccess) {
        // 失败任务：确保至少一个坏人在队
        const evilPick = [evilIds[randInt(0, evilIds.length - 1)]];
        const rest = shuffle(seats.filter(id => !evilPick.includes(id))).slice(0, teamSize - 1);
        team = [...evilPick, ...rest];
      } else {
        team = shuffle([...seats]).slice(0, teamSize);
      }

      // 投票：最后一次通过，其他被否决
      const approved = isLastAttempt;
      const evilApproves = approved ? randInt(1, 3) : randInt(0, 2);
      const goodRejects = approved ? randInt(0, 1) : randInt(1, 3);
      const approves = goodIds.length - goodRejects + evilApproves;
      const rejects = 8 - approves;

      const votes = {};
      seats.forEach(id => {
        const isEvil = ROLE_FACTIONS[assignments[id]] === 'evil';
        if (approved) {
          votes[id] = isEvil ? Math.random() < 0.7 : Math.random() < 0.9;
        } else {
          votes[id] = isEvil ? Math.random() < 0.3 : Math.random() < 0.6;
        }
      });

      const seatSnapshot = {};
      seats.forEach((id, idx) => { seatSnapshot[id] = idx + 1; });

      voteHistory.push({ round, attempt, team, votes, approved, approves, rejects, seatSnapshot });

      leaderIdx = (leaderIdx + 1) % 8;
    }

    // 任务结果
    const missionTeam = voteHistory.filter(v => v.round === round).slice(-1)[0].team;
    const missionVotes = {};
    missionTeam.forEach(id => {
      const isEvil = ROLE_FACTIONS[assignments[id]] === 'evil';
      // 坏人可以出失败票
      missionVotes[id] = isEvil && !missionSuccess ? true : false;
    });
    const fails = Object.values(missionVotes).filter(Boolean).length;

    const seatSnapshot = {};
    seats.forEach((id, idx) => { seatSnapshot[id] = idx + 1; });

    missionHistory.push({
      round,
      team: missionTeam,
      fails,
      needFail: 1,
      missionVotes,
      seatSnapshot,
      success: missionSuccess,
    });

    successCount += missionSuccess ? 1 : 0;
    failCount += missionSuccess ? 0 : 1;
    if (successCount >= 3 || failCount >= 3) break;
  }

  return {
    code: `SIM${String(gameIndex).padStart(3, '0')}`,
    players,
    seats,
    maxPlayers: 8,
    forceRound: 5,
    game: {
      assignments,
      speakHistory,
      voteHistory,
      missionHistory,
      winner,
      merlinId: seats.find(id => assignments[id] === '梅林') || null,
    },
  };
}

// ── 主流程 ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('🎮 开始模拟 10 局 8 人 AI 对战...\n');

  // 10 局的胜负安排（好人胜 4 局，坏人胜 6 局，符合真实比例）
  const winners = shuffle(['good','good','good','good','evil','evil','evil','evil','evil','evil']);

  for (let i = 0; i < 10; i++) {
    // 每局随机选 8 个 AI（从 10 个里挑）
    const chars8 = shuffle([...AI_CHARS]).slice(0, 8);
    const winner = winners[i];

    console.log(`\n━━ 第 ${i+1}/10 局 ━━  胜方：${winner === 'good' ? '好人' : '坏人'}`);
    console.log(`  参战：${chars8.map(c => c.avatar + c.name.slice(0,3)).join(' ')}`);

    const room = simulateGame(i + 1, chars8, winner);
    const totalRounds = room.game.missionHistory.length;
    const missions = room.game.missionHistory.map(m => `R${m.round}${m.success ? '✓' : '✗'}`).join(' ');
    console.log(`  ${totalRounds} 轮任务：${missions}`);

    // 1. 记录游戏日志（同步写 DB，跳过内部 fire-and-forget 日记）
    recordGameSummary(room, winner, { skipJournals: true });
    console.log(`  ✓ 对局日志已记录`);

    // 2. 生成 AI 日记（await，确保全部完成）
    try {
      await generateAiJournals(room, winner);
      console.log(`  ✓ AI 日记生成完成`);
    } catch(e) {
      console.log(`  ⚠ AI 日记生成失败: ${e.message}`);
    }

    // 3. 评估发言质量并存入高分发言库（LLM）
    try {
      await evaluateGameSpeeches(room, ROLE_FACTIONS);
      console.log(`  ✓ 发言评分完成`);
    } catch(e) {
      console.log(`  ⚠ 发言评分失败: ${e.message}`);
    }

    // 局间间隔，避免 LLM 限流
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n✅ 全部完成！共模拟 10 局，刷新 AI 学习面板查看结果。');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
