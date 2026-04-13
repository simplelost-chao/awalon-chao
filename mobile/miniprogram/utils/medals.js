const MEDAL_BASE = "https://www.awalon.top/mp-assets/medals";
const USE_MEDAL_IMAGES = true;

const ALL_MEDALS = [
  // ── Good ──────────────────────────────────────────────────────────────────
  { code: "good_blocker", name: "挡刀侠", faction: "good",
    description: "图标：一把剑刺向好人。达成条件：非梅林的好人，被刺杀。" },
  { code: "good_clean_captain", name: "老司机", faction: "good",
    description: "图标：稳稳驾驶的司机。达成条件：非梅林的好人，作为队长至少2次组出全好人队伍。" },
  { code: "good_wolf_trust", name: "钻狼窝", faction: "good",
    description: "图标：好人误入狼群。达成条件：非梅林的好人，5次为含坏人的队伍投赞成票。" },
  { code: "merlin_survivor", name: "梅林是狗", faction: "good",
    description: "图标：梅林假装不在意。达成条件：梅林，3次为含坏人的队伍投赞成票（假装不认识坏人）。" },
  { code: "merlin_three_fail_lose", name: "心累", faction: "good",
    description: "图标：好人带不动。达成条件：梅林，因为3次任务失败而输掉游戏。" },
  { code: "good_clean_trust", name: "开眼玩家", faction: "good",
    description: "图标：开了天眼的好人。达成条件：非梅林的好人，全程对含坏人队伍投反对，对全好人队伍投赞成。" },
  { code: "percival_morgana_trust", name: "晕头转向", faction: "good",
    description: "图标：混乱的派西维尔。达成条件：派西维尔，3次在含莫甘娜的队伍里投同意票。" },
  { code: "good_first_round_clean_captain", name: "盲人骑瞎马", faction: "good",
    description: "图标：蒙眼扔飞镖射中靶心。达成条件：非梅林的好人，在第一轮作为队长组出全好人队伍（无梅林视角却猜对了）。" },
  // Legacy code alias — old records may store this key; hidden in UI, count merged into good_first_round_clean_captain
  { code: "good_protect_round_fail_captain", name: "盲人骑瞎马", faction: "good", hidden: true,
    description: "图标：蒙眼扔飞镖射中靶心。达成条件：非梅林的好人，在第一轮作为队长组出全好人队伍（无梅林视角却猜对了）。" },
  { code: "good_three_evil_team_captain", name: "错到极致也是对", faction: "good",
    description: "图标：全错反而全对。达成条件：非梅林的好人，作为队长组出含3个坏人的队伍。" },
  { code: "good_three_fail_lose", name: "不嘻嘻", faction: "good",
    description: "图标：憋屈的失败表情。达成条件：非梅林的好人，因为3次任务失败而输掉游戏。" },
  { code: "good_comeback_win", name: "开往春田花花", faction: "good",
    description: "图标：麦兜幼儿园。达成条件：好人阵营，前三局任务全部成功并获胜。" },
  { code: "good_three_success_participant", name: "好人王", faction: "good",
    description: "图标：好人阵营的皇冠。达成条件：好人阵营，参与3次任务成功。" },

  // ── Evil ──────────────────────────────────────────────────────────────────
  { code: "assassin_early_hit_merlin", name: "刺客大师", faction: "evil",
    description: "图标：匕首直刺梅林。达成条件：刺客，在游戏结束时成功刺中梅林。" },
  { code: "morgana_percival_fail_master", name: "洗头大师", faction: "evil",
    description: "图标：魅惑的莫甘娜。达成条件：莫甘娜，2次在派西维尔同意的队伍中自己投失败票导致任务失败。" },
  { code: "oberon_no_fail_with_evil", name: "找到组织", faction: "evil",
    description: "图标：奥伯伦终于找到坏人同伴。达成条件：奥伯伦，在跟坏人同队时自己没有投失败但任务失败。" },
  { code: "oberon_double_fail_with_evil", name: "撞车", faction: "evil",
    description: "图标：两辆车相撞。达成条件：奥伯伦，跟其他坏人同队时一起投了失败，任务失败票数超过1。" },
  { code: "evil_protect_round_fail", name: "保护轮也炸了", faction: "evil",
    description: "图标：保护罩被击穿。达成条件：坏人阵营，在保护轮（需要2票失败的轮次）里让任务失败。" },
  { code: "evil_three_fail_win", name: "炸三塔", faction: "evil",
    description: "图标：三座塔依次爆炸。达成条件：坏人阵营，三次任务失败而赢得游戏。" },
  { code: "evil_hide_votes_master", name: "藏票大师", faction: "evil",
    description: "图标：躲在阴影里的坏人。达成条件：坏人阵营，连续2次在任务中投成功票（隐藏身份）。" },
  { code: "evil_all_fail_non_protect", name: "毫无默契", faction: "evil",
    description: "图标：两个坏人各自行动互不知情。达成条件：坏人阵营，非保护轮中同队的2个以上坏人全都投了失败票（暴露默契）。" },
  { code: "evil_first_three_fail_win", name: "车胎炸了", faction: "evil",
    description: "图标：车直接裂开。达成条件：坏人阵营，前三轮任务全部破坏导致获胜。" },
  { code: "evil_three_fail_participant", name: "狼王", faction: "evil",
    description: "图标：狼王皇冠。达成条件：坏人阵营，亲自投了3次任务失败票。" },
  { code: "evil_no_fail_win", name: "演技派", faction: "evil",
    description: "图标：面具（无间道）。达成条件：坏人阵营，全程没有投失败票但最终获胜。" },
  { code: "evil_fake_good_voter", name: "我想当个好人", faction: "evil",
    description: "图标：无间道。达成条件：坏人阵营，全程给好人队伍投赞成，给含坏人队伍投反对。" },
];

const MEDAL_META_MAP = ALL_MEDALS.reduce((acc, medal) => {
  acc[medal.code] = medal;
  return acc;
}, {});

const MEDAL_IMAGE_MAP = ALL_MEDALS.reduce((acc, medal) => {
  // good_first_round_clean_captain is the new code; image file is still named after the old code
  const imageCode = medal.code === "good_first_round_clean_captain"
    ? "good_protect_round_fail_captain"
    : medal.code;
  acc[medal.code] = `${MEDAL_BASE}/${imageCode}.png`;
  return acc;
}, {});

function decorateMedal(medal) {
  if (!medal || !medal.code) return null;
  const meta = MEDAL_META_MAP[medal.code] || {};
  return {
    ...medal,
    code: medal.code,
    name: meta.name || medal.name || "",
    description: meta.description || medal.description || "",
    faction: medal.faction || meta.faction || "neutral",
    image: USE_MEDAL_IMAGES ? MEDAL_IMAGE_MAP[medal.code] || "" : ""
  };
}

function decorateMedals(list) {
  if (!Array.isArray(list)) return [];
  return list.map(decorateMedal).filter((item) => item && item.code && item.name);
}

module.exports = {
  ALL_MEDALS,
  MEDAL_IMAGE_MAP,
  decorateMedal,
  decorateMedals
};
