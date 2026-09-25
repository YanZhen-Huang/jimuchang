// IR 执行引擎：编译脚本、事件触发、语句解释
const Executor = {
  vars: {},
  scripts: { global: [], scenes: {} },
  sceneCtx: null,
  playing: false,
  hooks: {},   // onSceneEnter(sceneId)

  // ---------- 编译 ----------
  compileAll() {
    JimuBlocks.save();
    const compileState = (state) => {
      if (!state) return [];
      const ws = new Blockly.Workspace();
      try {
        Blockly.serialization.workspaces.load(state, ws);
        return IRCompiler.compileWorkspace(ws);
      } catch (e) {
        console.warn('脚本编译失败', e);
        return [];
      } finally {
        ws.dispose();
      }
    };
    const out = { global: [], scenes: {}, orphans: 0, funcs: {} };
    const one = (state) => {
      const r = compileState(state);
      out.orphans += IRCompiler.lastOrphanCount || 0;
      (IRCompiler.lastFuncs || []).forEach(f => { out.funcs[f.name] = { body: f.body, retExpr: f.retExpr || null }; });
      return r;
    };
    out.global = one(Project.data.globalBlocks);
    for (const sc of Project.data.scenes) out.scenes[sc.id] = one(sc.blocks);
    return out;
  },

  // ---------- 播放控制 ----------
  async start() {
    if (!Project.data.scenes.length) return;
    this.playing = true;
    this.vars = {};
    this.lastMessage = null;
    this.timerT0 = performance.now();
    this.cloneCount = 0;
    // 放映机模式：脚本已由导出时预编译注入，跳过 Blockly 编译
    if (!this.presetScripts) {
      this.scripts = this.compileAll();
      this.funcs = this.scripts.funcs || {};
    }
    const first = Project.data.scenes[0].id;
    await Stage.goScene(first, { duration: 0 });
    // 全局"当演示开始"脚本并发长跑
    this.scripts.global.filter(s => s.kind === 'onStart').forEach(s => {
      this.run(s.body, this.newCtx());
    });
    await this.fireSceneEnter(first);
  },

  stop() {
    this.playing = false;
    if (this.sceneCtx) this.sceneCtx.aborted = true;
    this.sceneCtx = null;
    document.querySelectorAll('.el').forEach(d => Anim.clear(d));
  },

  newCtx() { return { vars: this.vars, aborted: false }; },

  async fireSceneEnter(sceneId) {
    if (this.sceneCtx) this.sceneCtx.aborted = true;
    if (this.hooks.onSceneEnter) this.hooks.onSceneEnter(sceneId);
    const ctx = this.newCtx();
    this.sceneCtx = ctx;
    const list = [];
    const collect = arr => arr.forEach(s => {
      if (s.kind !== 'onSceneEnter') return;
      if (s.sceneId && s.sceneId !== sceneId) return;
      list.push(s);
    });
    collect(this.scripts.global);
    collect(this.scripts.scenes[sceneId] || []);
    for (const s of list) {
      if (ctx.aborted) return;
      await this.run(s.body, ctx);
    }
  },

  triggerCloneStart(cloneId) {
    const list = [];
    (this.scripts.global || []).forEach(s => { if (s.kind === 'onCloneStart') list.push(s); });
    (this.scripts.scenes[Stage.currentSceneId] || []).forEach(s => { if (s.kind === 'onCloneStart') list.push(s); });
    list.forEach(s => {
      const c = this.newCtx();
      c.selfElId = cloneId;
      this.run(s.body, c);
    });
    return list.length;
  },

  async trigger(kind, value, payload) {
    if (!this.playing) return 0;
    if (payload !== undefined) this.lastMessage = payload;
    const list = [];
    const match = s => {
      if (kind === 'onKey') return s.key === value;
      if (kind === 'onElementClick') return s.elId === value;
      if (kind === 'onWebappMessage') return s.elId === value;
      return false;
    };
    this.scripts.global.forEach(s => { if (s.kind === kind && match(s)) list.push(s); });
    (this.scripts.scenes[Stage.currentSceneId] || []).forEach(s => { if (s.kind === kind && match(s)) list.push(s); });
    list.forEach(s => this.run(s.body, this.newCtx()));
    return list.length;
  },

  // ---------- 解释执行 ----------
  async run(body, ctx) {
    for (const instr of body) {
      if (ctx.aborted) return;
      try {
        await this.exec(instr, ctx);
      } catch (e) {
        console.warn('指令执行失败', instr && instr.op, e);
      }
    }
  },

  async exec(instr, ctx) {
    // 克隆体自我引用：@self → 当前克隆体 id
    if (instr.elId === '@self') {
      if (!ctx.selfElId) return;
      instr = Object.assign({}, instr, { elId: ctx.selfElId });
    }
    switch (instr.op) {
      case 'wait': {
        const sec = Number(await this.evalExpr(instr.sec, ctx)) || 0;
        await this.sleepAbort(sec * 1000, ctx);
        break;
      }
      case 'scene.go': await this.sceneGo(instr.sceneId, ctx); break;
      case 'scene.next': {
        const i = Project.sceneIndex(Stage.currentSceneId);
        const next = Project.data.scenes[i + 1];
        if (next) await this.sceneGo(next.id, ctx);
        break;
      }
      case 'scene.transition': {
        const sc = Stage.currentScene();
        if (sc) sc.transition = { type: instr.type, duration: Number(instr.duration) || 0 };
        break;
      }
      case 'el.show': {
        const f = Project.findElementById(instr.elId);
        if (f) {
          f.element.visible = true;
          const dom = Stage.elDom(instr.elId);
          if (dom) { Anim.reset(f.element, dom); Elements.applyBox(f.element, dom); }
        }
        break;
      }
      case 'el.hide': {
        const f = Project.findElementById(instr.elId);
        if (f) {
          f.element.visible = false;
          const dom = Stage.elDom(instr.elId);
          if (dom) Elements.applyBox(f.element, dom);
        }
        break;
      }
      case 'el.text': {
        const f = Project.findElementById(instr.elId);
        if (f) {
          f.element.props.text = String(await this.evalExpr(instr.text, ctx));
          if (Stage.elDom(instr.elId)) Stage.refresh(instr.elId);
        }
        break;
      }
      case 'el.move': {
        const f = Project.findElementById(instr.elId);
        if (f) {
          f.element.x = Number(await this.evalExpr(instr.x, ctx)) || 0;
          f.element.y = Number(await this.evalExpr(instr.y, ctx)) || 0;
          const dom = Stage.elDom(instr.elId);
          if (dom) Elements.applyBox(f.element, dom);
        }
        break;
      }
      case 'el.size': {
        const f = Project.findElementById(instr.elId);
        if (f) {
          f.element.w = Number(await this.evalExpr(instr.w, ctx)) || 10;
          f.element.h = Number(await this.evalExpr(instr.h, ctx)) || 10;
          if (Stage.elDom(instr.elId)) Stage.refresh(instr.elId);
        }
        break;
      }
      case 'el.color': {
        const f = Project.findElementById(instr.elId);
        if (f) {
          const p = f.element.props;
          if (f.element.type === 'text') p.color = instr.color;
          else if (f.element.type === 'icon') p.color = instr.color;
          else p.fill = instr.color;
          if (Stage.elDom(instr.elId)) Stage.refresh(instr.elId);
        }
        break;
      }
      case 'timer.reset': this.timerT0 = performance.now(); break;
      case 'el.set': {
        const fs1 = Project.findElementById(instr.elId);
        if (!fs1) break;
        const rawV = await this.evalExpr(instr.value, ctx);
        const e1 = fs1.element;
        if (instr.prop === 'color') {
          const cs = String(rawV == null ? '' : rawV);
          if (!/^#[0-9a-fA-F]{6}$/.test(cs)) break;
          if (e1.type === 'text' || e1.type === 'icon') e1.props.color = cs;
          else e1.props.fill = cs;
          if (Stage.elDom(e1.id)) Stage.refresh(e1.id);
          break;
        }
        const v1 = Number(rawV) || 0;
        if (instr.prop === 'rotation') e1.rotation = v1;
        else if (instr.prop === 'opacity') e1.opacity = Math.max(0, Math.min(1, v1));
        else if (instr.prop === 'w') e1.w = Math.max(10, v1);
        else if (instr.prop === 'h') e1.h = Math.max(10, v1);
        else if (instr.prop === 'x' || instr.prop === 'y') e1[instr.prop] = v1;
        const d1 = Stage.elDom(instr.elId);
        if (d1) {
          if (instr.prop === 'w' || instr.prop === 'h') Stage.refresh(instr.elId);
          else Elements.applyBox(e1, d1);
        }
        break;
      }
      case 'el.layer': {
        const fl = Project.findElementById(instr.elId);
        if (!fl) break;
        const zs = fl.scene.elements.map(x => x.z || 0);
        fl.element.z = instr.where === 'front' ? Math.max(...zs) + 1 : Math.min(...zs) - 1;
        const dl = Stage.elDom(instr.elId);
        if (dl) dl.style.zIndex = fl.element.z;  // 不重建 DOM（避免清掉气泡/动画状态）
        break;
      }
      case 'el.say': {
        const txt = String(await this.evalExpr(instr.text, ctx));
        Bubbles.show(instr.elId, txt, Number(instr.seconds) || 0);
        break;
      }
      case 'el.say.stop': Bubbles.hide(instr.elId); break;
      case 'el.clone.start': {
        const fcs = Project.findElementById(instr.elId);
        if (!fcs) break;
        this.cloneCount = (this.cloneCount || 0) + 1;
        if (this.cloneCount > 200) { console.warn('克隆体超过 200 个，已忽略'); break; }
        const copy2 = JSON.parse(JSON.stringify(fcs.element));
        copy2.id = Project.uid('el');
        copy2.name = fcs.element.name + '·克隆';
        copy2._clone = true;
        copy2.z = Math.max(...fcs.scene.elements.map(x => x.z || 0)) + 1;
        fcs.scene.elements.push(copy2);
        if (Stage.currentSceneId === fcs.scene.id) {
          const layer = Stage.layerEl && Stage.layerEl.querySelector('.scene-els');
          if (layer) layer.appendChild(Elements.render(copy2));
        }
        this.triggerCloneStart(copy2.id);
        break;
      }
      case 'el.clone': {
        const fc1 = Project.findElementById(instr.elId);
        if (!fc1) break;
        const copy = JSON.parse(JSON.stringify(fc1.element));
        copy.id = Project.uid('el');
        copy.name = fc1.element.name + '·副本';
        copy.x += 24; copy.y += 24;
        copy.z = Math.max(...fc1.scene.elements.map(x => x.z || 0)) + 1;
        fc1.scene.elements.push(copy);
        if (Stage.currentSceneId === fc1.scene.id) Stage.render(fc1.scene);
        break;
      }
      case 'el.remove': {
        const fr = Project.findElementById(instr.elId);
        if (!fr) break;
        const dr = Stage.elDom(instr.elId);
        if (dr) dr.remove();
        Project.removeElement(fr.scene, instr.elId);
        if (Editor.selectedId === instr.elId) Editor.select(null);
        break;
      }
      case 'scene.replay': {
        const sr = Stage.currentScene();
        if (sr) {
          Stage.render(sr);
          await this.fireSceneEnter(sr.id);
        }
        break;
      }
      case 'scene.restart': {
        const first = Project.data.scenes[0];
        if (first) await this.sceneGo(first.id, ctx);
        break;
      }
      case 'scene.bg': {
        const sb = Stage.currentScene();
        if (!sb) break;
        sb.background = { type: 'color', value: instr.color };
        if (Stage.layerEl) {
          const bgEl = Stage.layerEl.querySelector('.scene-bg');
          if (bgEl) bgEl.style.background = instr.color;
        }
        break;
      }
      case 'ctrl.waituntil': {
        const tw = performance.now();
        while (!this.truthy(await this.evalExpr(instr.cond, ctx))) {
          if (ctx.aborted) return;
          if (performance.now() - tw > 600000) break;
          await this.sleepAbort(60, ctx);
        }
        break;
      }
      case 'ctrl.repeatuntil': {
        let guard = 0;
        while (!this.truthy(await this.evalExpr(instr.cond, ctx))) {
          if (ctx.aborted) return;
          if (++guard > 5000) { console.warn('重复直到：次数过多，已强制退出'); break; }
          await this.run(instr.body, ctx);
        }
        break;
      }
      case 'ctrl.stopscript': ctx.aborted = true; break;
      case 'media.volume':
        if (AudioMgr.bgm) {
          try { AudioMgr.bgm.volume = Math.max(0, Math.min(1, Number(instr.value) / 100)); } catch (e) { }
        }
        break;
      case 'media.stopall': AudioMgr.stopAll(); break;
      case '3d.scale': {
        const ins = Model3D.instances.get(instr.elId);
        const sv = Number(await this.evalExpr(instr.value, ctx)) || 1;
        if (ins && ins.model) ins.model.scale.setScalar(Math.max(0.05, sv));
        break;
      }
      case '3d.animctl': {
        const ina = Model3D.instances.get(instr.elId);
        if (ina && ina.mixer) ina.mixer.timeScale = instr.action === 'pause' ? 0 : 1;
        break;
      }
      case 'el.glide': {
        const fg = Project.findElementById(instr.elId);
        if (!fg) break;
        const tx = Number(await this.evalExpr(instr.x, ctx)) || 0;
        const ty = Number(await this.evalExpr(instr.y, ctx)) || 0;
        const dur = Math.max(0, Number(await this.evalExpr(instr.duration, ctx)) || 0);
        const dom = Stage.elDom(instr.elId);
        if (!dom || dur <= 0) {
          fg.element.x = tx; fg.element.y = ty;
          if (dom) Elements.applyBox(fg.element, dom);
          break;
        }
        const animEl = dom.querySelector('.el-anim');
        const sx = fg.element.x, sy = fg.element.y;
        let anim = null;
        if (animEl) {
          anim = animEl.animate(
            [{ transform: `translate(${sx - tx}px, ${sy - ty}px)` }, { transform: 'translate(0,0)' }],
            { duration: dur * 1000, easing: Easing.css(instr.easing || 'easeInOutCubic') });
          try { await anim.finished; } catch (e) { }
        }
        fg.element.x = tx; fg.element.y = ty;
        if (dom) {
          Elements.applyBox(fg.element, dom);
          if (anim) { try { anim.cancel(); } catch (e) { } }
        }
        break;
      }
      case 'el.steps': {
        const fs2 = Project.findElementById(instr.elId);
        if (!fs2) break;
        const steps = Number(await this.evalExpr(instr.steps, ctx)) || 0;
        const rad = (fs2.element.rotation || 0) * Math.PI / 180;
        fs2.element.x += Math.round(Math.cos(rad) * steps);
        fs2.element.y += Math.round(Math.sin(rad) * steps);
        const dom2 = Stage.elDom(instr.elId);
        if (dom2) Elements.applyBox(fs2.element, dom2);
        break;
      }
      case 'el.face': {
        const ff = Project.findElementById(instr.elId);
        if (!ff) break;
        ff.element.rotation = Number(await this.evalExpr(instr.angle, ctx)) || 0;
        const dom3 = Stage.elDom(instr.elId);
        if (dom3) Elements.applyBox(ff.element, dom3);
        break;
      }
      case 'el.change': {
        const fc = Project.findElementById(instr.elId);
        if (!fc) break;
        const d = Number(await this.evalExpr(instr.delta, ctx)) || 0;
        const el = fc.element;
        if (instr.prop === 'x') el.x += Math.round(d);
        else if (instr.prop === 'y') el.y += Math.round(d);
        else if (instr.prop === 'rotation') el.rotation = (el.rotation || 0) + d;
        else if (instr.prop === 'size') {
          const k = Math.max(0.05, 1 + d / 100);
          el.w = Math.round(el.w * k);
          el.h = Math.round(el.h * k);
        } else if (instr.prop === 'opacity') {
          el.opacity = Math.max(0, Math.min(1, (el.opacity === undefined ? 1 : el.opacity) + d / 100));
        }
        const dom4 = Stage.elDom(instr.elId);
        if (dom4) {
          if (instr.prop === 'size') Stage.refresh(instr.elId);
          else Elements.applyBox(el, dom4);
        }
        break;
      }
      case 'el.frame': {
        const val = await this.evalExpr(instr.value, ctx);
        Sprites.control(instr.elId, instr.action === 'next' ? 'next' : 'frame', Number(val) || 1);
        break;
      }
      case 'el.anim': {
        const f = Project.findElementById(instr.elId);
        if (!f) break;
        const dom = Stage.elDom(instr.elId);
        if (!dom) break;
        if (instr.anim && instr.anim.includes('fly')) { /* fly 动画基于元素位置，位置已最新 */ }
        await Anim.play(f.element, dom, instr.anim, {
          duration: instr.duration, delay: instr.delay, easing: instr.easing
        });
        break;
      }
      case 'var.set':
        ctx.vars[instr.name] = await this.evalExpr(instr.value, ctx);
        break;
      case 'el.keyframes': {
        const f = Project.findElementById(instr.elId);
        if (!f) break;
        const dom = Stage.elDom(instr.elId);
        if (!dom || typeof Keyframes === 'undefined') break;
        await Keyframes.play(f.element, dom, { loop: !!instr.loop });
        break;
      }
      case 'media.sfx': {
        const r = Project.getResource(instr.resId);
        if (r) AudioMgr.sfx(Project.resourceUrl(instr.resId), instr.volume !== undefined ? instr.volume : 1);
        break;
      }
      case 'media.music': {
        const r = Project.getResource(instr.resId);
        if (r) AudioMgr.playMusic(Project.resourceUrl(instr.resId), {
          loop: instr.loop, volume: instr.volume, fadeIn: instr.fadeIn || 0
        });
        break;
      }
      case 'media.music.stop':
        AudioMgr.stopMusic(instr.fadeOut || 0);
        break;
      case 'media.video': {
        const dom = Stage.elDom(instr.elId);
        const v = dom && dom.querySelector('video');
        if (!v) break;
        switch (instr.action) {
          case 'play': v.play().catch(() => { }); break;
          case 'pause': v.pause(); break;
          case 'stop': v.pause(); v.currentTime = 0; break;
          case 'mute': v.muted = true; break;
          case 'unmute': v.muted = false; break;
        }
        break;
      }
      case '3d.view': Model3D.setView(instr.elId, instr.preset, instr.duration); break;
      case '3d.orbit': Model3D.orbit(instr.elId, instr.duration); break;
      case '3d.zoom': Model3D.zoom(instr.elId, instr.factor, instr.duration); break;
      case '3d.anim': Model3D.playAnimation(instr.elId, instr.name, { loop: instr.loop, speed: instr.speed }); break;
      case '3d.lights': {
        const f3 = Project.findElementById(instr.elId);
        if (f3) {
          f3.element.props.lights = { preset: instr.preset };
          const inst = Model3D.instances.get(instr.elId);
          if (inst) Model3D.applyLights(f3.element, inst);
        }
        break;
      }
      case '3d.autorotate': Model3D.setAutoRotate(instr.elId, instr.value); break;
      case 'fx.burst':
        Effects.burst(instr.elId, instr.fxType);
        break;
      case 'chart.refresh':
        Stage.refresh(instr.elId);
        break;
      case 'sprite.ctrl':
        Sprites.control(instr.elId, instr.action);
        break;
      case 'sprite.speed':
        Sprites.control(instr.elId, 'speed', instr.value);
        break;
      case 'ctrl.repeat': {
        let n = Math.floor(Number(await this.evalExpr(instr.times, ctx)) || 0);
        n = Math.min(Math.max(n, 0), 1000);
        for (let i = 0; i < n; i++) {
          if (ctx.aborted) return;
          await this.run(instr.body, ctx);
        }
        break;
      }
      case 'ctrl.if': {
        for (const br of instr.branches) {
          if (this.truthy(await this.evalExpr(br.cond, ctx))) {
            await this.run(br.body, ctx);
            return;
          }
        }
        if (instr.elseBody) await this.run(instr.elseBody, ctx);
        break;
      }
      case 'log':
        console.log('[剧本]', await this.evalExpr(instr.text, ctx));
        break;
      case 'js.eval': {
        try {
          const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
          const fn = new AsyncFunction('jimu', instr.code || '');
          await fn(JimuAPI);
        } catch (e) {
          console.warn('代码块执行出错：', e && e.message ? e.message : e);
        }
        break;
      }
      case 'webapp.send': {
        const dom = Stage.elDom(instr.elId);
        const iframe = dom && dom.querySelector('iframe.c-webapp');
        const msg = await this.evalExpr(instr.msg, ctx);
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ source: 'jimu', data: msg }, '*');
        }
        break;
      }
      case 'func.call':
        await this.execFunc(instr.name, ctx);
        break;
      default:
        break;
    }
  },

  async sceneGo(sceneId, ctx) {
    const sc = Project.getScene(sceneId);
    if (!sc) return;
    await Stage.goScene(sceneId);
    await this.fireSceneEnter(sceneId);
  },

  async sleepAbort(ms, ctx) {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      if (ctx.aborted) return;
      await sleep(Math.min(100, ms - (performance.now() - t0)));
    }
  },

  async execFunc(name, ctx) {
    const def = this.funcs && this.funcs[name];
    if (!def) { console.warn('函数未定义：' + name); return undefined; }
    const body = Array.isArray(def) ? def : def.body;
    const retExpr = Array.isArray(def) ? null : def.retExpr;
    ctx._depth = (ctx._depth || 0) + 1;
    if (ctx._depth > 40) {
      ctx._depth--;
      console.warn('函数调用层级过深（>40）');
      return undefined;
    }
    await this.run(body || [], ctx);
    ctx._depth--;
    if (retExpr) return await this.evalExpr(retExpr, ctx);
    return undefined;
  },

  async evalExpr(e, ctx) {
    if (e === undefined || e === null) return undefined;
    switch (e.k) {
      case 'num': return e.v;
      case 'str': return e.v;
      case 'bool': return e.v;
      case 'var': return ctx.vars[e.name] !== undefined ? ctx.vars[e.name] : 0;
      case 'call': return await this.execFunc(e.name, ctx);
      case 'prop': {
        const fp = Project.findElementById(e.el);
        if (!fp) return 0;
        if (e.prop === 'opacity') return fp.element.opacity === undefined ? 1 : fp.element.opacity;
        return fp.element[e.prop] || 0;
      }
      case 'scenename': {
        const scn = Stage.currentScene();
        return scn ? scn.name : '';
      }
      case 'timer': return (performance.now() - (this.timerT0 || 0)) / 1000;
      case 'randcolor': return '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
      case 'randint': {
        const ra = Math.ceil(Number(await this.evalExpr(e.a, ctx)) || 0);
        const rb = Math.floor(Number(await this.evalExpr(e.b, ctx)) || 0);
        if (rb < ra) return ra;
        return Math.floor(Math.random() * (rb - ra + 1)) + ra;
      }
      case 'randfloat': return Math.random();
      case 'round': {
        const rv = Number(await this.evalExpr(e.v, ctx)) || 0;
        if (e.op === 'ROUNDUP') return Math.ceil(rv);
        if (e.op === 'ROUNDDOWN') return Math.floor(rv);
        return Math.round(rv);
      }
      case 'mod': {
        const ma = Number(await this.evalExpr(e.a, ctx)) || 0;
        const mb = Number(await this.evalExpr(e.b, ctx)) || 1;
        return mb === 0 ? 0 : ma % mb;
      }
      case 'single': {
        const sv = Number(await this.evalExpr(e.v, ctx)) || 0;
        switch (e.op) {
          case 'ABS': return Math.abs(sv);
          case 'NEG': return -sv;
          case 'ROOT': return Math.sqrt(sv);
          case 'LN': return Math.log(sv);
          case 'LOG10': return Math.log10(sv);
          case 'EXP': return Math.exp(sv);
          case 'POW10': return Math.pow(10, sv);
          default: return sv;
        }
      }
      case 'numprop': {
        const nv = Number(await this.evalExpr(e.v, ctx)) || 0;
        switch (e.op) {
          case 'EVEN': return nv % 2 === 0;
          case 'ODD': return Math.abs(nv % 2) === 1;
          case 'PRIME': {
            if (nv < 2) return false;
            for (let i = 2; i <= Math.sqrt(nv); i++) if (nv % i === 0) return false;
            return true;
          }
          case 'WHOLE': return nv % 1 === 0;
          case 'POSITIVE': return nv > 0;
          case 'NEGATIVE': return nv < 0;
          case 'DIVISIBLE_BY': return true;  // 简化：缺第二输入，恒真
          default: return false;
        }
      }
      case 'strlen': return String(await this.evalExpr(e.v, ctx) ?? '').length;
      case 'strempty': return String(await this.evalExpr(e.v, ctx) ?? '').length === 0;
      case 'const': return { PI: Math.PI, E: Math.E, GOLDEN_RATIO: 1.618033988749895, SQRT2: Math.SQRT2, SQRT1_2: Math.SQRT1_2, INFINITY: Infinity }[e.name] || 0;
      case 'unsupported':
        console.warn('[积木] 表达式块未实现:', e.type);
        return 0;
      case 'bin': {
        const a = Number(await this.evalExpr(e.a, ctx)), b = Number(await this.evalExpr(e.b, ctx));
        switch (e.op) {
          case 'ADD': return a + b;
          case 'MINUS': return a - b;
          case 'MULTIPLY': return a * b;
          case 'DIVIDE': return b === 0 ? 0 : a / b;
          case 'POWER': return Math.pow(a, b);
          default: return a + b;
        }
      }
      case 'cmp': {
        const a = await this.evalExpr(e.a, ctx), b = await this.evalExpr(e.b, ctx);
        switch (e.op) {
          case 'EQ': return a == b;
          case 'NEQ': return a != b;
          case 'LT': return a < b;
          case 'LTE': return a <= b;
          case 'GT': return a > b;
          case 'GTE': return a >= b;
          default: return false;
        }
      }
      case 'log': {
        const a = this.truthy(await this.evalExpr(e.a, ctx));
        const b = this.truthy(await this.evalExpr(e.b, ctx));
        return e.op === 'AND' ? (a && b) : (a || b);
      }
      case 'not': return !this.truthy(await this.evalExpr(e.v, ctx));
      case 'join': {
        const parts = [];
        for (const p of (e.parts || [])) parts.push(await this.evalExpr(p, ctx));
        return parts.map(x => String(x === undefined ? '' : x)).join('');
      }
      default: return undefined;
    }
  },

  truthy(v) { return !!(v && v !== 'false' && v !== 0); }
};
