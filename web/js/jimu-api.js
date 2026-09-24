// jimu JS API：供"执行代码"积木使用（代码块内的全局对象）
const JimuAPI = (() => {
  const findScene = ref => (Project.data.scenes || []).find(s => s.id === ref || s.name === ref);
  const findEl = ref => {
    for (const s of Project.data.scenes) {
      const el = s.elements.find(e => e.id === ref || e.name === ref);
      if (el) return el;
    }
    return null;
  };
  const domOf = ref => {
    const el = findEl(ref);
    return el ? Stage.elDom(el.id) : null;
  };

  const api = {
    // ---------- 场景 ----------
    scene: {
      async go(ref) {
        const sc = findScene(ref);
        if (!sc) { console.warn('[jimu] 找不到场景', ref); return; }
        await Stage.goScene(sc.id);
        await Executor.fireSceneEnter(sc.id);
      },
      next() {
        const i = Project.sceneIndex(Stage.currentSceneId);
        const nx = Project.data.scenes[i + 1];
        if (nx) api.scene.go(nx.id);
      },
      current() {
        const sc = Stage.currentScene();
        return sc ? { id: sc.id, name: sc.name } : null;
      }
    },

    // ---------- 元素 ----------
    show(ref) {
      const el = findEl(ref);
      if (!el) return;
      el.visible = true;
      const dom = Stage.elDom(el.id);
      if (dom) { Anim.reset(el, dom); Elements.applyBox(el, dom); }
    },
    hide(ref) {
      const el = findEl(ref);
      if (!el) return;
      el.visible = false;
      const dom = Stage.elDom(el.id);
      if (dom) Elements.applyBox(el, dom);
    },
    toggle(ref) {
      const el = findEl(ref);
      if (el) el.visible ? api.hide(ref) : api.show(ref);
    },
    setText(ref, text) {
      const el = findEl(ref);
      if (!el) return;
      el.props.text = String(text);
      if (Stage.elDom(el.id)) Stage.refresh(el.id);
    },
    setColor(ref, color) {
      const el = findEl(ref);
      if (!el) return;
      const p = el.props;
      if (el.type === 'text' || el.type === 'icon') p.color = color;
      else p.fill = color;
      if (Stage.elDom(el.id)) Stage.refresh(el.id);
    },
    async moveTo(ref, x, y, opts = {}) {
      const el = findEl(ref);
      if (!el) return Promise.resolve();
      const dom = Stage.elDom(el.id);
      if (opts.duration > 0 && dom) {
        const animEl = dom.querySelector('.el-anim');
        const dx = x - el.x, dy = y - el.y;
        el.x = x; el.y = y;
        Anim.reset(el, dom);
        if (animEl) {
          const a = animEl.animate(
            [{ transform: `translate(${-dx}px, ${-dy}px)` }, { transform: 'translate(0,0)' }],
            { duration: opts.duration * 1000, easing: Easing.css(opts.easing || 'easeOutCubic') });
          try { await a.finished; } catch (e) { }
          a.cancel();
        }
      } else {
        el.x = x; el.y = y;
      }
      if (Stage.elDom(el.id)) Elements.applyBox(el, Stage.elDom(el.id));
    },
    async resize(ref, w, h, opts = {}) {
      const el = findEl(ref);
      if (!el) return;
      el.w = w; el.h = h;
      if (Stage.elDom(el.id)) Stage.refresh(el.id);
      if (opts.duration > 0) await sleep(50);
    },
    async animate(ref, type, opts = {}) {
      const el = findEl(ref);
      if (!el) return;
      const dom = Stage.elDom(el.id);
      if (dom) await Anim.play(el, dom, type, opts);
    },
    async playKeyframes(ref, opts = {}) {
      const el = findEl(ref);
      if (!el) return;
      const dom = Stage.elDom(el.id);
      if (dom) await Keyframes.play(el, dom, opts);
    },
    get(ref, prop) {
      const el = findEl(ref);
      return el ? el[prop] : undefined;
    },

    // ---------- 媒体 ----------
    sfx(ref, volume = 1) {
      const r = Project.getResource(ref) || (Project.data.resources || []).find(x => x.name === ref);
      if (r) AudioMgr.sfx(Project.resourceUrl(r.id), volume);
    },
    music(ref, opts = {}) {
      const r = Project.getResource(ref) || (Project.data.resources || []).find(x => x.name === ref);
      if (r) AudioMgr.playMusic(Project.resourceUrl(r.id), { loop: opts.loop !== false, volume: opts.volume !== undefined ? opts.volume : 0.8, fadeIn: opts.fadeIn || 0 });
    },
    stopMusic(fadeOut = 0) { AudioMgr.stopMusic(fadeOut); },
    video(ref, action = 'play') {
      const dom = domOf(ref);
      const v = dom && dom.querySelector('video');
      if (!v) return;
      if (action === 'play') v.play().catch(() => { });
      else if (action === 'pause') v.pause();
      else if (action === 'stop') { v.pause(); v.currentTime = 0; }
      else if (action === 'mute') v.muted = true;
      else if (action === 'unmute') v.muted = false;
    },

    // ---------- 3D ----------
    model: {
      play(ref, animName, opts = {}) { Model3D.playAnimation(findEl(ref) ? findEl(ref).id : ref, animName, { loop: opts.loop !== false, speed: opts.speed || 1 }); },
      view(ref, preset, duration = 1) { Model3D.setView(findEl(ref) ? findEl(ref).id : ref, preset, duration); },
      orbit(ref, duration = 4) { Model3D.orbit(findEl(ref) ? findEl(ref).id : ref, duration); },
      zoom(ref, factor, duration = 1) { Model3D.zoom(findEl(ref) ? findEl(ref).id : ref, factor, duration); },
      autoRotate(ref, on) { Model3D.setAutoRotate(findEl(ref) ? findEl(ref).id : ref, on); }
    },

    // ---------- 特效 ----------
    burst(ref, kind = 'stardust') {
      const el = findEl(ref);
      if (el) Effects.burst(el.id, kind);
    },

    // ---------- 小程序消息 ----------
    send(ref, data) {
      const dom = domOf(ref);
      const iframe = dom && dom.querySelector('iframe.c-webapp');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ source: 'jimu', data }, '*');
      }
    },

    // ---------- 工具 ----------
    wait(sec) { return sleep(Math.max(0, sec) * 1000); },
    random(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; },
    randomFloat(a, b) { return Math.random() * (b - a) + a; },
    log(msg) { console.log('[剧本]', msg); },
    on(event, cb) {
      // 简化事件订阅：sceneEnter
      if (event === 'sceneEnter') {
        const orig = Executor.hooks.onSceneEnter;
        Executor.hooks.onSceneEnter = id => {
          if (orig) orig(id);
          try { cb(api.scene.current()); } catch (e) { }
        };
      }
    }
  };

  // 小程序 → 积木 消息监听（由 App 统一注册更稳；此处兜底）
  window.addEventListener('message', e => {
    const d = e.data;
    if (!d || d.source !== 'webapp') return;
    const scene = Stage.currentScene();
    if (!scene) return;
    for (const el of scene.elements) {
      if (el.type !== 'webapp') continue;
      const dom = Stage.elDom(el.id);
      const iframe = dom && dom.querySelector('iframe');
      if (iframe && iframe.contentWindow === e.source) {
        if (typeof App !== 'undefined' && App.playing) Executor.trigger('onWebappMessage', el.id, d.data);
        break;
      }
    }
  });

  return api;
})();
