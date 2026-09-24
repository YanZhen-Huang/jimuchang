// 帧动画（雪碧图 / 序列帧）管理器
const Sprites = {
  instances: new Set(),
  running: false,

  mount(el, canvas) {
    const st = {
      el, canvas,
      ctx: canvas.getContext('2d'),
      playing: true,
      speed: el.props.speed || 1,
      t0: performance.now(),
      lastFrame: -1,
      imgs: [],
      img: null
    };
    canvas._sprite = st;
    const p = el.props;
    if (p.kind === 'sheet' && p.resourceId) {
      this.load(Project.resourceUrl(p.resourceId)).then(img => { st.img = img; st.ready = true; });
    } else if (p.kind === 'frames' && p.frames && p.frames.length) {
      Promise.all(p.frames.map(id => this.load(Project.resourceUrl(id)))).then(imgs => {
        st.imgs = imgs.filter(Boolean);
        st.ready = st.imgs.length > 0;
      });
    }
    this.instances.add(st);
    if (!this.running) { this.running = true; requestAnimationFrame(() => this.loop()); }
    // 清空画布提示
    st.ctx.clearRect(0, 0, canvas.width, canvas.height);
  },

  unmount(canvas) {
    if (canvas && canvas._sprite) {
      this.instances.delete(canvas._sprite);
      canvas._sprite = null;
    }
  },

  load(url) {
    return new Promise(resolve => {
      if (!url) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  },

  frameCount(st) {
    const p = st.el.props;
    if (p.kind === 'sheet') {
      return Math.max(1, (p.cols || 1) * (p.rows || 1));
    }
    return st.imgs.length;
  },

  tick(st, now) {
    const p = st.el.props;
    const fps = Math.max(1, Math.min(60, p.fps || 12));
    if (!st.playing) return;
    const total = this.frameCount(st);
    if (total < 1) return;
    const idx = Math.floor((now - st.t0) / (1000 / fps / (st.speed || 1)));
    const loop = p.loop !== false;
    const frame = loop ? (idx % total) : Math.min(idx, total - 1);
    if (frame === st.lastFrame) return;
    st.lastFrame = frame;
    this.draw(st, frame);
  },

  draw(st, frame) {
    const { ctx, canvas } = st;
    const p = st.el.props;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    try {
      if (p.kind === 'sheet' && st.img) {
        const cols = Math.max(1, p.cols || 1);
        const fw = st.img.width / cols;
        const fh = st.img.height / Math.max(1, p.rows || 1);
        const sx = (frame % cols) * fw;
        const sy = Math.floor(frame / cols) * fh;
        ctx.drawImage(st.img, sx, sy, fw, fh, 0, 0, canvas.width, canvas.height);
      } else if (st.imgs[frame]) {
        ctx.drawImage(st.imgs[frame], 0, 0, canvas.width, canvas.height);
      }
    } catch (e) { }
  },

  loop() {
    const now = performance.now();
    Sprites.instances.forEach(st => Sprites.tick(st, now));
    if (Sprites.instances.size > 0) requestAnimationFrame(() => Sprites.loop());
    else Sprites.running = false;
  },

  // ---------- 积木控制 ----------
  control(elId, action, value) {
    const dom = Stage.elDom(elId);
    const canvas = dom && dom.querySelector('canvas.c-sprite');
    const st = canvas && canvas._sprite;
    if (!st) return;
    switch (action) {
      case 'play': st.playing = true; break;
      case 'pause': st.playing = false; break;
      case 'stop': st.playing = false; st.t0 = performance.now(); st.lastFrame = -1; this.draw(st, 0); break;
      case 'speed': st.speed = Math.max(0.1, Number(value) || 1); break;
    }
  }
};
