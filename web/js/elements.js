// 说话气泡（Scratch 式）
const Bubbles = {
  show(elId, text, seconds) {
    const f = Project.findElementById(elId);
    if (f) f.element._bubble = { text: String(text), until: seconds > 0 ? Date.now() + seconds * 1000 : 0 };
    this.attach(elId, text, seconds);
  },
  // 纯 DOM 操作（渲染恢复时复用；场景被重建后自动恢复气泡）
  attach(elId, text, seconds, domRef) {
    const dom = domRef || Stage.elDom(elId);
    if (!dom) return;
    let b = dom.querySelector(':scope > .el-bubble');
    if (!b) {
      b = document.createElement('div');
      b.className = 'el-bubble';
      dom.appendChild(b);
    }
    b.textContent = text;
    b.classList.remove('on');
    void b.offsetWidth;  // 重播过渡动画
    b.classList.add('on');
    clearTimeout(b._timer);
    if (seconds > 0) {
      b._timer = setTimeout(() => {
        b.classList.remove('on');
        const f = Project.findElementById(elId);
        if (f && f.element._bubble) delete f.element._bubble;
      }, seconds * 1000);
    }
  },
  hide(elId) {
    const f = Project.findElementById(elId);
    if (f) delete f.element._bubble;
    const dom = Stage.elDom(elId);
    const b = dom && dom.querySelector(':scope > .el-bubble');
    if (b) { clearTimeout(b._timer); b.classList.remove('on'); }
  }
};

