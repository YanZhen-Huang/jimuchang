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

// 元素类型图标（脚本切换栏 / 元素列表条）
const ELEMENT_ICONS = {
  text: '🅣', image: '🖼', shape: '🔷', icon: '⭐', video: '🎬',
  audio: '🎵', chart: '📊', sprite: '🎞', model3d: '🧊', webapp: '🧩'
};

// 设置面板配置
const SETTING_DEFS = [
  { group: '编辑器', items: [
    { key: 'autosaveMin', label: '自动保存间隔', type: 'select', hint: '自动保存到缓存，意外退出后可恢复', options: [[0, '关闭'], [1, '1 分钟'], [2, '2 分钟'], [5, '5 分钟']] },
    { key: 'alignGuides', label: '对齐辅助线', type: 'bool', hint: '拖动元素时显示吸附参考线' },
    { key: 'undoLimit', label: '撤销步数上限', type: 'select', options: [[30, '30 步'], [60, '60 步'], [100, '100 步']] },
    { key: 'blockCount', label: '显示积木块数', type: 'bool' },
    { key: 'blockSounds', label: '积木音效（重启生效）', type: 'bool' }
  ] },
  { group: '播放与导出', items: [
    { key: 'defaultTransition', label: '默认章节转场时长', type: 'select', options: [[0.3, '0.3 秒'], [0.6, '0.6 秒'], [1, '1 秒']] },
    { key: 'hideCursor', label: '播放时自动隐藏鼠标', type: 'bool' },
    { key: 'pptRes', label: 'PPT 高保真分辨率', type: 'select', hint: '1080p 更清晰，文件更大', options: [[720, '720p'], [1080, '1080p']] },
    { key: 'pptQuality', label: 'PPT 图片质量', type: 'select', options: [[70, '标准 70%'], [85, '较高 85%'], [95, '最高 95%']] }
  ] },
  { group: '渲染性能', items: [
    { key: 'ecoMode', label: '节能模式', type: 'bool', hint: '3D 与特效统一降为 30 帧' },
    { key: 'threeFps', label: '3D 模型帧率（播放）', type: 'select', options: [[30, '30 帧'], [60, '60 帧']] },
    { key: 'fxFps', label: '粒子 / 氛围特效帧率', type: 'select', options: [[30, '30 帧'], [60, '60 帧']] },
    { key: 'threeShadows', label: '3D 阴影', type: 'bool' },
    { key: 'showFps', label: '显示帧率计数器', type: 'bool' }
  ] },
  { group: '高级', items: [
    { key: 'showAdvanced', label: '显示「高级」积木分类', type: 'bool', hint: '执行代码等进阶积木；已放到工作区的块不受影响' },
    { key: 'cloneLimit', label: '克隆体上限', type: 'select', options: [[100, '100 个'], [200, '200 个'], [500, '500 个']] },
    { key: 'apiEnabled', label: 'AI 接口（HTTP API）（重启生效）', type: 'bool', hint: '供外部 AI 控制的本地接口' }
  ] }
];

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
    // 积木区空状态提示层
    this.emptyHint = document.createElement('div');
    this.emptyHint.id = 'blockly-empty';
    document.getElementById('blocklyDiv').appendChild(this.emptyHint);

    Editor.rootEl.addEventListener('click', e => {
      if (!this.playing) return;
      const elDom = e.target.closest('.el');
      if (elDom) Executor.trigger('onElementClick', elDom.dataset.id);
    });
    Executor.hooks.onSceneEnter = id => this.playEntrances(id);

    this.bindUI();
    Stage.renderAll();
    this.renderTabs();
    this.switchTab(Project.data.chapters[0].id);
    History.reset();

    // 宿主就绪后加载持久化偏好（qrc 下 localStorage 不可靠，统一走 QSettings）
    await this.hostReady;
    if (this.host) {
      try { await Settings.loadFromHost(this.host); } catch (e) { }
      try { await this.host.setTitle('积木剧场 · ' + Project.data.name); } catch (e) { }
    }
    this.applySettings();
    this.applyTheme(Settings.get('theme') || 'dark');

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
        const txt = data.elements.find(e => e.type === 'text');
        console.log(`P1TEST|unpack|${data.chapters.length}s ${data.resources.length}r text=${txt ? txt.props.text : 'none'}`);
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
        Stage.renderAll();
        Stage.goChapter(Project.data.chapters[0].id, { instant: true });
        this.activeTab = 'global';
        JimuBlocks.switchTo('global');
        this.renderTabs();
        console.log(`P1TEST|open|${Project.data.chapters.length}s ${Project.data.resources.length}r`);
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
        const b64 = await PptxExport.generate({ mode: 'editable', anim: true });
        const ok = await this.host.saveProjectDirect('/tmp/test_export.pptx', b64);
        console.log('PTTEST|save|' + ok + '|' + b64.length);
        const b64f = await PptxExport.generate({ mode: 'fidelity' });
        const okf = await this.host.saveProjectDirect('/tmp/test_fidelity.pptx', b64f);
        console.log('PTTEST|fidelity|' + okf + '|' + b64f.length);
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
      const txts = Project.data.elements.filter(e => e.type === 'text');
      if (txts.length >= 2) {
        const el = txts[0], other = txts[1];
        el.x = other.x + 4;
        el.y = other.y + 2;
        const snap = Editor.computeSnap(el);
        console.log('P7TEST|snap|dx=' + snap.dx.toFixed(1) + ' dy=' + snap.dy.toFixed(1) + ' lineV=' + snap.lineV + ' lineH=' + snap.lineH);
        Stage.refreshAll();
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
        const el = Project.data.elements.find(e => e.type === 'text');
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
    if (params.get('testr2') === '1') {
      await sleep(700);
      this.testR2();
    }
    if (params.get('testreveal') === '1') {
      await sleep(900);
      this.testReveal();
    }
    if (params.get('testelblocks') === '1') {
      await sleep(800);
      this.testElblocks();
    }
    if (params.get('testsettings') === '1') {
      await sleep(800);
      try {
        const before = { bc: Settings.get('blockCount'), fps: Settings.get('showFps') };
        console.log(`SETTEST|before|blockCount=${before.bc}|showFps=${before.fps}`);
        if (before.bc === true) {
          // 上次写入的值被持久化恢复 → 验证成功 → 清理回默认（不污染用户环境）
          Settings.reset();
          await sleep(300);
          console.log('SETTEST|persist|PASS（已清理回默认）');
        } else {
          Settings.set('blockCount', true);
          Settings.set('showFps', true);
          await sleep(500);
          const hasBc = !!document.getElementById('block-count');
          const hasFps = !!document.getElementById('fps-meter');
          console.log(`SETTEST|apply|blockCountEl=${hasBc}|fpsEl=${hasFps}`);
          console.log((hasBc && hasFps) ? 'SETTEST|apply|PASS' : 'SETTEST|apply|FAIL');
        }
      } catch (e) {
        console.log('SETTEST|error|' + (e.message || e));
      }
    }
    if (params.get('testblocks2') === '1') {
      await sleep(900);
      this.testBlocks2();
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
    on('btn-settings', () => this.openSettings());
    on('btn-settings-close', () => this.closeSettings());
    on('btn-theme', () => this.toggleTheme());
    on('btn-home', () => this.showHome());
    on('home-new', () => { document.getElementById('home-overlay').classList.add('hidden'); this.newProject(); });
    on('home-demo', () => { document.getElementById('home-overlay').classList.add('hidden'); this.loadDemo(); });
    on('home-open', () => { document.getElementById('home-overlay').classList.add('hidden'); this.open(); });
    // 自动保存：间隔由设置决定（默认 2 分钟）
    this.setupAutosave();
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
    Settings.set('theme', mode);
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

  // ---------- 脚本切换栏（全局 / 元素下拉，永不溢出） ----------
  renderScriptTabs() {
    const box = document.getElementById('script-tabs');
    if (!box) return;
    const active = this.activeTab || 'global';
    const cur = active.indexOf('el:') === 0 ? Project.getElement(active.slice(3)) : null;
    const n = Project.data.elements.length;
    let html = `<div class="tab${active === 'global' ? ' active' : ''}" data-key="global" title="全局脚本（当演示开始 / 按下键 / 收到消息）">全局</div>`;
    html += `<div class="tab tab-drop${cur ? ' active' : ''}" id="btn-el-drop" title="选择要编辑脚本的元素">`
      + (cur ? `<span class="el-ico">${ELEMENT_ICONS[cur.type] || '◻'}</span>${esc(cur.name)}` : `选择元素…（${n} 个）`) + ' ▾</div>';
    box.innerHTML = html;
    box.querySelector('[data-key="global"]').onclick = () => this.switchTab('global');
    box.querySelector('#btn-el-drop').onclick = e => this.elementDropMenu(e);
    if (Settings.get('blockCount')) {
      const c = document.createElement('span');
      c.id = 'block-count';
      box.appendChild(c);
      this.updateBlockCount();
    }
  },

  elementDropMenu(e) {
    // 点击按钮时捕获阶段已把它关掉（刚关闭 <250ms）→ 不再重开，实现 toggle
    if (ContextMenu._hiddenAt && Date.now() - ContextMenu._hiddenAt < 250) return;
    const items = Project.data.elements.map(el => ({
      label: `${ELEMENT_ICONS[el.type] || '◻'} ${el.name}`,
      active: this.activeTab === 'el:' + el.id,
      action: () => this.selectElement(el.id, true)
    }));
    if (!items.length) items.push({ label: '（暂无元素，用工具栏「＋」添加）', action: () => { } });
    // 固定贴在按钮正下方展开（不跟随鼠标位置）
    const btn = document.getElementById('btn-el-drop');
    if (btn) {
      const r = btn.getBoundingClientRect();
      ContextMenu.show(r.left, r.bottom + 6, items);
    } else {
      ContextMenu.show(e.clientX, e.clientY, items);
    }
  },

  // ---------- 元素列表条 ----------
  renderElementBar() {
    const box = document.getElementById('element-bar');
    if (!box) return;
    const sel = Editor.selectedId;
    if (!Project.data.elements.length) {
      box.innerHTML = '<span class="el-bar-note">暂无元素：用工具栏「＋」添加，或从下方属性面板编辑舞台</span>';
      return;
    }
    let html = '';
    Project.data.elements.forEach(el => {
      html += `<div class="el-chip${sel === el.id ? ' active' : ''}" data-id="${el.id}" title="点击选中并编辑其脚本">`
        + `<span class="el-ico">${ELEMENT_ICONS[el.type] || '◻'}</span>${esc(el.name)}${el.locked ? ' 🔒' : ''}</div>`;
    });
    box.innerHTML = html;
    box.querySelectorAll('.el-chip').forEach(c => {
      const id = c.dataset.id;
      c.onclick = () => this.selectElement(id, true);
      c.oncontextmenu = e => {
        e.preventDefault();
        this.elementMenu(e.clientX, e.clientY, id);
      };
    });
  },

  // 选中元素（switchScript=true 时同步把积木区切到该元素的脚本）
  selectElement(id, switchScript) {
    const f = Project.findElementById(id);
    if (f) this.revealElement(f.element);
    Editor.select(id);
    if (switchScript) this.switchTab('el:' + id);
    else { this.renderScriptTabs(); this.renderElementBar(); }
  },

  // 编辑元素时把舞台切到"看得见它"的上下文：
  // 找显式显示它的章节 → 切到那个章节画面；找不到 → 点亮它（编辑态兜底）
  revealElement(el) {
    if (!el) return;
    let explicit = null, implicit = null;
    for (const ch of Project.data.chapters || []) {
      const vis = ch.preset && ch.preset.visibility;
      if (vis && vis[el.id] === true) { explicit = ch; break; }
      if ((!vis || !Object.keys(vis).length) && !implicit) implicit = ch;
    }
    const target = explicit || implicit;
    if (target) {
      if (Stage.currentChapterId !== target.id) Stage.goChapter(target.id, { instant: true });
      return;
    }
    this.ensureElementVisible(el);
  },

  // 编辑态：被当前章节预览藏起来的元素，一旦要编辑它就点亮（否则看不见、点不到）
  ensureElementVisible(el) {
    if (!el || el.visible) return;
    el.visible = true;
    const dom = Stage.elDom(el.id);
    if (dom) { Anim.reset(el, dom); Elements.applyBox(el, dom); }
  },

  elementMenu(x, y, id) {
    const f = Project.findElementById(id);
    if (!f) return;
    const el = f.element;
    ContextMenu.show(x, y, [
      { label: '编辑脚本', action: () => this.selectElement(id, true) },
      { label: '重命名…', action: () => { const nm = prompt('元素名称', el.name); if (nm) { el.name = nm; this.renderScriptTabs(); this.renderElementBar(); Panel.show(); this.markDirty(); } } },
      { label: '复制元素', action: () => { Editor.select(id); Editor.duplicateSelected(); this.renderElementBar(); } },
      { label: el.locked ? '解锁' : '锁定', action: () => { el.locked = !el.locked; this.renderElementBar(); this.markDirty(); } },
      { label: '置于最前', action: () => { el.z = Math.max(0, ...Project.data.elements.map(e => e.z || 0)) + 1; Stage.renderAll(); this.markDirty(); } },
      { label: '置于最后', action: () => { el.z = Math.min(0, ...Project.data.elements.map(e => e.z || 0)) - 1; Stage.renderAll(); this.markDirty(); } },
      { type: 'sep' },
      { label: '删除元素', danger: true, action: () => { Editor.select(id); Editor.deleteSelected(); this.renderScriptTabs(); this.renderElementBar(); } }
    ]);
  },

  // ---------- 章节书签栏（默认收起为一个小书签按钮；章节只是辅助书签） ----------
  chapterBarOpen() {
    return Settings.get('chapterBar') === 'open';
  },
  setChapterBarOpen(open) {
    Settings.set('chapterBar', open ? 'open' : 'closed');
  },

  renderTabs() {
    const box = document.getElementById('scene-tabs');
    if (!box) return;
    const active = this.activeTab;
    const open = this.chapterBarOpen();
    if (!open) {
      box.innerHTML = `<div class="tab tab-bookmark" id="btn-bookmarks" title="展开章节书签（章节=舞台状态书签：背景+显隐预设+章节脚本，不参与构建）">🔖 书签 ${Project.data.chapters.length}</div>`;
      box.querySelector('#btn-bookmarks').onclick = () => { this.setChapterBarOpen(true); this.renderTabs(); };
      return;
    }
    let html = `<div class="tab tab-bookmark" id="btn-bookmarks" title="收起章节书签">🔖</div>`;
    Project.data.chapters.forEach(s => {
      html += `<div class="tab${active === s.id ? ' active' : ''}" data-key="${s.id}" title="点击预览本章节（应用背景/显隐预设）">${esc(s.name)}</div>`;
    });
    html += `<button id="btn-add-scene" title="新建章节（记录当前舞台状态为预设）">＋</button>`;
    html += `<div class="spacer"></div><button id="btn-del-scene" class="tab-del" title="删除当前章节">删除章节</button>`;
    box.innerHTML = html;
    box.querySelector('#btn-bookmarks').onclick = () => { this.setChapterBarOpen(false); this.renderTabs(); };
    box.querySelectorAll('.tab[data-key]').forEach(t => {
      t.onclick = () => this.switchTab(t.dataset.key);
      t.oncontextmenu = (e) => {
        e.preventDefault();
        const ch = Project.getChapter(t.dataset.key);
        if (!ch) return;
        ContextMenu.show(e.clientX, e.clientY, [
          { label: '重命名…', action: () => { const nm = prompt('章节名称', ch.name); if (nm) { ch.name = nm; this.renderTabs(); Panel.show(); this.markDirty(); } } },
          { label: '复制章节', action: () => this.copyChapter(ch.id) },
          { label: '用当前舞台状态更新预设', action: () => this.updateChapterPreset(ch.id) },
          { type: 'sep' },
          { label: '删除章节', danger: true, action: () => { this.activeTab = ch.id; this.deleteChapter(); } }
        ]);
      };
    });
    box.querySelector('#btn-add-scene').onclick = () => {
      JimuBlocks.save();
      const ch = Project.addChapter();
      this.updateChapterPreset(ch.id, true);
      this.renderTabs();
      this.switchTab(ch.id);
      this.markDirty();
    };
    const del = box.querySelector('#btn-del-scene');
    if (del) del.onclick = () => this.deleteChapter();
  },

  // 记录当前舞台状态（背景+全部元素显隐）为章节预设
  updateChapterPreset(chapterId, silent) {
    const ch = Project.getChapter(chapterId);
    if (!ch) return;
    ch.preset.background = JSON.parse(JSON.stringify(Project.data.stage.background));
    ch.preset.visibility = {};
    Project.data.elements.forEach(el => { ch.preset.visibility[el.id] = el.visible !== false; });
    if (!silent) { toast('已用当前舞台状态更新「' + ch.name + '」的预设'); this.markDirty(); }
  },

  switchTab(key) {
    const isEl = key.indexOf('el:') === 0;
    if (key !== 'global' && !isEl && !Project.getChapter(key)) return;
    JimuBlocks.switchTo(key);
    this.activeTab = key;
    if (isEl) {
      const el = Project.getElement(key.slice(3));
      if (el) {
        this.revealElement(el);
        Editor.select(el.id);
        Panel.show();
      }
    } else if (key !== 'global') {
      const ch = Project.getChapter(key);
      if (ch) {
        Stage.goChapter(ch.id, { instant: true });   // 编辑态预览该书签
        Editor.select(null);
        Panel.show();
      }
    }
    this.renderTabs();
    this.renderScriptTabs();
    this.renderElementBar();
  },

  copyChapter(id) {
    const ch = Project.getChapter(id);
    if (!ch) return;
    const copy = JSON.parse(JSON.stringify(ch));
    copy.id = Project.uid('ch');
    copy.name = ch.name + ' 副本';
    copy.blocks = null;
    const idx = Project.data.chapters.indexOf(ch);
    Project.data.chapters.splice(idx + 1, 0, copy);
    this.renderTabs();
    this.switchTab(copy.id);
    this.markDirty();
    toast('已复制章节（元素不重复；脚本未复制）');
  },

  deleteChapter() {
    if (this.activeTab === 'global' || this.activeTab.indexOf('el:') === 0) { toast('先切换到一个章节再删除'); return; }
    if (Project.data.chapters.length <= 1) { toast('至少保留一个章节'); return; }
    const ch = Project.getChapter(this.activeTab);
    if (!ch || !confirm(`删除章节「${ch.name}」？（元素与舞台内容保留）`)) return;
    JimuBlocks.switchTo('global');
    Project.removeChapter(ch.id);
    this.activeTab = 'global';
    this.renderTabs();
    this.renderScriptTabs();
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
    const el = Project.createElement(kind, { props: { resourceId: res.id } });
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
    const has3d = projectData.elements.some(e => e.type === 'model3d');
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
    const needBuiltin = projectData.elements.some(e =>
      e.type === 'model3d' && (!e.props.resourceId || e.props.resourceId === 'builtin:robot'));
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
<div id="play-hint">空格 推进 · ← → 切章节 · 双击全屏 · Esc 退出全屏</div>
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

  // ELBLK 测试：元素脚本的保存/切回恢复链路
  async testElblocks() {
    try {
      const el = Project.data.elements.find(e => e.name === '标题');
      if (!el) { console.log('ELBLK|no-el'); return; }
      this.selectElement(el.id, true);
      await sleep(400);
      const ws = JimuBlocks.ws;
      const b = ws.newBlock('jimu_self_on_start');
      if (b.initSvg) b.initSvg();
      b.render();
      b.moveBy(60, 60);
      await sleep(200);
      this.switchTab('global');
      await sleep(300);
      const f = Project.getElement(el.id);
      const saved = !!(f && f.blocks);
      this.selectElement(el.id, true);
      await sleep(400);
      const n = ws.getTopBlocks(true).length;
      console.log(`ELBLK|saved=${saved} back=${n}`);
      console.log((saved && n === 1) ? 'ELBLK|PASS' : 'ELBLK|FAIL');
    } catch (e) {
      console.log('ELBLK|error|' + (e.message || e));
    }
  },

  // BLK2 测试：S2 补全积木（数学/文本/侦测/控制）语义验证
  async testBlocks2() {
    try {
      const E = Executor;
      const num = v => ({ k: 'num', v });
      const str = v => ({ k: 'str', v });
      const ev = async expr => await E.evalExpr(expr, E.newCtx());
      const r = [];
      // 数学
      r.push(['trig_sin30', Math.abs((await ev({ k: 'trig', op: 'SIN', v: num(30) })) - 0.5) < 0.001]);
      r.push(['log_ln', Math.abs((await ev({ k: 'single', op: 'LN', v: num(Math.E) })) - 1) < 0.001]);
      r.push(['bitwise_and', (await ev({ k: 'bitwise', op: 'and', a: num(12), b: num(10) })) === 8]);
      r.push(['shift_shl', (await ev({ k: 'shift', op: 'shl', a: num(1), b: num(4) })) === 16]);
      // 文本
      r.push(['letter', (await ev({ k: 'letter', text: str('hello'), n: num(2) })) === 'e']);
      r.push(['contains', (await ev({ k: 'contains', text: str('hello'), sub: str('ell') })) === true]);
      r.push(['replace', (await ev({ k: 'replace', text: str('a-b-c'), from: str('-'), to: str('+') })) === 'a+b+c']);
      r.push(['case', (await ev({ k: 'textcase', op: 'upper', v: str('ab') })) === 'AB']);
      r.push(['trim', (await ev({ k: 'trim', v: str('  hi  ') })) === 'hi']);
      // 侦测
      E.mouse.x = 123; E.mouse.y = 456; E.mouse.down = true;
      r.push(['mouse', (await ev({ k: 'mouse', axis: 'x' })) === 123 && (await ev({ k: 'mouse', axis: 'y' })) === 456]);
      r.push(['mousedown', (await ev({ k: 'mousedown' })) === true]);
      E.mouse.down = false;
      // 碰撞（用 demo 元素：出界 → 碰边；重合 → 相碰）
      const el = Project.data.elements[0];
      const el2 = Project.data.elements[1];
      const ox = el.x, oy = el.y, ox2 = el2.x, oy2 = el2.y;
      el.x = -200; Stage.refreshAll();
      r.push(['touch_edge', E.checkTouch(el.id, '@edge') === true]);
      el.x = ox; el2.x = ox; el2.y = oy; Stage.refreshAll();
      r.push(['touch_el', E.checkTouch(el.id, el2.id) === true]);
      el2.x = ox2 + 5000; Stage.refreshAll();
      r.push(['touch_far', E.checkTouch(el.id, el2.id) === false]);
      el.x = ox; el.y = oy; el2.x = ox2; el2.y = oy2; Stage.refreshAll();
      // 停止全部
      const c1 = E.newCtx(); const c2 = E.newCtx();
      await E.exec({ op: 'ctrl.stopall' }, c2);
      r.push(['stopall', c1.aborted === true && c2.aborted === true]);
      E._ctxs = [];
      r.forEach(x => console.log('BLK2|' + x[0] + '|' + (x[1] ? 'ok' : 'FAIL')));
      console.log(r.every(x => x[1]) ? 'BLK2|PASS' : 'BLK2|FAIL');
    } catch (e) {
      console.log('BLK2|error|' + (e.message || e));
    }
  },

  // REVEAL 测试：点元素脚本应把舞台切到"看得见它"的章节
  async testReveal() {
    try {
      const t2 = Project.data.elements.find(e => e.name === '标题2');
      if (!t2) { console.log('REVEAL|no-t2'); return; }
      this.selectElement(t2.id, true);
      await sleep(500);
      const cur = Stage.currentChapter();
      const el = Project.findElementById(t2.id).element;
      console.log(`REVEAL|chapter=${cur ? cur.name : '?'}|visible=${el.visible}|tabEl=${this.activeTab.indexOf('el:') === 0}`);
      console.log((cur && cur.name === '特性' && el.visible) ? 'REVEAL|PASS' : 'REVEAL|FAIL');
    } catch (e) {
      console.log('REVEAL|error|' + (e.message || e));
    }
  },

  // R2 自动化测试：三个元素各写独立脚本，播放时各自表演互不干扰
  async testR2() {    try {
      Project.newProject('R2 测试');
      if (!Project.data.chapters.length) Project.addChapter('章节 1');
      const S = blocks => ({ blocks: { languageVersion: 0, blocks } });
      const num = v => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
      const A = Project.createElement('shape', { name: '甲', x: 200, y: 300, w: 160, h: 160, props: { fill: '#F5645C' } });
      const B = Project.createElement('shape', { name: '乙', x: 200, y: 400, w: 160, h: 160, props: { fill: '#4C8DF0' } });
      const C = Project.createElement('shape', { name: '丙', x: 300, y: 500, w: 160, h: 160, props: { fill: '#4CC38A' } });
      A.blocks = S([
        { type: 'jimu_self_on_start', next: { block: { type: 'jimu_self_change', fields: { PROP: 'x' }, inputs: { DELTA: num(300) } } } },
        { type: 'jimu_self_on_click', next: { block: { type: 'jimu_self_change', fields: { PROP: 'y' }, inputs: { DELTA: num(50) } } } }
      ]);
      B.blocks = S([
        { type: 'jimu_self_on_start', next: { block: { type: 'jimu_self_face', inputs: { ANGLE: num(90) }, next: { block: { type: 'jimu_self_change', fields: { PROP: 'y' }, inputs: { DELTA: num(200) } } } } } }
      ]);
      C.blocks = S([
        { type: 'jimu_self_on_start', next: { block: { type: 'jimu_self_glide', fields: { EASE: 'easeOutQuad' }, inputs: { DUR: num(0.4), X: num(1000), Y: num(700) }, next: { block: { type: 'jimu_self_el_color', fields: { COLOR: '#FF0000' } } } } } }
      ]);
      Stage.renderAll();
      await this.play();
      await sleep(1600);
      const g = id => (Project.findElementById(id) || {}).element || {};
      const a = g(A.id), b = g(B.id), c = g(C.id);
      console.log(`R2TEST|A|x=${a.x} y=${a.y}`);
      console.log(`R2TEST|B|rot=${b.rotation} y=${b.y}`);
      console.log(`R2TEST|C|x=${Math.round(c.x)} y=${Math.round(c.y)} fill=${c.props && c.props.fill}`);
      const okA = a.x === 500 && a.y === 300;
      const okB = b.rotation === 90 && b.y === 600 && b.x === 200;
      const okC = Math.abs(c.x - 1000) < 3 && Math.abs(c.y - 700) < 3 && String(c.props && c.props.fill).toLowerCase() === '#ff0000';
      await Executor.trigger('onElementClick', A.id);
      await sleep(150);
      const a2 = g(A.id);
      console.log(`R2TEST|click|A.y=${a2.y}`);
      const okClick = a2.y === 350;
      this.stop();
      await sleep(300);
      // 隐藏元素点亮：乙被章节预设隐藏 → 选中编辑应自动可见（否则"看不见点不到"）
      const ch0 = Project.data.chapters[0];
      ch0.preset.visibility = {};
      Project.data.elements.forEach(e => { ch0.preset.visibility[e.id] = e.id !== B.id; });
      await Stage.goChapter(ch0.id, { instant: true });
      const hiddenB = g(B.id).visible === false;
      this.selectElement(B.id, true);
      const litB = g(B.id).visible === true;
      console.log(`R2TEST|lit|hidden=${hiddenB} lit=${litB}`);
      const okLit = hiddenB && litB;
      console.log((okA && okB && okC && okClick && okLit) ? 'R2TEST|PASS' : `R2TEST|FAIL|A=${okA} B=${okB} C=${okC} click=${okClick} lit=${okLit}`);
    } catch (e) {
      console.log('R2TEST|error|' + (e.message || e));
    }
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
    const sc = Stage.currentChapter() || Project.data.chapters[0];
    Stage.renderAll();
    if (sc) Stage.goChapter(sc.id, { instant: true });
    Editor.select(null);
    Panel.show();
    setTimeout(() => {
      Stage.fit();
      try { Blockly.svgResize(JimuBlocks.ws); } catch (e) { }
    }, 120);
    this.renderTabs();
    this.renderScriptTabs();
    this.renderElementBar();
  },

  armCursorHide() {
    clearTimeout(this._cursorTimer);
    if (!Settings.get('hideCursor')) return;
    this._cursorTimer = setTimeout(() => {
      if (this.playing) document.body.classList.add('hide-cursor');
    }, 2500);
  },

  playEntrances(chapterId) {
    const ch = Project.getChapter(chapterId);
    if (!ch) return;
    AudioMgr.stopLoopSfx();
    Project.data.elements.forEach(el => {
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

  // 积木工作区空状态提示（切到没脚本的上下文时给引导）
  updateBlocklyEmpty() {
    if (!this.emptyHint || !JimuBlocks.ws) return;
    const empty = JimuBlocks.ws.getTopBlocks(true).length === 0;
    if (!empty) { this.emptyHint.classList.add('hidden'); return; }
    const key = this.activeTab || 'global';
    let text = '';
    if (key === 'global') {
      text = '全局脚本是空的<br>「当演示开始 / 当按下键 / 当收到消息」的积木放这里';
    } else if (key.indexOf('el:') === 0) {
      const el = Project.getElement(key.slice(3));
      text = `「${el ? esc(el.name) : ''}」还没有脚本<br>从左侧工具箱拖入「当我开始 / 当点击我」，给它写一段自己的表演吧`;
    } else {
      const ch = Project.getChapter(key);
      text = `章节「${ch ? esc(ch.name) : ''}」的脚本是空的<br>跳到这个章节时想执行什么？从左侧拖入积木`;
    }
    this.emptyHint.innerHTML = text;
    this.emptyHint.classList.remove('hidden');
  },

  // ---------- 设置面板 ----------
  openSettings() {
    this.renderSettings();
    document.getElementById('settings-overlay').classList.remove('hidden');
  },

  closeSettings() {
    document.getElementById('settings-overlay').classList.add('hidden');
  },

  renderSettings() {
    const box = document.getElementById('settings-body');
    if (!box) return;
    let html = '';
    SETTING_DEFS.forEach(g => {
      html += `<div class="set-group"><h4>${g.group}</h4>`;
      g.items.forEach(it => {
        html += '<div class="set-item"><div><span class="set-label">' + it.label + '</span>'
          + (it.hint ? `<span class="set-hint">${it.hint}</span>` : '') + '</div>';
        if (it.type === 'bool') {
          html += `<label class="set-switch"><input type="checkbox" data-key="${it.key}" ${Settings.get(it.key) ? 'checked' : ''}><span></span></label>`;
        } else {
          html += `<select data-key="${it.key}">` + it.options.map(o =>
            `<option value="${o[0]}" ${String(Settings.get(it.key)) === String(o[0]) ? 'selected' : ''}>${o[1]}</option>`).join('') + '</select>';
        }
        html += '</div>';
      });
      html += '</div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('input[type=checkbox]').forEach(inp => {
      inp.onchange = () => Settings.set(inp.dataset.key, inp.checked);
    });
    box.querySelectorAll('select').forEach(sel => {
      sel.onchange = () => {
        const def = SETTING_DEFS.flatMap(g => g.items).find(i => i.key === sel.dataset.key);
        const opt = def && def.options.find(o => String(o[0]) === sel.value);
        Settings.set(sel.dataset.key, opt ? opt[0] : sel.value);
      };
    });
  },

  // 设置生效（Settings.set 后自动调用）
  applySettings() {
    this.setupAutosave();
    this.applyFpsMeter();
    this.updateBlockCount();
    if (typeof JimuBlocks !== 'undefined' && JimuBlocks.refreshToolbox) {
      try { JimuBlocks.refreshToolbox(); } catch (e) { }
    }
    if (typeof Model3D !== 'undefined' && Model3D.applyShadows) { try { Model3D.applyShadows(); } catch (e) { } }
    if (this.host && this.host.setPref) {
      try { this.host.setPref('apiEnabled', Settings.get('apiEnabled') ? '1' : '0'); } catch (e) { }
    }
  },

  setupAutosave() {
    clearInterval(this._autosaveTimer);
    const min = Settings.get('autosaveMin');
    if (!min) return;
    this._autosaveTimer = setInterval(() => this.autoSave(), min * 60000);
  },

  updateBlockCount() {
    if (!Settings.get('blockCount')) {
      const el0 = document.getElementById('block-count');
      if (el0) el0.style.display = 'none';
      return;
    }
    const el = document.getElementById('block-count');
    if (!el) { this.renderScriptTabs(); return; }
    if (!JimuBlocks.ws) return;
    el.style.display = '';
    el.textContent = JimuBlocks.ws.getAllBlocks(false).length + ' 块';
  },

  applyFpsMeter() {
    let el = document.getElementById('fps-meter');
    const on = Settings.get('showFps');
    if (on) {
      if (!el) {
        el = document.createElement('div');
        el.id = 'fps-meter';
        document.body.appendChild(el);
      }
      el.classList.remove('hidden');
      if (!this._fpsRaf) {
        let last = performance.now(), frames = 0;
        const tick = t => {
          frames++;
          if (t - last >= 1000) {
            const m = document.getElementById('fps-meter');
            if (m) m.textContent = frames + ' FPS';
            frames = 0;
            last = t;
          }
          this._fpsRaf = requestAnimationFrame(tick);
        };
        this._fpsRaf = requestAnimationFrame(tick);
      }
    } else {
      if (el) el.classList.add('hidden');
      if (this._fpsRaf) { cancelAnimationFrame(this._fpsRaf); this._fpsRaf = null; }
    }
  },

  // 手动切章节 = 完整切换（中止当前章节脚本 + 应用预设 + 执行新章节脚本）
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
    try {
      const saved = Settings.get('pptOpts') || {};
      if (saved.mode) {
        const r = document.querySelector('input[name="ppt-mode"][value="' + saved.mode + '"]');
        if (r) r.checked = true;
      }
      if (saved.anim !== undefined) document.getElementById('ppt-anim').checked = !!saved.anim;
    } catch (e) { }
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
      const anim = !!(document.getElementById('ppt-anim') || {}).checked;
      Settings.set('pptOpts', { mode, anim });
      const b64 = await PptxExport.generate({ mode, anim });
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
      Stage.renderAll();
    Stage.goChapter(Project.data.chapters[0].id, { instant: true });
      this.activeTab = 'global';
      JimuBlocks.switchTo('global');
      this.renderTabs();
      this.renderScriptTabs();
      this.renderElementBar();
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
      Stage.renderAll();
    Stage.goChapter(Project.data.chapters[0].id, { instant: true });
      this.activeTab = 'global';
      JimuBlocks.switchTo('global');
      this.renderTabs();
      this.renderScriptTabs();
      this.renderElementBar();
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
    Stage.renderAll();
    Stage.goChapter(Project.data.chapters[0].id, { instant: true });
    this.activeTab = 'global';
    JimuBlocks.current = null;
    JimuBlocks.switchTo('global');
    this.renderTabs();
    this.renderScriptTabs();
    this.renderElementBar();
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
    Stage.renderAll();
    Stage.goChapter(Project.data.chapters[0].id, { instant: true });
    this.activeTab = 'global';
    JimuBlocks.switchTo('global');
    this.renderTabs();
    this.renderScriptTabs();
    this.renderElementBar();
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
    this.activeTab = 'global';
    Stage.renderAll();
    Stage.goChapter(Project.data.chapters[0].id, { instant: true });
    JimuBlocks.switchTo('global');
    this.renderTabs();
    this.renderScriptTabs();
    this.renderElementBar();
    Panel.show();
    this.clearDirty();
    History.reset();
    toast('示例已载入，点 ▶ 播放试试');
  },

  // ---------- 示例项目（v2 元素中心） ----------
  buildDemo() {
    const d = Project.data;

    // ==== 元素（全局，第一公民） ====
    const title = Project.createElement('text', { name: '标题', x: 460, y: 400, w: 1000, h: 160,
      props: { text: '积木剧场', size: 120, color: '#E6E9EF', bold: true, align: 'center' } });
    const sub = Project.createElement('text', { name: '副标题', x: 560, y: 580, w: 800, h: 80,
      props: { text: '用积木编排你的演示', size: 40, color: '#8A93A6', align: 'center' } });
    const line = Project.createElement('shape', { name: '装饰线', x: 860, y: 560, w: 200, h: 4,
      props: { shape: 'rect', fill: '#6C8CFF', stroke: '#6C8CFF', strokeWidth: 0, radius: 2 } });
    const t2 = Project.createElement('text', { name: '标题2', x: 660, y: 140, w: 600, h: 100,
      props: { text: '能做什么', size: 64, color: '#E6E9EF', bold: true, align: 'center' } });
    const icons = [
      { char: '🧩', x: 420 }, { char: '🎬', x: 860 }, { char: '🚀', x: 1300 }
    ].map((cfg, i2) => Project.createElement('icon', { name: '图标' + (i2 + 1), x: cfg.x, y: 380, w: 200, h: 200,
      props: { char: cfg.char, size: 140, color: '#6C8CFF' } }));
    const labels = ['积木编程', '动画放映', '3D 展示'].map((txt, i2) => Project.createElement('text', { name: '标签' + (i2 + 1), x: 370 + i2 * 440, y: 620, w: 300, h: 70,
      props: { text: txt, size: 44, color: '#C9D1E0', align: 'center' } }));
    const endText = Project.createElement('text', { name: '结束语', x: 460, y: 460, w: 1000, h: 160,
      props: { text: '开始创作吧！', size: 96, color: '#E6E9EF', bold: true, align: 'center' } });
    const star = Project.createElement('icon', { name: '星星', x: 880, y: 650, w: 160, h: 160,
      props: { char: '✨', size: 120, color: '#F5A623' } });

    // ==== 章节（书签：背景 + 显隐预设） ====
    const s1 = Project.getChapter(d.chapters[0].id);
    s1.name = '封面';
    s1.preset.background = { type: 'gradient', value: { kind: 'linear', angle: 135, stops: [['#0F1523', '0'], ['#1A1030', '1']] } };
    const s2 = Project.addChapter('特性');
    s2.preset.background = { type: 'color', value: '#0F1115' };
    const s3 = Project.addChapter('结尾');
    s3.preset.background = { type: 'gradient', value: { kind: 'linear', angle: 135, stops: [['#101A2A', '0'], ['#1A1030', '1']] } };
    const setVis = (ch, ids) => {
      ch.preset.visibility = {};
      d.elements.forEach(el => { ch.preset.visibility[el.id] = ids.indexOf(el.id) >= 0; });
    };
    setVis(s1, [title.id, sub.id, line.id]);
    setVis(s2, [t2.id].concat(icons.map(e => e.id), labels.map(e => e.id)));
    setVis(s3, [endText.id, star.id]);
    d.stage.background = JSON.parse(JSON.stringify(s1.preset.background));

    // ==== 章节脚本 ====
    const waitBlock = (sec) => blk('jimu_wait', null, null, { SEC: { shadow: { type: 'math_number', fields: { NUM: sec } } } });
    const link = (list) => {
      for (let i2 = list.length - 1; i2 > 0; i2--) list[i2 - 1].next = { block: list[i2] };
      return list[0];
    };
    s1.blocks = {
      blocks: { languageVersion: 0, blocks: [link([
        blk('jimu_on_scene', { SCENE: s1.id }),
        blk('jimu_anim', { ELEMENT: title.id, ANIM: 'fadeIn', DUR: 0.8, DELAY: 0, EASE: 'easeOutCubic' }),
        blk('jimu_anim', { ELEMENT: line.id, ANIM: 'zoomIn', DUR: 0.5, DELAY: 0, EASE: 'easeOutBack' }),
        blk('jimu_anim', { ELEMENT: sub.id, ANIM: 'flyInBottom', DUR: 0.6, DELAY: 0.2, EASE: 'easeOutCubic' }),
        waitBlock(2),
        blk('jimu_scene_next')
      ])] }
    };
    const chain2 = [blk('jimu_on_scene', { SCENE: s2.id }),
      blk('jimu_anim', { ELEMENT: t2.id, ANIM: 'flyInTop', DUR: 0.6, DELAY: 0, EASE: 'easeOutCubic' })];
    icons.forEach(ic => chain2.push(blk('jimu_anim', { ELEMENT: ic.id, ANIM: 'bounceIn', DUR: 0.7, DELAY: 0.15, EASE: 'easeOutBounce' })));
    labels.forEach(lb => chain2.push(blk('jimu_anim', { ELEMENT: lb.id, ANIM: 'fadeIn', DUR: 0.5, DELAY: 0, EASE: 'easeOutCubic' })));
    chain2.push(waitBlock(2), blk('jimu_scene_next'));
    s2.blocks = { blocks: { languageVersion: 0, blocks: [link(chain2)] } };
    s3.blocks = {
      blocks: { languageVersion: 0, blocks: [link([
        blk('jimu_on_scene', { SCENE: s3.id }),
        blk('jimu_anim', { ELEMENT: endText.id, ANIM: 'typewriter', DUR: 1.4, DELAY: 0, EASE: 'linear' }),
        blk('jimu_anim', { ELEMENT: star.id, ANIM: 'glowPulse', DUR: 1.2, DELAY: 0, EASE: 'easeInOutCubic' }),
        waitBlock(1.8),
        blk('jimu_scene_go', { SCENE: s1.id })
      ])] }
    };
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
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const isNext = e.key === 'ArrowRight';
        Executor.trigger('onKey', e.key).then(n => { if (!n) { isNext ? this.nextScene() : this.prevScene(); } });
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
