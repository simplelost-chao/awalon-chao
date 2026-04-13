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
        title: "登录与进入房间",
        scene: "首页",
        points: [
          "进入小程序完成登录后，可在首页找到「快速开始 / 游戏规则 / 历史对战 / 角色统计」入口。",
          "点击「快速开始」创建或加入房间，上次对局未结束则会尝试自动重连。"
        ]
      },
      {
        step: "02",
        title: "圆桌选座与开局配置",
        scene: "房间页",
        points: [
          "玩家围绕圆桌落座，房主可调整角色配置（是否启用梅林、莫德雷德、奥伯伦等）。",
          "所有人准备好后由房主开始游戏，系统按配置随机发放身份。"
        ]
      },
      {
        step: "03",
        title: "身份确认与信息感知",
        scene: "身份面板",
        points: [
          "开局后查看自己的角色卡与「可见信息」：梅林看到大部分坏人，派西维尔看到梅林/莫甘娜双人（无法区分），坏人互认（奥伯伦除外）。",
          "请勿过于明显地暴露自己，后续所有发言和投票都围绕这份信息展开。"
        ]
      },
      {
        step: "04",
        title: "组队、发言与投票",
        scene: "游戏主界面",
        points: [
          "当前队长在圆桌上选人组队，人数需满足本轮任务要求。",
          "进入发言阶段后，玩家按座位顺序依次发言；发言内容会被记录为当轮发言记录。",
          "发言结束后全员投票，同意票过半则队伍成立并进入任务阶段；否决则轮换队长重新提名。"
        ]
      },
      {
        step: "05",
        title: "任务执行与结果推进",
        scene: "任务弹窗",
        points: [
          "上车玩家提交任务牌：好人只能出「成功」，坏人可选「成功」或「失败」。",
          "任务结果动画结束后，主界面轨道同步更新，推进至下一轮队长。",
          "5 轮任务中先达成 3 次成功或 3 次失败的一方取得阶段优势。"
        ]
      },
      {
        step: "06",
        title: "刺杀与终局结算",
        scene: "终局 / 刺杀页",
        points: [
          "好人先完成 3 次任务成功后，刺客进入刺杀阶段，指定一名玩家尝试击杀梅林完成翻盘。",
          "结算页公开所有身份、宣布胜负，并为各玩家发放本局勋章。"
        ]
      },
      {
        step: "07",
        title: "终局互评与 AI 复盘",
        scene: "结算页 / 历史对战",
        points: [
          "结算后每位玩家可对其他人进行互评（C麻了 / 背锅侠 / 尽力位），评价会汇总在历史对战详情中。",
          "AI 复盘功能会根据每位玩家的发言记录和行为，生成发言策略分析与下局建议，可在历史对战详情中查看。"
        ]
      }
    ],

    phaseCards: [
      { name: "组队", desc: "队长选人提交队伍，人数须满足任务要求，可在发言期调整。", tag: "TEAM" },
      { name: "发言", desc: "按座位顺序发言，内容被记录为该轮发言记录，可在历史回顾。", tag: "SPEAK" },
      { name: "投票", desc: "全员同意/反对，过半通过后进入任务；否则轮换队长重提。", tag: "VOTE" },
      { name: "出征", desc: "上车玩家提交任务成功/失败牌，即时结算并更新任务轨道。", tag: "MISSION" },
      { name: "刺杀", desc: "好人完成 3 成功后，刺客指定目标尝试翻盘击杀梅林。", tag: "ASSASSIN" },
      { name: "互评", desc: "结算后玩家对他人进行 C麻了 / 背锅侠 / 尽力位 三类评价。", tag: "PEER" },
      { name: "复盘", desc: "AI 根据发言内容生成每位玩家的发言策略与下局建议。", tag: "AI" }
    ],

    configTips: [
      "人数：5–10 人（人数影响角色池与每轮任务的出征人数）",
      "每局共 5 轮任务，先拿 3 次成功或 3 次失败的一方取得胜势",
      "7 人以上局的第 4 轮（保护轮）需要 2 票失败才算任务失败",
      "连续 5 次组队被全员否决，坏人直接获胜"
    ],

    winTips: [
      "好人阵营胜利：完成 3 次任务成功，且刺客刺杀梅林失败",
      "坏人阵营胜利：造成 3 次任务失败，或刺客成功刺杀梅林",
      "坏人阵营胜利（特殊）：全员连续 5 次否决队伍提案"
    ],

    speakTips: [
      "每轮发言阶段，玩家按座位顺序依次输入发言内容。",
      "发言内容会被保存，可在历史对战详情的「发言记录」板块按轮次翻页查看。",
      "AI 复盘功能会读取发言记录，分析每位玩家的发言策略，并给出下局建议。",
      "发言内容对所有玩家可见，是博弈和判断身份的重要信息来源。"
    ],

    peerVoteTips: [
      "游戏结算后，每位玩家可对其他人进行匿名互评。",
      "共三类评价标签：",
      "  C麻了：该玩家的发言或操作让己方陷入困境（通常给坏人打）",
      "  背锅侠：该玩家明明尽力却被误解或被迫承担失败结果",
      "  尽力位：认可该玩家在本局中的总体表现",
      "评价结果会汇总在历史对战详情中，并计入角色统计的互评数据。"
    ],

    medalTips: [
      "每局结束后，系统会根据你的行为自动发放勋章，可在结算页和历史对战详情中查看。",
      "勋章分为好人阵营勋章和坏人阵营勋章，每类对应不同的行为达成条件。",
      "典型好人勋章：老司机（多次组出全好人队伍）、开眼玩家（全程投票判断准确）、梅林是狗（梅林多次假投坏人）。",
      "典型坏人勋章：刺客大师（成功刺杀梅林）、演技派（全程不投失败却获胜）、狼王（亲自投出 3 次失败票）。",
      "累计勋章数量和具体类型可在「角色统计」页面中查看。"
    ],

    goodRoles: [
      { role: "梅林", desc: "知道大部分坏人身份，但必须隐藏自己不被刺客发现，否则终局会被刺杀翻盘。" },
      { role: "派西维尔", desc: "可看到梅林与莫甘娜两人（无法区分是谁），任务是在博弈中保护真梅林。" },
      { role: "忠臣", desc: "无额外信息，靠逻辑、发言和投票协助好人阵营，也是被迷惑最多的角色。" },
      { role: "兰斯洛特（正义）", desc: "特殊规则局可出现，归属好人阵营，具体规则视局内配置而定。" }
    ],

    evilRoles: [
      { role: "刺客", desc: "坏人核心，终局可指定目标刺杀，成功击杀梅林则坏人翻盘获胜。" },
      { role: "莫甘娜", desc: "伪装成梅林干扰派西维尔的判断，是好人最难识别的坏人之一。" },
      { role: "莫德雷德", desc: "通常不被梅林看到，隐蔽性极强，是最难被揭穿的坏人。" },
      { role: "奥伯伦", desc: "坏人但不被同伴识别，信息孤立，适合单独行动制造混乱。" },
      { role: "爪牙", desc: "标准坏人位，和刺客互认，协同刺客制造任务失败。" },
      { role: "兰斯洛特（邪恶）", desc: "特殊规则局可出现，归属坏人阵营，使阵营信息更加复杂。" }
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
