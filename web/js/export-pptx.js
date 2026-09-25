// PPT 导出引擎（PptxGenJS）
// 可编辑模式：文字/形状/图片/图标/图表 → PPT 原生对象
// 高保真模式（P-B）：逐场景截图铺页
const PptxExport = {
  SLIDE_W: 13.333,
  SLIDE_H: 7.5,

  x(px) { return Math.round(px * this.SLIDE_W / 1920 * 1000) / 1000; },
  y(px) { return Math.round(px * this.SLIDE_H / 1080 * 1000) / 1000; },
  pt(px) { return Math.max(1, Math.round(px * 0.5 * 10) / 10); },
  hex(c) { return String(c || '#666666').replace('#', '').slice(0, 6).toUpperCase(); },

  async generate(opts = {}) {
    if (typeof PptxGenJS === 'undefined') throw new Error('PptxGenJS 未加载');
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: 'JC169', width: this.SLIDE_W, height: this.SLIDE_H });
    pptx.layout = 'JC169';
    pptx.author = '积木剧场';
    pptx.title = Project.data.name || '积木剧场演示';
    pptx.subject = '由积木剧场导出的演示文稿';

    if (opts.mode === 'fidelity') {
      await this.buildFidelity(pptx);
    } else {
      this.buildEditable(pptx);
    }
    return await pptx.write({ outputType: 'base64' });
  },

  // ---------- 可编辑模式 ----------
  buildEditable(pptx) {
    for (const scene of Project.data.scenes) {
      const slide = pptx.addSlide();
      this.applyBackground(slide, scene);
      const els = [...scene.elements].sort((a, b) => (a.z || 0) - (b.z || 0));
      for (const el of els) {
        if (el.visible === false) continue;
        try { this.addElement(slide, el); } catch (e) { console.warn('元素转换失败:', el.type, e.message || e); }
      }
      slide.addNotes('场景：' + scene.name);
    }
  },

  applyBackground(slide, scene) {
    const bg = scene.background || {};
    if (bg.type === 'color' && bg.value) {
      slide.background = { color: this.hex(bg.value) };
    } else if (bg.type === 'gradient' && bg.value && bg.value.stops && bg.value.stops.length) {
      // PPT 渐变背景较复杂，取首尾停止色近似为单色
      slide.background = { color: this.hex(bg.value.stops[0][0]) };
    } else if (bg.type === 'image' && bg.value && bg.value.resourceId) {
      const r = Project.getResource(bg.value.resourceId);
      if (r && r.data) {
        try { slide.background = { data: `data:${r.mime || 'image/png'};base64,${r.data}` }; } catch (e) { }
      }
    }
  },

  addElement(slide, el) {
    const p = el.props || {};
    const base = { x: this.x(el.x), y: this.y(el.y), w: this.x(el.w), h: this.y(el.h) };
    if (el.rotation) base.rotate = Math.round(el.rotation);
    const opacityPct = el.opacity !== undefined && el.opacity < 1 ? Math.round((1 - el.opacity) * 100) : 0;

    switch (el.type) {
      case 'text': {
        const opts = Object.assign({}, base, {
          fontSize: this.pt(p.size || 64),
          color: this.hex(p.color || '#E6E9EF'),
          bold: !!p.bold,
          italic: !!p.italic,
          align: p.align || 'center',
          valign: 'middle',
          fontFace: p.font || 'Source Han Sans SC',
          margin: 0
        });
        if (p.underline) opts.underline = { style: 'sng' };
        if (p.lineHeight) {
          opts.lineSpacingMultiple = Math.round((p.lineHeight / 1.2) * 100) / 100;
        }
        slide.addText(String(p.text || ''), opts);
        break;
      }

      case 'image': {
        const r = p.resourceId ? Project.getResource(p.resourceId) : null;
        if (!r || !r.data) break;
        const opts = Object.assign({}, base, {
          data: `data:${r.mime || 'image/png'};base64,${r.data}`,
          sizing: { type: p.fit === 'stretch' ? 'crop' : (p.fit || 'contain'), w: base.w, h: base.h }
        });
        if (opacityPct) opts.transparency = opacityPct;
        slide.addImage(opts);
        break;
      }

      case 'shape': {
        const map = { rect: 'roundRect', circle: 'ellipse', ellipse: 'ellipse', triangle: 'triangle', arrow: 'rightArrow', line: 'line' };
        const type = map[p.shape] || 'roundRect';
        const opts = Object.assign({}, base);
        if (type === 'line') {
          opts.h = 0;
          opts.line = {
            color: this.hex(p.stroke && p.stroke !== 'none' ? p.stroke : (p.fill !== 'transparent' ? p.fill : '#FFFFFF')),
            width: Math.max(1, this.pt(p.strokeWidth || 4)),
            endArrowType: 'none'
          };
          delete opts.fill;
        } else {
          opts.fill = { color: this.hex(p.fill && p.fill !== 'transparent' ? p.fill : '#6C8CFF') };
          if (opacityPct) opts.fill.transparency = opacityPct;
          if (p.strokeWidth > 0) {
            opts.line = { color: this.hex(p.stroke || '#FFFFFF'), width: Math.max(0.5, this.pt(p.strokeWidth)) };
          }
          if (type === 'roundRect' && p.radius) opts.rectRadius = Math.max(0, this.x(p.radius));
        }
        slide.addShape(type, opts);
        break;
      }

      case 'icon': {
        slide.addText(String(p.char || '⭐'), Object.assign({}, base, {
          fontSize: this.pt(p.size || 120),
          align: 'center',
          valign: 'middle',
          fontFace: 'Noto Color Emoji',
          margin: 0
        }));
        break;
      }

      case 'chart': {
        const types = { bar: 'bar', line: 'line', pie: 'pie', doughnut: 'doughnut' };
        const t = types[p.chartType] || 'bar';
        const data = [{
          name: p.seriesName || '数据',
          labels: (p.categories || []).map(String),
          values: (p.values || []).map(Number)
        }];
        const opts = Object.assign({}, base, {
          showLegend: (p.categories || []).length > 0 && (t === 'pie' || t === 'doughnut'),
          showTitle: false,
          chartColors: ['6C8CFF', 'A06CD5', '4CC38A', 'F5A623', 'F5645C', '4CC2C0']
        });
        slide.addChart(t, data, opts);
        break;
      }

      default:
        // video/audio/sprite/model3d/webapp → P-C 截图补位，暂时跳过
        break;
    }
  },

  // ---------- 高保真模式（P-B 实现）----------
  async buildFidelity(pptx) {
    if (typeof App === 'undefined' || !App.host || !App.host.captureWindow) {
      throw new Error('高保真模式需要程序环境支持（开发中）');
    }
    const scenes = Project.data.scenes;
    const current = Stage.currentSceneId;
    for (const scene of scenes) {
      // 逐场景渲染并截图
      Stage.render(scene);
      await sleep(260);
      const png = await App.host.captureWindow();  // 返回 base64 PNG（含窗口 UI 区域，后续裁剪）
      if (png) {
        const slide = pptx.addSlide();
        slide.addImage({ data: 'data:image/png;base64,' + png, x: 0, y: 0, w: this.SLIDE_W, h: this.SLIDE_H, sizing: { type: 'cover', w: this.SLIDE_W, h: this.SLIDE_H } });
        slide.addNotes('场景：' + scene.name);
      }
    }
    // 恢复
    const back = Project.getScene(current) || scenes[0];
    if (back) Stage.render(back);
  }
};
