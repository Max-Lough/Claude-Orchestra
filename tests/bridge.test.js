#!/usr/bin/env node
/**
 * WO-14b leg 4 tests — bridge/runtime.js (dispatch/gate/requireTicket/
 * generationCheck) and bridge/hooks/ticket-gate.js driven as a subprocess.
 * Same house style as tests/tickets.test.js: a plain check(name, ok) runner,
 * no framework, no dependencies. Temp project dirs; no live models.
 *
 *   node tests/bridge.test.js
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const MASTER = path.resolve(__dirname, '..');
const { createRuntime } = require(path.join(MASTER, 'bridge', 'runtime.js'));
const T = require(path.join(MASTER, 'router', 'tickets.js'));

let failures = 0;
let passes = 0;
const cleanups = [];

function check(name, ok, detail) {
  if (ok) {
    passes++;
    console.log('  PASS  ' + name);
  } else {
    failures++;
    process.exitCode = 1;
    console.log('  FAIL  ' + name + (detail ? '\n        ' + String(detail).replace(/\n/g, '\n        ') : ''));
  }
}
function section(title) { console.log('\n' + title); }
process.on('exit', () => {
  for (const fn of cleanups) { try { fn(); } catch (e) { /* best effort */ } }
  if (failures > 0) process.exitCode = 1;
  else if (passes === 0) {
    console.log('\nFAILED — no checks ran at all (the suite did not execute)');
    process.exitCode = 1;
  }
});

// ------------------------------------------------------------------ fixtures

