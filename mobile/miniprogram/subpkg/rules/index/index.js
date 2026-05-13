const { getSkin } = require("../../../skins");

const ROLE_IMAGE_MAP = {
  梅林: "https://www.awalon.top/mp-assets/role-split/merlin.png",
  派西维尔: "https://www.awalon.top/mp-assets/role-split/percival.png",
  忠臣: "https://www.awalon.top/mp-assets/role-split/arthur_loyal.png",
  莫甘娜: "https://www.awalon.top/mp-assets/role-split/morgana.png",
  刺客: "https://www.awalon.top/mp-assets/role-split/assassin.png",
  莫德雷德: "https://www.awalon.top/mp-assets/role-split/mordred.png",
  奥伯伦: "https://www.awalon.top/mp-assets/role-split/oberon.png",
  爪牙: "https://www.awalon.top/mp-assets/role-split/minion.png",
};

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    navTotalHeight: 64,
    skinId: 'dark-gold',
    skinInGameBg: 'https://www.awalon.top/mp-assets/in-game-bg-optimized.jpg',
    tab: 'play',

    missionTable: [
      { players: 5, r1: 2, r2: 3, r3: 2, r4: 3, r5: 3, r4shield: false },
      { players: 6, r1: 2, r2: 3, r3: 4, r4: 3, r5: 4, r4shield: false },
      { players: 7, r1: 2, r2: 3, r3: 3, r4: 4, r5: 4, r4shield: true },
      { players: 8, r1: 3, r2: 4, r3: 4, r4: 5, r5: 5, r4shield: true },
      { players: 9, r1: 3, r2: 4, r3: 4, r4: 5, r5: 5, r4shield: true },
      { players: 10, r1: 3, r2: 4, r3: 4, r4: 5, r5: 5, r4shield: true },
    ],

    uiJourney: [
      {
        step: "1",
        title: "建房 → 坐下 → 开始",
        points: [
          "房主创建房间，把房间号发给朋友，大家进来后在圆桌上选个座位坐好。",
          "房主可以调整人数和角色搭配，准备好了点「开始游戏」，系统会随机发牌。"
        ]
      },
      {
        step: "2",
        title: "看身份",
        points: [
          "每个人偷偷看自己的角色——你是正义还是邪恶，只有你自己知道。",
          "有些角色能看到一些额外信息（比如梅林知道谁是坏人），但大多数人什么都不知道，全靠推理。"
        ]
      },
      {
        step: "3",
        title: "队长选人 → 大家投票",
        points: [
          "轮到谁当队长，谁就从圆桌上选几个人组队（人数有规定）。",
          "选好后大家先发言讨论，然后全员投票：超过一半赞成就出发，否则换下一个人当队长重选。"
        ]
      },
      {
        step: "4",
        title: "执行任务",
        points: [
          "进了队伍的人私下选「成功」或「失败」——正义只能选成功，邪恶两个都能选。",
          "只要有人出了失败牌，这轮任务就炸了。系统只告诉你有几张失败，不告诉你是谁出的。",
          "5 轮里先拿 3 次成功正义赢，先拿 3 次失败邪恶赢。"
        ]
      },
      {
        step: "5",
        title: "刺杀（正义赢了才触发）",
        points: [
          "如果正义完成了 3 次任务，刺客还有最后一刀：猜出梅林是谁，猜对了邪恶直接翻盘！",
          "所以梅林整局都要演得不像梅林——这是游戏最刺激的部分。"
        ]
      },
      {
        step: "6",
        title: "结算",
        points: [
          "身份全部公开，系统判定胜负。表现突出的玩家会自动获得勋章。",
          "还可以给其他人投标签（MVP / 背锅侠 / 尽力位），之后在历史对战里看 AI 帮你做的复盘分析。"
        ]
      }
    ],

    goodRoles: [
      { role: "梅林", desc: "正义的核心。开局就知道大部分坏人是谁，但绝对不能暴露自己——不然会被刺客一刀带走，正义直接输。", tip: "引导队友但别太明显，像「我觉得」比「他肯定是坏人」安全得多。" },
      { role: "派西维尔", desc: "能看到两个人：一个是真梅林，一个是假梅林（莫甘娜），但分不清谁是谁。", tip: "通过发言和投票去判断谁是真梅林，然后暗中保护他。" },
      { role: "忠臣", desc: "普通正义，没有任何额外信息，全靠听发言、看投票来推理。听起来最弱，其实最自由——没有包袱，怎么说都行。", tip: "多留意谁的发言前后矛盾，投票模式也能暴露很多信息。" }
    ],

    evilRoles: [
      { role: "刺客", desc: "邪恶的王牌。就算任务输了，最后还有一刀：猜中梅林就能翻盘。整局都要暗中观察谁最像梅林。", tip: "注意谁投票特别精准、谁在引导队伍方向——那个人很可能是梅林。" },
      { role: "莫甘娜", desc: "她会出现在派西维尔的「疑似梅林名单」里，目的就是让正义搞不清谁是真梅林。", tip: "尽量模仿梅林的说话方式，让派西维尔犹豫不决。" },
      { role: "莫德雷德", desc: "连梅林都不知道他是坏人。极难被识别，是最危险的邪恶角色。", tip: "放心大胆地装好人，因为梅林的视野里根本看不到你。" },
      { role: "奥伯伦", desc: "虽然是邪恶，但连自己的同伴也不认识，同伴也不认识他。完全单打独斗。", tip: "出失败牌的时候要小心，别和另一个坏人撞车（同时出两张失败太明显了）。" },
      { role: "爪牙", desc: "标准邪恶，知道队友是谁。没有特殊能力，但胜在能和同伴配合行动。", tip: "别急着出失败牌，有时候隐忍一两轮反而更不容易被抓。" }
    ],

    mechanics: [
      { icon: "🧚", name: "湖中仙女", desc: "8 人以上可以开启。每轮任务结束后，仙女持有者可以选一个人「验身份」——系统会私下告诉你他是正义还是邪恶。验完后仙女传给被验的人。" },
      { icon: "🛡", name: "保护轮", desc: "7 人以上时，第 4 轮任务需要 2 张失败牌才算失败（只有 1 张不算）。这给了正义一个额外的保护机会。" },
      { icon: "⏰", name: "强制判负", desc: "如果一个轮次里连续多次组队都被投票否决（默认 5 次），邪恶直接获胜。所以别无脑投反对——有时候不完美的队伍也得让它过。" },
      { icon: "💬", name: "发言阶段", desc: "组队后按座位顺序每人说一段话，所有人都能看到。发言记录会保存，局后还能按轮次翻看回顾。" },
      { icon: "🏅", name: "勋章系统", desc: "每局结束后系统根据你的表现自动发勋章——正义和邪恶各有自己的系列，还有角色专属勋章。在「我的主页」可以查看收集情况。" },
      { icon: "🤖", name: "AI 复盘", desc: "局后 AI 帮你分析每个人的发言和操作，找出关键失误和亮点。在「历史对战」详情页里查看。" }
    ],

    beginnerTips: [
      "第一局推荐 7 人标准配置：梅林、派西维尔、2 个忠臣 + 刺客、莫甘娜、爪牙。",
      "先别管勋章和互评，专注于听别人怎么说、观察谁的投票有问题。",
      "正义方多沟通，邪恶方少暴露——这是最基本的策略。",
      "熟悉后再加入莫德雷德、奥伯伦等高阶角色，以及湖中仙女机制。"
    ]
  },

  onLoad() {
    const app = getApp();
    const nav = (app.globalData && app.globalData.nav) || {};
    const skinId = (app.globalData && app.globalData.skinId) || 'dark-gold';
    const skinInGameBg = getSkin(skinId).inGameBg;
    const withImage = (arr) =>
      (arr || []).map((item) => ({
        ...item,
        roleImage: ROLE_IMAGE_MAP[item.role] || ""
      }));
    this.setData({
      statusBarHeight: nav.statusBarHeight || 20,
      navBarHeight: nav.navBarHeight || 44,
      navTotalHeight: nav.navTotalHeight || 64,
      skinId,
      skinInGameBg,
      goodRoles: withImage(this.data.goodRoles),
      evilRoles: withImage(this.data.evilRoles)
    });
  },

  onSwitchTab(e) {
    const tab = String(e.currentTarget.dataset.tab || 'play');
    if (tab !== this.data.tab) this.setData({ tab });
  },

  onBackHome() {
    const pages = getCurrentPages();
    if (pages.length > 1) { wx.navigateBack({ delta: 1 }); return; }
    wx.reLaunch({ url: "/pages/index/index" });
  }
});
