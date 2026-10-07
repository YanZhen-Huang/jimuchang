// 模板库：主页上"点开就能改"的起步项目
// 约定：App.loadTemplate 先 Project.newProject(name)，再调用对应 build()
const Templates = (() => {
  const link = (list) => {
    for (let i = list.length - 1; i > 0; i--) list[i - 1].next = { block: list[i] };
    return list[0];
  };
  const waitSec = (sec) => blk('jimu_wait', null, null, { SEC: { shadow: { type: 'math_number', fields: { NUM: sec } } } });
  const anim = (id, kind, dur, delay, ease) => blk('jimu_anim', { ELEMENT: id, ANIM: kind, DUR: dur, DELAY: delay || 0, EASE: ease || 'easeOutCubic' });
  const setVis = (ch, ids) => {
    ch.preset.visibility = {};
    Project.data.elements.forEach(el => { ch.preset.visibility[el.id] = ids.indexOf(el.id) >= 0; });
  };
  const finish = (bg) => {
    Project.data.stage.background = JSON.parse(JSON.stringify(bg));
    Project.data.globalBlocks = { blocks: { languageVersion: 0, blocks: [] } };
  };
  const grad = (angle, c1, c2) => ({ type: 'gradient', value: { kind: 'linear', angle, stops: [[c1, '0'], [c2, '1']] } });
  const T = (text, x, y, w, h, size, color, extra) => Project.createElement('text', {
    name: text.slice(0, 6), x, y, w, h,
    props: Object.assign({ text, size, color, align: 'center' }, extra || {})
  });

  // ---- 交互模板辅助（表达式树 / 滑块 / 图表）----
  const num = v => ({ type: 'math_number', fields: { NUM: v } });
  const txt = s => ({ type: 'text', fields: { TEXT: s } });
  const bx = n => ({ block: n });
  const aop = (o, a, b) => ({ type: 'math_arithmetic', fields: { OP: o }, inputs: { A: bx(a), B: bx(b) } });
  const slv = id => ({ type: 'jimu_slider_value', fields: { ELEMENT: id } });
  const trig = (op, v) => ({ type: 'math_trig', fields: { OP: op }, inputs: { NUM: bx(v) } });
  const tmr = () => ({ type: 'jimu_timer' });
  const jn = parts => ({
    type: 'text_join', extraState: { itemCount: parts.length },
    inputs: parts.reduce((o, p, i) => { o['ADD' + i] = bx(p); return o; }, {})
  });
  const setText = (elId, node) => blk('jimu_el_text', { ELEMENT: elId }, null, { TEXT: bx(node) });

  // ① 自我介绍
  function intro() {
    const d = Project.data;
    const s1 = Project.getChapter(d.chapters[0].id);
    s1.name = '名片';
    const bg = grad(135, '#0F1523', '#1A1030');
    s1.preset.background = bg;
    const av = Project.createElement('shape', {
      name: '头像位置', x: 810, y: 150, w: 300, h: 300,
      props: { shape: 'circle', fill: '#6C8CFF', stroke: '#6C8CFF', strokeWidth: 0, radius: 150 }
    });
    const name = T('你的名字', 560, 500, 800, 130, 88, '#E6E9EF', { bold: true });
    const sub = T('在这里写一句自我介绍～', 510, 650, 900, 60, 36, '#8A93A6');
    const tags = ['🎯 我的爱好', '💡 我的特长', '📫 联系方式'].map((txt, i) =>
      T(txt, 420 + i * 350, 800, 300, 60, 32, '#C9D1E0'));
    setVis(s1, [av.id, name.id, sub.id].concat(tags.map(t => t.id)));
    s1.blocks = {
      blocks: {
        languageVersion: 0, blocks: [link([
          blk('jimu_on_scene', { SCENE: s1.id }),
          anim(av.id, 'zoomIn', 0.6, 0, 'easeOutBack'),
          anim(name.id, 'typewriter', 1.2, 0, 'linear'),
          anim(sub.id, 'fadeIn', 0.6, 0.1)
        ].concat(
          tags.map(t => anim(t.id, 'fadeIn', 0.5, 0)),
          [waitSec(2.5), blk('jimu_scene_go', { SCENE: s1.id })]
        ))]
      }
    };
    finish(bg);
  }

  // ② 课堂演示
  function lesson() {
    const d = Project.data;
    const s1 = Project.getChapter(d.chapters[0].id);
    s1.name = '封面';
    const bg1 = grad(135, '#101A2A', '#1A1030');
    s1.preset.background = bg1;
    const title = T('在这里写你的课题', 360, 380, 1200, 140, 96, '#E6E9EF', { bold: true });
    const sub = T('姓名 · 班级 · 日期', 660, 580, 600, 60, 40, '#8A93A6');
    const s2 = Project.addChapter('要点');
    s2.preset.background = { type: 'color', value: '#0F1115' };
    const t2 = T('三个要点', 660, 100, 600, 90, 64, '#E6E9EF', { bold: true });
    const cards = [];
    const icons = ['📌', '📊', '💡'];
    const labels = ['要点一：在这里写', '要点二：在这里写', '要点三：在这里写'];
    for (let i = 0; i < 3; i++) {
      const box = Project.createElement('shape', {
        name: '卡片' + (i + 1), x: 200 + i * 520, y: 300, w: 460, h: 440,
        props: { shape: 'rect', fill: '#1A2030', stroke: '#2A3140', strokeWidth: 2, radius: 22 }
      });
      const ic = Project.createElement('icon', {
        name: '图标' + (i + 1), x: 370 + i * 520, y: 360, w: 120, h: 120,
        props: { char: icons[i], size: 90, color: '#6C8CFF' }
      });
      const lb = T(labels[i], 210 + i * 520, 560, 440, 70, 36, '#C9D1E0');
      cards.push(box, ic, lb);
    }
    setVis(s1, [title.id, sub.id]);
    setVis(s2, [t2.id].concat(cards.map(c => c.id)));
    s1.blocks = {
      blocks: {
        languageVersion: 0, blocks: [link([
          blk('jimu_on_scene', { SCENE: s1.id }),
          anim(title.id, 'flyInTop', 0.7, 0, 'easeOutCubic'),
          anim(sub.id, 'fadeIn', 0.6, 0.15),
          waitSec(2),
          blk('jimu_scene_next')
        ])]
      }
    };
    const chain2 = [blk('jimu_on_scene', { SCENE: s2.id }), anim(t2.id, 'flyInTop', 0.6)];
    for (let i = 0; i < 3; i++) {
      chain2.push(anim(cards[i * 3].id, 'bounceIn', 0.6, 0.1, 'easeOutBack'));
      chain2.push(anim(cards[i * 3 + 1].id, 'bounceIn', 0.6, 0.1, 'easeOutBounce'));
      chain2.push(anim(cards[i * 3 + 2].id, 'fadeIn', 0.5, 0.05));
    }
    chain2.push(waitSec(2.5), blk('jimu_scene_go', { SCENE: s1.id }));
    s2.blocks = { blocks: { languageVersion: 0, blocks: [link(chain2)] } };
    finish(bg1);
  }

  // ③ 节日贺卡
  function card() {
    const d = Project.data;
    const s1 = Project.getChapter(d.chapters[0].id);
    s1.name = '贺卡';
    const bg = grad(160, '#2A1030', '#0F1523');
    s1.preset.background = bg;
    const emoji = Project.createElement('icon', {
      name: '大图标', x: 810, y: 130, w: 300, h: 300,
      props: { char: '🎂', size: 220, color: '#F5A623' }
    });
    const wish = T('生日快乐！今天也要开心呀', 360, 520, 1200, 120, 72, '#E6E9EF', { bold: true });
    const from = T('—— 来自：你的名字', 760, 700, 400, 50, 32, '#8A93A6');
    const star = Project.createElement('icon', {
      name: '星星', x: 1400, y: 780, w: 140, h: 140,
      props: { char: '✨', size: 110, color: '#F5A623' }
    });
    setVis(s1, [emoji.id, wish.id, from.id, star.id]);
    s1.blocks = {
      blocks: {
        languageVersion: 0, blocks: [link([
          blk('jimu_on_scene', { SCENE: s1.id }),
          anim(emoji.id, 'bounceIn', 0.8, 0, 'easeOutBounce'),
          anim(wish.id, 'typewriter', 1.6, 0.1, 'linear'),
          anim(from.id, 'fadeIn', 0.6, 0.2),
          anim(star.id, 'glowPulse', 1.2, 0, 'easeInOutCubic'),
          waitSec(3),
          blk('jimu_scene_go', { SCENE: s1.id })
        ])]
      }
    };
    finish(bg);
  }

  // ⑤ 报价单（销售演示：点卡片切换方案 + 悬停上浮）
  function quote() {
    const d = Project.data;
    const s1 = Project.getChapter(d.chapters[0].id);
    s1.name = '报价单';
    const bg = grad(160, '#0E1420', '#141A2E');
    s1.preset.background = bg;

    const title = T('选择适合你的方案', 560, 70, 800, 90, 60, '#E6E9EF', { bold: true });
    const sub = T('放映模式下点卡片切换价格 · 鼠标悬停有反馈', 510, 168, 900, 50, 28, '#8A93A6');

    const plans = [
      { name: '基础版', price: '¥99', feat: '单人使用\n10 个项目\n基础模板', desc: '基础版 · 适合个人起步' },
      { name: '专业版', price: '¥299', feat: '团队 5 人\n无限项目\n全部模板', desc: '专业版 · 团队首选' },
      { name: '旗舰版', price: '¥899', feat: '不限人数\n私有部署\n专属支持', desc: '旗舰版 · 企业级' }
    ];
    const cards = [], cardTexts = [];
    plans.forEach((pl, i) => {
      const x = 170 + i * 540;
      const card = Project.createElement('shape', {
        name: '卡片·' + pl.name, x, y: 275, w: 460, h: 520,
        props: { shape: 'rect', fill: i === 0 ? '#243050' : '#1A2030', stroke: '#2E3A54', strokeWidth: 2, radius: 26 }
      });
      cardTexts.push(
        T(pl.name, x + 40, 330, 380, 64, 40, '#C9D1E0', { align: 'left' }),
        T(pl.price, x + 40, 415, 380, 90, 72, '#E8B84B', { align: 'left', bold: true }),
        T(pl.feat, x + 40, 555, 380, 200, 28, '#8A93A6', { align: 'left' })
      );
      cards.push(card);
    });

    const big = T('¥99', 560, 840, 800, 120, 92, '#E8B84B', { bold: true });
    const desc = T('基础版 · 适合个人起步', 560, 970, 800, 54, 32, '#8A93A6');
    setVis(s1, [title.id, sub.id, big.id, desc.id]
      .concat(cards.map(c => c.id), cardTexts.map(t => t.id)));

    // 卡片交互：点击高亮 + 更新底部价格；悬停上浮 / 移出还原
    const allIds = cards.map(c => c.id);
    cards.forEach((card, i) => {
      card.blocks = { blocks: { languageVersion: 0, blocks: [
        link([
          blk('jimu_self_on_click'),
          ...allIds.map(id => blk('jimu_el_color', { ELEMENT: id, COLOR: '#1A2030' })),
          blk('jimu_self_el_color', { COLOR: '#243050' }),
          setText(big.id, txt(plans[i].price)),
          setText(desc.id, txt(plans[i].desc)),
          anim(big.id, 'zoomIn', 0.45, 0, 'easeOutBack')
        ]),
        link([
          blk('jimu_self_on_hover'),
          blk('jimu_self_change', { PROP: 'y' }, null, { DELTA: { shadow: { type: 'math_number', fields: { NUM: -10 } } } })
        ]),
        link([
          blk('jimu_self_on_hover_out'),
          blk('jimu_self_change', { PROP: 'y' }, null, { DELTA: { shadow: { type: 'math_number', fields: { NUM: 10 } } } })
        ])
      ] } };
    });

    s1.blocks = { blocks: { languageVersion: 0, blocks: [link([
      blk('jimu_on_scene', { SCENE: s1.id }),
      anim(title.id, 'flyInTop', 0.5),
      ...cards.map(c => anim(c.id, 'bounceIn', 0.5, 0, 'easeOutBack')),
      anim(big.id, 'fadeIn', 0.5)
    ])] } };
    finish(bg);
  }

  // ⑥ 抛体实验（教学：滑块调参数 + 点击发射看轨迹）
  function physics() {
    const d = Project.data;
    const s1 = Project.getChapter(d.chapters[0].id);
    s1.name = '抛体实验';
    const bg = grad(180, '#0D1117', '#101A2A');
    s1.preset.background = bg;

    const title = T('抛体实验', 660, 55, 600, 80, 56, '#E6E9EF', { bold: true });
    const readout = T('角度 45° · 速度 50', 660, 150, 600, 58, 36, '#E8B84B');
    const tip = T('拖动滑块调参数，点「发射」看轨迹', 560, 985, 800, 50, 28, '#5C6577');

    const ground = Project.createElement('shape', {
      name: '地面', x: 100, y: 872, w: 1720, h: 6,
      props: { shape: 'rect', fill: '#2A3140', radius: 3 }
    });
    const ball = Project.createElement('shape', {
      name: '小球', x: 280, y: 816, w: 56, h: 56,
      props: { shape: 'circle', fill: '#F0824C', stroke: '#F0824C', strokeWidth: 0 }
    });
    const btn = Project.createElement('shape', {
      name: '发射按钮', x: 838, y: 655, w: 244, h: 96,
      props: { shape: 'rect', fill: '#E4573D', stroke: '#E4573D', strokeWidth: 0, radius: 48 }
    });
    const btnTxt = T('🚀 发射', 838, 655, 244, 96, 40, '#FFFFFF', { bold: true });
    const sAngle = Project.createElement('slider', {
      name: '角度滑块', x: 130, y: 720, w: 560, h: 130,
      props: { min: 15, max: 90, value: 45, step: 1, label: '发射角度 (°)', color: '#E8B84B' }
    });
    const sSpeed = Project.createElement('slider', {
      name: '速度滑块', x: 1230, y: 720, w: 560, h: 130,
      props: { min: 10, max: 80, value: 50, step: 1, label: '初速度', color: '#6C8CFF' }
    });

    setVis(s1, [title.id, readout.id, tip.id, ground.id, ball.id, btn.id, btnTxt.id, sAngle.id, sSpeed.id]);

    // 滑块 → 实时读数
    const readoutExpr = () => jn([txt('角度 '), slv(sAngle.id), txt('° · 速度 '), slv(sSpeed.id)]);
    sAngle.blocks = { blocks: { languageVersion: 0, blocks: [link([
      blk('jimu_on_slider', { ELEMENT: sAngle.id }),
      setText(readout.id, readoutExpr())
    ])] } };
    sSpeed.blocks = { blocks: { languageVersion: 0, blocks: [link([
      blk('jimu_on_slider', { ELEMENT: sSpeed.id }),
      setText(readout.id, readoutExpr())
    ])] } };

    // 发射：计时器当时间 t，逐帧按公式计算位置
    //   x = 280 + 6·v·cosθ·t ；y = 816 − 6·v·sinθ·t + 90·t²
    const v6c = aop('MULTIPLY', num(6), aop('MULTIPLY', slv(sSpeed.id), trig('COS', slv(sAngle.id))));
    const v6s = aop('MULTIPLY', num(6), aop('MULTIPLY', slv(sSpeed.id), trig('SIN', slv(sAngle.id))));
    const xExpr = aop('ADD', num(280), aop('MULTIPLY', v6c, tmr()));
    const yExpr = aop('ADD', aop('MINUS', num(816), aop('MULTIPLY', v6s, tmr())),
      aop('MULTIPLY', num(90), aop('MULTIPLY', tmr(), tmr())));
    const moveStmt = blk('jimu_el_move', { ELEMENT: ball.id }, null, { X: bx(xExpr), Y: bx(yExpr) });
    const waitStmt = blk('jimu_wait', null, null, { SEC: { shadow: { type: 'math_number', fields: { NUM: 0.03 } } } });
    const loop = {
      type: 'controls_repeat_ext',
      inputs: {
        TIMES: { shadow: { type: 'math_number', fields: { NUM: 160 } } },
        DO: { block: link([moveStmt, waitStmt]) }
      }
    };
    btn.blocks = { blocks: { languageVersion: 0, blocks: [link([
      blk('jimu_self_on_click'),
      blk('jimu_timer_reset'),
      loop
    ])] } };

    s1.blocks = { blocks: { languageVersion: 0, blocks: [link([
      blk('jimu_on_scene', { SCENE: s1.id }),
      anim(title.id, 'flyInTop', 0.5),
      anim(ball.id, 'bounceIn', 0.45, 0, 'easeOutBounce'),
      anim(btn.id, 'zoomIn', 0.45, 0, 'easeOutBack'),
      anim(sAngle.id, 'flyInLeft', 0.5),
      anim(sSpeed.id, 'flyInRight', 0.5)
    ])] } };
    finish(bg);
  }

  // ⑦ 数据看板（点按钮切区域 + 点柱条看详情）
  function dashboard() {
    const d = Project.data;
    const s1 = Project.getChapter(d.chapters[0].id);
    s1.name = '数据看板';
    const bg = { type: 'color', value: '#0F1115' };
    s1.preset.background = bg;

    const title = T('区域销售看板', 640, 55, 640, 80, 56, '#E6E9EF', { bold: true });
    const sub = T('点下方按钮切换区域 · 点图表里的柱条查看详情', 510, 148, 900, 50, 28, '#8A93A6');
    const chartEl = Project.createElement('chart', {
      name: '销售图表', x: 340, y: 235, w: 1240, h: 560,
      props: { chartType: 'bar', categories: ['Q1', 'Q2', 'Q3', 'Q4'], values: [120, 200, 150, 260], seriesName: '销售额' }
    });
    const detail = T('点击图表上的柱条查看详情', 560, 928, 800, 56, 32, '#E8B84B');

    const regions = [
      { name: '华东', values: '120,200,150,260', total: 730 },
      { name: '华南', values: '90,140,210,180', total: 620 },
      { name: '华北', values: '160,120,170,200', total: 650 }
    ];
    const btns = [], btnTxts = [];
    regions.forEach((rg, i) => {
      const x = 430 + i * 400;
      btns.push(Project.createElement('shape', {
        name: '按钮·' + rg.name, x, y: 830, w: 260, h: 78,
        props: { shape: 'rect', fill: i === 0 ? '#6C8CFF' : '#1A2030', stroke: '#2E3A54', strokeWidth: 2, radius: 18 }
      }));
      btnTxts.push(T(rg.name, x, 830, 260, 78, 32, i === 0 ? '#FFFFFF' : '#C9D1E0'));
    });

    setVis(s1, [title.id, sub.id, chartEl.id, detail.id]
      .concat(btns.map(b => b.id), btnTxts.map(t => t.id)));

    // 按钮点击：重置三个按钮颜色 → 自己高亮 → 换图表数据 → 更新说明
    btns.forEach((b, i) => {
      b.blocks = { blocks: { languageVersion: 0, blocks: [link([
        blk('jimu_self_on_click'),
        ...btns.map(bb => blk('jimu_el_color', { ELEMENT: bb.id, COLOR: '#1A2030' })),
        blk('jimu_self_el_color', { COLOR: '#6C8CFF' }),
        blk('jimu_chart_set', { ELEMENT: chartEl.id }, null, { VALUE: { shadow: { type: 'text', fields: { TEXT: regions[i].values } } } }),
        setText(detail.id, txt(regions[i].name + '区 · 全年合计 ' + regions[i].total))
      ])] } };
    });

    // 点图表柱条 → 详情读出类别与数值
    chartEl.blocks = { blocks: { languageVersion: 0, blocks: [link([
      blk('jimu_self_on_chart_click'),
      setText(detail.id, jn([
        txt('你点了 '),
        { type: 'jimu_chart_click', fields: { WHAT: 'name' } },
        txt(' 季度：'),
        { type: 'jimu_chart_click', fields: { WHAT: 'value' } }
      ]))
    ])] } };

    s1.blocks = { blocks: { languageVersion: 0, blocks: [link([
      blk('jimu_on_scene', { SCENE: s1.id }),
      anim(title.id, 'flyInTop', 0.5),
      anim(chartEl.id, 'zoomIn', 0.55, 0, 'easeOutBack'),
      ...btns.map(b => anim(b.id, 'fadeIn', 0.4))
    ])] } };
    finish(bg);
  }

  // ④ 数据图表
  function chart() {
    const d = Project.data;
    const s1 = Project.getChapter(d.chapters[0].id);
    s1.name = '数据';
    const bg = { type: 'color', value: '#0F1115' };
    s1.preset.background = bg;
    const title = T('本月数据一览', 560, 90, 800, 100, 64, '#E6E9EF', { bold: true });
    const ch = Project.createElement('chart', {
      name: '数据图表', x: 360, y: 230, w: 1200, h: 620,
      props: { chartType: 'bar', categories: ['一月', '二月', '三月', '四月'], values: [120, 200, 150, 260], seriesName: '数据' }
    });
    const note = T('把数据和标题换成你的就行 →', 560, 900, 800, 50, 30, '#6C8CFF');
    setVis(s1, [title.id, ch.id, note.id]);
    s1.blocks = {
      blocks: {
        languageVersion: 0, blocks: [link([
          blk('jimu_on_scene', { SCENE: s1.id }),
          anim(title.id, 'flyInTop', 0.6, 0, 'easeOutCubic'),
          anim(ch.id, 'zoomIn', 0.7, 0.15, 'easeOutBack'),
          anim(note.id, 'fadeIn', 0.6, 0.2),
          waitSec(3),
          blk('jimu_scene_go', { SCENE: s1.id })
        ])]
      }
    };
    finish(bg);
  }

  const list = [
    { key: 'intro', name: '自我介绍', icon: '🙋', desc: '姓名 / 特长 / 联系方式', build: intro },
    { key: 'lesson', name: '课堂演示', icon: '📚', desc: '课题 + 三个要点卡片', build: lesson },
    { key: 'card', name: '节日贺卡', icon: '🎂', desc: '祝福语 + 动画', build: card },
    { key: 'chart', name: '数据图表', icon: '📊', desc: '柱状图 + 标题说明', build: chart },
    { key: 'quote', name: '报价单', icon: '💰', desc: '点卡片切换方案', build: quote },
    { key: 'physics', name: '抛体实验', icon: '🧪', desc: '拖滑块 · 点发射', build: physics },
    { key: 'dashboard', name: '数据看板', icon: '📈', desc: '切区域 · 点柱条', build: dashboard }
  ];

  return {
    list,
    build(key) {
      const t = list.find(x => x.key === key);
      if (t) t.build();
    }
  };
})();
