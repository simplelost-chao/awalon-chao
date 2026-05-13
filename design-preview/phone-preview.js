/**
 * phone-preview.js — 共享手机预览组件 v2
 * class PhonePreview — handles all screens + skin variants
 */

const PLAYERS = [
  {nm:'光影',  roleId:'merlin',        role:'梅林',     faction:'merlin', badge:'speak',   isMe:true,  leader:false, inTeam:true},
  {nm:'龙影',  roleId:'percival',      role:'派西维尔', faction:'good',   badge:'voted',   isMe:false, leader:true,  inTeam:false},
  {nm:'鹰眼',  roleId:'lancelot_good', role:'兰斯洛特', faction:'good',   badge:'mission', isMe:false, leader:false, inTeam:true},
  {nm:'月影',  roleId:'morgana',       role:'莫甘娜',   faction:'evil',   badge:'voting',  isMe:false, leader:false, inTeam:false},
  {nm:'蝶舞',  roleId:'arthur_loyal',  role:'忠臣',     faction:'good',   badge:'',        isMe:false, leader:false, inTeam:false},
  {nm:'雷鸣',  roleId:'assassin',      role:'刺客',     faction:'evil',   badge:'',        isMe:false, leader:false, inTeam:false},
  {nm:'海浪',  roleId:'minion',        role:'爪牙',     faction:'evil',   badge:'',        isMe:false, leader:false, inTeam:false},
  {nm:'烈焰',  roleId:'arthur_loyal',  role:'忠臣',     faction:'good',   badge:'',        isMe:false, leader:false, inTeam:false},
  {nm:'暗影',  roleId:'mordred',       role:'莫德雷德', faction:'evil',   badge:'',        isMe:false, leader:false, inTeam:false},
  {nm:'星辰',  roleId:'oberon',        role:'奥伯伦',   faction:'evil',   badge:'',        isMe:false, leader:false, inTeam:false},
];
const MERLIN_SEES_EVIL = new Set([3, 5, 6, 9]);

