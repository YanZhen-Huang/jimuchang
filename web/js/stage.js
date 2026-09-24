// 舞台引擎：场景渲染、缩放适配、转场
const Stage = {
  wrapEl: null, rootEl: null, layerEl: null,
  scale: 1, currentSceneId: null, transitioning: false,

  init(wrapEl) {
    this.wrapEl = wrapEl;
    wrapEl.innerHTML = '';
    this.rootEl = document.createElement('div');
    this.rootEl.id = 'stage-root';
    this.layerEl = null;
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

  buildSceneLayer(scene) {
    const L = document.createElement('div');
    L.className = 'scene-layer';
    if (scene) L.dataset.sceneId = scene.id;
    const bg = document.createElement('div');
    bg.className = 'scene-bg';
    this.applyBg(bg, scene ? scene.background : null);
    L.appendChild(bg);
    const els = document.createElement('div');
    els.className = 'scene-els';
    if (scene) {
      [...scene.elements].sort((a, b) => a.z - b.z).forEach(el => {
        els.appendChild(Elements.render(el));
      });
    }
    if (scene && scene.elements.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'stage-empty';
      hint.innerHTML = '从工具栏「＋」添加元素<br>左侧拖积木编排演示';
      els.appendChild(hint);
    }
    L.appendChild(els);
    // 场景背景特效（canvas/CSS），插到背景之上、元素之下
    if (scene) {
      try { Effects.applyScene(scene, L); } catch (e) { console.warn('场景特效失败', e); }
    }
    return L;
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

  render(scene) {
    if (!scene) return;
    this.currentSceneId = scene.id;
    this.rootEl.innerHTML = '';
    this.layerEl = this.buildSceneLayer(scene);
    this.rootEl.appendChild(this.layerEl);
  },

  async goScene(id, opts = {}) {
    const scene = Project.getScene(id);
    if (!scene) return null;
    const prevScene = Project.getScene(this.currentSceneId);
    const trans = (prevScene && prevScene.transition) || { type: 'fade', duration: 0.6 };
    const type = opts.type || trans.type || 'fade';
    const duration = opts.duration !== undefined ? opts.duration : (trans.duration !== undefined ? trans.duration : 0.6);
    const instant = !this.currentSceneId || type === 'none' || duration <= 0 || this.transitioning;

    const newLayer = this.buildSceneLayer(scene);
    if (instant) {
      this.rootEl.innerHTML = '';
      this.rootEl.appendChild(newLayer);
      this.layerEl = newLayer;
    } else {
      this.transitioning = true;
      const oldLayer = this.layerEl;
      newLayer.style.willChange = 'transform, opacity';
      this.rootEl.appendChild(newLayer);
      let frames;
      switch (type) {
        case 'slide-left': frames = [{ transform: 'translateX(1920px)' }, { transform: 'translateX(0)' }]; break;
        case 'slide-right': frames = [{ transform: 'translateX(-1920px)' }, { transform: 'translateX(0)' }]; break;
        case 'slide-up': frames = [{ transform: 'translateY(1080px)' }, { transform: 'translateY(0)' }]; break;
        case 'slide-down': frames = [{ transform: 'translateY(-1080px)' }, { transform: 'translateY(0)' }]; break;
        case 'zoom': frames = [{ transform: 'scale(0.82)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }]; break;
        case 'wipe': frames = [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }]; break;
        case 'iris': frames = [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(78% at 50% 50%)' }]; break;
        default: frames = [{ opacity: 0 }, { opacity: 1 }];
      }
      try {
        const anim = newLayer.animate(frames, {
          duration: duration * 1000, easing: Easing.css('easeInOutCubic'), fill: 'backwards'
        });
        await anim.finished;
        anim.cancel();
      } catch (e) { /* 动画中断则直接完成 */ }
      if (this.layerEl === oldLayer) {
        if (oldLayer && oldLayer.parentElement) oldLayer.remove();
        this.layerEl = newLayer;
      }
      this.transitioning = false;
      newLayer.style.willChange = '';
    }
    this.currentSceneId = id;
    return scene;
  },

  currentScene() { return Project.getScene(this.currentSceneId); },

  elDom(id) { return this.rootEl.querySelector(`.el[data-id="${id}"]`); },

  refresh(id) {
    const found = Project.findElementById(id);
    if (!found) return;
    const dom = this.elDom(id);
    if (!dom) return;
    Elements.refreshContent(found.element, dom);
  },

  refreshAll() {
    const scene = this.currentScene();
    if (!scene) return;
    this.render(scene);
  }
};
