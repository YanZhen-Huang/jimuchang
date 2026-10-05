// 全局设置：持久化到 C++ QSettings（qrc 页面的 localStorage 不可靠）
// 编辑器偏好（设置面板 + 主题/章节栏/PPT选项），与项目数据无关
const Settings = {
  defaults: {
    // 界面（内部键，不进设置面板）
    theme: 'dark',
    chapterBar: 'closed',
    pptOpts: null,
    leftWidth: 0,            // 0=自适应；>0=积木区拖拽宽度(px)
    leftCollapsed: false,    // 积木区收起
    propsCollapsed: false,   // 属性面板折叠
    // 编辑器
    autosaveMin: 2,          // 0=关闭
    alignGuides: true,
    undoLimit: 60,
    blockCount: false,
    blockSounds: false,
    showHomeOnStart: true,
    uiScale: 100,
    // 播放与导出
    defaultTransition: 0.6,
    hideCursor: true,
    pptRes: 720,             // 高保真导出分辨率（720/1080）
    pptQuality: 85,          // 导出图片质量 1-100
    packCompress: true,      // 放映包图片自动压缩
    // 渲染性能
    disableGpu: false,
    ecoMode: false,
    threeFps: 60,
    fxFps: 60,
    threeShadows: true,
    showFps: false,
    // 高级
    showAdvanced: true,
    cloneLimit: 200,
    apiEnabled: true,
    // AI 助手（DeepSeek）
    aiKey: '',
    aiModel: 'deepseek-chat'
  },
  data: {},
  host: null,

  load() {
    // 初始给默认值；真正的持久化在 loadFromHost（宿主就绪后）
    this.data = Object.assign({}, this.defaults);
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) this.data = Object.assign(this.data, JSON.parse(raw));
    } catch (e) { }
    return this.data;
  },

  // 宿主就绪后从 QSettings 读取已保存的设置
  async loadFromHost(host) {
    this.host = host;
    if (!host || !host.getPref) return;
    try {
      const raw = await host.getPref('settingsJson');
      if (raw) this.data = Object.assign({}, this.defaults, JSON.parse(raw));
    } catch (e) {
      console.warn('读取设置失败', e);
    }
  },

  persist() {
    if (this.host && this.host.setPref) {
      try { this.host.setPref('settingsJson', JSON.stringify(this.data)); } catch (e) { }
    }
  },

  get(key) {
    return this.data[key] !== undefined ? this.data[key] : this.defaults[key];
  },

  set(key, val) {
    this.data[key] = val;
    this.persist();
    if (typeof App !== 'undefined' && App.applySettings) {
      try { App.applySettings(); } catch (e) { console.warn('应用设置失败', e); }
    }
  },

  reset() {
    this.data = Object.assign({}, this.defaults);
    this.persist();
    if (typeof App !== 'undefined' && App.applySettings) App.applySettings();
  },

  // 有效帧率（节能模式统一降 30）
  fps(kind) {
    if (this.get('ecoMode')) return 30;
    return kind === 'fx' ? this.get('fxFps') : this.get('threeFps');
  }
};
Settings.KEY = 'jimuchang-settings';
Settings.load();
