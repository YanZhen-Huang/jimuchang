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
    let b64 = await pptx.write({ outputType: 'base64' });
    if (opts.anim) {
      try {
        const animMap = this.collectSceneAnims();
        b64 = await this.injectAnimations(b64, animMap);
      } catch (e) {
        console.warn('动画注入失败（已输出无动画版本）:', e.message || e);
      }
    }
    return b64;
  },

  // ---------- 动画提取（积木 IR → 每页动画序列）----------
  collectSceneAnims() {
    const out = {};
    let scripts = null;
    try { scripts = Executor.compileAll(); } catch (e) { scripts = { scenes: {} }; }
    for (const scene of Project.data.scenes) {
      const list = [];
      for (const el of scene.elements) {
        if (el.entrance && el.entrance.type && el.entrance.type !== 'none') {
          list.push({ elId: el.id, anim: el.entrance.type, duration: el.entrance.duration, delay: el.entrance.delay });
        }
      }
      ((scripts.scenes || {})[scene.id] || [])
        .filter(s => s.kind === 'onSceneEnter')
        .forEach(s => this.walkAnim(s.body, list));
      out[scene.id] = list;
    }
    return out;
  },

  walkAnim(body, out) {
    (body || []).forEach(instr => {
      if (!instr) return;
      if (instr.op === 'el.anim' && instr.anim && !String(instr.anim).endsWith('Out')) {
        out.push({ elId: instr.elId, anim: instr.anim, duration: instr.duration, delay: instr.delay });
      } else if (instr.op === 'ctrl.repeat') {
        this.walkAnim(instr.body, out);
      } else if (instr.op === 'ctrl.repeatuntil') {
        this.walkAnim(instr.body, out);
      } else if (instr.op === 'ctrl.if') {
        (instr.branches || []).forEach(br => this.walkAnim(br.body, out));
        if (instr.elseBody) this.walkAnim(instr.elseBody, out);
      }
    });
  },

  // ---------- 动画注入（改 slide XML 的 <p:timing>）----------
  async injectAnimations(pptxBase64, animMap) {
    const zip = await JSZip.loadAsync(pptxBase64, { base64: true });
    let injected = 0;
    for (let i = 0; i < Project.data.scenes.length; i++) {
      const scene = Project.data.scenes[i];
      const list = animMap[scene.id];
      if (!list || !list.length) continue;
      const path = 'ppt/slides/slide' + (i + 1) + '.xml';
      const f = zip.file(path);
      if (!f) continue;
      let xml = await f.async('string');
      const spMap = this.parseSpIds(xml);
      const timing = this.buildTiming(list, spMap);
      if (timing) {
        xml = xml.replace('</p:sld>', timing + '</p:sld>');
        zip.file(path, xml);
        injected++;
      }
    }
    console.log('动画注入：' + injected + ' 页');
    return await zip.generateAsync({ type: 'base64' });
  },

  parseSpIds(xml) {
    const map = {};
    const re = /<p:cNvPr\b[^>]*>/g;
    let m;
    while ((m = re.exec(xml))) {
      const name = /name="JC_([^"]+)"/.exec(m[0]);
      const id = /id="(\d+)"/.exec(m[0]);
      if (name && id) map[name[1]] = id[1];
    }
    return map;
  },

  buildEffect(anim, spid, dur, get) {
    const setVisible = '<p:set><p:cBhvr><p:cTn id="' + get() + '" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="' + spid + '"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>';
    const fade = '<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="' + get() + '" dur="' + dur + '"/><p:tgtEl><p:spTgt spid="' + spid + '"/></p:tgtEl></p:cBhvr></p:animEffect>';
    if (anim.indexOf('flyIn') === 0) {
      const dirs = { Left: '-1.1 0', Right: '1.1 0', Top: '0 -0.8', Bottom: '0 0.8' };
      const d = dirs[anim.slice(5)] || '-1.1 0';
      const motion = '<p:animMotion origin="layout" path="M ' + d + ' L 0 0" pathEditMode="relative" rAng="0" ptsTypes=""><p:cBhvr><p:cTn id="' + get() + '" dur="' + dur + '" fill="hold"/><p:tgtEl><p:spTgt spid="' + spid + '"/></p:tgtEl><p:attrNameLst><p:attrName>ppt_x</p:attrName><p:attrName>ppt_y</p:attrName></p:attrNameLst></p:cBhvr></p:animMotion>';
      return { presetID: 2, subtype: 4, inner: setVisible + fade + motion };
    }
    if (anim === 'zoomIn' || anim === 'bounceIn') {
      const scale = '<p:animScale><p:cBhvr><p:cTn id="' + get() + '" dur="' + dur + '" fill="hold"/><p:tgtEl><p:spTgt spid="' + spid + '"/></p:tgtEl></p:cBhvr><p:from x="20000" y="20000"/><p:to x="100000" y="100000"/></p:animScale>';
      return { presetID: 23, subtype: 16, inner: setVisible + fade + scale };
    }
    return { presetID: 10, subtype: 0, inner: setVisible + fade };
  },

  buildTiming(anims, spMap) {
    let id = 3;
    const get = () => id++;
    const pars = [];
    anims.forEach(a => {
      const spid = spMap[a.elId];
      if (!spid) return;
      const dur = Math.max(200, Math.round((Number(a.duration) || 0.6) * 1000));
      const delay = Math.max(0, Math.round((Number(a.delay) || 0) * 1000));
      const nodeType = pars.length === 0 ? 'clickEffect' : 'afterEffect';
      const eff = this.buildEffect(a.anim, spid, dur, get);
      pars.push('<p:par><p:cTn id="' + get() + '" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
        '<p:par><p:cTn id="' + get() + '" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
        '<p:par><p:cTn id="' + get() + '" presetID="' + eff.presetID + '" presetClass="entr" presetSubtype="' + eff.subtype + '" fill="hold" grpId="0" nodeType="' + nodeType + '">' +
        '<p:stCondLst><p:cond delay="' + delay + '"/></p:stCondLst><p:childTnLst>' + eff.inner + '</p:childTnLst></p:cTn></p:par>' +
        '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>');
    });
    if (!pars.length) return '';
    return '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>' +
      '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>' + pars.join('') + '</p:childTnLst></p:cTn>' +
      '<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>' +
      '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>' +
      '</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>';
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
    const base = { x: this.x(el.x), y: this.y(el.y), w: this.x(el.w), h: this.y(el.h), objectName: 'JC_' + el.id };
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

  // ---------- 高保真模式：逐场景截图铺满 ----------
  async buildFidelity(pptx) {
    if (typeof App === 'undefined' || !App.host || !App.host.captureWindow) {
      throw new Error('高保真模式需要桌面程序环境');
    }
    const scenes = Project.data.scenes;
    const current = Stage.currentSceneId;
    const sel = Editor.selectedId;
    Editor.select(null);
    for (const scene of scenes) {
      Stage.render(scene);
      if (App.host.raiseWindow) App.host.raiseWindow();
      await sleep(360);
      let fullB64 = await App.host.captureWindow();
      if (!fullB64) {           // 黑帧：等重绘后重试一次
        await sleep(340);
        fullB64 = await App.host.captureWindow();
      }
      if (!fullB64) continue;
      const dataUrl = await this.cropStage(fullB64);
      if (!dataUrl) continue;
      const slide = pptx.addSlide();
      slide.addImage({ data: dataUrl, x: 0, y: 0, w: this.SLIDE_W, h: this.SLIDE_H });
      slide.addNotes('场景：' + scene.name);
    }
    const back = Project.getScene(current) || scenes[0];
    if (back) Stage.render(back);
    if (sel) Editor.select(sel);
  },

  // 从整窗截图里裁出舞台区域，输出 1280×720 PNG dataURL
  cropStage(fullB64) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const r = Stage.rootEl.getBoundingClientRect();
          const sx = img.width / window.innerWidth;
          const sy = img.height / window.innerHeight;
          console.log('CROP|grab=' + img.width + 'x' + img.height + '|inner=' + window.innerWidth + 'x' + window.innerHeight + '|dpr=' + window.devicePixelRatio + '|stage=' + [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(','));
          const c = document.createElement('canvas');
          c.width = 1280;
          c.height = 720;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, r.left * sx, r.top * sy, r.width * sx, r.height * sy, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/png'));
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = 'data:image/png;base64,' + fullB64;
    });
  }
};
