#!/usr/bin/env node
// 积木自检：加载 blocks.js 并实例化全部自定义积木，暴露注册/API 兼容问题
// 用法：node tools/check-blocks.js（需要先 npm install，在项目根目录运行）
const path = require('path');
const root = path.join(__dirname, '..');
const Blockly = require(path.join(root, 'node_modules/blockly'));

global.window = global;
global.Blockly = Blockly;
global.Project = {
  data: {
    format: 'jimuchang-project', version: 2,
    stage: { background: { type: 'color', value: '#0F1115' } },
    chapters: [{ id: 'ch1', name: '自检', preset: {}, blocks: null }],
    elements: [
      { id: 'e1', name: '测试', type: 'text', props: {} },
      { id: 'e2', name: '滑块', type: 'slider', props: {} },
      { id: 'e3', name: '图表', type: 'chart', props: {} }
    ],
    resources: []
  },
  getElement(id) { return (this.data.elements || []).find(e => e.id === id) || null; },
  getScene(id) { return (this.data.chapters || []).find(c => c.id === id) || null; },
  getChapter(id) { return this.getScene(id); }
};

const fs = require('fs');
eval(fs.readFileSync(path.join(root, 'web/js/blocks.js'), 'utf8') + '; globalThis.IRCompiler = IRCompiler;');

const ws = new Blockly.Workspace();
let ok = 0;
const fails = [];
// 收集两个工具箱里的全部块类型（含 Blockly 内置块）
const toolTypes = new Set(Object.keys(Blockly.Blocks).filter(t => t.startsWith('jimu_')));
try {
  const walk = items => (items || []).forEach(it => {
    if (!it) return;
    if (it.kind === 'block' && it.type) toolTypes.add(it.type);
    if (it.contents) walk(it.contents);
  });
  walk(JimuBlocks.toolbox().contents);
  walk(JimuBlocks.selfToolbox().contents);
} catch (e) { fails.push('工具箱解析失败: ' + e.message); }

const selfCount = [...toolTypes].filter(t => t.startsWith('jimu_self_')).length;
for (const type of toolTypes) {
  try {
    const blk = ws.newBlock(type);
    ok++;
    // 帽子块：验证能被 hatOf 识别
    if (IRCompiler.hatOf(blk)) continue;
    // 表达式块：验证 IR 编译受支持
    if (blk.outputConnection) {
      const r = IRCompiler.exprOf(blk);
      if (r && r.k === 'unsupported') fails.push(`${type}: 表达式 IR 未实现 (${r.type})`);
    } else if (type.startsWith('jimu_')) {
      // 语句块：验证 IR 编译不为 null
      const prev = IRCompiler._selfMode;
      IRCompiler._selfMode = type.startsWith('jimu_self_');
      let r = null;
      try { r = IRCompiler.compile(blk); } finally { IRCompiler._selfMode = prev; }
      if (!r) fails.push(`${type}: 语句 IR 未实现`);
    }
  } catch (e) {
    fails.push(`${type}: ${e.message}`);
  }
}

// ---- 序列化加载测试：验证块经 workspaces.load 还原后字段值不丢（动态下拉/元素引用）----
// 背景：S3 曾发生"动态下拉序列化加载时选项未生成 → 字段值被重置为空"，此测试做长期防护。
const serCases = [
  ['jimu_on_slider', { ELEMENT: 'e2' }, 'ELEMENT'],
  ['jimu_slider_value', { ELEMENT: 'e2' }, 'ELEMENT'],
  ['jimu_slider_set', { ELEMENT: 'e2' }, 'ELEMENT'],
  ['jimu_chart_set', { ELEMENT: 'e3' }, 'ELEMENT'],
  ['jimu_chart_cats', { ELEMENT: 'e3' }, 'ELEMENT'],
  ['jimu_on_chart_click', { ELEMENT: 'e3' }, 'ELEMENT'],
  ['jimu_on_hover', { ELEMENT: 'e1' }, 'ELEMENT'],
  ['jimu_on_hover_out', { ELEMENT: 'e1' }, 'ELEMENT'],
  ['jimu_on_click', { ELEMENT: 'e1' }, 'ELEMENT'],
  ['jimu_chart_click', { WHAT: 'value' }, 'WHAT']
];
for (const [type, fields, key] of serCases) {
  try {
    const w2 = new Blockly.Workspace();
    Blockly.serialization.workspaces.load({
      blocks: { languageVersion: 0, blocks: [{ type, fields }], variables: [] }
    }, w2);
    const b2 = w2.getTopBlocks(false)[0];
    const got = b2.getFieldValue(key);
    if (got !== fields[key]) fails.push(`${type}: 序列化后字段 ${key} 丢失（${fields[key]} → ${got}）`);
  } catch (e) {
    fails.push(`${type}: 序列化加载失败 ${e.message}`);
  }
}
console.log(`积木自检：${ok} 正常 / ${fails.length} 失败（其中自我版 ${selfCount} 块）`);
fails.forEach(f => console.log('  ❌', f));
process.exit(fails.length ? 1 : 0);
