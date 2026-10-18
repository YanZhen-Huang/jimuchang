// 项目数据模型 v2（元素中心）+ v1→v2 迁移
const Project = {
  data: null,
  filePath: null,
  idSeq: 1,

  uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + (this.idSeq++).toString(36);
  },

  newProject(name = '未命名演示') {
    this.data = {
      format: 'jimuchang-project',
      version: 2,
      name,
      canvas: { width: 1920, height: 1080 },
      theme: { bg: '#0F1115' },
      stage: { background: { type: 'color', value: '#0F1115' }, fx: null },
      resources: [],
      elements: [],
      chapters: [],
      globalBlocks: null,
      music: { resourceId: null, loop: true, volume: 0.8 }
    };
    this.filePath = null;
    this.addChapter('章节 1');
    return this.data;
  },

  // ---------- 章节（书签） ----------
  addChapter(name) {
    const ch = {
      id: this.uid('ch'),
      name: name || ('章节 ' + (this.data.chapters.length + 1)),
      preset: {
        background: JSON.parse(JSON.stringify(this.data.stage.background)),
        visibility: {}
      },
      blocks: null,
      flow: { version: 1, steps: [] },
      flowMode: 'auto'
    };
    this.data.chapters.push(ch);
    return ch;
  },

  getChapter(id) { return this.data.chapters.find(c => c.id === id) || null; },

  removeChapter(id) {
    const i = this.data.chapters.findIndex(c => c.id === id);
    if (i >= 0 && this.data.chapters.length > 1) {
      this.data.chapters.splice(i, 1);
      return true;
    }
    return false;
  },

  chapterIndex(id) { return this.data.chapters.findIndex(c => c.id === id); },

  // v1 命名兼容别名（过渡期）
  getScene(id) { return this.getChapter(id); },
  removeScene(id) { return this.removeChapter(id); },
  sceneIndex(id) { return this.chapterIndex(id); },

  // ---------- 元素（全局，第一公民） ----------
  createElement(type, props = {}) {
    const defaults = {
      text: { name: '文字', w: 700, h: 120, x: 610, y: 480,
        props: { text: '双击编辑文字', font: '', size: 64, color: '#E6E9EF', bold: false, italic: false, underline: false, align: 'center', lineHeight: 1.4, letterSpacing: 0 } },
      image: { name: '图片', w: 480, h: 320, x: 720, y: 380, props: { resourceId: null, fit: 'contain' } },
      shape: { name: '形状', w: 320, h: 320, x: 800, y: 380,
        props: { shape: 'rect', fill: '#6C8CFF', stroke: '#ffffff', strokeWidth: 0, radius: 16 } },
      icon: { name: '图标', w: 160, h: 160, x: 880, y: 460, props: { char: '★', size: 120, color: '#F5A623' } },
      video: { name: '视频', w: 720, h: 405, x: 600, y: 337, props: { resourceId: null, loop: false, muted: false, autoplay: false, controls: false } },
      audio: { name: '音频', w: 140, h: 140, x: 100, y: 100, props: { resourceId: null, volume: 1, loop: false, autoplay: false, sfx: false } },
      chart: { name: '图表', w: 820, h: 500, x: 550, y: 290, props: { chartType: 'bar', categories: ['一月', '二月', '三月', '四月'], values: [120, 200, 150, 260], seriesName: '数据' } },
      sprite: { name: '帧动画', w: 320, h: 320, x: 800, y: 380, props: { kind: 'sheet', resourceId: null, frames: [], cols: 4, rows: 4, fps: 12, loop: true } },
      model3d: { name: '3D 模型', w: 640, h: 560, x: 640, y: 260, props: { resourceId: 'builtin:robot', animation: { name: 'Idle' }, lights: { preset: 'soft' }, autoRotate: false } },
      webapp: { name: '小程序', w: 400, h: 300, x: 760, y: 390, props: { resourceId: null, inline: null, sandbox: true } },
      slider: { name: '滑块', w: 560, h: 100, x: 680, y: 490, props: { min: 0, max: 100, value: 50, step: 1, label: '', color: '#6C8CFF', showValue: true } }
    };
    const d = defaults[type] || defaults.shape;
    const maxZ = this.data.elements.reduce((m, e) => Math.max(m, e.z || 0), 0);
    const el = {
      id: this.uid('el'),
      type,
      name: props.name || d.name,
      x: props.x !== undefined ? props.x : d.x,
      y: props.y !== undefined ? props.y : d.y,
      w: props.w !== undefined ? props.w : d.w,
      h: props.h !== undefined ? props.h : d.h,
      rotation: 0, opacity: 1, z: maxZ + 1, locked: false, visible: true,
      props: Object.assign({}, d.props, props.props || {}),
      entrance: null, exit: null, effects: [], keyframes: null,
      blocks: null
    };
    this.data.elements.push(el);
    return el;
  },

  getElement(id) { return this.data.elements.find(e => e.id === id) || null; },

  findElementById(id) {
    const el = this.data.elements.find(e => e.id === id);
    return el ? { element: el } : null;
  },

  findElementByName(name) {
    return this.data.elements.find(e => e.name === name) || null;
  },

  removeElement(id) {
    const i = this.data.elements.findIndex(e => e.id === id);
    if (i >= 0) { this.data.elements.splice(i, 1); return true; }
    return false;
  },

  // ---------- 资源 ----------
  addResource(name, mime, base64) {
    const cleanName = String(name || '素材')
      .split(/[\\/]/).pop()
      .replace(/[\x00-\x1f\x7f]/g, '')
      .slice(0, 140) || '素材';
    const id = this.uid('res');
    const extMatch = cleanName.match(/(\.[a-z0-9]{1,12})$/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : '';
    const res = {
      id,
      name: cleanName,
      mime: String(mime || 'application/octet-stream'),
      size: Math.round(String(base64 || '').length * 0.75),
      path: 'resources/' + id + ext,
      data: base64
    };
    this.data.resources.push(res);
    return res;
  },

  getResource(id) { return this.data.resources.find(r => r.id === id) || null; },

  findResource(ref) {
    if (!ref) return null;
    return this.getResource(ref) || this.data.resources.find(r => r.name === ref) || null;
  },

  resourceKind(r) {
    const mime = String(r && r.mime || '').toLowerCase();
    const name = String(r && r.name || '').toLowerCase();
    if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(name)) return 'image';
    if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/.test(name)) return 'audio';
    if (mime.startsWith('video/') || /\.(mp4|webm|mov)$/.test(name)) return 'video';
    if (mime === 'model/gltf-binary' || mime === 'model/gltf+json' || /\.(glb|gltf)$/.test(name)) return 'model3d';
    if (mime.startsWith('text/html') || /\.html?$/.test(name)) return 'webapp';
    return 'file';
  },

  resourceUsage(id) {
    const usage = [];
    if (!id) return usage;
    (this.data.elements || []).forEach(el => {
      const p = el.props || {};
      if (p.resourceId === id || (Array.isArray(p.frames) && p.frames.includes(id))) {
        usage.push({ type: 'element', id: el.id, name: el.name });
      }
    });
    const bgUsed = bg => bg && bg.type === 'image' && bg.value && bg.value.resourceId === id;
    if (bgUsed(this.data.stage && this.data.stage.background)) {
      usage.push({ type: 'stage', id: 'stage', name: '舞台背景' });
    }
    (this.data.chapters || []).forEach(ch => {
      if (bgUsed(ch.preset && ch.preset.background)) {
        usage.push({ type: 'chapter', id: ch.id, name: ch.name });
      }
    });
    if (this.data.music && this.data.music.resourceId === id) {
      usage.push({ type: 'music', id: 'music', name: '背景音乐' });
    }
    return usage;
  },

  removeResource(id, force = false) {
    const i = this.data.resources.findIndex(r => r.id === id);
    if (i < 0) return { ok: false, reason: '资源不存在' };
    const usage = this.resourceUsage(id);
    if (usage.length && !force) return { ok: false, reason: '素材仍被使用', usage };
    this.data.resources.splice(i, 1);
    return { ok: true, usage };
  },

  renameResource(id, name) {
    const r = this.getResource(id);
    if (!r) return false;
    const cleanName = String(name || '').split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, '').slice(0, 140);
    if (!cleanName) return false;
    r.name = cleanName;
    return true;
  },

  resourceUrl(id) {
    const r = this.getResource(id);
    if (!r) return '';
    return 'data:' + (r.mime || 'application/octet-stream') + ';base64,' + r.data;
  },

  // ---------- v1 → v2 迁移 ----------
  migrateV1toV2(old) {
    const firstBg = (old.scenes && old.scenes[0] && old.scenes[0].background) || { type: 'color', value: '#0F1115' };
    const data = {
      format: 'jimuchang-project',
      version: 2,
      name: old.name || '未命名演示',
      canvas: old.canvas || { width: 1920, height: 1080 },
      theme: old.theme || { bg: '#0F1115' },
      stage: {
        background: JSON.parse(JSON.stringify(firstBg)),
        fx: (old.scenes && old.scenes[0] && old.scenes[0].fx) || null
      },
      resources: old.resources || [],
      elements: [],
      chapters: [],
      globalBlocks: old.globalBlocks || null,
      music: old.music || { resourceId: null, loop: true, volume: 0.8 }
    };
    const seen = new Set();
    (old.scenes || []).forEach(sc => (sc.elements || []).forEach(el => {
      if (!seen.has(el.id)) {
        seen.add(el.id);
        if (el.blocks === undefined) el.blocks = null;
        data.elements.push(el);
      }
    }));
    data.chapters = (old.scenes || []).map(sc => {
      const inScene = new Set((sc.elements || []).map(e => e.id));
      const visibility = {};
      data.elements.forEach(el => { visibility[el.id] = inScene.has(el.id) && el.visible !== false; });
      return {
        id: sc.id,
        name: sc.name,
        preset: { background: JSON.parse(JSON.stringify(sc.background || firstBg)), visibility },
        blocks: sc.blocks || null,
        flow: { version: 1, steps: [] },
        flowMode: sc.blocks ? 'manual' : 'auto'
      };
    });
    if (!data.chapters.length) {
      data.chapters.push({
        id: this.uid('ch'), name: '章节 1',
        preset: { background: JSON.parse(JSON.stringify(firstBg)), visibility: {} },
        blocks: null,
        flow: { version: 1, steps: [] },
        flowMode: 'auto'
      });
    }
    return data;
  },

  normalizeChapterFlow() {
    (this.data.chapters || []).forEach(ch => {
      if (!ch.flow || typeof ch.flow !== 'object') {
        ch.flow = { version: 1, steps: [] };
      }
      if (!Array.isArray(ch.flow.steps)) ch.flow.steps = [];
      ch.flow.version = 1;
      if (ch.flowMode !== 'auto' && ch.flowMode !== 'manual') {
        ch.flowMode = ch.blocks ? 'manual' : 'auto';
      }
    });
  },

  _scanBlockState(state, risks) {
    const walk = b => {
      if (!b || typeof b !== 'object') return;
      if (b.type === 'jimu_js' || b.type === 'jimu_self_js') risks.push('执行代码积木');
      (b.inputs ? Object.values(b.inputs) : []).forEach(v => {
        if (v && v.block) walk(v.block);
        if (v && v.shadow) walk(v.shadow);
      });
      if (b.next && b.next.block) walk(b.next.block);
    };
    (state && state.blocks && state.blocks.blocks || []).forEach(walk);
  },

  executableRisks(data = this.data) {
    const risks = new Set();
    if (!data) return [];
    const scan = state => {
      const found = [];
      this._scanBlockState(state, found);
      found.forEach(x => risks.add(x));
    };
    scan(data.globalBlocks);
    (data.chapters || []).forEach(ch => scan(ch.blocks));
    (data.elements || []).forEach(el => {
      scan(el.blocks);
      if (el.type === 'webapp' && el.props && (el.props.inline || el.props.resourceId)) {
        risks.add('嵌入网页小程序');
      }
    });
    (data.resources || []).forEach(r => {
      if (/^text\/html/i.test(r.mime || '') || /\.html?$/i.test(r.name || '')) {
        risks.add('HTML 资源');
      }
    });
    return [...risks];
  },

  // ---------- .bdp 打包 / 解包 ----------
  async pack() {
    if (typeof ChapterFlow !== 'undefined') ChapterFlow.syncAll();
    const zip = new JSZip();
    const data = JSON.parse(JSON.stringify(this.data));
    for (const r of data.resources) {
      zip.file(r.path, r.data, { base64: true });
      delete r.data;
    }
    zip.file('project.json', JSON.stringify(data, null, 1));
    zip.file('meta.json', JSON.stringify({
      app: 'jimuchang', appVersion: '0.4.2',
      created: new Date().toISOString(), modified: new Date().toISOString()
    }));
    return await zip.generateAsync({ type: 'base64' });
  },

  async parse(base64) {
    const zip = await JSZip.loadAsync(base64, { base64: true });
    const pj = zip.file('project.json');
    if (!pj) throw new Error('不是有效的 .bdp 项目文件');
    let data = JSON.parse(await pj.async('string'));
    // v1 → v2 自动迁移
    if (!data.version || data.version < 2) {
      data = this.migrateV1toV2(data);
    }
    for (const r of (data.resources || [])) {
      const f = zip.file(r.path);
      if (f) r.data = await f.async('base64');
      else r.data = '';
    }
    return data;
  },

  applyLoadedData(data) {
    this.data = data;
    this.normalizeChapterFlow();
    this.idSeq = 1;
    return this.data;
  },

  async unpack(base64) {
    const data = await this.parse(base64);
    return this.applyLoadedData(data);
  }
};
