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
    { key: 'chart', name: '数据图表', icon: '📊', desc: '柱状图 + 标题说明', build: chart }
  ];

  return {
    list,
    build(key) {
      const t = list.find(x => x.key === key);
      if (t) t.build();
    }
  };
})();
