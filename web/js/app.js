// 主控：UI 绑定、标签页、播放、存取、示例
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2000);
}

// Blockly 序列化链式构造小工具
const blk = (type, fields, next, inputs) => {
  const o = { type };
  if (fields) o.fields = fields;
  if (inputs) o.inputs = inputs;
  if (next) o.next = { block: next };
  return o;
};

const App = {
  host: null,
  hostReady: null,
  playing: false,
  dirty: false,
  activeTab: 'global',

  async init() {
    this.hostReady = new Promise(resolve => {
      try {
        new QWebChannel(qt.webChannelTransport, ch => {
          this.host = ch.objects.host;
          resolve();
        });
      } catch (e) { resolve(); }
    });

    Project.newProject('积木剧场演示');
    this.buildDemo();

    Stage.init(document.getElementById('stage-wrap'));
    Editor.init(Stage.rootEl);
    Panel.init(document.getElementById('props'));
    Keyframes.initPanel();
    await JimuBlocks.init('blocklyDiv');

    Editor.rootEl.addEventListener('click', e => {
      if (!this.playing) return;
      const elDom = e.target.closest('.el');
      if (elDom) Executor.trigger('onElementClick', elDom.dataset.id);
    });
    Executor.hooks.onSceneEnter = id => this.playEntrances(id);

    this.bindUI();
    this.renderTabs();
    this.switchTab(Project.data.scenes[0].id);
    let savedTheme = 'dark';
    try { savedTheme = localStorage.getItem('jimuchang-theme') || 'dark'; } catch (e) { }
    this.applyTheme(savedTheme);
    History.reset();

    await this.hostReady;
    if (this.host) {
      try { await this.host.setTitle('积木剧场 · ' + Project.data.name); } catch (e) { }
    }

    // 自动化测试钩子：--test-save / --test-open / --test-play
    const params = new URLSearchParams(location.search);
    const testSave = params.get('testsave');
    if (testSave && this.host) {
      try {
        const b64 = await Project.pack();
        const ok = await this.host.saveProjectDirect(testSave, b64);
        console.log(`P1TEST|save|${ok}|${b64.length}`);
        const back = await this.host.readFileBase64(testSave);
        console.log(`P1TEST|read|${back ? back.length : 0}`);
        const data = await Project.unpack(back);
        const txt = data.scenes[0].elements.find(e => e.type === 'text');
        console.log(`P1TEST|unpack|${data.scenes.length}s ${data.resources.length}r text=${txt ? txt.props.text : 'none'}`);
        const same = back && back.length === b64.length;
        console.log(same ? 'P1TEST|PASS' : 'P1TEST|FAIL');
      } catch (e) {
        console.log('P1TEST|error|' + e.message);
      }
    }
    const testOpen = params.get('testopen');
    if (testOpen && this.host) {
      try {
        const r = await this.host.readProjectFile(testOpen);
        await Project.unpack(r.base64);
        JimuBlocks.ws.clear();
        JimuBlocks.current = null;
        Stage.render(Project.data.scenes[0]);
        this.activeTab = 'global';
        JimuBlocks.switchTo('global');
        this.renderTabs();
        console.log(`P1TEST|open|${Project.data.scenes.length}s ${Project.data.resources.length}r`);
      } catch (e) {
        console.log('P1TEST|openerror|' + e.message);
      }
    }
    if (params.get('testhome') === '1') {
      await sleep(400);
      this.showHome();
      await sleep(600);
      const n = document.querySelectorAll('#home-recent .home-recent-item').length;
      console.log('P7TEST|home|recent=' + n);
    }
    if (params.get('testtheme') === 'light') {
      this.applyTheme('light');
      console.log('P7TEST|theme|light');
    }
    if (params.get('testppt') === '1') {
      await sleep(800);
      try {
        console.log('PTTEST|gen|start');
        const b64 = await PptxExport.generate({ mode: 'editable' });
        const ok = await this.host.saveProjectDirect('/tmp/test_export.pptx', b64);
        console.log('PTTEST|save|' + ok + '|' + b64.length);
      } catch (e) {
        console.log('PTTEST|error|' + (e.message || e));
      }
    }
    if (params.get('testmenu') === '1') {
      await sleep(600);
      const dd2 = document.querySelector('.tb-dropdown');
      const ddR = dd2.getBoundingClientRect();
      dd2.classList.add('open');
      await sleep(300);
      const mR = dd2.querySelector('.tb-menu').getBoundingClientRect();
      console.log('DBG|dd=' + JSON.stringify({ x: Math.round(ddR.x), y: Math.round(ddR.y), w: Math.round(ddR.width) })
        + '|menu=' + JSON.stringify({ x: Math.round(mR.x), y: Math.round(mR.y), w: Math.round(mR.width), h: Math.round(mR.height) }));
    }
    if (params.get('testhelp') === '1') {
      await sleep(500);
      this.toggleHelp();
      console.log('P7TEST|help|opened');
    }
    if (params.get('testguides') === '1') {
      await sleep(500);
      const scene = Stage.currentScene();
      const txts = scene.elements.filter(e => e.type === 'text');
      if (txts.length >= 2) {
        const el = txts[0], other = txts[1];
        el.x = other.x + 4;
        el.y = other.y + 2;
        const snap = Editor.computeSnap(el, scene);
        console.log('P7TEST|snap|dx=' + snap.dx.toFixed(1) + ' dy=' + snap.dy.toFixed(1) + ' lineV=' + snap.lineV + ' lineH=' + snap.lineH);
        Stage.render(scene);
        Editor.select(el.id);
        Editor.drawGuides(snap.lineV, snap.lineH);
        console.log('P7TEST|guides|drawn');
      } else {
        console.log('P7TEST|guides|元素不足');
      }
    }
    if (params.get('testkf') === '1') {
      await sleep(500);
      try {
        const scene = Stage.currentScene();
        const el = scene.elements.find(e => e.type === 'text');
        if (!el) { console.log('KFTEST|no element'); return; }
        Editor.select(el.id);
        Keyframes.open();
        Keyframes.addDot('x', 0);
        Keyframes.addDot('x', 2);
        Keyframes.selected = { key: 'x', index: 1 };
        Keyframes.editSelected('v', el.x + 500);
        Keyframes.addDot('y', 0);
        Keyframes.addDot('y', 2);
        Keyframes.selected = { key: 'y', index: 1 };
        Keyframes.editSelected('v', el.y + 200);
        Keyframes.addDot('opacity', 0);
        Keyframes.addDot('opacity', 1);
        Keyframes.addDot('opacity', 2);
        Keyframes.selected = { key: 'opacity', index: 1 };
        Keyframes.editSelected('v', 0.15);
        console.log('KFTEST|dots|x=' + el.keyframes.tracks.x.length + ' y=' + el.keyframes.tracks.y.length + ' op=' + el.keyframes.tracks.opacity.length);
        console.log('KFTEST|sample@1s|x=' + Keyframes.sampleTrack(el.keyframes.tracks.x, 1).toFixed(1) + ' op=' + Keyframes.sampleTrack(el.keyframes.tracks.opacity, 1).toFixed(2));
        console.log('KFTEST|panel|dots=' + document.querySelectorAll('#kf-overlay .kf-dot').length);
        await sleep(300);
        Keyframes.preview();
        console.log('KFTEST|play|started');
      } catch (e) {
        console.log('KFTEST|error|' + e.message);
      }
    }
    if (params.get('testplay') === '1') {
      await sleep(900);
      console.log('P1TEST|play|start');
      this.play();
    }
  },

  bindUI() {
    const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
    on('btn-new', () => this.newProject());
    on('btn-open', () => this.open());
    on('btn-save', () => this.save());
    on('btn-undo', () => History.undo());
    on('btn-redo', () => History.redo());
    on('btn-play', () => this.play());
    on('btn-demo', () => this.loadDemo());
    on('btn-add-text', () => Editor.addElement('text'));
    on('btn-add-image', () => this.addMediaElement('image'));
    on('btn-add-video', () => this.addMediaElement('video'));
    on('btn-add-audio', () => this.addMediaElement('audio'));
    on('btn-add-shape', () => Editor.addElement('shape'));
    on('btn-add-icon', () => Editor.addElement('icon'));
    on('btn-add-chart', () => Editor.addElement('chart'));
    on('btn-add-sprite', () => Editor.addElement('sprite'));
    on('btn-add-model3d', () => Editor.addElement('model3d'));
    on('btn-add-webapp', () => Editor.addElement('webapp'));
    on('btn-export', () => this.exportPlayer());
    on('btn-export-ppt', () => this.showPptDialog());
    on('ppt-generate', () => this.generatePpt());
    on('btn-restore-autosave', () => this.restoreAutosave());
    on('btn-help', () => this.toggleHelp());
    on('btn-theme', () => this.toggleTheme());
    on('btn-home', () => this.showHome());
    on('home-new', () => { document.getElementById('home-overlay').classList.add('hidden'); this.newProject(); });
    on('home-demo', () => { document.getElementById('home-overlay').classList.add('hidden'); this.loadDemo(); });
    on('home-open', () => { document.getElementById('home-overlay').classList.add('hidden'); this.open(); });
    // 自动保存：每 2 分钟（有修改且不在播放时）
    setInterval(() => this.autoSave(), 120000);
    // "更多"下拉菜单：JS 控制 + 延迟关闭（划过间隙不消失）
    const dd = document.querySelector('.tb-dropdown');
    if (dd) {
      let hideTimer = 0;
      dd.addEventListener('mouseenter', () => { clearTimeout(hideTimer); dd.classList.add('open'); });
      dd.addEventListener('mouseleave', () => {
        hideTimer = setTimeout(() => dd.classList.remove('open'), 280);
      });
      dd.querySelector('.tb-menu').addEventListener('click', e => {
        if (e.target.closest('button')) dd.classList.remove('open');
      });
    }
    document.addEventListener('keydown', e => this.onKeyDown(e));
    window.addEventListener('mousemove', () => {
      if (!this.playing) return;
      document.body.classList.remove('hide-cursor');
      this.armCursorHide();
    });
  },

  applyTheme(mode) {
    this.themeMode = mode;
    document.body.classList.toggle('light', mode === 'light');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = mode === 'light' ? '🌙' : '☀';
    JimuBlocks.setTheme(mode);
    try { localStorage.setItem('jimuchang-theme', mode); } catch (e) { }
  },

  toggleTheme() {
    this.applyTheme(this.themeMode === 'light' ? 'dark' : 'light');
  },

  markDirty(noCapture) {
    this.dirty = true;
    const t = document.getElementById('dirty-dot');
    if (t) t.classList.add('on');
    if (this.host) this.hostReady.then(() => this.host.setDirty(true)).catch(() => { });
    if (!noCapture) History.capture();
  },
  clearDirty() {
    this.dirty = false;
    const t = document.getElementById('dirty-dot');
    if (t) t.classList.remove('on');
    if (this.host) this.hostReady.then(() => this.host.setDirty(false)).catch(() => { });
  },

  updateHistoryButtons() {
    const u = document.getElementById('btn-undo');
    const r = document.getElementById('btn-redo');
    if (u) u.disabled = !History.canUndo();
    if (r) r.disabled = !History.canRedo();
  },

  // ---------- 标签页 ----------
  renderTabs() {
    const box = document.getElementById('scene-tabs');
    const active = this.activeTab;
    let html = `<div class="tab${active === 'global' ? ' active' : ''}" data-key="global" title="全局脚本">全局</div>`;
    Project.data.scenes.forEach(s => {
      html += `<div class="tab${active === s.id ? ' active' : ''}" data-key="${s.id}">${esc(s.name)}</div>`;
    });
    html += `<button id="btn-add-scene" title="新建场景">＋</button>`;
    html += `<div class="spacer"></div><button id="btn-del-scene" class="tab-del" title="删除当前场景">删除场景</button>`;
    box.innerHTML = html;
    box.querySelectorAll('.tab').forEach(t => {
      t.onclick = () => this.switchTab(t.dataset.key);
      t.oncontextmenu = (e) => {
        e.preventDefault();
        if (t.dataset.key === 'global') return;
        const sc = Project.getScene(t.dataset.key);
        if (!sc) return;
        ContextMenu.show(e.clientX, e.clientY, [
          { label: '重命名…', action: () => { const n = prompt('场景名称', sc.name); if (n) { sc.name = n; this.renderTabs(); Panel.show(); this.markDirty(); } } },
          { label: '复制场景', action: () => this.copyScene(sc.id) },
          { type: 'sep' },
          { label: '删除场景', danger: true, action: () => { this.activeTab = sc.id; this.deleteScene(); } }
        ]);
      };
    });
    box.querySelector('#btn-add-scene').onclick = () => {
      JimuBlocks.save();
      const sc = Project.addScene();
      this.renderTabs();
      this.switchTab(sc.id);
      this.markDirty();
    };
    const del = box.querySelector('#btn-del-scene');
    if (del) del.onclick = () => this.deleteScene();
  },

  switchTab(key) {
    if (key !== 'global' && !Project.getScene(key)) return;
    JimuBlocks.switchTo(key);
    this.activeTab = key;
    if (key !== 'global') {
      const sc = Project.getScene(key);
      if (sc) { Stage.render(sc); Editor.select(null); Panel.show(); }
    }
    this.renderTabs();
  },

  copyScene(id) {
    const sc = Project.getScene(id);
    if (!sc) return;
    const copy = JSON.parse(JSON.stringify(sc));
    copy.id = Project.uid('scene');
    copy.name = sc.name + ' 副本';
    copy.elements.forEach(el => { el.id = Project.uid('el'); });
    copy.blocks = null;  // 脚本引用旧元素 id，不复制
    const idx = Project.data.scenes.indexOf(sc);
    Project.data.scenes.splice(idx + 1, 0, copy);
    this.renderTabs();
    this.switchTab(copy.id);
    this.markDirty();
    toast('已复制场景（积木脚本未复制）');
  },

  deleteScene() {
    if (this.activeTab === 'global') { toast('先切换到一个场景再删除'); return; }
    if (Project.data.scenes.length <= 1) { toast('至少保留一个场景'); return; }
    const sc = Project.getScene(this.activeTab);
    if (!sc || !confirm(`删除场景「${sc.name}」？`)) return;
    JimuBlocks.switchTo('global');
    Project.removeScene(sc.id);
    this.activeTab = 'global';
    Stage.render(Project.data.scenes[0]);
    this.renderTabs();
    JimuBlocks.switchTo('global');
    Panel.show();
    this.markDirty();
  },

  // ---------- 元素 ----------
  async addMediaElement(kind) {
    if (!this.host) { toast('浏览器预览模式无法导入素材'); return; }
    await this.hostReady;
    const r = await this.host.importResource(kind);
    if (!r || !r.base64) return;
    const mimeFallback = { image: 'image/png', video: 'video/mp4', audio: 'audio/mpeg', model: 'model/gltf-binary', webapp: 'text/html' }[kind] || 'application/octet-stream';
    const res = Project.addResource(r.name, r.mime || mimeFallback, r.base64);
    const scene = Stage.currentScene();
    const el = Project.createElement(scene, kind, { props: { resourceId: res.id } });
    Stage.refreshAll();
    Editor.select(el.id);
    this.markDirty();
  },

  async pickMediaForSelected(kind) {
    const sel = Editor.selected();
    if (!sel || !this.host) return;
    await this.hostReady;
    const r = await this.host.importResource(kind);
    if (!r || !r.base64) return;
    const mimeFallback = { image: 'image/png', video: 'video/mp4', audio: 'audio/mpeg', model: 'model/gltf-binary', webapp: 'text/html' }[kind] || 'application/octet-stream';
    const res = Project.addResource(r.name, r.mime || mimeFallback, r.base64);
    sel.element.props.resourceId = res.id;
    Stage.refreshAll();
    Panel.show();
    this.markDirty();
  },

  // ---------- 导出放映包 ----------
  async buildPlayerHtml() {
    JimuBlocks.save();
    const scripts = Executor.compileAll();
    const projectData = JSON.parse(JSON.stringify(Project.data));
    const has3d = projectData.scenes.some(sc => sc.elements.some(e => e.type === 'model3d'));
    const files = ['easing.js', 'project.js', 'audio.js', 'effects.js', 'sprites.js', 'three-scene.js',
      'elements.js', 'stage.js', 'animations.js', 'keyframes.js', 'executor.js',
      'jimu-api.js', 'player.js'];
    const readSrc = async qrcPath => {
      const b64 = await this.host.readFileBase64(qrcPath);
      if (!b64) return '';
      try { return decodeURIComponent(escape(atob(b64))); } catch (e) { return atob(b64); }
    };
    let runtime = '';
    for (const f of files) runtime += (await readSrc(':/js/' + f)) + '\n;\n';
    const css = await readSrc(':/css/app.css');
    let three = null;
    if (has3d && this.host) {
      three = {
        core: await this.host.readFileBase64(':/vendor/three/three.core.js'),
        module: await this.host.readFileBase64(':/vendor/three/three.module.js'),
        geometryUtils: await this.host.readFileBase64(':/vendor/three/BufferGeometryUtils.js'),
        skeletonUtils: await this.host.readFileBase64(':/vendor/three/SkeletonUtils.js'),
        loader: await this.host.readFileBase64(':/vendor/three/GLTFLoader.js')
      };
    }
    const needBuiltin = projectData.scenes.some(sc => sc.elements.some(e =>
      e.type === 'model3d' && (!e.props.resourceId || e.props.resourceId === 'builtin:robot')));
    const builtinRobot = needBuiltin ? await this.host.readFileBase64(':/assets/models/RobotExpressive.glb') : null;
    const data = { project: projectData, scripts, three, builtinRobot };
    const title = (projectData.name || '积木剧场演示') + ' · 放映';
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
${css}
html, body { height: 100%; overflow: hidden; }
</style>
</head>
<body class="playing">
<div id="stage-wrap"></div>
<div id="play-hint">空格 推进 · ← → 切场景 · 双击全屏 · Esc 退出全屏</div>
<script>
${runtime}
<\/script>
<script>
window.__JC_PLAYER_DATA__ = ${JSON.stringify(data)};
<\/script>
</body>
</html>`;
  },

  async exportPlayer() {
    if (!this.host) { toast('浏览器预览模式无法导出'); return; }
    await this.hostReady;
    toast('正在打包放映包…');
    const html = await this.buildPlayerHtml();
    const b64 = btoa(unescape(encodeURIComponent(html)));
    const path = await this.host.exportHtml(b64, (Project.data.name || '未命名演示') + '-放映机.html');
    if (path) toast('已导出：' + path.split('/').pop() + '（双击用浏览器打开）');
    return path;
  },

  async exportPlayerTo(path) {
    if (!path) return this.exportPlayer();
    const html = await this.buildPlayerHtml();
    const b64 = btoa(unescape(encodeURIComponent(html)));
    const ok = await this.host.saveProjectDirect(path, b64);
    return ok ? path : '';
  },

  async pickFramesForSelected() {
    const sel = Editor.selected();
    if (!sel || !this.host) return;
    await this.hostReady;
    const list = await this.host.importResourceMulti('image');
    if (!list || !list.length) return;
    const ids = [];
    for (const r of list) {
      const res = Project.addResource(r.name, r.mime || 'image/png', r.base64);
      ids.push(res.id);
    }
    sel.element.props.kind = 'frames';
    sel.element.props.frames = ids;
    Stage.refreshAll();
    Panel.show();
    this.markDirty();
  },

  // ---------- 播放 ----------
  async play() {
    if (this.playing) return;
    JimuBlocks.save();
    this.playing = true;
    // 播放使用数据快照：脚本运行时的修改（文字/位置/显隐）不会污染项目原数据
    this._dataBackup = Project.data;
    Project.data = this.cloneForPlayback(Project.data);
    document.body.classList.add('playing');
    const hint = document.getElementById('play-hint');
    hint.style.transition = 'opacity 1s';
    hint.style.opacity = '1';
    setTimeout(() => { if (this.playing) hint.style.opacity = '0'; }, 6000);
    this.armCursorHide();
    if (this.host) await this.host.setFullscreen(true);
    await sleep(120);
    Stage.fit();
    Editor.select(null);
    try {
      await Executor.start();
      const n = Executor.scripts.orphans || 0;
      if (n > 0) toast(`有 ${n} 段积木没有"当…"事件开头，不会执行`);
    } catch (e) {
      console.error('播放出错', e);
    }
  },

  cloneForPlayback(data) {
    const clone = JSON.parse(JSON.stringify(Object.assign({}, data, { resources: [] })));
    clone.resources = data.resources;
    return clone;
  },

  stop() {
    if (!this.playing) return;
    this.playing = false;
    document.body.classList.remove('playing');
    const hint = document.getElementById('play-hint');
    if (hint) { hint.style.opacity = ''; }
    clearTimeout(this._cursorTimer);
    document.body.classList.remove('hide-cursor');
    Executor.stop();
    AudioMgr.stopAll();
    if (this._dataBackup) {
      Project.data = this._dataBackup;
      this._dataBackup = null;
    }
    if (this.host) this.host.setFullscreen(false);
    const sc = Project.getScene(Stage.currentSceneId) || Project.data.scenes[0];
    Stage.render(sc);
    Editor.select(null);
    Panel.show();
    setTimeout(() => {
      Stage.fit();
      try { Blockly.svgResize(JimuBlocks.ws); } catch (e) { }
    }, 120);
    this.renderTabs();
  },

  armCursorHide() {
    clearTimeout(this._cursorTimer);
    this._cursorTimer = setTimeout(() => {
      if (this.playing) document.body.classList.add('hide-cursor');
    }, 2500);
  },

  playEntrances(sceneId) {
    const sc = Project.getScene(sceneId);
    if (!sc) return;
    AudioMgr.stopLoopSfx();
    sc.elements.forEach(el => {
      if (!el.visible) return;
      const dom = Stage.elDom(el.id);
      // 音频元素：进场景自动播放
      if (el.type === 'audio' && el.props.autoplay && el.props.resourceId) {
        const url = Project.resourceUrl(el.props.resourceId);
        const vol = el.props.volume !== undefined ? el.props.volume : 1;
        if (el.props.loop) AudioMgr.playLoopSfx(url, vol);
        else AudioMgr.sfx(url, vol);
      }
      // 视频元素：进场景自动播放
      if (el.type === 'video' && el.props.autoplay && dom) {
        const v = dom.querySelector('video');
        if (v) v.play().catch(() => { });
      }
      // 元素预设入场动画
      if (!el.entrance || el.entrance.type === 'none') return;
      if (dom) Anim.play(el, dom, el.entrance.type, el.entrance);
    });
  },

  async nextScene() {
    const i = Project.sceneIndex(Stage.currentSceneId);
    const next = Project.data.scenes[i + 1];
    if (next) await Stage.goScene(next.id);
  },

  // ---------- 存取 ----------
  async save() {
    JimuBlocks.save();
    if (!this.host) { toast('浏览器预览模式无法保存'); return; }
    await this.hostReady;
    const base64 = await Project.pack();
    const path = await this.host.saveProject(base64, (Project.data.name || '未命名演示') + '.bdp');
    if (path) {
      Project.filePath = path;
      this.clearDirty();
      try { await this.host.addRecentFile(path); } catch (e) { console.warn("记录最近文件失败:", e.message || e); }
      toast('已保存：' + path.split('/').pop());
    }
  },

  showPptDialog() {
    document.getElementById('ppt-overlay').classList.remove('hidden');
  },

  async generatePpt() {
    if (!this.host) { toast('浏览器预览模式无法导出'); return; }
    await this.hostReady;
    const btn = document.getElementById('ppt-generate');
    const mode = document.querySelector('input[name="ppt-mode"]:checked').value;
    btn.disabled = true;
    btn.textContent = '生成中…';
    try {
      const b64 = await PptxExport.generate({ mode });
      const name = (Project.data.name || '未命名演示') + '.pptx';
      const path = await this.host.exportPptx(b64, name);
      if (path) {
        toast('已导出：' + path.split('/').pop() + '（可用 WPS/PowerPoint 打开）');
        document.getElementById('ppt-overlay').classList.add('hidden');
      }
    } catch (e) {
      console.error('PPT 导出失败', e);
      toast('导出失败：' + (e.message || e));
    } finally {
      btn.disabled = false;
      btn.textContent = '生成 PPT';
    }
  },

  async restoreAutosave() {
    if (!this.host) { toast('浏览器预览模式不可用'); return; }
    await this.hostReady;
    try {
      const path = await this.host.autosavePath();
      const r = await this.host.readProjectFile(path);
      if (!r || !r.base64) { toast('没有自动保存文件'); return; }
      if (this.dirty && !confirm('当前项目有未保存修改，仍要用自动保存内容替换吗？')) return;
      await Project.unpack(r.base64);
      Project.filePath = null;
      JimuBlocks.current = null;
      JimuBlocks.ws.clear();
      Stage.render(Project.data.scenes[0]);
      this.activeTab = 'global';
      JimuBlocks.switchTo('global');
      this.renderTabs();
      Panel.show();
      this.markDirty(true);
      History.reset();
      toast('已恢复自动保存内容');
    } catch (e) {
      toast('恢复失败：' + e.message);
    }
  },

  async showHome() {
    document.getElementById('home-overlay').classList.remove('hidden');
    const box = document.getElementById('home-recent');
    if (!this.host) { box.innerHTML = '<div class="help-dim">浏览器预览模式无最近文件</div>'; return; }
    await this.hostReady;
    try {
      const list = await this.host.recentFiles();
      if (!list || !list.length) {
        box.innerHTML = '<div class="help-dim">还没有最近文件</div>';
        return;
      }
      box.innerHTML = list.map(p =>
        `<div class="home-recent-item" data-path="${esc(p)}">
          <b>${esc(String(p).split('/').pop())}</b>
          <span>${esc(p)}</span>
        </div>`).join('');
      box.querySelectorAll('.home-recent-item').forEach(n => {
        n.onclick = () => this.openRecent(n.dataset.path);
      });
    } catch (e) {
      box.innerHTML = '<div class="help-dim">读取最近文件失败</div>';
    }
  },

  async openRecent(path) {
    try {
      const r = await this.host.readProjectFile(path);
      if (!r || !r.base64) { toast('读不到文件：' + path); return; }
      await Project.unpack(r.base64);
      Project.filePath = path;
      JimuBlocks.current = null;
      JimuBlocks.ws.clear();
      Stage.render(Project.data.scenes[0]);
      this.activeTab = 'global';
      JimuBlocks.switchTo('global');
      this.renderTabs();
      Panel.show();
      this.clearDirty();
      History.reset();
      document.getElementById('home-overlay').classList.add('hidden');
      toast('已打开：' + String(path).split('/').pop());
    } catch (e) {
      toast('打开失败：' + e.message);
    }
  },

  toggleHelp() {
    const el = document.getElementById('help-overlay');
    el.classList.toggle('hidden');
  },

  async autoSave() {
    if (!this.dirty || this.playing || !this.host) return;
    try {
      const path = await this.host.autosavePath();
      if (!path) return;
      const b64 = await Project.pack();
      await this.host.saveProjectDirect(path, b64);
      toast('已自动保存');
    } catch (e) { }
  },

  async open() {
    if (!this.host) return;
    await this.hostReady;
    const r = await this.host.openProject();
    if (!r) return;
    try {
      await Project.unpack(r.base64);
    } catch (e) {
      alert('打开失败：' + e.message);
      return;
    }
    Project.filePath = r.path;
    JimuBlocks.ws.clear();
    Stage.render(Project.data.scenes[0]);
    this.activeTab = 'global';
    JimuBlocks.current = null;
    JimuBlocks.switchTo('global');
    this.renderTabs();
    Panel.show();
    this.clearDirty();
    History.reset();
    try { await this.host.addRecentFile(r.path); } catch (e) { }
    toast('已打开：' + r.path.split('/').pop());
  },

  newProject() {
    if (this.dirty && !confirm('当前项目有未保存的修改，确定新建吗？')) return;
    JimuBlocks.ws.clear();
    JimuBlocks.current = null;
    Project.newProject();
    Stage.render(Project.data.scenes[0]);
    this.activeTab = 'global';
    JimuBlocks.switchTo('global');
    this.renderTabs();
    Panel.show();
    this.clearDirty();
    History.reset();
  },

  loadDemo() {
    if (this.dirty && !confirm('当前项目有未保存的修改，确定载入示例吗？')) return;
    JimuBlocks.ws.clear();
    JimuBlocks.current = null;
    Project.newProject('积木剧场演示');
    this.buildDemo();
    Stage.render(Project.data.scenes[0]);
    this.activeTab = 'global';
    JimuBlocks.switchTo('global');
    this.renderTabs();
    Panel.show();
    this.clearDirty();
    History.reset();
    toast('示例已载入，点 ▶ 播放试试');
  },

  // ---------- 示例项目 ----------
  buildDemo() {
    const d = Project.data;
    const s1 = Project.getScene(d.scenes[0].id);
    s1.name = '封面';
    s1.background = { type: 'gradient', value: { kind: 'linear', angle: 135, stops: [['#0F1523', '0'], ['#1A1030', '1']] } };

    const title = Project.createElement(s1, 'text', {
      name: '标题', x: 460, y: 400, w: 1000, h: 160,
      props: { text: '积木剧场', size: 120, color: '#E6E9EF', bold: true, align: 'center' }
    });
    const sub = Project.createElement(s1, 'text', {
      name: '副标题', x: 560, y: 580, w: 800, h: 80,
      props: { text: '用积木编排你的演示', size: 40, color: '#8A93A6', align: 'center' }
    });
    const line = Project.createElement(s1, 'shape', {
      name: '装饰线', x: 860, y: 560, w: 200, h: 4,
      props: { shape: 'rect', fill: '#6C8CFF', stroke: '#6C8CFF', strokeWidth: 0, radius: 2 }
    });

    const s2 = Project.addScene('特性');
    s2.background = { type: 'color', value: '#0F1115' };
    s2.transition = { type: 'slide-left', duration: 0.6 };
    const t2 = Project.createElement(s2, 'text', {
      name: '标题2', x: 660, y: 140, w: 600, h: 100,
      props: { text: '能做什么', size: 64, color: '#E6E9EF', bold: true, align: 'center' }
    });
    const icons = [
      { char: '🧩', x: 420 }, { char: '🎬', x: 860 }, { char: '🚀', x: 1300 }
    ].map((cfg, i) => Project.createElement(s2, 'icon', {
      name: '图标' + (i + 1), x: cfg.x, y: 380, w: 200, h: 200,
      props: { char: cfg.char, size: 140, color: '#6C8CFF' }
    }));
    const labels = ['积木编程', '动画放映', '3D 展示'].map((txt, i) => Project.createElement(s2, 'text', {
      name: '标签' + (i + 1), x: 370 + i * 440, y: 620, w: 300, h: 70,
      props: { text: txt, size: 44, color: '#C9D1E0', align: 'center' }
    }));

    const s3 = Project.addScene('结尾');
    s3.background = { type: 'gradient', value: { kind: 'linear', angle: 135, stops: [['#101A2A', '0'], ['#1A1030', '1']] } };
    s3.transition = { type: 'zoom', duration: 0.7 };
    const endText = Project.createElement(s3, 'text', {
      name: '结束语', x: 460, y: 460, w: 1000, h: 160,
      props: { text: '开始创作吧！', size: 96, color: '#E6E9EF', bold: true, align: 'center' }
    });
    const star = Project.createElement(s3, 'icon', {
      name: '星星', x: 880, y: 650, w: 160, h: 160,
      props: { char: '✨', size: 120, color: '#F5A623' }
    });

    // ---- 脚本 ----
    const waitBlock = (sec) => blk('jimu_wait', null, null, { SEC: { shadow: { type: 'math_number', fields: { NUM: sec } } } });
    const link = (list) => {
      for (let i = list.length - 1; i > 0; i--) {
        list[i - 1].next = { block: list[i] };
      }
      return list[0];
    };

    // 场景1：标题淡入 → 装饰线 → 副标题飞入 → 等待 → 下一场景
    s1.blocks = {
      blocks: {
        languageVersion: 0,
        blocks: [link([
          blk('jimu_on_scene', { SCENE: s1.id }),
          blk('jimu_anim', { ELEMENT: title.id, ANIM: 'fadeIn', DUR: 0.8, DELAY: 0, EASE: 'easeOutCubic' }),
          blk('jimu_anim', { ELEMENT: line.id, ANIM: 'zoomIn', DUR: 0.5, DELAY: 0, EASE: 'easeOutBack' }),
          blk('jimu_anim', { ELEMENT: sub.id, ANIM: 'flyInBottom', DUR: 0.6, DELAY: 0.2, EASE: 'easeOutCubic' }),
          waitBlock(2),
          blk('jimu_scene_next')
        ])]
      }
    };

    // 场景2脚本：标题飞入 → 图标依次弹跳 → 标签淡入 → 等待 → 下一场景
    const chain2 = [blk('jimu_on_scene', { SCENE: s2.id }),
      blk('jimu_anim', { ELEMENT: t2.id, ANIM: 'flyInTop', DUR: 0.6, DELAY: 0, EASE: 'easeOutCubic' })];
    icons.forEach((ic, i) => chain2.push(blk('jimu_anim', { ELEMENT: ic.id, ANIM: 'bounceIn', DUR: 0.7, DELAY: 0.15, EASE: 'easeOutBounce' })));
    labels.forEach(lb => chain2.push(blk('jimu_anim', { ELEMENT: lb.id, ANIM: 'fadeIn', DUR: 0.5, DELAY: 0, EASE: 'easeOutCubic' })));
    chain2.push(waitBlock(2), blk('jimu_scene_next'));
    s2.blocks = { blocks: { languageVersion: 0, blocks: [link(chain2)] } };

    // 场景3脚本：打字机 → 星星光晕 → 等待 → 回到封面
    s3.blocks = {
      blocks: {
        languageVersion: 0,
        blocks: [link([
          blk('jimu_on_scene', { SCENE: s3.id }),
          blk('jimu_anim', { ELEMENT: endText.id, ANIM: 'typewriter', DUR: 1.4, DELAY: 0, EASE: 'linear' }),
          blk('jimu_anim', { ELEMENT: star.id, ANIM: 'glowPulse', DUR: 1.2, DELAY: 0, EASE: 'easeInOutCubic' }),
          waitBlock(1.8),
          blk('jimu_scene_go', { SCENE: s1.id })
        ])]
      }
    };

    // 全局脚本：当演示开始 → 无（场景脚本自带流程）
    d.globalBlocks = { blocks: { languageVersion: 0, blocks: [] } };
  },

  // ---------- 键盘 ----------
  onKeyDown(e) {
    if (this.playing) {
      if (e.key === 'Escape') { this.stop(); return; }
      if (e.key === ' ') {
        e.preventDefault();
        Executor.trigger('onKey', 'Space').then(n => { if (!n) this.nextScene(); });
        return;
      }
      Executor.trigger('onKey', e.code);
      return;
    }
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.target.isContentEditable) return;
    // Blockly 有键盘焦点时（正在操作积木），不响应元素编辑快捷键，避免误删舞台元素
    try {
      const fm = window.Blockly && Blockly.getFocusManager ? Blockly.getFocusManager() : null;
      if (fm && fm.getFocusNode && fm.getFocusNode()) return;
    } catch (err) { }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (Editor.selectedId) { Editor.deleteSelected(); e.preventDefault(); }
    } else if (e.key.startsWith('Arrow') && Editor.selectedId) {
      const d = e.shiftKey ? 10 : 1;
      const map = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
      const m = map[e.key];
      if (m) { Editor.nudge(m[0], m[1]); e.preventDefault(); }
    } else if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault(); this.save();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault(); History.undo();
    } else if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault(); History.redo();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'o') {
      e.preventDefault(); this.open();
    } else if (e.ctrlKey && e.key.toLowerCase() === 'n') {
      e.preventDefault(); this.newProject();
    } else if (e.key === 'F5') {
      e.preventDefault(); this.play();
    } else if (e.key === 'Escape') {
      Editor.select(null);
    } else if (e.ctrlKey && e.key.toLowerCase() === 'd') {
      Editor.duplicateSelected(); e.preventDefault();
    }
  }
};

window.addEventListener('DOMContentLoaded', () => App.init());
