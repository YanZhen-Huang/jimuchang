// 国庆氛围引擎：金色粒子飘落 + 烟花绽放 + 红灯笼（仅国庆主题激活）
const Festive = {
  canvas: null, ctx: null, raf: null,
  particles: [], fireworks: [], lastFw: 0, active: false, lanterns: null,

  start() {
    if (this.active) return;
    this.active = true;
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'festive-canvas';
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      document.body.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
    }
    if (!this.lanterns) {
      this.lanterns = document.createElement('div');
      this.lanterns.id = 'festive-lanterns';
      this.lanterns.innerHTML = '<div class="lantern l-left"><i></i></div><div class="lantern l-right"><i></i></div>';
      document.body.appendChild(this.lanterns);
    }
    if (!this._onResize) this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.particles = [];
    for (let i = 0; i < 36; i++) this.particles.push(this.mkParticle(true));
    // 开场大烟花
    this.burst(window.innerWidth * 0.5, window.innerHeight * 0.26, 80);
    this.lastFw = performance.now();
    const loop = () => {
      if (!this.active) return;
      this.tick();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  },

  stop() {
    this.active = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.canvas) { this.canvas.remove(); this.canvas = null; this.ctx = null; }
    if (this.lanterns) { this.lanterns.remove(); this.lanterns = null; }
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    this.particles = [];
    this.fireworks = [];
  },

  mkParticle(init) {
    const W = window.innerWidth, H = window.innerHeight;
    return {
      x: Math.random() * W,
      y: init ? Math.random() * H : -12,
      vx: (Math.random() - 0.5) * 0.35,
      vy: 0.3 + Math.random() * 0.55,
      r: 1 + Math.random() * 1.8,
      a: 0.2 + Math.random() * 0.4,
      tw: Math.random() * Math.PI * 2,
      star: Math.random() < 0.4
    };
  },

  burst(x, y, n) {
    const colors = ['#F5C445', '#FF7A5C', '#FFD98A', '#E23A2E', '#FFEFDF'];
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 1.0 + Math.random() * 3.4;
      this.fireworks.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 0.5,
        life: 1,
        decay: 0.011 + Math.random() * 0.013,
        color: colors[(Math.random() * colors.length) | 0],
        r: 1.4 + Math.random() * 1.8
      });
    }
  },

  tick() {
    const c = this.ctx;
    if (!c || !this.canvas) return;
    const W = this.canvas.width, H = this.canvas.height;
    c.clearRect(0, 0, W, H);
    // 金色粒子（部分五角星形）
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.tw += 0.05;
      if (p.y > H + 14 || p.x < -20 || p.x > W + 20) {
        this.particles[i] = this.mkParticle(false);
        continue;
      }
      const flick = 0.6 + Math.sin(p.tw) * 0.4;
      c.globalAlpha = p.a * flick;
      c.fillStyle = p.star ? '#FFD98A' : '#F5C445';
      if (p.star) this.drawStar(c, p.x, p.y, p.r * 2.4);
      else {
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fill();
      }
    }
    // 烟花
    for (let i = this.fireworks.length - 1; i >= 0; i--) {
      const f = this.fireworks[i];
      f.x += f.vx;
      f.y += f.vy;
      f.vy += 0.035;
      f.vx *= 0.985;
      f.vy *= 0.985;
      f.life -= f.decay;
      if (f.life <= 0) { this.fireworks.splice(i, 1); continue; }
      c.globalAlpha = Math.max(0, f.life) * 0.9;
      c.fillStyle = f.color;
      c.beginPath();
      c.arc(f.x, f.y, Math.max(0.3, f.r * f.life), 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    // 每 7~12 秒一朵小烟花
    const now = performance.now();
    if (now - this.lastFw > 7000 + Math.random() * 5000) {
      this.lastFw = now;
      this.burst(W * (0.15 + Math.random() * 0.7), H * (0.1 + Math.random() * 0.3), 48);
    }
  },

  drawStar(c, x, y, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(ang) * rr;
      const py = y + Math.sin(ang) * rr;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
  },

  resize() {
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  }
};
