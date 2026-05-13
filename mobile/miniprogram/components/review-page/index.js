const { getSkin } = require("../../skins");
const VOICE_URL = 'https://voice.zhuchao.life/synthesize_cached';
const PERSONA_QUIPS = [
  { key: '莫甘娜的微笑',   text: '逻辑上讲，真正有问题的人，是不需要反复解释的。' },
  { key: '梅林看穿你了',   text: '某些人心里应该很清楚。懂的人自然懂。' },
  { key: '奥伯龙没朋友',   text: '我有自己的判断。不必解释。' },
  { key: '我知道你知道',   text: '你知道我在看你。信息战，从现在开始。' },
  { key: '背刺有理',       text: '对不起，但逻辑不允许我继续护着你。' },
  { key: '沉默即答案',     text: '懂的自然懂。' },
  { key: '任务失败不是我', text: '反正不是我，证据我都列出来了，大家好好想想！' },
  { key: '帕西法尔的直觉', text: '直觉告诉我有问题，说不清楚，大家信我一次嘛。' },
  { key: '三号位可疑',     text: '我锁定了，不管你们怎么想，我就认准这个人。' },
  { key: '不解释',         text: '随便。爱信不信。' },
];

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
    skinHomeBg: 'https://www.awalon.top/mp-assets/home-bg-optimized.jpg',
    currentCard: null,
    cardVisible: false,
    voicePlaying: false,
  },

  lifetimes: {
    attached() {
      const app = getApp();
      const skinId = (app.globalData && app.globalData.skinId) || 'dark-gold';
      this.setData({ skinHomeBg: getSkin(skinId).homeBg });
    },
  },

  methods: {
    onDrawCard() {
      const shuffled = CARD_DATA.slice().sort(() => Math.random() - 0.5);
      this.setData({ currentCard: shuffled[0], cardVisible: true });
    },

    onPlayVoice() {
      if (this.data.voicePlaying) return;
      this.setData({ voicePlaying: true });
      const quip = PERSONA_QUIPS[Math.floor(Math.random() * PERSONA_QUIPS.length)];
      const done = () => this.setData({ voicePlaying: false });
      wx.request({
        url: VOICE_URL,
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: { tts_text: quip.text, contact_id: quip.key },
        responseType: 'arraybuffer',
        timeout: 60000,
        success: (res) => {
          if (res.statusCode !== 200) { done(); return; }
          const fs = wx.getFileSystemManager();
          const tmpPath = `${wx.env.USER_DATA_PATH}/rv_voice_${Date.now()}.wav`;
          fs.writeFile({
            filePath: tmpPath,
            data: res.data,
            success: () => {
              if (this._rvAudio) { try { this._rvAudio.destroy(); } catch (e) {} }
              const ctx = wx.createInnerAudioContext();
              ctx.src = tmpPath;
              ctx.onEnded(() => { ctx.destroy(); fs.unlink({ filePath: tmpPath, fail: () => {} }); done(); });
              ctx.onError(() => { ctx.destroy(); fs.unlink({ filePath: tmpPath, fail: () => {} }); done(); });
              ctx.play();
              this._rvAudio = ctx;
            },
            fail: () => done(),
          });
        },
        fail: () => done(),
      });
    },

    onEnterTap() {
      const now = Date.now();
      if (!this._enterTaps) this._enterTaps = [];
      this._enterTaps = this._enterTaps.filter(t => now - t < 1500);
      this._enterTaps.push(now);
      if (this._enterTaps.length >= 3) {
        this._enterTaps = [];
        this.triggerEvent('exitreview');
      }
    },

    onLogoTap() {
      const now = Date.now();
      if (!this._logoTaps) this._logoTaps = [];
      this._logoTaps = this._logoTaps.filter(t => now - t < 2000);
      this._logoTaps.push(now);
      if (this._logoTaps.length >= 5) {
        this._logoTaps = [];
        this.triggerEvent('exitreview');
      }
    },
  },
});
