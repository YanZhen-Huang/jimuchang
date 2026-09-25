#!/usr/bin/env node
// 积木自检：加载 blocks.js 并实例化全部自定义积木，暴露注册/API 兼容问题
// 用法：node tools/check-blocks.js（需要先 npm install，在项目根目录运行）
const path = require('path');
const root = path.join(__dirname, '..');
const Blockly = require(path.join(root, 'node_modules/blockly'));

global.window = global;
global.Blockly = Blockly;
global.Project = { data: { scenes: [{ id: 's1', name: '自检', elements: [{ id: 'e1', name: '测试', type: 'text', props: {} }] }] } };

const fs = require('fs');
eval(fs.readFileSync(path.join(root, 'web/js/blocks.js'), 'utf8') + '; globalThis.IRCompiler = IRCompiler;');

const ws = new Blockly.Workspace();
let ok = 0;
const fails = [];
// 收集工具箱里全部块类型（含 Blockly 内置块）
const toolTypes = new Set(Object.keys(Blockly.Blocks).filter(t => t.startsWith('jimu_')));
try {
  const tb = JimuBlocks.toolbox();
  const walk = items => (items || []).forEach(it => {
    if (!it) return;
    if (it.kind === 'block' && it.type) toolTypes.add(it.type);
    if (it.contents) walk(it.contents);
  });
  walk(tb.contents);
} catch (e) { fails.push('工具箱解析失败: ' + e.message); }
for (const type of toolTypes) {
  try {
    const blk = ws.newBlock(type);
    ok++;
    // 表达式块：验证 IR 编译受支持
    if (blk.outputConnection) {
      const r = IRCompiler.exprOf(blk);
      if (r && r.k === 'unsupported') fails.push(`${type}: 表达式 IR 未实现 (${r.type})`);
    }
  } catch (e) {
    fails.push(`${type}: ${e.message}`);
  }
}
console.log(`积木自检：${ok} 正常 / ${fails.length} 失败`);
fails.forEach(f => console.log('  ❌', f));
process.exit(fails.length ? 1 : 0);
