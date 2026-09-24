// AI 接口桥：HTTP 请求 → 内部操作（挂 window 供 C++ runJavaScript 调用）
const ApiBridge = {
  async handle(req, id) {
    let res;
    try {
      const parts = String(req.path || '').replace(/^\/api\/?/, '').split('/').filter(Boolean);
      const method = String(req.method || 'GET').toUpperCase();
      const body = req.body || {};
      const r = await this.route(method, parts, body);
      if (r && r.__done) res = r;
      else res = { status: 200, body: { ok: true, data: r === undefined ? null : r } };
    } catch (e) {
      res = { status: 500, body: { ok: false, error: String((e && e.message) || e) } };
    }
    // 通过 QWebChannel 回传给 C++（runJavaScript 不支持 Promise）
    try {
      if (id && typeof App !== 'undefined' && App.host && App.host.apiResult) {
        App.host.apiResult(id, JSON.stringify(res));
      }
    } catch (e) { }
    return res;
  },

  err(status, msg) { return { __done: true, status, body: { ok: false, error: msg } }; },
  ok(data) { return { __done: true, status: 200, body: { ok: true, data: data === undefined ? null : data } }; },

  refreshUI(opts = {}) {
    const sc = Project.getScene(Stage.currentSceneId) || Project.data.scenes[0];
    Stage.render(sc);
    App.renderTabs();
    Panel.show();
    if (opts.blocks) {
      JimuBlocks.current = null;
      JimuBlocks.ws.clear();
      JimuBlocks.switchTo(App.activeTab || 'global');
    }
    App.markDirty(true);
  },

  async route(m, p, b) {
    const key = p.join('/');
    switch (key) {
      case 'status': return this.status();
      case 'help': return this.help();
      case 'project':
        if (m === 'GET') return this.projectGet();
        if (m === 'PUT') return this.projectPut(b);
        break;
      case 'project/new': return this.projectNew(b);
      case 'project/save': return this.projectSave(b);
      case 'project/open': return this.projectOpen(b);
      case 'global-blocks':
        if (m === 'PUT') return this.setBlocks(null, b);
        break;
      case 'scenes':
        if (m === 'GET') return this.scenesList();
        if (m === 'POST') return this.sceneAdd(b);
        break;
      case 'play':
        if (m === 'POST') return this.play(b);
        break;
      case 'play/stop':
        if (m === 'POST') return this.stop();
        break;
      case 'resources':
        if (m === 'POST') return this.resourceAdd(b);
        break;
      case 'export':
        if (m === 'POST') return this.exportPlayer(b);
        break;
    }
    if (p[0] === 'scenes' && p.length === 2) {
      if (m === 'GET') return this.sceneGet(p[1]);
      if (m === 'PATCH') return this.scenePatch(p[1], b);
      if (m === 'DELETE') return this.sceneDelete(p[1]);
    }
    if (p[0] === 'scenes' && p.length === 3) {
      if (p[2] === 'elements' && m === 'GET') return this.sceneElements(p[1]);
      if (p[2] === 'blocks' && m === 'PUT') return this.setBlocks(p[1], b);
    }
    if (p[0] === 'elements') {
      if (p.length === 1 && m === 'POST') return this.elementAdd(b);
      if (p.length === 2 && m === 'PATCH') return this.elementPatch(p[1], b);
      if (p.length === 2 && m === 'DELETE') return this.elementDelete(p[1]);
      if (p.length === 3 && p[2] === 'animate' && m === 'POST') return this.elementAnimate(p[1], b);
      if (p.length === 3 && p[2] === 'keyframes' && m === 'PUT') return this.elementKeyframes(p[1], b);
    }
    return this.err(404, '未知端点: ' + key);
  },

  // ---------- 基础 ----------
  status() {
    return this.ok({
      app: 'jimuchang',
      version: '0.1.0',
      playing: App.playing,
      project: {
        name: Project.data.name,
        path: Project.filePath,
        scenes: Project.data.scenes.length,
        resources: Project.data.resources.length,
        dirty: App.dirty
      },
      currentScene: (() => { const s = Stage.currentScene(); return s ? { id: s.id, name: s.name } : null; })()
    });
  },

  help() {
    return this.ok({
      note: '积木剧场本地 API。鉴权：Authorization: Bearer <token>（~/.config/jimuchang/api.json）',
      endpoints: [
        'GET  /api/status',
        'GET  /api/project | PUT /api/project {project}',
        'POST /api/project/new {name?}',
        'POST /api/project/save {path?}',
        'POST /api/project/open {path}',
        'GET  /api/scenes | POST /api/scenes {name?}',
        'GET  /api/scenes/:id | PATCH /api/scenes/:id {…} | DELETE /api/scenes/:id',
        'GET  /api/scenes/:id/elements',
        'POST /api/elements {sceneId, type, name?, x?, y?, w?, h?, props?}',
        'PATCH /api/elements/:id {…任意字段} | DELETE /api/elements/:id',
        'POST /api/elements/:id/animate {type, duration?, delay?, easing?}',
        'PUT  /api/elements/:id/keyframes {duration, loop, tracks}',
        'PUT  /api/scenes/:id/blocks {blocks} | PUT /api/global-blocks {blocks}',
        'POST /api/resources {name, mime?, base64}',
        'POST /api/play {mode?} | POST /api/play/stop',
        'GET  /api/screenshot  → {png: base64}'
      ]
    });
  },

  // ---------- 项目 ----------
  projectGet() {
    const d = JSON.parse(JSON.stringify(Object.assign({}, Project.data, { resources: [] })));
    d.resources = Project.data.resources.map(r => ({
      id: r.id, name: r.name, mime: r.mime, path: r.path, size: r.size, hasData: !!r.data
    }));
    return this.ok(d);
  },

  projectPut(b) {
    const data = b.project || b.data || b;
    if (!data || data.format !== 'jimuchang-project') return this.err(400, '缺少合法的 project（format=jimuchang-project）');
    // 保留同名资源数据
    const map = new Map(Project.data.resources.map(r => [r.id, r]));
    (data.resources || []).forEach(r => {
      const old = map.get(r.id);
      if (old && old.data) r.data = old.data;
      if (!r.data) r.data = '';
    });
    Project.data = data;
    JimuBlocks.current = null;
    JimuBlocks.ws.clear();
    this.refreshUI({ blocks: true });
    History.reset();
    return this.ok({ scenes: data.scenes.length, resources: data.resources.length });
  },

  projectNew(b) {
    JimuBlocks.current = null;
    JimuBlocks.ws.clear();
    Project.newProject((b && b.name) || '未命名演示');
    this.refreshUI({ blocks: true });
    History.reset();
    return this.ok({ name: Project.data.name });
  },

  async projectSave(b) {
    JimuBlocks.save();
    const base64 = await Project.pack();
    const path = (b && b.path) || Project.filePath;
    if (!path) return this.err(400, '未指定保存路径，且项目未保存过');
    const ok = await App.host.saveProjectDirect(path, base64);
    if (!ok) return this.err(500, '写文件失败：' + path);
    Project.filePath = path;
    App.clearDirty();
    try { await App.host.addRecentFile(path); } catch (e) { console.warn('记录最近文件失败:', e.message || e); }
    return this.ok({ path, bytes: Math.round(base64.length * 0.75) });
  },

  async projectOpen(b) {
    if (!b || !b.path) return this.err(400, '缺少 path');
    const r = await App.host.readProjectFile(b.path);
    if (!r || !r.base64) return this.err(404, '读不到文件：' + b.path);
    await Project.unpack(r.base64);
    Project.filePath = b.path;
    JimuBlocks.current = null;
    JimuBlocks.ws.clear();
    this.refreshUI({ blocks: true });
    History.reset();
    return this.ok({ path: b.path, scenes: Project.data.scenes.length, resources: Project.data.resources.length });
  },

  // ---------- 场景 ----------
  scenesList() {
    return this.ok(Project.data.scenes.map(s => ({
      id: s.id, name: s.name, elements: s.elements.length, fx: (s.fx && s.fx.type) || null
    })));
  },

  sceneGet(id) {
    const sc = Project.getScene(id);
    if (!sc) return this.err(404, '场景不存在: ' + id);
    return this.ok(sc);
  },

  sceneAdd(b) {
    const sc = Project.addScene((b && b.name) || undefined);
    this.refreshUI();
    return this.ok({ id: sc.id, name: sc.name });
  },

  scenePatch(id, b) {
    const sc = Project.getScene(id);
    if (!sc) return this.err(404, '场景不存在: ' + id);
    ['name', 'background', 'transition', 'fx'].forEach(k => {
      if (b[k] !== undefined) sc[k] = b[k];
    });
    this.refreshUI();
    return this.ok({ id, name: sc.name });
  },

  sceneDelete(id) {
    if (Project.data.scenes.length <= 1) return this.err(400, '至少保留一个场景');
    const ok = Project.removeScene(id);
    if (!ok) return this.err(404, '场景不存在: ' + id);
    if (Stage.currentSceneId === id) Stage.currentSceneId = Project.data.scenes[0].id;
    this.refreshUI({ blocks: true });
    return this.ok({ deleted: id });
  },

  sceneElements(id) {
    const sc = Project.getScene(id);
    if (!sc) return this.err(404, '场景不存在: ' + id);
    return this.ok(sc.elements.map(e => ({
      id: e.id, type: e.type, name: e.name, x: e.x, y: e.y, w: e.w, h: e.h,
      visible: e.visible, props: e.props
    })));
  },

  // ---------- 元素 ----------
  elementAdd(b) {
    const sc = Project.getScene(b.sceneId || Stage.currentSceneId);
    if (!sc) return this.err(400, '缺少 sceneId 或场景不存在');
    if (!b.type) return this.err(400, '缺少 type');
    const el = Project.createElement(sc, b.type, {
      name: b.name, x: b.x, y: b.y, w: b.w, h: b.h, props: b.props
    });
    if (b.entrance) el.entrance = b.entrance;
    if (b.effects) el.effects = b.effects;
    if (b.keyframes) el.keyframes = b.keyframes;
    this.refreshUI();
    return this.ok({ id: el.id, name: el.name, type: el.type });
  },

  elementPatch(id, b) {
    const f = Project.findElementById(id);
    if (!f) return this.err(404, '元素不存在: ' + id);
    const el = f.element;
    ['name', 'x', 'y', 'w', 'h', 'rotation', 'opacity', 'z', 'locked', 'visible', 'entrance', 'exit', 'effects', 'keyframes'].forEach(k => {
      if (b[k] !== undefined) el[k] = b[k];
    });
    if (b.props) el.props = Object.assign({}, el.props, b.props);
    this.refreshUI();
    return this.ok({ id, name: el.name });
  },

  elementDelete(id) {
    const f = Project.findElementById(id);
    if (!f) return this.err(404, '元素不存在: ' + id);
    Project.removeElement(f.scene, id);
    if (Editor.selectedId === id) Editor.select(null);
    this.refreshUI();
    return this.ok({ deleted: id });
  },

  async elementAnimate(id, b) {
    const f = Project.findElementById(id);
    if (!f) return this.err(404, '元素不存在: ' + id);
    const dom = Stage.elDom(id);
    if (!dom) return this.err(409, '元素不在当前场景中，请先切换场景');
    if (!b || !b.type) return this.err(400, '缺少 type（动画类型）');
    Anim.play(f.element, dom, b.type, { duration: b.duration, delay: b.delay, easing: b.easing });
    return this.ok({ playing: b.type });
  },

  elementKeyframes(id, b) {
    const f = Project.findElementById(id);
    if (!f) return this.err(404, '元素不存在: ' + id);
    f.element.keyframes = {
      duration: b.duration !== undefined ? b.duration : 3,
      loop: !!b.loop,
      tracks: b.tracks || {}
    };
    Keyframes.ensure(f.element);
    App.markDirty(true);
    return this.ok({ duration: f.element.keyframes.duration });
  },

  setBlocks(sceneId, b) {
    const blocks = b.blocks !== undefined ? b.blocks : (b.workspace || b);
    if (sceneId === null) {
      Project.data.globalBlocks = blocks;
    } else {
      const sc = Project.getScene(sceneId);
      if (!sc) return this.err(404, '场景不存在: ' + sceneId);
      sc.blocks = blocks;
    }
    JimuBlocks.current = null;
    JimuBlocks.ws.clear();
    JimuBlocks.switchTo(App.activeTab || 'global');
    App.markDirty(true);
    return this.ok({ saved: true });
  },

  async exportPlayer(b) {
    if (!b || !b.path) return this.err(400, '需要 {path}（导出 .html 的目标路径）');
    const p = await App.exportPlayerTo(b.path);
    if (!p) return this.err(500, '导出失败');
    return this.ok({ path: p });
  },

  // ---------- 资源 ----------
  resourceAdd(b) {
    if (!b || !b.name || !b.base64) return this.err(400, '需要 {name, base64}');
    const res = Project.addResource(b.name, b.mime || 'application/octet-stream', b.base64);
    return this.ok({ id: res.id, name: res.name, size: res.size });
  },

  // ---------- 播放 ----------
  async play(b) {
    if (App.playing) return this.err(409, '已在播放中');
    App.play();
    return this.ok({ playing: true });
  },

  stop() {
    if (!App.playing) return this.ok({ playing: false });
    App.stop();
    return this.ok({ playing: false });
  }
};

window.ApiBridge = ApiBridge;
