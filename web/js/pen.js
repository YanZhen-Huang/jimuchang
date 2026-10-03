// 画笔引擎：舞台 overlay canvas（背景之上、元素之下）
const Pen = {
  canvas: null, ctx: null,
  color: '#FFFFFF', size: 6, down: false,
  last: {},

  ensure() {
    if (this.canvas && this.canvas.isConnected) return;
    if (typeof Stage === 'undefined' || !Stage.layerEl) return;
    const c = document.createElement('canvas');
    c.width = 1920;
    c.height = 1080;
    c.className = 'pen-layer';
    const els = Stage.layerEl.querySelector('.scene-els');
    Stage.layerEl.insertBefore(c, els || null);
    this.canvas = c;
    this.ctx = c.getContext('2d');
  },

  setColor(hex) { this.color = hex || '#FFFFFF'; },
  setSize(n) { this.size = Math.max(1, Math.min(80, Number(n) || 6)); },

  setDown(b) {
    this.down = !!b;
    this.last = {};
  },

  clear() {
    this.ensure();
    if (this.ctx) this.ctx.clearRect(0, 0, 1920, 1080);
    this.last = {};
  },

  lineTo(elId, x, y) {
    this.ensure();
    if (!this.ctx) return;
    const p = this.last[elId];
    if (p) {
      this.ctx.strokeStyle = this.color;
      this.ctx.lineWidth = this.size;
      this.ctx.lineCap = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(p.x, p.y);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
    }
    this.last[elId] = { x, y };
  },

  // 元素移动后：从其中心继续连线（落笔状态才画）
  connect(elId) {
    if (!this.down) return;
    const f = (typeof Project !== 'undefined') ? Project.findElementById(elId) : null;
    if (!f) return;
    const el = f.element;
    this.lineTo(elId, el.x + el.w / 2, el.y + el.h / 2);
  }
};
