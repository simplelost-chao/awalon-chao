// radar.js — 六边形雷达图绘制模块

const AXES = {
  good: {
    keys: ['recognition', 'leadership', 'trustworthiness', 'shield', 'dodge', 'winRate'],
    labels: ['识人', '领袖', '表水', '挡刀', '躲刀', '胜率'],
    fillColor: 'rgba(78,158,255,0.25)',
    strokeColor: 'rgba(78,158,255,0.8)',
    dotColor: 'rgba(78,158,255,1)',
    scoreColor: 'rgba(78,158,255,1)',
  },
  evil: {
    keys: ['charge', 'incite', 'trustworthiness', 'stealth', 'destruction', 'winRate'],
    labels: ['冲锋', '煽动', '表水', '隐秘', '破坏', '胜率'],
    fillColor: 'rgba(220,80,80,0.25)',
    strokeColor: 'rgba(220,80,80,0.8)',
    dotColor: 'rgba(220,80,80,1)',
    scoreColor: 'rgba(220,80,80,1)',
  },
};

const SIDES = 6;
const GRID_LEVELS = 3;
const MIN_RATIO = 0.05; // 最小显示比例，防止 0 值不可见

/**
 * 计算正六边形第 i 个顶点的坐标（共 SIDES 个，从顶部开始逆时针）
 * @param {number} cx 中心 x
 * @param {number} cy 中心 y
 * @param {number} r 半径
 * @param {number} i 顶点索引 0~5
 * @returns {{ x: number, y: number }}
 */
function vertexAt(cx, cy, r, i) {
  const angle = -Math.PI / 2 + (2 * Math.PI * i) / SIDES;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

/**
 * 绘制六边形路径（不 stroke/fill，由调用者决定）
 */
function hexPath(ctx, cx, cy, r) {
  for (let i = 0; i < SIDES; i++) {
    const { x, y } = vertexAt(cx, cy, r, i);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * 主绘制函数
 * @param {CanvasRenderingContext2D} ctx  wx Canvas 2D context
 * @param {Object} data  各维度数值 0-100，-1 表示数据不足
 * @param {'good'|'evil'} faction
 * @param {number} size  逻辑像素尺寸（正方形）
 */
function drawRadar(ctx, data, faction, size) {
  // 1. DPR 处理
  const dpr = (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) || 1;
  const canvas = ctx.canvas;
  if (canvas) {
    canvas.width = size * dpr;
    canvas.height = size * dpr;
  }
  ctx.clearRect(0, 0, size * dpr, size * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);

  const cfg = AXES[faction] || AXES.good;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;

  // 2. 网格 — 3 个同心六边形
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.5;
  for (let level = 1; level <= GRID_LEVELS; level++) {
    const r = (radius * level) / GRID_LEVELS;
    ctx.beginPath();
    hexPath(ctx, cx, cy, r);
    ctx.stroke();
  }

  // 3. 轴线 — 从中心到每个顶点
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < SIDES; i++) {
    const { x, y } = vertexAt(cx, cy, radius, i);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  // 4. 数据多边形
  const values = cfg.keys.map((key) => {
    const v = data != null && data[key] != null ? data[key] : -1;
    return v;
  });

  // 计算每个顶点坐标（数据多边形）
  const polyPoints = values.map((v, i) => {
    const ratio = v === -1 ? 0 : Math.max(MIN_RATIO, v / 100);
    const r = ratio * radius;
    return vertexAt(cx, cy, r, i);
  });

  // 填充
  ctx.beginPath();
  polyPoints.forEach(({ x, y }, i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = cfg.fillColor;
  ctx.fill();

  // 描边
  ctx.beginPath();
  polyPoints.forEach(({ x, y }, i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.strokeStyle = cfg.strokeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 5. 数据点（小圆点）
  for (let i = 0; i < SIDES; i++) {
    const { x, y } = polyPoints[i];
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    if (values[i] === -1) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
    } else {
      ctx.fillStyle = cfg.dotColor;
    }
    ctx.fill();
  }

  // 6. 标签（维度名 + 数值）
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labelRadius = radius + 28;

  for (let i = 0; i < SIDES; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / SIDES;
    const lx = cx + labelRadius * Math.cos(angle);
    const ly = cy + labelRadius * Math.sin(angle);

    const label = cfg.labels[i];
    const value = values[i];
    const scoreText = value === -1 ? '—' : String(Math.round(value));

    // 维度名（上行）
    ctx.font = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(label, lx, ly - 8);

    // 数值（下行）
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = value === -1 ? 'rgba(255,255,255,0.3)' : cfg.scoreColor;
    ctx.fillText(scoreText, lx, ly + 8);
  }

  ctx.restore();
}

module.exports = { drawRadar };
