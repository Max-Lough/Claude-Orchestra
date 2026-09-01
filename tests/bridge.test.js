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
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const MASTER = path.resolve(__dirname, '..');
const { createRuntime } = require(path.join(MASTER, 'bridge', 'runtime.js'));
const T = require(path.join(MASTER, 'router', 'tickets.js'));
const { pinFileFor, readTrustedManifest } = require(path.join(MASTER, 'bridge', 'manifest.js'));

// WO-14b leg 4b: every runtime here must resolve its owner pin from the SAME
// temp directory this suite writes pins into — set once, process-wide, so
// both in-process createRuntime() calls and the ticket-gate.js subprocess
// (section 4, which inherits process.env) agree on PIN_DIR.
const PIN_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-test-pins-'));
process.env.ORCHESTRA_PIN_DIR = PIN_DIR;
process.on('exit', () => { try { fs.rmSync(PIN_DIR, { recursive: true, force: true }); } catch (_) { /* best effort */ } });

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
// WO-14b leg 4b: writes a PIN matching the manifest's own bytes hash
// alongside it, so every existing section below (all written against
// writeManifest()) keeps behaving exactly as it did before the pin
// requirement landed — trusted:true, roster/rosterGeneration/seats read
// from the manifest. Sections 13/14 test the pin mechanism itself and
// deliberately do NOT go through this helper unmodified (see there).
function writePin(dir, manifest, overrides) {
  const manifestPath = path.join(dir, '.claude', 'orchestra.json');
  const manifestSha256 = crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex');
  const pin = Object.assign(
    {
      projectDir: dir,
      manifestSha256,
      roster: manifest.roster,
      rosterGeneration: manifest.rosterGeneration,
      seats: manifest.seats,
      writtenAt: new Date().toISOString(),
      by: 'bridge.test.js fixture',
    },
    overrides || {}
  );
  const pinPath = pinFileFor(dir);
  fs.mkdirSync(path.dirname(pinPath), { recursive: true });
  fs.writeFileSync(pinPath, JSON.stringify(pin, null, 2));
  return pin;
}

// WO-14b leg 4 fix round (item 9): the runtime never auto-initialises a
// missing store — bridge/cli.js's `init-store` (called by install.js on a
// real --roster new) is now the only lawful way to create one. Every
// fixture below that expects dispatch()/gate() to actually route must
// create the store explicitly, exactly like a real installed project would;
// tests that specifically exercise a missing/corrupted store (section 5,
// and the new item-9 section) skip or undo this on purpose.
function initStore(dir) {
  return T.createTicketStore({ dir: path.join(dir, '.claude', 'orchestra', 'tickets'), init: true });
}

