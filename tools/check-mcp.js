#!/usr/bin/env node
// MCP 工具发现自检：不依赖积木剧场 API 是否开启。
const { spawn } = require('child_process');
const path = require('path');

const proc = spawn(process.execPath, [path.join(__dirname, 'jimuchang-mcp')], {
  stdio: ['pipe', 'pipe', 'pipe']
});
let buffer = '';
let initialized = false;
const timer = setTimeout(() => {
  console.error('MCPCHECK|timeout');
  proc.kill();
  process.exit(1);
}, 12000);

const send = obj => proc.stdin.write(JSON.stringify(obj) + '\n');
proc.stdout.on('data', chunk => {
  buffer += chunk.toString();
  let i;
  while ((i = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id === 1) {
      initialized = true;
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    } else if (msg.id === 2) {
      const names = (msg.result && msg.result.tools || []).map(t => t.name);
      const required = [
        'jc_set_chapter_flow',
        'jc_list_resources',
        'jc_get_resource',
        'jc_rename_resource',
        'jc_delete_resource',
        'jc_upload_resource',
        'jc_upload_resources',
        'jc_add_element_from_resource'
      ];
      const missing = required.filter(n => !names.includes(n));
      const ok = initialized && !missing.length;
      console.log(`MCPCHECK|tools=${names.length}|required=${required.length - missing.length}/${required.length}|${ok ? 'PASS' : 'FAIL'}`);
      if (missing.length) console.log('MCPCHECK|missing=' + missing.join(','));
      clearTimeout(timer);
      proc.kill();
      process.exit(ok ? 0 : 1);
    }
  }
});

send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'jimuchang-check', version: '1' }
  }
});