const PP_BASE_CSS = `
.ph-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
.ph-bg-color{position:absolute;inset:0;z-index:0}
.ph-mask{position:absolute;inset:0;z-index:1;pointer-events:none}

/* ─── Phone UI: high-fidelity recreation ─── */

/* Nav bar  (44px real → ~28px preview, scale 0.65) */
.ph-nav{position:relative;z-index:10;height:28px;flex-shrink:0;display:flex;align-items:center;padding:0 8px;background:var(--aw-nav-bg,rgba(12,16,24,.88));border-bottom:1px solid var(--aw-nav-border,rgba(255,255,255,.08))}
.ph-nav-title{position:absolute;left:50%;transform:translateX(-50%);font-size:9px;font-weight:700;color:var(--aw-text,#eef1f7);letter-spacing:2px;white-space:nowrap}
.ph-nav-back{font-size:8px;color:var(--aw-text,#eef1f7);padding:2px 5px;border-radius:calc(999px * var(--aw-r));border:1px solid var(--aw-panel-border,rgba(255,255,255,.1));background:var(--aw-input-bg,rgba(255,255,255,.06));display:flex;align-items:center;gap:2px;flex-shrink:0;white-space:nowrap}

/* Scrollable content */
.ph-content{position:relative;z-index:2;flex:1;overflow-y:auto;padding:6px 7px 8px;display:flex;flex-direction:column;gap:5px}
.ph-content::-webkit-scrollbar{display:none}

/* Panel card */
.ph-panel{background:var(--aw-panel,#131720);border:1px solid var(--aw-panel-border,rgba(255,255,255,.1));border-radius:calc(7px * var(--aw-r));padding:7px;box-shadow:0 2px 8px rgba(0,0,0,.40),inset 0 1px 0 rgba(255,255,255,.04)}

/* User header row (left accent border) */
.ph-user-row{display:flex;align-items:center;gap:5px;padding:4px 5px;border-left:2px solid var(--aw-accent,#d9b36b);border-radius:calc(3px * var(--aw-r));background:linear-gradient(90deg,rgba(216,176,107,0.14),transparent);margin-bottom:5px}
.ph-av{width:22px;height:22px;border-radius:calc(50% * var(--aw-r,1));background:var(--aw-bg-2,#161b24);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;border:1px solid rgba(255,255,255,0.15)}
.ph-logout{margin-left:auto;font-size:6px;color:rgba(106,122,154,0.9);padding:1px 5px;border:1px solid rgba(106,122,154,0.3);border-radius:calc(999px * var(--aw-r))}

/* 3-button action grid */
.ph-act-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-bottom:5px}
.ph-act-btn{background:transparent;border:1px solid rgba(255,255,255,0.18);border-radius:calc(4px * var(--aw-r));padding:5px 2px;display:flex;flex-direction:column;align-items:center;gap:2px}

/* Player count pills */
.ph-count-row{display:flex;gap:2px;margin-bottom:5px;overflow:hidden}
.ph-cnt{flex:1;padding:2px 0;border-radius:calc(3px * var(--aw-r));font-size:6px;text-align:center;background:rgba(0,0,0,0.16);border:1px solid rgba(255,255,255,0.12);color:var(--aw-subtext,#aeb6c7);white-space:nowrap}
.ph-cnt.on{background:rgba(216,176,107,0.18);border-color:rgba(216,176,107,0.55);color:var(--aw-accent,#d9b36b);font-weight:700}

/* Role chips — vertical card layout matching real UI */
.ph-chips{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:5px}
.ph-rchip{padding:4px 5px;border-radius:calc(4px * var(--aw-r));font-size:6px;display:flex;flex-direction:column;align-items:center;gap:1px;min-width:20px;line-height:1.3}
.ph-rchip-img{width:15px;height:15px;border-radius:calc(3px * var(--aw-r));object-fit:cover;flex-shrink:0}
.good-chip{background:rgba(30,90,200,0.12);border:1px solid rgba(80,160,255,0.55);color:#d3daea}
.evil-chip{background:rgba(160,35,45,0.12);border:1px solid rgba(220,80,90,0.55);color:#d3daea}
.spec-chip{background:rgba(88,28,135,0.35);border:1px solid rgba(192,132,252,0.4);color:#d4aaff}

/* CTA buttons */
.ph-btn-row{display:flex;gap:4px}
.ph-btn-p{flex:1;padding:6px 0;border-radius:calc(6px * var(--aw-r));font-size:8px;font-weight:700;text-align:center;background:var(--aw-btn-primary-bg,linear-gradient(180deg,#e4c281,#c89b52));color:var(--aw-btn-primary-text,#1a1510)}
.ph-btn-g{flex:1;padding:6px 0;border-radius:calc(6px * var(--aw-r));font-size:8px;text-align:center;background:transparent;border:1px solid var(--aw-btn-ghost-border,rgba(255,255,255,0.2));color:var(--aw-text,#eef1f7)}

/* ── Round table (fills full width, square aspect via padding-bottom:100%) */
.ph-table-area{position:relative;width:100%;padding-bottom:90%;margin-bottom:2px;flex-shrink:0}
.ph-table-inner{position:absolute;inset:0}
.ph-table-circle-bg{position:absolute;width:55%;height:55%;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:50%;overflow:hidden;opacity:0.38;pointer-events:none;transition:opacity .2s}
.ph-table-circle-bg img{width:100%;height:100%;object-fit:cover}
/* Seats — matches production round-table.wxss structure exactly */
.ph-seat{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;width:44px;overflow:visible}
/* avatar wrap: relative so badge/no can be absolutely positioned */
.ph-seat-av-wrap{position:relative;width:30px;height:30px;flex-shrink:0;overflow:visible}
.ph-seat-av{width:30px;height:30px;border-radius:calc(50% * var(--aw-r,1));background:rgba(15,11,8,0.55);border:1px solid rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:15px;position:relative;z-index:2;overflow:hidden}
/* seat number: bottom-right of avatar wrap */
.ph-seat-no{position:absolute;right:-5px;bottom:-3px;min-width:14px;height:14px;padding:0 3px;border-radius:calc(999px * var(--aw-r));display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:#e6c17d;background:rgba(10,8,20,0.95);border:1px solid rgba(180,140,60,0.42);z-index:5;line-height:1;box-sizing:border-box}
/* status badge: top-left of avatar wrap */
.ph-seat-badge{position:absolute;top:-3px;left:-3px;width:14px;height:14px;border-radius:calc(50% * var(--aw-r,1));background:rgba(8,11,18,0.96);border:1px solid transparent;display:flex;align-items:center;justify-content:center;z-index:10}
.ph-seat-badge.speak{border-color:rgba(251,191,36,0.8);box-shadow:0 0 4px rgba(251,191,36,0.45)}
.ph-seat-badge.voted{border-color:rgba(52,211,153,0.8)}
.ph-seat-badge.voting{border-color:rgba(251,191,36,0.8)}
.ph-seat-badge.mission{border-color:rgba(251,191,36,0.8);box-shadow:0 0 3px rgba(251,191,36,0.35)}
/* crown: absolute above avatar wrap */
.ph-crown{position:absolute;top:-10px;font-size:9px;line-height:1;z-index:5}
.ph-seat-name{font-size:7px;color:#d0d8e8;text-align:center;line-height:1.2;white-space:nowrap;overflow:hidden;max-width:44px}
/* role pill: absolute below the whole seat card */
.ph-seat-below{position:absolute;top:calc(100% + 2px);left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;width:52px;pointer-events:none}
.ph-seat-role-pill{display:flex;align-items:center;max-width:52px;padding:1px 5px;border-radius:calc(999px * var(--aw-r));overflow:hidden;white-space:nowrap;font-size:7px;color:#fff;border:1px solid transparent}
.ph-seat-role-pill.good{background:rgba(7,50,120,0.55);border-color:rgba(78,158,255,0.45);color:#bfdbfe}
.ph-seat-role-pill.merlin{background:rgba(80,30,150,0.55);border-color:rgba(180,130,255,0.4);color:#d4aaff}
.ph-seat-role-pill.evil{background:rgba(110,12,12,0.6);border-color:rgba(220,60,60,0.4);color:#fca5a5}
/* faction glow on avatar */
.ph-seat.good .ph-seat-av{border-color:var(--aw-good-glow,rgba(78,158,255,0.85));box-shadow:0 0 6px var(--aw-good-shadow,rgba(78,158,255,0.45));background:var(--aw-good-seat-bg,rgba(7,50,120,0.35))}
.ph-seat.evil .ph-seat-av{border-color:var(--aw-evil-glow,rgba(220,60,60,0.8));box-shadow:0 0 5px var(--aw-evil-shadow,rgba(200,40,40,0.38));background:var(--aw-evil-seat-bg,rgba(35,6,6,0.92))}
.ph-seat.merlin .ph-seat-av{border-color:rgba(180,130,255,0.85);box-shadow:0 0 6px rgba(160,100,255,0.45);background:rgba(25,12,55,0.9)}
.ph-seat.me .ph-seat-av{border-color:rgba(233,191,112,0.95)!important;box-shadow:0 0 0 2px rgba(233,191,112,0.22)!important}
/* center result states */
.ph-center-result{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;z-index:2;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:54px}
.ph-center-result-title{font-size:9px;font-weight:700;line-height:1.3;letter-spacing:1px}
.ph-center-result-sub{font-size:7px;color:rgba(255,255,255,0.55);line-height:1.3}
.ph-center-result.mission-progress .ph-center-result-title{color:var(--aw-accent,#fbbf24)}
.ph-center-result.success .ph-center-result-title{color:var(--aw-success,#72e0a0)}
.ph-center-result.fail .ph-center-result-title{color:var(--aw-fail,#f07070)}
/* center state mini-toggle above round table */
.ph-center-toggle{display:flex;gap:2px;padding:2px 4px;justify-content:center;flex-shrink:0}
.ph-ct-btn{font-size:5.5px;padding:2px 5px;border-radius:calc(3px * var(--aw-r));border:1px solid rgba(255,255,255,.12);color:var(--aw-subtext,#aeb6c7);cursor:pointer;background:rgba(0,0,0,.2)}
.ph-ct-btn.active{background:rgba(255,255,255,.1);color:var(--aw-text,#eef1f7);border-color:rgba(255,255,255,.25)}
/* game detail (对战详情) page */
.ph-ghc{border-radius:calc(8px * var(--aw-r));overflow:hidden;margin-bottom:6px;position:relative;flex-shrink:0;box-shadow:0 3px 12px rgba(0,0,0,.45)}
.ph-ghc-bar{height:3px}
.ph-ghc-bar.win{background:linear-gradient(90deg,rgba(80,200,120,.8),rgba(40,160,80,.4))}
.ph-ghc-bar.lose{background:linear-gradient(90deg,rgba(220,80,80,.8),rgba(160,40,40,.4))}
.ph-ghc-body{padding:7px 8px 6px}
.ph-ghc-top-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.ph-ghc-id{font-size:7px;color:var(--aw-subtext,#aeb6c7)}
.ph-ghc-id-num{font-size:9px;font-weight:700;color:var(--aw-text,#eef1f7)}
.ph-ghc-result-tag{display:flex;align-items:center;gap:2px;padding:2px 6px;border-radius:calc(999px * var(--aw-r));font-size:7px;font-weight:700}
.ph-ghc-result-tag.win{background:rgba(60,160,100,.2);border:1px solid rgba(100,220,150,.5);color:#72e0a0}
.ph-ghc-result-tag.lose{background:rgba(160,40,40,.2);border:1px solid rgba(220,90,90,.5);color:#f07070}
.ph-ghc-dot{width:4px;height:4px;border-radius:calc(50% * var(--aw-r,1))}
.ph-ghc-dot.win{background:#72e0a0}
.ph-ghc-dot.lose{background:#f07070}
.ph-ghc-hero-row{display:flex;gap:8px;align-items:flex-start}
.ph-ghc-portrait-wrap{display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0}
.ph-ghc-portrait{width:36px;height:36px;border-radius:calc(50% * var(--aw-r,1));overflow:hidden;border:2px solid rgba(255,255,255,.2);background:rgba(20,14,4,.8);display:flex;align-items:center;justify-content:center;font-size:18px}
.ph-ghc-role-pill{font-size:6px;padding:1px 6px;border-radius:calc(999px * var(--aw-r));background:var(--aw-evil-chip-bg,rgba(180,50,50,.25));border:1px solid var(--aw-evil-chip-border,rgba(220,90,90,.4));color:var(--aw-evil-chip-text,#fca5a5);white-space:nowrap}
.ph-ghc-role-pill.good{background:var(--aw-good-chip-bg,rgba(7,50,120,.35));border-color:var(--aw-good-chip-border,rgba(78,158,255,.4));color:var(--aw-good-chip-text,#bfdbfe)}
.ph-ghc-player-name{font-size:10px;font-weight:700;color:var(--aw-text,#eef1f7);margin-bottom:4px}
.ph-ghc-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px}
.ph-ghc-meta-item{display:flex;align-items:center;gap:2px;font-size:6px;color:var(--aw-subtext,#aeb6c7)}
.ph-ghc-meta-val.evil{color:#fca5a5}
.ph-ghc-divider{height:1px;background:rgba(255,255,255,.07);margin:6px 0}
.ph-ghc-medal-row{display:flex;flex-wrap:wrap;gap:3px}
.ph-ghc-medal{display:flex;align-items:center;gap:2px;padding:2px 6px;border-radius:calc(999px * var(--aw-r));background:var(--aw-medal-bg,rgba(200,144,42,.15));border:1px solid var(--aw-medal-border,rgba(200,144,42,.35));font-size:6px;color:var(--aw-medal-color,#d4a043)}
.ph-section-hd{font-size:7px;font-weight:700;color:var(--aw-subtext,#aeb6c7);letter-spacing:1px;margin-bottom:4px;padding-bottom:3px;border-bottom:1px solid rgba(255,255,255,.06)}
/* round table compact for history detail */
.ph-table-area-sm{position:relative;width:100%;padding-bottom:78%;flex-shrink:0}

/* Section chip label */
.ph-sec-chip{display:inline-flex;align-items:center;font-size:7px;font-weight:700;color:var(--aw-subtext,#aeb6c7);letter-spacing:1px;margin-bottom:3px;padding:2px 7px;border-radius:calc(999px * var(--aw-r));background:rgba(255,255,255,0.05);border:1px solid var(--aw-panel-border,rgba(255,255,255,.08))}

/* Mission pills */
.ph-pills-row{display:flex;gap:3px}
.ph-pill{flex:1;min-height:38px;border-radius:calc(5px * var(--aw-r));border:1px solid var(--aw-panel-border,rgba(255,255,255,.1));background:rgba(0,0,0,0.22);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3px 1px;gap:1px}
.ph-pill.success{background:rgba(60,160,100,0.18);border-color:rgba(100,220,150,0.55)}
.ph-pill.fail{background:rgba(160,40,40,0.18);border-color:rgba(230,90,90,0.55)}
.ph-pill.current{background:rgba(190,145,60,0.18);border-color:rgba(220,180,90,0.7)}
.ph-pill.future{opacity:0.6}
.ph-pill-icon{font-size:9px;font-weight:bold;line-height:1}
.ph-pill.success .ph-pill-icon{color:#72e0a0}
.ph-pill.fail .ph-pill-icon{color:#f07070}
.ph-pill-lbl{font-size:5.5px;color:var(--aw-subtext,#aeb6c7);line-height:1}
.ph-pill-curnum{font-size:13px;font-weight:700;color:#f0e0a0;line-height:1}

/* Bottom action panel — fixed to bottom of phone */
.ph-action-panel{position:relative;z-index:10;flex-shrink:0;background:var(--aw-panel,rgba(19,23,31,.82));border-top:1px solid var(--aw-nav-border,rgba(255,255,255,.08));padding:7px 8px 18px}
.ph-vote-title{font-size:7px;color:var(--aw-subtext,#aeb6c7);text-align:center;margin-bottom:5px}
.ph-vote-team{display:flex;gap:14px;justify-content:center;margin-bottom:5px}
.ph-vote-av{width:22px;height:22px;border-radius:calc(50% * var(--aw-r,1));background:rgba(12,10,8,0.5);border:1px solid var(--aw-panel-border,rgba(255,255,255,.1));display:flex;align-items:center;justify-content:center;font-size:11px}
.ph-vote-name{font-size:5.5px;color:var(--aw-subtext,#aeb6c7);text-align:center;margin-top:2px}
.ph-vote-divider{width:100%;height:1px;background:var(--aw-input-bg,rgba(255,255,255,.06));margin:4px 0}
.ph-vote-btns{display:flex;gap:3px}
.ph-vote-yes{flex:1;background:var(--aw-btn-primary-bg,linear-gradient(180deg,#e4c281,#c89b52));color:var(--aw-btn-primary-text,#1a1510);border-radius:calc(5px * var(--aw-r));padding:5px 0;font-size:8px;font-weight:700;text-align:center}
.ph-vote-no{flex:1;background:transparent;border:1px solid var(--aw-btn-ghost-border,rgba(255,255,255,0.2));color:var(--aw-text,#eef1f7);border-radius:calc(5px * var(--aw-r));padding:5px 0;font-size:8px;text-align:center}

/* Identity card */
.ph-role-big{display:flex;flex-direction:column;align-items:center;padding:8px 6px 6px}
.ph-role-img-big{width:52px;height:52px;border-radius:calc(50% * var(--aw-r,1));overflow:hidden;border:2px solid var(--aw-accent,#d9b36b);margin-bottom:5px;background:var(--aw-bg-2,#161b24);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
.ph-faction-tag{padding:2px 8px;border-radius:calc(999px * var(--aw-r));font-size:6.5px;margin-bottom:7px}
.ph-role-desc{font-size:6.5px;color:var(--aw-subtext,#aeb6c7);line-height:1.6;text-align:center;max-width:220px;margin-bottom:6px}

/* Known players list */
.ph-known-list{display:flex;flex-direction:column;gap:3px}
.ph-known-row{display:flex;align-items:center;gap:5px;padding:3px 5px;border-radius:calc(4px * var(--aw-r));background:var(--aw-input-bg,rgba(255,255,255,.06));border:1px solid var(--aw-input-border,rgba(255,255,255,.14))}
.ph-known-av{width:18px;height:18px;border-radius:calc(50% * var(--aw-r,1));background:var(--aw-bg-2,#161b24);display:flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0}
.ph-known-badge{min-width:14px;height:14px;padding:0 3px;border-radius:calc(999px * var(--aw-r));display:flex;align-items:center;justify-content:center;background:rgba(236,196,118,0.96);color:#20160d;font-size:6px;font-weight:700;line-height:1;margin-left:auto;flex-shrink:0}
.ph-known-role{padding:1px 5px;border-radius:calc(999px * var(--aw-r));font-size:6px}
.ph-known-role.evil{background:rgba(110,12,12,0.5);border:1px solid rgba(220,60,60,0.4);color:#fca5a5}
.ph-known-role.good{background:rgba(7,50,120,0.4);border:1px solid rgba(78,158,255,0.4);color:#bfdbfe}

/* ── Panel header (gold left-border + gradient) used across stats/history ── */
.ph-panel-hd{display:flex;align-items:center;justify-content:space-between;padding:5px 7px;border-left:2px solid #d8b06b;background:linear-gradient(90deg,rgba(216,176,107,0.16),transparent);border-bottom:1px solid rgba(216,176,107,0.10);margin-bottom:0;border-radius:0}
.ph-panel-title{color:#f2e5c8;font-size:8px;font-weight:700;letter-spacing:1px}
.ph-panel-sub{color:rgba(216,176,107,0.5);font-size:6.5px}

/* ── Mission vote table ── */
.ph-mission-table{width:100%;border-radius:calc(5px * var(--aw-r));overflow:hidden;border:1px solid var(--aw-panel-border,rgba(255,255,255,.08))}
.ph-mt-head{display:grid;background:rgba(255,255,255,0.04);padding:3px 5px;font-size:5.5px;font-weight:700;color:var(--aw-subtext,#aeb6c7);letter-spacing:0.5px}
.ph-mt-row{display:grid;padding:3.5px 5px;border-top:1px solid rgba(255,255,255,0.05);align-items:center}
.ph-mt-row:nth-child(even){background:rgba(255,255,255,0.02)}
.ph-mt-round{font-size:5.5px;font-weight:700;color:var(--aw-subtext,#aeb6c7)}
.ph-mt-team{display:flex;gap:2px;align-items:center}
.ph-mt-av{width:11px;height:11px;border-radius:calc(50% * var(--aw-r,1));background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:6px;border:1px solid rgba(255,255,255,.12)}
.ph-mt-votes{display:flex;gap:2px;align-items:center}
.ph-mt-v{font-size:6px;font-weight:700;min-width:10px;text-align:center}
.ph-mt-v.y{color:#50dc8c}.ph-mt-v.n{color:#ff6b6b}
.ph-mt-result{font-size:6px;font-weight:700;padding:1px 4px;border-radius:calc(999px * var(--aw-r))}
.ph-mt-result.ok{background:rgba(80,220,140,0.15);color:#50dc8c;border:1px solid rgba(80,220,140,0.3)}
.ph-mt-result.ng{background:rgba(220,80,80,0.15);color:#ff6b6b;border:1px solid rgba(220,80,80,0.3)}

/* ── AI speak / chat section ── */
.ph-speak-list{display:flex;flex-direction:column;gap:4px}
.ph-speak-row{display:flex;align-items:flex-start;gap:4px}
.ph-speak-row.me{flex-direction:row-reverse}
.ph-speak-av{width:16px;height:16px;border-radius:calc(50% * var(--aw-r,1));background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:8px;flex-shrink:0;border:1px solid rgba(255,255,255,.12)}
.ph-speak-wrap{display:flex;flex-direction:column;gap:1px;max-width:76%}
.ph-speak-wrap.me{align-items:flex-end}
.ph-speak-nm{font-size:5px;color:var(--aw-subtext,#aeb6c7);margin:0 2px}
.ph-speak-bubble{padding:4px 6px;border-radius:calc(5px * var(--aw-r));font-size:6px;line-height:1.55;color:var(--aw-text,#eef1f7)}
.ph-speak-bubble.other{background:var(--aw-input-bg,rgba(255,255,255,.07));border:1px solid var(--aw-input-border,rgba(255,255,255,.12))}
.ph-speak-bubble.me{background:linear-gradient(135deg,rgba(216,176,107,0.22),rgba(216,176,107,0.12));border:1px solid rgba(216,176,107,0.28);color:#f2e5c8}
.ph-speak-bubble.ai{background:rgba(78,158,255,0.10);border:1px solid rgba(78,158,255,0.22);color:#bfdbfe}

/* ── Stats overview ── */
.ph-ov-nums{display:flex;align-items:center;padding:8px 8px 6px}
.ph-ov-block{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px}
.ph-ov-num{font-size:20px;font-weight:900;line-height:1;letter-spacing:-1px}
.ph-ov-lbl{font-size:5.5px;color:rgba(255,255,255,0.3);letter-spacing:2px}
.ph-ov-divider{width:1px;height:30px;background:rgba(216,176,107,0.15)}

/* Faction bar */
.ph-faction-wrap{padding:0 7px 8px}
.ph-faction-bar-labels{display:flex;justify-content:space-between;margin-bottom:3px}
.ph-faction-bar-track{height:4px;border-radius:calc(999px * var(--aw-r));background:rgba(255,255,255,0.06);overflow:hidden;display:flex}
.ph-faction-bar-good{height:100%;background:var(--aw-faction-good,linear-gradient(90deg,#2a6ab0,#4e9eff))}
.ph-faction-bar-evil{height:100%;background:var(--aw-faction-evil,linear-gradient(90deg,#c03030,#e05050))}
.ph-faction-cards{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:5px}
.ph-fc{border-radius:calc(5px * var(--aw-r));padding:5px 6px}
.ph-fc.good{background:rgba(78,158,255,0.07);border:1px solid rgba(78,158,255,0.22)}
.ph-fc.evil{background:rgba(220,60,60,0.07);border:1px solid rgba(220,60,60,0.22)}
.ph-fc-title{display:block;font-size:6.5px;font-weight:700;letter-spacing:1px;margin-bottom:2px}
.ph-fc.good .ph-fc-title{color:#7ac7ff}.ph-fc.evil .ph-fc-title{color:#ff8080}
.ph-fc-big{font-size:13px;font-weight:900;line-height:1}
.ph-fc.good .ph-fc-big{color:#4e9eff}.ph-fc.evil .ph-fc-big{color:#e05050}
.ph-fc-small{font-size:5.5px;color:rgba(255,255,255,0.3)}
.ph-fc-rate{display:block;font-size:7px;font-weight:600;margin-top:1px}
.ph-fc.good .ph-fc-rate{color:#6edea8}.ph-fc.evil .ph-fc-rate{color:#ff9898}

/* Role grid */
.ph-role-grid{display:grid;grid-template-columns:1fr 1fr}
.ph-role-cell{padding:7px 4px 8px;display:flex;flex-direction:column;align-items:center;gap:3px;border-right:1px solid rgba(255,255,255,0.05);border-bottom:1px solid rgba(255,255,255,0.05);position:relative}
.ph-role-cell:nth-child(2n){border-right:none}
.ph-role-cell:nth-last-child(1),.ph-role-cell:nth-last-child(2){border-bottom:none}
.ph-role-cell-topbar{position:absolute;top:0;left:0;right:0;height:1.5px}
.ph-role-cell-topbar.good{background:linear-gradient(90deg,transparent,rgba(78,158,255,0.7) 50%,transparent)}
.ph-role-cell-topbar.evil{background:linear-gradient(90deg,transparent,rgba(220,80,80,0.7) 50%,transparent)}
.ph-gauge{position:relative;width:36px;height:36px;margin-top:3px}
.ph-gauge-ring{position:absolute;top:0;left:0;width:36px;height:36px;border-radius:calc(50% * var(--aw-r,1))}
.ph-gauge-inner{position:absolute;top:4px;left:4px;width:28px;height:28px;border-radius:calc(50% * var(--aw-r,1));background:rgba(14,18,28,0.96);overflow:hidden;display:flex;align-items:center;justify-content:center}
.ph-gauge-inner img{width:100%;height:100%;object-fit:cover;border-radius:calc(50% * var(--aw-r,1))}
.ph-rs-name{font-size:7px;font-weight:700;text-align:center}
.ph-rs-name.good{color:#7ac7ff}.ph-rs-name.evil{color:#ff8a8a}
.ph-rs-games{font-size:5.5px;color:rgba(255,255,255,0.3)}
.ph-rs-rate{font-size:9px;font-weight:900;line-height:1}
.ph-rs-rate.hi{color:#50dc8c}.ph-rs-rate.lo{color:#ff8080}.ph-rs-rate.na{color:rgba(255,255,255,.18);font-size:8px}

/* Skin picker */
.ph-skin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;padding:5px 5px 6px}
.ph-skin-card{border-radius:calc(4px * var(--aw-r));border:1.5px solid rgba(255,255,255,0.1);padding:4px 2px;display:flex;flex-direction:column;align-items:center;gap:2px;position:relative;background:rgba(255,255,255,0.03)}
.ph-skin-card.on{border-color:var(--aw-accent,#d9b36b);background:rgba(217,179,107,0.06)}
.ph-skin-dots{display:flex;gap:2px;align-items:center;justify-content:center;height:12px}
.ph-skin-dot{width:7px;height:7px;border-radius:calc(50% * var(--aw-r,1));border:0.5px solid rgba(255,255,255,0.15)}
.ph-skin-name{font-size:5.5px;color:rgba(220,210,190,0.75);text-align:center}
.ph-skin-check{position:absolute;top:1px;right:2px;font-size:6px;color:var(--aw-accent,#d9b36b)}

/* ── History cards ── */
.ph-hc{position:relative;overflow:hidden;border-radius:calc(8px * var(--aw-r));border:1px solid var(--aw-panel-border,rgba(255,255,255,.08));margin-bottom:6px;background:var(--aw-bg-2,#0c101c);box-shadow:0 2px 8px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.04)}
.ph-hc.win{border-color:rgba(80,220,140,0.28)}
.ph-hc.lose{border-color:rgba(220,80,80,0.25)}
.ph-hc.spec{border-color:rgba(216,176,107,0.28)}
.ph-hc::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px}
.ph-hc.win::before{background:linear-gradient(180deg,rgba(80,220,140,0.85),rgba(80,220,140,0.1))}
.ph-hc.lose::before{background:linear-gradient(180deg,rgba(220,80,80,0.85),rgba(220,80,80,0.1))}
.ph-hc.spec::before{background:linear-gradient(180deg,rgba(216,176,107,0.8),rgba(216,176,107,0.1))}
.ph-hc-body{padding:6px 7px 5px 9px;position:relative}
.ph-hc-top{display:flex;align-items:flex-start;gap:5px}
.ph-hc-av{width:28px;height:28px;border-radius:calc(50% * var(--aw-r,1));border:1.5px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;background:rgba(20,26,44,0.9);font-size:13px}
.ph-hc-av.good{border-color:#4e9eff;box-shadow:0 0 6px rgba(78,158,255,0.3)}
.ph-hc-av.evil{border-color:#e05050;box-shadow:0 0 6px rgba(220,80,80,0.3)}
.ph-hc-av img{width:100%;height:100%;object-fit:cover;border-radius:calc(50% * var(--aw-r,1))}
.ph-hc-info{flex:1;min-width:0}
.ph-hc-headrow{display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:2px}
.ph-hc-rolename{font-size:8px;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ph-hc-rolename.good{color:#7ac7ff}.ph-hc-rolename.evil{color:#ff8a8a}
.ph-hc-badge{display:flex;align-items:center;gap:2px;padding:2px 6px;border-radius:calc(999px * var(--aw-r));border:1px solid transparent;flex-shrink:0}
.ph-hc-badge.win{background:rgba(80,220,140,0.12);border-color:rgba(80,220,140,0.35)}
.ph-hc-badge.lose{background:rgba(220,80,80,0.12);border-color:rgba(220,80,80,0.32)}
.ph-hc-badge-dot{width:4px;height:4px;border-radius:calc(50% * var(--aw-r,1))}
.ph-hc-badge.win .ph-hc-badge-dot{background:#50dc8c}
.ph-hc-badge.lose .ph-hc-badge-dot{background:#ff6b6b}
.ph-hc-badge-txt{font-size:6px;font-weight:700;letter-spacing:1px}
.ph-hc-badge.win .ph-hc-badge-txt{color:#50dc8c}
.ph-hc-badge.lose .ph-hc-badge-txt{color:#ff8080}
.ph-hc-meta{display:flex;align-items:center;gap:3px;line-height:1}
.ph-hc-metaitem{font-size:6px;color:rgba(200,210,230,0.42)}
.ph-hc-metasep{width:3px;height:3px;border-radius:calc(50% * var(--aw-r,1));background:rgba(255,255,255,0.18);flex-shrink:0}
.ph-hc-bottom{display:flex;align-items:center;flex-wrap:wrap;gap:3px;margin-top:5px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.055)}
.ph-hc-medal{display:flex;align-items:center;gap:2px;padding:2px 5px;border-radius:calc(999px * var(--aw-r));background:rgba(216,176,107,0.06);border:1px solid rgba(216,176,107,0.16)}
.ph-hc-medal-txt{font-size:5.5px;color:rgba(216,176,107,0.72)}
/* medals in role stats */
.ph-medal-section{padding:6px 8px}
.ph-medal-section+.ph-medal-section{border-top:1px solid rgba(255,255,255,0.06);padding-top:6px}
.ph-medal-section-title{display:block;font-size:7px;font-weight:700;letter-spacing:1px;margin-bottom:5px;padding-left:4px}
.ph-medal-section-title.good{color:#7ac7ff;border-left:2px solid rgba(78,158,255,0.6)}
.ph-medal-section-title.evil{color:#ff8a8a;border-left:2px solid rgba(220,80,80,0.6)}
.ph-medal-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.ph-medal-card{display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 3px;border-radius:calc(6px * var(--aw-r));background:rgba(216,176,107,0.05);border:1px solid rgba(216,176,107,0.14);text-align:center}
.ph-medal-zero{opacity:0.32}
.ph-medal-name{font-size:5.5px;color:rgba(242,229,200,0.75);line-height:1.3}
.ph-medal-cnt{font-size:8px;font-weight:800;color:#d8b06b}
.ph-hc-time{margin-left:auto;font-size:5.5px;color:rgba(200,210,230,0.3);white-space:nowrap}

/* pagination */
.ph-pagination{position:absolute;bottom:0;left:0;right:0;z-index:10;padding:8px 14px 12px;background:linear-gradient(0deg,rgba(6,8,15,1) 55%,rgba(6,8,15,.6) 80%,transparent);display:flex;align-items:center;justify-content:center;gap:12px}

/* ── Bottom panel toggle (发言/投票/任务) ── */
.ph-panel-toggle{display:flex;gap:1px;padding:3px 8px 3px;background:rgba(0,0,0,.25);border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0;z-index:10}
.ph-toggle-btn{flex:1;text-align:center;padding:3px 0;font-size:6.5px;color:var(--aw-subtext,#aeb6c7);cursor:pointer;border-radius:calc(3px * var(--aw-r));transition:all .1s}
.ph-toggle-btn.active{background:rgba(255,255,255,.09);color:var(--aw-text,#eef1f7);font-weight:700}

/* ── Speak panel (发言) ── */
.ph-spk-card{position:relative;z-index:10;flex-shrink:0;background:var(--aw-panel,rgba(19,23,31,.82));border-top:1px solid var(--aw-nav-border,rgba(255,255,255,.08));padding:6px 8px 18px}
.ph-spk-accent{height:2px;background:linear-gradient(90deg,transparent,var(--aw-accent,#d9b36b) 50%,transparent);margin:-6px -8px 5px}
.ph-spk-top{display:flex;align-items:center;gap:6px;margin-bottom:5px}
.ph-spk-av{width:22px;height:22px;border-radius:calc(50% * var(--aw-r,1));background:rgba(12,10,8,.5);border:1px solid var(--aw-panel-border,rgba(255,255,255,.1));display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;position:relative}
.ph-spk-dot{position:absolute;right:-2px;top:-2px;width:6px;height:6px;border-radius:calc(50% * var(--aw-r,1));background:#4ade80;border:1px solid rgba(0,0,0,.5)}
.ph-spk-info{flex:1;min-width:0}
.ph-spk-nm{font-size:8px;font-weight:700;color:var(--aw-text,#eef1f7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ph-spk-hint{font-size:5.5px;color:var(--aw-subtext,#aeb6c7);margin-top:1px}
.ph-spk-timer{font-size:9px;font-weight:700;color:var(--aw-accent,#d9b36b);flex-shrink:0}
.ph-spk-track{height:3px;background:rgba(255,255,255,.06);border-radius:calc(999px * var(--aw-r));overflow:hidden;margin-bottom:5px}
.ph-spk-fill{height:100%;border-radius:calc(999px * var(--aw-r));background:var(--aw-accent,#d9b36b)}
.ph-spk-divider{width:100%;height:1px;background:var(--aw-input-bg,rgba(255,255,255,.06));margin:4px 0}
.ph-spk-input-row{display:flex;gap:3px;margin-bottom:3px}
.ph-spk-input{flex:1;background:var(--aw-input-bg,rgba(255,255,255,.06));border:1px solid var(--aw-input-border,rgba(255,255,255,.14));border-radius:calc(4px * var(--aw-r));color:var(--aw-subtext,#aeb6c7);font-size:7px;padding:3px 5px}
.ph-spk-send{background:linear-gradient(180deg,#e4c281,#c89b52);color:#1a1510;border-radius:calc(4px * var(--aw-r));padding:3px 8px;font-size:7px;font-weight:700;flex-shrink:0}
.ph-spk-end{width:100%;background:transparent;border:1px solid var(--aw-btn-ghost-border,rgba(255,255,255,.2));color:var(--aw-btn-ghost-text,#eef1f7);border-radius:calc(4px * var(--aw-r));padding:4px;font-size:7px;text-align:center}

/* ── End-game reveal grid ── */
.ph-reveal-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.ph-reveal-card{border-radius:calc(5px * var(--aw-r));padding:5px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;border:1px solid transparent;position:relative}
.ph-reveal-card.good{background:rgba(7,50,120,.22);border-color:rgba(78,158,255,.32)}
.ph-reveal-card.evil{background:rgba(100,15,15,.28);border-color:rgba(220,60,60,.32)}
.ph-reveal-av{width:26px;height:26px;border-radius:calc(50% * var(--aw-r,1));display:flex;align-items:center;justify-content:center;font-size:13px;overflow:hidden;flex-shrink:0}
.ph-reveal-av.good{border:1.5px solid rgba(78,158,255,.72);box-shadow:0 0 6px rgba(78,158,255,.28);background:rgba(7,40,110,.4)}
.ph-reveal-av.evil{border:1.5px solid rgba(220,60,60,.72);box-shadow:0 0 6px rgba(200,40,40,.28);background:rgba(45,6,6,.8)}
.ph-reveal-av img{width:100%;height:100%;object-fit:cover}
.ph-reveal-nm{font-size:6.5px;font-weight:700;color:var(--aw-text,#eef1f7)}
.ph-reveal-role{font-size:5.5px;padding:1px 5px;border-radius:calc(999px * var(--aw-r))}
.ph-reveal-role.good{background:rgba(7,50,120,.4);border:1px solid rgba(78,158,255,.4);color:#bfdbfe}
.ph-reveal-role.evil{background:rgba(100,15,15,.5);border:1px solid rgba(220,60,60,.4);color:#fca5a5}
.ph-reveal-dead{position:absolute;top:2px;right:3px;font-size:7px;opacity:.65}
/* Result banner */
.ph-end-banner{border-radius:calc(8px * var(--aw-r));padding:8px 10px;text-align:center;margin-bottom:4px}
.ph-end-banner.good-win{background:linear-gradient(135deg,rgba(7,50,120,.55),rgba(12,14,30,.90));border:1px solid rgba(78,158,255,.42)}
.ph-end-banner.evil-win{background:linear-gradient(135deg,rgba(100,15,15,.60),rgba(16,6,6,.92));border:1px solid rgba(220,60,60,.40)}
.ph-end-title{font-size:14px;font-weight:900;letter-spacing:2px;line-height:1.2}
.ph-end-banner.good-win .ph-end-title{color:#7ac7ff;text-shadow:0 0 16px rgba(78,158,255,.6)}
.ph-end-banner.evil-win .ph-end-title{color:#ff8a8a;text-shadow:0 0 16px rgba(220,80,80,.6)}
.ph-end-sub{font-size:6.5px;margin-top:3px;opacity:.55}
.ph-pg-arrow{width:22px;height:22px;border-radius:calc(50% * var(--aw-r,1));background:rgba(255,255,255,0.07);border:1px solid rgba(216,176,107,0.28);color:#d8b06b;font-size:12px;display:flex;align-items:center;justify-content:center}
.ph-pg-indicator{display:flex;flex-direction:column;align-items:center;gap:1px;min-width:22px}
.ph-pg-num{font-size:11px;font-weight:700;line-height:1;color:#d8b06b}
.ph-pg-lbl{font-size:5px;letter-spacing:2px;color:rgba(200,210,230,0.35)}

::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}

/* ─── Mobile ─── */
`;

class PhonePreview {
  constructor(frameEl) {
    PhonePreview._ensureBaseStyles();
    this.frame = frameEl;
    this.tab = 'home';
    this.homeState = 'loggedin';
    this.gameView = 'table';
    this.centerState = '';
    this.detailResult = 'success';
    this.animView = 'expedition';
    this.endgame = 'good';
    this._getVars = () => '';
    this._getAsset = () => null;
    this._getSkinId = () => 'dark-gold';
    this._getExtraCss = () => '';
    this._getState = null;   // external state provider (optional)
    this._onStateChange = null;
    this._lastKey = null;    // cache key for skipping unchanged renders
    window.__pp = this;
  }

  setConfig({ getVars, getAsset, getSkinId, getExtraCss, getState, onStateChange }) {
    if (getVars)       this._getVars = getVars;
    if (getAsset)      this._getAsset = getAsset;
    if (getSkinId)     this._getSkinId = getSkinId;
    if (getExtraCss)   this._getExtraCss = getExtraCss;
    if (getState)      this._getState = getState;
    if (onStateChange) this._onStateChange = onStateChange;
  }

  setTab(tab) { this.tab = tab; if (this._onStateChange) this._onStateChange(); this.render(); }
  setHomeState(s) { this.homeState = s; if (this._onStateChange) this._onStateChange(); this.render(); }
  setAnimView(v)  { this.animView = v;  if (this._onStateChange) this._onStateChange(); this.render(); }
  setGameView(view) {
    this.gameView = view;
    if (view === 'vote')    this.centerState = 'confirm';
    if (view === 'mission') this.centerState = 'mission-progress';
    if (view === 'reveal')  this.centerState = 'success';
    if (this._onStateChange) this._onStateChange();
    this.render();
  }
  setState(updates) {
    Object.assign(this, updates);
    if (this._onStateChange) this._onStateChange();
    this.render();
  }

