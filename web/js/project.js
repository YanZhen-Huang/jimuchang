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
      blocks: null
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
    const res = {
      id: this.uid('res'),
      name, mime, size: Math.round(base64.length * 0.75),
      path: 'resources/' + this.uid('r') + '_' + name,
      data: base64
    };
    this.data.resources.push(res);
    return res;
  },

  getResource(id) { return this.data.resources.find(r => r.id === id) || null; },

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
        blocks: sc.blocks || null
      };
    });
    if (!data.chapters.length) {
      data.chapters.push({
        id: this.uid('ch'), name: '章节 1',
        preset: { background: JSON.parse(JSON.stringify(firstBg)), visibility: {} },
        blocks: null
      });
    }
    return data;
  },

  // ---------- .bdp 打包 / 解包 ----------
  async pack() {
    const zip = new JSZip();
    const data = JSON.parse(JSON.stringify(this.data));
    for (const r of data.resources) {
      zip.file(r.path, r.data, { base64: true });
      delete r.data;
    }
    zip.file('project.json', JSON.stringify(data, null, 1));
    zip.file('meta.json', JSON.stringify({
      app: 'jimuchang', appVersion: '0.2.0',
      created: new Date().toISOString(), modified: new Date().toISOString()
    }));
    return await zip.generateAsync({ type: 'base64' });
  },

  async unpack(base64) {
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
    this.data = data;
    this.idSeq = 1;
    return data;
  }
};
