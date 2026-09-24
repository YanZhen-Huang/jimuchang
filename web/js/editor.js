// 编辑交互：选中/拖动/缩放/属性面板
function setPath(obj, path, v) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (o[parts[i]] === undefined || o[parts[i]] === null) o[parts[i]] = {};
    o = o[parts[i]];
  }
  o[parts[parts.length - 1]] = v;
}

function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const Editor = {
  rootEl: null, selectedId: null, drag: null,

  init(rootEl) {
    this.rootEl = rootEl;
    rootEl.addEventListener('mousedown', e => this.onDown(e));
    window.addEventListener('mousemove', e => this.onMove(e));
    window.addEventListener('mouseup', e => this.onUp(e));
    rootEl.addEventListener('dblclick', e => this.onDblClick(e));
    rootEl.addEventListener('contextmenu', e => this.onContextMenu(e));
    ContextMenu.init();
  },

  onContextMenu(e) {
    if (App.playing) return;
    e.preventDefault();
    const elDom = e.target.closest('.el');
    const f = elDom ? Project.findElementById(elDom.dataset.id) : null;
    if (f) {
      if (this.selectedId !== f.element.id) this.select(f.element.id);
      ContextMenu.show(e.clientX, e.clientY, [
        { label: '关键帧动画…', action: () => Keyframes.open() },
        { type: 'sep' },
        { label: '复制元素', action: () => this.duplicateSelected() },
        { label: '上移一层', action: () => { f.element.z += 1; Stage.refreshAll(); this.refresh(); App.markDirty(); } },
        { label: '下移一层', action: () => { f.element.z = Math.max(1, f.element.z - 1); Stage.refreshAll(); this.refresh(); App.markDirty(); } },
        { type: 'sep' },
        { label: f.element.locked ? '解锁' : '锁定', action: () => { f.element.locked = !f.element.locked; Panel.show(); App.markDirty(); } },
        { label: '删除元素', danger: true, action: () => this.deleteSelected() }
      ]);
    } else {
      ContextMenu.show(e.clientX, e.clientY, [
        { label: '插入文字', action: () => this.addElement('text') },
        { label: '插入形状', action: () => this.addElement('shape') },
        { label: '插入图标', action: () => this.addElement('icon') },
        { label: '插入图表', action: () => this.addElement('chart') },
        { label: '插入 3D 模型', action: () => this.addElement('model3d') },
        { type: 'sep' },
        { label: '插入图片…', action: () => App.addMediaElement('image') },
        { label: '插入视频…', action: () => App.addMediaElement('video') }
      ]);
    }
  },

  selected() { return this.selectedId ? Project.findElementById(this.selectedId) : null; },

  toLogic(cx, cy) {
    const r = Stage.rootEl.getBoundingClientRect();
    return { x: (cx - r.left) / Stage.scale, y: (cy - r.top) / Stage.scale };
  },

  select(id) {
    this.selectedId = id;
    this.refresh();
    Panel.show();
  },

  refresh() {
    document.querySelectorAll('.el.selected').forEach(d => d.classList.remove('selected'));
    document.querySelectorAll('.el-handle').forEach(h => h.remove());
    if (!this.selectedId) return;
    const dom = Stage.elDom(this.selectedId);
    if (!dom) return;
    dom.classList.add('selected');
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(dir => {
      const h = document.createElement('div');
      h.className = 'el-handle h-' + dir;
      h.dataset.dir = dir;
      dom.appendChild(h);
    });
  },

  // ---------- 对齐辅助线 ----------
  ensureGuides() {
    if (!this.guidesEl || !this.guidesEl.isConnected) {
      this.guidesEl = document.createElement('div');
      this.guidesEl.className = 'align-guides';
      Stage.rootEl.appendChild(this.guidesEl);
    }
    return this.guidesEl;
  },

  clearGuides() {
    if (this.guidesEl) this.guidesEl.innerHTML = '';
  },

  computeSnap(el, scene) {
    const TH = 8;
    const others = scene.elements.filter(o => o.id !== el.id && o.visible !== false);
    const xs = [960], ys = [540];
    others.forEach(o => {
      xs.push(o.x, o.x + o.w / 2, o.x + o.w);
      ys.push(o.y, o.y + o.h / 2, o.y + o.h);
    });
    const keyXs = [el.x, el.x + el.w / 2, el.x + el.w];
    const keyYs = [el.y, el.y + el.h / 2, el.y + el.h];
    let dx = 0, dy = 0, lineV = null, lineH = null;
    let bestDx = Infinity, bestDy = Infinity;
    keyXs.forEach(kx => xs.forEach(tx => {
      const d = tx - kx;
      if (Math.abs(d) <= TH && Math.abs(d) < bestDx) { bestDx = Math.abs(d); dx = d; lineV = tx; }
    }));
    keyYs.forEach(ky => ys.forEach(ty => {
      const d = ty - ky;
      if (Math.abs(d) <= TH && Math.abs(d) < bestDy) { bestDy = Math.abs(d); dy = d; lineH = ty; }
    }));
    return { dx, dy, lineV, lineH };
  },

  drawGuides(lineV, lineH) {
    const g = this.ensureGuides();
    g.innerHTML = '';
    if (lineV !== null) {
      const d = document.createElement('div');
      d.className = 'guide-v';
      d.style.left = lineV + 'px';
      g.appendChild(d);
    }
    if (lineH !== null) {
      const d = document.createElement('div');
      d.className = 'guide-h';
      d.style.top = lineH + 'px';
      g.appendChild(d);
    }
  },

  onDown(e) {
    if (App.playing) return;
    const handle = e.target.closest('.el-handle');
    const elDom = e.target.closest('.el');
    if (!elDom) { this.select(null); return; }
    const id = elDom.dataset.id;
    const f = Project.findElementById(id);
    if (!f) return;
    const p = this.toLogic(e.clientX, e.clientY);
    if (handle) {
      if (f.element.locked) return;
      this.drag = {
        mode: 'resize', dir: handle.dataset.dir, id,
        sx: p.x, sy: p.y,
        ox: f.element.x, oy: f.element.y, ow: f.element.w, oh: f.element.h
      };
    } else {
      if (this.selectedId !== id) this.select(id);
      if (f.element.locked) { e.preventDefault(); return; }
      this.drag = { mode: 'move', id, sx: p.x, sy: p.y, ox: f.element.x, oy: f.element.y };
    }
    e.preventDefault();
  },

  onMove(e) {
    if (!this.drag || App.playing) return;
    const f = Project.findElementById(this.drag.id);
    if (!f) return;
    const el = f.element;
    const p = this.toLogic(e.clientX, e.clientY);
    const dx = p.x - this.drag.sx, dy = p.y - this.drag.sy;
    if (this.drag.mode === 'move') {
      el.x = Math.round(this.drag.ox + dx);
      el.y = Math.round(this.drag.oy + dy);
      const snap = this.computeSnap(el, f.scene);
      if (snap.dx) el.x += Math.round(snap.dx);
      if (snap.dy) el.y += Math.round(snap.dy);
      this.drawGuides(snap.lineV, snap.lineH);
    } else {
      this.clearGuides();
      const d = this.drag;
      let x = d.ox, y = d.oy, w = d.ow, h = d.oh;
      if (d.dir.includes('e')) w = d.ow + dx;
      if (d.dir.includes('s')) h = d.oh + dy;
      if (d.dir.includes('w')) { x = d.ox + dx; w = d.ow - dx; }
      if (d.dir.includes('n')) { y = d.oy + dy; h = d.oh - dy; }
      if (w < 20) { w = 20; if (d.dir.includes('w')) x = d.ox + d.ow - 20; }
      if (h < 20) { h = 20; if (d.dir.includes('n')) y = d.oy + d.oh - 20; }
      el.x = Math.round(x); el.y = Math.round(y);
      el.w = Math.round(w); el.h = Math.round(h);
    }
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) this.drag.moved = true;
    const dom = Stage.elDom(el.id);
    if (dom) Elements.applyBox(el, dom);
    Panel.updateQuick(el);
  },

  onUp() {
    if (this.drag) {
      if (this.drag.moved) {
        const f = Project.findElementById(this.drag.id);
        const dom = f && Stage.elDom(this.drag.id);
        if (dom && f.element.type === 'shape') Elements.refreshContent(f.element, dom);
        App.markDirty();
      }
      this.drag = null;
    }
    this.clearGuides();
  },

  onDblClick(e) {
    if (App.playing) return;
    const elDom = e.target.closest('.el');
    if (!elDom) return;
    const f = Project.findElementById(elDom.dataset.id);
    if (!f || f.element.type !== 'text') return;
    const t = elDom.querySelector('.c-text');
    if (!t) return;
    t.contentEditable = 'true';
    t.style.cursor = 'text';
    t.focus();
    const range = document.createRange();
    range.selectNodeContents(t);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(range);
    const finish = () => {
      t.contentEditable = 'false';
      f.element.props.text = t.textContent;
      Stage.refresh(f.element.id);
      Panel.show();
      App.markDirty();
    };
    t.addEventListener('blur', finish, { once: true });
  },

  // 添加元素
  addElement(type) {
    const scene = Stage.currentScene();
    if (!scene) return;
    const el = Project.createElement(scene, type);
    Stage.refreshAll();
    this.select(el.id);
    App.markDirty();
    return el;
  },

  deleteSelected() {
    const sel = this.selected();
    if (!sel) return;
    Project.removeElement(sel.scene, sel.element.id);
    this.select(null);
    Stage.refreshAll();
    App.markDirty();
  },

  duplicateSelected() {
    const sel = this.selected();
    if (!sel) return;
    const copy = JSON.parse(JSON.stringify(sel.element));
    copy.id = Project.uid('el');
    copy.x += 40; copy.y += 40;
    copy.z = sel.scene.elements.reduce((m, e) => Math.max(m, e.z || 0), 0) + 1;
    copy.name = sel.element.name + ' 副本';
    sel.scene.elements.push(copy);
    Stage.refreshAll();
    this.select(copy.id);
    App.markDirty();
  },

  nudge(dx, dy) {
    const sel = this.selected();
    if (!sel) return;
    sel.element.x += dx;
    sel.element.y += dy;
    const dom = Stage.elDom(sel.element.id);
    if (dom) Elements.applyBox(sel.element, dom);
    Panel.updateQuick(sel.element);
    App.markDirty();
  }
};

