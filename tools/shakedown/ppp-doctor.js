'use strict';
// Probe the INSTALLED orchestra-engine MCP server of a project over stdio:
// initialize -> tools/list -> orchestra_doctor. Read-only; spawns exactly the
// command .mcp.json registers, with cwd = project.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const project = process.argv[2];
if (!project) { console.error('usage: node ppp-doctor.js <project>'); process.exit(2); }
const mcp = JSON.parse(fs.readFileSync(path.join(project, '.mcp.json'), 'utf8'));
const entry = mcp.mcpServers['orchestra-engine'];
console.log('REGISTERED:', JSON.stringify(entry));
const cmd = entry.command === 'node' ? process.execPath : entry.command;
const args = (entry.args || []).map((a) => a.replace(/\$\{?CLAUDE_PROJECT_DIR\}?/g, project));
const child = spawn(cmd, args, {
  cwd: project,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: project }, entry.env || {}),
});
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
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}
(async () => {
  const timer = setTimeout(() => { console.log('TIMEOUT'); console.log('STDERR:', stderr); child.kill(); process.exit(1); }, 30000);
  const init = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'ppp-doctor', version: '0' } });
  console.log('INIT:', JSON.stringify(init.result && init.result.serverInfo));
  notify('notifications/initialized', {});
  const tools = await rpc('tools/list', {});
  console.log('TOOLS:', (tools.result.tools || []).map((t) => t.name).sort().join(', '));
  const doc = await rpc('tools/call', { name: 'orchestra_doctor', arguments: {} });
  const text = (doc.result && doc.result.content || []).map((c) => c.text).join('\n');
  console.log('DOCTOR isError=' + !!(doc.result && doc.result.isError));
  console.log(text);
  if (stderr.trim()) console.log('STDERR:\n' + stderr.trim());
  clearTimeout(timer);
  child.kill();
  process.exit(0);
})();