function tmpProject(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  return dir;
}
function writeManifest(dir, overrides) {
  const manifest = Object.assign({ roster: 'new', rosterGeneration: 1, seats: {} }, overrides || {});
  fs.writeFileSync(path.join(dir, '.claude', 'orchestra.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}
const GREEN = { 'AU-all': 0.95, 'AU-opus': 0.95, 'AU-fable': 0.95, 'OU': 0.95 };
function seedReadings(dir, fractions) {
  const file = path.join(dir, '.claude', 'orchestra-pool-readings.jsonl');
  const lines = Object.entries(fractions).map(([bucket, remainingFraction]) => JSON.stringify({
    ts: new Date().toISOString(), kind: 'reading', bucket, remainingFraction, source: 'bridge.test.js fixture',
  }));
  fs.writeFileSync(file, lines.join('\n') + '\n');
}
function baseRequest(overrides) {
  return Object.assign({ class: 'E2', risk: 'T1', goal: 'fix the thing', acceptance_criteria: ['tests pass'] }, overrides || {});
}
function openTicketsCount(dir) {
  const store = { dir: path.join(dir, '.claude', 'orchestra', 'tickets') };
  return T.openTickets(store).length;
}

// leg-1 verbatim payload shapes (roster/wo14b-leg1-lifecycle-proof-appendix.md)
const AGENT_ID = 'a01ba92504d73e391';
const RESOLVED_MODEL = 'claude-haiku-4-5-20251001';
const AGENT_TRANSCRIPT_PATH =
  'C:\\Users\\maxtl\\.claude\\projects\\C--fixture\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430\\subagents\\agent-a01ba92504d73e391.jsonl';

function preEvent(prompt, subagentType, toolUseId, extra) {
  return Object.assign({
    hook_event_name: 'PreToolUse', tool_name: 'Agent',
    tool_input: { description: 'test launch', prompt, subagent_type: subagentType },
    tool_use_id: toolUseId,
  }, extra || {});
}
function postEvent(toolUseId, agentId, resolvedModel) {
  return {
    hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: toolUseId,
    tool_input: {}, tool_response: { isAsync: true, status: 'async_launched', agentId, resolvedModel },
  };
}
function subagentStopEvent(agentId, lastAssistantMessage, transcriptPath) {
  return { hook_event_name: 'SubagentStop', agent_id: agentId, last_assistant_message: lastAssistantMessage, agent_transcript_path: transcriptPath };
}
function stopEvent(stopHookActive, backgroundTasks) {
  return { hook_event_name: 'Stop', stop_hook_active: !!stopHookActive, background_tasks: backgroundTasks || [] };
}

// ============================================================ 1. inert legacy

section('1. Absent/legacy manifest — gate() inert for every event');

{
  const dir = tmpProject('bridge-legacy-');
  const runtime = createRuntime({ projectDir: dir }); // no orchestra.json at all
  for (const ev of [preEvent('TICKET=tkt-aa11bb22cc33dd44', 'builder', 'tu1'), postEvent('tu1', 'a1', 'm'), subagentStopEvent('a1', 'x', 'p'), stopEvent(false, [])]) {
    check('no manifest -> ' + ev.hook_event_name + ' inert', JSON.stringify(runtime.gate(ev)) === JSON.stringify({ inert: true }));
  }
  writeManifest(dir, { roster: 'legacy' });
  const runtime2 = createRuntime({ projectDir: dir });
  check('roster:legacy -> PreToolUse inert', JSON.stringify(runtime2.gate(preEvent('TICKET=tkt-aa11bb22cc33dd44', 'builder', 'tu1'))) === JSON.stringify({ inert: true }));
}

// ============================================================ 2. happy path

section('2. roster:new happy path — dispatch -> Pre consume -> Post launch -> SubagentStop resolve -> Stop not blocked');

{
  const dir = tmpProject('bridge-happy-');
  writeManifest(dir);
  seedReadings(dir, GREEN);
  const runtime = createRuntime({ projectDir: dir });

  const result = runtime.dispatch(baseRequest());
  check('dispatch() ok:true on a Green pool', result.ok === true, JSON.stringify(result));
  check('an implementation ticket is issued, OPEN', result.ok && result.tickets.implementation.status === 'OPEN');
  check('spawn.subagent_type is the installed Builder file name', result.ok && result.spawn.subagent_type === 'builder', result.ok && result.spawn.subagent_type);
  check('spawn.prompt_header carries TICKET=<id>', result.ok && result.spawn.prompt_header === 'TICKET=' + result.tickets.implementation.id + '\n');

  const ticketId = result.tickets.implementation.id;
  const toolUseId = 'toolu_01AuYt3hjvYc2Yws8FZriovJ';

  const pre = runtime.gate(preEvent('TICKET=' + ticketId, 'builder', toolUseId));
  check('PreToolUse allows and consumes the ticket', pre.hookSpecificOutput && pre.hookSpecificOutput.permissionDecision === 'allow', JSON.stringify(pre));

  const post = runtime.gate(postEvent(toolUseId, AGENT_ID, RESOLVED_MODEL));
  check('PostToolUse returns {} (no permissionDecision on Post)', JSON.stringify(post) === '{}');

  const blocked = runtime.gate(stopEvent(false, [{ id: AGENT_ID, type: 'subagent', status: 'running' }]));
  check('Stop blocks once while the ticket is LAUNCHED and not yet resolved', blocked.decision === 'block', JSON.stringify(blocked));

  const stopEmpty = runtime.gate(subagentStopEvent(AGENT_ID, 'BUILDER-RESULT\nTICKET=' + ticketId, AGENT_TRANSCRIPT_PATH));
  check('SubagentStop returns {} and resolves the ticket', JSON.stringify(stopEmpty) === '{}');

  const store = { dir: path.join(dir, '.claude', 'orchestra', 'tickets') };
  const after = T.get(store, ticketId);
  check('ticket is RESOLVED with last_assistant_message + agent_transcript_path bound verbatim',
    after.status === 'RESOLVED' && after.resolved.last_assistant_message === 'BUILDER-RESULT\nTICKET=' + ticketId && after.resolved.agent_transcript_path === AGENT_TRANSCRIPT_PATH);
  check('launched.agent_id and served_model were bound at PostToolUse', after.launched.agent_id === AGENT_ID && after.launched.served_model === RESOLVED_MODEL);

  const allowedStop = runtime.gate(stopEvent(true, []));
  check('Stop allows once resolved (stop_hook_active:true, no open tickets)', JSON.stringify(allowedStop) === '{}');
}

// =================================================== 3. unticketed/replay/etc

section('3. Pre denials: unticketed, replay, wrong-role, expired, wrong-generation');

{
  const dir = tmpProject('bridge-deny-');
  writeManifest(dir);
  seedReadings(dir, GREEN);
  const runtime = createRuntime({ projectDir: dir });
  const result = runtime.dispatch(baseRequest());
  const ticketId = result.tickets.implementation.id;

  const noTicket = runtime.gate(preEvent('NO TICKET HERE', 'builder', 'tu-a'));
  check('unticketed prompt denies', noTicket.hookSpecificOutput.permissionDecision === 'deny' && /no TICKET/.test(noTicket.hookSpecificOutput.permissionDecisionReason));

  const wrongRole = runtime.gate(preEvent('TICKET=' + ticketId, 'not-the-role', 'tu-b'));
  check('wrong-role denies, ticket stays OPEN', wrongRole.hookSpecificOutput.permissionDecision === 'deny' && /for role/.test(wrongRole.hookSpecificOutput.permissionDecisionReason));

  const first = runtime.gate(preEvent('TICKET=' + ticketId, 'builder', 'tu-c'));
  check('first legitimate consume allows', first.hookSpecificOutput.permissionDecision === 'allow');
  const replay = runtime.gate(preEvent('TICKET=' + ticketId, 'builder', 'tu-d'));
  check('replay of a CONSUMED ticket denies (one-use)', replay.hookSpecificOutput.permissionDecision === 'deny' && /one-use/.test(replay.hookSpecificOutput.permissionDecisionReason));

  // expired
  const expReq = runtime.dispatch(baseRequest({ task_id: 'exp-1' }));
  const store = { dir: path.join(dir, '.claude', 'orchestra', 'tickets') };
  const expTicket = T.get(store, expReq.tickets.implementation.id);
  expTicket.expires_at = new Date(Date.now() - 1000).toISOString();
  fs.writeFileSync(path.join(store.dir, 'tickets.json'),
    fs.readFileSync(path.join(store.dir, 'tickets.json'), 'utf8').replace(new RegExp(JSON.stringify(T.get(store, expReq.tickets.implementation.id).expires_at)), JSON.stringify(expTicket.expires_at)));
  const expired = runtime.gate(preEvent('TICKET=' + expTicket.id, 'builder', 'tu-e'));
  check('expired ticket denies', expired.hookSpecificOutput.permissionDecision === 'deny' && /expired/.test(expired.hookSpecificOutput.permissionDecisionReason), JSON.stringify(expired));

  // wrong-generation: bump the manifest, don't call generationCheck first, then gate should invalidate before consuming
  const genReq = runtime.dispatch(baseRequest({ task_id: 'gen-1' }));
  writeManifest(dir, { rosterGeneration: 2 });
  const runtime2 = createRuntime({ projectDir: dir }); // fresh runtime instance, as a fresh hook process would be
  const genDeny = runtime2.gate(preEvent('TICKET=' + genReq.tickets.implementation.id, 'builder', 'tu-f'));
  check('a ticket minted under the old generation denies once the manifest advances (INVALIDATED)', genDeny.hookSpecificOutput.permissionDecision === 'deny' && /INVALIDATED/.test(genDeny.hookSpecificOutput.permissionDecisionReason), JSON.stringify(genDeny));
}

// ==================================================== 4. malformed stdin (adapter)

section('4. bridge/hooks/ticket-gate.js — malformed stdin denies (Pre) / blocks (Stop)');

{
  const dir = tmpProject('bridge-adapter-');
  writeManifest(dir);
  seedReadings(dir, GREEN);
  const script = path.join(MASTER, 'bridge', 'hooks', 'ticket-gate.js');

  const pre = spawnSync(process.execPath, [script, 'PreToolUse'], { input: '{ not json', encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: dir }) });
  check('malformed stdin on PreToolUse: exit 0', pre.status === 0, 'exit ' + pre.status + ' stderr: ' + pre.stderr);
  let preJson = null; try { preJson = JSON.parse(pre.stdout); } catch (e) { /* fail below */ }
  check('malformed stdin on PreToolUse: denies', !!preJson && preJson.hookSpecificOutput && preJson.hookSpecificOutput.permissionDecision === 'deny', pre.stdout);

  const stop = spawnSync(process.execPath, [script, 'Stop'], { input: 'not json at all', encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: dir }) });
  check('malformed stdin on Stop: exit 0', stop.status === 0, 'exit ' + stop.status + ' stderr: ' + stop.stderr);
  let stopJson = null; try { stopJson = JSON.parse(stop.stdout); } catch (e) { /* fail below */ }
  check('malformed stdin on Stop: blocks', !!stopJson && stopJson.decision === 'block', stop.stdout);
}

