// 切换 false 可立即回退到 CDN PNG 图片
const USE_LOCAL_MEDAL_SVGS = true;

const MEDAL_BASE_CDN = "https://www.awalon.top/mp-assets/medals";
const MEDAL_BASE_LOCAL = "https://www.awalon.top/mp-assets/medals";

const ALL_MEDALS = [
  // ── 正义 · 通用 ─────────────────────────────────────────────────────────
  { code: "good_blocker", name: "挡刀侠", faction: "good",
    description: "非梅林的正义，被刺客刺杀（替梅林挡刀）。" },
  { code: "good_clean_captain", name: "老司机", faction: "good",
    description: "非梅林的正义，作为队长至少2次组出全正义队伍。" },
  { code: "good_wolf_trust", name: "钻狼窝", faction: "good",
    description: "非梅林的正义，5次为含邪恶的队伍投赞成票。" },
  { code: "good_clean_trust", name: "开眼玩家", faction: "good",
    description: "非梅林的正义，全程对含邪恶队伍投反对、对全正义队伍投赞成。" },
  { code: "good_first_round_clean_captain", name: "盲人骑瞎马", faction: "good",
    description: "非梅林的正义，在第一轮作为队长组出全正义队伍。" },
  { code: "good_protect_round_fail_captain", name: "盲人骑瞎马", faction: "good", hidden: true,
    description: "非梅林的正义，在第一轮作为队长组出全正义队伍。" },
  { code: "good_three_evil_team_captain", name: "错到极致也是对", faction: "good",
    description: "非梅林的正义，作为队长组出含3个邪恶的队伍。" },
  { code: "good_three_success_participant", name: "正义王", faction: "good",
    description: "正义阵营，亲自参与3次成功的任务。" },
  { code: "good_no_fail_missions", name: "天选之人", faction: "good",
    description: "正义阵营，参与≥2次任务且全部成功。" },
  { code: "good_win_after_two_fails", name: "绝地反杀", faction: "good",
    description: "正义阵营，前两轮任务都失败但最终正义获胜。" },
  { code: "good_five_evil_reject", name: "鹰眼", faction: "good",
    description: "非梅林的正义，至少5次对含邪恶队伍投反对票。" },
  { code: "good_captain_clean_record", name: "金牌队长", faction: "good",
    description: "正义阵营，作为队长至少2次带队且任务从未失败。" },
  { code: "good_decisive_win", name: "决战时刻", faction: "good",
    description: "正义阵营获胜，且恰好有2次任务失败（3-2逆转）。" },
  { code: "good_reject_all", name: "我反对一切", faction: "good",
    description: "正义阵营，反对票数≥总投票次数的80%（至少投票4次）。" },
  { code: "good_never_on_mission", name: "板凳王", faction: "good",
    description: "正义阵营，整局没有参与任何任务但正义获胜。" },
  { code: "good_unanimous_approve", name: "众望所归", faction: "good",
    description: "正义阵营，作为队长组队时获得全票通过（所有人投赞成）。" },
  { code: "lady_catch_mordred", name: "湖底捞月", faction: "good",
    description: "正义阵营，使用湖中仙女验到莫德雷德。" },

  // ── 正义 · 角色专属 ─────────────────────────────────────────────────────
  { code: "merlin_survivor", name: "梅林是狗", faction: "good", role: "梅林",
    description: "梅林，3次为含邪恶的队伍投赞成票（伪装不认识邪恶）。" },
  { code: "merlin_three_fail_lose", name: "心累", faction: "good", role: "梅林",
    description: "梅林，因3次任务失败而输掉游戏。" },
  { code: "merlin_perfect_vote", name: "看破红尘", faction: "good", role: "梅林",
    description: "梅林，全程对含邪恶队伍投反对、对全正义队伍投赞成。" },
  { code: "percival_morgana_trust", name: "晕头转向", faction: "good", role: "派西维尔",
    description: "派西维尔，3次在含莫甘娜的队伍里投赞成票。" },

  // ── 邪恶 · 通用 ─────────────────────────────────────────────────────────
  { code: "evil_protect_round_fail", name: "保护轮也炸了", faction: "evil",
    description: "邪恶阵营，在保护轮（需2票失败的轮次）中投失败票且任务失败。" },
  { code: "evil_three_fail_win", name: "炸三塔", faction: "evil",
    description: "邪恶阵营，通过3次任务失败赢得游戏。" },
  { code: "evil_hide_votes_master", name: "藏票大师", faction: "evil",
    description: "邪恶阵营，连续2次在任务中投成功票隐藏身份。" },
  { code: "evil_all_fail_non_protect", name: "毫无默契", faction: "evil",
    description: "邪恶阵营，非保护轮中2个以上同队邪恶全都投了失败票。" },
  { code: "evil_three_fail_participant", name: "狼王", faction: "evil",
    description: "邪恶阵营，亲自投了3次任务失败票。" },
  { code: "evil_no_fail_win", name: "演技派", faction: "evil",
    description: "邪恶阵营，全程没有投失败票但最终获胜。" },
  { code: "evil_assassin_killed_ally", name: "同室操戈", faction: "evil",
    description: "刺客（或莫德雷德代刺），刺杀阶段刺中了邪恶阵营的队友。" },
  { code: "evil_captain_sneak", name: "黑心队长", faction: "evil",
    description: "邪恶阵营，作为队长至少2次带出含邪恶的队伍且被投票通过。" },
  { code: "evil_lone_bomber", name: "孤勇者", faction: "evil",
    description: "邪恶阵营，有其他邪恶同队时独自一人投失败票。" },
  { code: "evil_good_disguise", name: "完美伪装", faction: "evil",
    description: "邪恶（非奥伯伦），参与≥3次任务且全部成功。" },
  { code: "evil_reject_clean_team", name: "搅局者", faction: "evil",
    description: "邪恶阵营，至少3次对全正义队伍投反对票。" },
  { code: "evil_on_all_missions", name: "无处不在", faction: "evil",
    description: "邪恶阵营，参与了所有已完成的任务，且任务≥3轮。" },
  { code: "evil_force_reject", name: "拖延战术", faction: "evil",
    description: "邪恶阵营，通过连续组队被否决触发强制判负而获胜。" },
  { code: "evil_last_mission_bomb", name: "绝杀", faction: "evil",
    description: "邪恶阵营，在最后一轮任务中投失败票且任务失败，邪恶获胜。" },

  // ── 邪恶 · 角色专属 ─────────────────────────────────────────────────────
  { code: "assassin_early_hit_merlin", name: "刺客大师", faction: "evil", role: "刺客",
    description: "刺客，在刺杀阶段成功刺中梅林。" },
  { code: "morgana_percival_fail_master", name: "洗头大师", faction: "evil", role: "莫甘娜",
    description: "莫甘娜，2次在派西维尔投赞成的队伍中投失败票且任务失败。" },
  { code: "oberon_no_fail_with_evil", name: "找到组织", faction: "evil", role: "奥伯伦",
    description: "奥伯伦，与其他邪恶同队时自己没投失败但任务仍然失败。" },
  { code: "oberon_double_fail_with_evil", name: "撞车", faction: "evil", role: "奥伯伦",
    description: "奥伯伦，与其他邪恶同队时都投了失败，失败票数超过1。" },
  { code: "oberon_first_blood", name: "第一滴血", faction: "evil", role: "奥伯伦",
    description: "奥伯伦，在第一轮任务中投失败票且任务失败。" },
];

const MEDAL_META_MAP = ALL_MEDALS.reduce((acc, medal) => {
  acc[medal.code] = medal;
  return acc;
}, {});

const MEDAL_IMAGE_MAP = ALL_MEDALS.reduce((acc, medal) => {
  const imageCode = medal.code === "good_first_round_clean_captain"
    ? "good_protect_round_fail_captain"
    : medal.code;
  if (USE_LOCAL_MEDAL_SVGS) {
    acc[medal.code] = `${MEDAL_BASE_LOCAL}/${imageCode}.svg`;
  } else {
    acc[medal.code] = `${MEDAL_BASE_CDN}/${imageCode}.png`;
  }
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
    image: MEDAL_IMAGE_MAP[medal.code] || ""
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