// 元素渲染：outer(定位) > rot(旋转) > anim(动画) > content(内容)
const Elements = {
  render(el) {
    const d = document.createElement('div');
    d.className = 'el';
    d.dataset.id = el.id;
    d.dataset.type = el.type;
    const rot = document.createElement('div');
    rot.className = 'el-rot';
    const anim = document.createElement('div');
    anim.className = 'el-anim';
    anim.appendChild(this.buildContent(el));
    rot.appendChild(anim);
    d.appendChild(rot);
    this.applyBox(el, d);
    this.attach(el, d);
    return d;
  },

  attach(el, dom) {
    if (window.Effects) Effects.attach(el, dom);
    // 恢复说话气泡（场景重建后）
    if (el._bubble && (!el._bubble.until || Date.now() < el._bubble.until)) {
      const remain = el._bubble.until ? (el._bubble.until - Date.now()) / 1000 : 0;
      Bubbles.attach(el.id, el._bubble.text, remain, dom);
    }
  },

  applyBox(el, dom) {
    dom.style.left = el.x + 'px';
    dom.style.top = el.y + 'px';
    dom.style.width = el.w + 'px';
    dom.style.height = el.h + 'px';
    dom.style.zIndex = el.z;
    dom.style.opacity = el.opacity;
    dom.style.display = el.visible ? '' : 'none';
    const rot = dom.querySelector('.el-rot');
    if (rot) rot.style.transform = `rotate(${el.rotation || 0}deg)`;
    const chart = dom.querySelector('.c-chart');
    if (chart && chart._chart) { try { chart._chart.resize(); } catch (e) { } }
  },

  refreshContent(el, dom) {
    const anim = dom.querySelector('.el-anim');
    // 清理图表/精灵
    anim.querySelectorAll('.c-chart').forEach(c => { if (c._chart) { try { c._chart.dispose(); } catch (e) { } c._chart = null; } });
    anim.querySelectorAll("canvas.c-sprite").forEach(c => { Sprites.unmount(c); });
    anim.innerHTML = '';
    anim.appendChild(this.buildContent(el));
    this.applyBox(el, dom);
    this.attach(el, dom);
  },

  buildContent(el) {
    switch (el.type) {
      case 'text': return this.buildText(el);
      case 'image': return this.buildImage(el);
      case 'shape': return this.buildShape(el);
      case 'icon': return this.buildIcon(el);
      case 'video': return this.buildVideo(el);
      case 'audio': return this.buildAudio(el);
      case 'chart': return this.buildChart(el);
      case 'sprite': return this.buildSprite(el);
      case 'model3d': return this.buildModel3d(el);
      case 'webapp': return this.buildWebapp(el);
      case 'slider': return this.buildSlider(el);
      default: return document.createTextNode('');
    }
  },

  // ---------- 滑块控件（交互三件套） ----------
  buildSlider(el) {
    const p = el.props || {};
    const wrap = document.createElement('div');
    wrap.className = 'c-slider';
    const label = document.createElement('div');
    label.className = 'c-slider-label';
    label.textContent = p.label || '';
    if (!p.label) label.style.display = 'none';
    const row = document.createElement('div');
    row.className = 'c-slider-row';
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'c-slider-input';
    input.min = p.min !== undefined ? p.min : 0;
    input.max = p.max !== undefined ? p.max : 100;
    input.step = p.step || 1;
    input.value = p.value !== undefined ? p.value : input.min;
    const val = document.createElement('span');
    val.className = 'c-slider-value';
    val.textContent = this.sliderText(input.value);
    if (p.showValue === false) val.style.display = 'none';
    input.addEventListener('input', () => {
      val.textContent = this.sliderText(input.value);
      this.updateSliderTrack(el.id);
      if (typeof Executor !== 'undefined') Executor.sliderInput(el.id, Number(input.value));
    });
    row.appendChild(input);
    row.appendChild(val);
    wrap.appendChild(label);
    wrap.appendChild(row);
    setTimeout(() => this.updateSliderTrack(el.id), 0);
    return wrap;
  },

  // 已填充轨道 = 滑块色进度（自绘 thumb 后 accent-color 不再生效）
  updateSliderTrack(elId) {
    const dom = Stage.elDom(elId);
    const inp = dom && dom.querySelector('.c-slider input');
    if (!inp) return;
    const f = Project.findElementById(elId);
    const color = (f && f.element.props && f.element.props.color) || '#6C8CFF';
    const min = Number(inp.min) || 0, max = Number(inp.max);
    const pct = max > min ? Math.max(0, Math.min(100, ((Number(inp.value) - min) / (max - min)) * 100)) : 0;
    inp.style.background = `linear-gradient(to right, ${color} ${pct}%, rgba(128,128,128,.28) ${pct}%)`;
  },

  sliderText(v) {
    const n = Number(v);
    if (!isFinite(n)) return String(v);
    return String(Math.round(n * 1000) / 1000);
  },

  // 运行时设置滑块值（改 DOM 显示，不写 props）
  setSliderRuntime(elId, value, writeProps) {
    const f = Project.findElementById(elId);
    if (f && writeProps) f.element.props.value = value;
    const dom = Stage.elDom(elId);
    const inp = dom && dom.querySelector('.c-slider input');
    if (!inp) return;
    inp.value = String(value);
    const val = dom.querySelector('.c-slider-value');
    if (val) val.textContent = this.sliderText(value);
    this.updateSliderTrack(elId);
  },

  // 读取滑块当前值（DOM 优先，回退 props）
  sliderValue(elId) {
    const dom = Stage.elDom(elId);
    const inp = dom && dom.querySelector('.c-slider input');
    if (inp) return Number(inp.value) || 0;
    const f = Project.findElementById(elId);
    return f && f.element.props ? (Number(f.element.props.value) || 0) : 0;
  },

  buildVideo(el) {
    const p = el.props;
    const v = document.createElement('video');
    v.className = 'c-video';
    v.playsInline = true;
    v.loop = !!p.loop;
    v.muted = !!p.muted;
    if (p.controls) v.controls = true;
    v.style.cssText = 'width:100%;height:100%;object-fit:contain;border-radius:4px;background:#000';
    if (p.resourceId) v.src = Project.resourceUrl(p.resourceId);
    return v;
  },

  buildAudio(el) {
    const d = document.createElement('div');
    d.className = 'c-audio';
    d.textContent = '♪';
    return d;
  },

  buildChart(el) {
    const d = document.createElement('div');
    d.className = 'c-chart';
    d.style.cssText = 'width:100%;height:100%';
    setTimeout(() => this.initChart(el, d), 30);
    return d;
  },

  initChart(el, dom) {
    if (!window.echarts || !dom.isConnected) return;
    try {
      if (dom._chart) { dom._chart.dispose(); dom._chart = null; }
      const chart = echarts.init(dom, null, { renderer: 'canvas' });
      chart.setOption(this.chartOption(el.props));
      // 图表点击事件（交互三件套）：转发给执行器（仅播放态生效）
      chart.on('click', params => this.onChartClick(el.id, params));
      dom._chart = chart;
      if (dom._ro) dom._ro.disconnect();
      dom._ro = new ResizeObserver(() => { try { chart.resize(); } catch (e) { } });
      dom._ro.observe(dom);
    } catch (e) { console.warn('图表初始化失败', e); }
  },

  onChartClick(elId, params) {
    if (typeof Executor === 'undefined' || !Executor.playing) return;
    Executor.lastChart = {
      elId,
      name: params.name !== undefined && params.name !== null ? params.name : '',
      value: params.value,
      dataIndex: params.dataIndex !== undefined ? params.dataIndex : 0,
      seriesName: params.seriesName || ''
    };
    Executor.trigger('onChartClick', elId);
  },

  // 图表数据变更后原地刷新（不做 DOM 重建，保留动画过渡）
  updateChart(elId) {
    const f = Project.findElementById(elId);
    if (!f) return false;
    const dom = Stage.elDom(elId);
    const chartDom = dom && dom.querySelector('.c-chart');
    if (chartDom && chartDom._chart) {
      try {
        chartDom._chart.setOption(this.chartOption(f.element.props), true);
        return true;
      } catch (e) { }
    }
    // 实例未就绪时退回重建
    if (dom) { this.refreshContent(f.element, dom); return true; }
    return false;
  },

  chartOption(p) {
    const cats = p.categories || ['A', 'B', 'C'];
    const vals = p.values || [1, 2, 3];
    const name = p.seriesName || '数据';
    const axis = {
      axisLabel: { color: '#8A93A6' },
      axisLine: { lineStyle: { color: '#2A3140' } },
      splitLine: { lineStyle: { color: '#1C212B' } }
    };
    const base = {
      backgroundColor: 'transparent',
      textStyle: { color: '#C9D1E0', fontFamily: 'Source Han Sans SC, sans-serif' },
      animationDuration: 900,
      animationEasing: 'cubicOut'
    };
    const type = p.chartType || 'bar';
    if (type === 'pie' || type === 'doughnut') {
      return Object.assign({}, base, {
        tooltip: { trigger: 'item' },
        legend: { bottom: 0, textStyle: { color: '#8A93A6' } },
        series: [{
          type: 'pie', name,
          radius: type === 'doughnut' ? ['42%', '68%'] : '68%',
          center: ['50%', '46%'],
          itemStyle: { borderRadius: 6, borderColor: '#0F1115', borderWidth: 2 },
          label: { color: '#C9D1E0' },
          data: cats.map((c, i) => ({ name: c, value: vals[i] !== undefined ? vals[i] : 0 }))
        }]
      });
    }
    if (type === 'line') {
      return Object.assign({}, base, {
        grid: { left: 54, right: 28, top: 34, bottom: 40 },
        tooltip: { trigger: 'axis' },
        xAxis: Object.assign({ type: 'category', data: cats }, axis),
        yAxis: Object.assign({ type: 'value' }, axis),
        series: [{
          type: 'line', name, data: vals, smooth: true,
          symbolSize: 8, lineStyle: { width: 3, color: '#6C8CFF' },
          itemStyle: { color: '#6C8CFF' },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [{ offset: 0, color: 'rgba(108,140,255,.35)' }, { offset: 1, color: 'rgba(108,140,255,0)' }]
            }
          }
        }]
      });
    }
    // bar（默认）
    return Object.assign({}, base, {
      grid: { left: 54, right: 28, top: 34, bottom: 40 },
      tooltip: { trigger: 'axis' },
      xAxis: Object.assign({ type: 'category', data: cats }, axis),
      yAxis: Object.assign({ type: 'value' }, axis),
      series: [{
        type: 'bar', name, data: vals, barMaxWidth: 46,
        itemStyle: {
          borderRadius: [7, 7, 0, 0],
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#8AA2FF' }, { offset: 1, color: '#5B6FF0' }]
          }
        }
      }]
    });
  },

  buildModel3d(el) {
    const wrap = document.createElement('div');
    wrap.className = 'c-model3d-wrap';
    wrap.style.cssText = 'width:100%;height:100%;position:relative';
    const c = document.createElement('canvas');
    c.className = 'c-model3d';
    c.style.cssText = 'width:100%;height:100%;display:block';
    c.width = Math.max(1, el.w);
    c.height = Math.max(1, el.h);
    const tip = document.createElement('div');
    tip.className = 'model-loading';
    tip.textContent = '3D 加载中…';
    wrap.appendChild(c);
    wrap.appendChild(tip);
    setTimeout(() => Model3D.mount(el, c), 30);
    return wrap;
  },

  buildWebapp(el) {
    const iframe = document.createElement('iframe');
    iframe.className = 'c-webapp';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.cssText = 'width:100%;height:100%;border:0;border-radius:4px;background:transparent';
    if (el.props && el.props.inline) {
      iframe.srcdoc = el.props.inline;
    } else if (el.props && el.props.resourceId) {
      iframe.src = Project.resourceUrl(el.props.resourceId);
    }
    return iframe;
  },

  buildSprite(el) {
    const c = document.createElement('canvas');
    c.className = 'c-sprite';
    c.style.cssText = 'width:100%;height:100%;background:transparent';
    c.width = Math.max(1, el.w);
    c.height = Math.max(1, el.h);
    setTimeout(() => Sprites.mount(el, c), 30);
    return c;
  },

  buildText(el) {
    const p = el.props;
    const d = document.createElement('div');
    d.className = 'c-text';
    d.textContent = p.text || '';
    const justify = p.align === 'left' ? 'flex-start' : p.align === 'right' ? 'flex-end' : 'center';
    d.style.cssText = [
      `font-family:${p.font || 'inherit'}`,
      `font-size:${p.size || 64}px`,
      `color:${p.color || '#E6E9EF'}`,
      `font-weight:${p.bold ? 700 : 400}`,
      `font-style:${p.italic ? 'italic' : 'normal'}`,
      `text-decoration:${p.underline ? 'underline' : 'none'}`,
      `text-align:${p.align || 'center'}`,
      `line-height:${p.lineHeight || 1.4}`,
      `letter-spacing:${p.letterSpacing || 0}px`,
      `justify-content:${justify}`,
      'display:flex', 'align-items:center', 'width:100%', 'height:100%',
      'white-space:pre-wrap', 'word-break:break-word'
    ].join(';');
    return d;
  },

  buildImage(el) {
    const img = document.createElement('img');
    img.className = 'c-image';
    img.draggable = false;
    img.style.cssText = `width:100%;height:100%;object-fit:${el.props.fit || 'contain'};border-radius:4px`;
    img.onerror = () => {
      img.style.background = 'rgba(245,100,92,.1)';
      img.style.border = '1px dashed rgba(245,100,92,.5)';
      img.alt = '图片加载失败';
    };
    img.src = el.props.resourceId ? Project.resourceUrl(el.props.resourceId) : '';
    return img;
  },

  buildShape(el) {
    const p = el.props;
    const w = el.w, h = el.h;
    const sw = p.strokeWidth || 0, half = sw / 2;
    const fill = p.fill || 'transparent';
    const stroke = p.stroke || 'none';
    const attrs = `fill="${p.shape === 'line' ? 'none' : fill}" stroke="${stroke}" stroke-width="${sw}"`;
    let inner = '';
    switch (p.shape) {
      case 'rect':
        inner = `<rect x="${half}" y="${half}" width="${Math.max(0, w - sw)}" height="${Math.max(0, h - sw)}" rx="${p.radius || 0}" ${attrs}/>`;
        break;
      case 'circle': {
        const r = Math.max(0, (Math.min(w, h) - sw) / 2);
        inner = `<circle cx="${w / 2}" cy="${h / 2}" r="${r}" ${attrs}/>`;
        break;
      }
      case 'ellipse':
        inner = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${Math.max(0, (w - sw) / 2)}" ry="${Math.max(0, (h - sw) / 2)}" ${attrs}/>`;
        break;
      case 'triangle':
        inner = `<polygon points="${w / 2},${half} ${w - half},${h - half} ${half},${h - half}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'arrow':
        inner = `<polygon points="0,${h * 0.32} ${w * 0.62},${h * 0.32} ${w * 0.62},${half} ${w - half},${h / 2} ${w * 0.62},${h - half} ${w * 0.62},${h * 0.68} 0,${h * 0.68}" ${attrs} stroke-linejoin="round"/>`;
        break;
      case 'line':
        inner = `<line x1="${half}" y1="${h / 2}" x2="${w - half}" y2="${h / 2}" stroke="${stroke === 'none' ? fill : stroke}" stroke-width="${Math.max(sw, 4)}" stroke-linecap="round"/>`;
        break;
      default:
        inner = `<rect x="${half}" y="${half}" width="${Math.max(0, w - sw)}" height="${Math.max(0, h - sw)}" rx="${p.radius || 0}" ${attrs}/>`;
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'c-shape');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = inner;
    return svg;
  },

  buildIcon(el) {
    const p = el.props;
    const d = document.createElement('div');
    d.className = 'c-icon';
    d.textContent = p.char || '★';
    d.style.cssText = [
      `font-size:${p.size || 120}px`,
      `color:${p.color || '#F5A623'}`,
      'display:flex', 'align-items:center', 'justify-content:center',
      'width:100%', 'height:100%', 'line-height:1'
    ].join(';');
    return d;
  }
};
