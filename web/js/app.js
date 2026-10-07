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
  audio: '🎵', chart: '📊', sprite: '🎞', model3d: '🧊', webapp: '🧩', slider: '🎚'
};

// 设置面板配置
const SETTING_DEFS = [
  { group: '编辑器', items: [
    { key: 'theme', label: '界面主题', type: 'select', options: [['dark', '深色'], ['light', '浅色'], ['national', '国庆专属 🎉']] },
    { key: 'autosaveMin', label: '自动保存间隔', type: 'select', hint: '自动保存到缓存，意外退出后可恢复', options: [[0, '关闭'], [1, '1 分钟'], [2, '2 分钟'], [5, '5 分钟']] },
    { key: 'alignGuides', label: '对齐辅助线', type: 'bool', hint: '拖动元素时显示吸附参考线' },
    { key: 'undoLimit', label: '撤销步数上限', type: 'select', options: [[30, '30 步'], [60, '60 步'], [100, '100 步']] },
    { key: 'blockCount', label: '显示积木块数', type: 'bool' },
    { key: 'blockSounds', label: '积木音效（重启生效）', type: 'bool' },
    { key: 'showHomeOnStart', label: '启动时显示主页', type: 'bool', hint: '主页含模板库、示例和最近文件' },
    { key: 'uiScale', label: '界面缩放', type: 'select', options: [[80, '80%'], [90, '90%'], [100, '100%'], [110, '110%'], [125, '125%']], hint: '全屏 / 大屏觉得界面太大就调小' }
  ] },
  { group: '播放与导出', items: [
    { key: 'defaultTransition', label: '默认章节转场时长', type: 'select', options: [[0.3, '0.3 秒'], [0.6, '0.6 秒'], [1, '1 秒']] },
    { key: 'hideCursor', label: '播放时自动隐藏鼠标', type: 'bool' },
    { key: 'pptRes', label: 'PPT 高保真分辨率', type: 'select', hint: '1080p 更清晰，文件更大', options: [[720, '720p'], [1080, '1080p']] },
    { key: 'pptQuality', label: 'PPT 图片质量', type: 'select', options: [[70, '标准 70%'], [85, '较高 85%'], [95, '最高 95%']] }
    ,
    { key: 'packCompress', label: '放映包图片自动压缩', type: 'bool', hint: '导出时把大图重编码为 JPEG（无透明图），显著减小体积；视频不受影响' }
  ] },
  { group: '渲染性能', items: [
    { key: 'ecoMode', label: '节能模式', type: 'bool', hint: '3D 与特效统一降为 30 帧' },
    { key: 'threeFps', label: '3D 模型帧率（播放）', type: 'select', options: [[30, '30 帧'], [60, '60 帧']] },
    { key: 'fxFps', label: '粒子 / 氛围特效帧率', type: 'select', options: [[30, '30 帧'], [60, '60 帧']] },
    { key: 'threeShadows', label: '3D 阴影', type: 'bool' },
    { key: 'showFps', label: '显示帧率计数器', type: 'bool' },
    { key: 'disableGpu', label: '禁用 GPU 加速（重启生效）', type: 'bool', hint: '画面花屏 / 白屏时打开自救' }
  ] },
  { group: '高级', items: [
    { key: 'showAdvanced', label: '显示「高级」积木分类', type: 'bool', hint: '执行代码等进阶积木；已放到工作区的块不受影响' },
    { key: 'cloneLimit', label: '克隆体上限', type: 'select', options: [[100, '100 个'], [200, '200 个'], [500, '500 个']] },
    { key: 'apiEnabled', label: 'AI 接口（HTTP API）（重启生效）', type: 'bool', hint: '供外部 AI 控制的本地接口' }
  ] },
  { group: 'AI 助手（DeepSeek）', items: [
    { key: 'aiKey', label: 'API Key', type: 'text', placeholder: 'sk-…（仅存本机）', hint: '在 platform.deepseek.com 获取；「✨ AI」按钮用一句话生成演示，按量计费约几分钱/次' },
    { key: 'aiModel', label: '模型', type: 'select', options: [['deepseek-chat', 'deepseek-chat（快·便宜）'], ['deepseek-reasoner', 'deepseek-reasoner（强·较贵）']] }
  ] }
];