function writeManifest(dir, overrides) {
  const manifest = Object.assign({ roster: 'new', rosterGeneration: 1, seats: {} }, overrides || {});
  fs.writeFileSync(path.join(dir, '.claude', 'orchestra.json'), JSON.stringify(manifest, null, 2));
  writePin(dir, manifest);
  initStore(dir);
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
// Pre-existing flakiness fix (found while adding sections 13/14): class E2 at
// risk T1 is castings.json's own Q0 CALIBRATION SAMPLE (q0Triggers.
// calibrationSample: rate 0.25, riskTiers:['T1'], classes:['E2','E5','E6']) —
// router.js mints a fresh integrity_nonce per dispatch() and rolls it, so an
// "ordinary" E2/T1 request randomly (genuinely ~25% per call, keyed on the
// router's own nonce, not this file's) comes back carrying a Q0 companion the
// implementation ticket then can't consume until the Q0 is LAUNCHED — which
// every section here that expects a PLAIN, Q0-free happy path (2, 3, 7, 14)
// neither sets up nor wants. class E1 dispatches through the identical
// Builder role (router.js's own comment: "E0/E1/E3/E5/E6/E8 still trigger
// exactly as before ... through Builder via mergedClasses") but sits outside
// every q0Triggers list (classes/riskTiers/calibrationSample.classes), so at
// risk T1 it is DETERMINISTICALLY never Q0-required — verified empirically
// against router.js directly (20/20 runs, zero Q0) before landing this fix.
// Section 11 (the dedicated Q0 test) sets touches:['auth'] itself and does
// not use this default.
function baseRequest(overrides) {
  return Object.assign({ class: 'E1', risk: 'T1', goal: 'fix the thing', acceptance_criteria: ['tests pass'] }, overrides || {});
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
  // WO-14b leg 4 fix round (item 1 pin): class E1 is Builder's bounded tier
  // (router/castings.json mergedClasses.E1), whose preferred rung is
  // OpenAI Luna — on a Green pool that is exactly what gets served, so the
  // installed launcher the SERVED casting selects is builder-openai, never
  // the fixed 'builder' name a vendor-blind mapping used to return.
  check('spawn.subagent_type follows the SERVED casting (Green E1 -> Luna -> builder-openai)',
    result.ok && result.spawn.subagent_type === 'builder-openai' && result.casting.casting.vendor === 'openai' && result.casting.casting.model === 'GPT-5.6 Luna',
    result.ok && JSON.stringify({ subagent_type: result.spawn.subagent_type, casting: result.casting.casting }));
  check('spawn.prompt_header carries TICKET=/MODEL=/EFFORT=/ROLE=/NONCE= (PL-19b)',
    result.ok && result.spawn.prompt_header.startsWith(
      'TICKET=' + result.tickets.implementation.id + '\n' +
      'MODEL=' + result.casting.casting.model + '\n' +
      'EFFORT=' + result.casting.casting.effort + '\n' +
      'ROLE=' + result.spawn.subagent_type + '\n' +
      'NONCE=') && /NONCE=[0-9a-f]{16}\n$/.test(result.spawn.prompt_header),
    result.ok && result.spawn.prompt_header);

  const ticketId = result.tickets.implementation.id;
  const toolUseId = 'toolu_01AuYt3hjvYc2Yws8FZriovJ';

  const pre = runtime.gate(preEvent('TICKET=' + ticketId, result.spawn.subagent_type, toolUseId));
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

  const first = runtime.gate(preEvent('TICKET=' + ticketId, result.spawn.subagent_type, 'tu-c'));
  check('first legitimate consume allows', first.hookSpecificOutput.permissionDecision === 'allow', JSON.stringify(first));
  const replay = runtime.gate(preEvent('TICKET=' + ticketId, result.spawn.subagent_type, 'tu-d'));
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
  runtime.gate(preEvent('TICKET=' + ticketId, result.spawn.subagent_type, toolUseId));
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
  // writeManifest() now explicitly init-stores the fixture (item 9 — the
  // runtime itself never does), so the store file legitimately exists here;
  // what P0_UNAVAILABLE must still prove is that dispatch() issued nothing.
  check('no ticket was issued into the (pre-existing, fixture-created) store', openTicketsCount(dir) === 0 && T.list({ dir: path.join(dir, '.claude', 'orchestra', 'tickets') }).length === 0);
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

// ==================================================== 10b. COMPUTED_CASTING (PL-12)

section('10b. COMPUTED_CASTING on a direct R0 dispatch — typed outcome, nothing issued (PL-12, shakedown finding #5)');

{
  const dir = tmpProject('bridge-r0-');
  writeManifest(dir);
  seedReadings(dir, GREEN);
  const runtime = createRuntime({ projectDir: dir });
  let result;
  let threw = null;
  try {
    result = runtime.dispatch(baseRequest({ class: 'R0', goal: 'review the mortar VFX change' }));
  } catch (e) {
    threw = e;
  }
  check('dispatch() of class R0 does not throw', threw === null, threw && threw.message);
  check('dispatch() returns typed COMPUTED_CASTING', !!result && result.ok === false && result.outcome === 'COMPUTED_CASTING', JSON.stringify(result));
  check('the reason points at orchestra_close', !!result && /orchestra_close/.test(String(result.reason)), result && result.reason);
  check('no ticket was issued', openTicketsCount(dir) === 0 && T.list({ dir: path.join(dir, '.claude', 'orchestra', 'tickets') }).length === 0);
  const eventsFile = path.join(dir, '.claude', 'orchestra', 'tickets', 'routing.events.jsonl');
  const events = fs.existsSync(eventsFile) ? fs.readFileSync(eventsFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  check('the non-routing outcome is still logged as a routing event', events.length === 1 && events[0].outcome && events[0].outcome.outcome === 'COMPUTED_CASTING', JSON.stringify(events));
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

// ============ 13. WO-14b leg 4c: manifest claims new, NO pin -> UNTRUSTED-NEW, fail closed

section("13. Manifest pin verification — manifest claims roster:new, NO pin at all: UNTRUSTED-NEW, fail closed (never a silent legacy downgrade)");

{
  const dir = tmpProject('bridge-unpinned-');
  // roster:new written directly to disk, WITHOUT writePin() — this project
  // was never pinned by an installer (or the pin was lost/removed). Leg 4c
  // aligns this module to the guard's fix-2A rule: a manifest that CLAIMS
  // new must never be trusted just because its own pin is missing — the old
  // behaviour (silently forcing legacy) made "delete the pin" strictly
  // safer, for an attacker, than editing the manifest (every loosening key
  // would go with it). Forcing roster:'new' here, untrusted, fails
  // dispatch/gate/requireTicket CLOSED instead.
  fs.writeFileSync(path.join(dir, '.claude', 'orchestra.json'), JSON.stringify({ roster: 'new', rosterGeneration: 1, seats: {} }, null, 2));
  seedReadings(dir, GREEN);
  const runtime = createRuntime({ projectDir: dir });

  const doc = runtime.doctor();
  check("doctor() reports roster 'new' (forced, from the manifest's own claim — never a legacy downgrade)",
    doc.roster === 'new', JSON.stringify(doc));
  check("doctor() reports pin.trusted:false, reason:'installed roster:new project without a pin' (never 'unpinned') [round-3]",
    doc.pin.trusted === false && doc.pin.reason === 'installed roster:new project without a pin', JSON.stringify(doc.pin));
  check('doctor() pin.failClosed is true (roster:new + untrusted)',
    doc.pin.failClosed === true, JSON.stringify(doc.pin));

  const dispatchResult = runtime.dispatch(baseRequest());
  check('dispatch() refuses with typed MANIFEST_UNTRUSTED naming the reason',
    dispatchResult.ok === false && dispatchResult.outcome === 'MANIFEST_UNTRUSTED' &&
      dispatchResult.reason === 'installed roster:new project without a pin',
    JSON.stringify(dispatchResult));

  const pre = runtime.gate(preEvent('TICKET=tkt-aa11bb22cc33dd44', 'builder', 'tu-unpinned'));
  check('gate() DENIES PreToolUse(Agent) rather than standing down (fail closed, not inert)',
    pre.hookSpecificOutput && pre.hookSpecificOutput.permissionDecision === 'deny' &&
      /installed roster:new project without a pin/.test(pre.hookSpecificOutput.permissionDecisionReason),
    JSON.stringify(pre));
  const stop = runtime.gate(stopEvent(false, []));
  check('gate() BLOCKS Stop unconditionally (fail closed, not inert)',
    stop.decision === 'block' && /installed roster:new project without a pin/.test(stop.reason), JSON.stringify(stop));

  let threw = null;
  try { runtime.requireTicket({ id: 'tkt-aa11bb22cc33dd44', phase: 'exec' }); } catch (e) { threw = e; }
  check('requireTicket() throws TICKET_REQUIRED naming the untrusted manifest (never TICKET_NOT_REQUIRED)',
    threw && threw.code === 'TICKET_REQUIRED' && /installed roster:new project without a pin/.test(threw.message),
    threw && threw.code + ': ' + threw.message);
}

// ==================== 14. WO-14b leg 4b: pinned but tampered manifest -> UNTRUSTED, fail-closed

section('14. Manifest pin verification — pin present, manifest hash mismatch: UNTRUSTED and fail-closed under roster:new');

{
  const dir = tmpProject('bridge-untrusted-');
  writeManifest(dir); // roster:new, gen 1, hash-matching pin written
  seedReadings(dir, GREEN);

  // Issue a real ticket BEFORE tampering, exactly as an installed project
  // would have open tickets at the moment its manifest is corrupted/tampered.
  const trustedRuntime = createRuntime({ projectDir: dir });
  const preTamperDispatch = trustedRuntime.dispatch(baseRequest({ task_id: 'pre-tamper' }));
  check('dispatch() succeeds while still trusted (fixture sanity check)', preTamperDispatch.ok === true, JSON.stringify(preTamperDispatch));
  const ticketId = preTamperDispatch.tickets.implementation.id;

  // Tamper the LIVE manifest without updating the pin — the exact scenario
  // roster/wo14b-leg3-redteam-1.md's [HIGH] finding describes: an in-project
  // file an attacker (or corruption) can rewrite with nothing to detect it.
  fs.writeFileSync(path.join(dir, '.claude', 'orchestra.json'), JSON.stringify({ roster: 'new', rosterGeneration: 1, seats: { Architect: false } }, null, 2));

  const runtime = createRuntime({ projectDir: dir }); // a fresh runtime, as a fresh hook/MCP process would be

  const doc = runtime.doctor();
  check('doctor() reports roster new (from the PIN, not the tampered manifest)', doc.roster === 'new', JSON.stringify(doc));
  check('doctor() reports pin.trusted:false', doc.pin.trusted === false, JSON.stringify(doc.pin));
  check("doctor() reports reason 'manifest untrusted (hash mismatch)'", doc.pin.reason === 'manifest untrusted (hash mismatch)', JSON.stringify(doc.pin));
  check('doctor() reports pin.failClosed:true (roster:new + untrusted)', doc.pin.failClosed === true, JSON.stringify(doc.pin));

  const dispatchResult = runtime.dispatch(baseRequest({ task_id: 'post-tamper' }));
  check("dispatch() refuses with typed MANIFEST_UNTRUSTED, nothing routed",
    dispatchResult.ok === false && dispatchResult.outcome === 'MANIFEST_UNTRUSTED', JSON.stringify(dispatchResult));

  const preGate = runtime.gate(preEvent('TICKET=' + ticketId, 'builder', 'tu-untrusted'));
  check('gate() denies PreToolUse(Agent) even for a real, otherwise-valid ticket (fail-closed, not ticket-logic)',
    preGate.hookSpecificOutput && preGate.hookSpecificOutput.permissionDecision === 'deny' &&
      /manifest untrusted/.test(preGate.hookSpecificOutput.permissionDecisionReason),
    JSON.stringify(preGate));
  const stillOpen = T.get({ dir: path.join(dir, '.claude', 'orchestra', 'tickets') }, ticketId);
  check('the ticket itself is untouched by the fail-closed deny (stays OPEN)', stillOpen.status === 'OPEN', stillOpen.status);

  const stopGate = runtime.gate(stopEvent(false, []));
  check('gate() blocks Stop unconditionally under fail-closed (not open-ticket-driven)',
    stopGate.decision === 'block' && /manifest untrusted/.test(stopGate.reason), JSON.stringify(stopGate));

  let threw = null;
  try { runtime.requireTicket({ id: ticketId, phase: 'exec' }); } catch (e) { threw = e; }
  check('requireTicket() throws TICKET_REQUIRED naming the untrusted manifest (never consumes)',
    threw && threw.code === 'TICKET_REQUIRED' && /manifest untrusted/.test(threw.message), threw && threw.code + ': ' + threw.message);
  const stillOpen2 = T.get({ dir: path.join(dir, '.claude', 'orchestra', 'tickets') }, ticketId);
  check('...and the ticket is still OPEN after that refused requireTicket() call', stillOpen2.status === 'OPEN', stillOpen2.status);

  // Re-pinning (what install.js would do to legitimately re-trust a changed
  // manifest) restores normal operation.
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.claude', 'orchestra.json'), 'utf8'));
  writePin(dir, manifest);
  const restoredRuntime = createRuntime({ projectDir: dir });
  check('re-pinning restores trust: doctor() reports trusted:true again',
    restoredRuntime.doctor().pin.trusted === true, JSON.stringify(restoredRuntime.doctor().pin));
  check('...and dispatch() routes again (the newly-pinned seats: Architect disabled)',
    restoredRuntime.dispatch(baseRequest({ class: 'A0', risk: 'T1', task_id: 'post-repin' })).outcome === 'DISABLED');
}

// ==================== 14b. PL-15/PL-16: fail-closed still binds results and does not spin Stop

section('14b. Untrusted manifest with a LAUNCHED ticket — SubagentStop still binds the report (PL-15); Stop honors stop_hook_active (PL-16)');

{
  const dir = tmpProject('bridge-untrusted-bind-');
  writeManifest(dir);
  seedReadings(dir, GREEN);

  // Full trusted lifecycle up to LAUNCHED, exactly as order #3 stood when the
  // builder's branch checkout made the manifest untrusted mid-flight.
  const trusted = createRuntime({ projectDir: dir });
  const d = trusted.dispatch(baseRequest({ task_id: 'bind-under-mismatch' }));
  check('(setup) dispatch ok', d.ok === true, JSON.stringify(d));
  const ticketId = d.tickets.implementation.id;
  trusted.gate(preEvent('TICKET=' + ticketId, d.spawn.subagent_type, 'tu-14b'));
  trusted.gate(postEvent('tu-14b', AGENT_ID, RESOLVED_MODEL));
  const store = { dir: path.join(dir, '.claude', 'orchestra', 'tickets') };
  check('(setup) ticket LAUNCHED', T.get(store, ticketId).status === 'LAUNCHED', T.get(store, ticketId).status);

  // Tamper the manifest without re-pinning -> failClosed, fresh process.
  fs.writeFileSync(path.join(dir, '.claude', 'orchestra.json'), JSON.stringify({ roster: 'new', rosterGeneration: 1, seats: { Architect: false } }, null, 2));
  const runtime = createRuntime({ projectDir: dir });
  check('(setup) failClosed', runtime.doctor().pin.failClosed === true, JSON.stringify(runtime.doctor().pin));

  // PL-16: one block per stop gesture — a repeat under stop_hook_active passes.
  const firstStop = runtime.gate(stopEvent(false, []));
  check('Stop still blocks once under fail-closed', firstStop.decision === 'block' && /manifest untrusted/.test(firstStop.reason), JSON.stringify(firstStop));
  const repeatStop = runtime.gate(stopEvent(true, []));
  check('Stop with stop_hook_active:true returns {} under fail-closed (no spin loop)', JSON.stringify(repeatStop) === '{}', JSON.stringify(repeatStop));

  // PL-15: the real report arrives while untrusted — it must still bind.
  const bind = runtime.gate(subagentStopEvent(AGENT_ID, 'STATUS: DONE\nREAL-REPORT', AGENT_TRANSCRIPT_PATH));
  check('SubagentStop returns {} under fail-closed', JSON.stringify(bind) === '{}', JSON.stringify(bind));
  const after = T.get(store, ticketId);
  check('the report is bound: ticket RESOLVED with the real message (PL-15)',
    after.status === 'RESOLVED' && after.resolved.last_assistant_message === 'STATUS: DONE\nREAL-REPORT',
    after.status + ' | ' + (after.resolved && after.resolved.last_assistant_message));
  check('PreToolUse(Agent) still denies under fail-closed (binding grants no authority)',
    (() => { const g = runtime.gate(preEvent('TICKET=' + ticketId, 'builder', 'tu-14b2')); return g.hookSpecificOutput && g.hookSpecificOutput.permissionDecision === 'deny'; })());
}

// ============ 15. manifest present but claims legacy, NO pin -> unpinned legacy, inert

section("15. Manifest pin verification — manifest present but claims roster:legacy (or omits it), NO pin: unpinned legacy, gate stays inert");

{
  const dir = tmpProject('bridge-unpinned-legacy-');
  fs.writeFileSync(path.join(dir, '.claude', 'orchestra.json'), JSON.stringify({ roster: 'legacy' }, null, 2));
  seedReadings(dir, GREEN);
  const runtime = createRuntime({ projectDir: dir });

  const doc = runtime.doctor();
  check("doctor() reports roster 'legacy'", doc.roster === 'legacy', JSON.stringify(doc));
  check("doctor() reports pin.trusted:false, reason:'unpinned'",
    doc.pin.trusted === false && doc.pin.reason === 'unpinned', JSON.stringify(doc.pin));
  check('doctor() pin.failClosed is false (roster is legacy, never fail-closed)', doc.pin.failClosed === false, JSON.stringify(doc.pin));

  check('dispatch() refuses (roster reads as legacy, not new)', runtime.dispatch(baseRequest()).outcome === 'INVALID_REQUEST');
  check('gate() is inert for PreToolUse(Agent)',
    JSON.stringify(runtime.gate(preEvent('TICKET=tkt-aa11bb22cc33dd44', 'builder', 'tu-1'))) === JSON.stringify({ inert: true }));
}

// ============ 16. corrupt pin file -> UNTRUSTED, roster forced 'new', never 'unpinned'

section("16. Manifest pin verification — a pin FILE exists but is corrupt/unparseable: UNTRUSTED, roster forced 'new' (never collapses to 'unpinned')");

{
  const dir = tmpProject('bridge-corruptpin-');
  // No manifest at all — the corrupt pin alone must still force roster:'new'
  // untrusted rather than "no pin" (which would read as legacy/inert).
  const pinPath = pinFileFor(dir);
  fs.mkdirSync(path.dirname(pinPath), { recursive: true });
  fs.writeFileSync(pinPath, '{ not valid json');
  const runtime = createRuntime({ projectDir: dir });

  const doc = runtime.doctor();
  check("doctor() reports roster 'new' (forced by the corrupt pin's mere existence)", doc.roster === 'new', JSON.stringify(doc));
  check("doctor() reports reason:'corrupt pin' (never 'unpinned')", doc.pin.reason === 'corrupt pin', JSON.stringify(doc.pin));
  check('doctor() pin.failClosed is true', doc.pin.failClosed === true, JSON.stringify(doc.pin));

  const pre = runtime.gate(preEvent('TICKET=tkt-aa11bb22cc33dd44', 'builder', 'tu-corrupt'));
  check('gate() denies PreToolUse(Agent)',
    pre.hookSpecificOutput && pre.hookSpecificOutput.permissionDecision === 'deny' &&
      /corrupt pin/.test(pre.hookSpecificOutput.permissionDecisionReason),
    JSON.stringify(pre));
}

// ============ 17. forged pin (path-keyed, projectDir mismatch) -> UNTRUSTED, roster forced 'new'

section("17. Manifest pin verification — a pin found by the PATH key whose own projectDir names a different project: FORGED, UNTRUSTED, roster forced 'new'");

{
  const dir = tmpProject('bridge-forgedpin-');
  fs.writeFileSync(path.join(dir, '.claude', 'orchestra.json'), JSON.stringify({ roster: 'legacy' }, null, 2));
  const pinPath = pinFileFor(dir);
  fs.mkdirSync(path.dirname(pinPath), { recursive: true });
  fs.writeFileSync(pinPath, JSON.stringify({
    projectDir: 'C:/somewhere/else/entirely', manifestSha256: 'a'.repeat(64), roster: 'legacy',
    rosterGeneration: 1, writtenAt: new Date().toISOString(), by: 'ATTACKER',
  }));
  const runtime = createRuntime({ projectDir: dir });

  const doc = runtime.doctor();
  check("doctor() reports roster 'new' (forced by the forged pin) even though both the manifest and the pin's own roster field claim legacy",
    doc.roster === 'new', JSON.stringify(doc));
  check("doctor() reports reason:'pin projectDir does not match this project'",
    doc.pin.reason === 'pin projectDir does not match this project', JSON.stringify(doc.pin));
  check('doctor() pin.failClosed is true', doc.pin.failClosed === true, JSON.stringify(doc.pin));
}

// ============ 18. ORCHESTRA_PIN_DIR pointing at a nonexistent directory -> "no pin dir"

section("18. Manifest pin verification — ORCHESTRA_PIN_DIR pointing at a nonexistent directory is treated as 'no pin dir', same as none configured");

{
  const dir = tmpProject('bridge-nopindir-');
  fs.writeFileSync(path.join(dir, '.claude', 'orchestra.json'), JSON.stringify({ roster: 'new', rosterGeneration: 1, seats: {} }, null, 2));
  seedReadings(dir, GREEN);
  const savedPinDir = process.env.ORCHESTRA_PIN_DIR;
  process.env.ORCHESTRA_PIN_DIR = path.join(os.tmpdir(), 'orchestra-pin-dir-does-not-exist-' + crypto.randomBytes(4).toString('hex'));
  let doc;
  try {
    const runtime = createRuntime({ projectDir: dir });
    doc = runtime.doctor();
  } finally {
    process.env.ORCHESTRA_PIN_DIR = savedPinDir;
  }
  check('a nonexistent ORCHESTRA_PIN_DIR combined with a manifest claiming new -> UNTRUSTED-NEW (same as no pin dir configured at all)',
    doc.roster === 'new' && doc.pin.trusted === false && doc.pin.reason === 'installed roster:new project without a pin',
    JSON.stringify(doc));
}

// ============ 19. moved project (id-keyed pin), hash matches -> trusted

section("19. Manifest pin verification — moved project: a pin found by id key, trusted iff the manifest hash matches, reason carries 'project moved since pinning'");

{
  const oldDir = tmpProject('bridge-moved-old-');
  const newDir = tmpProject('bridge-moved-new-');
  const projectId = 'stable-project-id-leg4c-' + crypto.randomBytes(4).toString('hex');
  const manifestObj = { roster: 'new', rosterGeneration: 1, seats: {}, projectId };
  const manifestBytes = Buffer.from(JSON.stringify(manifestObj, null, 2));
  fs.writeFileSync(path.join(newDir, '.claude', 'orchestra.json'), manifestBytes);
  seedReadings(newDir, GREEN);
  initStore(newDir); // item 9: dispatch() below needs an explicitly-created store

  // The pin was minted while the project lived at oldDir — its projectDir
  // names the OLD path, stored under the id key (what install.js's --repin
  // would do for a project it recognizes has moved).
  const idHash = crypto.createHash('sha256').update(projectId, 'utf8').digest('hex');
  const idPinPath = path.join(PIN_DIR, 'id-' + idHash + '.json');
  fs.writeFileSync(idPinPath, JSON.stringify({
    projectDir: fs.realpathSync(oldDir), manifestSha256: crypto.createHash('sha256').update(manifestBytes).digest('hex'),
    roster: 'new', rosterGeneration: 1, seats: {}, writtenAt: new Date().toISOString(), by: 'install.js',
  }));

  const runtime = createRuntime({ projectDir: newDir });
  const doc = runtime.doctor();
  check('a moved project (pin found by id, hash matches) is TRUSTED', doc.pin.trusted === true, JSON.stringify(doc.pin));
  check("doctor() reason carries 'project moved since pinning'", doc.pin.reason === 'project moved since pinning', JSON.stringify(doc.pin));
  check('doctor() pin.failClosed is false (trusted)', doc.pin.failClosed === false, JSON.stringify(doc.pin));
  check('dispatch() routes normally despite the move', runtime.dispatch(baseRequest()).ok === true);
}

// ============ 20. moved project, manifest ALSO tampered since the move -> UNTRUSTED, both notes

section("20. Manifest pin verification — moved project whose manifest was ALSO tampered since the move: UNTRUSTED, reason names both the hash mismatch and the move");

{
  const oldDir = tmpProject('bridge-moved-tampered-old-');
  const newDir = tmpProject('bridge-moved-tampered-new-');
  const projectId = 'stable-project-id-leg4c-tampered-' + crypto.randomBytes(4).toString('hex');
  fs.writeFileSync(path.join(newDir, '.claude', 'orchestra.json'), JSON.stringify({ roster: 'new', rosterGeneration: 1, seats: { Architect: false }, projectId }, null, 2));

  const idHash = crypto.createHash('sha256').update(projectId, 'utf8').digest('hex');
  const idPinPath = path.join(PIN_DIR, 'id-' + idHash + '.json');
  fs.writeFileSync(idPinPath, JSON.stringify({
    projectDir: fs.realpathSync(oldDir), manifestSha256: 'f'.repeat(64), // deliberately wrong
    roster: 'new', rosterGeneration: 1, seats: {}, writtenAt: new Date().toISOString(), by: 'install.js',
  }));

  const runtime = createRuntime({ projectDir: newDir });
  const doc = runtime.doctor();
  check('a moved project whose manifest hash does not match the pin is UNTRUSTED', doc.pin.trusted === false, JSON.stringify(doc.pin));
  check('reason names both the hash mismatch and the move',
    /manifest untrusted \(hash mismatch\)/.test(doc.pin.reason) && /project moved since pinning/.test(doc.pin.reason), doc.pin.reason);
  check('doctor() pin.failClosed is true (roster:new + untrusted)', doc.pin.failClosed === true, JSON.stringify(doc.pin));
}

// ============ 21. Rider 2 (round-3): roster:new fingerprint via .claude/orchestra/, no roster field at all

section('21. Rider 2 round-3 — roster:new fingerprint via .claude/orchestra/ (a populated substrate dir, e.g. router/), manifest omits `roster` entirely, no pin: UNTRUSTED-NEW');

{
  const dir = tmpProject('bridge-fingerprint-dir-');
  // A real install populates .claude/orchestra/ with substrate directories
  // (router/, registry/, verifier/, quartermaster/, bridge/). The ticket
  // bridge runtime itself lazily creates only a `tickets/` subdirectory
  // there as an operational side effect (doctor()/dispatch() -> getStore())
  // — that side effect must never itself count as the fingerprint (a plain
  // legacy project whose doctor()/gate() merely got called once would
  // otherwise flip roster:new on its very next read — see the second half
  // of this section).
  fs.mkdirSync(path.join(dir, '.claude', 'orchestra', 'router'), { recursive: true });
  // Deliberately no orchestra.json at all — the fingerprint must be detected
  // from the directory alone, independent of any manifest field.
  const state = readTrustedManifest({ projectDir: dir });
  check('fingerprint via a populated .claude/orchestra/ forces UNTRUSTED-NEW',
    state.trusted === false && state.roster === 'new' && state.reason === 'installed roster:new project without a pin',
    JSON.stringify(state));
  check('moved is false (no pin at all)', state.moved === false, JSON.stringify(state));

  // The runtime's OWN `.claude/orchestra/tickets/` side effect, alone, must
  // NOT be read as a fingerprint (self-poisoning guard).
  const dirTicketsOnly = tmpProject('bridge-fingerprint-ticketsonly-');
  fs.mkdirSync(path.join(dirTicketsOnly, '.claude', 'orchestra', 'tickets'), { recursive: true });
  const stateTicketsOnly = readTrustedManifest({ projectDir: dirTicketsOnly });
  check('.claude/orchestra/tickets/ alone (the runtime\'s own side effect) is NOT a roster:new fingerprint',
    stateTicketsOnly.roster === 'legacy' && stateTicketsOnly.reason === 'unpinned', JSON.stringify(stateTicketsOnly));
}

// ============ 22. Rider 2 (round-3): fingerprint via ORCHESTRA-CONDUCTOR.md alone

section('22. Rider 2 round-3 — roster:new fingerprint via .claude/ORCHESTRA-CONDUCTOR.md alone, no pin: UNTRUSTED-NEW');

{
  const dir = tmpProject('bridge-fingerprint-conductor-');
  fs.writeFileSync(path.join(dir, '.claude', 'ORCHESTRA-CONDUCTOR.md'), '# conductor\n');
  const state = readTrustedManifest({ projectDir: dir });
  check('fingerprint via ORCHESTRA-CONDUCTOR.md alone forces UNTRUSTED-NEW',
    state.trusted === false && state.roster === 'new' && state.reason === 'installed roster:new project without a pin',
    JSON.stringify(state));
}

// ============ 23. Rider 2 (round-3): fingerprint via a non-core file under .claude/agents/

section('23. Rider 2 round-3 — roster:new fingerprint via a roster role file under .claude/agents/ (not one of the core six), no pin: UNTRUSTED-NEW');

{
  const dir = tmpProject('bridge-fingerprint-agents-');
  fs.mkdirSync(path.join(dir, '.claude', 'agents'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'agents', 'architect.md'), '# architect\n');
  const state = readTrustedManifest({ projectDir: dir });
  check('fingerprint via a roster role file forces UNTRUSTED-NEW',
    state.trusted === false && state.roster === 'new' && state.reason === 'installed roster:new project without a pin',
    JSON.stringify(state));

  const dirCore = tmpProject('bridge-corefiles-only-');
  fs.mkdirSync(path.join(dirCore, '.claude', 'agents'), { recursive: true });
  fs.writeFileSync(path.join(dirCore, '.claude', 'agents', 'scout.md'), '# scout\n');
  fs.writeFileSync(path.join(dirCore, '.claude', 'agents', 'reviewer.md'), '# reviewer\n');
  const stateCore = readTrustedManifest({ projectDir: dirCore });
  check('the core six alone (e.g. scout.md, reviewer.md) is NOT a roster:new fingerprint',
    stateCore.roster === 'legacy' && stateCore.reason === 'unpinned', JSON.stringify(stateCore));
}

// ============ 24. Rider 2 (round-3): installedPermissions/installedDeny alone are NOT a fingerprint (legacy installs write these too)

section('24. Rider 2 round-3 — installedPermissions/installedDeny alone must NOT be read as a roster:new fingerprint (legacy installs also write them)');

{
  const dir = tmpProject('bridge-legacy-perms-');
  fs.writeFileSync(path.join(dir, '.claude', 'orchestra.json'), JSON.stringify({
    roster: 'legacy', installedPermissions: [{ file: 'settings.json', entry: 'Bash(git:*)' }], installedDeny: [{ file: 'settings.json', entry: 'Bash(rm:*)' }],
  }, null, 2));
  const state = readTrustedManifest({ projectDir: dir });
  check('installedPermissions/installedDeny alone -> still plain unpinned legacy, not UNTRUSTED-NEW',
    state.roster === 'legacy' && state.trusted === false && state.reason === 'unpinned', JSON.stringify(state));
}

// ============ 25. Rider 2 (round-3): strict pin schema — each way a pin can be invalid

section('25. Rider 2 round-3 — strict pin schema: each malformed field makes the pin invalid (never partially trusted)');

{
  const base = (dir, manifestPath) => {
    const manifestSha256 = crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex');
    return { projectDir: dir, manifestSha256, roster: 'new', rosterGeneration: 1, writtenAt: new Date().toISOString(), by: 'install.js' };
  };
  const cases = [
    ['manifestSha256 uppercase hex (case-sensitive comparison rejects it)', (p) => { p.manifestSha256 = p.manifestSha256.toUpperCase(); }],
    ['manifestSha256 wrong length', (p) => { p.manifestSha256 = 'ab12'; }],
    ['roster outside the enum', (p) => { p.roster = 'newish'; }],
    ['rosterGeneration not an integer', (p) => { p.rosterGeneration = 1.5; }],
    ['rosterGeneration negative', (p) => { p.rosterGeneration = -1; }],
    ['rosterGeneration missing', (p) => { delete p.rosterGeneration; }],
    ['writtenAt not a valid date', (p) => { p.writtenAt = 'not-a-date'; }],
    ['writtenAt missing', (p) => { delete p.writtenAt; }],
    ['by missing', (p) => { delete p.by; }],
    ['projectDir not a string', (p) => { p.projectDir = 12345; }],
  ];
  for (const [label, mutate] of cases) {
    const dir = tmpProject('bridge-invalidpin-');
    fs.writeFileSync(path.join(dir, '.claude', 'orchestra.json'), JSON.stringify({ roster: 'new', rosterGeneration: 1, seats: {} }, null, 2));
    const pin = base(dir, path.join(dir, '.claude', 'orchestra.json'));
    mutate(pin);
    const pinPath = pinFileFor(dir);
    fs.mkdirSync(path.dirname(pinPath), { recursive: true });
    fs.writeFileSync(pinPath, JSON.stringify(pin));
    const state = readTrustedManifest({ projectDir: dir });
    check('invalid pin (' + label + ') -> untrusted-new, never partially trusted',
      state.trusted === false && state.roster === 'new' && state.reason === 'corrupt pin', JSON.stringify(state));
  }
  // The control: the same shape, unmutated, IS valid.
  const okDir = tmpProject('bridge-validpin-control-');
  fs.writeFileSync(path.join(okDir, '.claude', 'orchestra.json'), JSON.stringify({ roster: 'new', rosterGeneration: 1, seats: {} }, null, 2));
  const okPin = base(okDir, path.join(okDir, '.claude', 'orchestra.json'));
  const okPinPath = pinFileFor(okDir);
  fs.mkdirSync(path.dirname(okPinPath), { recursive: true });
  fs.writeFileSync(okPinPath, JSON.stringify(okPin));
  const okState = readTrustedManifest({ projectDir: okDir });
  check('control: the same shape, unmutated, is a VALID pin -> trusted', okState.trusted === true, JSON.stringify(okState));
}

// ============ 26. Rider 2 (round-3): third lookup key — git-<sha256(root commit)>.json

section('26. Rider 2 round-3 — third pin lookup key: git-<sha256(root commit)>.json, tried after path and id both miss');

{
  const dir = tmpProject('bridge-gitkey-');
  spawnSync('git', ['init', '-q', dir]);
  spawnSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  spawnSync('git', ['-C', dir, 'config', 'user.name', 'test']);
  fs.writeFileSync(path.join(dir, '.gitkeep'), '');
  spawnSync('git', ['-C', dir, 'add', '.']);
  spawnSync('git', ['-C', dir, 'commit', '-q', '-m', 'root']);
  const rootRev = spawnSync('git', ['-C', dir, 'rev-list', '--max-parents=0', 'HEAD'], { encoding: 'utf8' });
  const rootSha = String(rootRev.stdout || '').split('\n')[0].trim();
  check('fixture sanity: root commit resolved', /^[0-9a-f]{7,40}$/i.test(rootSha), rootSha);

  const manifestObj = { roster: 'new', rosterGeneration: 1, seats: {} };
  fs.writeFileSync(path.join(dir, '.claude', 'orchestra.json'), JSON.stringify(manifestObj, null, 2));
  seedReadings(dir, GREEN);
  const manifestSha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, '.claude', 'orchestra.json'))).digest('hex');

  const gitPinHash = crypto.createHash('sha256').update(rootSha, 'utf8').digest('hex');
  const gitPinPath = path.join(PIN_DIR, 'git-' + gitPinHash + '.json');
  // Same projectDir as `dir` — path key would normally hit first; write it
  // ONLY under the git key to prove the git-key lookup itself resolves and
  // is honoured (path/id both absent for this project).
  fs.writeFileSync(gitPinPath, JSON.stringify({
    projectDir: fs.realpathSync(dir), manifestSha256, roster: 'new', rosterGeneration: 1, writtenAt: new Date().toISOString(), by: 'install.js',
  }));

  const state = readTrustedManifest({ projectDir: dir });
  check('a pin resolvable only by the git-root key is honoured -> trusted, not moved (projectDir agrees)',
    state.trusted === true && state.moved === false, JSON.stringify(state));
}

// ============ 27. Rider 2 (round-3): git-keyed pin with a differing projectDir -> moved:true, trusted iff hash matches

section('27. Rider 2 round-3 — git-keyed pin whose own projectDir differs from the current project: moved:true, trusted iff the manifest hash still matches');

{
  const oldDir = tmpProject('bridge-gitmoved-old-');
  const newDir = tmpProject('bridge-gitmoved-new-');
  spawnSync('git', ['init', '-q', newDir]);
  spawnSync('git', ['-C', newDir, 'config', 'user.email', 'test@example.com']);
  spawnSync('git', ['-C', newDir, 'config', 'user.name', 'test']);
  fs.writeFileSync(path.join(newDir, '.gitkeep'), '');
  spawnSync('git', ['-C', newDir, 'add', '.']);
  spawnSync('git', ['-C', newDir, 'commit', '-q', '-m', 'root']);
  const rootRev = spawnSync('git', ['-C', newDir, 'rev-list', '--max-parents=0', 'HEAD'], { encoding: 'utf8' });
  const rootSha = String(rootRev.stdout || '').split('\n')[0].trim();

  const manifestObj = { roster: 'new', rosterGeneration: 1, seats: {} };
  fs.writeFileSync(path.join(newDir, '.claude', 'orchestra.json'), JSON.stringify(manifestObj, null, 2));
  seedReadings(newDir, GREEN);
  const manifestSha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(newDir, '.claude', 'orchestra.json'))).digest('hex');

  const gitPinHash = crypto.createHash('sha256').update(rootSha, 'utf8').digest('hex');
  const gitPinPath = path.join(PIN_DIR, 'git-' + gitPinHash + '.json');
  fs.writeFileSync(gitPinPath, JSON.stringify({
    projectDir: fs.realpathSync(oldDir), manifestSha256, roster: 'new', rosterGeneration: 1, writtenAt: new Date().toISOString(), by: 'install.js',
  }));

  const state = readTrustedManifest({ projectDir: newDir });
  check('git-keyed pin with a differing projectDir, hash MATCHES -> trusted:true, moved:true',
    state.trusted === true && state.moved === true, JSON.stringify(state));

  // Now the same setup but the manifest bytes no longer match the pin.
  fs.writeFileSync(path.join(newDir, '.claude', 'orchestra.json'), JSON.stringify({ roster: 'new', rosterGeneration: 1, seats: { Architect: false } }, null, 2));
  const state2 = readTrustedManifest({ projectDir: newDir });
  check('git-keyed pin with a differing projectDir, hash MISMATCHES -> trusted:false, moved:true (still exposed)',
    state2.trusted === false && state2.moved === true, JSON.stringify(state2));
}

