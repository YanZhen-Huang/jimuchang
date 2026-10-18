// 素材区：管理项目内资源，并支持拖拽/双击直接生成舞台元素。
const AssetHub = {
  dock: null,
  grid: null,
  search: '',
  filter: 'all',
  _dragId: '',

  init() {
    this.dock = document.getElementById('asset-dock');
    this.grid = document.getElementById('asset-grid');
    if (!this.dock || !this.grid || this._bound) return;
    this._bound = true;

    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    on('asset-close', () => this.close());
    on('asset-import', () => this.importAssets());

    const search = document.getElementById('asset-search');
    if (search) search.addEventListener('input', () => {
      this.search = String(search.value || '').trim().toLowerCase();
      this.render();
    });

    document.getElementById('asset-filters').addEventListener('click', e => {
      const btn = e.target.closest('[data-asset-filter]');
      if (!btn) return;
      this.filter = btn.dataset.assetFilter || 'all';
      document.querySelectorAll('#asset-filters button').forEach(x => {
        x.classList.toggle('active', x === btn);
      });
      this.render();
    });

    this.grid.addEventListener('click', e => {
      const del = e.target.closest('[data-asset-delete]');
      if (del) { this.remove(del.dataset.assetDelete); return; }
      const rename = e.target.closest('[data-asset-rename]');
      if (rename) { this.rename(rename.dataset.assetRename); return; }
      const insert = e.target.closest('[data-asset-insert]');
      if (insert) this.insert(insert.dataset.assetInsert);
    });
    this.grid.addEventListener('dblclick', e => {
      if (e.target.closest('button')) return;
      const card = e.target.closest('[data-asset-id]');
      if (card) this.insert(card.dataset.assetId);
    });
    this.grid.addEventListener('dragstart', e => {
      const card = e.target.closest('[data-asset-id]');
      if (!card) return;
      this._dragId = card.dataset.assetId;
      card.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/x-jimuchang-asset', this._dragId);
        e.dataTransfer.setData('text/plain', this._dragId);
      }
    });
    this.grid.addEventListener('dragend', e => {
      const card = e.target.closest('[data-asset-id]');
      if (card) card.classList.remove('dragging');
      this._dragId = '';
      document.body.classList.remove('asset-drop-ready');
    });

    const stage = Stage && Stage.wrapEl;
    if (stage) {
      stage.addEventListener('dragover', e => {
        if (!this._dragId && !(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('text/x-jimuchang-asset'))) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        document.body.classList.add('asset-drop-ready');
      });
      stage.addEventListener('dragleave', e => {
        if (e.target === stage) document.body.classList.remove('asset-drop-ready');
      });
      stage.addEventListener('drop', e => {
        const id = this._dragId || (e.dataTransfer && (
          e.dataTransfer.getData('text/x-jimuchang-asset') || e.dataTransfer.getData('text/plain')
        ));
        document.body.classList.remove('asset-drop-ready');
        if (!id) return;
        e.preventDefault();
        const p = Stage.screenToWorld(e.clientX, e.clientY);
        this.insert(id, p);
      });
    }
    this.render();
  },

  open() {
    if (!this.dock) this.init();
    if (!this.dock) return;
    this.dock.classList.remove('hidden');
    this.render();
  },

  close() {
    if (this.dock) this.dock.classList.add('hidden');
    document.body.classList.remove('asset-drop-ready');
  },

  toggle() {
    if (!this.dock) return this.open();
    if (this.dock.classList.contains('hidden')) this.open();
    else this.close();
  },

  formatSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  },

  icon(kind) {
    return { image: '图', audio: '♪', video: '▶', model3d: '3D', webapp: '</>', file: '▧' }[kind] || '▧';
  },

  preview(r, kind) {
    if (kind === 'image' && r.size <= 8 * 1024 * 1024 && r.data) {
      const url = Project.resourceUrl(r.id);
      return `<div class="asset-preview"><img src="${url}" alt="" loading="lazy" decoding="async"></div>`;
    }
    return `<div class="asset-preview ${kind}">${this.icon(kind)}</div>`;
  },

  render() {
    if (!this.dock || this.dock.classList.contains('hidden')) return;
    if (!this.grid) this.grid = document.getElementById('asset-grid');
    if (!this.grid) return;
    const all = (Project.data && Project.data.resources) || [];
    const shown = all.filter(r => {
      const kind = Project.resourceKind(r);
      if (this.filter !== 'all' && kind !== this.filter) return false;
      if (!this.search) return true;
      return String(r.name || '').toLowerCase().includes(this.search)
        || String(r.mime || '').toLowerCase().includes(this.search);
    });
    const count = document.getElementById('asset-count');
    if (count) count.textContent = all.length + ' 个素材';
    if (!all.length) {
      this.grid.innerHTML = '<div class="asset-empty">素材区还是空的<br>点「导入素材」添加图片、音频、视频、3D 模型或网页</div>';
      return;
    }
    if (!shown.length) {
      this.grid.innerHTML = '<div class="asset-empty">没有匹配的素材</div>';
      return;
    }
    this.grid.innerHTML = shown.map(r => {
      const kind = Project.resourceKind(r);
      return `<article class="asset-card" draggable="true" data-asset-id="${esc(r.id)}" title="拖到舞台或双击插入">
        ${this.preview(r, kind)}
        <div class="asset-info">
          <span class="asset-name" title="${esc(r.name)}">${esc(r.name)}</span>
          <div class="asset-meta"><span>${kind}</span><span>${this.formatSize(r.size)}</span></div>
          <div class="asset-actions">
            <button data-asset-insert="${esc(r.id)}">插入</button>
            <button data-asset-rename="${esc(r.id)}">改名</button>
            <button class="danger" data-asset-delete="${esc(r.id)}">删除</button>
          </div>
        </div>
      </article>`;
    }).join('');
  },

  async importAssets() {
    if (!App.host) { toast('浏览器预览模式无法导入素材'); return; }
    await App.hostReady;
    try {
      const files = await App.host.importResourceMulti('asset');
      if (!files || !files.length) return;
      let added = 0;
      for (const f of files) {
        if (!f || !f.name || !f.base64) continue;
        Project.addResource(f.name, f.mime || 'application/octet-stream', f.base64);
        added++;
      }
      if (!added) return;
      App.markDirty(true);
      this.render();
      toast(`已导入 ${added} 个素材`);
    } catch (e) {
      toast('导入失败：' + (e.message || e));
    }
  },

  insert(id, point) {
    const r = Project.getResource(id);
    if (!r) return null;
    const kind = Project.resourceKind(r);
    const type = kind === 'file' ? '' : kind;
    if (!type) { toast('这个文件类型暂不支持直接插入'); return null; }
    const dims = {
      image: [480, 320], video: [720, 405], audio: [140, 140],
      model3d: [640, 560], webapp: [480, 320]
    }[type];
    const [w, h] = dims;
    let x = 960 - w / 2, y = 540 - h / 2;
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      x = Math.round(point.x - w / 2);
      y = Math.round(point.y - h / 2);
    }
    x = Math.max(-w / 2, Math.min(1920 - w / 2, x));
    y = Math.max(-h / 2, Math.min(1080 - h / 2, y));
    const el = Project.createElement(type, {
      name: r.name,
      x, y, w, h,
      props: { resourceId: r.id }
    });
    const ch = Stage.currentChapter() || (Project.data.chapters || [])[0];
    if (ch) {
      ch.preset = ch.preset || {};
      ch.preset.visibility = ch.preset.visibility || {};
      ch.preset.visibility[el.id] = true;
      if (ch.flowMode === 'auto' && typeof ChapterFlow !== 'undefined') ChapterFlow.sync(ch);
    }
    Stage.renderAll();
    if (ch) Stage.goChapter(ch.id, { instant: true });
    Editor.select(el.id);
    App.renderElementBar();
    App.renderTabs();
    App.markDirty(true);
    this.render();
    toast('已插入素材：' + r.name);
    return el;
  },

  rename(id) {
    const r = Project.getResource(id);
    if (!r) return;
    const name = prompt('素材名称', r.name);
    if (!name || name === r.name) return;
    if (!Project.renameResource(id, name)) { toast('名称无效'); return; }
    App.markDirty(true);
    this.render();
    Panel.show();
  },

  remove(id) {
    const r = Project.getResource(id);
    if (!r) return;
    const usage = Project.resourceUsage(id);
    if (usage.length) {
      const where = usage.slice(0, 3).map(u => `「${u.name}」`).join('、');
      toast('素材仍在使用中：' + where + (usage.length > 3 ? ' 等' : ''));
      return;
    }
    if (!confirm(`删除素材「${r.name}」？`)) return;
    const result = Project.removeResource(id);
    if (!result.ok) { toast(result.reason || '删除失败'); return; }
    App.markDirty(true);
    this.render();
  }
};

window.AssetHub = AssetHub;