// AI 生成器的系统提示（教 AI 输出积木剧场 DSL）
const AI_SYSTEM_PROMPT = `你是"积木剧场"（图形化积木演示工具）的演示生成器。
用户会用一句话描述想要的演示，你只输出一个 JSON 数组（不要 markdown 代码块、不要任何解释文字），数组元素是命令对象：
{"cmd":"text","name":"标题","text":"积木剧场","x":460,"y":400,"w":1000,"size":120,"color":"#E6E9EF","bold":true}
{"cmd":"shape","name":"装饰线","shape":"rect","fill":"#6C8CFF","x":860,"y":560,"w":200,"h":4}
{"cmd":"icon","name":"图标1","char":"🚀","x":420,"y":380,"size":140,"color":"#6C8CFF"}
{"cmd":"chapter","name":"封面","show":["标题","装饰线"],"bg":"#12101A"}
{"cmd":"anim","target":"标题","type":"fadeIn","duration":0.8,"delay":0}
{"cmd":"wait","sec":2}
{"cmd":"next"}
规则：
- 舞台尺寸 1920×1080；元素坐标不要重叠；文字宽 w 与字号匹配（64 号字 w≥600，120 号 w≥1000）
- 每章节用 {"cmd":"chapter"} 开始；show 列出该章节中可见的元素名（未列出的会隐藏）；bg 是十六进制背景色
- 动画类型只能从这些里选：fadeIn, flyInLeft, flyInRight, flyInTop, flyInBottom, zoomIn, rotateIn, bounceIn, flipIn, typewriter, pulse, shake, wobble, breathe, glowPulse
- 每个动画后可配 {"cmd":"wait","sec":N} 停留；章节末尾用 {"cmd":"next"} 推进（最后一章不加）
- 生成 2~3 个章节，每章 2~4 个元素；文案中文、简洁有力
- 只输出 JSON 数组：第一个字符必须是 [，最后一个字符必须是 ]`;

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
      const id = Executor.pickClickTarget(e.clientX, e.clientY);
      if (id) Executor.trigger('onElementClick', id);
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
      try {
        if (this.host.aiResult && this.host.aiResult.connect) {
          this.host.aiResult.connect((id, ok, content) => this.onAiResult(id, ok, content));
        }
      } catch (e) { }
    }
    this.applySettings();
    this.applyTheme(Settings.get('theme') || 'dark');
    this.applyLayoutPrefs();

    // 启动首屏：主页（模板 / 示例 / 最近文件）；带测试参数时不弹，避免干扰自动化
    if (!location.search && Settings.get('showHomeOnStart') !== false) {
      setTimeout(() => { try { this.showHome(); } catch (e) { } }, 350);
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
        const txt = data.elements.find(e => e.type === 'text');
        console.log(`P1TEST|unpack|${data.chapters.length}s ${data.resources.length}r text=${txt ? txt.props.text : 'none'}`);
        const same = back && back.length === b64.length;
        console.log(same ? 'P1TEST|PASS' : 'P1TEST|FAIL');
      } catch (e) {
        console.log('P1TEST|error|' + e.message);
      }
    }
    if (params.get('testsave2') === '1' && this.host) {
      await sleep(700);
      try {
        const tmp = '/tmp/opencode/save2-test.bdp';
        Project.filePath = tmp;
        await this.save();           // 已有 filePath → 应直接覆盖保存，不弹对话框
        const back = await this.host.readFileBase64(tmp);
        const ok = !!back;
        console.log(`SAVE2|overwrite=${ok}`);
        console.log(ok ? 'SAVE2|PASS' : 'SAVE2|FAIL');
        Project.filePath = null;
      } catch (e) {
        console.log('SAVE2|error|' + (e.message || e));
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
    if (params.get('testtheme') === 'national') {
      this.applyTheme('national');
      console.log('THEME|national|' + document.body.classList.contains('national'));
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
    if (params.get('testhotkeys') === '1') {
      await sleep(700);
      try {
        const fire = (init) => {
          const e = new KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, init));
          document.dispatchEvent(e);
          return e.defaultPrevented;
        };
        const p = fire({ key: 'p', ctrlKey: true });
        const u = fire({ key: 'u', ctrlKey: true });
        const z0 = fire({ key: '0', ctrlKey: true });
        const dev = fire({ key: 'i', ctrlKey: true, shiftKey: true });
        const f12 = fire({ key: 'F12' });
        const plain = !fire({ key: 'a' });
        const ok1 = p && u && z0 && dev && f12 && plain;
        console.log(`HOTKEY|p=${p}|u=${u}|0=${z0}|dev=${dev}|f12=${f12}|plain=${plain}`);
        console.log(ok1 ? 'HOTKEY|PASS' : 'HOTKEY|FAIL');
      } catch (e) { console.log('HOTKEY|error|' + (e.message || e)); }
    }
    if (params.get('testuiscale') === '1') {
      await sleep(700);
      try {
        const before = window.innerWidth;
        const orig = Settings.get('uiScale');
        Settings.set('uiScale', 80);
        await sleep(600);
        const after = window.innerWidth;
        const ok = after > before + 50;
        console.log(`UISCALE|before=${before}|after=${after}`);
        console.log(ok ? 'UISCALE|PASS' : 'UISCALE|FAIL');
        Settings.set('uiScale', orig || 100);   // 恢复原值，别覆盖用户设置
      } catch (e) {
        console.log('UISCALE|error|' + (e.message || e));
      }
    }
    if (params.get('testcanvaszoom') === '1') {
      await sleep(900);
      this.testCanvasZoom();
    }
    if (params.get('testplayview') === '1') {
      await sleep(900);
      this.testPlayView();
    }
    if (params.get('testlayout') === '1') {
      await sleep(900);
      this.testLayout();
    }
    if (params.get('testelbar') === '1') {
      await sleep(900);
      this.testElbar();
    }
    if (params.get('testrecord') === '1') {
      await sleep(900);
      this.testRecord();
    }
    if (params.get('testctabs') === '1') {
      await sleep(700);
      try {
        const el = Project.data.elements[0];
        this.selectElement(el.id, true);       // ① 元素条点击：选中 + 切到它的脚本
        await sleep(350);
        const tab = document.querySelector('#tab-el');
        const active1 = !!(tab && tab.classList.contains('active') && tab.textContent.includes(el.name));
        this.switchTab('global');               // 回全局
        await sleep(250);
        Editor.select(null);                    // ② 无选中 + 全局 → 提示
        await sleep(250);
        const tip = document.querySelector('#script-tabs .tab-tip');
        Editor.select(el.id);                   // ③ 舞台点选（不切脚本）→ 非 active 元素 tab
        await sleep(250);
        const tab2 = document.querySelector('#tab-el');
        const nonActive = !!(tab2 && !tab2.classList.contains('active') && tab2.textContent.includes(el.name));
        const ok = active1 && !!tip && nonActive;
        console.log(`CTABS|active=${active1}|tip=${!!tip}|nonactive=${nonActive}`);
        console.log(ok ? 'CTABS|PASS' : 'CTABS|FAIL');
        this.selectElement(el.id, true);        // 还原
      } catch (e) {
        console.log('CTABS|error|' + (e.message || e));
      }
    }
    if (params.get('testtemplates') === '1') {
      await sleep(800);
      try {
        const results = Templates.list.map(t => {
          JimuBlocks.ws.clear();
          JimuBlocks.current = null;
          Project.newProject(t.name);
          Templates.build(t.key);
          const elOk = Project.data.elements.length > 0 && Project.data.chapters.length > 0;
          // 真实编译链路：孤儿积木必须为 0，且至少有一段脚本
          let info = '', compOk = false;
          try {
            const c = Executor.compileAll();
            const total = (c.global || []).length
              + Object.keys(c.elements || {}).length
              + Object.values(c.scenes || {}).reduce((n, l) => n + (l ? l.length : 0), 0);
            compOk = (c.orphans === 0) && total > 0;
            info = `o=${c.orphans} s=${total}`;
          } catch (e) { info = 'err:' + (e.message || e).slice(0, 60); }
          const ok = elOk && compOk;
          return `${t.key}=${ok ? 'ok' : 'FAIL'}(${Project.data.elements.length}el/${Project.data.chapters.length}ch/${info})`;
        });
        JimuBlocks.ws.clear();
        JimuBlocks.current = null;
        Project.newProject('测试收尾');
        Stage.renderAll();
        console.log('TPL|' + results.join('|'));
        console.log(results.every(r => !r.includes('FAIL')) ? 'TPL|PASS' : 'TPL|FAIL');
      } catch (e) {
        console.log('TPL|error|' + (e.message || e));
      }
    }
    if (params.get('testfx') === '1') {
      await sleep(900);
      this.testFx();
    }
    if (params.get('testinteract') === '1') {
      await sleep(900);
      this.testInteractive();
    }
    if (params.get('testplaytpl') === '1') {
      await sleep(900);
      this.testPlayTemplates();
    }
    if (params.get('testtplshot')) {
      await sleep(500);
      const key = params.get('testtplshot');
      JimuBlocks.ws.clear();
      JimuBlocks.current = null;
      Project.newProject(key);
      Templates.build(key);
      Stage.renderAll();
      Stage.goChapter(Project.data.chapters[0].id, { instant: true });
      this.activeTab = 'global';
      JimuBlocks.switchTo('global');
      this.renderTabs();
      this.renderScriptTabs();
      this.renderElementBar();
      Panel.show();
      console.log('TPLSHOT|loaded|' + key);
    if (params.get('testtplplay') === '1') {
        await sleep(700);
        await this.play();
        console.log('TPLSHOT|playing');
      }
    }
    if (params.get('testpexport')) {
      // 导出指定模板的放映包 HTML（供 --test-url 打开验证交互链路）
      await sleep(600);
      const key = params.get('testpexport');
      JimuBlocks.ws.clear();
      JimuBlocks.current = null;
      Project.newProject(key);
      Templates.build(key);
      Stage.renderAll();
      Stage.goChapter(Project.data.chapters[0].id, { instant: true });
      try {
        const html = await this.buildPlayerHtml();
        const b64 = btoa(unescape(encodeURIComponent(html)));
        const out = '/tmp/jimuchang-regress/' + key + '-player.html';
        const ok = await this.host.saveProjectDirect(out, b64);
        console.log('PEXP|' + (ok ? 'saved' : 'fail') + '|' + out + '|' + b64.length);
      } catch (e) {
        console.log('PEXP|error|' + (e.message || e));
      }
    }
    if (params.get('testblocks2') === '1') {
      await sleep(900);
      this.testBlocks2();
    }
    if (params.get('testblocks3') === '1') {
      await sleep(900);
      this.testBlocks3();
    }
    if (params.get('testbroadcast') === '1') {
      await sleep(900);
      this.testBroadcast();
    }
    if (params.get('testfunc') === '1') {
      await sleep(900);
      this.testFunc();
    }
    if (params.get('testsearch') === '1') {
      await sleep(900);
      this.testSearch();
    }
    if (params.get('testpack') === '1') {
      await sleep(900);
      this.testPack();
    }
    if (params.get('testai') === '1') {
      await sleep(900);
      this.testAi();
    }
    if (params.get('testperf') === '1') {
      await sleep(900);
      this.testPerf();
    }
    if (params.get('testexe') === '1') {
      await sleep(900);
      this.testExe();
    }
  },

  bindUI() {
    const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
    on('btn-new', () => this.newProject());
    on('btn-open', () => this.open());
    on('btn-save', () => this.save());
    on('btn-save-as', () => this.saveAs());
    on('btn-undo', () => History.undo());
    on('btn-redo', () => History.redo());
    on('btn-play', () => this.play());
    on('btn-toggle-left', () => this.toggleLeftCollapse());
    this.initLayoutUI();
    this.initElementBarUI();
    on('btn-demo', () => this.loadDemo());
    on('btn-add-text', () => Editor.addElement('text'));
    on('btn-add-image', () => this.addMediaElement('image'));
    on('btn-add-video', () => this.addMediaElement('video'));
    on('btn-add-audio', () => this.addMediaElement('audio'));
    on('btn-add-shape', () => Editor.addElement('shape'));
    on('btn-add-icon', () => Editor.addElement('icon'));
    on('btn-add-chart', () => Editor.addElement('chart'));
    on('btn-add-slider', () => Editor.addElement('slider'));
    on('btn-add-sprite', () => Editor.addElement('sprite'));
    on('btn-add-model3d', () => Editor.addElement('model3d'));
    on('btn-add-webapp', () => Editor.addElement('webapp'));
    on('btn-export-main', () => this.openExportPanel());
    on('btn-export-close', () => this.closeExportPanel());
    on('card-export-html', () => { this.closeExportPanel(); this.exportPlayer(); });
    on('card-export-exe', () => { this.closeExportPanel(); this.exportExe(); });
    on('card-export-ppt', () => { this.closeExportPanel(); this.showPptDialog(); });
    on('card-export-video', () => { this.closeExportPanel(); this.openVideoDialog(); });
    on('btn-video-start', () => this.startVideoRecord());
    on('ppt-generate', () => this.generatePpt());
    on('btn-restore-autosave', () => this.restoreAutosave());
    on('btn-help', () => this.toggleHelp());
    on('btn-ai', () => this.openAi());
    on('btn-ai-close', () => document.getElementById('ai-overlay').classList.add('hidden'));
    on('ai-send', () => this.aiGenerate());
    const aiInput = document.getElementById('ai-input');
    if (aiInput) {
      aiInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.aiGenerate(); }
      });
    }
    on('btn-settings', () => this.openSettings());
    on('btn-settings-close', () => this.closeSettings());
    on('btn-theme', () => this.toggleTheme());
    on('btn-home', () => this.showHome());
    on('home-new', () => { document.getElementById('home-overlay').classList.add('hidden'); this.newProject(); });
    on('home-demo', () => { document.getElementById('home-overlay').classList.add('hidden'); this.loadDemo(); });
    on('home-open', () => { document.getElementById('home-overlay').classList.add('hidden'); this.open(); });
    on('home-ai', () => { document.getElementById('home-overlay').classList.add('hidden'); this.openAi(); });
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
    // 内核治理：阻止文件拖入触发页面导航（拖入 .bdp 打开功能后续再做）
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => e.preventDefault());
    // 禁止触摸板双指捏合缩放整个页面（Ctrl+Wheel 网页缩放）；积木区放行（Blockly 用它缩放）
    document.addEventListener('wheel', e => {
      if (e.ctrlKey && !(e.target && e.target.closest && e.target.closest('#blocklyDiv'))) {
        e.preventDefault();
      }
    }, { passive: false });
    window.addEventListener('mousemove', () => {
      if (!this.playing) return;
      document.body.classList.remove('hide-cursor');
      this.armCursorHide();
    });
  },

  applyTheme(mode) {
    this.themeMode = mode;
    document.body.classList.toggle('light', mode === 'light');
    document.body.classList.toggle('national', mode === 'national');
    try { if (JimuBlocks && JimuBlocks.setTheme) JimuBlocks.setTheme(mode); } catch (e) { }
    try {
      if (typeof Festive !== 'undefined') {
        if (mode === 'national') Festive.start(); else Festive.stop();
      }
    } catch (e) { }
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = mode === 'light' ? '🌙' : (mode === 'national' ? '🎉' : '☀');
    JimuBlocks.setTheme(mode);
    Settings.set('theme', mode);
  },

  toggleTheme() {
    const order = ['dark', 'light', 'national'];
    const i = order.indexOf(this.themeMode || 'dark');
    this.applyTheme(order[(i + 1) % order.length]);
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
    const activeElId = active.indexOf('el:') === 0 ? active.slice(3) : null;
    const activeEl = activeElId ? Project.getElement(activeElId) : null;
    const selEl = Editor.selectedId ? Project.getElement(Editor.selectedId) : null;
    // 元素脚本唯一入口：舞台点选 / 舞台下方元素条。这里只跟随显示，不再另设下拉。
    const show = activeEl || selEl;
    let html = `<div class="tab${active === 'global' ? ' active' : ''}" data-key="global" title="全局脚本（当演示开始 / 按下键 / 收到消息）">全局</div>`;
    if (show) {
      const on = active === 'el:' + show.id;
      html += `<div class="tab${on ? ' active' : ''}" id="tab-el" data-key="el:${show.id}" title="${on ? '正在编辑：' : '点击编辑：'}${esc(show.name)} 的脚本">`
        + `<span class="el-ico">${ELEMENT_ICONS[show.type] || '◻'}</span>${esc(show.name)}</div>`;
    } else {
      html += `<div class="tab tab-tip" title="在舞台上点选元素，或点击下方元素条">选中元素编辑脚本</div>`;
    }
    box.innerHTML = html;
    box.querySelector('[data-key="global"]').onclick = () => this.switchTab('global');
    const te = box.querySelector('#tab-el');
    if (te) te.onclick = () => this.switchTab(te.dataset.key);
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
    const prevScroll = box.scrollLeft;
    const sel = Editor.selectedId;
    if (!Project.data.elements.length) {
      box.innerHTML = '<span class="el-bar-note">暂无元素：用工具栏「＋」添加，或从下方属性面板编辑舞台</span>';
      this.updateElBarArrows();
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
    // 重渲染不丢滚动位置；选中的元素始终滚入视野（覆盖新建元素追加到尾部的情况）
    box.scrollLeft = Math.min(prevScroll, Math.max(0, box.scrollWidth - box.clientWidth));
    const chip = sel ? box.querySelector(`.el-chip[data-id="${sel}"]`) : null;
    if (chip) {
      const bl = chip.offsetLeft, br = bl + chip.offsetWidth;
      if (bl < box.scrollLeft + 4) box.scrollLeft = Math.max(0, bl - 8);
      else if (br > box.scrollLeft + box.clientWidth - 4) box.scrollLeft = br - box.clientWidth + 8;
    }
    this.updateElBarArrows();
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
    this.activeTab = key;              // 先更新上下文：switchTo 内刷新空提示时要用
    JimuBlocks.switchTo(key);
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

  // ---------- 导出面板（集成入口） ----------
  openExportPanel() {
    const ov = document.getElementById('export-overlay');
    if (ov) ov.classList.remove('hidden');
  },

  closeExportPanel() {
    const ov = document.getElementById('export-overlay');
    if (ov) ov.classList.add('hidden');
  },

  // ---------- 导出放映包 ----------
  // 资源压缩：大图重编码为 JPEG（有透明保留原图；视频/音频/SVG/GIF 跳过）
  async compressResources(resources) {
    const out = [];
    for (const r of (resources || [])) {
      let data = r.data;
      const mime = r.mime || '';
      if (data && data.length > 100000 && mime.indexOf('image/') === 0
        && mime !== 'image/svg+xml' && mime !== 'image/gif') {
        try {
          const d2 = await this.recompressImage(data, mime);
          if (d2 && d2.length < data.length) data = d2;
        } catch (e) { }
      }
      out.push(Object.assign({}, r, { data }));
    }
    return out;
  },

  recompressImage(b64, mime, maxDim = 1600, q = 0.82) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          let w = img.width, h = img.height;
          const k = Math.min(1, maxDim / Math.max(w, h));
          w = Math.max(1, Math.round(w * k));
          h = Math.max(1, Math.round(h * k));
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          // 透明抽样检测：有透明保持原图，否则转 JPEG
          let hasAlpha = false;
          try {
            const d = ctx.getImageData(0, 0, w, h).data;
            for (let i = 3; i < d.length; i += 40) { if (d[i] < 250) { hasAlpha = true; break; } }
          } catch (e) { }
          resolve(hasAlpha ? b64 : c.toDataURL('image/jpeg', q).split(',')[1]);
        } catch (e) { resolve(b64); }
      };
      img.onerror = () => resolve(b64);
      img.src = 'data:' + mime + ';base64,' + b64;
    });
  },

  async buildPlayerHtml() {
    JimuBlocks.save();
    const scripts = Executor.compileAll();
    const projectData = JSON.parse(JSON.stringify(Project.data));
    // 资源压缩（图片重编码，减小放映包体积）
    if (Settings.get('packCompress')) {
      try { projectData.resources = await this.compressResources(projectData.resources); } catch (e) { }
    }
    const has3d = projectData.elements.some(e => e.type === 'model3d');
    const files = ['easing.js', 'project.js', 'audio.js', 'effects.js', 'sprites.js', 'three-scene.js',
      'elements.js', 'stage.js', 'pen.js', 'animations.js', 'keyframes.js', 'executor.js',
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
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>${title}</title>
<style>
${css}
html, body { height: 100%; overflow: hidden; touch-action: none; -webkit-user-select: none; user-select: none; }
#rotate-hint {
  position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
  color: rgba(255, 255, 255, .45); font-size: 12px; display: none; z-index: 20;
  pointer-events: none;
}
@media (orientation: portrait) { #rotate-hint { display: block; } }
</style>
</head>
<body class="playing">
<div id="stage-wrap"></div>
<div id="play-hint">空格 推进 · ← → 切章节 · 手机左右滑动切换 · 双击全屏</div>
<div id="rotate-hint">📱 横屏观看效果更佳</div>
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
    if (path) {
      let resMb = 0;
      try { (Project.data.resources || []).forEach(r => { resMb += ((r.data || '').length * 0.75) / 1048576; }); } catch (e) { }
      const mb = (html.length * 0.75 / 1048576);
      toast('已导出（' + mb.toFixed(1) + ' MB' + (resMb > 0.5 ? '，其中素材约 ' + resMb.toFixed(1) + ' MB' : '') + '）：' + path.split('/').pop());
    }
    return path;
  },

  // 导出 Windows 单文件程序（.exe：外壳 + HTML 内嵌）
  async exportExe() {
    if (!this.host) { toast('浏览器预览模式无法导出'); return; }
    await this.hostReady;
    toast('正在打包 Windows 程序…');
    const html = await this.buildPlayerHtml();
    const b64 = btoa(unescape(encodeURIComponent(html)));
    const path = await this.host.exportExe(b64, (Project.data.name || '未命名演示') + '.exe');
    if (path) toast('已导出：' + path.split('/').pop() + '（拷到 Windows 双击全屏播放）');
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
    await this.enterPlayMode();
    await this.runPlayScripts();
  },

  // 进入播放态（数据快照 + 全屏 + 视图隔离），不启动脚本——录制视频时先把这些就绪再开录
  async enterPlayMode() {
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
    Stage.enterPlayView();
    if (this.host) await this.host.setFullscreen(true);
    await sleep(120);
    Stage.fit();
    Editor.select(null);
  },

  async runPlayScripts() {
    try {
      await Executor.start();
      const n = Executor.scripts.orphans || 0;
      if (n > 0) toast(`有 ${n} 段积木没有"当…"事件开头，不会执行`);
    } catch (e) {
      console.error('播放出错', e);
    }
  },

  // ---------- 视频录制（自动录制演示 → MP4；含真实时间戳与黑帧跳过） ----------
  openVideoDialog() {
    const ov = document.getElementById('video-overlay');
    if (ov) ov.classList.remove('hidden');
  },

  async startVideoRecord() {
    if (!this.host || !this.host.recordStart) { toast('当前环境不支持录制'); return; }
    if (this.playing) { toast('正在播放中，无法开始录制'); return; }
    const fps = parseInt(document.getElementById('video-fps').value, 10) || 24;
    const res = document.getElementById('video-res').value === '1080' ? [1920, 1080] : [1280, 720];
    document.getElementById('video-overlay').classList.add('hidden');
    await this.enterPlayMode();
    const first = Project.data.chapters[0];
    if (first) await Stage.goChapter(first.id, { instant: true });
    await sleep(260);
    const r = Stage.rootEl.getBoundingClientRect();
    const ok = await this.host.recordStart(fps, res[0], res[1],
      Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height));
    if (!ok) { toast('录制启动失败'); this.stop(); return; }
    this.recording = { fps, w: res[0], h: res[1], t0: Date.now() };
    this.showRecHint();
    toast('录制中——演示播完后按 Esc 结束');
    await this.runPlayScripts();
  },

  showRecHint() {
    const el = document.getElementById('rec-hint');
    if (!el) return;
    el.classList.add('show');
    this.positionRecHint();
    clearInterval(this._recTimer);
    this._recTimer = setInterval(() => {
      const t = document.getElementById('rec-time');
      if (t && this.recording) {
        const s = Math.floor((Date.now() - this.recording.t0) / 1000);
        t.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      }
      this.positionRecHint();
    }, 400);
  },

  // 把录制 HUD 放到舞台矩形之外的黑边里（避免被录进视频）；四周都放不下时缩成小圆点
  positionRecHint() {
    const el = document.getElementById('rec-hint');
    if (!el || !el.classList.contains('show') || !Stage.rootEl) return;
    el.classList.remove('mini');
    const r = Stage.rootEl.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const W = el.offsetWidth || 150, H = el.offsetHeight || 30, gap = 6;
    const sTop = r.top, sBottom = vh - r.bottom, sLeft = r.left, sRight = vw - r.right;
    if (sTop >= H + gap) {
      el.style.left = Math.round(r.left + r.width / 2 - W / 2) + 'px';
      el.style.top = Math.round(Math.max(2, (sTop - H) / 2)) + 'px';
    } else if (sBottom >= H + gap) {
      el.style.left = Math.round(r.left + r.width / 2 - W / 2) + 'px';
      el.style.top = Math.round(r.bottom + (sBottom - H) / 2) + 'px';
    } else if (sLeft >= W + gap) {
      el.style.left = Math.round(Math.max(2, (sLeft - W) / 2)) + 'px';
      el.style.top = Math.round(vh / 2 - H / 2) + 'px';
    } else if (sRight >= W + gap) {
      el.style.left = Math.round(r.right + (sRight - W) / 2) + 'px';
      el.style.top = Math.round(vh / 2 - H / 2) + 'px';
    } else {
      el.classList.add('mini');   // 舞台几乎满屏：只留一个小红点（尽量少占画面）
      el.style.left = '4px';
      el.style.top = '4px';
    }
  },

  hideRecHint() {
    clearInterval(this._recTimer);
    const el = document.getElementById('rec-hint');
    if (el) el.classList.remove('show');
  },

  // 结束录制：停帧 → 退出播放 → 选路径 → ffmpeg 合成
  async stopVideoRecord() {
    if (!this.recording) return;
    this.recording = null;
    this.hideRecHint();
    const frames = await this.host.recordStop();
    this.stop();
    if (!frames || frames < 3) { toast('录制太短，未生成视频'); return; }
    const defName = (Project.data.name || '演示') + '.mp4';
    const path = await this.host.recordSaveDialog(defName);
    if (!path) { toast('已取消导出（录制内容已丢弃）'); return; }
    toast('正在合成视频（' + frames + ' 帧）…');
    const out = await this.host.recordFinish(path);
    if (out) toast('视频已导出：' + out.split('/').pop());
    else toast('视频合成失败（逐帧临时文件保留在 ~/.cache/jimuchang/rec）');
  },

  cloneForPlayback(data) {
    const clone = JSON.parse(JSON.stringify(Object.assign({}, data, { resources: [] })));
    clone.resources = data.resources;
    return clone;
  },

  // INTTEST 测试：交互三件套（滑块 / 图表读写+点击 / 悬停）+ 克隆体交互回退
  async testInteractive() {
    const check = (name, ok) => console.log(`INTTEST|${name}|${ok ? 'ok' : 'FAIL'}`);
    const results = [];
    const eq = (name, ok) => { results.push(ok); check(name, ok); return ok; };
    try {
      Project.newProject('交互测试');
      Project.data.elements.length = 0;
      const slider = Project.createElement('slider', { name: '测试滑块' });
      const chart = Project.createElement('chart', { name: '测试图表' });
      const box = Project.createElement('shape', { name: '测试方块', x: 300, y: 200, w: 200, h: 200 });
      Stage.renderAll();
      await sleep(400);   // 等图表 setTimeout 初始化

      // 1. 滑块渲染（min/max/value 正确）
      const sDom = Stage.elDom(slider.id);
      const inp = sDom && sDom.querySelector('input[type=range]');
      eq('slider-render', !!(inp && inp.min === '0' && inp.max === '100' && inp.value === '50'));

      // 2. slider.set 指令写值（DOM + props）
      await Executor.exec({ op: 'slider.set', elId: slider.id, value: { k: 'num', v: 80 } }, { vars: Executor.vars });
      await sleep(30);
      eq('slider-set', !!(inp && inp.value === '80' && slider.props.value === 80));

      // 3. 滑块事件 + 读取值（模拟播放态拖动）
      Executor.playing = true;
      Executor.scripts = {
        global: [{ kind: 'onSliderChange', elId: slider.id, body: [
          { op: 'var.set', name: 'sv', value: { k: 'slider', el: slider.id } }] }],
        scenes: {}, elements: {}
      };
      inp.value = '37';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(140);
      eq('slider-event', Executor.vars.sv === 37);

      // 4. 图表数据写入（props + ECharts 实例同步）
      const cDom = Stage.elDom(chart.id);
      const cInst = cDom && cDom.querySelector('.c-chart');
      await Executor.exec({ op: 'chart.set', elId: chart.id, value: { k: 'str', v: '10,20,30' } }, { vars: Executor.vars });
      await Executor.exec({ op: 'chart.cats', elId: chart.id, value: { k: 'str', v: '甲,乙,丙' } }, { vars: Executor.vars });
      await sleep(80);
      const opt = cInst && cInst._chart ? cInst._chart.getOption() : null;
      const vals = opt && opt.series && opt.series[0] ? opt.series[0].data : null;
      const cats = opt && opt.xAxis && opt.xAxis[0] ? opt.xAxis[0].data : null;
      eq('chart-data', !!(chart.props.values.join() === '10,20,30' && chart.props.categories.join() === '甲,乙,丙'
        && vals && vals.join() === '10,20,30' && cats && cats.join() === '甲,乙,丙'));

      // 5. 图表点击（类别 / 数值 / 序号）
      Executor.scripts.global.push({ kind: 'onChartClick', elId: chart.id, body: [
        { op: 'var.set', name: 'ck', value: { k: 'chartclick', what: 'name' } },
        { op: 'var.set', name: 'cv', value: { k: 'chartclick', what: 'value' } },
        { op: 'var.set', name: 'ci', value: { k: 'chartclick', what: 'index' } }
      ] });
      Elements.onChartClick(chart.id, { name: '甲', value: 10, dataIndex: 0, seriesName: '数据' });
      await sleep(140);
      eq('chart-click', Executor.vars.ck === '甲' && Executor.vars.cv === 10 && Executor.vars.ci === 1);

      // 6. 悬停进入 / 离开
      Executor.scripts.global.push({ kind: 'onMouseEnter', elId: box.id, body: [{ op: 'var.set', name: 'hov', value: { k: 'num', v: 1 } }] });
      Executor.scripts.global.push({ kind: 'onMouseLeave', elId: box.id, body: [{ op: 'var.set', name: 'hov', value: { k: 'num', v: 2 } }] });
      const br6 = Stage.elDom(box.id).getBoundingClientRect();
      Stage.rootEl.dispatchEvent(new MouseEvent('mouseover', {
        bubbles: true, clientX: br6.left + br6.width / 2, clientY: br6.top + br6.height / 2
      }));
      await sleep(60);
      const inOk = Executor.vars.hov === 1;
      Stage.rootEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 5, clientY: 5 }));
      await sleep(60);
      eq('hover', inOk && Executor.vars.hov === 2);

      // 7. 克隆体交互回退（点克隆体 → 执行模板脚本，self=克隆体）
      const tmpl = Project.createElement('icon', { name: '克隆模板', x: 500, y: 500 });
      Stage.renderAll();
      Executor.scripts.elements[tmpl.id] = [{ kind: 'onElementClick', elId: '@self', body: [
        { op: 'var.set', name: 'selfHit', value: { k: 'num', v: 1 } },
        { op: 'el.change', elId: '@self', prop: 'x', delta: { k: 'num', v: 5 } }
      ] }];
      const before = Project.data.elements.length;
      await Executor.exec({ op: 'el.clone.start', elId: tmpl.id }, { vars: Executor.vars });
      await sleep(100);
      const clone = Project.data.elements.find(e => e._templateId === tmpl.id);
      Executor.trigger('onElementClick', clone ? clone.id : 'none');
      await sleep(140);
      eq('clone-interact', !!(clone && Project.data.elements.length === before + 1
        && Executor.vars.selfHit === 1 && clone.x === tmpl.x + 5));

      // 8. 元素脚本引用其他元素（自我版=@self；普通块=下拉选定元素）
      {
        const w1 = new Blockly.Workspace();
        Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [{
          type: 'jimu_self_on_click', next: { block: {
            type: 'jimu_el_text', fields: { ELEMENT: box.id },
            inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: 'hi' } } } }
          } }
        }] } }, w1);
        const ir1 = IRCompiler.compileWorkspace(w1, { selfMode: true });
        w1.dispose();
        const ins1 = ir1[0] && ir1[0].body && ir1[0].body[0];
        const w2 = new Blockly.Workspace();
        Blockly.serialization.workspaces.load({ blocks: { languageVersion: 0, blocks: [{ type: 'jimu_self_slider_value' }] } }, w2);
        const ex2 = IRCompiler.exprOf(w2.getTopBlocks(false)[0]);
        w2.dispose();
        eq('self-other-el', !!(ins1 && ins1.op === 'el.text' && ins1.elId === box.id
          && ex2 && ex2.k === 'slider' && ex2.el === '@self'));
      }

      // 9. .bdp 保存往返（滑块属性 / 克隆引用字段保真）
      {
        const b64 = await Project.pack();
        const sliderN = Project.data.elements.filter(e => e.type === 'slider').length;
        const cloneN = Project.data.elements.filter(e => e._clone).length;
        await Project.unpack(b64);
        const s3 = Project.data.elements.find(e => e.type === 'slider');
        const c3 = Project.data.elements.filter(e => e._clone);
        eq('bdp-roundtrip', !!s3
          && Project.data.elements.filter(e => e.type === 'slider').length === sliderN
          && s3.props.min === 0 && s3.props.max === 100 && s3.props.value === 80
          && c3.length === cloneN && c3.every(e => !!e._templateId));
      }

      Executor.playing = false;
      console.log(results.every(Boolean) ? 'INTTEST|PASS' : 'INTTEST|FAIL');
    } catch (e) {
      console.log('INTTEST|error|' + (e.message || e));
      console.log('INTTEST|FAIL');
    }
  },

  // PLAYTPL 测试：交互模板的真实播放链路（加载 → 播放 → 模拟用户操作 → 校验响应）
  // 说明：测试期间屏蔽真实全屏，避免干扰用户；播放/快照/脚本链路完整执行。
  async testPlayTemplates() {
    const eq = (name, ok) => console.log(`PLAYTPL|${name}|${ok ? 'ok' : 'FAIL'}`);
    const results = [];
    const css = (elId) => {
      const d = Stage.elDom(elId);
      const t = d && d.querySelector('.c-text');
      return t ? t.textContent : '';
    };
    const findByName = n => (Project.data.elements || []).find(e => e.name === n);
    // 元素逻辑坐标（比例 0-1）→ 屏幕坐标（动态缩放/动画不影响）
    const screenAt = (el, fx, fy) => {
      const r = Stage.rootEl.getBoundingClientRect();
      return { x: r.left + (el.x + el.w * fx) * Stage.scale, y: r.top + (el.y + el.h * fy) * Stage.scale };
    };
    let fsOrig = null;
    try {
      if (this.host && this.host.setFullscreen) {
        try { fsOrig = this.host.setFullscreen; this.host.setFullscreen = () => Promise.resolve(); } catch (e) { fsOrig = null; }
      }
      // ---- ① 数据看板：点按钮切区域 + 点柱条看详情 ----
      console.log('PLAYTPL|stage|dash');
      JimuBlocks.ws.clear(); JimuBlocks.current = null;
      Project.newProject('看板测试');
      Templates.build('dashboard');
      Stage.renderAll();
      await this.enterPlayMode();
      this.runPlayScripts();   // 不等待进场链，模拟用户在动画播放中途交互
      await sleep(1700);
      const btnHn = findByName('按钮·华南');
      const chartEl = (Project.data.elements || []).find(e => e.type === 'chart');
      const detailEl = (Project.data.elements || []).find(e => e.type === 'text' && /点击图表上的柱条/.test(e.props.text));
      // 真实命中链路：点按钮文字中心 → 应穿透到按钮（图形）触发其点击脚本
      const txtHn = (Project.data.elements || []).find(e => e.type === 'text' && e.props.text === '华南');
      const ptB = screenAt(txtHn, 0.5, 0.5);
      const pidB = Executor.pickClickTarget(ptB.x, ptB.y);
      results.push(pidB === btnHn.id);
      eq('dash-hit-through', results[results.length - 1]);
      Executor.trigger('onElementClick', pidB);
      await sleep(400);
      const cNow = (Project.data.elements || []).find(e => e.type === 'chart');
      results.push(cNow.props.values.join() === '90,140,210,180' && css(detailEl.id).indexOf('华南区') === 0);
      eq('dash-btn', results[results.length - 1]);
      Elements.onChartClick(chartEl.id, { name: 'Q2', value: 140, dataIndex: 1, seriesName: '销售额' });
      await sleep(300);
      results.push(css(detailEl.id) === '你点了 Q2 季度：140');
      eq('dash-chart-click', results[results.length - 1]);
      this.stop();
      await sleep(300);

      // ---- ② 报价单：点卡片切换价格 + 悬停上浮还原 ----
      console.log('PLAYTPL|stage|quote');
      Project.newProject('报价测试');
      Templates.build('quote');
      Stage.renderAll();
      await this.enterPlayMode();
      this.runPlayScripts();
      await sleep(1700);
      const card2 = findByName('卡片·专业版');
      const bigEl = (Project.data.elements || []).find(e => e.type === 'text' && e.props.size === 92);
      const price2 = (Project.data.elements || []).find(e => e.type === 'text' && e.props.text === '¥299');
      const pt2 = screenAt(price2, 0.5, 0.5);
      const pid2 = Executor.pickClickTarget(pt2.x, pt2.y);
      results.push(pid2 === card2.id);
      eq('quote-hit-through', results[results.length - 1]);
      Executor.trigger('onElementClick', pid2);
      await sleep(400);
      const card2Now = findByName('卡片·专业版');
      results.push(card2Now.props.fill === '#243050' && css(bigEl.id) === '¥299');
      if (!results[results.length - 1]) {
        const textsNow = (Project.data.elements || []).filter(e => e.type === 'text').map(e => e.props.text).join(' / ');
        console.log(`PLAYTPL|quote-debug|fill=${card2Now.props.fill}|big=${css(bigEl.id)}|texts=${textsNow}`);
      }
      eq('quote-click', results[results.length - 1]);
      const card3 = findByName('卡片·旗舰版');
      const y0 = card3.y;
      // 悬停穿透：把鼠标"放到卡片里的文字上"，应识别为悬停卡片
      const hoverTxt = (Project.data.elements || []).find(e => e.type === 'text' && e.props.text && e.props.text.indexOf('不限人数') === 0);
      const ph = screenAt(hoverTxt, 0.5, 0.5);
      Stage.rootEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: ph.x, clientY: ph.y }));
      await sleep(250);
      const yHover = findByName('卡片·旗舰版').y;
      Stage.rootEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 5, clientY: 5 }));
      await sleep(250);
      const yOut = findByName('卡片·旗舰版').y;
      results.push(yHover === y0 - 10 && yOut === y0);
      if (!results[results.length - 1]) {
        const kinds = (Executor.scriptsFor(card3.id) || []).map(s => s.kind).join(',');
        console.log(`PLAYTPL|hover-debug|y0=${y0}|yHover=${yHover}|yOut=${yOut}|kinds=${kinds}|hoverId=${Stage._hoverId}`);
      }
      eq('quote-hover', results[results.length - 1]);
      this.stop();
      await sleep(300);

      // ---- ③ 抛体实验：点发射后小球按轨迹运动 ----
      console.log('PLAYTPL|stage|physics');
      Project.newProject('抛体测试');
      Templates.build('physics');
      Stage.renderAll();
      await this.enterPlayMode();
      this.runPlayScripts();
      await sleep(1700);
      const launch = findByName('发射按钮');
      const x0 = findByName('小球').x;
      const btnTxtEl = (Project.data.elements || []).find(e => e.type === 'text' && e.props.text === '🚀 发射');
      const ptL = screenAt(btnTxtEl, 0.5, 0.5);
      const pidL = Executor.pickClickTarget(ptL.x, ptL.y);
      results.push(pidL === launch.id);
      eq('physics-hit-through', results[results.length - 1]);
      Executor.trigger('onElementClick', pidL);
      await sleep(800);
      const ballNow = findByName('小球');
      results.push(ballNow.x > x0 + 50 && ballNow.y < 828 + 60);
      if (!results[results.length - 1]) console.log(`PLAYTPL|physics-debug|x0=${x0}|x=${ballNow.x}|y=${ballNow.y}|playing=${Executor.playing}`);
      eq('physics-launch', results[results.length - 1]);
      this.stop();
      await sleep(300);

      console.log(results.every(Boolean) ? 'PLAYTPL|PASS' : 'PLAYTPL|FAIL');
    } catch (e) {
      console.log('PLAYTPL|error|' + (e.message || e));
      console.log('PLAYTPL|FAIL');
    } finally {
      if (fsOrig && this.host) { try { this.host.setFullscreen = fsOrig; } catch (e) { } }
    }
  },

  // FX 测试：属性面板"背景特效"应写入舞台级 stage.fx 并渲染（回归 2026-10-05 fx 面板失效修复）
  async testFx() {
    try {
      Editor.select(null);
      Panel.show();
      await sleep(300);
      const sel = document.querySelector('#props select[data-prop="fx.type"]');
      if (!sel) { console.log('FXTEST|no-select'); return; }
      sel.value = 'starfield';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(500);
      const stageOk = !!(Project.data.stage.fx && Project.data.stage.fx.type === 'starfield');
      const canvasOk = !!document.querySelector('.scene-fx');
      console.log(`FXTEST|stage=${stageOk}|canvas=${canvasOk}`);
      console.log((stageOk && canvasOk) ? 'FXTEST|PASS' : 'FXTEST|FAIL');
      Project.data.stage.fx = null;
      Stage.renderAll();
      console.log(!document.querySelector('.scene-fx') ? 'FXTEST|cleanup|PASS' : 'FXTEST|cleanup|FAIL');
    } catch (e) {
      console.log('FXTEST|error|' + (e.message || e));
    }
  },

  // ZOOM 测试：画布缩放 / 平移 / 锚点 / 快捷键 / 缩放下的拖拽换算
  async testCanvasZoom() {
    const results = [];
    const check = (name, ok) => { results.push(`${name}=${ok ? 'ok' : 'FAIL'}`); return ok; };
    try {
      const wrap = document.getElementById('stage-wrap');
      const w = wrap.clientWidth, h = wrap.clientHeight;
      const wr = wrap.getBoundingClientRect();
      const cx = wr.left + w / 2, cy = wr.top + h / 2;
      const fit = Stage.fitScale;
      const rr0 = Stage.rootEl.getBoundingClientRect();
      check('init-center', Math.abs(rr0.left + rr0.width / 2 - cx) < 3 && Math.abs(rr0.top + rr0.height / 2 - cy) < 3);
      // ① Ctrl+滚轮放大
      wrap.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, ctrlKey: true, clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
      await sleep(160);
      const rr1 = Stage.rootEl.getBoundingClientRect();
      check('wheel-in', Stage.scale > fit * 1.05 && rr1.width > rr0.width + 4);
      // ② 锚点：缩放前后指针下的舞台坐标不变
      const ax = cx + 120, ay = cy - 60;
      const wa = Stage.screenToWorld(ax, ay);
      wrap.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, ctrlKey: true, clientX: ax, clientY: ay, bubbles: true, cancelable: true }));
      await sleep(160);
      const wb = Stage.screenToWorld(ax, ay);
      const dx = Math.abs(wa.x - wb.x), dy = Math.abs(wa.y - wb.y);
      console.log(`ZOOM|anchor|dx=${dx.toFixed(2)}|dy=${dy.toFixed(2)}|scale=${Stage.scale.toFixed(4)}|fit=${Stage.fitScale.toFixed(4)}|pan=${Stage.panX.toFixed(1)},${Stage.panY.toFixed(1)}|wrap=${wrap.clientWidth}x${wrap.clientHeight}`);
      check('anchor', dx < 2 && dy < 2);
      // ③ Ctrl+0 → 适应窗口
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '0', ctrlKey: true, bubbles: true, cancelable: true }));
      await sleep(160);
      check('shortcut-fit', Math.abs(Stage.scale - Stage.fitScale) < 1e-6 && Stage.panX === 0 && Stage.panY === 0);
      // ④ Ctrl+= 放大 → Ctrl+1 回到 100%
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '=', ctrlKey: true, bubbles: true, cancelable: true }));
      await sleep(120);
      const zoomed = Stage.scale > Stage.fitScale;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true, cancelable: true }));
      await sleep(120);
      check('shortcut-zoom', zoomed && Math.abs(Stage.scale - 1) < 1e-6);
      // ⑤ 缩放下的元素拖拽换算：屏幕移动 100px → 舞台位移 100 / scale
      const guidesOrig = Settings.get('alignGuides');
      Settings.set('alignGuides', false);
      Stage.renderAll();
      const el = Project.data.elements.find(e => e.visible !== false && !e.locked) || Project.data.elements[0];
      Editor.select(el.id);
      await sleep(220);
      const dom = Stage.elDom(el.id);
      const rr = dom.getBoundingClientRect();
      const sx = rr.left + rr.width / 2, sy = rr.top + rr.height / 2;
      const ox = el.x, oy = el.y;
      dom.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: sx, clientY: sy, button: 0 }));
      await sleep(60);
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: sx + 100, clientY: sy + 50 }));
      await sleep(60);
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await sleep(160);
      const gotDx = el.x - ox, gotDy = el.y - oy;
      check('drag-scale', Math.abs(gotDx - 100 / Stage.scale) < 3 && Math.abs(gotDy - 50 / Stage.scale) < 3);
      el.x = ox; el.y = oy;
      Settings.set('alignGuides', guidesOrig);
      // ⑥ 普通滚轮平移 + 边界 clamp
      Stage.setZoom(1);
      wrap.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, clientX: cx, clientY: cy, bubbles: true, cancelable: true }));
      await sleep(120);
      const wheelPan = Math.abs(Stage.panY + 100) < 3;
      Stage.panBy(100000, 100000);
      const limX = Math.max(0, 960 * Stage.scale - w / 2);
      check('wheel-pan', wheelPan);
      check('pan-clamp', Math.abs(Stage.panX - limX) < 2);
      // ⑦ UI 百分比显示
      const label = document.getElementById('zoom-label');
      check('ui-label', !!label && label.textContent === Math.round(Stage.scale * 100) + '%');
      // 清理：恢复视图与项目数据
      Stage.resetView();
      Stage.renderAll();
      console.log('ZOOM|' + results.join('|'));
      console.log(results.every(r => !r.includes('FAIL')) ? 'ZOOM|PASS' : 'ZOOM|FAIL');
    } catch (e) {
      console.log('ZOOM|error|' + (e.message || e));
      console.log('ZOOM|FAIL');
    }
  },

  // PLAYVIEW 测试：Ctrl+P 进演示 → 播放态强制适应窗口 → 退出恢复用户视图
  async testPlayView() {
    try {
      Stage.setZoom(1.5);
      Stage.panBy(80, 40);
      const zoomBefore = Stage.zoom, panBefore = Stage.panX;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, bubbles: true, cancelable: true }));
      await sleep(700);
      const playing = this.playing && document.body.classList.contains('playing');
      const fitInPlay = Math.abs(Stage.scale - Stage.fitScale) < 1e-6 && Stage.panX === 0;
      this.stop();
      await sleep(700);
      const restored = Math.abs(Stage.zoom - zoomBefore) < 1e-6 && Math.abs(Stage.panX - panBefore) < 1e-6 && !this.playing;
      console.log(`PLAYVIEW|playing=${playing}|fit=${fitInPlay}|restore=${restored}|zoom=${zoomBefore}`);
      console.log((playing && fitInPlay && restored) ? 'PLAYVIEW|PASS' : 'PLAYVIEW|FAIL');
      Stage.resetView();
    } catch (e) {
      console.log('PLAYVIEW|error|' + (e.message || e));
      console.log('PLAYVIEW|FAIL');
    }
  },

  // LAYOUT 测试：积木区拖宽 / 收起（Ctrl+B），属性面板折叠
  async testLayout() {
    const results = [];
    const check = (name, ok) => { results.push(`${name}=${ok ? 'ok' : 'FAIL'}`); return ok; };
    try {
      const left = document.getElementById('left');
      const resizer = document.getElementById('left-resizer');
      const w0 = left.getBoundingClientRect().width;
      // ① 拖动分隔条加宽
      const rx = resizer.getBoundingClientRect().left + 2;
      resizer.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: rx, clientY: 400, button: 0 }));
      await sleep(60);
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rx + 90, clientY: 400 }));
      await sleep(80);
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await sleep(150);
      const w1 = left.getBoundingClientRect().width;
      check('drag-wider', w1 > w0 + 50);
      // ② Ctrl+B 收起 → 再按展开
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true }));
      await sleep(130);
      const collapsed = left.getBoundingClientRect().width === 0;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true }));
      await sleep(130);
      const restored = left.getBoundingClientRect().width > 200;
      check('collapse-toggle', collapsed && restored);
      // ③ 属性面板折叠 / 展开
      Panel.collapsed = false; Panel.show();
      await sleep(130);
      const h0 = document.getElementById('props').getBoundingClientRect().height;
      document.querySelector('#props .p-title').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(130);
      const h1 = document.getElementById('props').getBoundingClientRect().height;
      document.querySelector('#props .p-title').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await sleep(130);
      const h2 = document.getElementById('props').getBoundingClientRect().height;
      check('props-collapse', h1 < h0 - 40 && h2 > h1 + 40);
      // 清理：布局偏好复位
      left.style.flex = '';
      Settings.set('leftWidth', 0);
      Settings.set('leftCollapsed', false);
      Settings.set('propsCollapsed', false);
      Panel.collapsed = false; Panel.show();
      this.leftCollapsed = false;
      document.body.classList.remove('left-collapsed');
      await sleep(120);
      console.log('LAYOUT|' + results.join('|'));
      console.log(results.every(r => !r.includes('FAIL')) ? 'LAYOUT|PASS' : 'LAYOUT|FAIL');
      // 截图走查：保持"积木区收起 + 属性面板折叠"展示态（仅本次会话，不持久化）
      left.style.display = 'none';
      document.body.classList.add('left-collapsed');
      Panel.collapsed = true; Panel.show();
      console.log('LAYOUT|shot|左栏收起 + 属性折叠展示态（截图用，不持久化）');
    } catch (e) {
      console.log('LAYOUT|error|' + (e.message || e));
      console.log('LAYOUT|FAIL');
    }
  },

  // ELBAR 测试：元素条溢出时的滚轮 / 箭头 / 选中滚入视野 / 重渲染保持滚动
  async testElbar() {
    const results = [];
    const check = (name, ok) => { results.push(`${name}=${ok ? 'ok' : 'FAIL'}`); return ok; };
    try {
      const box = document.getElementById('element-bar');
      const wrap = document.getElementById('element-bar-wrap');
      // 造 24 个画布外的不可见元素（不进舞台，只为把元素条撑到溢出）
      for (let i = 0; i < 24; i++) {
        Project.data.elements.push({
          id: 'elbar_t' + i, type: 'shape', name: '测试元素甲乙丙丁' + i,
          x: -3000, y: -3000, w: 100, h: 100, z: -99, visible: false,
          props: { shape: 'rect', fill: '#666' }
        });
      }
      Editor.select(null);
      this.renderElementBar();
      await sleep(250);
      check('overflow-detect', wrap.classList.contains('overflow'));
      // ① 右箭头滚动
      const s0 = box.scrollLeft;
      document.getElementById('elbar-right').click();
      await sleep(500);
      const s1 = box.scrollLeft;
      check('arrow-scroll', s1 > s0 + 40);
      // ② 滚轮横向滚动
      box.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
      await sleep(150);
      check('wheel-scroll', box.scrollLeft > s1 + 60);
      // ③ 选中最后一个元素 → 自动滚入视野
      const last = Project.data.elements[Project.data.elements.length - 1];
      Editor.select(last.id);
      await sleep(300);
      const chip = box.querySelector(`.el-chip[data-id="${last.id}"]`);
      const inView = !!chip && chip.offsetLeft >= box.scrollLeft - 2
        && chip.offsetLeft + chip.offsetWidth <= box.scrollLeft + box.clientWidth + 2;
      check('select-into-view', inView);
      // ④ 重渲染保持滚动位置
      const s2 = box.scrollLeft;
      this.renderElementBar();
      await sleep(150);
      const s3 = box.scrollLeft;
      check('rerender-keeps', Math.abs(s3 - s2) < 40);
      // ⑤ 左箭头回滚
      document.getElementById('elbar-left').click();
      await sleep(500);
      check('arrow-left', box.scrollLeft < s3 - 40);
      // 保留溢出展示态供截图走查（画布外元素不影响舞台；进程退出即销毁）
      console.log('ELBAR|' + results.join('|'));
      console.log(results.every(r => !r.includes('FAIL')) ? 'ELBAR|PASS' : 'ELBAR|FAIL');
    } catch (e) {
      console.log('ELBAR|error|' + (e.message || e));
      console.log('ELBAR|FAIL');
    }
  },

  // RECORD 测试：自动录制 4 秒 → 合成 MP4（帧数 / 文件落盘 / 由外部 ffprobe 复核）
  async testRecord() {
    try {
      const dur = 4;
      await this.enterPlayMode();
      const first = Project.data.chapters[0];
      if (first) await Stage.goChapter(first.id, { instant: true });
      await sleep(250);
      const r = Stage.rootEl.getBoundingClientRect();
      const ok = await this.host.recordStart(24, 1280, 720,
        Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height));
      console.log('RECORD|start=' + ok);
      this.recording = { fps: 24, w: 1280, h: 720, t0: Date.now() };
      this.showRecHint();                    // 与真实路径一致：检验 HUD 是否会混入画面
      this.runPlayScripts();
      await sleep(2000);
      this.nextScene();                      // 模拟用户按键推进：检验章节切换被录到
      await sleep(dur * 1000 - 2000);
      const frames = await this.host.recordStop();
      this.recording = null;
      this.hideRecHint();
      this.stop();
      await sleep(200);
      const out = await this.host.recordFinish('/tmp/积木剧场-录制测试.mp4');   // 中文路径也要能用
      console.log(`RECORD|frames=${frames}|out=${out}`);
      console.log(ok && out && frames >= dur * 8 ? 'RECORD|PASS' : 'RECORD|FAIL');
    } catch (e) {
      console.log('RECORD|error|' + (e.message || e));
      console.log('RECORD|FAIL');
    }
  },

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

  // BLK3 测试：S2 批2（列表/日期时间/拖拽/画笔/音乐）
  async testBlocks3() {
    try {
      const E = Executor;
      const num = v => ({ k: 'num', v });
      const str = v => ({ k: 'str', v });
      const c = E.newCtx();
      const ev = async expr => await E.evalExpr(expr, E.newCtx());
      const r = [];
      // 列表
      await E.exec({ op: 'list.add', name: '测', value: num(1) }, c);
      await E.exec({ op: 'list.add', name: '测', value: str('x') }, c);
      r.push(['list_len', (await ev({ k: 'list.len', name: '测' })) === 2]);
      r.push(['list_item', (await ev({ k: 'list.item', name: '测', n: num(1) })) === 1]);
      r.push(['list_contains', (await ev({ k: 'list.contains', name: '测', value: str('x') })) === true]);
      r.push(['list_index', (await ev({ k: 'list.indexOf', name: '测', value: str('x') })) === 2]);
      r.push(['list_join', (await ev({ k: 'list.join', name: '测', sep: str('-') })) === '1-x']);
      await E.exec({ op: 'list.delete', name: '测', n: num(1) }, c);
      r.push(['list_del', (await ev({ k: 'list.item', name: '测', n: num(1) })) === 'x']);
      await E.exec({ op: 'list.insert', name: '测', n: num(1), value: str('y') }, c);
      r.push(['list_ins', (await ev({ k: 'list.item', name: '测', n: num(1) })) === 'y']);
      await E.exec({ op: 'list.replace', name: '测', n: num(1), value: str('z') }, c);
      r.push(['list_rep', (await ev({ k: 'list.item', name: '测', n: num(1) })) === 'z']);
      await E.exec({ op: 'list.clear', name: '测' }, c);
      r.push(['list_clr', (await ev({ k: 'list.len', name: '测' })) === 0]);
      await E.exec({ op: 'list.split', name: '测2', text: str('a,b,c'), sep: str(',') }, c);
      r.push(['list_split', (await ev({ k: 'list.len', name: '测2' })) === 3]);
      // 日期时间
      r.push(['datetime_time', /^\d{2}:\d{2}:\d{2}$/.test(await ev({ k: 'datetime', what: 'time' }))]);
      r.push(['datetime_year', (await ev({ k: 'datetime', what: 'year' })) >= 2025]);
      // 拖拽
      const el = Project.data.elements[0];
      await E.exec({ op: 'el.drag', elId: el.id, on: true }, c);
      r.push(['drag_on', el.draggable === true]);
      await E.exec({ op: 'el.drag', elId: el.id, on: false }, c);
      r.push(['drag_off', el.draggable === false]);
      // 画笔
      Pen.clear();
      Pen.ensure();
      Pen.setDown(true); Pen.setSize(12); Pen.setColor('#FF0000');
      Pen.lineTo('t1', 100, 100);
      Pen.lineTo('t1', 220, 220);
      r.push(['pen_canvas', !!Pen.canvas && Pen.canvas.isConnected]);
      r.push(['pen_last', !!(Pen.last['t1'] && Pen.last['t1'].x === 220)]);
      let hasRed = false;
      try {
        const px = Pen.ctx.getImageData(155, 155, 6, 6).data;
        for (let i = 0; i < px.length; i += 4) { if (px[i] > 180 && px[i + 3] > 0) { hasRed = true; break; } }
      } catch (e) { }
      r.push(['pen_pixel', hasRed]);
      // Pen.connect 挂钩（el.move 后）
      Pen.last = {};
      await E.exec({ op: 'el.move', elId: el.id, x: num(500), y: num(300) }, c);
      r.push(['pen_hook_move', !!Pen.last[el.id]]);
      Pen.setDown(false); Pen.clear();
      E.lists = {};
      // 音乐（合成调用不崩）
      let musicOk = true;
      try { AudioMgr.note(60, 0.15); } catch (e) { musicOk = false; }
      r.push(['music_note', musicOk]);
      r.forEach(x => console.log('BLK3|' + x[0] + '|' + (x[1] ? 'ok' : 'FAIL')));
      console.log(r.every(x => x[1]) ? 'BLK3|PASS' : 'BLK3|FAIL');
    } catch (e) {
      console.log('BLK3|error|' + (e.message || e));
    }
  },

  // BC 测试：广播系统端到端（全局帽 + 元素帽 + 分发 + self 注入）
  async testBroadcast() {
    try {
      Project.newProject('广播测试');
      if (!Project.data.chapters.length) Project.addChapter('章节 1');
      const S = blocks => ({ blocks: { languageVersion: 0, blocks } });
      const num = v => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
      const A = Project.createElement('shape', { name: '甲', x: 200, y: 300 });
      const B = Project.createElement('shape', { name: '乙', x: 600, y: 300 });
      // 全局：当收到 go → 让甲 y+50（全局元素版）
      Project.data.globalBlocks = S([{
        type: 'jimu_on_broadcast', fields: { MSG: 'go' },
        next: { block: { type: 'jimu_change', fields: { ELEMENT: A.id, PROP: 'y' }, inputs: { DELTA: num(50) } } }
      }]);
      // 甲（元素脚本）：当收到 go → 自己 x+100
      A.blocks = S([{
        type: 'jimu_self_on_message', fields: { MSG: 'go' },
        next: { block: { type: 'jimu_self_change', fields: { PROP: 'x' }, inputs: { DELTA: num(100) } } }
      }]);
      // 乙（元素脚本）：当收到 go → 自己 y+100
      B.blocks = S([{
        type: 'jimu_self_on_message', fields: { MSG: 'go' },
        next: { block: { type: 'jimu_self_change', fields: { PROP: 'y' }, inputs: { DELTA: num(100) } } }
      }]);
      Stage.renderAll();
      await this.play();
      await sleep(700);
      const n = Executor.broadcast('go');
      await sleep(500);
      const g = id => (Project.findElementById(id) || {}).element || {};
      const a = g(A.id), b = g(B.id);
      console.log(`BC|handlers=${n} ax=${a.x} ay=${a.y} by=${b.y}`);
      const ok = n === 3 && a.x === 300 && a.y === 350 && b.y === 400 && b.x === 600;
      console.log(ok ? 'BC|PASS' : 'BC|FAIL');
      this.stop();
    } catch (e) {
      console.log('BC|error|' + (e.message || e));
    }
  },

  // FN 测试：带参函数端到端（定义/调用/参数传递/self 注入）
  async testFunc() {
    try {
      Project.newProject('函数测试');
      if (!Project.data.chapters.length) Project.addChapter('章节 1');
      const S = blocks => ({ blocks: { languageVersion: 0, blocks } });
      const num = v => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
      const A = Project.createElement('shape', { name: '甲', x: 200, y: 300 });
      A.blocks = S([
        { type: 'jimu_self_on_start', next: { block: {
          type: 'jimu_func_call', fields: { NAME: '走两步' },
          inputs: { ARG0: num(100) }
        } } },
        { type: 'jimu_func_def', fields: { NAME: '走两步', PARAMS: 'n' }, next: { block: {
          type: 'jimu_self_change', fields: { PROP: 'x' },
          inputs: { DELTA: { block: { type: 'jimu_func_args', fields: { NAME: 'n' } } } }
        } } }
      ]);
      Stage.renderAll();
      await this.play();
      await sleep(900);
      const a = (Project.findElementById(A.id) || {}).element || {};
      console.log(`FN|x=${a.x}`);
      console.log(a.x === 300 ? 'FN|PASS' : 'FN|FAIL');
      this.stop();
    } catch (e) {
      console.log('FN|error|' + (e.message || e));
    }
  },

  // EXE 测试：导出 Windows 单文件程序（结构验证在外部脚本）
  async testExe() {
    try {
      const html = await this.buildPlayerHtml();
      const b64 = btoa(unescape(encodeURIComponent(html)));
      const p = await this.host.exportExeTo('/tmp/jc_export_test.exe', b64);
      console.log('EXE|path=' + p);
      this.openExportPanel();   // 截图用：展示导出面板
    } catch (e) {
      console.log('EXE|error|' + (e.message || e));
    }
  },

  // PERF 测试：关键操作耗时打点
  async testPerf() {
    const marks = [];
    const T = (label, fn) => { const t0 = performance.now(); fn(); marks.push([label, performance.now() - t0]); };
    const TA = async (label, fn) => { const t0 = performance.now(); await fn(); marks.push([label, performance.now() - t0]); };
    try {
      await TA('demo-build(12el+scripts)+renderAll', async () => { Project.newProject('perf'); this.buildDemo(); Stage.renderAll(); });
      T('renderAll x1', () => { Stage.renderAll(); });
      T('renderAll x5', () => { for (let i = 0; i < 5; i++) Stage.renderAll(); });
      T('switchTab x20(global<->ch1)', () => {
        for (let i = 0; i < 10; i++) { this.switchTab('global'); this.switchTab(Project.data.chapters[0].id); }
      });
      const el = Project.data.elements[0];
      T('Editor.select x20', () => { for (let i = 0; i < 20; i++) Editor.select(el.id); });
      T('ElementBar+ScriptTabs x20', () => { for (let i = 0; i < 20; i++) { this.renderScriptTabs(); this.renderElementBar(); } });
      await TA('pack', async () => { await Project.pack(); });
      await TA('unpack', async () => { const b64 = await Project.pack(); await Project.unpack(b64); });
      await TA('compileAll', async () => { Executor.compileAll(); });
      // 大项目：100 元素渲染
      T('100el renderAll', () => {
        Project.newProject('perf100');
        Project.addChapter('页');
        for (let i = 0; i < 100; i++) {
          Project.createElement('shape', { name: '方块' + i, x: (i % 10) * 190, y: ((i / 10) | 0) * 100, w: 120, h: 80 });
        }
        Stage.renderAll();
      });
      marks.forEach(m => console.log('PERF|' + m[0] + '|' + m[1].toFixed(1) + 'ms'));
      console.log('PERF|DONE');
    } catch (e) {
      console.log('PERF|error|' + (e.message || e));
    }
  },

  // AI 测试：DSL 执行器（离线，不调网络）
  async testAi() {
    try {
      const cmds = [
        { cmd: 'text', name: '标题', text: '国庆快乐', x: 460, y: 300, w: 1000, size: 120 },
        { cmd: 'icon', name: '烟花', char: '🎆', x: 880, y: 620, size: 140 },
        { cmd: 'chapter', name: '封面', show: ['标题', '烟花'], bg: '#1A0A0C' },
        { cmd: 'anim', target: '标题', type: 'fadeIn', duration: 0.8 },
        { cmd: 'wait', sec: 1 },
        { cmd: 'next' },
        { cmd: 'chapter', name: '尾声', show: ['烟花'], bg: '#120708' },
        { cmd: 'anim', target: '烟花', type: 'bounceIn' }
      ];
      this.applyAiCommands(cmds);
      await sleep(400);
      const els = Project.data.elements.length;
      const chs = Project.data.chapters.length;
      const ch1 = Project.data.chapters[0];
      const blocks1 = ch1.blocks ? ((ch1.blocks.blocks && ch1.blocks.blocks.blocks) || []).length : 0;
      const vis1 = ch1.preset.visibility;
      const titleEl = Project.data.elements.find(e => e.name === '标题');
      const hiddenOk = titleEl && vis1[titleEl.id] === true;
      console.log(`AI|els=${els} chapters=${chs} ch1blocks=${blocks1} vis=${hiddenOk}`);
      const ok = els === 2 && chs === 2 && blocks1 === 1 && hiddenOk;
      console.log(ok ? 'AI|PASS' : 'AI|FAIL');
    } catch (e) {
      console.log('AI|error|' + (e.message || e));
    }
  },

  // PACK 测试：放映包图片压缩 + 体积报告
  async testPack() {
    try {
      const c = document.createElement('canvas');
      c.width = 1600; c.height = 1000;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 1600, 1000);
      g.addColorStop(0, '#112233');
      g.addColorStop(1, '#AABBCC');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1600, 1000);
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = 'rgba(255,255,255,.4)';
        ctx.fillRect(Math.random() * 1600, Math.random() * 1000, 3, 3);
      }
      const png = c.toDataURL('image/png').split(',')[1];
      const res = await this.compressResources([{ id: 'r1', mime: 'image/png', data: png }]);
      const ratio = res[0].data.length / png.length;
      console.log(`PACK|compress|png=${(png.length / 1024) | 0}KB -> ${(res[0].data.length / 1024) | 0}KB (${(ratio * 100).toFixed(0)}%)`);
      const html = await this.buildPlayerHtml();
      const mb = (html.length * 0.75 / 1048576);
      console.log(`PACK|player|${mb.toFixed(1)}MB`);
      const ok = ratio < 0.7 && html.length > 1000;
      console.log(ok ? 'PACK|PASS' : 'PACK|FAIL');
    } catch (e) {
      console.log('PACK|error|' + (e.message || e));
    }
  },

  // SEARCH 测试：积木搜索（打开/匹配/渲染/定位）
  async testSearch() {
    try {
      this.openBlockSearch();
      await sleep(250);
      this.renderBlockSearch('动画');
      await sleep(250);
      const n = (this._searchResults || []).length;
      const items = document.querySelectorAll('#search-results .search-item').length;
      let centered = true;
      try { this.gotoSearchResult(0); } catch (e) { centered = false; }
      await sleep(250);
      console.log(`SEARCH|hits=${n} items=${items} centered=${centered}`);
      console.log((n > 0 && items > 0 && centered) ? 'SEARCH|PASS' : 'SEARCH|FAIL');
    } catch (e) {
      console.log('SEARCH|error|' + (e.message || e));
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
    Stage.exitPlayView();
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

  // ---------- AI 助手 ----------
  openAi() {
    const ov = document.getElementById('ai-overlay');
    if (!ov) return;
    ov.classList.remove('hidden');
    const msgs = document.getElementById('ai-msgs');
    if (msgs && !msgs.childElementCount) {
      this.aiAddMsg('sys', '描述你想要的演示，我来搭（例如：做一个介绍国庆节的演示，标题+三个要点配图标，结尾放烟花效果）。');
    }
    setTimeout(() => { try { document.getElementById('ai-input').focus(); } catch (e) { } }, 80);
  },

  aiAddMsg(role, text) {
    const box = document.getElementById('ai-msgs');
    if (!box) return;
    const d = document.createElement('div');
    d.className = 'ai-msg ' + (role === 'user' ? 'user' : 'sys');
    d.textContent = text;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return d;
  },

  aiGenerate() {
    const inp = document.getElementById('ai-input');
    const text = (inp && inp.value || '').trim();
    if (!text) return;
    if (this._aiBusy) return;
    this.aiAddMsg('user', text);
    if (inp) inp.value = '';
    if (!Settings.get('aiKey')) {
      this.aiAddMsg('sys', '⚠️ 请先到「设置 → AI 助手」填写 DeepSeek API Key（platform.deepseek.com 获取，约几分钱/次）');
      return;
    }
    if (!this.host || !this.host.aiChat) {
      this.aiAddMsg('sys', '⚠️ 需要桌面程序环境');
      return;
    }
    this._aiBusy = true;
    const wait = this.aiAddMsg('sys', '正在生成演示，请稍候…（约 10~30 秒）');
    const id = 'ai' + Date.now();
    this._aiPending = id;
    const messages = [
      { role: 'system', content: AI_SYSTEM_PROMPT },
      { role: 'user', content: text }
    ];
    try {
      this.host.aiChat(id, JSON.stringify({ model: Settings.get('aiModel') || 'deepseek-chat', messages }));
    } catch (e) {
      this._aiBusy = false;
      if (wait) wait.textContent = '❌ 调用失败：' + (e.message || e);
    }
  },

  onAiResult(id, ok, content) {
    if (id !== this._aiPending) return;
    this._aiBusy = false;
    if (!ok) {
      this.aiAddMsg('sys', '❌ ' + content);
      return;
    }
    let cmds = null;
    try {
      let t = String(content).trim();
      t = t.replace(/^```(json)?/gm, '').replace(/```/g, '').trim();
      const a = t.indexOf('[');
      const b = t.lastIndexOf(']');
      if (a < 0 || b < 0) throw new Error('未找到 JSON 数组');
      cmds = JSON.parse(t.slice(a, b + 1));
      if (!Array.isArray(cmds)) throw new Error('格式不对');
    } catch (e) {
      this.aiAddMsg('sys', '❌ 解析生成结果失败：' + (e.message || e) + '\n可再试一次，或换个描述方式');
      return;
    }
    try {
      this.applyAiCommands(cmds);
      const chs = cmds.filter(c => c && c.cmd === 'chapter').length;
      this.aiAddMsg('sys', `✅ 已生成 ${chs} 个章节的演示，直接播放看看吧！（不满意可以再描述一次）`);
      setTimeout(() => document.getElementById('ai-overlay').classList.add('hidden'), 900);
    } catch (e) {
      this.aiAddMsg('sys', '❌ 应用失败：' + (e.message || e));
    }
  },

  // 把 AI 输出的 DSL 命令数组落成项目
  applyAiCommands(cmds) {
    JimuBlocks.save();
    Project.newProject('AI 生成演示');
    Project.data.chapters.length = 0;   // 清掉默认章节，由 AI 命令按需重建
    const S = blocks => ({ blocks: { languageVersion: 0, blocks } });
    const blk = (type, fields, next, inputs) => {
      const o = { type };
      if (fields) o.fields = fields;
      if (inputs) o.inputs = inputs;
      if (next) o.next = { block: next };
      return o;
    };
    const link = list => {
      for (let i = list.length - 1; i > 0; i--) list[i - 1].next = { block: list[i] };
      return list[0];
    };
    const elMap = {};
    const chapters = [];
    let cur = null;
    for (const c of (cmds || [])) {
      if (!c || !c.cmd) continue;
      if (c.cmd === 'text') {
        elMap[c.name] = Project.createElement('text', { name: c.name || '文字', x: c.x, y: c.y, w: c.w,
          props: { text: c.text || '', size: c.size || 64, color: c.color || '#E6E9EF', align: c.align || 'center', bold: !!c.bold } });
      } else if (c.cmd === 'shape') {
        elMap[c.name] = Project.createElement('shape', { name: c.name || '形状', x: c.x, y: c.y, w: c.w, h: c.h,
          props: { shape: c.shape || 'rect', fill: c.fill || '#6C8CFF', radius: c.radius } });
      } else if (c.cmd === 'icon') {
        elMap[c.name] = Project.createElement('icon', { name: c.name || '图标', x: c.x, y: c.y, w: c.w, h: c.h,
          props: { char: c.char || '⭐', size: c.size || 120, color: c.color || '#F5A623' } });
      } else if (c.cmd === 'chapter') {
        const ch = Project.addChapter(c.name || ('章节 ' + (chapters.length + 1)));
        if (c.bg) ch.preset.background = { type: 'color', value: c.bg };
        cur = { ch, blocks: [], show: c.show || null };
        chapters.push(cur);
      } else if (cur && c.cmd === 'anim') {
        const tgt = elMap[c.target];
        if (tgt) cur.blocks.push(blk('jimu_anim', {
          ELEMENT: tgt.id, ANIM: c.type || 'fadeIn',
          DUR: c.duration || 0.6, DELAY: c.delay || 0, EASE: c.ease || 'easeOutCubic'
        }));
      } else if (cur && c.cmd === 'wait') {
        cur.blocks.push(blk('jimu_wait', null, null, { SEC: { shadow: { type: 'math_number', fields: { NUM: c.sec || 1 } } } }));
      } else if (cur && c.cmd === 'next') {
        cur.blocks.push(blk('jimu_scene_next'));
      }
    }
    if (!chapters.length) throw new Error('没有生成任何章节');
    // 章节显隐预设（无 show 的章节默认全显示）
    chapters.forEach(({ ch, show }) => {
      ch.preset.visibility = {};
      Project.data.elements.forEach(el => { ch.preset.visibility[el.id] = show ? show.indexOf(el.name) >= 0 : true; });
    });
    // 章节脚本
    chapters.forEach(({ ch, blocks }) => {
      if (!blocks.length) return;
      const hat = blk('jimu_on_scene', { SCENE: ch.id });
      ch.blocks = S([link([hat].concat(blocks))]);
    });
    Project.data.globalBlocks = S([]);
    // 应用
    Stage.renderAll();
    Stage.goChapter(Project.data.chapters[0].id, { instant: true });
    this.activeTab = 'global';
    JimuBlocks.switchTo('global');
    this.renderTabs(); this.renderScriptTabs(); this.renderElementBar();
    Editor.select(null);
    Panel.show();
    this.markDirty();
  },

  // ---------- 积木搜索（Ctrl+F） ----------
  blockLabel(b) {
    const parts = [];
    try {
      b.inputList.forEach(inp => {
        (inp.fieldRow || []).forEach(f => {
          if (f.getText) { const t = f.getText(); if (t) parts.push(t); }
          if (f.isEditable && f.isEditable()) {
            const v = f.getValue();
            if (v !== undefined && v !== null && String(v)) parts.push(String(v));
          }
        });
      });
    } catch (e) { }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  },

  openBlockSearch() {
    const ov = document.getElementById('search-overlay');
    if (!ov) return;
    ov.classList.remove('hidden');
    const inp = document.getElementById('search-input');
    inp.value = '';
    this.renderBlockSearch('');
    inp.oninput = () => this.renderBlockSearch(inp.value);
    inp.onkeydown = e => {
      if (e.key === 'Escape') { this.closeBlockSearch(); e.preventDefault(); }
      if (e.key === 'Enter' && this._searchResults && this._searchResults.length) this.gotoSearchResult(0);
    };
    setTimeout(() => { try { inp.focus(); } catch (e) { } }, 60);
  },

  closeBlockSearch() {
    const ov = document.getElementById('search-overlay');
    if (ov) ov.classList.add('hidden');
  },

  renderBlockSearch(q) {
    const box = document.getElementById('search-results');
    if (!box || !JimuBlocks.ws) return;
    q = String(q || '').trim().toLowerCase();
    const hits = [];
    for (const b of JimuBlocks.ws.getAllBlocks(false)) {
      if (b.isInFlyout) continue;
      const label = this.blockLabel(b);
      if (!q || label.toLowerCase().includes(q)) hits.push({ b, label });
      if (hits.length >= 60) break;
    }
    this._searchResults = hits;
    if (!hits.length) {
      box.innerHTML = '<div class="search-empty">没有匹配的积木</div>';
      return;
    }
    box.innerHTML = hits.map((h, i) =>
      `<div class="search-item${i === 0 ? ' active' : ''}" data-i="${i}">🧩 ${esc(h.label || h.b.type)}</div>`
    ).join('');
    box.querySelectorAll('.search-item').forEach(it => {
      it.onclick = () => this.gotoSearchResult(Number(it.dataset.i));
    });
  },

  gotoSearchResult(i) {
    const h = this._searchResults && this._searchResults[i];
    if (!h) return;
    try {
      JimuBlocks.ws.centerOnBlock(h.b.id);
      if (JimuBlocks.ws.highlightBlock) JimuBlocks.ws.highlightBlock(h.b.id);
    } catch (e) { }
    this.closeBlockSearch();
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
        } else if (it.type === 'text') {
          html += `<input type="text" data-key="${it.key}" value="${esc(Settings.get(it.key) || '')}" placeholder="${it.placeholder || ''}">`;
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
    box.querySelectorAll('input[type=text]').forEach(inp => {
      inp.onchange = () => Settings.set(inp.dataset.key, inp.value.trim());
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
    if (this.themeMode !== Settings.get('theme')) this.applyTheme(Settings.get('theme'));
    if (typeof JimuBlocks !== 'undefined' && JimuBlocks.refreshToolbox) {
      try { JimuBlocks.refreshToolbox(true); } catch (e) { }
    }
    if (typeof Model3D !== 'undefined' && Model3D.applyShadows) { try { Model3D.applyShadows(); } catch (e) { } }
    if (this.host && this.host.setPref) {
      try { this.host.setPref('apiEnabled', Settings.get('apiEnabled') ? '1' : '0'); } catch (e) { }
      try { this.host.setPref('aiKey', String(Settings.get('aiKey') || '')); } catch (e) { }
    }
    try { if (this.host && this.host.setZoom) this.host.setZoom((Settings.get('uiScale') || 100) / 100); } catch (e) { }
  },

  // ---------- 布局：积木区拖宽 / 收起，属性面板折叠 ----------
  initLayoutUI() {
    const left = document.getElementById('left');
    const resizer = document.getElementById('left-resizer');
    if (!left || !resizer) return;
    resizer.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      const startX = e.clientX;
      const startW = Math.max(left.getBoundingClientRect().width, this.leftCollapsed ? 240 : 0);
      resizer.classList.add('dragging');
      const move = ev => {
        const w = Math.max(240, Math.min(window.innerWidth * 0.75, startW + (ev.clientX - startX)));
        left.style.flex = '0 0 ' + Math.round(w) + 'px';
        if (this.leftCollapsed) this.toggleLeftCollapse(false);
      };
      const up = () => {
        resizer.classList.remove('dragging');
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        const w = Math.round(left.getBoundingClientRect().width);
        if (w > 0) Settings.set('leftWidth', w);
        this.resizeBlocklySoon();
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
    resizer.addEventListener('dblclick', () => this.toggleLeftCollapse());
  },

  // 启动时恢复布局偏好（在 host 设置加载之后调用）
  applyLayoutPrefs() {
    const left = document.getElementById('left');
    const w = Number(Settings.get('leftWidth')) || 0;
    if (left && w > 0) left.style.flex = '0 0 ' + Math.round(w) + 'px';
    this.leftCollapsed = false;
    if (Settings.get('leftCollapsed')) this.toggleLeftCollapse(true);
    if (typeof Panel !== 'undefined') {
      Panel.collapsed = !!Settings.get('propsCollapsed');
      try { Panel.show(); } catch (e) { }
    }
  },

  toggleLeftCollapse(force) {
    const left = document.getElementById('left');
    if (!left) return;
    const next = (force === undefined) ? !this.leftCollapsed : !!force;
    if (next === this.leftCollapsed) return;
    this.leftCollapsed = next;
    left.style.display = next ? 'none' : '';
    document.body.classList.toggle('left-collapsed', next);
    Settings.set('leftCollapsed', next);
    this.resizeBlocklySoon();
  },

  // Blockly 对容器尺寸变化不敏感：折叠 / 拖宽后主动 resize（立即 + 延迟各一次）
  resizeBlocklySoon() {
    const doIt = () => {
      try { if (typeof Blockly !== 'undefined' && typeof JimuBlocks !== 'undefined') Blockly.svgResize(JimuBlocks.ws); } catch (e) { }
    };
    doIt();
    clearTimeout(this._rszTimer);
    this._rszTimer = setTimeout(doIt, 160);
  },

  // ---------- 元素条：横向滚动（滚轮 / 箭头）、溢出状态 ----------
  initElementBarUI() {
    const box = document.getElementById('element-bar');
    const wrap = document.getElementById('element-bar-wrap');
    if (!box || !wrap) return;
    box.addEventListener('scroll', () => this.updateElBarArrows(), { passive: true });
    box.addEventListener('wheel', e => {
      if (box.scrollWidth <= box.clientWidth + 2) return;
      e.preventDefault();
      box.scrollLeft += (Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
      this.updateElBarArrows();
    }, { passive: false });
    const left = document.getElementById('elbar-left');
    const right = document.getElementById('elbar-right');
    if (left) left.onclick = () => box.scrollBy({ left: -box.clientWidth * 0.7, behavior: 'smooth' });
    if (right) right.onclick = () => box.scrollBy({ left: box.clientWidth * 0.7, behavior: 'smooth' });
    window.addEventListener('resize', () => this.updateElBarArrows());
    if (window.ResizeObserver) {
      try { new ResizeObserver(() => this.updateElBarArrows()).observe(box); } catch (e) { }
    }
    this.updateElBarArrows();
  },

  updateElBarArrows() {
    const box = document.getElementById('element-bar');
    const wrap = document.getElementById('element-bar-wrap');
    if (!box || !wrap) return;
    const over = box.scrollWidth > box.clientWidth + 2;
    wrap.classList.toggle('overflow', over);
    const left = document.getElementById('elbar-left');
    const right = document.getElementById('elbar-right');
    if (left) left.disabled = !over || box.scrollLeft <= 1;
    if (right) right.disabled = !over || box.scrollLeft >= box.scrollWidth - box.clientWidth - 1;
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
    // 已保存过 → 直接覆盖原文件；首次保存 → 走"另存为"选路径
    if (Project.filePath) {
      const ok = await this.host.saveProjectDirect(Project.filePath, base64);
      if (ok) {
        this.clearDirty();
        toast('已保存：' + Project.filePath.split('/').pop());
      } else {
        toast('保存失败：' + Project.filePath);
      }
      return;
    }
    await this.saveAs();
  },

  // 另存为：总是选择新路径（Ctrl+Shift+S / 「另存为」按钮）
  async saveAs() {
    JimuBlocks.save();
    if (!this.host) { toast('浏览器预览模式无法保存'); return; }
    await this.hostReady;
    const base64 = await Project.pack();
    const path = await this.host.saveProject(base64, (Project.data.name || '未命名演示') + '.bdp');
    if (path) {
      Project.filePath = path;
      this.clearDirty();
      try { await this.host.addRecentFile(path); } catch (e) { console.warn("记录最近文件失败:", e.message || e); }
      toast('已另存为：' + path.split('/').pop());
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
    this.renderHomeTemplates();
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

  // 主页模板卡片
  renderHomeTemplates() {
    const tbox = document.getElementById('home-templates');
    if (!tbox || typeof Templates === 'undefined') return;
    tbox.innerHTML = Templates.list.map(t =>
      `<button class="home-tpl" data-tpl="${t.key}" title="${esc(t.desc)}">
        <b>${t.icon}</b><span>${t.name}</span><small>${esc(t.desc)}</small>
      </button>`).join('');
    tbox.querySelectorAll('.home-tpl').forEach(n => {
      n.onclick = () => {
        document.getElementById('home-overlay').classList.add('hidden');
        this.loadTemplate(n.dataset.tpl);
      };
    });
  },

  // 载入模板（"点开就能改"的起步项目）
  loadTemplate(key) {
    if (typeof Templates === 'undefined') return;
    const t = Templates.list.find(x => x.key === key);
    if (!t) return;
    if (this.dirty && !confirm('当前项目有未保存的修改，确定载入模板吗？')) return;
    JimuBlocks.ws.clear();
    JimuBlocks.current = null;
    Project.newProject(t.name);
    Templates.build(key);
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
    toast('模板「' + t.name + '」已载入，改改就能用');
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
    // 画布缩放快捷键（编辑模式）：Ctrl+= 放大 / Ctrl+- 缩小 / Ctrl+0 适应 / Ctrl+1 回到 100%
    if ((e.ctrlKey || e.metaKey) && !this.playing) {
      const zk = e.key;
      if (zk === '=' || zk === '+' || zk === '-' || zk === '_' || zk === '0' || zk === '1') {
        e.preventDefault();
        if (zk === '0') Stage.resetView();
        else if (zk === '1') Stage.setZoom(1);
        else Stage.zoomBy((zk === '=' || zk === '+') ? 1.25 : 0.8);
        return;
      }
    }
    // Ctrl+P：进入演示（接管浏览器打印；演示中再按无动作）
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      if (!this.playing) this.play();
      return;
    }
    // 内核治理：拦截浏览器默认行为（打印 / 页面缩放 / 查看源码 / 开发者工具），播放时同样生效
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (['p', 'u', '+', '=', '-', '_', '0'].includes(k) || (e.shiftKey && ['i', 'j', 'c'].includes(k))) {
        e.preventDefault();
        return;
      }
    }
    if (e.key === 'F12') { e.preventDefault(); return; }
    if (this.playing) {
      if (e.key === 'Escape') {
        if (this.recording) { this.stopVideoRecord(); return; }
        this.stop(); return;
      }
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
    // Ctrl+F：积木搜索
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      this.openBlockSearch();
      return;
    }
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
    } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault(); this.saveAs();
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
    } else if (e.ctrlKey && e.key.toLowerCase() === 'b') {
      e.preventDefault(); this.toggleLeftCollapse();
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