// ============ 28. item 6: `medium` survives into the canonical order — M0 UNAVAILABLE

section('28. WO-14b leg 4 fix round item 6: medium reaches the canonical order — M0 videoAudio -> typed UNAVAILABLE');

{
  const dir = tmpProject('bridge-medium-');
  writeManifest(dir);
  seedReadings(dir, GREEN);
  const runtime = createRuntime({ projectDir: dir });
  const result = runtime.dispatch(baseRequest({ class: 'M0', risk: 'T1', medium: 'videoAudio' }));
  check('M0 + medium:videoAudio -> typed UNAVAILABLE through orchestra_dispatch (not routed as an ordinary Investigator ticket)',
    result.ok === false && result.outcome === 'UNAVAILABLE', JSON.stringify(result));
}

// ============ 29. item 8: config_hash checked at consume — a changed manifest invalidates an open ticket

section('29. WO-14b leg 4 fix round item 8: config_hash mismatch at consume -> CONFIG_CHANGED, ticket INVALIDATED');

{
  const dir = tmpProject('bridge-confighash-');
  writeManifest(dir);
  seedReadings(dir, GREEN);
  const runtime = createRuntime({ projectDir: dir });
  const result = runtime.dispatch(baseRequest());
  const ticketId = result.tickets.implementation.id;

  // Rewrite the manifest WITHOUT bumping rosterGeneration — configHash()
  // covers castings+aliases+MANIFEST BYTES, so any manifest edit changes it
  // even when generation stays put (the generationCheck()/bumpGeneration()
  // path is a different guard, exercised separately by section 8/3).
  writeManifest(dir, { seats: { Sweeper: true } });
  const runtime2 = createRuntime({ projectDir: dir });
  const denied = runtime2.gate(preEvent('TICKET=' + ticketId, result.spawn.subagent_type, 'tu-confighash'));
  check('a ticket whose config_hash no longer matches the live configuration is denied CONFIG_CHANGED',
    denied.hookSpecificOutput && denied.hookSpecificOutput.permissionDecision === 'deny' &&
      /CONFIG_CHANGED/.test(denied.hookSpecificOutput.permissionDecisionReason),
    JSON.stringify(denied));
  const store = { dir: path.join(dir, '.claude', 'orchestra', 'tickets') };
  check('the ticket is INVALIDATED (never silently left OPEN/CONSUMED against stale config)',
    T.get(store, ticketId).status === 'INVALIDATED', T.get(store, ticketId).status);
}

