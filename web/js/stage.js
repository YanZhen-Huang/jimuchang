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
    // 鼠标追踪（侦测积木：鼠标 x/y、按下状态；换算到 1920 舞台坐标）
    if (!Stage._mouseBound) {
      Stage._mouseBound = true;
      const updatePos = e => {
        if (typeof Executor === 'undefined' || !Stage.rootEl) return;
        const r = Stage.rootEl.getBoundingClientRect();
        if (!r.width) return;
        const k = 1920 / r.width;
        Executor.mouse.x = Math.round((e.clientX - r.left) * k);
        Executor.mouse.y = Math.round((e.clientY - r.top) * k);
      };
      window.addEventListener('mousemove', updatePos);
      window.addEventListener('mousedown', e => {
        if (typeof Executor !== 'undefined') Executor.mouse.down = true;
        updatePos(e);
      });
      window.addEventListener('mouseup', () => {
        if (typeof Executor !== 'undefined') Executor.mouse.down = false;
      });
      // 触屏：触摸映射为鼠标坐标（侦测积木在手机上可用）
      const touchPos = e => {
        const t = e.touches && e.touches[0];
        if (t) updatePos({ clientX: t.clientX, clientY: t.clientY });
      };
      window.addEventListener('touchstart', e => {
        if (typeof Executor !== 'undefined') Executor.mouse.down = true;
        touchPos(e);
      }, { passive: true });
      window.addEventListener('touchmove', touchPos, { passive: true });
      window.addEventListener('touchend', () => {
        if (typeof Executor !== 'undefined') Executor.mouse.down = false;
      }, { passive: true });
      // 触屏拖拽（播放态可拖动元素）
      Stage.rootEl.addEventListener('touchstart', e => {
        if (typeof App === 'undefined' || !App.playing) return;
        const elDom = e.target.closest('.el');
        if (!elDom) return;
        const id = elDom.dataset.id;
        const f = Project.findElementById(id);
        if (!f || !f.element.draggable) return;
        const t0 = e.touches[0];
        const startX = t0.clientX, startY = t0.clientY;
        const ox = f.element.x, oy = f.element.y;
        const r = Stage.rootEl.getBoundingClientRect();
        const k = r.width ? 1920 / r.width : 1;
        const move = ev => {
          ev.preventDefault();
          const t = ev.touches[0];
          f.element.x = Math.round(ox + (t.clientX - startX) * k);
          f.element.y = Math.round(oy + (t.clientY - startY) * k);
          const dom = Stage.elDom(id);
          if (dom) Elements.applyBox(f.element, dom);
        };
        const up = () => {
          window.removeEventListener('touchmove', move);
          window.removeEventListener('touchend', up);
        };
        window.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('touchend', up);
      }, { passive: true });
      // 播放态拖拽：元素被"设为可拖动"后，观众可以拖着它走
      Stage.rootEl.addEventListener('mousedown', e => {
        if (typeof App === 'undefined' || !App.playing) return;
        const elDom = e.target.closest('.el');
        if (!elDom) return;
        const id = elDom.dataset.id;
        const f = Project.findElementById(id);
        if (!f || !f.element.draggable) return;
        e.preventDefault();
        const startX = e.clientX, startY = e.clientY;
        const ox = f.element.x, oy = f.element.y;
        const r = Stage.rootEl.getBoundingClientRect();
        const k = r.width ? 1920 / r.width : 1;
        const move = ev => {
          f.element.x = Math.round(ox + (ev.clientX - startX) * k);
          f.element.y = Math.round(oy + (ev.clientY - startY) * k);
          const dom = Stage.elDom(id);
          if (dom) Elements.applyBox(f.element, dom);
        };
        const up = () => {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      });
    }
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

  // ---------- 章节跳转（背景过渡 + 显隐过渡，元素 DOM 不重建） ----------
  async goChapter(chapterId, opts = {}) {
    const ch = Project.getChapter(chapterId);
    if (!ch) return null;
    if (!this._renderedOnce) this.renderAll();
    const instant = opts.instant || this.transitioning;
    const targetBg = (ch.preset && ch.preset.background) || Project.data.stage.background;
    const curBg = JSON.stringify(Project.data.stage.background);
    const newBg = JSON.stringify(targetBg);
    // 背景过渡（与显隐并行，不等它挡住显隐启动）
    let bgPromise = null;
    if (curBg !== newBg) {
      if (!instant && this.currentChapterId) {
        const defDur = (typeof Settings !== 'undefined') ? Settings.get('defaultTransition') : 0.6;
        bgPromise = this.transitionBackground(targetBg, opts.duration !== undefined ? opts.duration : defDur);
      } else {
        Project.data.stage.background = JSON.parse(JSON.stringify(targetBg));
        this.applyStageBg();
      }
    }
    // 显隐应用（元素 DOM 不重建；非瞬时跳转时淡入/淡出）
    const vis = (ch.preset && ch.preset.visibility) || null;
    const fadeIns = [], fadeOuts = [];
    if (vis) {
      Object.entries(vis).forEach(([elId, v]) => {
        const el = Project.getElement(elId);
        if (!el) return;
        const dom = this.elDom(elId);
        if (v && !el.visible) {
          el.visible = true;
          if (dom) { Anim.reset(el, dom); Elements.applyBox(el, dom); fadeIns.push(dom); }
        } else if (!v && el.visible) {
          el.visible = false;
          if (dom) {
            if (instant) Elements.applyBox(el, dom);
            else fadeOuts.push(dom);
          }
        }
      });
    }
    fadeOuts.forEach(dom => {
      try {
        const a = dom.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'easeIn', fill: 'forwards' });
        a.finished.then(() => {
          a.cancel();
          const f = Project.findElementById(dom.dataset.id);
          if (f) Elements.applyBox(f.element, dom);
        }).catch(() => { });
      } catch (e) {
        const f = Project.findElementById(dom.dataset.id);
        if (f) Elements.applyBox(f.element, dom);
      }
    });
    fadeIns.forEach(dom => {
      try { dom.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'easeOut' }); } catch (e) { }
    });
    this.currentChapterId = chapterId;
    if (bgPromise) await bgPromise;
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
