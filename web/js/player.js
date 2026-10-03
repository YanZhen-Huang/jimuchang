// 播放器运行时：导出的放映 HTML 专用（不依赖 Blockly / 编辑器）
const Player = {
  async boot() {
    const data = window.__JC_PLAYER_DATA__ || null;
    if (!data || !data.project) {
      document.body.innerHTML = '<div style="color:#8A93A6;font:16px sans-serif;display:flex;height:100vh;align-items:center;justify-content:center">放映数据缺失</div>';
      return;
    }
    Project.data = data.project;

    // 兼容宿主环境引用
    window.App = {
      playing: true,
      host: null,
      hostReady: Promise.resolve(),
      activeTab: 'global',
      markDirty() { },
      clearDirty() { },
      renderTabs() { },
      updateHistoryButtons() { }
    };

    // 3D 支持（如导出包含 three 源码）
    if (data.three) {
      try { Model3D.inlineUrls = this.buildThreeBlobs(data.three); } catch (e) { console.warn('3D 内联失败', e); }
    }

    Stage.init(document.getElementById('stage-wrap'));
    Stage.rootEl.addEventListener('click', e => {
      const elDom = e.target.closest('.el');
      if (elDom) Executor.trigger('onElementClick', elDom.dataset.id);
    });
    Executor.hooks.onSceneEnter = id => this.playEntrances(id);
    document.addEventListener('keydown', e => this.onKey(e));
    document.addEventListener('dblclick', () => this.toggleFullscreen());
    this.bindTouchSwipe();
    window.addEventListener('resize', () => Stage.fit());

    Executor.presetScripts = true;
    Executor.scripts = data.scripts;
    Executor.funcs = (data.scripts && data.scripts.funcs) || {};
    try {
      await Executor.start();
    } catch (e) {
      console.error('播放出错', e);
    }
    // 提示（右下角，几秒后淡出）
    const hint = document.getElementById('play-hint');
    if (hint) setTimeout(() => hint.style.opacity = '0', 6000);
  },

  buildThreeBlobs(t) {
    const b64 = s => {
      const bin = atob(s);
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(u8);
    };
    const blobUrl = src => URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    // 注意：vendor 里的文件已把裸 'three' 改写成 './three.module.js'，两种形式都要替换
    const THREE_RE = /from '(?:three|\.\/three\.module\.js)'/g;
    const coreUrl = blobUrl(b64(t.core));
    const moduleSrc = b64(t.module).replace(/from '\.\/three\.core\.js'/g, `from '${coreUrl}'`);
    const moduleUrl = blobUrl(moduleSrc);
    const geoUrl = blobUrl(b64(t.geometryUtils).replace(THREE_RE, `from '${moduleUrl}'`));
    const skelUrl = blobUrl(b64(t.skeletonUtils).replace(THREE_RE, `from '${moduleUrl}'`));
    const loaderSrc = b64(t.loader)
      .replace(THREE_RE, `from '${moduleUrl}'`)
      .replace(/from '\.\/BufferGeometryUtils\.js'/g, `from '${geoUrl}'`)
      .replace(/from '\.\/SkeletonUtils\.js'/g, `from '${skelUrl}'`);
    const loaderUrl = blobUrl(loaderSrc);
    return { three: moduleUrl, loader: loaderUrl };
  },

  playEntrances(chapterId) {
    const sc = Project.getChapter(chapterId);
    if (!sc) return;
    AudioMgr.stopLoopSfx();
    Project.data.elements.forEach(el => {
      if (!el.visible) return;
      const dom = Stage.elDom(el.id);
      if (el.type === 'audio' && el.props.autoplay && el.props.resourceId) {
        const url = Project.resourceUrl(el.props.resourceId);
        const vol = el.props.volume !== undefined ? el.props.volume : 1;
        if (el.props.loop) AudioMgr.playLoopSfx(url, vol);
        else AudioMgr.sfx(url, vol);
      }
      if (el.type === 'video' && el.props.autoplay && dom) {
        const v = dom.querySelector('video');
        if (v) v.play().catch(() => { });
      }
      if (!el.entrance || el.entrance.type === 'none') return;
      if (dom) Anim.play(el, dom, el.entrance.type, el.entrance);
    });
  },

  onKey(e) {
    if (e.key === 'Escape') { this.exitFullscreen(); return; }
    if (e.key === ' ') {
      e.preventDefault();
      Executor.trigger('onKey', 'Space').then(n => { if (!n) this.nextScene(); });
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const isNext = e.key === 'ArrowRight';
      Executor.trigger('onKey', e.key).then(n => { if (!n) { isNext ? this.nextScene() : this.prevScene(); } });
      return;
    }
    Executor.trigger('onKey', e.code);
  },

  // 触屏：左右滑动切换章节（起手在元素上的拖动/点击除外）
  bindTouchSwipe() {
    let start = null;
    document.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) { start = null; return; }
      const t = e.touches[0];
      const onEl = e.target && e.target.closest && e.target.closest('.el');
      start = { x: t.clientX, y: t.clientY, t: Date.now(), onEl: !!onEl };
    }, { passive: true });
    document.addEventListener('touchend', e => {
      if (!start || start.onEl) { start = null; return; }
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const dt = Date.now() - start.t;
      start = null;
      if (dt > 700) return;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (dx < 0) this.nextScene();
        else this.prevScene();
      }
    }, { passive: true });
  },

  async nextScene() {
    const i = Project.chapterIndex(Stage.currentChapterId);
    const next = Project.data.chapters[i + 1];
    if (next) await Executor.sceneGo(next.id);
  },

  async prevScene() {
    const i = Project.chapterIndex(Stage.currentChapterId);
    const prev = Project.data.chapters[i - 1];
    if (prev) await Executor.sceneGo(prev.id);
  },

  toggleFullscreen() {
    if (document.fullscreenElement) this.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => { });
  },

  exitFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
  }
};

window.addEventListener('DOMContentLoaded', () => Player.boot());