// ============ 30. item 9: a deleted store is STORE_UNAVAILABLE, never silently reinitialised

section('30. WO-14b leg 4 fix round item 9: a deleted ticket store is STORE_UNAVAILABLE, no new generation-1 ledger');

{
  const dir = tmpProject('bridge-deletedstore-');
  writeManifest(dir); // this fixture helper now explicitly init-stores
  seedReadings(dir, GREEN);
  const ticketsDir = path.join(dir, '.claude', 'orchestra', 'tickets');
  check('sanity — the store exists after the fixture explicitly created it', fs.existsSync(path.join(ticketsDir, 'tickets.json')));
  fs.rmSync(ticketsDir, { recursive: true, force: true });
  check('sanity — the store is now gone', !fs.existsSync(ticketsDir));

  const runtime = createRuntime({ projectDir: dir });
  const result = runtime.dispatch(baseRequest());
  check('dispatch() refuses typed STORE_UNAVAILABLE on a deleted store', result.ok === false && result.outcome === 'STORE_UNAVAILABLE', JSON.stringify(result));
  check('dispatch() did NOT silently create a fresh generation-1 ledger', !fs.existsSync(path.join(ticketsDir, 'tickets.json')));

  const denied = runtime.gate(preEvent('TICKET=tkt-aa11bb22cc33dd44', 'builder', 'tu-deletedstore'));
  check('gate() also denies (fail closed) rather than silently reinitialising the store',
    denied.hookSpecificOutput && denied.hookSpecificOutput.permissionDecision === 'deny' && /ticket store unavailable/.test(denied.hookSpecificOutput.permissionDecisionReason),
    JSON.stringify(denied));
  check('gate() also did not create a fresh ledger', !fs.existsSync(path.join(ticketsDir, 'tickets.json')));

  // bridge/cli.js init-store is the one lawful, explicit way back.
  const initOut = spawnSync(process.execPath, [path.join(MASTER, 'bridge', 'cli.js'), 'init-store'],
    { encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: dir }) });
  check('bridge/cli.js init-store explicitly recreates it', initOut.status === 0 && fs.existsSync(path.join(ticketsDir, 'tickets.json')), initOut.stdout + initOut.stderr);
}