// ---------- 属性面板 ----------
const Panel = {
  el: null,

  init(el) {
    this.el = el;
    el.addEventListener('input', e => this.onInput(e));
    el.addEventListener('change', e => this.onInput(e));
    el.addEventListener('click', e => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      this.onAction(btn.dataset.action);
    });
  },

  show() {
    const sel = Editor.selected();
    if (sel) this.renderElement(sel.scene, sel.element);
    else this.renderScene();
  },

  row(label, inner) {
    return `<div class="p-row"><label>${label}</label><div class="p-ctl">${inner}</div></div>`;
  },

  options(list, cur) {
    return list.map(([n, v]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${n}</option>`).join('');
  },

  renderScene() {
    const sc = Stage.currentScene();
    if (!sc) { this.el.innerHTML = '<div class="p-empty">没有场景</div>'; return; }
    const bg = sc.background || { type: 'color', value: '#0F1115' };
    const bgColor = typeof bg.value === 'string' ? bg.value
      : (bg.value && bg.value.stops && bg.value.stops[0] ? bg.value.stops[0][0] : '#0F1115');
    const tr = sc.transition || { type: 'fade', duration: 0.6 };
    this.el.innerHTML = `
      <div class="p-title">场景属性</div>
      ${this.row('名称', `<input data-prop="name" value="${esc(sc.name)}">`)}
      ${this.row('背景色', `<input type="color" data-prop="background.value" value="${bgColor}">`)}
      ${this.row('转场', `<select data-prop="transition.type">${this.options(JimuConst.TRANSITIONS, tr.type)}</select>`)}
      ${this.row('转场时长', `<input type="number" step="0.1" min="0" max="10" data-prop="transition.duration" value="${tr.duration}">`)}
      ${this.row('背景特效', `<select data-prop="fx.type">${this.options([['无', ''], ['星空', 'starfield'], ['飘雪', 'snow'], ['漂浮微粒', 'particles'], ['极光', 'aurora']], (sc.fx && sc.fx.type) || '')}</select>`)}
      <div class="p-hint">在舞台中拖入元素，或者用工具栏添加文字 / 图片 / 视频 / 音频 / 形状 / 图标</div>
    `;
  },

  renderElement(scene, el) {
    const p = el.props || {};
    let typeFields = '';
    if (el.type === 'text') {
      typeFields = `
        ${this.row('内容', `<input data-prop="props.text" value="${esc(p.text)}">`)}
        ${this.row('字号', `<input type="number" data-prop="props.size" value="${p.size}" min="8" max="400">`)}
        ${this.row('颜色', `<input type="color" data-prop="props.color" value="${p.color || '#E6E9EF'}">`)}
        ${this.row('对齐', `<select data-prop="props.align">${this.options([['居左', 'left'], ['居中', 'center'], ['居右', 'right']], p.align)}</select>`)}
        ${this.row('样式', `<label class="p-chk"><input type="checkbox" data-prop="props.bold" ${p.bold ? 'checked' : ''}>粗</label>
          <label class="p-chk"><input type="checkbox" data-prop="props.italic" ${p.italic ? 'checked' : ''}>斜</label>
          <label class="p-chk"><input type="checkbox" data-prop="props.underline" ${p.underline ? 'checked' : ''}>下划线</label>`)}
      `;
    } else if (el.type === 'image') {
      const res = p.resourceId ? Project.getResource(p.resourceId) : null;
      typeFields = `
        ${this.row('图片', `<span class="p-dim">${res ? esc(res.name) : '未选择'}</span>`)}
        ${this.row('', `<button data-action="pick-image" class="p-btn">更换图片…</button>`)}
        ${this.row('填充', `<select data-prop="props.fit">${this.options([['完整显示', 'contain'], ['裁剪填满', 'cover'], ['拉伸', 'stretch']], p.fit)}</select>`)}
      `;
    } else if (el.type === 'shape') {
      typeFields = `
        ${this.row('形状', `<select data-prop="props.shape">${this.options([['矩形', 'rect'], ['圆', 'circle'], ['椭圆', 'ellipse'], ['三角形', 'triangle'], ['箭头', 'arrow'], ['直线', 'line']], p.shape)}</select>`)}
        ${this.row('填充', `<input type="color" data-prop="props.fill" value="${p.fill || '#6C8CFF'}">`)}
        ${this.row('描边色', `<input type="color" data-prop="props.stroke" value="${p.stroke || '#ffffff'}">`)}
        ${this.row('描边宽', `<input type="number" data-prop="props.strokeWidth" value="${p.strokeWidth || 0}" min="0" max="40">`)}
        ${this.row('圆角', `<input type="number" data-prop="props.radius" value="${p.radius || 0}" min="0" max="300">`)}
      `;
    } else if (el.type === 'icon') {
      typeFields = `
        ${this.row('字符', `<input data-prop="props.char" value="${esc(p.char)}" maxlength="4">`)}
        ${this.row('大小', `<input type="number" data-prop="props.size" value="${p.size}" min="8" max="800">`)}
        ${this.row('颜色', `<input type="color" data-prop="props.color" value="${p.color || '#F5A623'}">`)}
        <div class="p-hint">可以直接粘贴 emoji：😀 🚀 ⭐ 🎉 ❤️ 🔥 💡 ✨</div>
      `;
    } else if (el.type === 'video') {
      const res = p.resourceId ? Project.getResource(p.resourceId) : null;
      typeFields = `
        ${this.row('视频', `<span class="p-dim">${res ? esc(res.name) : '未选择'}</span>`)}
        ${this.row('', `<button data-action="pick-video" class="p-btn">更换视频…</button>`)}
        ${this.row('选项', `<label class="p-chk"><input type="checkbox" data-prop="props.loop" ${p.loop ? 'checked' : ''}>循环</label>
          <label class="p-chk"><input type="checkbox" data-prop="props.muted" ${p.muted ? 'checked' : ''}>静音</label>
          <label class="p-chk"><input type="checkbox" data-prop="props.autoplay" ${p.autoplay ? 'checked' : ''}>进场景自动播放</label>`)}
      `;
    } else if (el.type === 'audio') {
      const res = p.resourceId ? Project.getResource(p.resourceId) : null;
      typeFields = `
        ${this.row('音频', `<span class="p-dim">${res ? esc(res.name) : '未选择'}</span>`)}
        ${this.row('', `<button data-action="pick-audio" class="p-btn">更换音频…</button>`)}
        ${this.row('音量', `<input type="number" step="0.1" min="0" max="1" data-prop="props.volume" value="${p.volume !== undefined ? p.volume : 1}">`)}
        ${this.row('选项', `<label class="p-chk"><input type="checkbox" data-prop="props.loop" ${p.loop ? 'checked' : ''}>循环</label>
          <label class="p-chk"><input type="checkbox" data-prop="props.autoplay" ${p.autoplay ? 'checked' : ''}>进场景自动播放</label>`)}
        <div class="p-hint">音频元素在放映时不显示，仅用于发声。也可以用"媒体"分类的积木直接控制。</div>
      `;
    } else if (el.type === 'chart') {
      typeFields = `
        ${this.row('类型', `<select data-prop="props.chartType">${this.options([['柱状图', 'bar'], ['折线图', 'line'], ['饼图', 'pie'], ['环形图', 'doughnut']], p.chartType)}</select>`)}
        ${this.row('分类', `<input data-prop="props.categories" value="${esc((p.categories || []).join(','))}">`)}
        ${this.row('数值', `<input data-prop="props.values" value="${esc((p.values || []).join(','))}">`)}
        ${this.row('系列名', `<input data-prop="props.seriesName" value="${esc(p.seriesName || '')}">`)}
        <div class="p-hint">分类与数值用逗号分隔、两行数量对应，例如：一月,二月,三月 / 120,200,150</div>
      `;
    } else if (el.type === 'model3d') {
      const builtin = !p.resourceId || p.resourceId === 'builtin:robot';
      const res = !builtin ? Project.getResource(p.resourceId) : null;
      typeFields = `
        ${this.row('模型', `<span class="p-dim">${builtin ? '内置机器人（带骨骼动画）' : (res ? esc(res.name) : '未选择')}</span>`)}
        ${this.row('', `<button data-action="pick-model" class="p-btn">导入模型…</button>
          <button data-action="use-robot" class="p-btn">用内置机器人</button>`)}
        ${this.row('动画名', `<input data-prop="props.animation.name" value="${esc((p.animation && p.animation.name) || '')}" placeholder="如 Idle / Dance / Wave">`)}
        ${this.row('灯光', `<select data-prop="props.lights.preset">${this.options([['柔和', 'soft'], ['明亮', 'bright'], ['昏暗', 'dark'], ['冷色', 'cool'], ['暖色', 'warm']], (p.lights && p.lights.preset) || 'soft')}</select>`)}
        ${this.row('自动旋转', `<input type="checkbox" data-prop="props.autoRotate" ${p.autoRotate ? 'checked' : ''}>`)}
        <div class="p-hint">用"3D"分类积木控制镜头/环绕/动画。机器人常用动画：Idle / Walking / Dance / Wave / Jump / ThumbsUp</div>
      `;
    } else if (el.type === 'webapp') {
      const res = p.resourceId ? Project.getResource(p.resourceId) : null;
      typeFields = `
        ${this.row('页面', `<span class="p-dim">${res ? esc(res.name) : '未选择'}</span>`)}
        ${this.row('', `<button data-action="pick-webapp" class="p-btn">选择 HTML 文件…</button>`)}
        <div class="p-hint">小程序在沙箱中运行；用"高级"分类的积木与它互发消息（postMessage）。</div>
      `;
    } else if (el.type === 'sprite') {
      const res = p.resourceId ? Project.getResource(p.resourceId) : null;
      const isFrames = p.kind === 'frames';
      typeFields = `
        ${this.row('形式', `<select data-prop="props.kind">${this.options([['雪碧图（一张大图切帧）', 'sheet'], ['序列图（多张图片）', 'frames']], p.kind || 'sheet')}</select>`)}
        ${isFrames ? `
          ${this.row('帧数', `<span class="p-dim">${(p.frames || []).length} 帧</span>`)}
          ${this.row('', `<button data-action="pick-frames" class="p-btn">选择帧图片…（可多选）</button>`)}
        ` : `
          ${this.row('图片', `<span class="p-dim">${res ? esc(res.name) : '未选择'}</span>`)}
          ${this.row('', `<button data-action="pick-sprite" class="p-btn">选择雪碧图…</button>`)}
          ${this.row('列×行', `<input type="number" data-prop="props.cols" value="${p.cols || 1}" min="1" max="64">
            <input type="number" data-prop="props.rows" value="${p.rows || 1}" min="1" max="64">`)}
        `}
        ${this.row('速度', `<input type="number" data-prop="props.fps" value="${p.fps || 12}" min="1" max="60"> 帧/秒`)}
        ${this.row('循环', `<input type="checkbox" data-prop="props.loop" ${p.loop !== false ? 'checked' : ''}>`)}
      `;
    }

    const ent = el.entrance || { type: 'none', duration: 0.6, delay: 0, easing: 'easeOutCubic' };
    this.el.innerHTML = `
      <div class="p-title">元素属性 <span class="p-type">${esc(typeLabel(el.type))}</span></div>
      ${this.row('名称', `<input data-prop="name" value="${esc(el.name)}">`)}
      ${this.row('', `<label class="p-chk"><input type="checkbox" data-prop="locked" ${el.locked ? 'checked' : ''}>锁定（不可拖动）</label>`)}
      <div class="p-grid">
        <div>X <input type="number" data-prop="x" value="${el.x}"></div>
        <div>Y <input type="number" data-prop="y" value="${el.y}"></div>
        <div>宽 <input type="number" data-prop="w" value="${el.w}"></div>
        <div>高 <input type="number" data-prop="h" value="${el.h}"></div>
        <div>旋转 <input type="number" data-prop="rotation" value="${el.rotation || 0}"></div>
        <div>透明度 <input type="number" step="0.1" min="0" max="1" data-prop="opacity" value="${el.opacity}"></div>
      </div>
      ${typeFields}
      <div class="p-divider">入场动画</div>
      ${this.row('类型', `<select data-prop="entrance.type">${this.options([['无', 'none'], ...JimuConst.ANIM_TYPES], ent.type)}</select>`)}
      ${this.row('时长/延迟', `<input type="number" step="0.1" data-prop="entrance.duration" value="${ent.duration}">
        <input type="number" step="0.1" data-prop="entrance.delay" value="${ent.delay}">`)}
      ${this.row('缓动', `<select data-prop="entrance.easing">${this.options(JimuConst.EASINGS, ent.easing)}</select>`)}
      <div class="p-divider">常驻特效</div>
      ${this.row('特效', Effects.ELEMENT_TYPES.map(t =>
        `<label class="p-chk"><input type="checkbox" data-fx="${t}" ${(el.effects || []).some(f => f.type === t) ? 'checked' : ''}>${fxLabel(t)}</label>`
      ).join(''))}
      <div class="p-actions">
        <button data-action="edit-keyframes" class="p-btn">关键帧动画…</button>
        <button data-action="preview-anim" class="p-btn">预览动画</button>
        <button data-action="up" class="p-btn">上移一层</button>
        <button data-action="down" class="p-btn">下移一层</button>
        <button data-action="duplicate" class="p-btn">复制</button>
        <button data-action="delete" class="p-btn danger">删除</button>
      </div>
    `;
  },

  onInput(e) {
    const t = e.target;
    // 元素常驻特效勾选
    if (t.dataset.fx) {
      const sel = Editor.selected();
      if (!sel) return;
      const el = sel.element;
      el.effects = el.effects || [];
      const idx = el.effects.findIndex(f => f.type === t.dataset.fx);
      if (t.checked && idx < 0) el.effects.push({ type: t.dataset.fx, params: {}, loop: true });
      if (!t.checked && idx >= 0) el.effects.splice(idx, 1);
      const dom = Stage.elDom(el.id);
      if (dom) Effects.attach(el, dom);
      App.markDirty();
      return;
    }
    const path = t.dataset.prop;
    if (!path) return;
    const sel = Editor.selected();
    const obj = sel ? sel.element : Stage.currentScene();
    if (!obj) return;
    let value;
    if (t.type === 'checkbox') value = t.checked;
    else if (t.type === 'number') value = Number(t.value);
    else value = t.value;
    if (path === 'props.categories') value = String(value).split(',').map(s => s.trim()).filter(Boolean);
    if (path === 'props.values') value = String(value).split(',').map(s => Number(s.trim()) || 0);
    setPath(obj, path, value);
    if (path === 'background.value' && obj.background) obj.background.type = 'color';

    // 视觉更新防抖（连续输入合并为一次重绘）
    clearTimeout(this._renderTimer);
    this._renderTimer = setTimeout(() => {
      if (sel) {
        const el = sel.element;
        const dom = Stage.elDom(el.id);
        if (dom) {
          if (path.startsWith('props.')) Elements.refreshContent(el, dom);
          else if (path === 'entrance.type') { /* 手动预览 */ }
          else Elements.applyBox(el, dom);
        }
      } else {
        const sc = Stage.currentScene();
        Stage.render(sc);
        Editor.refresh();
        App.renderTabs();
      }
    }, 90);
    App.markDirty();
  },

  onAction(action) {
    const sel = Editor.selected();
    switch (action) {
      case 'delete': Editor.deleteSelected(); break;
      case 'duplicate': Editor.duplicateSelected(); break;
      case 'up': if (sel) { sel.element.z += 1; Stage.refreshAll(); Editor.refresh(); App.markDirty(); } break;
      case 'down': if (sel) { sel.element.z = Math.max(1, sel.element.z - 1); Stage.refreshAll(); Editor.refresh(); App.markDirty(); } break;
      case 'preview-anim': {
        if (!sel || !sel.element.entrance || sel.element.entrance.type === 'none') break;
        const dom = Stage.elDom(sel.element.id);
        if (dom) Anim.play(sel.element, dom, sel.element.entrance.type, sel.element.entrance);
        break;
      }
      case 'edit-keyframes': Keyframes.open(); break;
      case 'pick-model': App.pickMediaForSelected('model'); break;
      case 'pick-webapp': App.pickMediaForSelected('webapp'); break;
      case 'use-robot': {
        const sel = Editor.selected();
        if (sel) {
          sel.element.props.resourceId = 'builtin:robot';
          Stage.refreshAll();
          Panel.show();
          App.markDirty();
        }
        break;
      }
      case 'pick-image': App.pickMediaForSelected('image'); break;
      case 'pick-video': App.pickMediaForSelected('video'); break;
      case 'pick-audio': App.pickMediaForSelected('audio'); break;
      case 'pick-sprite': App.pickMediaForSelected('image'); break;
      case 'pick-frames': App.pickFramesForSelected(); break;
    }
  },

  updateQuick(el) {
    const x = this.el.querySelector('input[data-prop="x"]');
    const y = this.el.querySelector('input[data-prop="y"]');
    const w = this.el.querySelector('input[data-prop="w"]');
    const h = this.el.querySelector('input[data-prop="h"]');
    if (x) x.value = el.x;
    if (y) y.value = el.y;
    if (w) w.value = el.w;
    if (h) h.value = el.h;
  }
};

function typeLabel(type) {
  return { text: '文字', image: '图片', shape: '形状', icon: '图标', video: '视频', audio: '音频', chart: '图表', sprite: '帧动画', model3d: '3D 模型', webapp: '小程序' }[type] || type;
}

function fxLabel(t) {
  return { glowPulse: '光晕', neon: '霓虹', sweep: '扫光', glitch: '故障' }[t] || t;
}


// ---------- 右键菜单 ----------
const ContextMenu = {
  el: null,
  init() {
    this.el = document.createElement('div');
    this.el.id = 'ctx-menu';
    this.el.className = 'ctx-menu hidden';
    document.body.appendChild(this.el);
    window.addEventListener('mousedown', e => {
      if (!this.el.contains(e.target)) this.hide();
    });
    window.addEventListener('blur', () => this.hide());
  },
  show(x, y, items) {
    this.el.innerHTML = '';
    items.forEach(it => {
      if (!it) return;
      if (it.type === 'sep') {
        const d = document.createElement('div');
        d.className = 'ctx-sep';
        this.el.appendChild(d);
        return;
      }
      const b = document.createElement('button');
      b.className = 'ctx-item' + (it.danger ? ' danger' : '');
      b.textContent = it.label;
      b.onclick = () => { this.hide(); it.action(); };
      this.el.appendChild(b);
    });
    this.el.classList.remove('hidden');
    const r = this.el.getBoundingClientRect();
    this.el.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
    this.el.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
  },
  hide() { this.el.classList.add('hidden'); }
};
