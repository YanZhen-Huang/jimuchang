// IR 执行引擎：编译脚本、事件触发、语句解释
const Executor = {
  vars: {},
  scripts: { global: [], scenes: {} },
  sceneCtx: null,
  playing: false,
  hooks: {},   // onSceneEnter(sceneId)
  mouse: { x: 0, y: 0, down: false },   // 舞台坐标（S2 侦测）
  lastAnswer: '',                        // 询问回答
  lastChart: null,                       // 最近一次图表点击信息（交互三件套）
  lists: {},                             // 数据列表（S2）
  _ctxs: [],                             // 运行中脚本上下文（停止全部用）

  // ---------- 编译 ----------
  compileAll() {
    JimuBlocks.save();
    const compileState = (state, selfMode) => {
      if (!state) return [];
      const ws = new Blockly.Workspace();
      try {
        Blockly.serialization.workspaces.load(state, ws);
        return IRCompiler.compileWorkspace(ws, { selfMode: !!selfMode });
      } catch (e) {
        console.warn('脚本编译失败', e);
        return [];
      } finally {
        ws.dispose();
      }
    };
    const out = { global: [], scenes: {}, elements: {}, orphans: 0, funcs: {} };
    const one = (state, selfMode) => {
      const r = compileState(state, selfMode);
      out.orphans += IRCompiler.lastOrphanCount || 0;
      (IRCompiler.lastFuncs || []).forEach(f => { out.funcs[f.name] = { body: f.body, retExpr: f.retExpr || null, params: f.params || null }; });
      return r;
    };
    out.global = one(Project.data.globalBlocks, false);
    for (const sc of Project.data.chapters) out.scenes[sc.id] = one(sc.blocks, false);
    // v2：元素脚本（自我版积木，self=该元素）
    for (const el of Project.data.elements) {
      if (!el.blocks) continue;
      const list = one(el.blocks, true);
      if (list.length) out.elements[el.id] = list;
    }
    return out;
  },

  // ---------- 播放控制 ----------
  async start() {
    if (!Project.data.chapters.length) return;
    this.playing = true;
    this.vars = {};
    this.lastMessage = null;
    this.timerT0 = performance.now();
    this.cloneCount = 0;
    this._ctxs = [];
    this.lastAnswer = '';
    this.lastChart = null;
    this._sliderTh = {};
    this.lists = {};
    // 放映机模式：脚本已由导出时预编译注入，跳过 Blockly 编译
    if (!this.presetScripts) {
      this.scripts = this.compileAll();
      this.funcs = this.scripts.funcs || {};
    }
    const first = Project.data.chapters[0].id;
    await Stage.goScene(first, { duration: 0 });
    // 全局"当演示开始"脚本并发长跑
    this.scripts.global.filter(s => s.kind === 'onStart').forEach(s => {
      this.run(s.body, this.newCtx());
    });
    // v2 元素"当我开始"脚本（每个母体元素各跑一次，self=自己；克隆体不跑）
    Object.entries(this.scripts.elements || {}).forEach(([elId, list]) => {
      list.filter(s => s.kind === 'onStart').forEach(s => {
        const c = this.newCtx();
        c.selfElId = elId;
        this.run(s.body, c);
      });
    });
    await this.fireSceneEnter(first);
  },

  stop() {
    this.playing = false;
    if (this.sceneCtx) this.sceneCtx.aborted = true;
    this.sceneCtx = null;
    this._ctxs = [];
    const askOv = document.getElementById('ask-overlay');
    if (askOv) askOv.remove();
    document.querySelectorAll('.el').forEach(d => Anim.clear(d));
  },

  newCtx() {
    const ctx = { vars: this.vars, aborted: false };
    if (!this._ctxs) this._ctxs = [];
    this._ctxs.push(ctx);
    if (this._ctxs.length > 500) this._ctxs.splice(0, 100);
    return ctx;
  },

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

  // 广播消息：全局脚本 + 所有元素的「当收到消息」脚本（元素脚本 self=该元素），即发即忘
  broadcast(message) {
    if (!message) return 0;
    const list = [];
    (this.scripts.global || []).forEach(s => {
      if (s.kind === 'onMessage' && s.message === message) list.push({ s, self: null });
    });
    // 每个元素实例各执行一次（含克隆体/副本：回退到模板脚本，self=实例自身）
    (Project.data.elements || []).forEach(el => {
      this.scriptsFor(el.id).forEach(s => {
        if (s.kind === 'onMessage' && s.message === message) list.push({ s, self: el.id });
      });
    });
    list.forEach(({ s, self }) => {
      const c = this.newCtx();
      if (self) c.selfElId = self;
      this.run(s.body, c);
    });
    return list.length;
  },

  triggerCloneStart(cloneId, templateElId) {
    const list = [];
    (this.scripts.global || []).forEach(s => { if (s.kind === 'onCloneStart') list.push(s); });
    (this.scripts.scenes[Stage.currentSceneId] || []).forEach(s => { if (s.kind === 'onCloneStart') list.push(s); });
    list.forEach(s => {
      const c = this.newCtx();
      c.selfElId = cloneId;
      this.run(s.body, c);
    });
    // v2：模板元素的"当克隆体启动"脚本（self=克隆体）
    const elList = templateElId ? this.scriptsFor(templateElId).filter(s => s.kind === 'onCloneStart') : [];
    elList.forEach(s => {
      const c = this.newCtx();
      c.selfElId = cloneId;
      this.run(s.body, c);
    });
    return list.length + elList.length;
  },

  // 元素脚本查找：克隆体/副本回退到模板元素的脚本（交互在克隆体上同样生效）
  scriptsFor(elId) {
    const map = (this.scripts && this.scripts.elements) || {};
    if (map[elId]) return map[elId];
    const el = Project.getElement(elId);
    if (el && el._templateId && map[el._templateId]) return map[el._templateId];
    return [];
  },

  // ---------- 交互命中检测 ----------
  // 场景：按钮图形上盖着文字元素（两者平级），真实点击命中的是最上面的文字——
  // 需要"穿透"到下方有交互脚本的元素，否则用户点按钮中心没反应。
  _hasScript(elId, kinds) {
    const hit = s => kinds.indexOf(s.kind) >= 0 && s.elId === elId;
    if ((this.scripts.global || []).some(hit)) return true;
    if (((this.scripts.scenes || {})[Stage.currentSceneId] || []).some(hit)) return true;
    return this.scriptsFor(elId).some(s => kinds.indexOf(s.kind) >= 0);
  },

  // 屏幕坐标命中的元素栈（从上到下）
  elsAt(x, y) {
    try {
      return (document.elementsFromPoint(x, y) || []).filter(n => n.classList && n.classList.contains('el'));
    } catch (e) {
      return [];
    }
  },

  // 点击穿透：返回命中的"最上面有点击脚本的元素"；都没有脚本时取最上面元素（保持原行为）
  pickClickTarget(x, y) {
    const els = this.elsAt(x, y);
    if (!els.length) return null;
    for (const n of els) {
      if (n.dataset.id && this._hasScript(n.dataset.id, ['onElementClick'])) return n.dataset.id;
    }
    return els[0].dataset.id;
  },

  // 悬停穿透：只跟踪"有悬停脚本"的元素（无脚本元素在悬停视角完全透明）
  pickHoverTarget(x, y) {
    const els = this.elsAt(x, y);
    for (const n of els) {
      if (n.dataset.id && this._hasScript(n.dataset.id, ['onMouseEnter', 'onMouseLeave'])) return n.dataset.id;
    }
    return null;
  },

  async trigger(kind, value, payload) {
    if (!this.playing) return 0;
    if (payload !== undefined) this.lastMessage = payload;
    const list = [];
    // 带元素引用的事件类型：全局/章节脚本按 elId 匹配，元素脚本直接归属该元素
    const elKinds = ['onElementClick', 'onWebappMessage', 'onSliderChange', 'onMouseEnter', 'onMouseLeave', 'onChartClick'];
    const match = s => {
      if (kind === 'onKey') return s.key === value;
      if (elKinds.indexOf(kind) >= 0) return s.elId === value;
      return false;
    };
    this.scripts.global.forEach(s => { if (s.kind === kind && match(s)) list.push(s); });
    (this.scripts.scenes[Stage.currentSceneId] || []).forEach(s => { if (s.kind === kind && match(s)) list.push(s); });
    let count = list.length;
    list.forEach(s => this.run(s.body, this.newCtx()));
    // v2：元素脚本的"当点击我 / 收到消息 / 滑块值改变 / 移入移出 / 图表被点击"（self=该元素）
    if (elKinds.indexOf(kind) >= 0 && value) {
      const elList = this.scriptsFor(value).filter(s => s.kind === kind);
      elList.forEach(s => {
        const c = this.newCtx();
        c.selfElId = value;
        this.run(s.body, c);
      });
      count += elList.length;
    }
    return count;
  },

  // 滑块拖动：节流 80ms 触发（保留最后一次值，防止脚本风暴）
  sliderInput(elId, value) {
    if (!this.playing) return;
    const st = this._sliderTh || (this._sliderTh = {});
    let s = st[elId];
    if (!s) s = st[elId] = { last: 0, timer: 0, pending: null };
    s.pending = value;
    const fire = () => {
      s.timer = 0;
      s.last = performance.now();
      const v = s.pending;
      s.pending = null;
      this.trigger('onSliderChange', elId, v);
    };
    const now = performance.now();
    if (!s.timer && now - s.last > 80) fire();
    else if (!s.timer) s.timer = setTimeout(fire, 80);
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
        const i = Project.chapterIndex(Stage.currentChapterId);
        const next = Project.data.chapters[i + 1];
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
          if (typeof Pen !== 'undefined') Pen.connect(instr.elId);
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
        const zs = Project.data.elements.map(x => x.z || 0);
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
        const cloneMax = (typeof Settings !== 'undefined') ? Settings.get('cloneLimit') : 200;
        if (this.cloneCount > cloneMax) { console.warn('克隆体超过上限（' + cloneMax + '），已忽略'); break; }
        const copy2 = JSON.parse(JSON.stringify(fcs.element));
        copy2.id = Project.uid('el');
        copy2.name = fcs.element.name + '·克隆';
        copy2._clone = true;
        copy2._templateId = fcs.element._templateId || fcs.element.id;
        copy2.z = Math.max(...Project.data.elements.map(x => x.z || 0)) + 1;
        Project.data.elements.push(copy2);
        if (Stage.elsEl) Stage.elsEl.appendChild(Elements.render(copy2));
        this.triggerCloneStart(copy2.id, fcs.element.id);
        break;
      }
      case 'el.clone': {
        const fc1 = Project.findElementById(instr.elId);
        if (!fc1) break;
        const copy = JSON.parse(JSON.stringify(fc1.element));
        copy.id = Project.uid('el');
        copy.name = fc1.element.name + '·副本';
        copy.x += 24; copy.y += 24;
        copy.z = Math.max(...Project.data.elements.map(x => x.z || 0)) + 1;
        Project.data.elements.push(copy);
        Stage.refreshAll();
        break;
      }
      case 'el.remove': {
        const fr = Project.findElementById(instr.elId);
        if (!fr) break;
        const dr = Stage.elDom(instr.elId);
        if (dr) dr.remove();
        Project.removeElement(instr.elId);
        if (Editor.selectedId === instr.elId) Editor.select(null);
        break;
      }
      case 'scene.replay': {
        const sr = Stage.currentChapter();
        if (sr) {
          await Stage.goChapter(sr.id, { instant: true });
          await this.fireSceneEnter(sr.id);
        }
        break;
      }
      case 'scene.restart': {
        const first = Project.data.chapters[0];
        if (first) await this.sceneGo(first.id, ctx);
        break;
      }
      case 'scene.bg': {
        Project.data.stage.background = { type: 'color', value: instr.color };
        if (Stage.bgEl) Stage.applyBg(Stage.bgEl, Project.data.stage.background);
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
      case 'ctrl.stopall': {
        (this._ctxs || []).forEach(c => { c.aborted = true; });
        if (this.sceneCtx) this.sceneCtx.aborted = true;
        break;
      }
      case 'ask': {
        const q = String(await this.evalExpr(instr.text, ctx));
        this.lastAnswer = await this.promptAsk(q, ctx);
        break;
      }
      case 'list.add': {
        this.listOf(instr.name).push(await this.evalExpr(instr.value, ctx));
        break;
      }
      case 'list.delete': {
        const ld = this.listOf(instr.name);
        const li = Math.trunc(Number(await this.evalExpr(instr.n, ctx)) || 0) - 1;
        if (li >= 0 && li < ld.length) ld.splice(li, 1);
        break;
      }
      case 'list.insert': {
        const lins = this.listOf(instr.name);
        const li2 = Math.trunc(Number(await this.evalExpr(instr.n, ctx)) || 0) - 1;
        const lv = await this.evalExpr(instr.value, ctx);
        lins.splice(Math.max(0, Math.min(li2, lins.length)), 0, lv);
        break;
      }
      case 'list.replace': {
        const lr = this.listOf(instr.name);
        const li3 = Math.trunc(Number(await this.evalExpr(instr.n, ctx)) || 0) - 1;
        if (li3 >= 0 && li3 < lr.length) lr[li3] = await this.evalExpr(instr.value, ctx);
        break;
      }
      case 'list.clear': {
        this.lists[instr.name] = [];
        break;
      }
      case 'broadcast': {
        const bm = String(await this.evalExpr(instr.msg, ctx));
        this.broadcast(bm);
        break;
      }
      case 'list.split': {
        const lsText = String(await this.evalExpr(instr.text, ctx) ?? '');
        const lsSep = String(await this.evalExpr(instr.sep, ctx) ?? '');
        this.lists[instr.name] = lsSep === '' ? lsText.split('') : lsText.split(lsSep);
        break;
      }
      case 'music.note': {
        const mn = Number(await this.evalExpr(instr.note, ctx)) || 60;
        const md = Number(await this.evalExpr(instr.dur, ctx)) || 0.5;
        AudioMgr.note(mn, md);
        break;
      }
      case 'el.drag': {
        const fd = Project.findElementById(instr.elId);
        if (fd) fd.element.draggable = !!instr.on;
        break;
      }
      case 'pen.state': {
        if (typeof Pen !== 'undefined') Pen.setDown(instr.down);
        break;
      }
      case 'pen.clear': {
        if (typeof Pen !== 'undefined') Pen.clear();
        break;
      }
      case 'pen.size': {
        if (typeof Pen !== 'undefined') Pen.setSize(instr.n);
        break;
      }
      case 'pen.color': {
        if (typeof Pen !== 'undefined') Pen.setColor(instr.color);
        break;
      }
      case 'pen.line': {
        if (typeof Pen === 'undefined') break;
        const fp2 = Project.findElementById(instr.elId);
        if (!fp2) break;
        const px = Number(await this.evalExpr(instr.x, ctx)) || 0;
        const py = Number(await this.evalExpr(instr.y, ctx)) || 0;
        if (!Pen.last[instr.elId]) {
          Pen.last[instr.elId] = { x: fp2.element.x + fp2.element.w / 2, y: fp2.element.y + fp2.element.h / 2 };
        }
        Pen.lineTo(instr.elId, px, py);
        break;
      }
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
          if (typeof Pen !== 'undefined') Pen.connect(instr.elId);
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
        if (typeof Pen !== 'undefined') Pen.connect(instr.elId);
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
        if (typeof Pen !== 'undefined') Pen.connect(instr.elId);
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
        if (typeof Pen !== 'undefined') Pen.connect(instr.elId);
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
      case 'chart.set': {
        const fcs = Project.findElementById(instr.elId);
        if (!fcs) break;
        fcs.element.props.values = this.parseNumList(await this.evalExpr(instr.value, ctx));
        Elements.updateChart(instr.elId);
        break;
      }
      case 'chart.cats': {
        const fcc = Project.findElementById(instr.elId);
        if (!fcc) break;
        fcc.element.props.categories = this.parseStrList(await this.evalExpr(instr.value, ctx));
        Elements.updateChart(instr.elId);
        break;
      }
      case 'slider.set': {
        const fsd = Project.findElementById(instr.elId);
        if (!fsd) break;
        const sv = Number(await this.evalExpr(instr.value, ctx)) || 0;
        Elements.setSliderRuntime(instr.elId, sv, true);
        break;
      }
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
      case 'func.call': {
        const argObj = await this.buildArgs(instr, ctx);
        await this.execFunc(instr.name, ctx, argObj);
        break;
      }
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

  // 询问并等待（播放态输入框）
  promptAsk(question, ctx) {
    return new Promise(resolve => {
      const ov = document.createElement('div');
      ov.id = 'ask-overlay';
      const box = document.createElement('div');
      box.className = 'ask-box';
      const q = document.createElement('div');
      q.className = 'ask-q';
      q.textContent = question;
      const inp = document.createElement('input');
      inp.maxLength = 300;
      const btn = document.createElement('button');
      btn.className = 'p-btn primary';
      btn.textContent = '确定';
      box.appendChild(q); box.appendChild(inp); box.appendChild(btn);
      ov.appendChild(box);
      document.body.appendChild(ov);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearInterval(timer);
        const v = inp.value;
        ov.remove();
        resolve(v);
      };
      btn.onclick = finish;
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') finish(); });
      const timer = setInterval(() => { if (ctx && ctx.aborted) finish(); }, 200);
      setTimeout(() => { try { inp.focus(); } catch (e) { } }, 80);
    });
  },

  // 碰撞侦测（DOM rect 换算到舞台坐标）
  checkTouch(aId, bId) {
    const A = this.boxOf(aId);
    if (!A) return false;
    if (bId === '@edge') return A.x <= 0 || A.y <= 0 || A.x + A.w >= 1920 || A.y + A.h >= 1080;
    const B = this.boxOf(bId);
    if (!B) return false;
    return !(A.x + A.w < B.x || B.x + B.w < A.x || A.y + A.h < B.y || B.y + B.h < A.y);
  },

  listOf(name) {
    if (!this.lists) this.lists = {};
    if (!Array.isArray(this.lists[name])) this.lists[name] = [];
    return this.lists[name];
  },

  // 图表数据解析：接受数组 / 逗号分隔字符串（中英文逗号均可）
  parseNumList(raw) {
    if (Array.isArray(raw)) return raw.map(x => Number(x) || 0);
    return String(raw === undefined || raw === null ? '' : raw)
      .split(/[,，]/).map(s => s.trim()).filter(s => s !== '').map(s => Number(s) || 0);
  },

  parseStrList(raw) {
    if (Array.isArray(raw)) return raw.map(x => String(x));
    return String(raw === undefined || raw === null ? '' : raw)
      .split(/[,，]/).map(s => s.trim()).filter(s => s !== '');
  },

  boxOf(id) {
    const dom = Stage.elDom(id);
    if (!dom) return null;
    const r = dom.getBoundingClientRect();
    const root = Stage.rootEl.getBoundingClientRect();
    if (!root.width) return null;
    const k = 1920 / root.width;
    return { x: (r.left - root.left) * k, y: (r.top - root.top) * k, w: r.width * k, h: r.height * k };
  },

  async sleepAbort(ms, ctx) {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      if (ctx.aborted) return;
      await sleep(Math.min(100, ms - (performance.now() - t0)));
    }
  },

  async execFunc(name, ctx, args) {
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
    const outerArgs = ctx.args;
    ctx.args = args || null;
    try {
      await this.run(body || [], ctx);
      if (retExpr) return await this.evalExpr(retExpr, ctx);
    } finally {
      ctx.args = outerArgs;
      ctx._depth--;
    }
    return undefined;
  },

  // 求值调用实参并按函数定义绑定参数名（供带参函数用）
  async buildArgs(instr, ctx) {
    const fn = this.funcs && this.funcs[instr.name];
    if (!fn || !fn.params || !fn.params.length) return null;
    const vals = [];
    for (const a of (instr.args || [])) vals.push(await this.evalExpr(a, ctx));
    const obj = {};
    fn.params.forEach((p, i) => { obj[p] = vals[i] !== undefined ? vals[i] : 0; });
    return obj;
  },

  async evalExpr(e, ctx) {
    if (e === undefined || e === null) return undefined;
    switch (e.k) {
      case 'num': return e.v;
      case 'str': return e.v;
      case 'bool': return e.v;
      case 'var': return ctx.vars[e.name] !== undefined ? ctx.vars[e.name] : 0;
      case 'call': {
        const argObj = await this.buildArgs(e, ctx);
        return await this.execFunc(e.name, ctx, argObj);
      }
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
      case 'trig': {
        const tv = Number(await this.evalExpr(e.v, ctx)) || 0;
        const rad = tv * Math.PI / 180;
        switch (e.op) {
          case 'SIN': return Math.sin(rad);
          case 'COS': return Math.cos(rad);
          case 'TAN': return Math.tan(rad);
          case 'ASIN': return Math.asin(Math.max(-1, Math.min(1, tv))) * 180 / Math.PI;
          case 'ACOS': return Math.acos(Math.max(-1, Math.min(1, tv))) * 180 / Math.PI;
          case 'ATAN': return Math.atan(tv) * 180 / Math.PI;
          default: return 0;
        }
      }
      case 'bitwise': {
        const ba = Math.trunc(Number(await this.evalExpr(e.a, ctx)) || 0);
        const bb = Math.trunc(Number(await this.evalExpr(e.b, ctx)) || 0);
        if (e.op === 'and') return ba & bb;
        if (e.op === 'or') return ba | bb;
        return ba ^ bb;
      }
      case 'shift': {
        const sa = Math.trunc(Number(await this.evalExpr(e.a, ctx)) || 0);
        const sb = Math.trunc(Number(await this.evalExpr(e.b, ctx)) || 0);
        return e.op === 'shl' ? (sa << sb) : (sa >> sb);
      }
      case 'letter': {
        const lt = String(await this.evalExpr(e.text, ctx) ?? '');
        const ln = Math.trunc(Number(await this.evalExpr(e.n, ctx)) || 0);
        if (ln < 1 || ln > lt.length) return '';
        return lt[ln - 1];
      }
      case 'contains': {
        const ct = String(await this.evalExpr(e.text, ctx) ?? '');
        const cs = String(await this.evalExpr(e.sub, ctx) ?? '');
        return cs !== '' && ct.includes(cs);
      }
      case 'replace': {
        const rt = String(await this.evalExpr(e.text, ctx) ?? '');
        const rf = String(await this.evalExpr(e.from, ctx) ?? '');
        const rto = String(await this.evalExpr(e.to, ctx) ?? '');
        return rf === '' ? rt : rt.split(rf).join(rto);
      }
      case 'textcase': {
        const tc = String(await this.evalExpr(e.v, ctx) ?? '');
        return e.op === 'upper' ? tc.toUpperCase() : tc.toLowerCase();
      }
      case 'trim': return String(await this.evalExpr(e.v, ctx) ?? '').trim();
      case 'mouse': return e.axis === 'y' ? this.mouse.y : this.mouse.x;
      case 'mousedown': return !!this.mouse.down;
      case 'touch': {
        const aId = e.a === '@self' ? ctx.selfElId : e.a;
        if (!aId) return false;
        return this.checkTouch(aId, e.b);
      }
      case 'answer': return this.lastAnswer || '';
      case 'slider': {
        const sId = e.el === '@self' ? ctx.selfElId : e.el;
        if (!sId) return 0;
        return Elements.sliderValue(sId);
      }
      case 'chartclick': {
        const lc = this.lastChart || {};
        if (e.what === 'value') return lc.value !== undefined ? lc.value : 0;
        if (e.what === 'index') return (lc.dataIndex !== undefined ? lc.dataIndex : 0) + 1;
        if (e.what === 'series') return lc.seriesName || '';
        return lc.name !== undefined ? lc.name : '';
      }
      case 'argv': return (ctx.args && ctx.args[e.name] !== undefined) ? ctx.args[e.name] : 0;
      case 'datetime': {
        const d = new Date();
        const p2 = n => String(n).padStart(2, '0');
        switch (e.what) {
          case 'time': return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
          case 'date': return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
          case 'weekday': return '星期' + '日一二三四五六'[d.getDay()];
          case 'year': return d.getFullYear();
          case 'month': return d.getMonth() + 1;
          case 'day': return d.getDate();
          case 'hour': return d.getHours();
          case 'minute': return d.getMinutes();
          case 'second': return d.getSeconds();
          default: return '';
        }
      }
      case 'list.item': {
        const l = this.listOf(e.name);
        const i = Math.trunc(Number(await this.evalExpr(e.n, ctx)) || 0) - 1;
        return (i >= 0 && i < l.length) ? l[i] : '';
      }
      case 'list.len': return this.listOf(e.name).length;
      case 'list.contains': {
        const lv = await this.evalExpr(e.value, ctx);
        return this.listOf(e.name).some(x => String(x) === String(lv));
      }
      case 'list.indexOf': {
        const iv = await this.evalExpr(e.value, ctx);
        return this.listOf(e.name).findIndex(x => String(x) === String(iv)) + 1;
      }
      case 'list.join': {
        const sep = String(await this.evalExpr(e.sep, ctx) ?? '');
        return this.listOf(e.name).map(x => String(x)).join(sep);
      }
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
