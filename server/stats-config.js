// server/stats-config.js — 统计系统可配置参数
// 修改后重启服务即可生效

module.exports = {
  // 雷达图：最近多少局用于计算
  radarMaxGames: 100,
  // 雷达图：贝叶斯平滑系数（越大越保守）
  radarSmoothK: 3,

  // 搭档：最近多少局用于计算
  partnerMaxGames: 20,
  // 搭档：最少多少局同场才出现在称号中
  partnerMinGames: 1,
  // 搭档：贝叶斯平滑系数
  partnerSmoothK: 3,

  // 趋势图：最近多少局
  trendMaxGames: 15,
};
