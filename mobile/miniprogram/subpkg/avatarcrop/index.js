Page({
  data: {
    statusText: "准备读取图片...",
    imagePath: "",
    frameSize: 300,
    frameStyle: "width: 300px; height: 300px;",
    renderedWidth: 300,
    renderedHeight: 300,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    minScale: 1,
    maxScale: 4
  },

  onLoad() {
    try {
      this.eventChannel = this.getOpenerEventChannel();
    } catch (e) {
      this.eventChannel = null;
    }
    const filePath = wx.getStorageSync("awalonAvatarCropSource") || "";
    if (filePath) {
      wx.removeStorageSync("awalonAvatarCropSource");
    }
    if (filePath) {
      this.setData({ statusText: "已拿到图片路径，正在加载..." });
      this.initCropper(filePath);
    } else {
      this.setData({ statusText: "没有拿到图片路径，请返回重试" });
    }
  },

  onReady() {
    try {
      const sys = wx.getSystemInfoSync();
      const frameSize = Math.max(220, Math.min((sys.windowWidth || 375) - 64, 320));
      this.setData({ frameSize, frameStyle: `width: ${frameSize}px; height: ${frameSize}px;` });
      if (this.data.imagePath) {
        this.initCropper(this.data.imagePath);
      }
    } catch (e) {}
  },

  onBack() {
    wx.navigateBack();
  },

  async initCropper(filePath) {
    try {
      const info = await new Promise((resolve, reject) => {
        wx.getImageInfo({
          src: filePath,
          success: resolve,
          fail: reject
        });
      });
      const width = Number(info && info.width) || 0;
      const height = Number(info && info.height) || 0;
      const frameSize = this.data.frameSize || 300;
      if (!width || !height) throw new Error("IMAGE_INFO_INVALID");
      const coverScale = Math.max(frameSize / width, frameSize / height);
      const renderedWidth = Math.round(width * coverScale);
      const renderedHeight = Math.round(height * coverScale);
      this.setData({
        statusText: "图片已加载，可拖拽裁剪",
        imagePath: filePath,
        renderedWidth,
        renderedHeight,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        minScale: 1
      }, () => this.renderPreview());
    } catch (err) {
      this.setData({ statusText: "读取图片失败，请返回重试" });
      wx.showToast({ title: "读取图片失败", icon: "none" });
    }
  },

  drawToCanvas(canvasId, destSize) {
    const frameSize = this.data.frameSize || 300;
    const scale = this.data.scale || 1;
    const drawWidth = (this.data.renderedWidth || frameSize) * scale * (destSize / frameSize);
    const drawHeight = (this.data.renderedHeight || frameSize) * scale * (destSize / frameSize);
    const x = (destSize - drawWidth) / 2 + (this.data.offsetX || 0) * (destSize / frameSize);
    const y = (destSize - drawHeight) / 2 + (this.data.offsetY || 0) * (destSize / frameSize);
    const ctx = wx.createCanvasContext(canvasId, this);
    ctx.clearRect(0, 0, destSize, destSize);
    ctx.setFillStyle("#ffffff");
    ctx.fillRect(0, 0, destSize, destSize);
    ctx.drawImage(this.data.imagePath, x, y, drawWidth, drawHeight);
    return ctx;
  },

  renderPreview() {
    if (!this.data.imagePath) return;
    const frameSize = this.data.frameSize || 300;
    const ctx = this.drawToCanvas("avatarCropPreview", frameSize);
    ctx.draw();
  },

  clampOffset(offsetX, offsetY, scale) {
    const frameSize = this.data.frameSize || 300;
    const renderedWidth = (this.data.renderedWidth || frameSize) * scale;
    const renderedHeight = (this.data.renderedHeight || frameSize) * scale;
    const maxX = Math.max(0, (renderedWidth - frameSize) / 2);
    const maxY = Math.max(0, (renderedHeight - frameSize) / 2);
    return {
      offsetX: Math.max(-maxX, Math.min(maxX, offsetX)),
      offsetY: Math.max(-maxY, Math.min(maxY, offsetY))
    };
  },

  onTouchStart(e) {
    const touches = (e && e.touches) || [];
    if (!touches.length) return;
    const state = {
      offsetX: this.data.offsetX || 0,
      offsetY: this.data.offsetY || 0,
      scale: this.data.scale || 1
    };
    if (touches.length >= 2) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      state.distance = Math.sqrt(dx * dx + dy * dy);
    } else {
      state.startX = touches[0].clientX;
      state.startY = touches[0].clientY;
    }
    this._touchState = state;
  },

  onTouchMove(e) {
    const touches = (e && e.touches) || [];
    const state = this._touchState;
    if (!state || !touches.length) return;
    if (touches.length >= 2 && state.distance) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      const nextDistance = Math.sqrt(dx * dx + dy * dy);
      let nextScale = (state.scale || 1) * (nextDistance / state.distance);
      nextScale = Math.max(this.data.minScale || 1, Math.min(this.data.maxScale || 4, nextScale));
      const nextOffset = this.clampOffset(this.data.offsetX || 0, this.data.offsetY || 0, nextScale);
      this.setData({
        scale: nextScale,
        offsetX: nextOffset.offsetX,
        offsetY: nextOffset.offsetY
      }, () => this.renderPreview());
      return;
    }
    if (touches.length === 1 && typeof state.startX === "number") {
      const dx = touches[0].clientX - state.startX;
      const dy = touches[0].clientY - state.startY;
      const nextOffset = this.clampOffset((state.offsetX || 0) + dx, (state.offsetY || 0) + dy, this.data.scale || 1);
      this.setData({
        offsetX: nextOffset.offsetX,
        offsetY: nextOffset.offsetY
      }, () => this.renderPreview());
    }
  },

  onTouchEnd() {
    this._touchState = null;
  },

  async onConfirm() {
    if (!this.data.imagePath) return;
    try {
      wx.showLoading({ title: "生成头像", mask: true });
      const ctx = this.drawToCanvas("avatarCropOutput", 128);
      const tempFilePath = await new Promise((resolve, reject) => {
        ctx.draw(false, () => {
          wx.canvasToTempFilePath(
            {
              canvasId: "avatarCropOutput",
              x: 0,
              y: 0,
              width: 128,
              height: 128,
              destWidth: 128,
              destHeight: 128,
              fileType: "jpg",
              quality: 0.82,
              success: (res) => resolve(res.tempFilePath),
              fail: reject
            },
            this
          );
        });
      });
      this.eventChannel.emit("avatarCropped", { filePath: tempFilePath });
      wx.navigateBack();
    } catch (err) {
      wx.showToast({ title: "裁剪失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  }
});