// ==================================================== 5. missing store

section('5. Missing/unreadable ticket store denies (Pre) rather than silently creating one out of band');

{
  const dir = tmpProject('bridge-nostore-');
  writeManifest(dir);
  seedReadings(dir, GREEN);
  const ticketsDir = path.join(dir, '.claude', 'orchestra', 'tickets');
  fs.mkdirSync(ticketsDir, { recursive: true });
  fs.writeFileSync(path.join(ticketsDir, 'tickets.json'), '{ not valid json');
  const runtime = createRuntime({ projectDir: dir });
  const denied = runtime.gate(preEvent('TICKET=tkt-aa11bb22cc33dd44', 'builder', 'tu-1'));
  check('a corrupted store denies Pre, fail closed', denied.hookSpecificOutput && denied.hookSpecificOutput.permissionDecision === 'deny', JSON.stringify(denied));
}

// ==================================================== 6. nested spawn

section('6. Nested spawn (agent_id present on PreToolUse) always denies');

{
  const dir = tmpProject('bridge-nested-');
  writeManifest(dir);
  seedReadings(dir, GREEN);
  const runtime = createRuntime({ projectDir: dir });
  const result = runtime.dispatch(baseRequest());
  const nested = runtime.gate(preEvent('TICKET=' + result.tickets.implementation.id, 'builder', 'tu-n', { agent_id: 'some-subagent-id' }));
  check('nested spawn denies regardless of an otherwise-valid ticket', nested.hookSpecificOutput.permissionDecision === 'deny' && /nested spawn/.test(nested.hookSpecificOutput.permissionDecisionReason), JSON.stringify(nested));
}