// ============ 31. item 10: routing events are mandatory — an unwritable log path refuses the dispatch

section('31. WO-14b leg 4 fix round item 10: routing log unwritable -> typed ROUTING_LOG_UNAVAILABLE, nothing issued');

{
  const dir = tmpProject('bridge-routinglog-');
  writeManifest(dir);
  seedReadings(dir, GREEN);
  // Replace the routing log PATH with a directory — appendFileSync must fail.
  fs.mkdirSync(path.join(dir, '.claude', 'orchestra', 'tickets', 'routing.events.jsonl'), { recursive: true });
  const runtime = createRuntime({ projectDir: dir });
  const before = openTicketsCount(dir);
  const result = runtime.dispatch(baseRequest());
  check('dispatch() refuses typed ROUTING_LOG_UNAVAILABLE when the log path is a directory', result.ok === false && result.outcome === 'ROUTING_LOG_UNAVAILABLE', JSON.stringify(result));
  check('nothing was issued', openTicketsCount(dir) === before);
}

// ============ 32. item 12: ticket-gate.js adapter — malformed stdin under legacy/no-manifest is inert

section('32. WO-14b leg 4 fix round item 12: ticket-gate.js reads roster FIRST — malformed stdin under legacy/no manifest is inert {}');

{
  const dir = tmpProject('bridge-gate-legacy-malformed-'); // no orchestra.json at all
  const script = path.join(MASTER, 'bridge', 'hooks', 'ticket-gate.js');
  const pre = spawnSync(process.execPath, [script, 'PreToolUse'], { input: '{ not json', encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: dir }) });
  check('malformed stdin, no manifest at all: exit 0', pre.status === 0, 'exit ' + pre.status + ' stderr: ' + pre.stderr);
  check('malformed stdin, no manifest at all: inert {} (never a deny)', pre.stdout.trim() === '{}', pre.stdout);

  const dir2 = tmpProject('bridge-gate-legacy-malformed-2-');
  fs.writeFileSync(path.join(dir2, '.claude', 'orchestra.json'), JSON.stringify({ roster: 'legacy' }, null, 2));
  const stop = spawnSync(process.execPath, [script, 'Stop'], { input: 'not json at all', encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: dir2 }) });
  check('malformed stdin under an explicit roster:legacy manifest: exit 0', stop.status === 0, 'exit ' + stop.status + ' stderr: ' + stop.stderr);
  check('malformed stdin under roster:legacy: inert {} (never a block)', stop.stdout.trim() === '{}', stop.stdout);
}