  invalidateCache() { this._lastKey = null; }

  _stateKey() {
    return [this.tab, this.homeState, this.gameView, this.centerState,
            this.detailResult, this.animView, this.endgame,
            this._getSkinId(), this._getVars()].join('|');
  }

  render() {
    // Sync from external state provider if configured
    if (this._getState) {
      const s = this._getState();
      if (s.tab            != null) this.tab            = s.tab;
      if (s.homeState      != null) this.homeState      = s.homeState;
      if (s.gameView       != null) this.gameView       = s.gameView;
      if (s.centerState    != null) this.centerState    = s.centerState;
      if (s.detailResult   != null) this.detailResult   = s.detailResult;
      if (s.animView       != null) this.animView       = s.animView;
      if (s.endgame        != null) this.endgame        = s.endgame;
    }
    const vars = this._getVars();
    const key = this._stateKey();
    if (key === this._lastKey) return;
    this._lastKey = key;
    const extraCss = this._getExtraCss();
    if (extraCss) {
      let el = document.getElementById('pp-extra-styles');
      if (!el || el.dataset.skin !== this._skin()) {
        if (el) el.remove();
        el = document.createElement('style');
        el.id = 'pp-extra-styles';
        el.dataset.skin = this._skin();
        el.textContent = extraCss;
        document.head.appendChild(el);
      }
    }
    let html;
    switch (this.tab) {
      case 'home':      html = this._home(); break;
      case 'game':      html = this._game(); break;
      case 'profile':   html = this._profile(); break;
      case 'history':   html = this._history(); break;
      case 'detail':    html = this._detail(); break;
      case 'animation': html = this._animation(); break;
      case 'ui':        html = this._ui(); break;
      default:          html = this._home();
    }
    this.frame.innerHTML = `<div class="phone-screen" style="${vars};position:relative;display:flex;flex-direction:column">${html}</div>`;
  }

  renderSubtabs(barEl) {
    if (!barEl) return;
    const tab = this.tab;
    let btns = '';
    const btn = (lbl, onclick, active) => {
      const baseStyle = 'padding:3px 8px;border-radius:4px;font-size:10px;cursor:pointer;white-space:nowrap;';
      const style = active
        ? baseStyle + 'background:var(--accent,rgba(201,156,70,0.8));color:#000;font-weight:600;border:1px solid transparent;'
        : baseStyle + 'background:transparent;color:var(--sub,#888);border:1px solid var(--border,rgba(255,255,255,.12));';
      return `<div onclick="${onclick}" style="${style}">${lbl}</div>`;
    };
    if (tab === 'home') {
      btns = btn('未登录', "__pp.setHomeState('loggedout')", this.homeState === 'loggedout')
           + btn('已登录', "__pp.setHomeState('loggedin')",  this.homeState === 'loggedin');
    } else if (tab === 'game') {
      btns = btn('圆桌',   "__pp.setGameView('table')",    this.gameView === 'table')
           + btn('查看身份',"__pp.setGameView('identity')", this.gameView === 'identity')
           + btn('发言中', "__pp.setGameView('speak')",    this.gameView === 'speak')
           + btn('投票',   "__pp.setGameView('vote')",     this.gameView === 'vote')
           + btn('出征',   "__pp.setGameView('mission')",  this.gameView === 'mission')
           + btn('揭晓',   "__pp.setGameView('reveal')",   this.gameView === 'reveal');
    } else if (tab === 'animation') {
      btns = btn('出征中',   "__pp.setAnimView('expedition')",    this.animView === 'expedition')
           + btn('任务成功', "__pp.setAnimView('success')",       this.animView === 'success')
           + btn('任务失败', "__pp.setAnimView('fail')",          this.animView === 'fail')
           + btn('刺杀结算', "__pp.setAnimView('assassination')", this.animView === 'assassination');
    } else if (tab === 'detail') {
      btns = btn('成功', "__pp.setState({detailResult:'success'})", this.detailResult === 'success')
           + btn('失败', "__pp.setState({detailResult:'fail'})",    this.detailResult === 'fail');
    }
    barEl.innerHTML = `<div style="display:flex;gap:4px;flex-wrap:wrap">${btns}</div>`;
  }

  // ── Internal skin helpers ────────────────────────────────────────
  _skin() { return this._getSkinId(); }
  _isCelestial() { return this._skin() === 'celestial'; }
  _isDungeon()   { return this._skin() === 'dark-dungeon'; }
  _isLightSkin() { return this._isCelestial(); }

  _bgLayer(type) {
    const id  = type === 'home' ? 'home-bg' : 'in-game-bg';
    const url = this._getAsset(id);
    if (url) {
      if (this._isDungeon()) {
        return `<img src="${url}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0" onerror="this.style.display='none'">
                <div style="position:absolute;inset:0;z-index:1;background:rgba(8,4,2,0.52)"></div>`;
      }
      if (this._isCelestial()) {
        return `<img src="${url}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;filter:brightness(0.82)" onerror="this.style.display='none'">`;
      }
      return `<img src="${url}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0" onerror="this.style.display='none'">
              <div style="position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(10,12,18,.58) 0%,rgba(10,12,18,.86) 100%)"></div>`;
    }
    return `<div style="position:absolute;inset:0;z-index:0;background:var(--aw-bg,#090b11)"></div>`;
  }

  _maskDiv() {
    if (this._isCelestial()) return '';
    if (this._isDungeon()) {
      return `<div style="position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(180deg,rgba(8,4,2,.42) 0%,rgba(8,4,2,.72) 100%)"></div>`;
    }
    return `<div style="position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(180deg,rgba(10,12,18,.58) 0%,rgba(10,12,18,.86) 100%)"></div>`;
  }

  _nav(title, opts = {}) {
    if (this._isCelestial()) {
      return `<div class="ph-nav" style="position:relative;z-index:10">
        ${opts.back ? `<div class="ph-nav-back" style="width:22px;height:22px;min-width:unset;padding:0;border-radius:50%;border:1.5px solid rgba(180,148,60,0.50);background:rgba(240,234,218,0.92);color:#a07830;display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1">‹</div>` : ''}
        <div class="ph-nav-title" style="display:flex;align-items:center;gap:5px;flex:1;justify-content:center;letter-spacing:${opts.letterSpacing||'6px'}">
          <span style="flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(180,148,60,0.55))"></span>
          ${title}
          <span style="flex:1;height:1px;background:linear-gradient(to left,transparent,rgba(180,148,60,0.55))"></span>
        </div>
        ${opts.extra || (opts.back ? '<div style="width:28px"></div>' : '')}
      </div>`;
    }
    return `<div class="ph-nav" style="position:relative;z-index:10">
      ${opts.back ? `<div class="ph-nav-back">← 返回</div>` : ''}
      <div class="ph-nav-title">${title}</div>
      ${opts.extra || ''}
    </div>`;
  }

  _tableImg() {
    const url = this._getAsset('table');
    if (url) return `<div class="ph-table-circle-bg"><img src="${url}" onerror="this.style.display='none'"></div>`;
    return `<div class="ph-table-circle-bg" style="background:var(--aw-bg-2);border:1px solid var(--aw-panel-border)"></div>`;
  }

  _roleImgUrl(roleId) { return this._getAsset(roleId); }

  _dungeonCorners(sz, clr) {
    clr = clr || 'rgba(210,158,48,0.85)';
    sz  = sz  || 4;
    return `<div style="position:absolute;top:1px;left:1px;width:${sz}px;height:${sz}px;border-top:1.5px solid ${clr};border-left:1.5px solid ${clr};z-index:6;pointer-events:none"></div>
            <div style="position:absolute;top:1px;right:1px;width:${sz}px;height:${sz}px;border-top:1.5px solid ${clr};border-right:1.5px solid ${clr};z-index:6;pointer-events:none"></div>
            <div style="position:absolute;bottom:1px;left:1px;width:${sz}px;height:${sz}px;border-bottom:1.5px solid ${clr};border-left:1.5px solid ${clr};z-index:6;pointer-events:none"></div>
            <div style="position:absolute;bottom:1px;right:1px;width:${sz}px;height:${sz}px;border-bottom:1.5px solid ${clr};border-right:1.5px solid ${clr};z-index:6;pointer-events:none"></div>`;
  }

  _cSec(lbl) {
    if (!this._isCelestial()) return '';
    return `<div style="display:flex;align-items:center;gap:4px;padding:0 1px 3px">
      <span style="color:rgba(192,148,53,0.85);font-size:6px;line-height:1">◆</span>
      <span style="flex:1;height:1px;background:rgba(180,148,60,0.30)"></span>
      <span style="font-size:5.5px;letter-spacing:2.5px;color:rgba(130,95,35,0.75);font-weight:600">${lbl}</span>
      <span style="flex:1;height:1px;background:rgba(180,148,60,0.30)"></span>
      <span style="color:rgba(192,148,53,0.85);font-size:6px;line-height:1">◆</span>
    </div>`;
  }

  _cDivider(lbl) {
    return `<div style="display:flex;align-items:center;gap:4px;padding:0 0 5px">
      <span style="color:rgba(192,148,53,0.85);font-size:6px;line-height:1">◆</span>
      <span style="flex:1;height:1px;background:rgba(180,148,60,0.30)"></span>
      <span style="font-size:5.5px;letter-spacing:2.5px;color:rgba(130,95,35,0.75);font-weight:600">${lbl}</span>
      <span style="flex:1;height:1px;background:rgba(180,148,60,0.30)"></span>
      <span style="color:rgba(192,148,53,0.85);font-size:6px;line-height:1">◆</span>
    </div>`;
  }

  _makeDetailSection(title, contentHtml, extraStyle = '') {
    const styleAttr = extraStyle ? ` style="${extraStyle}"` : '';
    if (this._isCelestial()) {
      return `${this._cDivider(title)}<div class="ph-panel"${styleAttr}>${contentHtml}</div>`;
    }
    return `<div class="ph-panel"${styleAttr}>${title ? `<div class="ph-section-hd">${title}</div>` : ''}${contentHtml}</div>`;
  }

  _makeMissionPills(pills) {
    return `<div class="ph-pills-row">${pills.map(p =>
      `<div class="ph-pill ${p.s}"><div class="ph-pill-icon">${p.s==='success'?'✓':p.s==='fail'?'✗':''}</div><div class="ph-pill-lbl">${p.lbl}</div>${p.sz?`<div class="ph-pill-lbl">${p.sz}</div>`:''}</div>`
    ).join('')}</div>`;
  }

  _makeMissionTable(rows) {
    const isCel = this._isCelestial();
    const okClr = isCel ? '#2a7040' : '#72e0a0';
    const ngClr = isCel ? '#9a3030' : '#f07070';
    const cols = '12px 1fr 38px 26px';
    return `<div class="ph-mission-table">
      <div class="ph-mt-head" style="grid-template-columns:${cols};background:var(--aw-input-bg,rgba(255,255,255,.04));color:var(--aw-subtext,#aeb6c7)">
        <span>轮</span><span>队员</span><span>投票</span><span>结果</span>
      </div>${rows.map(row =>
      `<div class="ph-mt-row" style="grid-template-columns:${cols};border-top:1px solid var(--aw-panel-border,rgba(255,255,255,.05))">
        <span style="font-size:5px;color:var(--aw-subtext)">${row.r}</span>
        <span style="font-size:5px;color:var(--aw-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${row.team}</span>
        <span style="font-size:5px;color:var(--aw-subtext)">${row.votes}</span>
        <span style="font-size:5px;color:${row.s==='success'?okClr:ngClr};font-weight:600">${row.resultTxt}</span>
      </div>`).join('')}
    </div>`;
  }

  _makeSpeakList(messages) {
    const isCel = this._isCelestial();
    const isDun = this._isDungeon();
    if (isCel) {
      return `<div style="display:flex;flex-direction:column;gap:5px">${messages.map(msg => {
        if (msg.isAI) return `<div style="display:flex;align-items:flex-start;gap:5px">
          <div style="width:20px;height:20px;border-radius:50%;background:rgba(120,170,255,0.12);border:1.5px solid rgba(100,155,240,0.40);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">🤖</div>
          <div style="display:flex;flex-direction:column;gap:1px"><span style="font-size:5.5px;color:rgba(78,120,195,0.70);margin-left:1px">AI · 分析</span>
            <div style="background:rgba(235,242,255,0.80);border:1px solid rgba(100,155,240,0.30);border-radius:0 5px 5px 5px;padding:4px 6px;font-size:6.5px;color:rgba(40,60,110,0.78);line-height:1.5;max-width:130px">${msg.text}</div>
          </div></div>`;
        if (msg.isMe) return `<div style="display:flex;align-items:flex-start;gap:5px;flex-direction:row-reverse">
          <div style="width:20px;height:20px;border-radius:50%;background:rgba(192,148,53,0.22);border:1.5px solid rgba(192,148,53,0.65);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">${msg.avatar}</div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px"><span style="font-size:5.5px;color:rgba(100,72,25,0.60);margin-right:1px">${msg.from}（我）</span>
            <div style="background:linear-gradient(135deg,rgba(255,244,180,0.60),rgba(240,220,150,0.45));border:1px solid rgba(192,148,53,0.48);border-radius:5px 0 5px 5px;padding:4px 6px;font-size:6.5px;color:rgba(55,36,10,0.85);line-height:1.5;max-width:130px">${msg.text}</div>
          </div></div>`;
        return `<div style="display:flex;align-items:flex-start;gap:5px">
          <div style="width:20px;height:20px;border-radius:50%;background:rgba(55,148,215,0.18);border:1.5px solid rgba(55,148,215,0.55);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0">${msg.avatar}</div>
          <div style="display:flex;flex-direction:column;gap:1px"><span style="font-size:5.5px;color:rgba(100,72,25,0.60);margin-left:1px">${msg.from}</span>
            <div style="background:rgba(248,242,228,0.90);border:1px solid rgba(192,150,52,0.32);border-radius:0 5px 5px 5px;padding:4px 6px;font-size:6.5px;color:rgba(55,36,10,0.85);line-height:1.5;max-width:130px">${msg.text}</div>
          </div></div>`;
      }).join('')}</div>`;
    }
    return `<div class="ph-speak-list">${messages.map(msg => {
      if (msg.isAI) return `<div class="ph-speak-row"><div class="ph-speak-av" style="background:rgba(78,158,255,0.15);border-color:rgba(78,158,255,0.35)">${isDun?'AI':'🤖'}</div><div class="ph-speak-wrap"><span class="ph-speak-nm" style="color:rgba(78,158,255,0.7)">AI · 分析</span><div class="ph-speak-bubble ai">${msg.text}</div></div></div>`;
      if (msg.isMe) return `<div class="ph-speak-row me"><div class="ph-speak-av">${isDun?msg.avatarChar:msg.avatar}</div><div class="ph-speak-wrap me"><span class="ph-speak-nm">${msg.from}（我）</span><div class="ph-speak-bubble me">${msg.text}</div></div></div>`;
      return `<div class="ph-speak-row"><div class="ph-speak-av">${isDun?msg.avatarChar:msg.avatar}</div><div class="ph-speak-wrap"><span class="ph-speak-nm">${msg.from}</span><div class="ph-speak-bubble other">${msg.text}</div></div></div>`;
    }).join('')}</div>`;
  }

  _makeAIRecap(players) {
    return `<div style="display:flex;flex-direction:column;gap:2px">${players.map(p =>
      `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 6px;background:var(--aw-input-bg,rgba(255,255,255,.05));border:1px solid var(--aw-panel-border,rgba(255,255,255,.08));border-radius:calc(4px * var(--aw-r))">
        <span style="font-size:5.5px;color:var(--aw-text)">${p.lbl}</span>
        <span style="font-size:5px;color:var(--aw-subtext)">展开 ▼</span>
      </div>`
    ).join('')}</div>`;
  }

  _makeSwitcher(items) {
    const isCel = this._isCelestial();
    const btns = items.map(({lbl, act, stateKey, stateVal, fn}) => {
      let onclick;
      if (fn) {
        onclick = `event.stopPropagation();${fn}`;
      } else {
        onclick = `event.stopPropagation();__pp.setState({${stateKey}:${JSON.stringify(stateVal)}})`;
      }
      let style;
      if (isCel) {
        if (act) {
          style = 'padding:4px 8px 4px 5px;border-radius:2px;font-size:6.5px;cursor:pointer;white-space:nowrap;background:linear-gradient(90deg,rgba(242,230,200,0.97),rgba(235,222,195,0.92));border:1px solid rgba(192,144,53,0.50);border-left:2.5px solid rgba(192,144,53,0.92);color:rgba(108,72,12,1);font-weight:700;letter-spacing:0.5px;box-shadow:0 1px 5px rgba(130,100,40,0.18),inset 0 1px 0 rgba(255,252,230,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
        } else {
          style = 'padding:4px 8px 4px 7px;border-radius:2px;font-size:6.5px;cursor:pointer;white-space:nowrap;background:rgba(242,235,218,0.68);border:1px solid rgba(180,148,60,0.22);color:rgba(110,80,30,0.62);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)';
        }
      } else {
        const bg  = act ? 'rgba(201,156,70,0.22)' : 'rgba(0,0,0,0.4)';
        const bdr = act ? 'rgba(201,156,70,0.55)' : 'rgba(255,255,255,0.18)';
        const clr = act ? 'rgba(220,175,80,1)'    : 'rgba(255,255,255,0.45)';
        style = `padding:3px 6px;border-radius:3px;font-size:6px;cursor:pointer;white-space:nowrap;background:${bg};border:1px solid ${bdr};color:${clr};${act?'font-weight:700;':''}`;
      }
      return `<div onclick="${onclick}" style="${style}">${lbl}</div>`;
    }).join('');
    return `<div style="position:absolute;left:4px;top:50%;transform:translateY(-50%);z-index:25;display:flex;flex-direction:column;gap:3px">${btns}</div>`;
  }

  // ── HOME SCREEN ────────────────────────────────────────────────
  _home() {
    const switcher = this._makeSwitcher([
      {lbl:'未登录', act:this.homeState==='loggedout', fn:"__pp.setHomeState('loggedout')"},
      {lbl:'已登录', act:this.homeState==='loggedin',  fn:"__pp.setHomeState('loggedin')"},
    ]);
    if (this._isCelestial()) {
      return this.homeState === 'loggedout' ? this._celestialLoggedOut(switcher) : this._celestialLoggedIn(switcher);
    }
    return this.homeState === 'loggedout' ? this._defaultLoggedOut(switcher) : this._defaultLoggedIn(switcher);
  }

  _celestialLoggedOut(switcher) {
    return `
      ${this._bgLayer('home')}
      ${switcher}
      ${this._nav('AVALON')}
      <div style="flex:1;overflow-y:auto;padding:7px 7px 10px;display:flex;flex-direction:column;gap:8px;position:relative;z-index:5">
        <div style="background:rgba(233,225,207,0.93);border:1px solid rgba(180,148,60,0.32);border-radius:5px;padding:14px 12px 12px;text-align:center;box-shadow:0 2px 10px rgba(150,120,50,0.14),inset 0 1px 0 rgba(255,248,225,0.55);position:relative;overflow:hidden">
          <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,rgba(192,144,53,0.60),transparent)"></div>
          <div style="font-size:14px;margin-bottom:6px;opacity:0.55">☁</div>
          <div style="font-size:9px;font-weight:700;color:#3d2b1f;margin-bottom:3px;letter-spacing:2px">欢迎来到 AVALON</div>
          <div style="font-size:6px;color:rgba(110,80,45,0.65);margin-bottom:10px">青云仙境 · 正义与智慧之地</div>
          <input style="width:100%;box-sizing:border-box;padding:5px 9px;font-size:7.5px;background:rgba(245,248,252,.80);border:1px solid rgba(180,148,60,0.30);border-radius:8px;color:#3d2b1f;margin-bottom:8px" placeholder="设置仙号（用户名）">
          <div class="ph-btn-p" style="text-align:center;padding:7px;font-size:8px;border-radius:8px;letter-spacing:3px">踏入仙境</div>
        </div>
        ${this._cSec('已有房号')}
        <div style="background:rgba(233,225,207,0.92);border:1px solid rgba(180,148,60,0.28);border-radius:5px;padding:9px 10px;box-shadow:0 1px 6px rgba(150,120,50,0.10),inset 0 1px 0 rgba(255,248,225,0.50)">
          <div style="display:flex;gap:6px;align-items:center">
            <input style="flex:1;padding:5px 9px;font-size:7.5px;background:rgba(245,248,252,.80);border:1px solid rgba(180,148,60,0.28);border-radius:8px;color:#3d2b1f" placeholder="输入房间号">
            <div class="ph-btn-p" style="padding:5px 10px;font-size:7px;white-space:nowrap;border-radius:8px">加入</div>
          </div>
        </div>
      </div>`;
  }