// ==================================================== 7. Stop EXPIRED case

section('7. Stop: a LAUNCHED ticket the host does not list among background_tasks is EXPIRED, not blocked');

{
  const dir = tmpProject('bridge-expire-stop-');
  writeManifest(dir);
  seedReadings(dir, GREEN);
  const runtime = createRuntime({ projectDir: dir });
  const result = runtime.dispatch(baseRequest());
  const ticketId = result.tickets.implementation.id;
  const toolUseId = 'tu-orphan';
  runtime.gate(preEvent('TICKET=' + ticketId, 'builder', toolUseId));
  runtime.gate(postEvent(toolUseId, 'orphan-agent-id', RESOLVED_MODEL));

  const stopResult = runtime.gate(stopEvent(false, [])); // host reports NO running subagents at all
  check('Stop does not block on an orphaned LAUNCHED ticket', JSON.stringify(stopResult) === '{}', JSON.stringify(stopResult));

  const store = { dir: path.join(dir, '.claude', 'orchestra', 'tickets') };
  const after = T.get(store, ticketId);
  check('the orphaned ticket is EXPIRED', after.status === 'EXPIRED' && after.outcome.code === 'EXPIRED', JSON.stringify(after.outcome));
  check('the host-disagreement reason is recorded in attempts (expire() itself hardcodes its own outcome.reason)',
    after.attempts.some((a) => a.event === 'stop-host-disagreement' && a.reason === 'host reports no running subagent'), JSON.stringify(after.attempts));
}

// ==================================================== 8. generation invalidation

section('8. generationCheck(): a manifest generation ahead of the store invalidates every open ticket');

{
  const dir = tmpProject('bridge-gen-');
  writeManifest(dir);
  seedReadings(dir, GREEN);
  const runtime = createRuntime({ projectDir: dir });
  const result = runtime.dispatch(baseRequest());
  const ticketId = result.tickets.implementation.id;

  writeManifest(dir, { rosterGeneration: 5 });
  const runtime2 = createRuntime({ projectDir: dir });
  const r = runtime2.generationCheck();
  check('generationCheck() bumps the store to match an ahead manifest (looping — bumpGeneration only ever advances by one)', r.bumped === true && r.result.generation === 5, JSON.stringify(r));

  const store = { dir: path.join(dir, '.claude', 'orchestra', 'tickets') };
  check('the open ticket minted under the old generation is now INVALIDATED', T.get(store, ticketId).status === 'INVALIDATED');
}

