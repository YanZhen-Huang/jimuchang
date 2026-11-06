#!/usr/bin/env node
// 执行器事件回归：验证章节页里的“当演示开始”也会在播放时执行。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const Blockly = require(path.join(root, 'node_modules/blockly'));

global.window = global;
global.Blockly = Blockly;

const startState = text => ({
  blocks: {
    languageVersion: 0,
    blocks: [{
      type: 'jimu_on_start',
      next: {
        block: {
          type: 'text_print',
          inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: text } } } }
        }
      }
    }]
  }
});

global.Project = {
  data: {
    chapters: [
      { id: 'ch1', blocks: startState('chapter-start-ran') },
      { id: 'ch2', blocks: null }
    ],
    elements: [],
    globalBlocks: null,
    stage: { background: { type: 'color', value: '#000000' } }
  },
  getElement() { return null; },
  getScene(id) { return this.data.chapters.find(ch => ch.id === id) || null; },
  getChapter(id) { return this.getScene(id); }
};
global.JimuBlocks = { save() {} };
global.ChapterFlow = { syncAll() {} };
global.Stage = {
  currentSceneId: 'ch1',
  async goScene(id) { this.currentSceneId = id; },
  currentScene() { return Project.data.chapters[0]; }
};

eval(fs.readFileSync(path.join(root, 'web/js/blocks.js'), 'utf8') + ';globalThis.IRCompiler = IRCompiler;');
eval(fs.readFileSync(path.join(root, 'web/js/executor.js'), 'utf8') + ';globalThis.Executor = Executor;');

(async () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    await Executor.start();
  } finally {
    console.log = originalLog;
  }
  const ok = logs.includes('[剧本] chapter-start-ran');
  console.log(`EXECTEST|chapter-on-start|${ok ? 'PASS' : 'FAIL'}`);
  if (!ok) {
    console.log('EXECTEST|logs=' + JSON.stringify(logs));
    process.exit(1);
  }
})();
