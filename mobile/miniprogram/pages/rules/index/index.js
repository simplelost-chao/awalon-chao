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

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    navTotalHeight: 64,
    uiJourney: [
      {
        step: "01",
        title: "登录与回到上局",
        scene: "首页",
        points: [
          "进入小程序后先完成登录，系统会尝试恢复你上一次的房间状态。",
          "首页可以直接看到“快速开始 / 游戏规则 / 历史对战 / 角色统计”等入口。",
          "如果你上次对局没有结束，重新进入后会自动尝试重新连接房间。"
        ]
      },
      {
        step: "02",
        title: "圆桌选座与房间配置",
        scene: "房间页",
        points: [
          "进入房间后，玩家会围绕圆桌落座，房主可以先看房间号、玩家人数和当前配置。",
          "房主可调整是否加入梅林、派西维尔、莫甘娜、奥伯伦、莫德雷德等角色。",
          "所有人准备好后，由房主点击开始游戏，系统再按当前配置发身份。"
        ]
      },
      {
        step: "03",
        title: "身份发放与信息确认",
        scene: "身份面板",
        points: [
          "开局后每名玩家先查看自己的角色卡、阵营颜色以及可见信息。",
          "梅林会看到大部分坏人，派西维尔会看到梅林/莫甘娜双人信息，坏人会看到同伴或出现奥伯伦信息断层。",
          "这一步不要暴露得太明显，后续发言和投票都围绕这份信息展开。"
        ]
      },
      {
        step: "04",
        title: "队长组队与顺序发言",
        scene: "游戏主界面",
        points: [
          "当前队长会在主界面选择本轮上车玩家，人数必须满足任务要求。",
          "进入发言阶段后，玩家会按照座位顺序依次发言，讨论车队是否可信。",
          "房主可以根据节奏使用跳过发言、直接投票等控制功能。"
        ]
      },
      {
        step: "05",
        title: "全员投票与任务执行",
        scene: "投票 / 任务弹窗",
        points: [
          "队伍提交后，全员对当前车队投同意或反对票。",
          "投票通过后，仅上车玩家会进入任务牌选择；好人只能出成功，坏人可选成功或失败。",
          "任务结果会在主界面展示，并同步推进到下一轮队长与任务轨道。"
        ]
      },
      {
        step: "06",
        title: "刺杀、结算与复盘",
        scene: "终局页",
        points: [
          "如果好人率先完成 3 次任务成功，刺客会进入刺杀阶段，尝试翻盘击杀梅林。",
          "结算页会公开身份、展示胜负、发放勋章，并可直接开始下一局。",
          "历史对战和角色统计页面会记录你的历史局数、角色表现和勋章获得情况。"
        ]
      }
    ],
    mockActions: [
      { label: "快速开始", accent: "gold" },
      { label: "游戏规则", accent: "blue" },
      { label: "历史对战", accent: "red" },
      { label: "角色统计", accent: "teal" }
    ],
    mockSeats: [
      { name: "1号", state: "队长", tone: "gold" },
      { name: "2号", state: "发言中", tone: "blue" },
      { name: "3号", state: "已准备", tone: "teal" },
      { name: "4号", state: "待发言", tone: "gray" },
      { name: "5号", state: "待发言", tone: "gray" },
      { name: "6号", state: "待发言", tone: "gray" }
    ],
    mockVotes: [
      { name: "1号", result: "同意", tone: "good" },
      { name: "2号", result: "同意", tone: "good" },
      { name: "3号", result: "反对", tone: "bad" },
      { name: "4号", result: "同意", tone: "good" },
      { name: "5号", result: "同意", tone: "good" },
      { name: "6号", result: "反对", tone: "bad" }
    ],
    mockMissionTrack: [
      { round: "R1", result: "成功", tone: "success" },
      { round: "R2", result: "失败", tone: "fail" },
      { round: "R3", result: "成功", tone: "success" },
      { round: "R4", result: "待定", tone: "pending" },
      { round: "R5", result: "待定", tone: "pending" }
    ],
    configTips: [
      "人数：5-10 人（人数不同，角色池与任务人数要求不同）",
      "每局共 5 轮任务，先拿到 3 次成功的一方获阶段优势",
      "第 4 轮在 7+ 人局通常需要 2 张失败票才算任务失败",
      "建议发言时长：每人 90-180 秒，房主可按节奏跳过"
    ],
    flowTips: [
      "进入房间并入座后，由房主开始游戏。",
      "系统发身份，先看自己身份卡与可见信息。",
      "队长提名队伍，可在发言期继续调整队伍。",
      "全员投票；通过后队员执行任务牌。",
      "每轮结算后推进下一轮，直至出现胜方。",
      "若好人先拿到 3 成功，刺客会进入刺杀翻盘环节。"
    ],
    phaseCards: [
      { name: "组队", desc: "队长选人并提交队伍，人数必须满足当前任务要求。", tag: "TEAM" },
      { name: "发言", desc: "按座位顺序发言，围绕队伍构成和身份信息进行博弈。", tag: "SPEAK" },
      { name: "投票", desc: "全员同意/反对当前队伍，过票才会进入任务执行。", tag: "VOTE" },
      { name: "出征", desc: "队员提交任务成功/失败牌，系统进行任务结算动画。", tag: "MISSION" },
      { name: "刺杀", desc: "好人先达成3成功后，刺客可指定目标尝试翻盘。", tag: "ASSASSIN" },
      { name: "结算", desc: "显示胜负结果、公开身份并可按当前配置重新开始。", tag: "END" }
    ],
    interfaceTips: [
      "房间信息区域：显示房号、人数、当前角色配置和任务要求。",
      "圆桌区域：展示玩家座位、队长、发言顺序、是否准备与当局状态。",
      "底部操作区：根据阶段切换成组队、投票、任务、刺杀等按钮。",
      "战绩相关页面：历史对战看每局结果，角色统计看角色胜率与勋章。"
    ],
    winTips: [
      "好人阵营胜利：3 次任务成功，且刺客刺杀梅林失败",
      "坏人阵营胜利：3 次任务失败，或刺客成功刺杀梅林",
      "额外提示：连续多次组队被否决会快速把局势推向坏人节奏"
    ],
    goodRoles: [
      { role: "梅林", desc: "知道大部分坏人身份，但必须隐藏自己。" },
      { role: "派西维尔", desc: "可看到梅林与莫甘娜（无法区分），负责保护真梅林。" },
      { role: "忠臣", desc: "无额外信息，靠逻辑、发言和投票协助好人。" },
      { role: "兰斯洛特（正义）", desc: "特殊规则局可出现，需留意阵营扰动。" }
    ],
    evilRoles: [
      { role: "刺客", desc: "坏人核心，终局可刺杀梅林完成翻盘。" },
      { role: "莫甘娜", desc: "伪装梅林干扰派西维尔判断。" },
      { role: "莫德雷德", desc: "通常不被梅林看到，隐蔽性强。" },
      { role: "奥伯伦", desc: "坏人但不被同伴识别，信息不互通。" },
      { role: "爪牙", desc: "标准坏人位，协同刺客制造任务失败。" },
      { role: "兰斯洛特（邪恶）", desc: "特殊规则局可出现，阵营信息更复杂。" }
    ]
  },

  onLoad() {
    const nav = (getApp().globalData && getApp().globalData.nav) || {};
    const withImage = (arr) =>
      (arr || []).map((item) => ({
        ...item,
        roleImage: ROLE_IMAGE_MAP[item.role] || ""
      }));
    this.setData({
      statusBarHeight: nav.statusBarHeight || 20,
      navBarHeight: nav.navBarHeight || 44,
      navTotalHeight: nav.navTotalHeight || 64,
      goodRoles: withImage(this.data.goodRoles),
      evilRoles: withImage(this.data.evilRoles)
    });
  },

  onBackHome() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.reLaunch({ url: "/pages/index/index" });
  }
});
