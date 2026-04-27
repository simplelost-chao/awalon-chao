// 分享卡片绘制工具（纯函数，不依赖 this/setData）

async function resolveAvatarPath(avatarUrl) {
  if (!avatarUrl) return "";
  try {
    const info = await new Promise((resolve, reject) => {
      wx.getImageInfo({ src: avatarUrl, success: resolve, fail: reject });
    });
    return (info && info.path) || "";
  } catch (e) {
    return "";
  }
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function loadImage(canvas, src) {
  return new Promise((resolve, reject) => {
    const image = canvas.createImage();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function exportTempFile(canvas, width, height, quality) {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas, x: 0, y: 0, width, height,
      destWidth: width, destHeight: height,
      fileType: "jpg", quality,
      success: (res) => resolve(res.tempFilePath),
      fail: reject,
    });
  });
}

// options 包含所有布局参数；avatarFallbackText 用于无头像时的文字回退
async function drawCard(canvas, ctx, options) {
  const avatarPath = options.avatarPath || "";

  const bg = ctx.createLinearGradient(0, 0, options.width, options.height);
  options.backgroundStops.forEach(([offset, color]) => bg.addColorStop(offset, color));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, options.width, options.height);

  if (options.glow) {
    const glow = ctx.createRadialGradient(
      options.glow.innerX, options.glow.innerY, options.glow.innerRadius,
      options.glow.outerX, options.glow.outerY, options.glow.outerRadius
    );
    options.glow.stops.forEach(([offset, color]) => glow.addColorStop(offset, color));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, options.width, options.height);
  }

  ctx.fillStyle = options.cardFill;
  drawRoundRect(ctx, options.cardRect.x, options.cardRect.y, options.cardRect.width, options.cardRect.height, options.cardRect.radius);
  ctx.fill();

  ctx.strokeStyle = options.cardStroke;
  ctx.lineWidth = options.cardStrokeWidth;
  drawRoundRect(ctx, options.cardRect.x, options.cardRect.y, options.cardRect.width, options.cardRect.height, options.cardRect.radius);
  ctx.stroke();

  if (options.innerStrokeRect) {
    ctx.strokeStyle = options.innerStrokeColor;
    ctx.lineWidth = options.innerStrokeWidth;
    drawRoundRect(ctx, options.innerStrokeRect.x, options.innerStrokeRect.y, options.innerStrokeRect.width, options.innerStrokeRect.height, options.innerStrokeRect.radius);
    ctx.stroke();
  }

  if (options.titleBadgeRect) {
    ctx.fillStyle = options.titleBadgeFill;
    drawRoundRect(ctx, options.titleBadgeRect.x, options.titleBadgeRect.y, options.titleBadgeRect.width, options.titleBadgeRect.height, options.titleBadgeRect.radius);
    ctx.fill();
  }

  ctx.fillStyle = options.titleColor;
  ctx.font = options.titleFont;
  ctx.fillText(options.titleText, options.titleX, options.titleY);

  if (options.decorations && options.decorations.length) {
    options.decorations.forEach((draw) => draw(ctx, options._room, options));
  }

  ctx.fillStyle = options.avatarFrameFill;
  drawRoundRect(ctx, options.avatarFrameRect.x, options.avatarFrameRect.y, options.avatarFrameRect.width, options.avatarFrameRect.height, options.avatarFrameRect.radius);
  ctx.fill();

  ctx.save();
  drawRoundRect(ctx, options.avatarClipRect.x, options.avatarClipRect.y, options.avatarClipRect.width, options.avatarClipRect.height, options.avatarClipRect.radius);
  ctx.clip();
  if (avatarPath) {
    const avatarImage = await loadImage(canvas, avatarPath);
    ctx.drawImage(avatarImage, options.avatarClipRect.x, options.avatarClipRect.y, options.avatarClipRect.width, options.avatarClipRect.height);
  } else {
    ctx.fillStyle = options.avatarFallbackFill;
    ctx.fillRect(options.avatarClipRect.x, options.avatarClipRect.y, options.avatarClipRect.width, options.avatarClipRect.height);
    ctx.fillStyle = options.avatarFallbackTextColor;
    ctx.font = options.avatarFallbackFont;
    ctx.fillText(options.avatarFallbackText || "🙂", options.avatarFallbackTextX, options.avatarFallbackTextY);
  }
  ctx.restore();

  options.textBlocks.forEach((block) => {
    ctx.fillStyle = block.color;
    ctx.font = block.font;
    ctx.fillText(block.text, block.x, block.y);
  });

  return exportTempFile(canvas, options.width, options.height, options.quality || 0.92);
}

