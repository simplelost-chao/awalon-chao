const DEFAULT_ROLE_CONFIG = {
  5: ["梅林", "派西维尔", "莫甘娜", "刺客", "忠臣"],
  6: ["梅林", "派西维尔", "莫甘娜", "刺客", "忠臣", "忠臣"],
  7: ["梅林", "派西维尔", "莫甘娜", "刺客", "忠臣", "忠臣", "奥伯伦"],
  8: ["梅林", "派西维尔", "莫甘娜", "刺客", "爪牙", "忠臣", "忠臣", "忠臣"],
  9: ["梅林", "派西维尔", "莫甘娜", "莫德雷德", "刺客", "爪牙", "忠臣", "忠臣", "忠臣"],
  10: ["梅林", "派西维尔", "莫甘娜", "莫德雷德", "刺客", "奥伯伦", "忠臣", "忠臣", "忠臣", "忠臣"],
};

function defaultRolesForCount(count) {
  const n = Number(count) || 7;
  const configured = DEFAULT_ROLE_CONFIG[n];
  if (Array.isArray(configured) && configured.length) return configured.slice();
  return Array.from({ length: n }, () => "忠臣");
}

module.exports = {
  DEFAULT_ROLE_CONFIG,
  defaultRolesForCount,
};
