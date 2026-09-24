// 编辑历史：撤销 / 重做（覆盖舞台元素与场景数据，不动积木脚本）
const History = {
  stack: [],
  index: -1,
  limit: 60,
  _timer: 0,

  reset() {
    this.stack = [];
    this.index = -1;
    clearTimeout(this._timer);
    this._push(true);
  },

  // 防抖记录（连续输入/拖动合并为一步）
  capture(immediate) {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._push(), immediate ? 0 : 380);
  },

  _snapshot() {
    const d = JSON.parse(JSON.stringify(Object.assign({}, Project.data, { resources: [] })));
    d.resources = Project.data.resources.map(r => ({
      id: r.id, name: r.name, mime: r.mime, path: r.path, size: r.size
    }));
    return d;
  },

  _push(force) {
    if (!Project.data) return;
    const snap = this._snapshot();
    const cur = this.stack[this.index];
    if (cur && !force && JSON.stringify(cur) === JSON.stringify(snap)) return;
    this.stack.splice(this.index + 1);
    this.stack.push(snap);
    if (this.stack.length > this.limit) {
      this.stack.shift();
    }
    this.index = this.stack.length - 1;
    App.updateHistoryButtons();
  },

  canUndo() { return this.index > 0; },
  canRedo() { return this.index < this.stack.length - 1; },

  undo() {
    if (!this.canUndo()) return;
    this.index--;
    this.apply(this.stack[this.index]);
  },

  redo() {
    if (!this.canRedo()) return;
    this.index++;
    this.apply(this.stack[this.index]);
  },

  apply(snap) {
    // 资源数据保留（快照不含 data 大字段）
    const dataMap = new Map(Project.data.resources.map(r => [r.id, r.data]));
    const clone = JSON.parse(JSON.stringify(snap));
    clone.resources.forEach(r => { r.data = dataMap.get(r.id) || ''; });
    // 积木脚本不参与撤销（保留当前工作区内容）
    JimuBlocks.save();
    clone.globalBlocks = Project.data.globalBlocks;
    const blocksById = new Map(Project.data.scenes.map(s => [s.id, s.blocks]));
    clone.scenes.forEach(sc => { if (blocksById.has(sc.id)) sc.blocks = blocksById.get(sc.id); });

    Project.data = clone;
    const sc = Project.getScene(Stage.currentSceneId) || Project.data.scenes[0];
    JimuBlocks.current = null;
    JimuBlocks.ws.clear();
    Stage.render(sc);
    App.activeTab = 'global';
    JimuBlocks.switchTo('global');
    Editor.select(null);
    App.renderTabs();
    Panel.show();
    App.updateHistoryButtons();
    App.markDirty(true);
  }
};