function buildPrimarySpec({ room, roomCode, playerText, modeText, avatarPath, avatarText, nickname }) {
  const inviterText = `${nickname || "Avalon 玩家"} 邀请你加入`;
  return {
    width: 500, height: 400,
    avatarPath,
    avatarFallbackText: avatarText || "🙂",
    quality: 0.92,
    _room: room,
    backgroundStops: [[0, "#161d2b"], [0.55, "#0f1520"], [1, "#090d14"]],
    glow: {
      innerX: 360, innerY: 90, innerRadius: 10,
      outerX: 360, outerY: 90, outerRadius: 220,
      stops: [[0, "rgba(217,179,107,0.22)"], [1, "rgba(217,179,107,0)"]],
    },
    cardFill: (() => {
      const card = { x1: 34, y1: 34, x2: 466, y2: 366, stops: [[0, "rgba(27,34,47,0.98)"], [1, "rgba(14,18,26,0.98)"]] };
      return card;
    })(),
    cardRect: { x: 24, y: 24, width: 452, height: 352, radius: 30 },
    cardStroke: "rgba(228,194,129,0.7)", cardStrokeWidth: 2,
    innerStrokeRect: { x: 34, y: 34, width: 432, height: 332, radius: 24 },
    innerStrokeColor: "rgba(228,194,129,0.22)", innerStrokeWidth: 1,
    titleBadgeRect: { x: 52, y: 52, width: 190, height: 42, radius: 21 },
    titleBadgeFill: "rgba(228,194,129,0.16)",
    titleText: "AWALON INVITE", titleColor: "#f0d8a3", titleFont: "22px sans-serif",
    titleX: 72, titleY: 79,
    avatarFrameFill: "rgba(228,194,129,0.14)",
    avatarFrameRect: { x: 54, y: 116, width: 96, height: 96, radius: 48 },
    avatarClipRect: { x: 56, y: 120, width: 88, height: 88, radius: 44 },
    avatarFallbackFill: "#243041", avatarFallbackTextColor: "#f6e7c7",
    avatarFallbackFont: "34px sans-serif", avatarFallbackTextX: 81, avatarFallbackTextY: 175,
    decorations: [
      (ctxRef, currentRoom) => {
        ctxRef.fillStyle = "rgba(255,255,255,0.06)";
        ctxRef.beginPath(); ctxRef.arc(352, 230, 92, 0, Math.PI * 2); ctxRef.fill();
        ctxRef.strokeStyle = "rgba(228,194,129,0.18)"; ctxRef.lineWidth = 3;
        ctxRef.beginPath(); ctxRef.arc(352, 230, 92, 0, Math.PI * 2); ctxRef.stroke();
        ctxRef.strokeStyle = "rgba(228,194,129,0.1)"; ctxRef.lineWidth = 1;
        ctxRef.beginPath(); ctxRef.arc(352, 230, 68, 0, Math.PI * 2); ctxRef.stroke();
        const seatDots = [[352, 126],[417, 155],[444, 222],[418, 288],[352, 318],[286, 288],[260, 222],[287, 155]];
        seatDots.slice(0, Math.max(5, Math.min(seatDots.length, Number(currentRoom && currentRoom.maxPlayers) || 7))).forEach(([x, y]) => {
          ctxRef.fillStyle = "rgba(228,194,129,0.24)";
          ctxRef.beginPath(); ctxRef.arc(x, y, 12, 0, Math.PI * 2); ctxRef.fill();
        });
      },
    ],
    textBlocks: [
      { text: inviterText, x: 168, y: 150, color: "#f7ead0", font: "26px sans-serif" },
      { text: `${playerText} · ${modeText}`, x: 168, y: 182, color: "rgba(238,241,247,0.72)", font: "20px sans-serif" },
      { text: "圆桌已就位", x: 310, y: 228, color: "#d7b06a", font: "18px sans-serif" },
      { text: "点击卡片后直接进入房间", x: 278, y: 254, color: "rgba(238,241,247,0.78)", font: "16px sans-serif" },
      { text: roomCode ? "房间号" : "立即开局", x: 56, y: 264, color: "#d7b06a", font: "22px sans-serif" },
      { text: roomCode || "AWALON", x: 56, y: 330, color: "#ffffff", font: "68px sans-serif" },
      { text: roomCode ? "微信打开后可直接加入该房间" : "微信打开后可直接进入 Avalon", x: 56, y: 362, color: "rgba(238,241,247,0.72)", font: "20px sans-serif" },
    ],
  };
}

function buildFallbackSpec({ roomCode, playerText, modeText, avatarPath, avatarText, nickname }) {
  return {
    width: 500, height: 400,
    avatarPath,
    avatarFallbackText: avatarText || "🙂",
    quality: 0.92,
    backgroundStops: [[0, "#1a2231"], [1, "#0d1118"]],
    cardFill: "rgba(18,22,30,0.96)",
    cardRect: { x: 28, y: 28, width: 444, height: 344, radius: 30 },
    cardStroke: "rgba(228,194,129,0.5)", cardStrokeWidth: 2,
    titleText: "AWALON INVITE", titleColor: "#f0d8a3", titleFont: "24px sans-serif",
    titleX: 156, titleY: 84,
    avatarFrameFill: "rgba(228,194,129,0.12)",
    avatarFrameRect: { x: 58, y: 94, width: 78, height: 78, radius: 39 },
    avatarClipRect: { x: 62, y: 98, width: 70, height: 70, radius: 35 },
    avatarFallbackFill: "#243041", avatarFallbackTextColor: "#f6e7c7",
    avatarFallbackFont: "28px sans-serif", avatarFallbackTextX: 79, avatarFallbackTextY: 144,
    textBlocks: [
      { text: `${nickname || "Avalon 玩家"} 邀请你加入`, x: 156, y: 128, color: "rgba(238,241,247,0.82)", font: "24px sans-serif" },
      { text: `${playerText} · ${modeText}`, x: 156, y: 160, color: "rgba(238,241,247,0.82)", font: "20px sans-serif" },
      { text: roomCode ? "房间号" : "立即开局", x: 60, y: 250, color: "#d7b06a", font: "22px sans-serif" },
      { text: roomCode || "AWALON", x: 60, y: 325, color: "#ffffff", font: "72px sans-serif" },
      { text: roomCode ? "点击卡片后可直接加入该房间" : "点击卡片后可直接进入 Avalon", x: 60, y: 360, color: "rgba(238,241,247,0.72)", font: "20px sans-serif" },
    ],
  };
}

module.exports = { resolveAvatarPath, drawCard, buildPrimarySpec, buildFallbackSpec };
