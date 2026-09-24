// 关键帧动画：采样引擎 + 底部轨道编辑器
const Keyframes = {
  TRACKS: [
    ['x', 'X 位移'],
    ['y', 'Y 位移'],
    ['scale', '缩放'],
    ['rotation', '旋转'],
    ['opacity', '透明度']
  ],
  DEFAULT_DURATION: 3,
  selected: null,   // { key, index }
  _drag: null,

  // ---------- 数据 ----------
  ensure(el) {
    if (!el.keyframes) {
      el.keyframes = {
        duration: this.DEFAULT_DURATION,
        loop: false,
        tracks: { x: [], y: [], scale: [], rotation: [], opacity: [] }
      };
    }
    const kf = el.keyframes;
    kf.tracks = kf.tracks || {};
    this.TRACKS.forEach(([k]) => { if (!kf.tracks[k]) kf.tracks[k] = []; });
    return kf;
  },

  hasAny(el) {
    const kf = el.keyframes;
    if (!kf || !kf.tracks) return false;
    return Object.values(kf.tracks).some(t => t && t.length > 0);
  },

  // ---------- 采样 ----------
  sampleTrack(track, t) {
    if (!track || !track.length) return null;
    if (t <= track[0].t) return track[0].v;
    const last = track[track.length - 1];
    if (t >= last.t) return last.v;
    for (let i = 1; i < track.length; i++) {
      const a = track[i - 1], b = track[i];
      if (t <= b.t) {
        const dur = b.t - a.t;
        const p = dur <= 0 ? 1 : (t - a.t) / dur;
        const e = Easing.fn(a.e || 'easeInOutCubic')(p);
        return a.v + (b.v - a.v) * e;
      }
    }
    return last.v;
  },

  applyAt(el, dom, time) {
    const kf = el.keyframes;
    if (!kf || !dom) return;
    const animEl = dom.querySelector('.el-anim');
    const rotEl = dom.querySelector('.el-rot');
    if (!animEl) return;
    const v = {};
    this.TRACKS.forEach(([k]) => {
      const s = this.sampleTrack(kf.tracks[k], time);
      if (s !== null) v[k] = s;
    });
    if (v.x !== undefined) dom.style.left = v.x + 'px';
    if (v.y !== undefined) dom.style.top = v.y + 'px';
    const scale = v.scale !== undefined ? v.scale : 1;
    const rotation = v.rotation !== undefined ? v.rotation : 0;
    animEl.style.transform = `scale(${scale})`;
    if (rotEl) rotEl.style.transform = `rotate(${(el.rotation || 0) + rotation}deg)`;
    if (v.opacity !== undefined) animEl.style.opacity = v.opacity;
  },

  // ---------- 播放 ----------
  play(el, dom, { loop = false } = {}) {
    if (!dom || !this.hasAny(el)) return Promise.resolve();
    const kf = el.keyframes;
    const duration = Math.max(0.1, kf.duration || this.DEFAULT_DURATION);
    this.stop(dom);
    return new Promise(resolve => {
      const t0 = performance.now();
      const step = () => {
        const t = (performance.now() - t0) / 1000;
        if (loop) {
          this.applyAt(el, dom, t % duration);
          dom._kfRaf = requestAnimationFrame(step);
        } else if (t >= duration) {
          this.applyAt(el, dom, duration);
          dom._kfRaf = null;
          resolve();
        } else {
          this.applyAt(el, dom, t);
          dom._kfRaf = requestAnimationFrame(step);
        }
      };
      step();
    });
  },

  stop(dom) {
    if (dom && dom._kfRaf) {
      cancelAnimationFrame(dom._kfRaf);
      dom._kfRaf = null;
    }
  },

  // ---------- 编辑器面板 ----------
  panelEl: null,

  initPanel() {
    this.panelEl = document.getElementById('kf-overlay');
    const p = this.panelEl;
    p.addEventListener('click', e => this.onClick(e));
    p.addEventListener('mousedown', e => this.onDown(e));
    p.addEventListener('dblclick', e => this.onDblClick(e));
    p.addEventListener('contextmenu', e => {
      const dot = e.target.closest('.kf-dot');
      if (dot) { e.preventDefault(); this.removeDot(dot.dataset.key, Number(dot.dataset.i)); }
    });
    window.addEventListener('mousemove', e => this.onMove(e));
    window.addEventListener('mouseup', () => { this._drag = null; });
    const on = (id, fn) => { const n = document.getElementById(id); if (n) n.addEventListener('click', fn); };
    on('kf-close', () => this.close());
    on('kf-play', () => this.preview());
    on('kf-clear', () => this.clearAll());
    p.querySelector('#kf-dur').addEventListener('change', e => {
      const el = this.currentEl();
      if (!el) return;
      this.ensure(el).duration = Math.max(0.2, Number(e.target.value) || 3);
      this.render();
      App.markDirty();
    });
    p.querySelector('#kf-loop').addEventListener('change', e => {
      const el = this.currentEl();
      if (!el) return;
      this.ensure(el).loop = e.target.checked;
      App.markDirty();
    });
    p.querySelector('#kfe-t').addEventListener('change', e => this.editSelected('t', Number(e.target.value)));
    p.querySelector('#kfe-v').addEventListener('change', e => this.editSelected('v', Number(e.target.value)));
    p.querySelector('#kfe-e').addEventListener('change', e => this.editSelected('e', e.target.value));
  },

  currentEl() {
    const sel = Editor.selected();
    return sel ? sel.element : null;
  },

  open() {
    const el = this.currentEl();
    if (!el) { toast('先选中一个元素'); return; }
    this.ensure(el);
    this.selected = null;
    this.panelEl.classList.remove('hidden');
    this.render();
  },

  close() {
    const el = this.currentEl();
    const dom = el && Stage.elDom(el.id);
    if (dom) this.reset(el, dom);
    this.panelEl.classList.add('hidden');
  },

  render() {
    const el = this.currentEl();
    if (!el) return;
    const kf = this.ensure(el);
    const dur = kf.duration || this.DEFAULT_DURATION;
    this.panelEl.querySelector('#kf-dur').value = dur;
    this.panelEl.querySelector('#kf-loop').checked = !!kf.loop;
    const body = this.panelEl.querySelector('#kf-tracks');
    let html = '';
    this.TRACKS.forEach(([key, label]) => {
      const track = kf.tracks[key] || [];
      const dots = track.map((k, i) => {
        const selOk = this.selected && this.selected.key === key && this.selected.index === i;
        return `<div class="kf-dot${selOk ? ' sel' : ''}" data-key="${key}" data-i="${i}" style="left:${(k.t / dur * 100).toFixed(2)}%" title="t=${k.t}s v=${k.v}"></div>`;
      }).join('');
      html += `<div class="kf-track">
        <div class="kf-label">${label}</div>
        <div class="kf-lane" data-key="${key}">
          <div class="kf-line"></div>${dots}
        </div>
      </div>`;
    });
    body.innerHTML = html;
    const edit = this.panelEl.querySelector('#kf-edit');
    if (this.selected) {
      const { key, index } = this.selected;
      const k = kf.tracks[key][index];
      if (!k) { this.selected = null; edit.classList.add('hidden'); return; }
      edit.classList.remove('hidden');
      edit.querySelector('#kfe-t').value = k.t;
      edit.querySelector('#kfe-v').value = k.v;
      const es = edit.querySelector('#kfe-e');
      es.innerHTML = JimuConst.EASINGS.map(([n, v]) => `<option value="${v}"${v === (k.e || 'easeInOutCubic') ? ' selected' : ''}>${n}</option>`).join('');
      edit.querySelector('.kf-selname').textContent = this.TRACKS.find(t => t[0] === key)[1] + ' 第 ' + (index + 1) + ' 个';
    } else {
      edit.classList.add('hidden');
    }
  },

  timeAt(lane, clientX) {
    const r = lane.getBoundingClientRect();
    const el = this.currentEl();
    const dur = el.keyframes.duration || this.DEFAULT_DURATION;
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * dur;
    return Math.round(t * 100) / 100;
  },

  addDot(key, t) {
    const el = this.currentEl();
    if (!el) return;
    const kf = this.ensure(el);
    const track = kf.tracks[key];
    // 值取当前时刻采样，未命中则取元素基准值
    let v = this.sampleTrack(track, t);
    if (v === null) {
      const dom = Stage.elDom(el.id);
      const base = { x: el.x, y: el.y, scale: 1, rotation: 0, opacity: el.opacity };
      v = base[key] !== undefined ? base[key] : 0;
    }
    track.push({ t, v, e: 'easeInOutCubic' });
    track.sort((a, b) => a.t - b.t);
    this.selected = { key, index: kf.tracks[key].findIndex(k => k.t === t && k.v === v) };
    this.render();
    App.markDirty();
  },

  removeDot(key, i) {
    const el = this.currentEl();
    if (!el || !el.keyframes) return;
    el.keyframes.tracks[key].splice(i, 1);
    this.selected = null;
    this.render();
    App.markDirty();
  },

  editSelected(prop, value) {
    const el = this.currentEl();
    if (!el || !this.selected) return;
    const { key, index } = this.selected;
    const k = el.keyframes.tracks[key][index];
    if (!k) return;
    if (prop === 't') {
      k.t = Math.max(0, Math.min(el.keyframes.duration, value));
      el.keyframes.tracks[key].sort((a, b) => a.t - b.t);
      this.selected = { key, index: el.keyframes.tracks[key].indexOf(k) };
    } else {
      k[prop] = value;
    }
    this.render();
    App.markDirty();
  },

  onClick(e) {
    const dot = e.target.closest('.kf-dot');
    if (dot) {
      this.selected = { key: dot.dataset.key, index: Number(dot.dataset.i) };
      this.render();
      return;
    }
    const lane = e.target.closest('.kf-lane');
    if (lane) {
      this.addDot(lane.dataset.key, this.timeAt(lane, e.clientX));
    }
  },

  onDown(e) {
    const dot = e.target.closest('.kf-dot');
    if (!dot) return;
    this._drag = { key: dot.dataset.key, index: Number(dot.dataset.i), moved: false };
  },

  onMove(e) {
    if (!this._drag) return;
    const lane = this.panelEl.querySelector(`.kf-lane[data-key="${this._drag.key}"]`);
    if (!lane) return;
    const t = this.timeAt(lane, e.clientX);
    const el = this.currentEl();
    if (!el) return;
    const track = el.keyframes.tracks[this._drag.key];
    const k = track[this._drag.index];
    if (!k) return;
    k.t = t;
    track.sort((a, b) => a.t - b.t);
    this._drag.index = track.indexOf(k);
    this.selected = { key: this._drag.key, index: this._drag.index };
    this.render();
  },

  onDblClick(e) {
    const dot = e.target.closest('.kf-dot');
    if (dot) this.removeDot(dot.dataset.key, Number(dot.dataset.i));
  },

  async preview() {
    const sel = Editor.selected();
    if (!sel) return;
    const dom = Stage.elDom(sel.element.id);
    if (!dom) return;
    this.reset(sel.element, dom);
    await sleep(30);
    await this.play(sel.element, dom, { loop: false });
  },

  clearAll() {
    const el = this.currentEl();
    if (!el || !el.keyframes) return;
    if (!confirm('清空该元素的所有关键帧？')) return;
    el.keyframes.tracks = {};
    this.ensure(el);
    this.selected = null;
    this.render();
    App.markDirty();
  }
};