// ==================================================== 9. P0_UNAVAILABLE

section('9. P0_UNAVAILABLE on missing readings — nothing written');

{
  const dir = tmpProject('bridge-p0-');
  writeManifest(dir);
  // no readings file at all
  const runtime = createRuntime({ projectDir: dir });
  const result = runtime.dispatch(baseRequest());
  check('dispatch() returns typed P0_UNAVAILABLE', result.ok === false && result.outcome === 'P0_UNAVAILABLE', JSON.stringify(result));
  check('no ticket store was created', !fs.existsSync(path.join(dir, '.claude', 'orchestra', 'tickets', 'tickets.json')));
  check('no routing event was written', !fs.existsSync(path.join(dir, '.claude', 'orchestra', 'tickets', 'routing.events.jsonl')));
}

// ==================================================== 10. INVALID_REQUEST

section('10. INVALID_REQUEST on a request carrying integrity_nonce (dispatch-request forbids it)');

{
  const dir = tmpProject('bridge-invalid-');
  writeManifest(dir);
  seedReadings(dir, GREEN);
  const runtime = createRuntime({ projectDir: dir });
  const result = runtime.dispatch(baseRequest({ integrity_nonce: 'deadbeefdeadbeef' }));
  check('dispatch() refuses a request carrying integrity_nonce', result.ok === false && result.outcome === 'INVALID_REQUEST', JSON.stringify(result));
}

// ==================================================== 11. Q0 companion ordering

section('11. Q0 companion: two tickets issued; the implementation is unusable until the Q0 ticket is LAUNCHED');

{
  const dir = tmpProject('bridge-q0-');
  writeManifest(dir);
  seedReadings(dir, GREEN);
  const runtime = createRuntime({ projectDir: dir });
  // touches:['auth'] forces the Q0 touch trigger regardless of nominal tier.
  const result = runtime.dispatch(baseRequest({ risk: 'T2', touches: ['auth'] }));
  check('dispatch() issues a Q0 companion ticket', result.ok === true && !!result.tickets.q0, JSON.stringify(result));
  if (result.ok && result.tickets.q0) {
    const implId = result.tickets.implementation.id;
    const q0Id = result.tickets.q0.id;

    const blocked = runtime.gate(preEvent('TICKET=' + implId, result.spawn.subagent_type, 'tu-impl'));
    check('the implementation ticket refuses consume before its Q0 has LAUNCHED', blocked.hookSpecificOutput.permissionDecision === 'deny' && /requires Q0 ticket/.test(blocked.hookSpecificOutput.permissionDecisionReason), JSON.stringify(blocked));

    const q0Store = { dir: path.join(dir, '.claude', 'orchestra', 'tickets') };
    const q0Role = T.get(q0Store, q0Id).role;
    const q0Pre = runtime.gate(preEvent('TICKET=' + q0Id, q0Role, 'tu-q0'));
    check('the Q0 ticket itself consumes normally', q0Pre.hookSpecificOutput.permissionDecision === 'allow', JSON.stringify(q0Pre));
    runtime.gate(postEvent('tu-q0', 'q0-agent-id', 'gpt-5.6-terra'));

    const allowedNow = runtime.gate(preEvent('TICKET=' + implId, result.spawn.subagent_type, 'tu-impl-2'));
    check('once the Q0 ticket is LAUNCHED, the implementation ticket consumes', allowedNow.hookSpecificOutput.permissionDecision === 'allow', JSON.stringify(allowedNow));
  }
}

// ==================================================== 12. DISABLED seat

section('12. DISABLED seat passes through with the router\'s fallback text');

{
  const dir = tmpProject('bridge-disabled-');
  writeManifest(dir, { seats: { Architect: false } });
  seedReadings(dir, GREEN);
  const runtime = createRuntime({ projectDir: dir });
  const result = runtime.dispatch(baseRequest({ class: 'A0', risk: 'T1' }));
  check('a disabled seat returns typed DISABLED with a fallback', result.ok === false && result.outcome === 'DISABLED' && typeof result.fallback === 'string', JSON.stringify(result));
}

console.log('\n' + passes + ' passed, ' + failures + ' failed.');