// ============ 33. item 13: request parent_ticket is recorded on the implementation ticket

section('33. WO-14b leg 4 fix round item 13: parent_ticket from the request is recorded on the implementation ticket');

{
  const dir = tmpProject('bridge-parentticket-');
  writeManifest(dir);
  seedReadings(dir, GREEN);
  const runtime = createRuntime({ projectDir: dir });
  const parent = runtime.dispatch(baseRequest({ task_id: 'parent-1' }));
  const child = runtime.dispatch(baseRequest({ task_id: 'child-1', parent_ticket: parent.tickets.implementation.id }));
  check('the child implementation ticket records the request\'s parent_ticket verbatim',
    child.ok && child.tickets.implementation.parent_ticket === parent.tickets.implementation.id,
    child.ok && child.tickets.implementation.parent_ticket);
}

// ============ 34. WO-14b repair A item 1: ticket-gate.js — missing runtime.js fails closed

section('34. WO-14b repair A item 1: ticket-gate.js — missing/unloadable runtime.js fails closed (deny/block, exit 0, never a bare crash)');

{
  const projDir = tmpProject('bridge-gate-norun-proj-');
  writeManifest(projDir); // a real roster:new install

  // Mirrors the review's own probe: "a copied roster:new hook with
  // runtime.js absent" — an isolated hooks/ dir carrying ONLY ticket-gate.js,
  // so require(path.join(__dirname,'..','runtime.js')) throws MODULE_NOT_FOUND.
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-gate-norun-'));
  cleanups.push(() => fs.rmSync(isolated, { recursive: true, force: true }));
  fs.mkdirSync(path.join(isolated, 'hooks'));
  const copiedScript = path.join(isolated, 'hooks', 'ticket-gate.js');
  fs.copyFileSync(path.join(MASTER, 'bridge', 'hooks', 'ticket-gate.js'), copiedScript);
  const envWithProj = Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: projDir });

  const pre = spawnSync(process.execPath, [copiedScript, 'PreToolUse'],
    { input: JSON.stringify(preEvent('TICKET=tkt-aa11bb22cc33dd44', 'builder', 'tu1')), encoding: 'utf8', env: envWithProj });
  check('missing runtime.js under PreToolUse: exit 0 (never a bare crash with no decision JSON)', pre.status === 0, 'exit ' + pre.status + ' stderr: ' + pre.stderr);
  let preJson = null;
  try { preJson = JSON.parse(pre.stdout); } catch (_) { /* leave null */ }
  check('missing runtime.js under PreToolUse: a deny decision (fail closed, never inert/allow)',
    !!(preJson && preJson.hookSpecificOutput && preJson.hookSpecificOutput.permissionDecision === 'deny'), pre.stdout);

  const stop = spawnSync(process.execPath, [copiedScript, 'Stop'],
    { input: JSON.stringify(stopEvent(false, [])), encoding: 'utf8', env: envWithProj });
  check('missing runtime.js under Stop: exit 0 (never a bare crash)', stop.status === 0, 'exit ' + stop.status + ' stderr: ' + stop.stderr);
  let stopJson = null;
  try { stopJson = JSON.parse(stop.stdout); } catch (_) { /* leave null */ }
  check('missing runtime.js under Stop: a block decision (fail closed)',
    !!(stopJson && stopJson.decision === 'block'), stop.stdout);
}

