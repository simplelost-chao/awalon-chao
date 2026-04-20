const CARD_DATA = [
  {
    role: '梅林',
    image: 'https://www.awalon.top/mp-assets/role-split/merlin.png',
    faction: 'good',
    title: '战略顾问',
    copy: '洞察全局，掌握核心信息，但需谨慎表达——真正的决策者从不轻易亮牌。',
  },
  {
    role: '派西维尔',
    image: 'https://www.awalon.top/mp-assets/role-split/percival.png',
    faction: 'good',
    title: '项目经理',
    copy: '识别关键资源，但需在相似信号中甄别真正的方向。判断力决定执行效率。',
  },
  {
    role: '忠臣',
    image: 'https://www.awalon.top/mp-assets/role-split/arthur_loyal.png',
    faction: 'good',
    title: '执行专家',
    copy: '无需掌握全部信息，依靠观察与协作推动目标落地。行动本身就是最好的证明。',
  },
  {
    role: '刺客',
    image: 'https://www.awalon.top/mp-assets/role-split/assassin.png',
    faction: 'evil',
    title: '风控负责人',
    copy: '把握关键节点，一击制胜。风险管理的核心不是防守，而是精准出手的时机。',
  },
  {
    role: '莫甘娜',
    image: 'https://www.awalon.top/mp-assets/role-split/morgana.png',
    faction: 'evil',
    title: '市场策略师',
    copy: '灵活塑造信息形象，制造竞争优势。让对手误判，比直接对抗更有效率。',
  },
  {
    role: '莫德雷德',
    image: 'https://www.awalon.top/mp-assets/role-split/mordred.png',
    faction: 'evil',
    title: '低调实干家',
    copy: '深藏不露，厚积薄发。不被纳入对手的判断体系，是一种稀缺的竞争优势。',
  },
  {
    role: '奥伯伦',
    image: 'https://www.awalon.top/mp-assets/role-split/oberon.png',
    faction: 'evil',
    title: '独立研究员',
    copy: '不依赖团队情报，独立判断，独立行动。孤立有时反而带来更清醒的视角。',
  },
  {
    role: '爪牙',
    image: 'https://www.awalon.top/mp-assets/role-split/minion.png',
    faction: 'evil',
    title: '团队执行者',
    copy: '紧密协作，高效配合。清楚谁是队友，清楚自己的角色，这本身就是一种力量。',
  },
];

Component({
  properties: {
    statusBarHeight: { type: Number, value: 20 },
    navBarHeight:    { type: Number, value: 44 },
    navTotalHeight:  { type: Number, value: 64 },
  },

  data: {
    currentCard: null,
    cardVisible: false,
  },

  methods: {
    onDrawCard() {
      const shuffled = CARD_DATA.slice().sort(() => Math.random() - 0.5);
      this.setData({ currentCard: shuffled[0], cardVisible: true });
    },

    onEnterTouchStart() {
      this._holdTimer = setTimeout(() => {
        this._holdTimer = null;
        this.triggerEvent('exitreview');
      }, 1000);
    },

    onEnterTouchEnd() {
      if (this._holdTimer) {
        clearTimeout(this._holdTimer);
        this._holdTimer = null;
      }
    },
  },
});
