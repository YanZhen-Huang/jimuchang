// 特效引擎：常驻元素特效（CSS）+ 粒子爆发 + 场景背景特效（canvas）
const Effects = {
  ELEMENT_TYPES: ['glowPulse', 'neon', 'sweep', 'glitch'],
  BURST_TYPES: ['stardust', 'confetti', 'heart', 'petal'],
  SCENE_TYPES: ['starfield', 'snow', 'particles', 'aurora'],

  // ---------- 元素常驻特效 ----------
  attach(el, dom) {
    const anim = dom.querySelector('.el-anim');
    if (!anim) return;
    this.ELEMENT_TYPES.forEach(c => anim.classList.remove('fx-' + c));
    (el.effects || []).forEach(fx => {
      if (this.ELEMENT_TYPES.includes(fx.type)) anim.classList.add('fx-' + fx.type);
    });
  },

  // ---------- 粒子爆发 ----------
  burst(elId, kind) {
    const dom = Stage.elDom(elId);
    if (!dom) return;
    const W = Math.max(20, dom.offsetWidth), H = Math.max(20, dom.offsetHeight);
    const pad = Math.max(W, H) * 0.9;
    const cw = Math.round(W + pad * 2), ch = Math.round(H + pad * 2);
    const c = document.createElement('canvas');
    c.className = 'fx-burst';
    c.width = cw;
    c.height = ch;
    c.style.cssText = `position:absolute;left:${-Math.round(pad)}px;top:${-Math.round(pad)}px;width:${cw}px;height:${ch}px;pointer-events:none;z-index:60`;
    dom.appendChild(c);
    const ctx = c.getContext('2d');
    const cx = cw / 2, cy = ch / 2;
    const parts = [];
    const count = 46;
    for (let i = 0; i < count; i++) parts.push(this.makeParticle(kind, cx, cy, W, H));
    const t0 = performance.now();
    const step = () => {
      const t = performance.now() - t0;
      ctx.clearRect(0, 0, cw, ch);
      let alive = false;
      parts.forEach(p => {
        p.life -= 16.7;
        if (p.life <= 0) return;
        alive = true;
        p.x += p.vx; p.y += p.vy;
        p.vy += p.g; p.vx *= 0.99;
        p.rot += p.vr;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 500));
        this.drawParticle(ctx, p);
      });
      ctx.globalAlpha = 1;
      if (alive && t < 4500) requestAnimationFrame(step);
      else c.remove();
    };
    requestAnimationFrame(step);
  },

  makeParticle(kind, cx, cy, W, H) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 3 + Math.random() * 6;
    const x = cx + (Math.random() - 0.5) * W * 0.5;
    const y = cy + (Math.random() - 0.5) * H * 0.4;
    switch (kind) {
      case 'confetti':
        return {
          kind, x, y, vx: Math.cos(ang) * sp, vy: -Math.abs(Math.sin(ang)) * sp - 2,
          g: 0.16, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.35,
          life: 1700 + Math.random() * 1200,
          color: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#B983FF', '#FF9F68'][Math.floor(Math.random() * 6)],
          size: 8 + Math.random() * 8
        };
      case 'heart':
        return {
          kind, x, y, vx: Math.cos(ang) * sp * 0.6, vy: -Math.abs(Math.sin(ang)) * sp * 0.8 - 1.5,
          g: 0.05, rot: 0, vr: 0, life: 1500 + Math.random() * 1000,
          color: ['#FF6B9D', '#FF8FA3', '#FF4D6D', '#FFA8C5'][Math.floor(Math.random() * 4)],
          size: 9 + Math.random() * 9
        };
      case 'petal':
        return {
          kind, x, y, vx: Math.cos(ang) * sp * 0.7, vy: -Math.abs(Math.sin(ang)) * sp * 0.7,
          g: 0.06, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.12,
          life: 1800 + Math.random() * 1200,
          color: ['#FFB7C5', '#FFC9DE', '#FF9EB5', '#FFD7E3'][Math.floor(Math.random() * 4)],
          size: 9 + Math.random() * 7
        };
      default: // stardust
        return {
          kind: 'stardust', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          g: 0.015, rot: 0, vr: 0, life: 900 + Math.random() * 900,
          color: `rgba(${170 + Math.floor(Math.random() * 60)},${190 + Math.floor(Math.random() * 50)},255,${(0.6 + Math.random() * 0.4).toFixed(2)})`,
          size: 1.5 + Math.random() * 2.8
        };
    }
  },

  drawParticle(ctx, p) {
    ctx.fillStyle = p.color;
    if (p.kind === 'confetti') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    } else if (p.kind === 'heart') {
      ctx.font = `${Math.round(p.size * 2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❤', p.x, p.y);
    } else if (p.kind === 'petal') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, 6.29);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, 6.29);
      ctx.fill();
    }
  },

  // ---------- 场景背景特效 ----------
  _sceneRaf: null,

  applyScene(scene, layerEl) {
    const old = layerEl.querySelectorAll('.scene-fx, .scene-aurora');
    old.forEach(n => n.remove());
    if (this._sceneRaf) { cancelAnimationFrame(this._sceneRaf); this._sceneRaf = null; }
    const fx = scene && scene.fx;
    if (!fx || !fx.type) return;

    if (fx.type === 'aurora') {
      const d = document.createElement('div');
      d.className = 'scene-aurora';
      const els = layerEl.querySelector('.scene-els');
      layerEl.insertBefore(d, els || null);
      return;
    }

    const c = document.createElement('canvas');
    c.className = 'scene-fx';
    c.width = 1920;
    c.height = 1080;
    const els = layerEl.querySelector('.scene-els');
    layerEl.insertBefore(c, els || null);
    const ctx = c.getContext('2d');
    const items = this.initSceneItems(fx.type, fx.density || 90);
    const start = performance.now();
    const loop = () => {
      const t = performance.now() - start;
      ctx.clearRect(0, 0, 1920, 1080);
      this.drawSceneItems(ctx, fx.type, items, t);
      this._sceneRaf = requestAnimationFrame(loop);
    };
    this._sceneRaf = requestAnimationFrame(loop);
  },

  initSceneItems(type, density) {
    const items = [];
    for (let i = 0; i < density; i++) {
      if (type === 'starfield') {
        items.push({
          x: Math.random() * 1920, y: Math.random() * 1080,
          r: 1.2 + Math.random() * 2.8,
          ph: Math.random() * 6.28,
          vy: 0.02 + Math.random() * 0.06
        });
      } else if (type === 'snow') {
        items.push({
          x: Math.random() * 1920, y: Math.random() * 1080,
          r: 2.5 + Math.random() * 4.5,
          vy: 0.4 + Math.random() * 0.9,
          sw: 0.5 + Math.random() * 1.2,
          ph: Math.random() * 6.28,
          alpha: 0.5 + Math.random() * 0.5
        });
      } else { // particles
        items.push({
          x: Math.random() * 1920, y: Math.random() * 1080,
          r: 1.6 + Math.random() * 3.4,
          vx: (Math.random() - 0.5) * 0.35,
          vy: -0.15 - Math.random() * 0.4,
          alpha: 0.2 + Math.random() * 0.5
        });
      }
    }
    return items;
  },

  drawSceneItems(ctx, type, items, t) {
    if (type === 'starfield') {
      items.forEach(s => {
        s.y += s.vy;
        if (s.y > 1080) s.y = 0;
        const tw = 0.55 + 0.45 * Math.sin(t / 900 + s.ph);
        ctx.globalAlpha = tw;
        ctx.fillStyle = '#cdd8ff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.29);
        ctx.fill();
      });
    } else if (type === 'snow') {
      items.forEach(s => {
        s.y += s.vy;
        if (s.y > 1080) { s.y = -10; s.x = Math.random() * 1920; }
        const x = s.x + Math.sin(t / 1400 + s.ph) * 22 * s.sw;
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = '#e8efff';
        ctx.beginPath();
        ctx.arc(x, s.y, s.r, 0, 6.29);
        ctx.fill();
      });
    } else {
      items.forEach(s => {
        s.x += s.vx;
        s.y += s.vy;
        if (s.y < -10) { s.y = 1090; s.x = Math.random() * 1920; }
        if (s.x < -10) s.x = 1930;
        if (s.x > 1930) s.x = -10;
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = '#9fb6ff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, 6.29);
        ctx.fill();
      });
    }
    ctx.globalAlpha = 1;
  }
};