  _celestialLoggedIn(switcher) {
    const histIcon  = this._getAsset('history-icon') || '';
    const statsIcon = this._getAsset('stats-icon')   || '';
    const killIcon  = this._getAsset('kill-icon')    || '';
    const roles = [
      {id:'merlin',name:'梅林',good:true},{id:'percival',name:'派西',good:true},
      {id:'arthur_loyal',name:'忠臣',good:true},{id:'arthur_loyal',name:'忠臣',good:true},
      {id:'assassin',name:'刺客',good:false},{id:'morgana',name:'莫甘娜',good:false},{id:'mordred',name:'莫德雷德',good:false},
    ];
    const roleChips = roles.map(r => {
      const u = this._roleImgUrl(r.id);
      return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px 3px 4px;border-radius:12px;border:1.5px solid ${r.good?'rgba(80,140,200,0.45)':'rgba(180,60,60,0.42)'};background:${r.good?'rgba(210,230,252,0.45)':'rgba(252,215,210,0.40)'};font-size:6.5px;font-weight:600;color:${r.good?'#2a5c9a':'#9a2828'}">
        ${u?`<img src="${u}" style="width:16px;height:16px;border-radius:50%;object-fit:cover;border:1px solid ${r.good?'rgba(80,140,200,0.40)':'rgba(180,60,60,0.38)'}" onerror="this.style.display='none'">` : ''}
        ${r.name}</span>`;
    }).join('');
    return `
      ${this._bgLayer('home')}
      ${switcher}
      ${this._nav('AVALON')}
      <div style="flex:1;overflow-y:auto;padding:6px 7px 10px;display:flex;flex-direction:column;gap:7px;position:relative;z-index:5">
        <div style="background:rgba(233,225,207,0.93);border:1px solid rgba(180,148,60,0.32);border-radius:5px;overflow:hidden;position:relative;box-shadow:0 2px 10px rgba(150,120,50,0.14),inset 0 1px 0 rgba(255,248,225,0.55)">
          <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(192,144,53,0.70),transparent)"></div>
          <div style="display:flex;align-items:center;gap:10px;padding:9px 11px 8px">
            <div style="width:34px;height:34px;border-radius:50%;border:2px solid rgba(78,150,220,0.72);background:rgba(210,230,250,0.70);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:rgba(40,90,160,0.75);box-shadow:0 0 8px rgba(78,150,220,0.20)">光</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:9px;font-weight:700;color:#3d2b1f;letter-spacing:.5px">光影</div>
              <div style="font-size:5.5px;color:rgba(110,80,45,0.62);margin-top:1.5px">点击可修改仙号与头像</div>
            </div>
            <div style="font-size:6px;color:#a07830;border:1px solid rgba(180,148,60,0.38);padding:2px 6px;border-radius:6px;background:rgba(248,244,235,0.80)">登出</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-top:1px solid rgba(180,148,60,0.18)">
            ${[{icon:histIcon,lbl:'历史对战'},{icon:statsIcon,lbl:'角色统计'},{icon:killIcon,lbl:'游戏规则'}].map((b,i)=>`
              <div style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 4px;${i<2?'border-right:1px solid rgba(180,148,60,0.14)':''}">
                ${b.icon?`<img src="${b.icon}" style="width:20px;height:20px;object-fit:contain">`:`<span style="font-size:14px;opacity:0.45">${['📜','📊','⚔'][i]}</span>`}
                <span style="font-size:5.5px;color:#705828">${b.lbl}</span>
              </div>`).join('')}
          </div>
        </div>
        ${this._cSec('布阵组局')}
        <div style="background:rgba(233,225,207,0.92);border:1px solid rgba(180,148,60,0.28);border-radius:5px;padding:9px 10px;box-shadow:0 1px 6px rgba(150,120,50,0.10),inset 0 1px 0 rgba(255,248,225,0.50)">
          <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">
            ${['5人','6人','7人','8人','9人','10人'].map((c,i)=>`<div style="padding:2px 7px;font-size:7px;border-radius:10px;border:1px solid ${i===2?'rgba(192,144,53,0.75)':'rgba(180,148,60,0.22)'};background:${i===2?'rgba(192,144,53,0.15)':'rgba(248,244,235,0.70)'};color:${i===2?'#b08828':'#6a5020'};font-weight:${i===2?'700':'400'}">${c}</div>`).join('')}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">${roleChips}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:3px 6px;border-radius:7px;border:1px solid rgba(180,148,60,0.18);background:rgba(248,244,235,0.55);margin-bottom:8px">
            <span style="font-size:6.5px;color:#8a6838">高级设置</span>
            <span style="font-size:6.5px;color:#8a6838">展开 ▼</span>
          </div>
          <div style="display:flex;gap:7px">
            <div class="ph-btn-p" style="flex:1;text-align:center;padding:7px;font-size:8px;border-radius:8px;letter-spacing:2px">创建房间</div>
            <div style="flex:1;text-align:center;padding:7px;font-size:8px;border-radius:8px;border:1px solid rgba(180,148,60,0.38);color:#a07830;background:rgba(248,244,235,0.85)">加入房间</div>
          </div>
        </div>
        ${this._cSec('仙境擂台')}
        <div style="display:flex;flex-direction:column;gap:5px">
          ${[{id:'8821',n:'7',st:'进行中',cur:5},{id:'4413',n:'10',st:'等待中',cur:3}].map(r=>`
            <div style="background:rgba(233,225,207,0.90);border:1px solid rgba(180,148,60,0.24);border-radius:4px;padding:7px 9px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 1px 4px rgba(150,120,50,0.09)">
              <div>
                <div style="font-size:9px;font-weight:700;color:#c09040;letter-spacing:.5px">${r.id} 号房</div>
                <div style="font-size:5.5px;color:rgba(110,80,45,0.65);margin-top:1.5px">${r.n}人局 · ${r.st} · ${r.cur}/${r.n}</div>
              </div>
              <div style="font-size:7px;background:linear-gradient(180deg,#5ab4d8,#3a90b8);color:#fff;padding:3px 9px;border-radius:8px;font-weight:600">加入</div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  _defaultLoggedOut(switcher) {
    return `
      ${this._bgLayer('home')}${this._maskDiv()}
      ${switcher}
      <div class="ph-nav"><div class="ph-nav-title">AVALON</div></div>
      <div class="ph-content">
        <div class="ph-panel">
          <div style="text-align:center;padding:12px 8px 6px">
            <div style="font-size:9px;font-weight:700;color:var(--aw-text);margin-bottom:2px">欢迎来到 AVALON</div>
            <div style="font-size:6px;color:var(--aw-subtext)">请先设置你的用户名</div>
          </div>
          <div style="padding:0 10px 10px;display:flex;flex-direction:column;gap:6px">
            <input style="width:100%;box-sizing:border-box;padding:5px 8px;font-size:8px;background:var(--aw-input-bg);border:1px solid var(--aw-input-border);border-radius:calc(4px * var(--aw-r));color:var(--aw-text)" placeholder="输入用户名">
            <div class="ph-btn-p" style="text-align:center;padding:6px;font-size:8px">进入游戏</div>
          </div>
        </div>
        <div style="height:1px;background:var(--aw-panel-border,rgba(255,255,255,.07));margin:2px 0"></div>
        <div class="ph-panel">
          <div class="ph-panel-hd"><span class="ph-panel-title">加入房间</span></div>
          <div style="padding:8px 10px;display:flex;gap:6px;align-items:center">
            <input style="flex:1;padding:5px 8px;font-size:8px;background:var(--aw-input-bg);border:1px solid var(--aw-input-border);border-radius:calc(4px * var(--aw-r));color:var(--aw-text)" placeholder="输入房间号">
            <div class="ph-btn-p" style="padding:5px 10px;font-size:7px;white-space:nowrap">加入</div>
          </div>
        </div>
      </div>`;
  }

  _defaultLoggedIn(switcher) {
    const histUrl  = this._getAsset('history-icon');
    const statsUrl = this._getAsset('stats-icon');
    const killUrl  = this._getAsset('kill-icon');
    const iconBtn = (url, emoji, label) => `
      <div class="ph-act-btn">
        ${url ? `<img src="${url}" style="width:18px;height:18px;object-fit:contain" onerror="this.outerHTML='<span style=font-size:11px>${emoji}</span>'">` : `<span style="font-size:11px">${emoji}</span>`}
        <span style="font-size:6px;color:var(--aw-subtext)">${label}</span>
      </div>`;
    const roles = [
      {id:'merlin',name:'梅林',cls:'good-chip'},{id:'percival',name:'派西',cls:'good-chip'},
      {id:'arthur_loyal',name:'忠臣',cls:'good-chip'},{id:'arthur_loyal',name:'忠臣',cls:'good-chip'},
      {id:'assassin',name:'刺客',cls:'evil-chip'},{id:'morgana',name:'莫甘娜',cls:'evil-chip'},{id:'mordred',name:'莫德雷德',cls:'evil-chip'},
    ];
    const chips = roles.map(r => {
      const ri = this._roleImgUrl(r.id);
      return `<span class="ph-rchip ${r.cls}">${ri?`<img class="ph-rchip-img" src="${ri}" onerror="this.style.display='none'">`:''}<span>${r.name}</span></span>`;
    }).join('');
    return `
      ${this._bgLayer('home')}${this._maskDiv()}
      ${switcher}
      <div class="ph-nav"><div class="ph-nav-title">AVALON</div></div>
      <div class="ph-content">
        <div class="ph-panel">
          <div class="ph-user-row">
            <div class="ph-av" style="font-size:9px;font-weight:700;letter-spacing:0">光</div>
            <div>
              <div style="font-size:8px;font-weight:700;color:var(--aw-text)">你好：光影</div>
              <div style="font-size:6px;color:var(--aw-subtext);margin-top:1px">点击头像或用户名即可修改</div>
            </div>
            <div class="ph-logout">登出</div>
          </div>
          <div class="ph-act-grid">
            ${iconBtn(histUrl,'📜','历史对战')}
            ${iconBtn(statsUrl,'📊','角色统计')}
            ${iconBtn(killUrl,'⚔','游戏规则')}
          </div>
        </div>
        <div class="ph-panel">
          <div class="ph-count-row">
            ${['5人','6人','7人','8人','9人','10人'].map((c,i)=>`<div class="ph-cnt${i===2?' on':''}">${c}</div>`).join('')}
          </div>
          <div class="ph-chips">${chips}</div>
          <div style="margin-bottom:5px;padding:3px 6px;border-radius:calc(4px * var(--aw-r));border:1px solid var(--aw-panel-border);background:rgba(255,255,255,.03);display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:7px;color:var(--aw-subtext)">高级设置</span>
            <span style="font-size:7px;color:var(--aw-subtext)">展开 ▼</span>
          </div>
          <div class="ph-btn-row">
            <div class="ph-btn-p">创建房间</div>
            <div class="ph-btn-g">加入房间</div>
          </div>
        </div>
        <div class="ph-panel" style="padding:6px 7px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
            <span style="font-size:7.5px;font-weight:700;color:var(--aw-subtext);letter-spacing:1px">当前房间</span>
            <span style="font-size:11px;color:var(--aw-subtext)">↻</span>
          </div>
          ${[{id:'8821',n:'7人',st:'进行中',cur:5},{id:'4413',n:'10人',st:'等待中',cur:3}].map(r=>`
            <div style="background:var(--aw-input-bg);border:1px solid var(--aw-input-border);border-radius:calc(5px * var(--aw-r));padding:5px 6px;display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
              <div>
                <div style="font-size:9px;font-weight:700;color:var(--aw-accent)">${r.id} 号房</div>
                <div style="font-size:6px;color:var(--aw-subtext);margin-top:1px">${r.n} · ${r.st} · ${r.cur}/${r.n.replace('人','')}</div>
              </div>
              <div style="font-size:7px;background:var(--aw-btn-primary-bg,var(--aw-accent));color:var(--aw-btn-primary-text,#000);padding:2px 7px;border-radius:calc(5px * var(--aw-r));font-weight:700">加入</div>
            </div>`).join('')}
        </div>
      </div>`;
  }


  // ── GAME SCREEN ────────────────────────────────────────────────
  _game() {
    const view = this.gameView;
    const n = PLAYERS.length;
    const rx = 43, ry = 36;
    const isCel = this._isCelestial();
    const isDun = this._isDungeon();
    const avSz  = isCel ? 40 : 22;
    const seatW = isCel ? 44 : 32;
    const nameFz = 5.5;
    const cardW  = 25;
    const cardFz = 5;

    const isIdentityMode = view === 'identity';
    const showRoles = view === 'reveal';

    const seatsHtml = PLAYERS.map((p, idx) => {
      const angle = (2 * Math.PI * idx) / n - Math.PI / 2;
      const left = (50 + rx * Math.cos(angle)).toFixed(1);
      const top  = (50 + ry * Math.sin(angle)).toFixed(1);
      const isLeader = p.leader;
      const isVisEvil = isIdentityMode && MERLIN_SEES_EVIL.has(idx);
      const isHidden  = isIdentityMode && !p.isMe && !MERLIN_SEES_EVIL.has(idx);
      const rImg = this._roleImgUrl(p.roleId);
      const inTeam = p.inTeam;
      const teamGlow = !isIdentityMode && inTeam && (this.centerState === 'mission-progress' || this.centerState === 'success' || this.centerState === 'fail');

      if (isDun) return this._dungeonSeat(p, idx, n, {left, top, isLeader, isIdentityMode, isVisEvil, isHidden, rImg, inTeam, teamGlow, cardW, cardFz});
      if (isCel) return this._celestialSeat(p, idx, n, {left, top, isLeader, isIdentityMode, isVisEvil, isHidden, rImg, inTeam, teamGlow, avSz, nameFz, showRoles});
      return this._defaultSeat(p, idx, n, {left, top, isLeader, isIdentityMode, isVisEvil, isHidden, rImg, inTeam, teamGlow, avSz, seatW, nameFz, showRoles});
    }).join('');

    // Pills
    const pillsHtml = isCel ? this._celestialPills() : this._defaultPills();

    // Room overlay
    const roomOverlay = view === 'room' ? this._roomOverlay() : '';

    // Action panel (bottom — based on current view)
    let actionPanel = '';
    if (view === 'vote')    actionPanel = this._votePanel();
    else if (view === 'mission') actionPanel = this._missionPanel();
    else if (view === 'speak')   actionPanel = this._speakPanel();

    const navTitle = isCel
      ? `<div class="ph-nav" style="position:relative;z-index:30"><div class="ph-nav-back" style="font-size:7px;color:var(--aw-subtext)">← 返回</div><div class="ph-nav-title" style="display:flex;align-items:center;gap:4px;flex:1;justify-content:center"><span style="flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(180,148,60,0.55))"></span>1234 号房<span style="flex:1;height:1px;background:linear-gradient(to left,transparent,rgba(180,148,60,0.55))"></span></div></div>`
      : `<div class="ph-nav" style="position:relative;z-index:30"><div class="ph-nav-back">← 返回</div><div class="ph-nav-title">1234 号房</div></div>`;

    const bdrCol = isCel ? 'rgba(180,148,60,0.40)' : 'rgba(255,255,255,0.2)';
    const topBtns = `<div style="padding:4px 5px;display:flex;gap:3px;flex-shrink:0;position:relative;z-index:30">
      <div onclick="event.stopPropagation();__pp.setGameView(__pp.gameView==='room'?'table':'room')" style="flex:1;cursor:pointer;background:${view==='room'?(isCel?'rgba(192,148,53,0.14)':'rgba(255,255,255,0.08)'):'transparent'};border:1px solid ${bdrCol};border-radius:calc(6px * var(--aw-r));padding:4px 0;font-size:7px;text-align:center;color:var(--aw-text)">房间 1234 ▼</div>
      <div onclick="event.stopPropagation();__pp.setGameView(__pp.gameView==='identity'?'table':'identity')" style="flex:1;cursor:pointer;background:${view==='identity'?'rgba(201,156,70,0.12)':'transparent'};border:1px solid ${view==='identity'?'rgba(201,156,70,0.4)':bdrCol};border-radius:calc(6px * var(--aw-r));padding:4px 0;font-size:7px;text-align:center;color:${view==='identity'?'var(--aw-accent,#d9b36b)':'var(--aw-subtext)'}">查看身份 ▼</div>
    </div>`;

    const centerEl = this.centerState === 'confirm'
      ? `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:linear-gradient(180deg,#e4c281,#c89b52);color:#1a1510;border-radius:calc(5px * var(--aw-r));padding:3px 7px;font-size:6.5px;font-weight:700;white-space:nowrap;z-index:2">确认组队</div>`
      : this.centerState === 'mission-progress'
      ? `<div class="ph-center-result mission-progress"><div class="ph-center-result-title">出征中</div><div class="ph-center-result-sub">等待队员行动…</div></div>`
      : this.centerState === 'success'
      ? `<div class="ph-center-result success"><div class="ph-center-result-title">任务成功</div><div class="ph-center-result-sub">2票成功 0票失败</div></div>`
      : this.centerState === 'fail'
      ? `<div class="ph-center-result fail"><div class="ph-center-result-title">任务失败</div><div class="ph-center-result-sub">1票成功 1票失败</div></div>`
      : '';

    const speakMessages = [
      {from:'龙影', avatar:'🐉', avatarChar:'龙', text:'我觉得第一轮赢得比较顺，月影的反应有点奇怪。'},
      {from:'光影', avatar:'🦊', avatarChar:'光', isMe:true, text:'我支持龙影的判断，第二轮失败说明队伍里有奸细。'},
      {isAI:true, text:'从投票数据看，雷鸣和月影的投票模式与好人阵营不符。'},
    ];

    const detailSection_pills = this._makeDetailSection('任务进度', `<div class="ph-pills-row">${pillsHtml}</div>`);
    const detailSection_table = this._makeDetailSection('任务详情', this._gameDetailTable());
    const detailSection_speak = this._makeDetailSection('玩家发言', this._makeSpeakList(speakMessages));

    return `
      ${this._bgLayer('in-game')}${this._maskDiv()}
      ${roomOverlay}
      ${navTitle}
      ${topBtns}
      <div class="ph-content" style="padding:0 5px;gap:4px">
        <div class="ph-table-area">
          <div class="ph-table-inner">
            ${this._tableImg()}
            ${seatsHtml}
            ${centerEl}
          </div>
        </div>
        ${detailSection_pills}
        ${detailSection_table}
        ${detailSection_speak}
      </div>
      ${actionPanel}`;
  }

  _celestialPills() {
    return [
      {cls:'success',n:1,sz:'2人'},{cls:'fail',n:2,sz:'3人'},
      {cls:'current',n:3,sz:'2'},{cls:'future',n:4,sz:'3人'},{cls:'future',n:5,sz:'3人'},
    ].map(p => {
      if (p.cls === 'current') return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(160deg,rgba(255,244,180,0.40),rgba(192,144,36,0.22));border:2px solid rgba(192,144,36,0.80);box-shadow:0 0 10px rgba(192,144,36,0.38),inset 0 1px 0 rgba(255,248,180,0.55);display:flex;flex-direction:column;align-items:center;justify-content:center">
          <span style="font-size:12px;color:rgba(120,78,8,0.95);font-weight:700;line-height:1">${p.sz}</span>
        </div>
        <span style="font-size:5px;color:rgba(130,88,15,0.72);letter-spacing:0.5px">本轮出征</span>
      </div>`;
      if (p.cls === 'success') return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:24px;height:24px;border-radius:50%;background:rgba(68,175,110,0.18);border:1.5px solid rgba(68,175,110,0.72);display:flex;align-items:center;justify-content:center">
          <span style="font-size:11px;color:rgba(35,130,72,0.92);font-weight:700">✓</span>
        </div>
        <span style="font-size:5px;color:rgba(35,130,72,0.60)">第${p.n}轮</span>
      </div>`;
      if (p.cls === 'fail') return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:24px;height:24px;border-radius:50%;background:rgba(205,60,55,0.16);border:1.5px solid rgba(205,60,55,0.68);display:flex;align-items:center;justify-content:center">
          <span style="font-size:11px;color:rgba(175,35,35,0.88);font-weight:700">✗</span>
        </div>
        <span style="font-size:5px;color:rgba(175,35,35,0.56)">第${p.n}轮</span>
      </div>`;
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:24px;height:24px;border-radius:50%;background:rgba(192,148,53,0.07);border:1px dashed rgba(192,148,53,0.36);display:flex;align-items:center;justify-content:center">
          <span style="font-size:6.5px;color:rgba(130,95,28,0.40);font-weight:500">${p.sz}</span>
        </div>
        <span style="font-size:5px;color:rgba(130,95,28,0.35)">第${p.n}轮</span>
      </div>`;
    }).join('');
  }

  _defaultPills() {
    return [
      {cls:'success',lbl:'第1轮',sz:'2人'},{cls:'fail',lbl:'第2轮',sz:'3人'},
      {cls:'current',lbl:'本轮',sz:'2'},{cls:'future',lbl:'第4轮',sz:'3人'},{cls:'future',lbl:'第5轮',sz:'3人'},
    ].map(p => {
      if (p.cls === 'current') return `<div class="ph-pill current"><div style="font-size:6px;color:var(--aw-accent);font-weight:600;line-height:1">本轮</div><div class="ph-pill-curnum">${p.sz}</div><div style="font-size:5px;color:var(--aw-accent);line-height:1">人出征</div></div>`;
      if (p.cls === 'success') return `<div class="ph-pill success"><div class="ph-pill-icon">✓</div><div class="ph-pill-lbl">${p.lbl}</div><div class="ph-pill-lbl">${p.sz}</div></div>`;
      if (p.cls === 'fail')    return `<div class="ph-pill fail"><div class="ph-pill-icon">✗</div><div class="ph-pill-lbl">${p.lbl}</div><div class="ph-pill-lbl">${p.sz}</div></div>`;
      return `<div class="ph-pill future"><div class="ph-pill-lbl">${p.lbl}</div><div style="font-size:8px;color:var(--aw-subtext);font-weight:500">${p.sz}</div></div>`;
    }).join('');
  }

  _gameDetailTable() {
    // rows: leader/team shown as player names (matching actual miniprogram mission-table)
    const nm = i => PLAYERS[i - 1]?.nm || i;
    const rows = [
      {r:1, leader:3, team:[3,5,8],     approve:7, reject:3, result:'ok', resultTxt:'成功'},
      {r:2, leader:7, team:[1,2,4,7],   approve:5, reject:5, result:'ng', resultTxt:'失败'},
      {r:3, leader:10,team:[2,6,9,10],  approve:6, reject:4, result:'ok', resultTxt:'成功'},
      {r:4, leader:4, team:[3,4,6,8,9], approve:3, reject:7, result:'ng', resultTxt:'失败'},
      {r:5, leader:1, team:[1,5,7,9,10],approve:0, reject:0, result:'cur',resultTxt:'投票中'},
    ];
    // columns: 轮(fixed) 队长(1fr) 队伍(2fr) 同/反(1.2fr) 结果(1fr)
    const cols = '12px 1fr 2fr 1.2fr 1fr';
    const headStyle = `display:grid;grid-template-columns:${cols};gap:3px;padding:3px 5px;font-size:5.5px;font-weight:700;color:var(--aw-subtext);letter-spacing:0.3px;background:rgba(255,255,255,0.04)`;
    const rowStyle = (dim) => `display:grid;grid-template-columns:${cols};gap:3px;padding:3.5px 5px;border-top:1px solid rgba(255,255,255,0.05);align-items:center${dim ? ';opacity:0.55' : ''}`;
    return `<div class="ph-mission-table">
      <div style="${headStyle}"><span>轮</span><span>队长</span><span>队伍</span><span style="text-align:center">同/反</span><span style="text-align:center">结果</span></div>
      ${rows.map(row => {
        const leaderNm = `<span style="font-size:6px;color:#e7cf95;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nm(row.leader)}</span>`;
        const teamNm   = `<span style="font-size:6px;color:var(--aw-subtext);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${row.team.map(nm).join(' ')}</span>`;
        const votes = row.result === 'cur'
          ? `<span style="font-size:5.5px;color:var(--aw-subtext);text-align:center">—</span>`
          : `<span style="font-size:6px;text-align:center;display:block"><span style="color:rgba(52,211,153,.9)">${row.approve}</span><span style="color:var(--aw-subtext)"> / </span><span style="color:rgba(248,113,113,.9)">${row.reject}</span></span>`;
        const result = row.result === 'cur'
          ? `<span style="font-size:5.5px;color:rgba(196,168,79,0.8);text-align:center;display:block">${row.resultTxt}</span>`
          : `<span class="ph-mt-result ${row.result}" style="display:block;text-align:center">${row.resultTxt}</span>`;
        return `<div style="${rowStyle(row.result === 'cur')}">${'<span style="font-size:5.5px;color:var(--aw-subtext)">R' + row.r + '</span>'}${leaderNm}${teamNm}${votes}${result}</div>`;
      }).join('')}
    </div>`;
  }

  _roomOverlay() {
    const gameRoles = [
      {id:'merlin',name:'梅林',faction:'good'},{id:'percival',name:'派西维尔',faction:'good'},
      {id:'arthur_loyal',name:'忠臣',faction:'good',count:3},{id:'assassin',name:'刺客',faction:'evil'},
      {id:'morgana',name:'莫甘娜',faction:'evil'},{id:'mordred',name:'莫德雷德',faction:'evil'},{id:'oberon',name:'奥伯伦',faction:'evil'},
    ];
    const chips = gameRoles.map(r => {
      const u = this._roleImgUrl(r.id);
      const chipBdr = r.faction==='evil' ? 'rgba(220,60,60,0.35)' : 'rgba(78,158,255,0.3)';
      const chipBg  = r.faction==='evil' ? 'rgba(60,8,4,0.7)' : 'rgba(4,20,55,0.7)';
      const chipClr = r.faction==='evil' ? 'rgba(240,100,100,0.9)' : 'rgba(120,170,255,0.9)';
      return `<div style="display:flex;align-items:center;gap:3px;padding:2px 5px 2px 2px;border:1px solid ${chipBdr};background:${chipBg}">
        <div style="width:16px;height:22px;overflow:hidden;flex-shrink:0;background:rgba(0,0,0,0.4)">${u?`<img src="${u}" style="width:100%;height:100%;object-fit:cover">`:''}
        </div><span style="font-size:6px;color:${chipClr}">${r.name}${r.count?'×'+r.count:''}</span></div>`;
    }).join('');
    const playerRows = PLAYERS.map((p,i) =>
      `<div style="display:flex;align-items:center;gap:5px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
        <span style="font-size:6px;color:rgba(255,255,255,0.3);width:10px;text-align:right;flex-shrink:0">${i+1}</span>
        <div style="width:16px;height:16px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:6.5px;color:rgba(255,255,255,0.7)">${p.nm.charAt(0)}</div>
        <span style="font-size:7px;color:var(--aw-text);flex:1">${p.nm}</span>
        ${p.isMe?`<span style="font-size:5.5px;color:rgba(100,200,255,0.8);border:1px solid rgba(100,200,255,0.25);padding:1px 3px;flex-shrink:0">我</span>`:''}
      </div>`).join('');
    return `<div style="position:absolute;inset:0;z-index:20;background:rgba(0,0,0,0.95);display:flex;flex-direction:column">
      <div style="padding:7px 10px;display:flex;align-items:center;border-bottom:1px solid rgba(255,255,255,0.1);flex-shrink:0">
        <span style="font-size:7.5px;font-weight:700;color:var(--aw-text)">房间 1234</span>
        <div onclick="event.stopPropagation();__pp.setGameView('table')" style="margin-left:auto;font-size:7px;color:rgba(255,255,255,0.3);cursor:pointer">关闭 ×</div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:5px 8px;display:flex;flex-direction:column;gap:8px">
        <div><div style="font-size:6px;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-bottom:4px">当前角色</div>
          <div style="display:flex;flex-wrap:wrap;gap:3px">${chips}</div>
        </div>
        <div>
          <div style="font-size:6px;color:rgba(255,255,255,0.3);letter-spacing:1px;margin-bottom:2px">玩家列表</div>
          ${playerRows}
        </div>
      </div>
    </div>`;
  }

  // ── Seat builders ────────────────────────────────────────────────
  _dungeonSeat(p, idx, n, {left, top, isLeader, isIdentityMode, isVisEvil, isHidden, rImg, inTeam, teamGlow, cardW, cardFz}) {
    const borderCol = isIdentityMode
      ? (p.isMe ? 'rgba(201,156,70,0.95)' : isVisEvil ? 'rgba(220,50,40,0.88)' : 'rgba(45,45,45,0.5)')
      : (p.isMe ? 'rgba(201,156,70,0.95)' : teamGlow ? 'rgba(80,200,120,0.8)' : p.faction==='evil' ? 'rgba(200,70,60,0.55)' : p.faction==='merlin' ? 'rgba(170,130,220,0.6)' : 'rgba(55,100,190,0.5)');
    const glow = isIdentityMode
      ? (p.isMe ? 'box-shadow:0 0 5px rgba(201,156,70,0.45);' : isVisEvil ? 'box-shadow:0 0 7px rgba(220,50,40,0.55);' : '')
      : (p.isMe ? 'box-shadow:0 0 5px rgba(201,156,70,0.45);' : teamGlow ? 'box-shadow:0 0 5px rgba(80,200,120,0.4);' : '');
    const cardBg = isIdentityMode
      ? (p.isMe ? (rImg?'background:rgba(8,4,2,0.4);':'background:rgba(8,4,2,0.92);') : isVisEvil ? 'background:rgba(45,4,2,0.88);' : 'background:rgba(8,8,8,0.78);')
      : (rImg ? 'background:rgba(8,4,2,0.4);' : 'background:rgba(8,4,2,0.92);');
    const imgHtml = isIdentityMode && !p.isMe
      ? (isVisEvil
        ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span style="font-size:${Math.round(cardW*0.44)}px;font-weight:700;color:rgba(220,70,60,0.88);font-family:'DotGothic16',monospace;text-shadow:0 0 8px rgba(200,40,30,0.6)">邪</span></div>`
        : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span style="font-size:${Math.round(cardW*0.38)}px;color:rgba(70,70,70,0.55);font-family:'DotGothic16',monospace">?</span></div>`)
      : (rImg ? `<img src="${rImg}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;image-rendering:pixelated" onerror="this.style.display='none'">` : '');
    const badgeTxt = isIdentityMode ? '' : ({speak:'►',voted:'✓',voting:'…',mission:'⚑'}[p.badge] || '');
    const badgeClr = p.badge==='voted' ? 'rgba(52,211,153,0.95)' : 'rgba(251,191,36,0.95)';
    const bsz = Math.max(3, Math.round(cardW * 0.15));
    const corners = this._dungeonCorners(bsz);
    return `<div class="ph-seat" style="left:${left}%;top:${top}%;width:${cardW}px;${isHidden?'opacity:0.38;':''}">
      ${isLeader && !isIdentityMode ? `<div class="ph-crown" style="left:50%;transform:translateX(-50%)">长</div>` : ''}
      <div style="width:${cardW}px;aspect-ratio:3/5;${cardBg}border:1.5px solid ${borderCol};${glow}position:relative;overflow:hidden">
        ${imgHtml}${corners}
        <span style="position:absolute;left:0;bottom:0;background:rgba(6,3,0,0.85);border-top:1px solid rgba(185,138,52,0.5);border-right:1px solid rgba(185,138,52,0.5);color:#c8982a;font-size:${cardFz}px;font-family:'DotGothic16',monospace;padding:0 2px;line-height:1.6;z-index:2">${idx+1}</span>
        ${badgeTxt ? `<span style="position:absolute;right:0;top:0;background:${badgeClr};color:#000;font-size:${cardFz}px;font-family:'DotGothic16',monospace;padding:0 2px;line-height:1.6;z-index:2">${badgeTxt}</span>` : ''}
      </div>
      <div style="font-size:${cardFz}px;font-family:'DotGothic16',monospace;color:${p.isMe?'#c8982a':'var(--aw-text)'};text-align:center;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.nm}</div>
    </div>`;
  }

  _celestialSeat(p, idx, n, {left, top, isLeader, isIdentityMode, isVisEvil, isHidden, rImg, inTeam, teamGlow, avSz, nameFz, showRoles}) {
    const fClr = isIdentityMode && isVisEvil ? 'rgba(210,55,50,0.92)'
      : isIdentityMode && p.isMe ? 'rgba(192,148,53,0.95)'
      : p.faction==='evil' ? 'rgba(210,55,50,0.85)'
      : p.faction==='merlin' ? 'rgba(148,80,210,0.85)'
      : 'rgba(50,138,215,0.85)';
    const fBg = isIdentityMode && isVisEvil ? 'rgba(255,215,210,0.75)'
      : p.faction==='evil' ? 'rgba(255,218,215,0.72)'
      : p.faction==='merlin' ? 'rgba(235,218,255,0.75)'
      : 'rgba(210,232,255,0.72)';
    const glowStyle = p.isMe ? ';box-shadow:0 0 10px rgba(192,148,53,0.60),0 0 3px rgba(255,245,180,0.50)'
      : isVisEvil ? ';box-shadow:0 0 10px rgba(210,50,45,0.50)'
      : ';box-shadow:0 2px 8px rgba(0,0,0,0.18)';
    const innerContent = isIdentityMode && !p.isMe
      ? (isVisEvil
        ? `<span style="font-size:${Math.round(avSz*0.40)}px;font-weight:700;color:rgba(210,60,55,0.90)">邪</span>`
        : `<span style="font-size:${Math.round(avSz*0.32)}px;color:rgba(90,90,90,0.40)">?</span>`)
      : (rImg ? `<img src="${rImg}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.remove()">` : '');
    const badge = !isIdentityMode ? this._seatBadge(p.badge) : '';
    return `<div class="ph-seat ${isIdentityMode?'':p.faction}${p.isMe?' me':''}" style="left:${left}%;top:${top}%;width:${avSz+4}px;${isHidden?'opacity:0.38;':''}">
      ${isLeader && !isIdentityMode ? `<div class="ph-crown" style="left:50%;transform:translateX(-50%);font-size:9px;color:rgba(200,155,40,0.95)">✦</div>` : ''}
      <div class="ph-seat-av-wrap" style="width:${avSz}px;height:${avSz}px;position:relative">
        ${badge}
        <div style="position:absolute;inset:0;border-radius:50%;overflow:hidden;border:2px solid ${fClr};background:${fBg};display:flex;align-items:center;justify-content:center${glowStyle}">${innerContent}</div>
        <span class="ph-seat-no" style="z-index:4">${idx+1}</span>
      </div>
      <div class="ph-seat-name" style="font-size:${nameFz}px;max-width:${avSz+4}px;margin-top:3px;font-weight:${p.isMe?'700':'500'};color:${p.isMe?'rgba(140,95,20,0.95)':'rgba(55,38,15,0.82)'};text-shadow:0 1px 3px rgba(255,248,220,0.90)">${p.nm}</div>
    </div>`;
  }

  _defaultSeat(p, idx, n, {left, top, isLeader, isIdentityMode, isVisEvil, isHidden, rImg, inTeam, teamGlow, avSz, seatW, nameFz, showRoles}) {
    const avInner = isIdentityMode && !p.isMe
      ? (isVisEvil
        ? `<span style="font-size:${Math.round(avSz*0.4)}px;font-weight:700;color:rgba(220,80,70,0.9)">邪</span>`
        : `<span style="font-size:${Math.round(avSz*0.35)}px;color:rgba(90,90,90,0.5)">?</span>`)
      : (rImg ? `<img src="${rImg}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:50%" onerror="this.remove()">` : '');
    const avExtra = isIdentityMode
      ? (p.isMe ? 'border:2px solid rgba(201,156,70,0.85)!important;' : isVisEvil ? 'border:2px solid rgba(220,55,45,0.85)!important;background:rgba(50,5,5,0.6)!important;' : '')
      : (teamGlow ? 'border-color:rgba(100,220,140,0.92)!important;box-shadow:0 0 10px rgba(80,200,120,0.5)!important;background:rgba(10,45,20,0.88)!important;' : '')
        + (p.isMe ? 'border-color:rgba(233,191,112,.95)!important;box-shadow:0 0 0 2px rgba(233,191,112,.22)!important;' : !isIdentityMode && p.inTeam ? 'box-shadow:0 0 0 2px rgba(233,191,112,.9),0 0 8px rgba(233,191,112,.4)!important;border-color:rgba(233,191,112,.9)!important;' : p.faction==='good' || p.faction==='merlin' ? 'border-color:rgba(78,158,255,.85);box-shadow:0 0 6px rgba(78,158,255,.45);background:rgba(7,50,120,.35);' : 'border-color:rgba(220,60,60,.8);box-shadow:0 0 5px rgba(200,40,40,.38);background:rgba(35,6,6,.92);');
    const badge = !isIdentityMode ? this._seatBadge(p.badge) : '';
    return `<div class="ph-seat ${isIdentityMode?'':p.faction}${p.isMe?' me':''}" style="left:${left}%;top:${top}%;width:${seatW}px;${isHidden?'opacity:0.38;':''}">
      ${isLeader && !isIdentityMode ? `<div class="ph-crown" style="left:50%;transform:translateX(-50%)">👑</div>` : ''}
      <div class="ph-seat-av-wrap" style="width:${avSz}px;height:${avSz}px">
        ${badge}
        <div class="ph-seat-av" style="width:${avSz}px;height:${avSz}px;font-size:${Math.round(avSz*.5)}px;${avExtra};overflow:hidden;position:relative">${avInner}</div>
        <span class="ph-seat-no">${idx+1}</span>
      </div>
      <div class="ph-seat-name" style="font-size:${nameFz}px;max-width:${seatW}px">${p.nm}</div>
    </div>`;
  }

  _seatBadge(badge) {
    if (!badge) return '';
    const bars = badge === 'speak'
      ? `<div style="display:flex;gap:1px;align-items:flex-end;height:9px"><div style="width:3px;background:#fbbf24;height:3px;border-radius:1px"></div><div style="width:3px;background:#fbbf24;height:7px;border-radius:1px"></div><div style="width:3px;background:#fbbf24;height:4px;border-radius:1px"></div></div>`
      : badge === 'voted'
      ? `<div style="width:9px;height:7px;border:1px solid rgba(52,211,153,.7);border-radius:1px"></div>`
      : badge === 'voting'
      ? `<div style="width:8px;height:9px;border:1px solid rgba(251,191,36,.7);border-radius:1px;overflow:hidden"><div style="width:5px;height:4px;background:#fbbf24;margin:0 auto;border-radius:1px"></div></div>`
      : badge === 'mission'
      ? `<div style="width:9px;height:9px;border-radius:50%;border:1px solid rgba(251,191,36,.7);display:flex;align-items:center;justify-content:center"><div style="width:3px;height:3px;border-radius:50%;background:#fbbf24"></div></div>`
      : '';
    return `<div class="ph-seat-badge ${badge}">${bars}</div>`;
  }

  // ── Action panels ────────────────────────────────────────────────
  _votePanel() {
    const isCel = this._isCelestial();
    const isDun = this._isDungeon();
    if (isCel) return this._celestialActionPanel('队 伍 表 决',
      [{lbl:'光影',no:1,roleId:'lancelot_good',emoji:'🦊'},{lbl:'龙影',no:2,roleId:'percival',emoji:'🐉'}],
      '同    意', '反    对');
    const avs = [{lbl:'光影',no:1,roleId:'lancelot_good',emoji:'🦊'},{lbl:'龙影',no:2,roleId:'percival',emoji:'🐉'}];
    const teamHtml = avs.map(av => {
      const avUrl = isDun ? this._roleImgUrl(av.roleId) : null;
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:1px">
        <div style="position:relative;display:inline-block"><div class="ph-vote-av" style="${isDun?'border-radius:0;position:relative;overflow:hidden;padding:0;':''}">
          ${avUrl?`<img src="${avUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`:(isDun?av.lbl[0]:av.emoji)}
        </div><span style="position:absolute;right:-4px;bottom:-2px;min-width:12px;height:12px;padding:0 2px;border-radius:calc(999px * var(--aw-r));display:flex;align-items:center;justify-content:center;background:rgba(236,196,118,.96);color:#20160d;font-size:6px;font-weight:700;line-height:1">${av.no}</span></div>
        <div class="ph-vote-name">${av.lbl}</div></div>`;
    }).join('');
    return `<div class="ph-action-panel"><div class="ph-vote-title">请对当前提名队伍投票</div>
      <div class="ph-vote-team">${teamHtml}</div>
      <div class="ph-vote-divider"></div>
      <div class="ph-vote-btns"><div class="ph-vote-yes">同意</div><div class="ph-vote-no">反对</div></div>
    </div>`;
  }

  _missionPanel() {
    const isCel = this._isCelestial();
    const isDun = this._isDungeon();
    if (isCel) return this._celestialActionPanel('出 征 行 动',
      [{lbl:'光影（我）',no:1,roleId:'lancelot_good',emoji:'🦊'},{lbl:'海浪',no:7,roleId:'arthur_loyal',emoji:'🌊'}],
      '✦ 执 行 成 功', '✕ 执 行 失 败');
    const avs = [{lbl:'光影（我）',no:1,roleId:'lancelot_good',emoji:'🦊'},{lbl:'海浪',no:7,roleId:'arthur_loyal',emoji:'🌊'}];
    const teamHtml = avs.map(av => {
      const avUrl = isDun ? this._roleImgUrl(av.roleId) : null;
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:1px">
        <div style="position:relative;display:inline-block"><div class="ph-vote-av" style="${isDun?'border-radius:0;position:relative;overflow:hidden;padding:0;':''}">
          ${avUrl?`<img src="${avUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`:(isDun?av.lbl[0]:av.emoji)}
        </div><span style="position:absolute;right:-4px;bottom:-2px;min-width:12px;height:12px;padding:0 2px;border-radius:calc(999px * var(--aw-r));display:flex;align-items:center;justify-content:center;background:rgba(236,196,118,.96);color:#20160d;font-size:6px;font-weight:700;line-height:1">${av.no}</span></div>
        <div class="ph-vote-name">${av.lbl}</div></div>`;
    }).join('');
    return `<div class="ph-action-panel"><div class="ph-vote-title">你在出征队中 · 请选择任务行动</div>
      <div class="ph-vote-team">${teamHtml}</div>
      <div class="ph-vote-divider"></div>
      <div class="ph-vote-btns"><div class="ph-vote-yes">✓ 执行成功</div><div class="ph-vote-no">✗ 执行失败</div></div>
    </div>`;
  }

  _speakPanel() {
    const isCel = this._isCelestial();
    const isDun = this._isDungeon();
    if (isCel) {
      const percUrl = this._roleImgUrl('percival');
      return `<div style="padding:8px 10px 10px;background:rgba(244,237,218,0.99);border-top:2px solid rgba(192,148,53,0.65);box-shadow:0 -4px 16px rgba(130,100,40,0.15),inset 0 1px 0 rgba(255,252,228,0.85)">
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:6px">
          <span style="flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(192,148,53,0.45))"></span>
          <span style="color:rgba(150,105,28,0.72);font-size:5.5px;letter-spacing:1.5px">正在发言</span>
          <span style="flex:1;height:1px;background:linear-gradient(to left,transparent,rgba(192,148,53,0.45))"></span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
          <div style="width:36px;height:36px;border-radius:50%;background:rgba(55,148,215,0.18);border:2px solid rgba(192,148,53,0.70);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;position:relative">🐉
            <span style="position:absolute;bottom:-1px;right:-1px;width:10px;height:10px;border-radius:50%;background:rgba(68,200,120,0.92);border:1.5px solid rgba(240,232,214,0.97)"></span>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:8px;color:rgba(55,36,10,0.90);font-weight:700;margin-bottom:1px">龙影</div>
            <div style="font-size:6px;color:rgba(130,95,28,0.65)">共 60 秒 · 请认真倾听</div>
          </div>
          <div style="background:linear-gradient(180deg,#f5d060,#c08820);border:1px solid rgba(140,95,10,0.70);border-radius:4px;padding:3px 6px">
            <span style="font-size:11px;color:#fff8e0;font-weight:700">0:38</span>
          </div>
        </div>
        <div style="height:3px;background:rgba(192,148,53,0.18);border-radius:2px;overflow:hidden;margin-bottom:2px">
          <div style="width:37%;height:100%;background:linear-gradient(to right,rgba(192,148,53,0.60),rgba(240,200,80,0.80));border-radius:2px"></div>
        </div>
        <div style="font-size:5.5px;color:rgba(130,95,28,0.50);text-align:center;letter-spacing:0.5px">等待当前玩家发言结束…</div>
      </div>`;
    }
    const spkAvStyle = isDun ? 'border-radius:0;position:relative;overflow:hidden;padding:0;' : '';
    const spkAvImg = isDun && this._roleImgUrl('percival')
      ? `<img src="${this._roleImgUrl('percival')}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`
      : (isDun ? '龙' : '🐉');
    return `<div class="ph-spk-card">
      <div class="ph-spk-accent"></div>
      <div class="ph-spk-top">
        <div class="ph-spk-av" style="${spkAvStyle}">${spkAvImg}<span class="ph-spk-dot" style="position:absolute;bottom:1px;right:1px;z-index:2"></span></div>
        <div class="ph-spk-info"><div class="ph-spk-nm">龙影 · 正在发言</div><div class="ph-spk-hint">共 60 秒 · 请认真倾听</div></div>
        <div class="ph-spk-timer">0:38</div>
      </div>
      <div class="ph-spk-track"><div class="ph-spk-fill" style="width:37%"></div></div>
      <div style="font-size:6px;color:var(--aw-subtext);text-align:center;margin-top:3px">等待当前玩家发言结束…</div>
    </div>`;
  }

  _celestialActionPanel(title, avList, btn1, btn2) {
    const header = `<div style="display:flex;align-items:center;gap:4px;margin-bottom:7px">
      <span style="flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(192,148,53,0.55))"></span>
      <span style="color:rgba(138,92,18,0.88);font-size:6.5px;letter-spacing:2px;font-weight:700">${title}</span>
      <span style="flex:1;height:1px;background:linear-gradient(to left,transparent,rgba(192,148,53,0.55))"></span>
    </div>`;
    const avatars = `<div style="display:flex;justify-content:center;gap:12px;margin-bottom:8px">${avList.map(av => {
      const u = this._roleImgUrl(av.roleId);
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="position:relative">
          <div style="width:30px;height:30px;border-radius:50%;border:2px solid rgba(192,148,53,0.80);overflow:hidden;background:rgba(215,238,255,0.92);display:flex;align-items:center;justify-content:center;font-size:15px">
            ${u ? `<img src="${u}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : av.emoji}
          </div>
          <span style="position:absolute;bottom:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:rgba(192,148,53,0.92);border:1.5px solid rgba(244,237,218,0.99);display:flex;align-items:center;justify-content:center;font-size:5.5px;color:#fff8e0;font-weight:700">${av.no}</span>
        </div>
        <span style="font-size:5.5px;color:rgba(95,65,18,0.70)">${av.lbl}</span>
      </div>`;
    }).join('')}</div>`;
    const lineStyle = 'position:absolute;left:-4px;right:-4px;height:1px;background:linear-gradient(to right,transparent,rgba(200,165,50,0.70),transparent)';
    const primary = `<div style="position:relative;margin:6px 0 4px">
      <div style="${lineStyle};top:-4px"></div>
      <div style="width:100%;padding:6px 0;text-align:center;font-size:8px;font-weight:700;letter-spacing:3px;color:#fff8e0;background:linear-gradient(180deg,#f5d060 0%,#e0a82a 28%,#c08820 62%,#9e6c10 100%);border:1px solid rgba(140,95,10,0.80);border-radius:4px;box-shadow:inset 0 1px 0 rgba(255,248,185,0.60);cursor:pointer">${btn1}</div>
      <div style="${lineStyle};bottom:-4px"></div>
    </div>`;
    const secondary = `<div style="width:100%;padding:5px 0;text-align:center;font-size:7.5px;font-weight:600;letter-spacing:2px;color:rgba(120,80,20,0.80);background:linear-gradient(180deg,rgba(255,252,242,0.96),rgba(238,228,208,0.96));border:1px solid rgba(192,152,60,0.50);border-radius:4px;cursor:pointer">${btn2}</div>`;
    return `<div style="padding:8px 12px 10px;background:rgba(244,237,218,0.99);border-top:2px solid rgba(192,148,53,0.65);box-shadow:0 -4px 16px rgba(130,100,40,0.15),inset 0 1px 0 rgba(255,252,228,0.85)">${header}${avatars}${primary}${secondary}</div>`;
  }


  // ── PROFILE SCREEN ─────────────────────────────────────────────
  _profile() {
    const roleData = [
      {id:'merlin',      name:'梅林',    faction:'good', total:8,  wins:6,  rate:75},
      {id:'percival',    name:'派西',    faction:'good', total:6,  wins:4,  rate:67},
      {id:'arthur_loyal',name:'忠臣',    faction:'good', total:14, wins:8,  rate:57},
      {id:'lancelot_good',name:'兰斯',  faction:'good', total:3,  wins:2,  rate:67},
      {id:'assassin',    name:'刺客',    faction:'evil', total:9,  wins:4,  rate:44},
      {id:'morgana',     name:'莫甘娜',  faction:'evil', total:7,  wins:3,  rate:43},
      {id:'mordred',     name:'莫德雷德',faction:'evil', total:3,  wins:1,  rate:33},
      {id:'oberon',      name:'奥伯伦',  faction:'evil', total:0,  wins:0,  rate:0},
    ];
    const roleCellsHtml = roleData.map(r => {
      const deg = (r.total > 0 ? r.rate / 100 * 360 : 0).toFixed(0);
      const ringClr = r.faction==='good' ? 'rgba(78,158,255,0.88)' : 'rgba(220,80,80,0.88)';
      const ringBg  = r.faction==='good' ? 'rgba(78,158,255,0.10)' : 'rgba(220,80,80,0.10)';
      const rUrl = this._roleImgUrl(r.id);
      const imgHtml = rUrl ? `<img src="${rUrl}" onerror="this.style.display='none'">` : `<span style="font-size:8px;font-weight:700;opacity:.6">${r.name.charAt(0)}</span>`;
      const rateClass = r.total===0 ? 'na' : r.rate>=50 ? 'hi' : 'lo';
      const rateText  = r.total===0 ? '—' : r.rate+'%';
      return `<div class="ph-role-cell">
        <div class="ph-role-cell-topbar ${r.faction}"></div>
        <div class="ph-gauge"><div class="ph-gauge-ring" style="background:conic-gradient(${ringClr} ${deg}deg,${ringBg} 0deg)"></div><div class="ph-gauge-inner">${imgHtml}</div></div>
        <div class="ph-rs-name ${r.faction}">${r.name}</div>
        <div class="ph-rs-games">${r.total>0?r.total+'局/'+r.wins+'胜':'未出场'}</div>
        <div class="ph-rs-rate ${rateClass}">${rateText}</div>
      </div>`;
    }).join('');

    const medalBase = 'https://www.awalon.top/mp-assets/medals/';
    const mUrl = code => {
      const u = this._getAsset(code);
      if (u) return u;
      return medalBase + code + '.png';
    };
    const medalSections = [
      {title:'正义阵营', cls:'good', list:[
        {code:'merlin_survivor',name:'梅林是狗',cnt:3},{code:'good_clean_trust',name:'开眼玩家',cnt:2},
        {code:'good_clean_captain',name:'老司机',cnt:5},{code:'good_three_success_participant',name:'正义王',cnt:1},
        {code:'good_comeback_win',name:'开往春田花花',cnt:1},{code:'good_blocker',name:'挡刀侠',cnt:0},
      ]},
      {title:'邪恶阵营', cls:'evil', list:[
        {code:'assassin_early_hit_merlin',name:'刺客大师',cnt:2},{code:'evil_three_fail_win',name:'炸三塔',cnt:1},
        {code:'evil_hide_votes_master',name:'藏票大师',cnt:3},{code:'evil_no_fail_win',name:'演技派',cnt:0},
        {code:'morgana_percival_fail_master',name:'洗头大师',cnt:1},{code:'evil_three_fail_participant',name:'狼王',cnt:0},
      ]},
    ];
    const medalsHtml = medalSections.map(sec => {
      const cells = sec.list.map(m =>
        `<div class="ph-medal-card${m.cnt===0?' ph-medal-zero':''}">
          <img src="${mUrl(m.code)}" style="width:20px;height:20px;object-fit:contain" onerror="this.style.display='none'">
          <div class="ph-medal-name">${m.name}</div>
          <div class="ph-medal-cnt">${m.cnt}</div>
        </div>`
      ).join('');
      return `<div class="ph-medal-section"><span class="ph-medal-section-title ${sec.cls}">${sec.title}</span><div class="ph-medal-grid">${cells}</div></div>`;
    }).join('');

    return `
      ${this._bgLayer('in-game')}${this._maskDiv()}
      ${this._nav('我的主页', {back:true})}
      <div class="ph-content">
        <div class="ph-panel" style="padding:0;overflow:hidden">
          <div class="ph-panel-hd"><span class="ph-panel-title">总览</span><span class="ph-panel-sub">近期战绩</span></div>
          <div class="ph-ov-nums">
            <div class="ph-ov-block"><div class="ph-ov-num" style="color:#4e9eff">47</div><div class="ph-ov-lbl">总对局</div></div>
            <div class="ph-ov-divider"></div>
            <div class="ph-ov-block"><div class="ph-ov-num" style="color:#50dc8c">55%</div><div class="ph-ov-lbl">总胜率</div></div>
          </div>
          <div class="ph-faction-wrap">
            <div class="ph-faction-bar-labels">
              <span style="font-size:6px;font-weight:700;color:#4e9eff">正义阵营 · 31局</span>
              <span style="font-size:6px;font-weight:700;color:#e05050">邪恶阵营 · 19局</span>
            </div>
            <div class="ph-faction-bar-track">
              <div class="ph-faction-bar-good" style="width:62%"></div>
              <div class="ph-faction-bar-evil" style="width:38%"></div>
            </div>
            <div class="ph-faction-cards">
              <div class="ph-fc good"><span class="ph-fc-title">正义阵营</span><div style="display:flex;align-items:baseline;gap:3px"><span class="ph-fc-big">20</span><span class="ph-fc-small">/ 31 胜</span></div><span class="ph-fc-rate">胜率 65%</span></div>
              <div class="ph-fc evil"><span class="ph-fc-title">邪恶阵营</span><div style="display:flex;align-items:baseline;gap:3px"><span class="ph-fc-big">7</span><span class="ph-fc-small">/ 19 胜</span></div><span class="ph-fc-rate">胜率 37%</span></div>
            </div>
          </div>
        </div>
        <div class="ph-panel" style="padding:0;overflow:hidden">
          <div class="ph-panel-hd"><span class="ph-panel-title">按角色统计</span></div>
          <div class="ph-role-grid">${roleCellsHtml}</div>
        </div>
        <div class="ph-panel" style="padding:0;overflow:hidden">
          <div class="ph-panel-hd"><span class="ph-panel-title">获得勋章</span></div>
          ${medalsHtml}
        </div>
      </div>`;
  }

  // ── HISTORY SCREEN ─────────────────────────────────────────────
  _history() {
    const historyData = [
      {result:'win',  faction:'good', role:'梅林',  roleId:'merlin',      room:'8821', players:7,  seat:2, medals:[{code:'merlin_survivor',name:'梅林是狗'}], time:'2小时前'},
      {result:'lose', faction:'evil', role:'莫甘娜',roleId:'morgana',     room:'7743', players:7,  seat:5, medals:[], time:'昨天'},
      {result:'win',  faction:'good', role:'忠臣',  roleId:'arthur_loyal',room:'6291', players:10, seat:3, medals:[{code:'good_comeback_win',name:'开往春田花花'}], time:'前天'},
      {result:'lose', faction:'evil', role:'刺客',  roleId:'assassin',    room:'5882', players:7,  seat:1, medals:[{code:'assassin_early_hit_merlin',name:'刺客大师'}], time:'3天前'},
    ];
    const isCel = this._isCelestial();
    const isDun = this._isDungeon();
    const medalBase = 'https://www.awalon.top/mp-assets/medals/';
    const mUrl = code => this._getAsset(code) || medalBase + code + '.png';

    const cardsHtml = historyData.map(h => {
      const rUrl = this._roleImgUrl(h.roleId);
      const fBdr = h.faction==='evil' ? 'rgba(200,70,60,0.65)' : h.faction==='merlin' ? 'rgba(170,130,220,0.65)' : 'rgba(55,100,190,0.55)';
      const medHtml = h.medals.map(m => `<div class="ph-hc-medal"><img src="${mUrl(m.code)}" style="width:11px;height:11px;object-fit:contain;flex-shrink:0" onerror="this.style.display='none'"><span class="ph-hc-medal-txt">${m.name}</span></div>`).join('');

      if (isCel) {
        const isWin = h.result === 'win';
        const fClr = h.faction==='evil' ? '#b04040' : h.faction==='merlin' ? '#7050b0' : '#3a70b0';
        const fRingClr = h.faction==='evil' ? 'rgba(200,70,60,0.72)' : h.faction==='merlin' ? 'rgba(140,90,210,0.72)' : 'rgba(78,150,220,0.72)';
        return `<div style="background:rgba(233,225,207,0.92);border:1px solid rgba(180,148,60,0.28);border-radius:5px;padding:8px 10px;box-shadow:0 1px 6px rgba(150,120,50,0.10),inset 0 1px 0 rgba(255,248,225,0.50);position:relative;overflow:hidden">
          <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${isWin?'linear-gradient(180deg,rgba(60,150,90,0.70),rgba(60,150,90,0.25))':'linear-gradient(180deg,rgba(180,60,60,0.70),rgba(180,60,60,0.25))'}"></div>
          <div style="display:flex;align-items:center;gap:9px;padding-left:5px">
            <div style="width:36px;height:36px;border-radius:50%;border:2px solid ${fRingClr};flex-shrink:0;overflow:hidden;background:rgba(220,235,250,0.60)">
              ${rUrl?`<img src="${rUrl}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">`:`<span style="display:flex;align-items:center;justify-content:center;height:100%;font-size:14px;color:${fClr};opacity:0.5">${h.role[0]}</span>`}
            </div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px">
                <span style="font-size:8.5px;font-weight:700;color:${fClr}">${h.role}</span>
                <span style="font-size:5px;padding:1.5px 6px;border-radius:8px;background:${isWin?'rgba(50,160,90,0.12)':'rgba(180,50,50,0.10)'};border:1px solid ${isWin?'rgba(50,160,90,0.40)':'rgba(180,50,50,0.38)'};color:${isWin?'#2a7040':'#9a3030'};font-weight:600">${isWin?'✓ 胜利':'✗ 失败'}</span>
              </div>
              <div style="font-size:5.5px;color:rgba(110,80,45,0.65);line-height:1.4">${h.room} 号房 · ${h.players}人局 · 第${h.seat}席</div>
              ${h.medals.length ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px">${h.medals.map(m=>`<span style="display:inline-flex;align-items:center;gap:2px;font-size:5px;padding:1px 5px;border-radius:6px;background:rgba(192,144,53,0.10);border:1px solid rgba(192,144,53,0.28);color:rgba(140,100,40,0.80)"><img src="${mUrl(m.code)}" style="width:9px;height:9px;object-fit:contain" onerror="this.style.display='none'">${m.name}</span>`).join('')}</div>` : ''}
            </div>
            <div style="font-size:5px;color:rgba(120,90,50,0.50);white-space:nowrap;flex-shrink:0">${h.time}</div>
          </div>
        </div>`;
      }

      const avHtml = isDun ? (() => {
        const corners = this._dungeonCorners(4);
        return `<div style="width:26px;aspect-ratio:3/5;flex-shrink:0;position:relative;overflow:hidden;background:rgba(8,4,2,.88);border:1.5px solid ${fBdr}">${rUrl?`<img src="${rUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">`:`<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(200,152,42,.6);font-family:'DotGothic16',monospace">${h.role[0]}</span>`}${corners}</div>`;
      })() : (rUrl ? `<img src="${rUrl}" onerror="this.textContent='${h.role[0]}'">` : h.role[0]);

      return `<div class="ph-hc ${h.result}">
        <div class="ph-hc-body">
          <div class="ph-hc-top">
            ${isDun ? avHtml : `<div class="ph-hc-av ${h.faction}">${avHtml}</div>`}
            <div class="ph-hc-info">
              <div class="ph-hc-headrow">
                <span class="ph-hc-rolename ${h.faction}">${h.role}</span>
                <div class="ph-hc-badge ${h.result}"><div class="ph-hc-badge-dot"></div><span class="ph-hc-badge-txt">${h.result==='win'?'胜利':'失败'}</span></div>
              </div>
              <div class="ph-hc-meta">
                <span class="ph-hc-metaitem">${h.room} 号房</span>
                <div class="ph-hc-metasep"></div>
                <span class="ph-hc-metaitem">${h.players}人</span>
                <div class="ph-hc-metasep"></div>
                <span class="ph-hc-metaitem">座位${h.seat}</span>
              </div>
            </div>
          </div>
          <div class="ph-hc-bottom">${medHtml}<span class="ph-hc-time">${h.time}</span></div>
        </div>
      </div>`;
    }).join('');

    if (isCel) {
      return `
        ${this._bgLayer('in-game')}
        ${this._nav('历史对战', {back:true})}
        <div style="flex:1;overflow-y:auto;padding:7px 7px 44px;display:flex;flex-direction:column;gap:6px;position:relative;z-index:5">
          ${cardsHtml}
        </div>
        <div class="ph-pagination" style="background:rgba(248,244,235,0.92);border-top:1px solid rgba(180,148,60,0.20);position:relative;z-index:10">
          <div class="ph-pg-arrow" style="opacity:0.3;color:#a07830">‹</div>
          <div class="ph-pg-indicator"><div class="ph-pg-num" style="color:#c09040">1</div><div class="ph-pg-lbl" style="color:rgba(140,100,40,0.65)">当前页</div></div>
          <div class="ph-pg-arrow" style="color:#a07830">›</div>
        </div>`;
    }
    return `
      ${this._bgLayer('in-game')}${this._maskDiv()}
      ${this._nav('历史对战', {back:true})}
      <div class="ph-content" style="padding:6px 6px 44px">
        <div style="background:var(--aw-bg-2,rgba(12,16,28,0.5));border:1px solid var(--aw-panel-border,rgba(255,255,255,.07));border-radius:calc(10px * var(--aw-r));padding:6px 6px 2px">
          <div style="font-size:6.5px;font-weight:700;color:var(--aw-subtext);letter-spacing:1px;padding:0 2px 5px;opacity:0.7">历史对战记录</div>
          ${cardsHtml}
        </div>
      </div>
      <div class="ph-pagination">
        <div class="ph-pg-arrow" style="opacity:0.2">‹</div>
        <div class="ph-pg-indicator"><div class="ph-pg-num">1</div><div class="ph-pg-lbl">当前页</div></div>
        <div class="ph-pg-arrow">›</div>
      </div>`;
  }


  // ── DETAIL SCREEN ──────────────────────────────────────────────
  _detail() {
    const isCel = this._isCelestial();
    const isDun = this._isDungeon();
    const isEvilWin = this.detailResult === 'fail';
    const resultCls = isEvilWin ? 'lose' : 'win';
    const resultTxt = isEvilWin ? '失败' : '胜利';
    const myRoleUrl = this._roleImgUrl('assassin');

    const detailPlayers = [
      {nm:'CHAO',     faction:'evil',   role:'爪牙',     roleId:'minion',       isMe:true},
      {nm:'这关真好',  faction:'merlin', role:'梅林',     roleId:'merlin'},
      {nm:'华毅',     faction:'good',   role:'派西维尔', roleId:'percival'},
      {nm:'丹',       faction:'evil',   role:'刺客',     roleId:'assassin'},
      {nm:'你们的坏', faction:'good',   role:'忠臣',     roleId:'arthur_loyal'},
      {nm:'滑不溜脚', faction:'good',   role:'忠臣',     roleId:'arthur_loyal'},
      {nm:'村长',     faction:'evil',   role:'莫甘娜',   roleId:'morgana'},
      {nm:'烈焰',     faction:'good',   role:'兰斯洛特', roleId:'lancelot_good'},
      {nm:'暗影',     faction:'evil',   role:'莫德雷德', roleId:'mordred'},
      {nm:'星辰',     faction:'good',   role:'奥伯伦',   roleId:'oberon'},
    ];
    const n2 = detailPlayers.length;
    const d_rx = 44, d_ry = 37;
    const d_cardW = 24;
    const d_av  = isCel ? 34 : 18;
    const d_sw  = isCel ? 44 : 26;
    const d_fz  = 5;
    const fBdr = f => f==='evil' ? 'rgba(220,60,60,0.85)' : f==='merlin' ? 'rgba(180,130,255,0.85)' : 'rgba(78,158,255,0.85)';
    const fBg  = f => f==='evil' ? 'rgba(35,6,6,0.9)' : f==='merlin' ? 'rgba(25,12,55,0.9)' : 'rgba(7,50,120,0.35)';

    const detailSeats = detailPlayers.map((p, idx) => {
      const angle = (2 * Math.PI * idx) / n2 - Math.PI / 2;
      const left = (50 + d_rx * Math.cos(angle)).toFixed(1);
      const top  = (50 + d_ry * Math.sin(angle)).toFixed(1);
      const rImg2 = this._roleImgUrl(p.roleId);

      if (isDun) {
        const bCol = p.isMe ? 'rgba(201,156,70,0.95)' : p.faction==='evil' ? 'rgba(200,70,60,0.55)' : p.faction==='merlin' ? 'rgba(170,130,220,0.6)' : 'rgba(55,100,190,0.5)';
        const cardBg = rImg2 ? 'background:rgba(8,4,2,0.4);' : 'background:rgba(8,4,2,0.92);';
        const bsz = Math.max(3, Math.round(d_cardW * 0.15));
        return `<div class="ph-seat" style="left:${left}%;top:${top}%;width:${d_cardW}px">
          <div style="width:${d_cardW}px;aspect-ratio:3/5;${cardBg}border:1.5px solid ${bCol};position:relative;overflow:hidden">
            ${rImg2?`<img src="${rImg2}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">` : ''}
            ${this._dungeonCorners(bsz)}
            <span style="position:absolute;left:0;bottom:0;background:rgba(6,3,0,0.85);border-top:1px solid rgba(185,138,52,0.5);border-right:1px solid rgba(185,138,52,0.5);color:#c8982a;font-size:${d_fz}px;font-family:'DotGothic16',monospace;padding:0 2px;line-height:1.6;z-index:2">${idx+1}</span>
          </div>
          <div style="font-size:${d_fz}px;font-family:'DotGothic16',monospace;color:${p.isMe?'#c8982a':'var(--aw-text)'};text-align:center;width:${d_cardW}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.nm}</div>
        </div>`;
      }
      const bdrCol = p.isMe ? 'rgba(233,191,112,0.95)' : fBdr(p.faction);
      const bgCol  = fBg(p.faction);
      const glow   = p.isMe ? 'box-shadow:0 0 0 2px rgba(233,191,112,0.25);' : '';
      const av2 = rImg2
        ? `<img src="${rImg2}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:calc(50% * var(--aw-r,1))" onerror="this.remove()">`
        : '';
      return `<div class="ph-seat" style="left:${left}%;top:${top}%;width:${d_sw}px">
        <div style="position:relative;width:${d_av}px;height:${d_av}px;border-radius:calc(50% * var(--aw-r,1));border:1.5px solid ${bdrCol};background:${bgCol};${glow}overflow:hidden;flex-shrink:0">
          ${av2 || `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:8px;color:rgba(255,255,255,0.7)">${p.role[0]}</span>`}
          <span style="position:absolute;right:-1px;bottom:-1px;background:rgba(8,10,20,0.92);border:1px solid rgba(255,255,255,0.12);border-radius:calc(2px * var(--aw-r,1));font-size:4.5px;color:rgba(255,255,255,0.7);line-height:1.4;padding:0 1.5px;z-index:3">${idx+1}</span>
        </div>
        <div style="font-size:5px;color:${p.isMe?'#e9bf70':'var(--aw-text)'};text-align:center;width:${d_sw}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">${p.nm}</div>
        <div style="font-size:4.5px;color:${fBdr(p.faction)};text-align:center;width:${d_sw}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.role}</div>
      </div>`;
    }).join('');

    const detailSwitcher = this._makeSwitcher([
      {lbl:'成功', act:this.detailResult==='success', stateKey:'detailResult', stateVal:'success'},
      {lbl:'失败', act:this.detailResult==='fail',    stateKey:'detailResult', stateVal:'fail'},
    ]);

    const missionPills = this._makeMissionPills([
      {s:'success',lbl:'第1轮',sz:'3人'},{s:'fail',lbl:'第2轮',sz:'4人'},
      {s:'success',lbl:'第3轮',sz:'4人'},{s:'fail',lbl:'第4轮',sz:'5人'},{s:'fail',lbl:'第5轮',sz:'5人'},
    ]);
    const missionTable = this._makeMissionTable([
      {r:'1',team:'光影·龙影·鹰眼',    votes:'3赞/0反',s:'success',resultTxt:'✓成功'},
      {r:'2',team:'村长·烈焰·丹·星辰', votes:'2赞/2反',s:'fail',   resultTxt:'✗失败'},
      {r:'3',team:'CHAO·暗影·滑不溜',  votes:'4赞/1反',s:'success',resultTxt:'✓成功'},
      {r:'4',team:'村长·烈焰·丹·CHAO·暗影',votes:'3赞/2反',s:'fail',resultTxt:'✗失败'},
    ]);
    const aiRecap = this._makeAIRecap([
      {lbl:'1号 · CHAO · 爪牙'},{lbl:'2号 · 这关真好 · 梅林'},{lbl:'4号 · 丹 · 刺客'},
    ]);

    if (isCel) {
      const isWin2 = this.detailResult === 'success';
      const winClr = isWin2 ? 'rgba(40,130,70,0.90)' : 'rgba(180,50,50,0.88)';
      const winBg  = isWin2 ? 'rgba(50,160,90,0.12)' : 'rgba(180,50,50,0.10)';
      const winBdr = isWin2 ? 'rgba(50,160,90,0.40)' : 'rgba(180,50,50,0.38)';
      const winTxtClr = isWin2 ? '#2a7040' : '#9a3030';
      return `
        ${this._bgLayer('in-game')}
        ${detailSwitcher}
        ${this._nav('对战详情', {back:true, extra:'<div style="font-size:9px;color:var(--aw-subtext)">···</div>'})}
        <div style="flex:1;overflow-y:auto;padding:6px 6px 8px;display:flex;flex-direction:column;gap:7px;position:relative;z-index:5">
          <div style="background:rgba(233,225,207,0.93);border:1px solid rgba(180,148,60,0.32);border-radius:5px;padding:9px 10px;position:relative;overflow:hidden;box-shadow:0 2px 10px rgba(150,120,50,0.14),inset 0 1px 0 rgba(255,248,225,0.55)">
            <div style="position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:44px;font-weight:900;color:${isWin2?'rgba(40,130,70,0.09)':'rgba(180,50,50,0.09)'};pointer-events:none;z-index:0;line-height:1">${isWin2?'胜利':'失败'}</div>
            <div style="position:relative;z-index:1;display:flex;align-items:flex-start;gap:9px">
              <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:3px">
                <div style="width:40px;height:40px;border-radius:50%;border:2.5px solid rgba(78,150,220,0.72);overflow:hidden;background:rgba(210,230,248,0.55)">
                  ${myRoleUrl?`<img src="${myRoleUrl}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">` : '<span style="font-size:18px;display:flex;align-items:center;justify-content:center;height:100%;color:rgba(60,120,200,0.6)">⚔</span>'}
                </div>
                <span style="font-size:5px;padding:1.5px 6px;border-radius:8px;background:rgba(78,150,220,0.14);border:1px solid rgba(78,150,220,0.38);color:#3a70b0;white-space:nowrap">爪牙</span>
              </div>
              <div style="flex:1;min-width:0;padding-top:2px">
                <div style="font-size:11px;font-weight:700;color:#3d2b1f;margin-bottom:3px;letter-spacing:.5px">CHAO</div>
                <div style="font-size:5.5px;color:rgba(110,80,45,0.65);margin-bottom:5px;line-height:1.5">房间 62365 · ${n2}人局 · 8号座位</div>
                <span style="font-size:5px;padding:1.5px 7px;border-radius:8px;background:${winBg};border:1px solid ${winBdr};color:${winTxtClr};font-weight:600">${isWin2?'✓ 胜利':'✗ 失败'}</span>
              </div>
            </div>
            <div style="margin-top:7px;padding-top:6px;border-top:1px solid rgba(180,148,60,0.18)">
              <span style="font-size:5.5px;color:rgba(110,82,32,0.78);background:rgba(192,144,53,0.10);border:1px solid rgba(192,144,53,0.25);border-radius:6px;padding:2px 7px">🏅 藏票大师</span>
            </div>
          </div>
          ${this._cDivider('圆桌回放')}
          <div style="position:relative;margin:0 -2px">
            <div class="ph-table-area ph-table-area-sm" style="background:transparent!important;border:none!important;box-shadow:none!important">
              <div class="ph-table-inner">
                ${this._tableImg()}
                ${detailSeats}
                <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;z-index:2;pointer-events:none">
                  <div style="font-size:8.5px;font-weight:700;color:${winClr};letter-spacing:1px;text-shadow:0 1px 6px rgba(255,255,255,0.75)">${isWin2?'正义胜利':'邪恶胜利'}</div>
                  <div style="font-size:5px;color:rgba(100,80,40,0.60);letter-spacing:.5px;margin-top:1px">${isWin2?'刺客落空':'刺杀梅林'}</div>
                </div>
              </div>
            </div>
          </div>
          ${this._makeDetailSection('任务进度', missionPills)}
          ${this._makeDetailSection('任务详情', missionTable)}
          ${this._makeDetailSection('AI 复盘', aiRecap)}
        </div>`;
    }

    return `
      ${this._bgLayer('in-game')}${this._maskDiv()}
      ${detailSwitcher}
      <div class="ph-nav">
        <div class="ph-nav-back">← 返回</div>
        <div class="ph-nav-title">对战详情</div>
        <div style="margin-left:auto;font-size:9px;color:var(--aw-subtext)">···</div>
      </div>
      <div class="ph-content" style="padding:5px 5px 6px;gap:5px">
        <div class="ph-ghc" style="background:var(--aw-panel);border:var(--aw-panel-border-width,1px) solid var(--aw-panel-border)">
          <div class="ph-ghc-bar ${resultCls}"></div>
          <div class="ph-ghc-body">
            <div class="ph-ghc-top-row">
              <div><span class="ph-ghc-id">对局 </span><span class="ph-ghc-id-num">#85</span></div>
              <div class="ph-ghc-result-tag ${resultCls}"><div class="ph-ghc-dot ${resultCls}"></div>${resultTxt}</div>
            </div>
            <div class="ph-ghc-hero-row">
              <div class="ph-ghc-portrait-wrap">
                ${isDun
                  ? `<div style="width:28px;aspect-ratio:3/5;background:rgba(8,4,2,${myRoleUrl?'0.4':'0.92'});border:1.5px solid rgba(200,70,60,0.75);position:relative;overflow:hidden;flex-shrink:0">
                       ${myRoleUrl?`<img src="${myRoleUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">` : '<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#c8982a">☠</span>'}
                       <span style="position:absolute;bottom:0;left:0;right:0;background:rgba(6,3,0,0.88);border-top:1px solid rgba(185,138,52,0.5);color:#c8982a;font-size:4.5px;font-family:'DotGothic16',monospace;text-align:center;line-height:1.6;z-index:2">爪牙</span>
                     </div>`
                  : `<div class="ph-ghc-portrait" style="border-color:rgba(220,60,60,.55)">
                       ${myRoleUrl?`<img src="${myRoleUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:calc(50% * var(--aw-r,1))" onerror="this.outerHTML='☠️'">` : '☠️'}
                     </div>
                     <div class="ph-ghc-role-pill">爪牙</div>`}
              </div>
              <div style="flex:1">
                <div class="ph-ghc-player-name">CHAO</div>
                <div class="ph-ghc-meta-grid">
                  <div class="ph-ghc-meta-item"><span style="opacity:.6;margin-right:2px">房</span><span>29369</span></div>
                  <div class="ph-ghc-meta-item"><span style="opacity:.6;margin-right:2px">人</span><span>${n2} 人局</span></div>
                  <div class="ph-ghc-meta-item"><span style="opacity:.6;margin-right:2px">席</span><span>1 号</span></div>
                  <div class="ph-ghc-meta-item"><span style="opacity:.6;margin-right:2px">局</span><span class="ph-ghc-meta-val evil">邪恶胜利</span></div>
                </div>
              </div>
            </div>
            <div class="ph-ghc-divider"></div>
            <div class="ph-ghc-medal-row"><div class="ph-ghc-medal">🏅 藏票大师</div></div>
          </div>
        </div>
        ${this._makeDetailSection('圆桌回放', `<div class="ph-table-area ph-table-area-sm">
            <div class="ph-table-inner">
              ${this._tableImg()}
              ${detailSeats}
              <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;z-index:2;min-width:52px">
                <div style="font-size:7px;font-weight:700;color:#fca5a5;line-height:1.4;letter-spacing:.5px">邪恶胜利</div>
                <div style="font-size:5.5px;color:rgba(255,255,255,.45);line-height:1.3">刺杀梅林</div>
              </div>
            </div>
          </div>`, 'overflow:visible')}
        ${this._makeDetailSection('任务进度', missionPills)}
        ${this._makeDetailSection('任务详情', missionTable)}
        ${this._makeDetailSection('AI 复盘', aiRecap)}
      </div>`;
  }


  // ── ANIMATION SCREEN ───────────────────────────────────────────
  _animation() {
    const animSwitcher = this._makeSwitcher([
      {lbl:'出征中',   act:this.animView==='expedition',    fn:"__pp.setAnimView('expedition')"},
      {lbl:'任务成功', act:this.animView==='success',       fn:"__pp.setAnimView('success')"},
      {lbl:'任务失败', act:this.animView==='fail',          fn:"__pp.setAnimView('fail')"},
      {lbl:'刺杀结算', act:this.animView==='assassination', fn:"__pp.setAnimView('assassination')"},
    ]);
    if (this.animView === 'expedition')    return this._animExpedition(animSwitcher);
    if (this.animView === 'assassination') return this._animAssassination(animSwitcher);
    return this._animResult(animSwitcher);
  }

  _animExpedition(animSwitcher) {
    const isCel = this._isCelestial();
    const isDun = this._isDungeon();
    const expUrl = this._getAsset('quest-success') || (isCel ? this._getAsset('in-game-bg') : null);
    const expRoles = ['merlin','percival','lancelot_good'];
    const expNames = ['光影','龙影','鹰眼'];
    const expBdrClr = isCel ? 'rgba(192,148,53,0.55)' : isDun ? 'rgba(200,152,42,0.55)' : 'rgba(255,255,255,0.18)';
    const expAccClr = isCel ? 'rgba(108,72,12,0.90)' : isDun ? '#c8982a' : 'var(--aw-accent,#d9b36b)';
    const corners = isDun ? this._dungeonCorners(5) : '';
    const expCardBg = isCel ? 'rgba(245,238,220,0.85)' : 'rgba(8,4,2,0.85)';
    const expNameClr = isCel ? 'rgba(90,60,15,0.80)' : 'rgba(255,255,255,0.5)';
    const expCardsHtml = expRoles.map((r,i) => {
      const u = this._roleImgUrl(r);
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:44px;height:66px;border:1.5px solid ${expBdrClr};overflow:hidden;background:${expCardBg};position:relative;flex-shrink:0;border-radius:${isCel?'2px':'0'}">
          ${u ? `<img src="${u}" style="width:100%;height:100%;object-fit:cover;${isDun?'image-rendering:pixelated':''}" onerror="this.remove()">` : ''}
          ${corners}
        </div>
        <div style="font-size:6.5px;color:${expNameClr};font-family:${isDun?"'DotGothic16',monospace":'inherit'}">${expNames[i]}</div>
      </div>`;
    }).join('');
    const expPillsHtml = [1,2,3,4,5].map(i => {
      const st = i<3?(i===2?'fail':'success'):i===3?'current':'future';
      return `<div class="ph-pill ${st}" style="min-width:24px"><div class="ph-pill-icon">${st==='success'?'✓':st==='fail'?'✗':''}</div></div>`;
    }).join('');
    const roundTxt = isCel ? 'rgba(118,82,22,0.75)' : 'rgba(255,255,255,0.35)';
    const subTxt   = isCel ? 'rgba(118,82,22,0.50)' : 'rgba(255,255,255,0.22)';
    const expBg    = isCel ? '#e8e0cc' : '#000';
    const expBgOp  = isCel ? '0.82' : '0.20';
    const expBgFlt = isCel ? '' : 'filter:blur(3px)';
    const overlay  = isCel
      ? 'linear-gradient(to bottom,rgba(248,242,228,0.55) 0%,rgba(248,242,228,0.10) 40%,rgba(238,228,205,0.50) 100%)'
      : 'linear-gradient(to bottom,rgba(0,0,0,0.5) 0%,rgba(0,0,0,0.05) 45%,rgba(0,0,0,0.65) 100%)';
    return `
      ${expUrl ? `<img src="${expUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:${expBgOp};${expBgFlt}" onerror="this.remove()">` : `<div style="position:absolute;inset:0;background:${expBg}"></div>`}
      <div style="position:absolute;inset:0;background:${overlay}"></div>
      <div style="position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
        <div style="font-size:7px;letter-spacing:4px;color:${roundTxt}">第 3 轮任务</div>
        <div style="font-size:22px;font-weight:800;letter-spacing:6px;color:${expAccClr};text-shadow:0 0 24px rgba(200,152,42,0.35)">出征中</div>
        <div style="font-size:6px;color:${subTxt};letter-spacing:2px;margin-bottom:4px">3 名骑士出发</div>
        <div style="display:flex;gap:12px">${expCardsHtml}</div>
      </div>
      <div style="position:absolute;bottom:20px;left:0;right:0;z-index:2;display:flex;flex-direction:column;align-items:center;gap:6px">
        <div style="font-size:5.5px;letter-spacing:2px;color:${subTxt}">等待行动结果…</div>
        <div class="ph-pills-row" style="gap:5px">${expPillsHtml}</div>
      </div>
      ${animSwitcher}`;
  }

  _animResult(animSwitcher) {
    const isCel = this._isCelestial();
    const isDun = this._isDungeon();
    const isSuccess = this.animView !== 'fail';
    const evUrl = this._getAsset(isSuccess ? 'quest-success' : 'quest-fail');
    const evLabel = isSuccess ? '任务成功' : '任务失败';
    const evColor = isSuccess
      ? (isCel ? '#c08820' : isDun ? '#90c060' : '#4ade80')
      : (isCel ? '#7080a8' : isDun ? '#d06050' : '#f87171');
    const evGlow = isSuccess
      ? (isCel ? 'rgba(192,136,32,0.50)' : 'rgba(74,222,128,0.35)')
      : (isCel ? 'rgba(100,115,175,0.40)' : 'rgba(248,113,113,0.35)');
    const evGrad = isSuccess
      ? (isCel ? 'rgba(238,224,190,0.18) 0%,rgba(238,224,190,0) 38%,rgba(225,210,165,0.62) 100%'
               : 'rgba(8,40,12,0.75) 0%,rgba(0,0,0,0.05) 40%,rgba(0,0,0,0.72) 100%')
      : (isCel ? 'rgba(200,200,225,0.18) 0%,rgba(200,200,225,0) 38%,rgba(185,185,215,0.60) 100%'
               : 'rgba(40,8,5,0.75) 0%,rgba(0,0,0,0.05) 40%,rgba(0,0,0,0.72) 100%');
    const evBg  = isCel ? (isSuccess ? '#d4e4c8' : '#c8c8de') : '#000';
    const evOp  = isCel ? (isSuccess ? '0.80' : '0.70') : (isSuccess ? '0.38' : '0.30');
    const vYClr = isCel ? '#3a8a50' : isDun ? '#90c060' : '#4ade80';
    const vNClr = isCel ? '#b03030' : isDun ? '#c85848' : '#f87171';
    const rdClr = isCel ? 'rgba(80,55,15,0.40)' : 'rgba(255,255,255,0.28)';
    const nmClr = isCel ? 'rgba(80,55,15,0.75)' : 'rgba(255,255,255,0.3)';
    const voteResults = isSuccess
      ? [{nm:'月影',s:3,v:'✓'},{nm:'光影',s:1,v:'✓'},{nm:'龙影',s:2,v:'✓'}]
      : [{nm:'月影',s:3,v:'✓'},{nm:'光影',s:1,v:'✗'},{nm:'龙影',s:2,v:'✗'}];
    const avStyle = isDun
      ? `width:24px;height:24px;background:rgba(20,14,4,.8);border:1px solid rgba(200,152,42,.35);display:flex;align-items:center;justify-content:center;font-size:8px;font-family:'DotGothic16',monospace;color:#c8982a`
      : isCel
      ? `width:24px;height:24px;border-radius:50%;background:rgba(235,225,200,0.75);border:1.5px solid rgba(192,148,53,0.55);display:flex;align-items:center;justify-content:center;font-size:7px;color:rgba(100,70,20,0.90)`
      : `width:24px;height:24px;border-radius:50%;background:rgba(12,10,8,.5);border:1px solid rgba(255,255,255,.14);display:flex;align-items:center;justify-content:center;font-size:7px;color:rgba(255,255,255,.6)`;
    const votesHtml = voteResults.map(v =>
      `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="${avStyle}">${v.s}</div>
        <div style="font-size:16px;font-weight:700;color:${v.v==='✓'?vYClr:vNClr};line-height:1">${v.v}</div>
        <div style="font-size:6px;color:${nmClr}">${v.nm}</div>
      </div>`).join('');
    const pillsHtml = [1,2,3,4,5].map(i => {
      const st = i<3?(i===2?'fail':'success'):i===3?(isSuccess?'success':'fail'):'future';
      return `<div class="ph-pill ${st}" style="min-width:24px"><div class="ph-pill-icon">${st==='success'?'✓':st==='fail'?'✗':'·'}</div></div>`;
    }).join('');
    return `
      <div style="position:absolute;inset:0;background:${evBg}"></div>
      ${evUrl ? `<img src="${evUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:${evOp}" onerror="this.remove()">` : ''}
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,${evGrad})"></div>
      <div style="position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px">
        <div style="font-size:6px;letter-spacing:4px;color:${rdClr}">第 3 轮</div>
        <div style="font-size:28px;font-weight:800;letter-spacing:4px;color:${evColor};text-shadow:0 0 32px ${evGlow}">${evLabel}</div>
        <div style="font-size:6px;color:${rdClr};letter-spacing:2px">${voteResults.length} 人出征</div>
        <div style="display:flex;gap:20px;margin-top:10px">${votesHtml}</div>
        <div style="font-size:6px;color:${rdClr};margin-top:2px">${isSuccess?'全员投出成功票':voteResults.filter(v=>v.v==='✗').length+'票失败'}</div>
      </div>
      <div style="position:absolute;bottom:18px;left:0;right:0;z-index:2;display:flex;justify-content:center">
        <div class="ph-pills-row" style="gap:5px">${pillsHtml}</div>
      </div>
      ${animSwitcher}`;
  }

  _animAssassination(animSwitcher) {
    const isCel = this._isCelestial();
    const isDun = this._isDungeon();
    const isGoodWin = this.endgame !== 'evil';
    const merlinUrl = this._roleImgUrl('merlin');
    const assUrl    = this._roleImgUrl('assassin');
    const assBgUrl  = isCel ? this._getAsset('in-game-bg') : null;
    const bdrClrM = isCel ? (isGoodWin?'rgba(78,148,215,0.65)':'rgba(180,60,60,0.65)') : (isGoodWin?'rgba(78,158,255,0.6)':'rgba(220,60,60,0.6)');
    const bdrClrA = isCel ? 'rgba(180,60,60,0.65)' : 'rgba(220,60,60,0.6)';
    const resultClr = isCel ? (isGoodWin?'#3a7ab8':'#c84040') : (isGoodWin?'#5bc0ff':'#f87171');
    const subTxt2   = isGoodWin ? '正义阵营胜利' : '邪恶阵营胜利';
    const assCardBg = isCel ? 'rgba(245,235,220,0.85)' : 'rgba(20,4,4,0.9)';
    const merCardBg = isCel ? 'rgba(235,242,252,0.85)' : 'rgba(4,10,20,0.9)';
    const nmClrAss  = isCel ? 'rgba(160,50,50,0.80)' : 'rgba(220,80,80,0.7)';
    const nmClrMer  = isCel ? 'rgba(50,100,160,0.80)' : 'rgba(78,158,255,0.7)';
    const pnClr     = isCel ? 'rgba(90,60,15,0.75)' : 'rgba(255,255,255,0.55)';
    const swordClr  = isCel ? 'rgba(160,80,40,0.75)' : 'rgba(200,60,60,0.65)';
    const pointsClr = isCel ? 'rgba(90,60,15,0.60)' : 'rgba(255,255,255,0.25)';
    const targetClr = isCel ? 'rgba(90,60,15,0.60)' : 'rgba(255,200,50,0.5)';
    const assBg     = isCel ? '#ddd8c8' : '#000';
    const assOp     = isCel ? '0.80' : '1';
    const assOverlay = isCel
      ? 'radial-gradient(ellipse at 50% 35%,rgba(248,240,220,0.45) 0%,rgba(232,220,195,0.70) 100%)'
      : 'radial-gradient(ellipse at 50% 35%,rgba(100,10,10,0.55) 0%,rgba(0,0,0,0.95) 70%)';
    const assLblHdr = isCel ? 'rgba(130,80,20,0.65)' : 'rgba(220,60,60,0.55)';
    const subClr2   = isCel ? 'rgba(90,60,15,0.60)' : 'rgba(255,255,255,0.35)';
    const revLblClr = isCel ? 'rgba(90,60,15,0.45)' : 'rgba(255,255,255,0.25)';

    const revealPl = [
      {nm:'光影',role:'梅林',    roleId:'merlin',       faction:'good'},
      {nm:'龙影',role:'派西维尔',roleId:'percival',     faction:'good'},
      {nm:'月影',role:'莫甘娜',  roleId:'morgana',      faction:'evil'},
      {nm:'雷鸣',role:'刺客',    roleId:'assassin',     faction:'evil'},
      {nm:'鹰眼',role:'忠臣',    roleId:'arthur_loyal', faction:'good'},
      {nm:'蝶舞',role:'忠臣',    roleId:'arthur_loyal', faction:'good'},
      {nm:'海浪',role:'爪牙',    roleId:'minion',       faction:'evil'},
    ];

    let revealRow;
    if (isCel) {
      const goodPl = revealPl.filter(p=>p.faction==='good');
      const evilPl = revealPl.filter(p=>p.faction==='evil');
      const celCard = p => {
        const u = this._roleImgUrl(p.roleId);
        const isEvil = p.faction==='evil';
        const bClr = isEvil ? 'rgba(180,60,60,0.50)' : 'rgba(60,120,200,0.45)';
        const cBg  = isEvil ? 'rgba(245,230,220,0.88)' : 'rgba(228,240,254,0.88)';
        const rClr = isEvil ? 'rgba(155,45,45,0.88)' : 'rgba(45,95,158,0.88)';
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          <div style="width:26px;height:36px;border:1.5px solid ${bClr};overflow:hidden;background:${cBg};position:relative;border-radius:2px">
            ${u?`<img src="${u}" style="width:100%;height:100%;object-fit:cover" onerror="this.remove()">` : ''}
          </div>
          <div style="font-size:5.5px;color:${rClr};font-weight:600">${p.role}</div>
          <div style="font-size:4.5px;color:rgba(80,55,20,0.65)">${p.nm}</div>
        </div>`;
      };
      const lineL = `<span style="flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(192,148,53,0.45))"></span>`;
      const lineR = `<span style="flex:1;height:1px;background:linear-gradient(to left,transparent,rgba(192,148,53,0.45))"></span>`;
      revealRow = `<div style="width:100%">
        <div style="display:flex;align-items:center;gap:3px;margin-bottom:4px">${lineL}<span style="font-size:5px;color:rgba(45,95,158,0.70);letter-spacing:1.5px;white-space:nowrap">正义阵营</span>${lineR}</div>
        <div style="display:flex;justify-content:center;gap:5px;margin-bottom:6px">${goodPl.map(celCard).join('')}</div>
        <div style="display:flex;align-items:center;gap:3px;margin-bottom:4px">${lineL}<span style="font-size:5px;color:rgba(155,45,45,0.70);letter-spacing:1.5px;white-space:nowrap">邪恶阵营</span>${lineR}</div>
        <div style="display:flex;justify-content:center;gap:5px">${evilPl.map(celCard).join('')}</div>
      </div>`;
    } else {
      revealRow = revealPl.map(p => {
        const u = this._roleImgUrl(p.roleId);
        const fClr = p.faction==='evil' ? 'rgba(220,80,80,0.8)' : 'rgba(78,158,255,0.7)';
        const bClr = p.faction==='evil' ? 'rgba(220,60,60,0.45)' : 'rgba(78,158,255,0.35)';
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          <div style="width:${isDun?'22px':'24px'};height:${isDun?'33px':'24px'};border:1px solid ${bClr};overflow:hidden;background:rgba(8,4,2,0.9);position:relative;${isDun?'':'border-radius:2px'}">
            ${u?`<img src="${u}" style="width:100%;height:100%;object-fit:cover;${isDun?'image-rendering:pixelated':''}" onerror="this.remove()">` : ''}
          </div>
          <div style="font-size:5px;color:${fClr}">${p.role}</div>
        </div>`;
      }).join('');
    }

    const tog1Bg  = isGoodWin ? (isCel?'rgba(60,110,190,.18)':'rgba(78,158,255,.2)') : 'transparent';
    const tog1Clr = isGoodWin ? (isCel?'#3a6ab0':'#7ac7ff') : (isCel?'rgba(90,60,15,.35)':'rgba(255,255,255,.3)');
    const tog2Bg  = !isGoodWin ? (isCel?'rgba(185,55,55,.15)':'rgba(220,60,60,.2)') : 'transparent';
    const tog2Clr = !isGoodWin ? (isCel?'#a03030':'#ff8a8a') : (isCel?'rgba(90,60,15,.35)':'rgba(255,255,255,.3)');
    const toggleBg = isCel ? 'rgba(220,200,165,0.35)' : 'rgba(255,255,255,0.05)';

    return `
      <div style="position:absolute;inset:0;background:${assBg}"></div>
      ${assBgUrl ? `<img src="${assBgUrl}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:${assOp}" onerror="this.remove()">` : ''}
      <div style="position:absolute;inset:0;background:${assOverlay}"></div>
      <div style="position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 0 12px;gap:5px">
        <div style="font-size:7px;letter-spacing:4px;color:${assLblHdr}">刺 杀 结 算</div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:6px">
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
            <div style="width:38px;height:57px;border:1.5px solid ${bdrClrA};overflow:hidden;background:${assCardBg};position:relative;border-radius:${isCel?'2px':'0'}">
              ${assUrl?`<img src="${assUrl}" style="width:100%;height:100%;object-fit:cover;${isDun?'image-rendering:pixelated':''}" onerror="this.remove()">` : ''}
            </div>
            <div style="font-size:5.5px;color:${nmClrAss}">刺客</div>
            <div style="font-size:6px;color:${pnClr}">雷鸣</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
            <div style="font-size:16px;color:${swordClr};font-weight:700;line-height:1">⚔</div>
            <div style="font-size:5.5px;color:${pointsClr}">指向</div>
            <div style="font-size:5px;color:${targetClr}">龙影</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
            <div style="width:38px;height:57px;border:1.5px solid ${bdrClrM};overflow:hidden;background:${merCardBg};position:relative;border-radius:${isCel?'2px':'0'}">
              ${merlinUrl?`<img src="${merlinUrl}" style="width:100%;height:100%;object-fit:cover;${isDun?'image-rendering:pixelated':''}" onerror="this.remove()">` : ''}
            </div>
            <div style="font-size:5.5px;color:${nmClrMer}">梅林</div>
            <div style="font-size:6px;color:${pnClr}">光影</div>
          </div>
        </div>
        <div style="text-align:center;margin-top:4px">
          <div style="font-size:17px;font-weight:800;color:${resultClr};letter-spacing:2px;text-shadow:0 0 18px ${isGoodWin?'rgba(60,120,210,0.35)':'rgba(180,50,50,0.35)'}">${isGoodWin?'猜错了！':'刺杀成功！'}</div>
          <div style="font-size:7px;color:${subClr2};margin-top:3px">${subTxt2}</div>
        </div>
        <div style="margin-top:6px;width:100%;padding:0 ${isCel?'10':'8'}px">
          ${isCel
            ? `<div style="display:flex;align-items:center;gap:4px;margin-bottom:6px">
                <span style="flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(192,148,53,0.55))"></span>
                <span style="font-size:6px;color:rgba(120,80,20,0.75);letter-spacing:2px;font-weight:600">身 份 揭 示</span>
                <span style="flex:1;height:1px;background:linear-gradient(to left,transparent,rgba(192,148,53,0.55))"></span>
              </div>`
            : `<div style="font-size:5.5px;color:${revLblClr};letter-spacing:2px;text-align:center;margin-bottom:5px">身份揭示</div>`}
          ${isCel ? revealRow : `<div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap">${revealRow}</div>`}
        </div>
        <div style="margin-top:8px;display:flex;gap:3px;background:${toggleBg};padding:3px;border-radius:3px">
          <div onclick="event.stopPropagation();__pp.setState({endgame:'good'})" style="padding:3px 8px;font-size:6px;cursor:pointer;border-radius:2px;background:${tog1Bg};color:${tog1Clr}">梅林幸存</div>
          <div onclick="event.stopPropagation();__pp.setState({endgame:'evil'})" style="padding:3px 8px;font-size:6px;cursor:pointer;border-radius:2px;background:${tog2Bg};color:${tog2Clr}">梅林陨落</div>
        </div>
      </div>
      ${animSwitcher}`;
  }

  // ── UI SHOWCASE SCREEN ─────────────────────────────────────────
  _ui() {
    const vars = this._getVars();
    const getVar = (name, def) => {
      const m = vars.match(new RegExp(name.replace('--','--') + '\\s*:\\s*([^;]+)'));
      return m ? m[1].trim() : def;
    };
    const acc    = getVar('--aw-accent',      '#d9b36b');
    const accTxt = getVar('--aw-accent-text', '#1a1200');
    const ghost  = getVar('--aw-btn-ghost-border', 'rgba(255,255,255,.22)');
    const ghTxt  = getVar('--aw-btn-ghost-text',   '#eef1f7');
    const inpBg  = getVar('--aw-input-bg',    'rgba(255,255,255,.06)');
    const inpBdr = getVar('--aw-input-border','rgba(255,255,255,.14)');
    const pnl    = getVar('--aw-panel',       'rgba(19,23,31,.82)');
    const pnlBdr = getVar('--aw-panel-border','rgba(255,255,255,.10)');
    const tx     = getVar('--aw-text',        '#eef1f7');
    const sub    = getVar('--aw-subtext',     '#aeb6c7');
    const killUrl  = this._getAsset('kill-icon');
    const histUrl  = this._getAsset('history-icon');
    const statsUrl = this._getAsset('stats-icon');
    return `
      ${this._bgLayer('home')}${this._maskDiv()}
      <div class="ph-nav"><div class="ph-nav-title">UI 组件预览</div></div>
      <div class="ph-content" style="gap:7px">
        <div class="ph-panel">
          <div style="font-size:7px;font-weight:700;color:${sub};letter-spacing:2px;margin-bottom:6px">BUTTONS</div>
          <div style="display:flex;flex-direction:column;gap:5px">
            <div style="background:${acc};color:${accTxt};border-radius:calc(7px * var(--aw-r));padding:7px;text-align:center;font-size:10px;font-weight:700;letter-spacing:1px">组队出发</div>
            <div style="border:1px solid ${ghost};color:${ghTxt};border-radius:calc(7px * var(--aw-r));padding:6px;text-align:center;font-size:10px;background:rgba(255,255,255,.03)">查看详情</div>
            <div style="display:flex;gap:4px">
              <div style="flex:1;background:rgba(74,222,128,.14);border:1px solid rgba(74,222,128,.35);border-radius:calc(7px * var(--aw-r));padding:6px;text-align:center;font-size:9px;color:#4ade80;font-weight:700">✓ 同意</div>
              <div style="flex:1;background:rgba(248,113,113,.14);border:1px solid rgba(248,113,113,.35);border-radius:calc(7px * var(--aw-r));padding:6px;text-align:center;font-size:9px;color:#f87171;font-weight:700">✗ 拒绝</div>
            </div>
          </div>
        </div>
        <div class="ph-panel">
          <div style="font-size:7px;font-weight:700;color:${sub};letter-spacing:2px;margin-bottom:6px">INPUTS &amp; CHIPS</div>
          <div style="background:${inpBg};border:1px solid ${inpBdr};border-radius:calc(7px * var(--aw-r));padding:6px 8px;font-size:8px;color:${sub}">输入房间号…</div>
          <div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap">
            <div style="padding:3px 10px;border-radius:calc(999px * var(--aw-r));background:${acc};color:${accTxt};font-size:8px;font-weight:700">5人</div>
            <div style="padding:3px 10px;border-radius:calc(999px * var(--aw-r));border:1px solid ${ghost};color:${ghTxt};font-size:8px">7人</div>
            <div style="padding:3px 10px;border-radius:calc(999px * var(--aw-r));border:1px solid ${ghost};color:${ghTxt};font-size:8px">10人</div>
          </div>
        </div>
        <div style="background:${pnl};border:1px solid ${pnlBdr};border-radius:calc(10px * var(--aw-r));padding:10px 10px 8px;position:relative;overflow:hidden">
          <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,${acc},transparent)"></div>
          <div style="font-size:10px;font-weight:700;color:${tx};text-align:center;margin-bottom:4px">确认刺杀梅林？</div>
          <div style="font-size:7px;color:${sub};text-align:center;margin-bottom:8px">此操作不可撤销，请谨慎确认</div>
          <div style="display:flex;gap:4px">
            <div style="flex:1;border:1px solid ${ghost};color:${ghTxt};border-radius:calc(6px * var(--aw-r));padding:5px;text-align:center;font-size:9px">取消</div>
            <div style="flex:1;background:rgba(248,113,113,.18);border:1px solid rgba(248,113,113,.4);color:#f87171;border-radius:calc(6px * var(--aw-r));padding:5px;text-align:center;font-size:9px;font-weight:700">确认刺杀</div>
          </div>
        </div>
        <div class="ph-panel">
          <div style="font-size:7px;font-weight:700;color:${sub};letter-spacing:2px;margin-bottom:6px">NAV ICONS</div>
          <div style="display:flex;gap:10px;align-items:center">
            ${killUrl  ? `<div style="display:flex;flex-direction:column;align-items:center;gap:2px"><img src="${killUrl}"  style="width:24px;height:24px;object-fit:contain" onerror="this.style.display='none'"><span style="font-size:6px;color:${sub}">刺杀</span></div>` : ''}
            ${histUrl  ? `<div style="display:flex;flex-direction:column;align-items:center;gap:2px"><img src="${histUrl}"  style="width:24px;height:24px;object-fit:contain" onerror="this.style.display='none'"><span style="font-size:6px;color:${sub}">历史</span></div>` : ''}
            ${statsUrl ? `<div style="display:flex;flex-direction:column;align-items:center;gap:2px"><img src="${statsUrl}" style="width:24px;height:24px;object-fit:contain" onerror="this.style.display='none'"><span style="font-size:6px;color:${sub}">统计</span></div>` : ''}
            <div style="margin-left:auto;display:flex;flex-direction:column;align-items:center;gap:2px">
              <div style="width:24px;height:24px;border-radius:50%;background:${acc};display:flex;align-items:center;justify-content:center;font-size:11px;color:${accTxt}">⚔</div>
              <span style="font-size:6px;color:${sub}">主色</span>
            </div>
          </div>
        </div>
      </div>`;
  }
}

// ── Static tab bar builder (for component-workshop) ──────────────
PhonePreview.buildTabBar = function(preview, containerEl) {
  const tabs = [
    { id: 'home',      label: '首页' },
    { id: 'game',      label: '游戏', subs: [
      { id:'table',    label:'圆桌' },
      { id:'identity', label:'查身份' },
      { id:'speak',    label:'发言' },
      { id:'vote',     label:'投票' },
      { id:'mission',  label:'出征' },
      { id:'reveal',   label:'揭晓' },
    ]},
    { id: 'profile',   label: '主页' },
    { id: 'history',   label: '历史' },
    { id: 'detail',    label: '详情' },
    { id: 'animation', label: '动画', subs: [
      { id:'expedition',    label:'出征中' },
      { id:'success',       label:'任务成功' },
      { id:'fail',          label:'任务失败' },
      { id:'assassination', label:'刺杀结算' },
    ]},
    { id: 'ui',        label: 'UI' },
  ];

  function render(activeTab, activeSub) {
    const activeTabObj = tabs.find(t => t.id === activeTab);
    containerEl.innerHTML = `
      <div style="display:flex;gap:2px;padding:3px;background:var(--card);border-radius:8px;border:1px solid var(--border);overflow-x:auto;scrollbar-width:none;flex-shrink:0">
        ${tabs.map(t => `
          <div onclick="window.__ppSetTab('${t.id}')" style="padding:5px 9px;border-radius:5px;font-size:10px;cursor:pointer;color:${activeTab===t.id?'var(--text)':'var(--sub)'};background:${activeTab===t.id?'rgba(255,255,255,.08)':'transparent'};white-space:nowrap;flex-shrink:0">${t.label}</div>
        `).join('')}
      </div>
      ${activeTabObj && activeTabObj.subs ? `
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">
          ${activeTabObj.subs.map(s => `
            <div onclick="window.__ppSetSub('${s.id}')" style="padding:3px 8px;border-radius:4px;font-size:10px;cursor:pointer;color:${activeSub===s.id?'#0c0f17':'var(--sub)'};background:${activeSub===s.id?'var(--accent)':'transparent'};border:1px solid ${activeSub===s.id?'transparent':'var(--border)'};font-weight:${activeSub===s.id?'600':'400'};white-space:nowrap">${s.label}</div>
          `).join('')}
        </div>` : ''}
    `;
  }

  window.__ppSetTab = (tab) => {
    preview.setTab(tab);
    const t = tabs.find(x => x.id === tab);
    render(tab, t && t.subs ? t.subs[0].id : '');
  };
  window.__ppSetSub = (sub) => {
    if (preview.tab === 'game') {
      preview.setGameView(sub);
    } else if (preview.tab === 'animation') {
      preview.setAnimView(sub);
    }
    render(preview.tab, sub);
  };

  render('home', '');
};

window.PhonePreview = PhonePreview;

// ── Base phone UI styles (auto-injected once) ───────────────────────────────
PhonePreview._baseStylesInjected = false;
PhonePreview._ensureBaseStyles = function() {
  if (PhonePreview._baseStylesInjected) return;
  PhonePreview._baseStylesInjected = true;
  if (document.getElementById('pp-base-styles')) return;
  const el = document.createElement('style');
  el.id = 'pp-base-styles';
  el.textContent = PP_BASE_CSS;
  document.head.appendChild(el);
};
