// 舞台引擎 v2：连续舞台（元素一次渲染、章节跳转不重建）
const Stage = {
  wrapEl: null, rootEl: null,
  layerEl: null, bgEl: null, elsEl: null,
  scale: 1, currentChapterId: null, transitioning: false,

  init(wrapEl) {
    this.wrapEl = wrapEl;
    this._renderedOnce = false;
    wrapEl.innerHTML = '';
    this.rootEl = document.createElement('div');
    this.rootEl.id = 'stage-root';
    this.rootEl.style.width = '1920px';
    this.rootEl.style.height = '1080px';
    // 单一连续层：背景 + 元素（+ 特效 canvas 由 Effects 插入两者之间）
    this.layerEl = document.createElement('div');
    this.layerEl.className = 'scene-layer';
    this.bgEl = document.createElement('div');
    this.bgEl.className = 'scene-bg';
    this.elsEl = document.createElement('div');
    this.elsEl.className = 'scene-els';
    this.layerEl.appendChild(this.bgEl);
    this.layerEl.appendChild(this.elsEl);
    this.rootEl.appendChild(this.layerEl);
    wrapEl.appendChild(this.rootEl);
    new ResizeObserver(() => {
      if (this._fitRaf) return;
      this._fitRaf = requestAnimationFrame(() => { this._fitRaf = null; this.fit(); });
    }).observe(wrapEl);
    this.fit();
  },

  fit() {
    if (!this.wrapEl) return;
    const cw = this.wrapEl.clientWidth - 20, ch = this.wrapEl.clientHeight - 20;
    if (cw < 10 || ch < 10) return;
    this.scale = Math.min(cw / 1920, ch / 1080);
    this.rootEl.style.transform = `scale(${this.scale})`;
  },

  applyBg(bgEl, bg) {
    bgEl.style.background = '';
    if (!bg || bg.type === 'color' || !bg.type) {
      bgEl.style.background = (bg && bg.value) || '#0F1115';
    } else if (bg.type === 'gradient') {
      const v = bg.value || {};
      const stops = (v.stops || [['#111', '0'], ['#333', '1']]).map(s => `${s[0]} ${s[1]}`).join(',');
      bgEl.style.background = `linear-gradient(${v.angle || 135}deg, ${stops})`;
    } else if (bg.type === 'image') {
      const v = bg.value || {};
      bgEl.style.background = `center / ${v.fit || 'cover'} no-repeat url("${Project.resourceUrl(v.resourceId)}")`;
    }
  },

  applyStageBg() {
    this.applyBg(this.bgEl, Project.data.stage.background);
  },

  // ---------- 渲染（一次性全部元素；章节跳转不重建） ----------
  renderAll() {
    this.elsEl.innerHTML = '';
    const els = [...Project.data.elements].sort((a, b) => (a.z || 0) - (b.z || 0));
    els.forEach(el => {
      const dom = Elements.render(el);
      this.elsEl.appendChild(dom);
    });
    this.applyStageBg();
    // 舞台背景特效（原场景特效，v2 挂舞台）
    try { Effects.applyScene({ fx: Project.data.stage.fx }, this.layerEl); } catch (e) { }
    this._renderedOnce = true;
  },

  // 兼容：v1 的 Stage.render(scene)；v2 = 全量渲染 + 记录当前章节
  render(chapterOrNull) {
    this.renderAll();
    if (chapterOrNull && chapterOrNull.id) this.currentChapterId = chapterOrNull.id;
  },

  refreshAll() { this.renderAll(); },

  elDom(id) { return this.rootEl.querySelector(`.el[data-id="${id}"]`); },

  refresh(id) {
    const found = Project.findElementById(id);
    if (!found) return;
    const dom = this.elDom(id);
    if (!dom) return;
    Elements.refreshContent(found.element, dom);
  },

  // ---------- 章节跳转（背景过渡 + 显隐应用） ----------
  async goChapter(chapterId, opts = {}) {
    const ch = Project.getChapter(chapterId);
    if (!ch) return null;
    if (!this._renderedOnce) this.renderAll();
    const instant = opts.instant || this.transitioning;
    const targetBg = (ch.preset && ch.preset.background) || Project.data.stage.background;
    const curBg = JSON.stringify(Project.data.stage.background);
    const newBg = JSON.stringify(targetBg);
    if (!instant && this.currentChapterId && curBg !== newBg) {
      await this.transitionBackground(targetBg, opts.duration !== undefined ? opts.duration : 0.6);
    } else if (curBg !== newBg) {
      Project.data.stage.background = JSON.parse(JSON.stringify(targetBg));
      this.applyStageBg();
    }
    // 显隐应用（元素 DOM 不重建）
    const vis = (ch.preset && ch.preset.visibility) || null;
    if (vis) {
      Object.entries(vis).forEach(([elId, v]) => {
        const el = Project.getElement(elId);
        if (!el) return;
        const dom = this.elDom(elId);
        if (v && !el.visible) {
          el.visible = true;
          if (dom) { Anim.reset(el, dom); Elements.applyBox(el, dom); }
        } else if (!v && el.visible) {
          el.visible = false;
          if (dom) Elements.applyBox(el, dom);
        }
      });
    }
    this.currentChapterId = chapterId;
    return ch;
  },

  // 兼容别名
  async goScene(id, opts) { return this.goChapter(id, opts); },

  async transitionBackground(newBg, duration = 0.6) {
    this.transitioning = true;
    const clone = document.createElement('div');
    clone.className = 'scene-bg';
    clone.style.cssText = this.bgEl.style.cssText;
    this.bgEl.parentElement.insertBefore(clone, this.bgEl.nextSibling);
    Project.data.stage.background = JSON.parse(JSON.stringify(newBg));
    this.applyStageBg();
    try {
      const a = clone.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: Math.max(0, duration) * 1000, easing: 'easeInOutCubic', fill: 'both'
      });
      await a.finished;
      a.cancel();
    } catch (e) { }
    clone.remove();
    this.transitioning = false;
  },

  currentChapter() { return Project.getChapter(this.currentChapterId); },

  // 兼容：v1 的 currentScene
  currentScene() { return this.currentChapter(); }
};
