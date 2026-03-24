const MEDAL_BASE = "https://www.awalon.top/mp-assets/medals";
const USE_MEDAL_IMAGES = true;

const ALL_MEDALS = [
  { code: "good_blocker", name: "挡刀侠", faction: "good", description: "图标：忠诚为梅林挡刀。达成条件：非梅林的好人，被刺杀。" },
  { code: "good_clean_captain", name: "老司机", faction: "good", description: "图标：开车非常稳的司机。达成条件：非梅林的好人，2次组的队伍里面不含任何坏人。" },
  { code: "good_wolf_trust", name: "钻狼窝", faction: "good", description: "图标：在狼窝里面不自知。达成条件：非梅林的好人，5次在有坏人的队伍里面投赞成票。" },
  { code: "merlin_survivor", name: "梅林是狗", faction: "good", description: "图标：非常像狗的梅林。达成条件：梅林，3次同意里面含坏人的队伍。" },
  { code: "merlin_three_fail_lose", name: "心累", faction: "good", description: "图标：好人带不动。达成条件：梅林，因为3次任务失败而输掉游戏。" },
  { code: "good_clean_trust", name: "开眼玩家", faction: "good", description: "图标：开了天眼了。达成条件：非梅林的好人，全程在有坏人的队伍里面投反对票，在全好人的队伍里面投赞成票。" },
  { code: "percival_morgana_trust", name: "晕头转向", faction: "good", description: "图标：混乱的派西分不清楚拇指位。达成条件：派西维尔，3次在有莫甘娜在的队伍里面投同意票。" },
  { code: "good_protect_round_fail_captain", name: "盲人骑瞎马", faction: "good", description: "图标：盲人。达成条件：非梅林的好人，首轮是队长的情况，组了一个全好人的队伍。" },
  { code: "good_three_evil_team_captain", name: "错到极致也是对", faction: "good", description: "图标：全错好人，某种意义上也是全对。达成条件：非梅林的好人，自己是队长的情况，组了一个三个坏人的队伍。" },
  { code: "good_three_fail_lose", name: "不嘻嘻", faction: "good", description: "图标：非常的难受，憋屈的失败。达成条件：非梅林的好人，因为三次任务失败而输掉游戏。" },
  { code: "good_comeback_win", name: "开往春田花花", faction: "good", description: "图标：麦兜幼儿园。达成条件：好人阵营，直接前三局任务全部成功。" },
  { code: "good_three_success_participant", name: "好人王", faction: "good", description: "图标：非常忠诚的忠臣。达成条件：好人阵营，参与三次任务成功。" },
  { code: "assassin_early_hit_merlin", name: "刺客大师", faction: "evil", description: "图标：非常专业的刺客。达成条件：刺客，提前翻牌刺中梅林。" },
  { code: "morgana_percival_fail_master", name: "洗头大师", faction: "evil", description: "图标：擅长骗人的高手。达成条件：莫甘娜，2次在派西维尔同意的队伍中让任务失败。" },
  { code: "oberon_no_fail_with_evil", name: "找到组织", faction: "evil", description: "图标：终于找到了坏人同伴。达成条件：奥伯伦，在跟坏人阵营同一个队伍里自己没有投失败，但是任务失败。" },
  { code: "oberon_double_fail_with_evil", name: "撞车", faction: "evil", description: "图标：一不小心撞车了。达成条件：奥伯伦，在跟坏人阵营同一个队伍里自己投了失败，且任务失败票数超过1票。" },
  { code: "evil_protect_round_fail", name: "保护轮也炸了", faction: "evil", description: "图标：保护罩被击穿。达成条件：坏人阵营，在保护轮里让任务失败。" },
  { code: "evil_three_fail_win", name: "炸三塔", faction: "evil", description: "图标：三轮任务失败。达成条件：坏人阵营，三次任务失败而赢得游戏。" },
  { code: "evil_hide_votes_master", name: "藏票大师", faction: "evil", description: "图标：非常猥琐的在阴影中藏住自己。达成条件：坏人阵营，连续2次在队伍中都投了任务成功。" },
  { code: "evil_all_fail_non_protect", name: "毫无默契", faction: "evil", description: "图标：相互没有配合好的坏人。达成条件：坏人阵营，非保护轮中所有在队伍中的坏人都同时都投了任务失败。" },
  { code: "evil_first_three_fail_win", name: "车胎炸了", faction: "evil", description: "图标：车直接裂开。达成条件：坏人阵营直接前三局任务全部破坏任务导致获胜。" },
  { code: "evil_three_fail_participant", name: "狼王", faction: "evil", description: "图标：狼王皇冠。达成条件：坏人阵营，参与3次任务失败。" },
  { code: "evil_no_fail_win", name: "演技派", faction: "evil", description: "图标：面具。达成条件：坏人阵营，全程没有投失败票但是最终获胜。" },
  { code: "evil_fake_good_voter", name: "我想当个好人", faction: "evil", description: "图标：无间道。达成条件：全程给好人的队伍投赞成票，给有坏人的队伍投反对票。" }
];

const MEDAL_META_MAP = ALL_MEDALS.reduce((acc, medal) => {
  acc[medal.code] = medal;
  return acc;
}, {});

const MEDAL_IMAGE_MAP = ALL_MEDALS.reduce((acc, medal) => {
  acc[medal.code] = `${MEDAL_BASE}/${medal.code}.png`;
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
