#!/usr/bin/env node
// 章节流程生成器自检：不启动 GUI，直接验证“章节设置 → 积木状态”的确定性。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
global.window = global;
global.JSZip = require(path.join(root, 'node_modules/jszip'));
global.JimuConst = {
  ANIM_TYPES: [
    ['淡入', 'fadeIn'],
    ['放大进入', 'zoomIn']
  ],
  EASINGS: [
    ['缓出', 'easeOutCubic'],
    ['线性', 'linear']
  ]
};

eval(fs.readFileSync(path.join(root, 'web/js/project.js'), 'utf8') + '\n;globalThis.Project = Project;');
eval(fs.readFileSync(path.join(root, 'web/js/chapter-flow.js'), 'utf8'));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`CF|${name}|${ok ? 'PASS' : 'FAIL'}${detail ? '|' + detail : ''}`);
};

const blockList = state => {
  const out = [];
  let b = state && state.blocks && state.blocks.blocks && state.blocks.blocks[0];
  while (b) {
    out.push(b);
    b = b.next && b.next.block;
  }
  return out;
};
const blockTypes = state => blockList(state).map(b => b.type);
const findBlock = (state, type) => blockList(state).find(b => b.type === type) || null;

(async () => {
  try {
    Project.newProject('流程测试');
    const el1 = Project.createElement('text', { name: '标题' });
    const el2 = Project.createElement('shape', { name: '卡片' });
    const ch1 = Project.data.chapters[0];
    const ch2 = Project.addChapter('第二页');

    ch1.flow.steps = [
      { kind: 'animate', elementId: el1.id, anim: 'fadeIn', duration: 0.8, delay: 0.1, easing: 'easeOutCubic' },
      { kind: 'animate', elementId: 'missing', anim: 'zoomIn', duration: 0.4, delay: 0, easing: 'linear' },
      { kind: 'wait', seconds: 2 },
      { kind: 'jump', chapterId: ch2.id }
    ];
    const state = ChapterFlow.generateState(ch1);
    const types = blockTypes(state);
    check('chain', types.join(',') === 'jimu_on_scene,jimu_scene_bg,jimu_el_show,jimu_el_show,jimu_anim,jimu_wait,jimu_scene_go', types.join(','));
    check('background-block', findBlock(state, 'jimu_scene_bg').fields.COLOR === '#0F1115');
    check('invalid-element-filtered', ch1.flow.steps.length === 3, `steps=${ch1.flow.steps.length}`);
    check('jump-target', findBlock(state, 'jimu_scene_go').fields.SCENE === ch2.id);

    ch1.flow.steps = [{ kind: 'jump', chapterId: ch1.id }];
    ChapterFlow.generateState(ch1);
    check('self-jump-becomes-next', ch1.flow.steps[0].kind === 'next', ch1.flow.steps[0].kind);

    ch1.flowMode = 'manual';
    ch1.blocks = { blocks: { languageVersion: 0, blocks: [{ type: 'manual_sentinel' }] } };
    const before = JSON.stringify(ch1.blocks);
    ChapterFlow.sync(ch1);
    check('manual-not-overwritten', JSON.stringify(ch1.blocks) === before);

    ch1.flowMode = 'auto';
    ch1.flow.steps = [
      { kind: 'animate', elementId: el2.id, anim: 'fadeIn', duration: 0.5, delay: 0, easing: 'easeOutCubic' },
      { kind: 'next' }
    ];
    ChapterFlow.syncAll();
    const packed = await Project.pack();
    const data = await Project.parse(packed);
    check('roundtrip-flow', data.chapters[0].flowMode === 'auto' && data.chapters[0].flow.steps.length === 2);
    const loaded = Project.applyLoadedData(data);
    const types2 = blockTypes(loaded.chapters[0].blocks);
    check('roundtrip-generated', types2.join(',') === 'jimu_on_scene,jimu_scene_bg,jimu_el_show,jimu_el_show,jimu_anim,jimu_scene_next', types2.join(','));

    loaded.chapters[0].preset.visibility[el2.id] = false;
    ChapterFlow.sync(loaded.chapters[0]);
    check('hidden-element-step-filtered', loaded.chapters[0].flow.steps.every(s => s.kind !== 'animate'));
    check('hidden-element-block-generated', blockTypes(loaded.chapters[0].blocks).includes('jimu_el_hide'));

    ChapterFlow.removeElement(el2.id);
    check('remove-element-step', loaded.chapters[0].flow.steps.every(s => s.kind !== 'animate'));

    const legacy = {
      format: 'jimuchang-project',
      version: 2,
      name: '旧项目',
      canvas: { width: 1920, height: 1080 },
      theme: { bg: '#000000' },
      stage: { background: { type: 'color', value: '#000000' }, fx: null },
      resources: [],
      elements: [],
      chapters: [{
        id: 'old-ch', name: '旧章节',
        preset: { background: { type: 'color', value: '#000000' }, visibility: {} },
        blocks: { blocks: { languageVersion: 0, blocks: [{ type: 'jimu_on_start' }] } }
      }],
      globalBlocks: null,
      music: { resourceId: null, loop: true, volume: 0.8 }
    };
    Project.applyLoadedData(legacy);
    check('legacy-v2-manual', legacy.chapters[0].flowMode === 'manual' && Array.isArray(legacy.chapters[0].flow.steps));

    const v1 = Project.migrateV1toV2({
      name: '旧 v1',
      resources: [],
      globalBlocks: null,
      scenes: [{
        id: 's1', name: '场景', elements: [],
        background: { type: 'color', value: '#000000' },
        blocks: { blocks: { languageVersion: 0, blocks: [{ type: 'jimu_on_start' }] } }
      }]
    });
    check('legacy-v1-manual', v1.chapters[0].flowMode === 'manual' && v1.chapters[0].flow.steps.length === 0);

    const failed = results.filter(x => !x.ok);
    console.log(`CF|SUMMARY|${results.length - failed.length}/${results.length}`);
    process.exit(failed.length ? 1 : 0);
  } catch (e) {
    console.error('CF|error|' + (e && e.stack || e));
    process.exit(1);
  }
})();
