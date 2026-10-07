// 舞台引擎 v2：连续舞台（元素一次渲染、章节跳转不重建）
const Stage = {
  wrapEl: null, rootEl: null,
  layerEl: null, bgEl: null, elsEl: null,
  scale: 1, currentChapterId: null, transitioning: false,
  fitScale: 1, zoom: null,           // zoom=null 表示"跟随适应窗口"
  panX: 0, panY: 0,                  // 视图平移（屏幕像素）
  _playingView: false, _spaceDown: false, _zoomLabel: null,

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
        if (e.target.closest && e.target.closest('.c-slider input')) return;   // 滑块控件优先，不启动元素拖拽
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
        if (e.target.closest && e.target.closest('.c-slider input')) return;   // 滑块控件优先，不启动元素拖拽
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
      // 悬停事件（交互三件套）：委托到舞台根节点，进出元素时通知执行器（仅播放态生效）
      const hoverLeave = id => {
        if (id && typeof Executor !== 'undefined') Executor.trigger('onMouseLeave', id);
      };
      Stage.rootEl.addEventListener('mouseover', e => {
        const id = (typeof Executor !== 'undefined' && Executor.pickHoverTarget)
          ? Executor.pickHoverTarget(e.clientX, e.clientY) : null;
        if (id === Stage._hoverId) return;
        const prev = Stage._hoverId;
        Stage._hoverId = id;
        hoverLeave(prev);
        if (id && typeof Executor !== 'undefined') Executor.trigger('onMouseEnter', id);
      });
      Stage.rootEl.addEventListener('mouseleave', () => {
        const prev = Stage._hoverId;
        Stage._hoverId = null;
        hoverLeave(prev);
      });
    }
    this._bindZoomUI();
    this._bindPan();
    this.fit();
  },

  fit() {
    if (!this.wrapEl) return;
    const cw = this.wrapEl.clientWidth - 20, ch = this.wrapEl.clientHeight - 20;
    if (cw < 10 || ch < 10) return;
    this.fitScale = Math.min(cw / 1920, ch / 1080);
    this._applyViewport();
  },

  // ---------- 画布视图：缩放 / 平移 ----------
  _bindZoomUI() {
    const wrap = this.wrapEl;
    const bar = document.createElement('div');
    bar.id = 'zoom-bar';
    bar.innerHTML = `<button id="zoom-out" title="缩小 (Ctrl+-)">−</button>`
      + `<span id="zoom-label" title="点击适应窗口 (Ctrl+0)">100%</span>`
      + `<button id="zoom-in" title="放大 (Ctrl+=)">＋</button>`
      + `<button id="zoom-fit" title="适应窗口 (Ctrl+0)">适应</button>`;
    wrap.appendChild(bar);
    bar.addEventListener('mousedown', e => e.stopPropagation());
    bar.querySelector('#zoom-out').onclick = () => this.zoomBy(1 / 1.2);
    bar.querySelector('#zoom-in').onclick = () => this.zoomBy(1.2);
    bar.querySelector('#zoom-fit').onclick = () => this.resetView();
    bar.querySelector('#zoom-label').onclick = () => this.resetView();
    this._zoomLabel = bar.querySelector('#zoom-label');
    // Ctrl+滚轮（含触摸板双指捏合）缩放画布；普通滚轮平移（画布未溢出时自动归位）
    wrap.addEventListener('wheel', e => {
      if (this._playingView) return;
      e.preventDefault();
      if (e.ctrlKey) {
        this.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0018));
      } else {
        this.panBy(-e.deltaX, -e.deltaY);
      }
    }, { passive: false });
  },

  _bindPan() {
    const canPan = e => !this._playingView && (e.button === 1 || (e.button === 0 && this._spaceDown));
    this.rootEl.addEventListener('mousedown', e => {
      if (!canPan(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();      // 平移手势优先，不触发元素拖拽 / 取消选择
      const sx = e.clientX, sy = e.clientY, px = this.panX, py = this.panY;
      document.body.classList.add('view-panning');
      const move = ev => {
        this.panX = px + (ev.clientX - sx);
        this.panY = py + (ev.clientY - sy);
        this._applyViewport();
      };
      const up = () => {
        document.body.classList.remove('view-panning');
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
    window.addEventListener('keydown', e => {
      if (e.code !== 'Space' || this._playingView) return;
      const t = e.target;
      const tag = ((t && t.tagName) || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || (t && t.isContentEditable)) return;
      if (t && t.closest && t.closest('#blocklyDiv')) return;
      this._spaceDown = true;
      document.body.classList.add('view-pan-ready');
    });
    window.addEventListener('keyup', e => {
      if (e.code !== 'Space') return;
      this._spaceDown = false;
      document.body.classList.remove('view-pan-ready');
    });
    window.addEventListener('blur', () => {
      this._spaceDown = false;
      document.body.classList.remove('view-pan-ready');
    });
  },

  _applyViewport() {
    if (!this.rootEl) return;
    const v = this._playingView ? this.fitScale : (this.zoom == null ? this.fitScale : this.zoom);
    this.scale = v;
    this._clampPan();
    this.rootEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${v})`;
    if (this._zoomLabel) this._zoomLabel.textContent = Math.round(v * 100) + '%';
  },

  _clampPan() {
    if (!this.wrapEl) return;
    const limX = Math.max(0, 960 * this.scale - this.wrapEl.clientWidth / 2);
    const limY = Math.max(0, 540 * this.scale - this.wrapEl.clientHeight / 2);
    this.panX = Math.max(-limX, Math.min(limX, this.panX));
    this.panY = Math.max(-limY, Math.min(limY, this.panY));
  },

  _viewCenter() {
    const r = this.wrapEl.getBoundingClientRect();
    return { x: r.left + this.wrapEl.clientWidth / 2, y: r.top + this.wrapEl.clientHeight / 2 };
  },

  // 屏幕坐标 → 1920x1080 舞台坐标（含缩放与平移）
  screenToWorld(clientX, clientY) {
    const c = this._viewCenter();
    return {
      x: (clientX - c.x - this.panX) / this.scale + 960,
      y: (clientY - c.y - this.panY) / this.scale + 540
    };
  },

  // 以指针位置为锚点缩放：指针下的舞台点保持不动
  zoomAt(clientX, clientY, factor) {
    if (this._playingView) return;
    const cur = this.scale || this.fitScale;
    const next = Math.max(0.05, Math.min(4, cur * factor));
    if (Math.abs(next - cur) < 1e-6) return;
    const c = this._viewCenter();
    const w = this.screenToWorld(clientX, clientY);
    this.zoom = next;
    this.panX = clientX - c.x - (w.x - 960) * next;
    this.panY = clientY - c.y - (w.y - 540) * next;
    this._applyViewport();
  },

  // 以画布中心为锚点缩放（按钮 / 快捷键）
  zoomBy(factor) {
    if (this._playingView) return;
    const c = this._viewCenter();
    this.zoomAt(c.x, c.y, factor);
  },

  setZoom(v) {
    if (this._playingView) return;
    const next = Math.max(0.05, Math.min(4, v));
    const ratio = next / (this.scale || this.fitScale);
    this.zoom = next;
    this.panX *= ratio;
    this.panY *= ratio;
    this._applyViewport();
  },

  resetView() {
    this.zoom = null;
    this.panX = 0;
    this.panY = 0;
    this._applyViewport();
  },

  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
    this._applyViewport();
  },

  saveView() { return { zoom: this.zoom, panX: this.panX, panY: this.panY }; },
  restoreView(v) {
    if (!v) return;
    this.zoom = v.zoom;
    this.panX = v.panX;
    this.panY = v.panY;
    this._applyViewport();
  },

  // 播放模式：临时忽略用户缩放（全屏适应），退出后恢复
  enterPlayView() {
    this._savedView = this.saveView();
    this._playingView = true;
    this.panX = 0;
    this.panY = 0;
    this._applyViewport();
  },

  exitPlayView() {
    if (!this._playingView) return;
    this._playingView = false;
    if (this._savedView) {
      this.zoom = this._savedView.zoom;
      this.panX = this._savedView.panX;
      this.panY = this._savedView.panY;
    }
    this._savedView = null;
    this._applyViewport();
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
    // 清理上一轮渲染的图表/精灵实例（防止 ECharts 实例与 canvas 引用泄漏）
    this.elsEl.querySelectorAll('.c-chart').forEach(c => {
      if (c._chart) { try { c._chart.dispose(); } catch (e) { } c._chart = null; }
    });
    if (typeof Sprites !== 'undefined') {
      this.elsEl.querySelectorAll('canvas.c-sprite').forEach(c => { try { Sprites.unmount(c); } catch (e) { } });
    }
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
