'use strict';
// Call one tool on a project's INSTALLED orchestra-engine MCP server over
// stdio and print the raw result. usage: node ppp-call.js <project> <tool> '<json-args>'
// With tool = "schema" it prints the inputSchema of every tool instead.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const [project, tool, argsJson] = process.argv.slice(2);
if (!project || !tool) { console.error('usage: node ppp-call.js <project> <tool|schema> [json-args]'); process.exit(2); }
const mcp = JSON.parse(fs.readFileSync(path.join(project, '.mcp.json'), 'utf8'));
const entry = mcp.mcpServers['orchestra-engine'];
const cmd = entry.command === 'node' ? process.execPath : entry.command;
const args = (entry.args || []).map((a) => a.replace(/\$\{?CLAUDE_PROJECT_DIR\}?/g, project));
const child = spawn(cmd, args, { cwd: project, stdio: ['pipe', 'pipe', 'pipe'], env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: project }, entry.env || {}) });
let stderr = '';
child.stderr.on('data', (d) => { stderr += d.toString(); });
let buf = '';
const pending = new Map();
let nextId = 1;
child.stdout.on('data', (chunk) => {
  buf += chunk.toString();
  let i;
  while ((i = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch (_) { continue; }
    if (msg.id != null && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  }
});
function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve) => { pending.set(id, resolve); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
}
(async () => {
  const timer = setTimeout(() => { console.log('TIMEOUT'); console.log('STDERR:', stderr); child.kill(); process.exit(1); }, 120000);
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'ppp-call', version: '0' } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) + '\n');
  if (tool === 'schema') {
    const tools = await rpc('tools/list', {});
    for (const t of tools.result.tools) console.log(t.name + ': ' + JSON.stringify(t.inputSchema));
  } else {
    const res = await rpc('tools/call', { name: tool, arguments: argsJson ? JSON.parse(argsJson) : {} });
    console.log('isError=' + !!(res.result && res.result.isError));
    console.log((res.result && res.result.content || []).map((c) => c.text).join('\n'));
    if (res.error) console.log('RPC ERROR: ' + JSON.stringify(res.error));
  }
  if (stderr.trim()) console.log('STDERR:\n' + stderr.trim().slice(0, 2000));
  clearTimeout(timer);
  child.kill();
  process.exit(0);
})();
