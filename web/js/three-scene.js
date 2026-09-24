// 3D 模型元素管理器：每个 model3d 元素独立 Three.js 场景
const Model3D = {
  THREE: null,
  Loader: null,
  instances: new Map(),
  running: false,

  async ensureLibs() {
    if (this.THREE) return true;
    if (this.inlineUrls) {
      this.THREE = await import(this.inlineUrls.three);
      const m = await import(this.inlineUrls.loader);
      this.Loader = m.GLTFLoader;
      return true;
    }
    this.THREE = await import('../vendor/three/three.module.js');
    const m = await import('../vendor/three/GLTFLoader.js');
    this.Loader = m.GLTFLoader;
    return true;
  },

  b64ToBuf(b64) {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
  },

  async mount(el, canvas) {
    try {
      await this.ensureLibs();
    } catch (e) {
      console.warn('3D 库加载失败', e);
      return;
    }
    const T = this.THREE;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(el.w, el.h, false);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(45, Math.max(0.1, el.w / el.h), 0.05, 500);
    const inst = {
      elId: el.id,
      renderer, scene, camera,
      mixer: null, model: null, actions: [], lights: null,
      center: new T.Vector3(),
      radius: 1,
      azimuth: 0.6, elevation: 0.32, distance: 3.5,
      autoRotate: false, orbit: null, tween: null,
      _last: 0
    };
    this.instances.set(el.id, inst);
    this.applyLights(el, inst);
    this.updateCamera(inst);
    await this.loadModel(el, inst);
    const tip = canvas.parentElement && canvas.parentElement.querySelector('.model-loading');
    if (tip) {
      if (inst.model) tip.remove();
      else tip.textContent = '3D 加载失败';
    }
    if (!this.running) {
      this.running = true;
      requestAnimationFrame(t => this.loop(t));
    }
  },

  async loadModel(el, inst) {
    const p = el.props || {};
    let buf = null;
    if (!p.resourceId || p.resourceId === 'builtin:robot') {
      // 1) 放映包内联数据优先
      const pd = window.__JC_PLAYER_DATA__;
      if (pd && pd.builtinRobot) {
        buf = this.b64ToBuf(pd.builtinRobot);
      }
      // 2) 编辑器环境：从 qrc 资源读取
      if (!buf) {
        try {
          if (typeof App !== 'undefined') {
            await App.hostReady;
            if (App.host) {
              const b64 = await App.host.readFileBase64(':/assets/models/RobotExpressive.glb');
              if (b64) buf = this.b64ToBuf(b64);
            }
          }
        } catch (e) { }
      }
      if (!buf) { console.warn('内置模型读取失败（开发预览模式或桥接未就绪）'); return; }
    } else {
      const r = Project.getResource(p.resourceId);
      if (!r || !r.data) return;
      buf = this.b64ToBuf(r.data);
    }
    try {
      const loader = new this.Loader();
      const gltf = await new Promise((res, rej) => loader.parse(buf, '', res, rej));
      const model = gltf.scene;
      // 居中 + 自适应尺寸
      const box = new this.THREE.Box3().setFromObject(model);
      const size = box.getSize(new this.THREE.Vector3());
      const center = box.getCenter(new this.THREE.Vector3());
      model.position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      inst.radius = maxDim / 2;
      inst.distance = Math.max(1.4, inst.radius * 3.6);
      inst.model = model;
      inst.scene.add(model);
      // 动画
      if (gltf.animations && gltf.animations.length) {
        inst.mixer = new this.THREE.AnimationMixer(model);
        inst.actions = gltf.animations.map(c => ({ name: c.name, clip: c }));
        const want = (p.animation && p.animation.name) || '';
        const target = inst.actions.find(a => a.name === want) || inst.actions[0];
        this._playAction(inst, target, { loop: true, speed: 1 });
      }
      inst.autoRotate = !!p.autoRotate;
      this.updateCamera(inst);
    } catch (e) {
      console.warn('模型加载失败', e);
    }
  },

  _playAction(inst, act, { loop = true, speed = 1 } = {}) {
    if (!inst.mixer || !act) return;
    inst.mixer.stopAllAction();
    const action = inst.mixer.clipAction(act.clip);
    action.setLoop(loop ? this.THREE.LoopRepeat : this.THREE.LoopOnce, Infinity);
    action.timeScale = Math.max(0.05, speed);
    action.reset().fadeIn(0.2).play();
  },

  loop(now) {
    this.instances.forEach(inst => {
      const dt = inst._last ? Math.min(0.06, (now - inst._last) / 1000) : 0.016;
      inst._last = now;
      if (inst.autoRotate && !inst.tween) inst.azimuth += dt * 0.55;
      if (inst.orbit) {
        const p = (now - inst.orbit.t0) / inst.orbit.dur;
        if (p >= 1) {
          inst.azimuth = inst.orbit.from + Math.PI * 2 * (inst.orbit.turns || 1);
          inst.orbit = null;
        } else {
          const e = Easing.fn('easeInOutCubic')(p);
          inst.azimuth = inst.orbit.from + Math.PI * 2 * (inst.orbit.turns || 1) * e;
        }
        this.updateCamera(inst);
      }
      if (inst.tween) this.stepTween(inst, now);
      if (inst.mixer) inst.mixer.update(dt);
      inst._frame = (inst._frame || 0) + 1;
      const editing = typeof App !== 'undefined' && App && !App.playing;
      if (editing && (inst._frame & 1)) return;
      try { inst.renderer.render(inst.scene, inst.camera); } catch (e) { }
    });
    if (this.instances.size) requestAnimationFrame(t => this.loop(t));
    else this.running = false;
  },

  updateCamera(inst) {
    const d = inst.distance;
    const az = inst.azimuth, el = inst.elevation;
    inst.camera.position.set(
      d * Math.cos(el) * Math.sin(az),
      d * Math.sin(el),
      d * Math.cos(el) * Math.cos(az)
    );
    inst.camera.lookAt(inst.center);
  },

  tweenTo(inst, target, duration) {
    inst.tween = {
      t0: performance.now(),
      dur: Math.max(1, (duration || 1) * 1000),
      from: { azimuth: inst.azimuth, elevation: inst.elevation, distance: inst.distance },
      to: Object.assign({ azimuth: inst.azimuth, elevation: inst.elevation, distance: inst.distance }, target)
    };
    inst.orbit = null;
  },

  stepTween(inst, now) {
    const tw = inst.tween;
    const p = Math.min(1, (now - tw.t0) / tw.dur);
    const e = Easing.fn('easeInOutCubic')(p);
    inst.azimuth = tw.from.azimuth + (tw.to.azimuth - tw.from.azimuth) * e;
    inst.elevation = tw.from.elevation + (tw.to.elevation - tw.from.elevation) * e;
    inst.distance = tw.from.distance + (tw.to.distance - tw.from.distance) * e;
    this.updateCamera(inst);
    if (p >= 1) inst.tween = null;
  },

  // ---------- 积木控制 ----------
  setView(elId, preset, duration = 1) {
    const inst = this.instances.get(elId);
    if (!inst) return;
    const P = {
      front: [0, 0.12], side: [Math.PI / 2, 0.12], back: [Math.PI, 0.12],
      top: [0.0, 1.25], corner: [0.6, 0.32]
    };
    const [az, el] = P[preset] || P.corner;
    this.tweenTo(inst, { azimuth: az, elevation: el }, duration);
  },

  orbit(elId, duration = 4, turns = 1) {
    const inst = this.instances.get(elId);
    if (!inst) return;
    inst.tween = null;
    inst.orbit = { t0: performance.now(), dur: Math.max(200, (duration || 4) * 1000), from: inst.azimuth, turns };
  },

  zoom(elId, factor = 0.7, duration = 1) {
    const inst = this.instances.get(elId);
    if (!inst) return;
    const target = Math.max(inst.radius * 1.1, Math.min(inst.radius * 12, inst.distance * factor));
    this.tweenTo(inst, { distance: target }, duration);
  },

  playAnimation(elId, name, { loop = true, speed = 1 } = {}) {
    const inst = this.instances.get(elId);
    if (!inst || !inst.actions.length) return;
    const act = inst.actions.find(a => a.name === name) || inst.actions[0];
    this._playAction(inst, act, { loop, speed });
  },

  setLights(el, inst) {
    const T = this.THREE;
    if (inst.lights) inst.lights.forEach(l => inst.scene.remove(l));
    const preset = (el.props.lights && el.props.lights.preset) || 'soft';
    const sets = {
      soft: [[0xffffff, 1.0], [0xffffff, 1.7, [3, 5, 4]]],
      bright: [[0xffffff, 1.4], [0xffffff, 2.8, [4, 6, 4]], [0x88aaff, 0.9, [-4, 3, -3]]],
      dark: [[0x334066, 0.7], [0xffffff, 0.8, [3, 4, 4]]],
      cool: [[0xaaccff, 0.9], [0xeaf4ff, 1.9, [3, 5, 4]]],
      warm: [[0xffd9a0, 1.0], [0xfff2dd, 2.1, [3, 5, 4]]]
    };
    const cfg = sets[preset] || sets.soft;
    inst.lights = cfg.map((c, i) => {
      if (i === 0) {
        const amb = new T.AmbientLight(c[0], c[1]);
        inst.scene.add(amb);
        return amb;
      }
      const dir = new T.DirectionalLight(c[0], c[1]);
      dir.position.set(c[2][0], c[2][1], c[2][2]);
      inst.scene.add(dir);
      return dir;
    });
  },

  applyLights(el, inst) { this.setLights(el, inst); },

  setAutoRotate(elId, on) {
    const inst = this.instances.get(elId);
    if (inst) inst.autoRotate = !!on;
  },

  unmount(elId) {
    const inst = this.instances.get(elId);
    if (!inst) return;
    try { inst.renderer.dispose(); } catch (e) { }
    this.instances.delete(elId);
  }
};