// ============ 35. WO-14b repair A items 5/6/7: enginePass — expiry, casting binding, honest identity bookkeeping

section('35. WO-14b repair A items 5/6/7: requireTicket()/enginePass() — expiry refuses typed, model/effort bound to the ticket\'s own casting, run_nonce never invented');

{
  const dir = tmpProject('bridge-enginepass-');
  writeManifest(dir);
  seedReadings(dir, GREEN);
  const runtime = createRuntime({ projectDir: dir });
  const store = { dir: path.join(dir, '.claude', 'orchestra', 'tickets') };

  // Drive a Green E1 dispatch (deterministically Luna/openai — see baseRequest()'s
  // own comment) all the way to LAUNCHED via the Agent tool's own Pre/PostToolUse
  // hooks, exactly like section 2's happy path.
  function driveToLaunched(taskId) {
    const result = runtime.dispatch(baseRequest({ task_id: taskId }));
    const ticketId = result.tickets.implementation.id;
    const role = result.spawn.subagent_type;
    const toolUseId = 'toolu-enginepass-' + taskId;
    const pre = runtime.gate(preEvent('TICKET=' + ticketId, role, toolUseId));
    if (!(pre.hookSpecificOutput && pre.hookSpecificOutput.permissionDecision === 'allow')) {
      throw new Error('driveToLaunched(): PreToolUse did not allow: ' + JSON.stringify(pre));
    }
    runtime.gate(postEvent(toolUseId, 'agent-' + taskId, 'claude-haiku-4-5-20251001'));
    return { ticketId, role, casting: result.casting.casting };
  }

  // --- item 5: LAUNCHED, then expired before enginePass() -> typed
  //     TICKET_EXPIRED, the ticket actually transitions to EXPIRED (the same
  //     lawful edge launch()/resolve() already make), never silently accepted.
  {
    const { ticketId, role } = driveToLaunched('exp-enginepass');
    const t = T.get(store, ticketId);
    t.expires_at = new Date(Date.now() - 1000).toISOString();
    fs.writeFileSync(path.join(store.dir, 'tickets.json'),
      fs.readFileSync(path.join(store.dir, 'tickets.json'), 'utf8').replace(
        new RegExp(JSON.stringify(T.get(store, ticketId).expires_at)), JSON.stringify(t.expires_at)));

    let threw = null;
    try { runtime.requireTicket({ id: ticketId, role, phase: 'exec' }); } catch (e) { threw = e; }
    check('item 5: an expired LAUNCHED ticket refuses enginePass typed TICKET_EXPIRED', !!threw && threw.code === 'TICKET_EXPIRED', threw && (threw.code + ': ' + threw.message));
    check('item 5: the ticket actually transitioned to EXPIRED on disk', T.get(store, ticketId).status === 'EXPIRED', T.get(store, ticketId).status);
  }

  // --- item 6: a caller-declared model/effort that DISAGREES with the
  //     ticket's own casting -> typed CASTING_MISMATCH, zero commit (the
  //     ticket stays LAUNCHED with engine_pass still null); the SAME value
  //     (or none at all) proceeds normally and engine_pass DOES commit.
  {
    const { ticketId, role, casting } = driveToLaunched('mismatch-enginepass');
    let threw = null;
    try {
      runtime.requireTicket({ id: ticketId, role, phase: 'exec', casting: { model: 'gpt-5.6-sol', effort: 'xhigh' } });
    } catch (e) { threw = e; }
    check('item 6: a caller-declared casting that disagrees with the ticket\'s own -> typed CASTING_MISMATCH',
      !!threw && threw.code === 'CASTING_MISMATCH', threw && (threw.code + ': ' + threw.message));
    check('item 6: the mismatch never committed enginePass (ticket stays LAUNCHED, engine_pass null)',
      T.get(store, ticketId).status === 'LAUNCHED' && T.get(store, ticketId).engine_pass === null,
      JSON.stringify([T.get(store, ticketId).status, T.get(store, ticketId).engine_pass]));

    const passed = runtime.requireTicket({ id: ticketId, role, phase: 'exec', casting: { model: casting.model, effort: casting.effort } });
    check('item 6: a caller-declared casting matching the ticket\'s own proceeds (enginePass commits)',
      passed && passed.engine_pass && passed.status === 'LAUNCHED',
      passed && JSON.stringify(passed.engine_pass));
  }

  // --- item 7: enginePass() never invents a plausible-looking identity —
  //     run_nonce is honestly 'UNKNOWN' at commit time (codex has not run
  //     yet), never a fabricated random value that could be mistaken for a
  //     verified one.
  {
    const { ticketId, role } = driveToLaunched('nonce-enginepass');
    const passed = runtime.requireTicket({ id: ticketId, role, phase: 'exec' });
    check('item 7: engine_pass.run_nonce is the honest \'UNKNOWN\' placeholder, never an invented value',
      passed && passed.engine_pass && passed.engine_pass.run_nonce === 'UNKNOWN',
      passed && JSON.stringify(passed.engine_pass));
  }
}

console.log('\n' + passes + ' passed, ' + failures + ' failed.');
