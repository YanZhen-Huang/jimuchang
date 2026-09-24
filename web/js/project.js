// 项目数据模型 + .bdp 序列化（按技术文档 4.2）
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
      version: 1,
      name,
      canvas: { width: 1920, height: 1080 },
      theme: { bg: '#0F1115' },
      resources: [],
      scenes: [],
      globalBlocks: null,
      music: { resourceId: null, loop: true, volume: 0.8 }
    };
    this.filePath = null;
    this.addScene('封面');
    return this.data;
  },

  // ---- 场景 ----
  addScene(name) {
    const scene = {
      id: this.uid('scene'),
      name: name || ('场景 ' + (this.data.scenes.length + 1)),
      background: { type: 'color', value: this.data.theme.bg },
      transition: { type: 'fade', duration: 0.6 },
      elements: [],
      blocks: null
    };
    this.data.scenes.push(scene);
    return scene;
  },

  getScene(id) { return this.data.scenes.find(s => s.id === id) || null; },

  removeScene(id) {
    const i = this.data.scenes.findIndex(s => s.id === id);
    if (i >= 0 && this.data.scenes.length > 1) {
      this.data.scenes.splice(i, 1);
      return true;
    }
    return false;
  },

  sceneIndex(id) { return this.data.scenes.findIndex(s => s.id === id); },

  // ---- 元素 ----
  createElement(scene, type, props = {}) {
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
      sprite: { name: '帧动画', w: 320, h: 320, x: 800, y: 380, props: { kind: 'sheet', resourceId: null, frames: [], cols: 4, rows: 4, fps: 12, loop: true } }
    };
    const d = defaults[type] || defaults.shape;
    const maxZ = scene.elements.reduce((m, e) => Math.max(m, e.z || 0), 0);
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
      entrance: null, exit: null, effects: [], keyframes: null
    };
    scene.elements.push(el);
    return el;
  },

  getElement(scene, id) { return scene.elements.find(e => e.id === id) || null; },

  findElementById(id) {
    for (const s of this.data.scenes) {
      const el = s.elements.find(e => e.id === id);
      if (el) return { scene: s, element: el };
    }
    return null;
  },

  removeElement(scene, id) {
    const i = scene.elements.findIndex(e => e.id === id);
    if (i >= 0) { scene.elements.splice(i, 1); return true; }
    return false;
  },

  // ---- 资源 ----
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

  // ---- 元素按名称查找（积木/脚本用）----
  // ---- .bdp 打包 / 解包 ----
  async pack() {
    const zip = new JSZip();
    const data = JSON.parse(JSON.stringify(this.data));
    // 资源写入 zip，内存数据里剔除 base64 大字段
    for (const r of data.resources) {
      zip.file(r.path, r.data, { base64: true });
      delete r.data;
    }
    zip.file('project.json', JSON.stringify(data, null, 1));
    zip.file('meta.json', JSON.stringify({
      app: 'jimuchang', appVersion: '0.1.0',
      created: new Date().toISOString(), modified: new Date().toISOString()
    }));
    return await zip.generateAsync({ type: 'base64' });
  },

  async unpack(base64) {
    const zip = await JSZip.loadAsync(base64, { base64: true });
    const pj = zip.file('project.json');
    if (!pj) throw new Error('不是有效的 .bdp 项目文件');
    const data = JSON.parse(await pj.async('string'));
    // 资源读回内存
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
