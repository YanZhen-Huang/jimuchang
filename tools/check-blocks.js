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
    elements: [{ id: 'e1', name: '测试', type: 'text', props: {} }],
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
console.log(`积木自检：${ok} 正常 / ${fails.length} 失败（其中自我版 ${selfCount} 块）`);
fails.forEach(f => console.log('  ❌', f));
process.exit(fails.length ? 1 : 0);
