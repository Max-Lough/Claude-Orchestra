#!/usr/bin/env node
/**
 * WO-14b repair B tests — bridge/close.js (two-stage closure) + bridge/
 * telemetry.js, driven through PRODUCTION bridge/runtime.js dispatch() —
 * never a hand-built routing-event/ticket fixture — so the dispatch
 * envelope (item 1) closure actually reads (items 2-9) is the real one.
 * Same house style as tests/bridge.test.js: a plain check(name, ok) runner,
 * no framework, no dependencies. Temp git repos; no live models.
 *
 *   node tests/bridge-close.test.js
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const MASTER = path.resolve(__dirname, '..');
const T = require(path.join(MASTER, 'router', 'tickets.js'));
const close = require(path.join(MASTER, 'bridge', 'close.js'));
const { createRuntime } = require(path.join(MASTER, 'bridge', 'runtime.js'));
const { pinFileFor } = require(path.join(MASTER, 'bridge', 'manifest.js'));
const { validate } = require(path.join(MASTER, 'verifier', 'schema-check.js'));

const CASTING_RECORD_SCHEMA = JSON.parse(fs.readFileSync(path.join(MASTER, 'registry', 'schemas', 'casting-record.schema.json'), 'utf8'));
const VERDICT_AUDIT_SCHEMA = JSON.parse(fs.readFileSync(path.join(MASTER, 'registry', 'schemas', 'verdict-audit.schema.json'), 'utf8'));

// Every real dispatch() call below resolves its owner pin from this temp
// dir — same convention as tests/bridge.test.js.
const PIN_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-close-test-pins-'));
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

function git(dir, args) {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' failed: ' + (r.stderr || r.stdout || ''));
  return (r.stdout || '').trim();
}

function writePin(dir, manifest) {
  const manifestPath = path.join(dir, '.claude', 'orchestra.json');
  const manifestSha256 = crypto.createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex');
  const pin = {
    // The runtime compares the pin's projectDir against the REAL path
    // (bridge/manifest.js realDir()), exactly as install.js writes it —
    // on macOS os.tmpdir() is a symlink (/var -> /private/var).
    projectDir: fs.realpathSync(dir),
    manifestSha256,
    roster: manifest.roster,
    rosterGeneration: manifest.rosterGeneration,
    seats: manifest.seats,
    writtenAt: new Date().toISOString(),
    by: 'bridge-close.test.js fixture',
  };
  const pinPath = pinFileFor(dir);
  fs.mkdirSync(path.dirname(pinPath), { recursive: true });
  fs.writeFileSync(pinPath, JSON.stringify(pin, null, 2));
  return pin;
}

// A project dir that IS its own git repo (the installed single-repo layout):
// projectDir === repoDir throughout this suite. `verificationManifest`
// carries the {commands, coverage, versions} the Verifier re-runs from the
// pinned base ref; it lives in the SAME .claude/orchestra.json the roster
// trust machinery reads (roster/rosterGeneration/seats) — exactly as a real
// installed project's orchestra.json does. Returns { dir, base }.
function makeRepo(verificationManifest) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-close-fixture-'));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  git(dir, ['init']);
  git(dir, ['config', 'user.email', 'bridge-close-suite@example.invalid']);
  git(dir, ['config', 'user.name', 'Bridge Close Suite']);
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  const manifest = Object.assign({ roster: 'new', rosterGeneration: 1, seats: {} }, verificationManifest);
  fs.writeFileSync(path.join(dir, '.claude', 'orchestra.json'), JSON.stringify(manifest, null, 2));
  writePin(dir, manifest);
  T.createTicketStore({ dir: path.join(dir, '.claude', 'orchestra', 'tickets'), init: true });
  fs.writeFileSync(path.join(dir, 'lib.js'), "module.exports = { ok: true };\n");
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'base']);
  const base = git(dir, ['rev-parse', 'HEAD']);
  return { dir, base };
}

function commitFeature(dir, filename, content) {
  const name = filename || 'feature.js';
  fs.writeFileSync(path.join(dir, name), content || 'module.exports = { feature: true };\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'add ' + name]);
  return git(dir, ['rev-parse', 'HEAD']);
}

const PASS_MANIFEST = { commands: [{ command: 'node -e "process.exit(0)"' }], coverage: 'complete', versions: [] };
const FAIL_MANIFEST = { commands: [{ command: 'node -e "process.exit(1)"' }], coverage: 'complete', versions: [] };

const GREEN = { 'AU-all': 0.95, 'AU-opus': 0.95, 'AU-fable': 0.95, 'OU': 0.95 };
// castings.json's modelBuckets: Sonnet 5 (this suite's deterministic
// implementation casting, tier:'dense') draws only from AU-all; every
// review-lane model (GPT-5.6 Sol/Terra/Luna) draws only from OU. Gating OU
// alone gates the mandatory review lane WITHOUT also gating the
// implementation's own Builder dispatch (a real RED-everywhere bucket state
// would refuse dispatch() itself before a reviewer is ever computed).
const RED_REVIEW_ONLY = { 'AU-all': 0.95, 'AU-opus': 0.95, 'AU-fable': 0.95, 'OU': 0.01 };
function seedReadings(dir, fractions) {
  const file = path.join(dir, '.claude', 'orchestra-pool-readings.jsonl');
  const lines = Object.entries(fractions).map(([bucket, remainingFraction]) => JSON.stringify({
    ts: new Date().toISOString(), kind: 'reading', bucket, remainingFraction, source: 'bridge-close.test.js fixture',
  }));
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

function getStore(dir) {
  return T.createTicketStore({ dir: path.join(dir, '.claude', 'orchestra', 'tickets'), init: false });
}

function driveToResolved(store, ticketId, role, message, servedModel) {
  T.consume(store, ticketId, { tool_use_id: 'tu-' + ticketId, role });
  T.launch(store, ticketId, { agent_id: 'agent-' + ticketId, served_model: servedModel || 'claude-sonnet-5-20260101' });
  return T.resolve(store, ticketId, { agent_id: 'agent-' + ticketId, last_assistant_message: message, agent_transcript_path: '/tmp/transcript-' + ticketId + '.jsonl' });
}

// Item 4 fixture helper: drives a ticket through the codex-engine lifecycle
// (enginePass/engineResult, additive while LAUNCHED) before SubagentStop
// binds a possibly-forged relay — mirrors what packs/codex/hooks/
// orchestra-engine-mcp.js does for real via requireTicket()/engineResult().
function driveToResolvedViaEngine(store, ticketId, role, engineReport, engineNonce, forgedRelayMessage) {
  T.consume(store, ticketId, { tool_use_id: 'tu-' + ticketId, role });
  T.launch(store, ticketId, { agent_id: 'agent-' + ticketId, served_model: 'haiku' });
  T.enginePass(store, ticketId, { run_nonce: engineNonce, role, vendor: 'openai' });
  T.engineResult(store, ticketId, { report: engineReport, run_log: null });
  return T.resolve(store, ticketId, { agent_id: 'agent-' + ticketId, last_assistant_message: forgedRelayMessage, agent_transcript_path: '/tmp/transcript-' + ticketId + '.jsonl' });
}

// The Verifier's nonce-echo check (verifier.js's nonceEcho()) requires
// report.integrity.nonce_echo to match envelope.order.integrity_nonce
// byte-for-byte — the real Builder reads this nonce from its own order and
// echoes it back via a `REPORT INTEGRITY: <nonce>` line (buildVerifierReport()
// extracts it with exactly that regex). Any fixture whose report needs to
// reach a genuine Verifier PASS must include this line.
function readEnvelopeFixture(dir, taskId) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.claude', 'orchestra', 'ledger', taskId, 'envelope.json'), 'utf8'));
}
function reportIntegrityLine(dir, taskId) {
  const env = readEnvelopeFixture(dir, taskId);
  return '\nREPORT INTEGRITY: ' + env.order.integrity_nonce + '\n';
}

function bandCReport(status, commit, extra) {
  return [
    'STATUS: ' + status,
    'COMMIT: ' + commit,
    '',
    'CHANGES',
    '- feature.js:1 — added feature',
    '',
    'VERIFICATION',
    '- node -e "process.exit(0)" -> exit 0',
    '',
    'DEVIATIONS',
    '- none',
    '',
    'CONCERNS',
    '- none',
    '',
  ].join('\n') + (extra || '');
}

function verdictBlock(obj) {
  return '```verdict-json\n' + JSON.stringify(obj, null, 2) + '\n```\n';
}

function approveVerdict(overrides) {
  return Object.assign({
    verdict: 'APPROVE',
    findings: [],
    claims_checked: [{ claim: 'change compiles', result: 'CONFIRMED', how: 'ran node -e' }],
    refutation_duty: { present: true, what_was_tried: 'considered a no-op alternative and a broader rewrite; both rejected' },
    citation_replay: [{ citation: 'trivial pass', command: 'node -e "process.exit(0)"', result: 'MATCH' }],
    served_model: 'gpt-5.6-sol',
    run_nonce: null,
    review: { cross_family: null },
  }, overrides || {});
}

// class E1/risk T1 sits outside every q0Triggers list (bridge.test.js's own
// documented fix — see its baseRequest() comment) so the ordinary
// happy-path fixtures below are deterministic; resolveQ0IfPresent() is
// still called everywhere as a defensive no-op for any request that opts
// into touches/class combinations that DO sample a Q0 companion. tier:
// 'dense' pins the Builder ladder's preferred rung to Sonnet 5 · high
// (anthropic) — E1/E2's default tier is 'bounded' (Luna, openai), which
// would make the implementation's author family a coin flip across this
// suite's fixtures; every test here wants a deterministic anthropic
// implementation so the computed reviewer lane is deterministically openai
// (items 4/9 specifically need the codex/openai lane).
function baseRequest(overrides) {
  return Object.assign({ class: 'E1', risk: 'T1', tier: 'dense', goal: 'fix the thing', acceptance_criteria: ['tests pass'] }, overrides || {});
}
function resolveQ0IfPresent(store, dres) {
  if (dres.tickets && dres.tickets.q0) {
    driveToResolved(store, dres.tickets.q0.id, dres.tickets.q0.role, 'Q0 fixture ticket — not exercised by this suite');
  }
}

// Dispatches a real request through production runtime.dispatch(). Throws
// if dispatch itself refuses — every scenario below wants a routed ticket
// to then drive to RESOLVED and close.
function dispatch(dir, requestOverrides) {
  const rt = createRuntime({ projectDir: dir, repoDir: dir });
  const dres = rt.dispatch(baseRequest(requestOverrides));
  if (!dres.ok) throw new Error('fixture dispatch() refused: ' + JSON.stringify(dres));
  const store = getStore(dir);
  resolveQ0IfPresent(store, dres);
  return { rt, dres, store };
}

// End-to-end happy path through close #1: dispatch, commit a feature, drive
// the implementation ticket DONE, and close #1 it into REVIEW_PENDING.
// Returns everything section 4/5/etc. need to drive close #2.
function freshApprovedPair(dir) {
  const { dres, store } = dispatch(dir);
  const head = commitFeature(dir);
  const implId = dres.tickets.implementation.id;
  const taskId = T.get(store, implId).task_id;
  driveToResolved(store, implId, dres.tickets.implementation.role, bandCReport('DONE', head, reportIntegrityLine(dir, taskId)));
  const closeResult = close.close({ ticket: T.get(store, implId), projectDir: dir, repoDir: dir, store });
  if (!closeResult.ok || closeResult.stage !== 'REVIEW_PENDING') {
    throw new Error('fixture close #1 did not reach REVIEW_PENDING: ' + JSON.stringify(closeResult));
  }
  return { dir, head, store, impl: T.get(store, implId), reviewerTicket: closeResult.reviewer_ticket, closeResult };
}

// ------------------------------------------------------------------ section 1

section('1. close #1 — refusals');
{
  const { dir } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, GREEN);
  const { dres, store } = dispatch(dir);
  const openTicket = T.get(store, dres.tickets.implementation.id);
  const r1 = close.close({ ticket: openTicket, projectDir: dir, repoDir: dir, store });
  check('non-RESOLVED ticket refused', r1.outcome === 'NOT_CLOSED' && /RESOLVED/.test(r1.reason), JSON.stringify(r1));
}
{
  const m = makeRepo(PASS_MANIFEST);
  seedReadings(m.dir, GREEN);
  const { dir, store, reviewerTicket } = freshApprovedPair(m.dir);
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', 'not a report at all');
  const revResolved = T.get(store, reviewerTicket.id);
  const r2 = close.close({ ticket: revResolved, projectDir: dir, repoDir: dir, store });
  check('close #1 dispatch of a reviewer ticket goes through close #2, not close #1', r2.outcome === 'NOT_CLOSED');
}
{
  const { dir } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, GREEN);
  // Deliberately not using the dispatch() helper (which auto-resolves any
  // Q0 companion) — this test needs the Q0 left LAUNCHED, not RESOLVED.
  const rt = createRuntime({ projectDir: dir, repoDir: dir });
  const dres = rt.dispatch(baseRequest({ touches: ['auth'] })); // touches:auth reliably samples a Q0 companion
  if (!dres.ok) throw new Error('fixture dispatch() refused: ' + JSON.stringify(dres));
  const store = getStore(dir);
  const implId = dres.tickets.implementation.id;
  if (dres.tickets.q0) {
    // The implementation ticket cannot even be CONSUMED until its Q0 is
    // LAUNCHED (router/tickets.js's own precondition) — launch it, but
    // deliberately leave it there, not RESOLVED.
    T.consume(store, dres.tickets.q0.id, { tool_use_id: 'tu-' + dres.tickets.q0.id, role: dres.tickets.q0.role });
    T.launch(store, dres.tickets.q0.id, { agent_id: 'agent-' + dres.tickets.q0.id, served_model: 'claude-sonnet-5-20260101' });
    const head = commitFeature(dir);
    driveToResolved(store, implId, dres.tickets.implementation.role, bandCReport('DONE', head, reportIntegrityLine(dir, T.get(store, implId).task_id)));
    const r3 = close.close({ ticket: T.get(store, implId), projectDir: dir, repoDir: dir, store });
    check('Q0-not-resolved refused', r3.outcome === 'NOT_CLOSED' && /q0/i.test(r3.reason), JSON.stringify(r3));
  } else {
    check('Q0-not-resolved refused (fixture skipped — no Q0 sampled this run)', true);
  }
}
{
  const { dir } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, GREEN);
  const { dres, store } = dispatch(dir);
  const head = commitFeature(dir);
  const implId = dres.tickets.implementation.id;
  driveToResolved(store, implId, dres.tickets.implementation.role, bandCReport('BLOCKED', head));
  const r4 = close.close({ ticket: T.get(store, implId), projectDir: dir, repoDir: dir, store });
  check('executor BLOCKED refused', r4.outcome === 'NOT_CLOSED' && /BLOCKED/.test(r4.reason), JSON.stringify(r4));
}
{
  const { dir } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, GREEN);
  const { dres, store } = dispatch(dir);
  const implId = dres.tickets.implementation.id;
  driveToResolved(store, implId, dres.tickets.implementation.role, 'STATUS: DONE\n\nCHANGES\n- none\n\nVERIFICATION\n- none\n\nDEVIATIONS\n- none\n\nCONCERNS\n- none\n');
  const r5 = close.close({ ticket: T.get(store, implId), projectDir: dir, repoDir: dir, store });
  check('no commit named refused', r5.outcome === 'NOT_CLOSED' && /no commit named/.test(r5.reason), JSON.stringify(r5));
}
{
  // Item 3: all four Band-C sections must be present and non-empty.
  const { dir } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, GREEN);
  const { dres, store } = dispatch(dir);
  const head = commitFeature(dir);
  const implId = dres.tickets.implementation.id;
  driveToResolved(store, implId, dres.tickets.implementation.role, 'STATUS: DONE\nCOMMIT: ' + head + '\n');
  const r6 = close.close({ ticket: T.get(store, implId), projectDir: dir, repoDir: dir, store });
  check('item 3: report missing all four sections -> NOT_CLOSED incomplete report', r6.outcome === 'NOT_CLOSED' && /incomplete report/.test(r6.reason), JSON.stringify(r6));
}
{
  // Item 2: an envelope that fails to exist at all is refused, not skipped.
  const { dir } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, GREEN);
  const { dres, store } = dispatch(dir);
  const head = commitFeature(dir);
  const implId = dres.tickets.implementation.id;
  const envelopePath = path.join(dir, '.claude', 'orchestra', 'ledger', T.get(store, implId).task_id, 'envelope.json');
  fs.rmSync(envelopePath, { force: true });
  driveToResolved(store, implId, dres.tickets.implementation.role, bandCReport('DONE', head));
  const r7 = close.close({ ticket: T.get(store, implId), projectDir: dir, repoDir: dir, store });
  check('item 2: missing envelope -> NOT_CLOSED envelope unavailable', r7.outcome === 'NOT_CLOSED' && /envelope unavailable/.test(r7.reason), JSON.stringify(r7));
}
{
  // Item 2: an envelope whose order does not validate against
  // order.schema.json is refused — never silently skipped.
  const { dir } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, GREEN);
  const { dres, store } = dispatch(dir);
  const head = commitFeature(dir);
  const implId = dres.tickets.implementation.id;
  const taskId = T.get(store, implId).task_id;
  const envelopePath = path.join(dir, '.claude', 'orchestra', 'ledger', taskId, 'envelope.json');
  const envelope = JSON.parse(fs.readFileSync(envelopePath, 'utf8'));
  delete envelope.order.requested_casting; // now schema-invalid: a required field is gone
  fs.writeFileSync(envelopePath, JSON.stringify(envelope, null, 2));
  driveToResolved(store, implId, dres.tickets.implementation.role, bandCReport('DONE', head));
  const r8 = close.close({ ticket: T.get(store, implId), projectDir: dir, repoDir: dir, store });
  check('item 2: schema-invalid envelope order -> NOT_CLOSED envelope invalid', r8.outcome === 'NOT_CLOSED' && /envelope invalid/.test(r8.reason), JSON.stringify(r8));
}

// -------------------------------------------------------------- section 1b

section('1b. parseBandCReport — PL-15 near-miss aliases (order #3, 2026-09-01)');
{
  // The exact label drift the live builder emitted: OPEN ISSUES for CONCERNS,
  // and the hash on a "Full hash:" bullet under a COMMIT heading.
  const drifted =
    'STATUS: DONE\n\nCHANGES\n- tools/x.gd:204 — guarded the scale parse\n\n' +
    'VERIFICATION\n- gdlint → clean\n\nCOMMIT\n- Branch: `fix/x`\n- Full hash: `902ed9e2a1d421b0316077ff7651517fa5358c59`\n\n' +
    'DEVIATIONS\n- none\n\nOPEN ISSUES\n- none\n';
  const p = close.parseBandCReport(drifted);
  check('OPEN ISSUES parses as the CONCERNS section', p.concernsRaw === '- none', JSON.stringify(p.concernsRaw));
  check('"Full hash:" yields the commit', p.commit === '902ed9e2a1d421b0316077ff7651517fa5358c59', JSON.stringify(p.commit));
  check('COMMIT heading terminates the VERIFICATION section (not swallowed into it)', /gdlint/.test(p.verificationRaw) && !/Full hash/.test(p.verificationRaw), JSON.stringify(p.verificationRaw));
  check('canonical CONCERNS still wins over OPEN ISSUES when both exist',
    close.parseBandCReport(drifted.replace('DEVIATIONS\n- none', 'DEVIATIONS\n- none\n\nCONCERNS\n- real concern')).concernsRaw === '- real concern');
  check('a report with neither CONCERNS nor OPEN ISSUES still has no concerns section',
    close.parseBandCReport('STATUS: DONE\n\nCHANGES\n- a:1 — x\n\nVERIFICATION\n- ok\n\nDEVIATIONS\n- none\n').concernsRaw === null);

  // PL-19 (order #4, 2026-09-01): the exact live shape — colon-suffixed
  // headers, inline DEVIATIONS/CONCERNS, BRANCH/COMMIT lines, backticked
  // absolute Windows claim paths with a comma line list.
  const live =
    'STATUS: DONE\n\nCHANGES:\n' +
    '- `E:\\Godot Projects\\Game\\src\\ship\\name_label.gd:22-27` — bumped\n' +
    '- `E:\\Godot Projects\\Game\\tests\\ship\\it_test.gd:65,79` — comments\n\n' +
    'BRANCH: feat/nameplate-range-200\nCOMMIT: 33a03539f5355ea7aa1c4a5ee729f47f98617e6c\n\n' +
    'VERIFICATION:\n- gdlint → clean\n\nDEVIATIONS: none.\n\nCONCERNS: none — shared symbol covered.\n';
  const lp = close.parseBandCReport(live);
  check('colon-suffixed headers parse: all four sections present and non-empty',
    !!(lp.changesRaw && lp.verificationRaw && lp.deviationsRaw && lp.concernsRaw),
    JSON.stringify({ c: lp.changesRaw, v: lp.verificationRaw, d: lp.deviationsRaw, k: lp.concernsRaw }));
  check('inline section bodies are captured ("DEVIATIONS: none.")', lp.deviationsRaw === 'none.' && /^none — shared/.test(lp.concernsRaw), JSON.stringify([lp.deviationsRaw, lp.concernsRaw]));
  check('COMMIT: line yields the commit', lp.commit === '33a03539f5355ea7aa1c4a5ee729f47f98617e6c', JSON.stringify(lp.commit));
  check('BRANCH/COMMIT lines produce no bogus claims; backticks stripped',
    JSON.stringify(lp.changes) === JSON.stringify(['E:\\Godot Projects\\Game\\src\\ship\\name_label.gd:22-27', 'E:\\Godot Projects\\Game\\tests\\ship\\it_test.gd:65,79']),
    JSON.stringify(lp.changes));
  // normalizeClaims strips the repo ROOT, and roots are platform-native
  // (path.resolve on POSIX cannot treat "E:\..." as absolute — that literal
  // above only exercises the parser). Build the root and the claims natively:
  // backslashes on Windows, slashes elsewhere; both must come out relative.
  const nativeRoot = path.resolve(os.tmpdir(), 'Godot Projects', 'Game');
  const nativeClaims = [
    path.join(nativeRoot, 'src', 'ship', 'name_label.gd') + ':22-27',
    path.join(nativeRoot, 'tests', 'ship', 'it_test.gd') + ':65,79',
  ];
  check('normalizeClaims: absolute -> repo-relative forward slashes, comma list expanded',
    JSON.stringify(close.normalizeClaims(nativeClaims, nativeRoot)) ===
      JSON.stringify(['src/ship/name_label.gd:22-27', 'tests/ship/it_test.gd:65', 'tests/ship/it_test.gd:79']),
    JSON.stringify(close.normalizeClaims(nativeClaims, nativeRoot)));
  check('normalizeClaims leaves already-relative claims untouched',
    JSON.stringify(close.normalizeClaims(['src/a.gd:5'], nativeRoot)) === JSON.stringify(['src/a.gd:5']));
  check('the canonical bare-header report still parses byte-identically',
    (() => { const q = close.parseBandCReport('STATUS: DONE\n\nCHANGES\n- a.gd:1 — x\n\nVERIFICATION\n- ok\n\nDEVIATIONS\n- none\n\nCONCERNS\n- none\n'); return q.changesRaw === '- a.gd:1 — x' && q.deviationsRaw === '- none' && JSON.stringify(q.changes) === JSON.stringify(['a.gd:1']); })());
}

// ------------------------------------------------------------------ section 2

section('2. close #1 — verifier FAIL vs PASS, and item 1 envelope.base');
{
  const { dir } = makeRepo(FAIL_MANIFEST);
  seedReadings(dir, GREEN);
  const { dres, store } = dispatch(dir);
  const head = commitFeature(dir);
  const implId = dres.tickets.implementation.id;
  driveToResolved(store, implId, dres.tickets.implementation.role, bandCReport('DONE', head));
  const r = close.close({ ticket: T.get(store, implId), projectDir: dir, repoDir: dir, store });
  check('Verifier FAIL -> NOT_CLOSED', r.outcome === 'NOT_CLOSED' && /verifier FAIL/.test(r.reason), JSON.stringify(r));
  const reviewers = T.list(store).filter((t) => t.reviewer_of === implId);
  check('Verifier FAIL issues no reviewer ticket', reviewers.length === 0);
}

// PL-19b/PL-19c (order #4, 2026-09-01): a partial-coverage manifest and a
// host-bound report with no REPORT INTEGRITY echo both proceed to review.
{
  const GAP_MANIFEST = { commands: [{ command: 'node -e "process.exit(0)"' }], coverage: 'lint-only', versions: [] };
  const { dir } = makeRepo(GAP_MANIFEST);
  seedReadings(dir, GREEN);
  const { dres, store } = dispatch(dir);
  const head = commitFeature(dir);
  const implId = dres.tickets.implementation.id;
  // No reportIntegrityLine: the report is host-bound (SubagentStop) and never
  // saw the nonce — close #1 substitutes the order nonce (PL-19b).
  driveToResolved(store, implId, dres.tickets.implementation.role, bandCReport('DONE', head));
  const r = close.close({ ticket: T.get(store, implId), projectDir: dir, repoDir: dir, store });
  check('PL-19c: COVERAGE_GAP manifest + PL-19b: no nonce echo -> still REVIEW_PENDING (green partial oracle proceeds to the model review)',
    r.ok === true && r.stage === 'REVIEW_PENDING' && !!r.reviewer_ticket, JSON.stringify(r));
  const vjson = JSON.parse(fs.readFileSync(path.join(dir, '.claude', 'orchestra', 'ledger', implId, 'verifier.json'), 'utf8'));
  check('the coverage gap stays visible in the ledger verifier.json', vjson.verification.outcome === 'COVERAGE_GAP', JSON.stringify(vjson.verification.outcome));
  check('deterministic_only_closure is false under a partial oracle', vjson.verification.deterministic_only_closure === false);
  check('nonce-echo recorded PASS via the substituted order nonce (host-bound provenance)',
    (vjson.verification.checks || []).some((c) => c.check === 'nonce-echo' && c.outcome === 'PASS'), JSON.stringify((vjson.verification.checks || []).map((c) => c.check + ':' + c.outcome)));
}

let PASS_FIXTURE = null; // shared into section 4/5 for close #2 tests
{
  const { dir } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, GREEN);
  const { dres, store } = dispatch(dir);
  const base = git(dir, ['rev-parse', 'HEAD']);
  const head = commitFeature(dir);
  const implId = dres.tickets.implementation.id;
  const taskId = T.get(store, implId).task_id;
  driveToResolved(store, implId, dres.tickets.implementation.role, bandCReport('DONE', head, reportIntegrityLine(dir, taskId)));
  const envelope = readEnvelopeFixture(dir, taskId);
  check('item 1: envelope.base is the repo HEAD at dispatch time (never the reported commit\'s parent)', envelope.base === base, JSON.stringify({ envelopeBase: envelope.base, base, head }));
  check('item 1 (amended): envelope carries no ticket ids (ticket ids cannot exist before issuance)', envelope.tickets === undefined, JSON.stringify(envelope));
  const r = close.close({ ticket: T.get(store, implId), projectDir: dir, repoDir: dir, store });
  check('Verifier PASS -> REVIEW_PENDING with the computed opposite family', r.ok === true && r.stage === 'REVIEW_PENDING' && r.reviewer_ticket && r.reviewer_ticket.author_family === 'openai', JSON.stringify(r));
  check('reviewer ticket carries the right subagent_type', !!r.ok && r.spawn.subagent_type === 'reviewer-openai', JSON.stringify(r && r.spawn));
  // Item 9: the reviewer spawn header carries TICKET=/MODEL=/EFFORT=/ROLE=/PINNED_RANGE=<base>..<head>.
  const hdr = r.spawn.prompt_header;
  check('item 9: reviewer spawn header carries TICKET=', new RegExp('TICKET=' + r.reviewer_ticket.id).test(hdr), hdr);
  check('item 9: reviewer spawn header carries MODEL=', /MODEL=\S+/.test(hdr), hdr);
  check('item 9: reviewer spawn header carries EFFORT=', /EFFORT=\S+/.test(hdr), hdr);
  check('item 9: reviewer spawn header carries ROLE=reviewer-openai', /ROLE=reviewer-openai/.test(hdr), hdr);
  check('item 9: reviewer spawn header carries PINNED_RANGE=<base>..<head>', hdr.indexOf('PINNED_RANGE=' + base + '..' + head) !== -1, hdr);
  PASS_FIXTURE = { dir, base, head, store, impl: T.get(store, implId), reviewerTicket: r.ok ? r.reviewer_ticket : null };
}

section('3. close #1 — gated reviewer');
{
  const { dir } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, RED_REVIEW_ONLY); // exhausts only the mandatory openai review lane (OU)
  const { dres, store } = dispatch(dir);
  const head = commitFeature(dir);
  const implId = dres.tickets.implementation.id;
  driveToResolved(store, implId, dres.tickets.implementation.role, bandCReport('DONE', head, reportIntegrityLine(dir, T.get(store, implId).task_id)));
  const r = close.close({ ticket: T.get(store, implId), projectDir: dir, repoDir: dir, store });
  check('gated reviewer -> NOT_CLOSED naming lawful responses', r.outcome === 'NOT_CLOSED' && /review unavailable/.test(r.reason), JSON.stringify(r));
}

// ------------------------------------------------------------------ section 4

section('4. close #2 — the happy path (APPROVE, cross-family)');
{
  const { dir, store, impl, reviewerTicket } = PASS_FIXTURE;
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai',
    'REVIEW ENGINE: OpenAI via Codex CLI\nREVIEW RUN NONCE: nonce-abc123\n\n' + verdictBlock(approveVerdict({ run_nonce: 'nonce-abc123' })),
    'UNKNOWN' // the runtime genuinely exposed no served model — see the served_model_mismatch:null check below
  );
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('APPROVE cross-family -> CLOSED', r.ok === true && r.outcome === 'CLOSED', JSON.stringify(r));
  check('both tickets actually transitioned to CLOSED', T.get(store, impl.id).status === 'CLOSED' && T.get(store, reviewerTicket.id).status === 'CLOSED');

  const implRecordPath = path.join(dir, '.claude', 'orchestra', 'ledger', impl.id, 'casting-record.json');
  const revRecordPath = path.join(dir, '.claude', 'orchestra', 'ledger', reviewerTicket.id, 'casting-record.json');
  const auditPath = path.join(dir, '.claude', 'orchestra', 'ledger', reviewerTicket.id, 'verdict-audit.json');
  check('implementation casting-record written', fs.existsSync(implRecordPath));
  check('reviewer casting-record written', fs.existsSync(revRecordPath));
  check('verdict-audit written', fs.existsSync(auditPath));
  if (fs.existsSync(implRecordPath)) {
    const rec = JSON.parse(fs.readFileSync(implRecordPath, 'utf8'));
    check('implementation casting-record is schema-valid', validate(CASTING_RECORD_SCHEMA, rec).length === 0, JSON.stringify(validate(CASTING_RECORD_SCHEMA, rec)));
    check('PL-23: the runtime id claude-sonnet-5-… served for "Sonnet 5" is NOT a P15 mismatch', rec.served_model_mismatch === false, JSON.stringify(rec));
    check('PL-24: implementation bucket follows the casting (Anthropic, non-Opus/Fable -> AU-all)', rec.bucket === 'AU-all', JSON.stringify(rec));
    check('PL-24: context_shape is the envelope\'s declaration, a real enum value', ['packet', 'scoped', 'subsystem', 'repo', 'haystack'].includes(rec.context_shape), JSON.stringify(rec));
  }
  if (fs.existsSync(revRecordPath)) {
    const rec = JSON.parse(fs.readFileSync(revRecordPath, 'utf8'));
    check('reviewer casting-record is schema-valid', validate(CASTING_RECORD_SCHEMA, rec).length === 0, JSON.stringify(validate(CASTING_RECORD_SCHEMA, rec)));
    check('served_model UNKNOWN -> served_model_mismatch null', rec.served_model === 'UNKNOWN' && rec.served_model_mismatch === null, JSON.stringify(rec));
    check('PL-24: reviewer bucket follows the casting (openai -> OU)', rec.bucket === 'OU', JSON.stringify(rec));
  }
  if (fs.existsSync(auditPath)) {
    const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    check('verdict-audit is schema-valid', validate(VERDICT_AUDIT_SCHEMA, audit).length === 0, JSON.stringify(validate(VERDICT_AUDIT_SCHEMA, audit)));
  }
}

section('5. close #2 — malformed / unavailable / non-closing verdicts');
function freshPending(dir) {
  seedReadings(dir, GREEN);
  return freshApprovedPair(dir);
}

{
  const { dir } = makeRepo(PASS_MANIFEST);
  const { store, reviewerTicket } = freshPending(dir);
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', 'REVIEW ENGINE: OpenAI via Codex CLI\n\nno block here at all\n');
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('no verdict-json block -> NOT_CLOSED malformed', r.outcome === 'NOT_CLOSED' && /malformed/.test(r.reason), JSON.stringify(r));
}
{
  const { dir } = makeRepo(PASS_MANIFEST);
  const { store, reviewerTicket } = freshPending(dir);
  const two = verdictBlock(approveVerdict()) + '\n' + verdictBlock(approveVerdict());
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', two);
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('two verdict-json blocks -> NOT_CLOSED malformed', r.outcome === 'NOT_CLOSED' && /malformed/.test(r.reason), JSON.stringify(r));
}
{
  const { dir } = makeRepo(PASS_MANIFEST);
  const { store, reviewerTicket } = freshPending(dir);
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', '```verdict-json\n{ not valid json\n```\n');
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('bad JSON in block -> NOT_CLOSED malformed', r.outcome === 'NOT_CLOSED' && /malformed/.test(r.reason), JSON.stringify(r));
}
{
  const { dir } = makeRepo(PASS_MANIFEST);
  const { store, reviewerTicket } = freshPending(dir);
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', verdictBlock({ verdict: 'APPROVE' })); // fails schema: missing required fields
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('schema-failing block -> NOT_CLOSED malformed', r.outcome === 'NOT_CLOSED' && /malformed/.test(r.reason), JSON.stringify(r));
}
{
  const { dir } = makeRepo(PASS_MANIFEST);
  const { store, reviewerTicket } = freshPending(dir);
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', 'VERDICT: REVIEW_UNAVAILABLE\nFINALITY: this runner made 3 engine attempts\n');
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('REVIEW_UNAVAILABLE text -> NOT_CLOSED review unavailable', r.outcome === 'NOT_CLOSED' && /review unavailable/.test(r.reason), JSON.stringify(r));
}
{
  const { dir } = makeRepo(PASS_MANIFEST);
  const { store, impl, reviewerTicket } = freshPending(dir);
  const revise = approveVerdict({ verdict: 'REVISE', findings: [{ severity: 'MAJOR', path: 'feature.js', line: 1, claim: 'broken', reproduced: true, evidence: 'ran it' }] });
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', 'REVIEW RUN NONCE: n1\n' + verdictBlock(Object.assign({}, revise, { run_nonce: 'n1' })));
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('REVISE -> NOT_CLOSED with findings attached', r.outcome === 'NOT_CLOSED' && r.reason === 'REVISE' && Array.isArray(r.findings) && r.findings.length === 1, JSON.stringify(r));
  // Item 8: non-closing outcomes persist telemetry and durable NOT_CLOSED on BOTH tickets.
  check('item 8: implementation ticket carries a durable NOT_CLOSED outcome', T.get(store, impl.id).status === 'RESOLVED' && T.get(store, impl.id).outcome && T.get(store, impl.id).outcome.code === 'NOT_CLOSED', JSON.stringify(T.get(store, impl.id).outcome));
  check('item 8: reviewer ticket carries a durable NOT_CLOSED outcome', T.get(store, reviewerTicket.id).status === 'RESOLVED' && T.get(store, reviewerTicket.id).outcome && T.get(store, reviewerTicket.id).outcome.code === 'NOT_CLOSED', JSON.stringify(T.get(store, reviewerTicket.id).outcome));
  const auditPath = path.join(dir, '.claude', 'orchestra', 'ledger', reviewerTicket.id, 'verdict-audit.json');
  check('item 8: verdict-audit persisted for a non-closing REVISE', fs.existsSync(auditPath));
  const implRecordPath = path.join(dir, '.claude', 'orchestra', 'ledger', impl.id, 'casting-record.json');
  check('item 8: implementation casting-record persisted for a non-closing REVISE', fs.existsSync(implRecordPath));
}
{
  const { dir } = makeRepo(PASS_MANIFEST);
  const { store, reviewerTicket } = freshPending(dir);
  const majorApprove = approveVerdict({ findings: [{ severity: 'MAJOR', path: 'feature.js', line: 1, claim: 'edge case', reproduced: false, evidence: 'inspection' }] });
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', 'REVIEW RUN NONCE: n2\n' + verdictBlock(Object.assign({}, majorApprove, { run_nonce: 'n2' })));
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('MAJOR finding under APPROVE -> NOT_CLOSED', r.outcome === 'NOT_CLOSED', JSON.stringify(r));
}
{
  // Item 4: the nonce-echo check runs against the AUTHORITATIVE
  // engine_result.report, not any plain SubagentStop relay — so this
  // fixture must actually bind an engine_result whose own runner-asserted
  // nonce disagrees with its own verdict-json block's run_nonce.
  const { dir } = makeRepo(PASS_MANIFEST);
  const { store, reviewerTicket } = freshPending(dir);
  const engineReport = 'REVIEW ENGINE: OpenAI via Codex CLI\nREVIEW RUN NONCE: actual-nonce\n\n' + verdictBlock(approveVerdict({ run_nonce: 'declared-different-nonce' }));
  driveToResolvedViaEngine(store, reviewerTicket.id, 'reviewer-openai', engineReport, 'actual-nonce', engineReport);
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('run_nonce mismatch on the engine-bound verdict -> NOT_CLOSED', r.outcome === 'NOT_CLOSED' && /run_nonce mismatch/.test(r.reason), JSON.stringify(r));
}

section('6. close #2 — item 6: citation divergence excused only by a matching-path reproduced finding');
{
  const { dir } = makeRepo(PASS_MANIFEST);
  const { store, reviewerTicket } = freshPending(dir);
  const badCitation = approveVerdict({
    citation_replay: [{ citation: 'feature.js:1', command: 'node -e "process.exit(1)"', result: 'MATCH' }],
    findings: [{ severity: 'MINOR', path: 'unrelated-file.js', line: 9, claim: 'unrelated typo', reproduced: true, evidence: 'inspection' }],
  });
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', 'REVIEW RUN NONCE: n3\n' + verdictBlock(Object.assign({}, badCitation, { run_nonce: 'n3' })));
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('item 6: DIVERGES citation excused by an UNRELATED reproduced finding -> still NOT_CLOSED', r.outcome === 'NOT_CLOSED' && /citation MISMATCH/.test(r.reason), JSON.stringify(r));
}
{
  const { dir } = makeRepo(PASS_MANIFEST);
  const { store, reviewerTicket } = freshPending(dir);
  const excusedCitation = approveVerdict({
    citation_replay: [{ citation: 'feature.js:1', command: 'node -e "process.exit(1)"', result: 'MATCH' }],
    findings: [{ severity: 'MINOR', path: 'feature.js', line: 1, claim: 'the cited line is stale', reproduced: true, evidence: 'inspection' }],
  });
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', 'REVIEW RUN NONCE: n4\n' + verdictBlock(Object.assign({}, excusedCitation, { run_nonce: 'n4' })));
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('item 6: DIVERGES citation excused by a MATCHING-path reproduced finding -> CLOSED', r.ok === true && r.outcome === 'CLOSED', JSON.stringify(r));
}
{
  // Shakedown order #5 (PL-20): Sol cited `rg` (present in its sandbox, absent
  // on the closing host) and honestly listed the gdUnit run it could not
  // replay. Neither is a refuted claim — UNREPLAYABLE is a coverage gap, and
  // only a DIVERGES replay needs a matching-path reproduced finding.
  const { dir } = makeRepo(PASS_MANIFEST);
  const { store, reviewerTicket } = freshPending(dir);
  const honest = approveVerdict({
    citation_replay: [
      { citation: 'feature.js:1', command: 'node -e "process.exit(0)"', result: 'MATCH' },
      { citation: 'sandbox-only probe', command: 'definitely-not-a-command-orchestra-xyz -c x', result: 'MATCH' },
    ],
  });
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', 'REVIEW RUN NONCE: n5\n' + verdictBlock(Object.assign({}, honest, { run_nonce: 'n5' })));
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('item 6 (PL-20): a citation whose command the closing host cannot find is UNREPLAYABLE, not a mismatch -> CLOSED', r.ok === true && r.outcome === 'CLOSED', JSON.stringify(r));
  check('item 6 (PL-20): the audit still records it as UNREPLAYABLE / replayed:false', !!(r.audit && r.audit.citation_replay.some((c) => c.citation === 'sandbox-only probe' && c.result === 'UNREPLAYABLE' && c.replayed === false)), JSON.stringify(r.audit));
}

section('7. close #2 — item 4: codex-lane closure trusts engine_result.report, never the launcher relay');
{
  const { dir } = makeRepo(PASS_MANIFEST);
  const { store, impl, reviewerTicket } = freshPending(dir);
  const engineReport = 'REVIEW ENGINE: OpenAI via Codex CLI\nREVIEW RUN NONCE: actual-engine-nonce\n\n' + verdictBlock(approveVerdict({
    verdict: 'REVISE',
    run_nonce: 'actual-engine-nonce',
    findings: [{ severity: 'MAJOR', path: 'feature.js', line: 1, claim: 'broken', reproduced: true, evidence: 'ran it' }],
  }));
  const forgedRelay = 'REVIEW ENGINE: OpenAI via Codex CLI\nREVIEW RUN NONCE: forged-relay-nonce\n\n' + verdictBlock(approveVerdict({ run_nonce: 'forged-relay-nonce' }));
  driveToResolvedViaEngine(store, reviewerTicket.id, 'reviewer-openai', engineReport, 'actual-engine-nonce', forgedRelay);
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('item 4: engine-bound REVISE wins over a forged APPROVE relay -> NOT_CLOSED REVISE', r.outcome === 'NOT_CLOSED' && r.reason === 'REVISE', JSON.stringify(r));
  check('item 4: neither ticket was closed by the forged relay', T.get(store, impl.id).status !== 'CLOSED' && T.get(store, reviewerTicket.id).status !== 'CLOSED');
}
{
  // item 8, engine-lane variant: reviewer served_model telemetry comes from
  // the engine-reported verdict.served_model, never the launcher's own
  // (Haiku) ticket.launched.served_model.
  const { dir } = makeRepo(PASS_MANIFEST);
  const { store, reviewerTicket } = freshPending(dir);
  const engineReport = 'REVIEW ENGINE: OpenAI via Codex CLI\nREVIEW RUN NONCE: n5\n\n' + verdictBlock(approveVerdict({ run_nonce: 'n5', served_model: 'gpt-5.6-sol' }));
  driveToResolvedViaEngine(store, reviewerTicket.id, 'reviewer-openai', engineReport, 'n5', engineReport);
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('item 4/8 happy path: engine-bound APPROVE closes', r.ok === true && r.outcome === 'CLOSED', JSON.stringify(r));
  const revRecordPath = path.join(dir, '.claude', 'orchestra', 'ledger', reviewerTicket.id, 'casting-record.json');
  if (fs.existsSync(revRecordPath)) {
    const rec = JSON.parse(fs.readFileSync(revRecordPath, 'utf8'));
    check('item 8: reviewer served_model is the engine-reported identity, not the Haiku launcher', rec.served_model === 'gpt-5.6-sol', JSON.stringify(rec));
  }
}

section('8. close #2 — item 5: cross_family from familyOf(casting.model), never a forged author_family field');
{
  // No close #1 here (which would mint a second, real reviewer ticket that
  // this test never resolves — router/tickets.js's own close() refuses to
  // close an implementation ticket while ANY reviewer ticket naming it is
  // unresolved). Just dispatch + resolve the implementation, then hand-craft
  // the one forged reviewer ticket directly.
  const { dir } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, GREEN);
  const { dres, store } = dispatch(dir);
  const head = commitFeature(dir);
  const implId = dres.tickets.implementation.id;
  driveToResolved(store, implId, dres.tickets.implementation.role, bandCReport('DONE', head, reportIntegrityLine(dir, T.get(store, implId).task_id)));
  const impl = T.get(store, implId);
  // A forged reviewer ticket: genuinely Anthropic casting (same family as
  // the implementation), but its author_family field LIES and claims
  // 'openai'. If close #2 trusted author_family (the pre-repair-B defect),
  // this would be treated as cross-family and could close.
  const forged = T.issue(store, {
    kind: 'reviewer', task_id: impl.task_id, class: impl.class, role: 'reviewer-anthropic', rung: 'frontier', tier: null,
    casting: impl.casting, author_family: 'openai',
    reviewer_of: impl.id, config_hash: impl.config_hash,
  });
  driveToResolved(store, forged.id, 'reviewer-anthropic', verdictBlock(approveVerdict({ served_model: impl.casting.model })));
  const r = close.close({ ticket: T.get(store, forged.id), projectDir: dir, repoDir: dir, store });
  check('item 5: forged author_family cannot manufacture cross-family -> NOT_CLOSED same-family', r.outcome === 'NOT_CLOSED' && /same-family/.test(r.reason), JSON.stringify(r));
}

section('9. close #2 — item 7 (amended): gate-class closure is UNSUPPORTED_GATE_CLASS this tranche');
{
  const { dir } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, GREEN);
  const { dres, store } = dispatch(dir, { touches: ['auth'] }); // 'auth' is in castings.json's securityTriggerList
  const head = commitFeature(dir);
  const implId = dres.tickets.implementation.id;
  const taskId = T.get(store, implId).task_id;
  driveToResolved(store, implId, dres.tickets.implementation.role, bandCReport('DONE', head, reportIntegrityLine(dir, taskId)));
  const c1 = close.close({ ticket: T.get(store, implId), projectDir: dir, repoDir: dir, store });
  if (!c1.ok) { check('item 7 fixture: close #1 reached REVIEW_PENDING', false, JSON.stringify(c1)); }
  else {
    const reviewerTicket = c1.reviewer_ticket;
    driveToResolved(store, reviewerTicket.id, reviewerTicket.role, 'REVIEW RUN NONCE: n6\n' + verdictBlock(approveVerdict({ run_nonce: 'n6' })));
    const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
    check('item 7 (amended): gate-class (touches:auth) verdict -> NOT_CLOSED UNSUPPORTED_GATE_CLASS', r.outcome === 'NOT_CLOSED' && /UNSUPPORTED_GATE_CLASS/.test(r.reason), JSON.stringify(r));
  }
}

// ------------------------------------------------------------------ section 10

// ----------------------------------------------------------------- section 9b

section('9b. recon close (PL-10): an Investigator ticket (class N0, kind implementation) closes on its I0 VERDICT line, writes the casting record, runs no Verifier and mints no reviewer');

function i0Report(verdictLine) {
  return [
    'INVESTIGATION (I0) — question: why does lib.js export ok:true',
    '',
  ].concat(verdictLine ? [verdictLine, ''] : []).concat([
    'EVIDENCE CHAIN',
    '- lib.js:1 → the export is a literal',
    '',
    'REFUTATION DUTY',
    '- Evidence that would refute the leading hypothesis: a second export site — none found',
    '',
    'PHASE: read-only',
    '',
    'NEXT STEP: none',
  ]).join('\n') + '\n';
}
function dispatchRecon(dir) {
  // Not via dispatch(): baseRequest() pins tier:'dense' (a Builder-ladder
  // field the request schema rejects for a recon class), so the N0 request
  // is built whole here.
  const rt = createRuntime({ projectDir: dir, repoDir: dir });
  const dres = rt.dispatch({ class: 'N0', risk: 'T0', context_shape: 'scoped', goal: 'why does lib.js export ok:true', acceptance_criteria: ['the question is answered with citations'] });
  if (!dres.ok) throw new Error('fixture recon dispatch() refused: ' + JSON.stringify(dres));
  return { rt, dres, store: getStore(dir) };
}

{
  const { dir } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, GREEN);
  const { dres, store } = dispatchRecon(dir);
  const implId = dres.tickets.implementation.id;
  const t0 = T.get(store, implId);
  check('N0 dispatch mints a kind:implementation ticket of class N0 (the merged Investigator class)', t0.kind === 'implementation' && t0.class === 'N0', JSON.stringify(t0));
  check('close.isReconTicket() recognises it', close.isReconTicket(t0) === true, JSON.stringify(t0));
  driveToResolved(store, implId, t0.role, i0Report(null), 'claude-opus-5');
  const rNoVerdict = close.close({ ticket: T.get(store, implId), projectDir: dir, repoDir: dir, store });
  check('recon report WITHOUT a VERDICT line: NOT_CLOSED naming the VERDICT line', rNoVerdict.ok === false && rNoVerdict.outcome === 'NOT_CLOSED' && /VERDICT/.test(rNoVerdict.reason), JSON.stringify(rNoVerdict));
  check('...the ticket stays RESOLVED (retryable)', T.get(store, implId).status === 'RESOLVED', T.get(store, implId).status);
  check('...no casting record was written', !fs.existsSync(path.join(dir, '.claude', 'orchestra', 'ledger', implId, 'casting-record.json')), '');
}

{
  const { dir } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, GREEN);
  const { dres, store } = dispatchRecon(dir);
  const implId = dres.tickets.implementation.id;
  const t0 = T.get(store, implId);
  driveToResolved(store, implId, t0.role, i0Report('VERDICT: CONFIRMED'), 'claude-opus-5');
  const r = close.close({ ticket: T.get(store, implId), projectDir: dir, repoDir: dir, store });
  check('recon close: ok, outcome CLOSED, stage RECON_CLOSED, verdict CONFIRMED', r.ok === true && r.outcome === 'CLOSED' && r.stage === 'RECON_CLOSED' && r.verdict === 'CONFIRMED', JSON.stringify(r));
  check('the ticket is CLOSED in the store', T.get(store, implId).status === 'CLOSED', T.get(store, implId).status);
  check('...with a close reason carrying the verdict', /recon VERDICT: CONFIRMED/.test((T.get(store, implId).outcome || {}).reason || ''), JSON.stringify(T.get(store, implId).outcome));
  const recFile = path.join(dir, '.claude', 'orchestra', 'ledger', implId, 'casting-record.json');
  check('casting-record.json written under the ticket\'s ledger dir', fs.existsSync(recFile), '');
  const rec = fs.existsSync(recFile) ? JSON.parse(fs.readFileSync(recFile, 'utf8')) : {};
  check('casting record validates against casting-record.schema.json', validate(CASTING_RECORD_SCHEMA, rec).length === 0, validate(CASTING_RECORD_SCHEMA, rec).join('; '));
  check('casting record: class N0, role from the ticket, risk from the envelope, context_shape scoped, review_cross_family false',
    rec.class === 'N0' && rec.role === t0.role && rec.risk === 'T0' && rec.context_shape === 'scoped' && rec.review_cross_family === false && rec.status === 'DONE', JSON.stringify(rec));
  check('casting record: requested casting is the ticket\'s, served model recorded, mismatch computed (canonical name comparison)',
    JSON.stringify(rec.requested_casting) === JSON.stringify(t0.casting) && rec.served_model === 'claude-opus-5' && typeof rec.served_model_mismatch === 'boolean', JSON.stringify(rec));
  check('no verifier.json (no Verifier ran)', !fs.existsSync(path.join(dir, '.claude', 'orchestra', 'ledger', implId, 'verifier.json')), '');
  check('no reviewer ticket was minted', !Object.values(T.list(store)).some((t) => t && t.reviewer_of === implId), JSON.stringify(T.list(store)));
  const rAgain = close.close({ ticket: T.get(store, implId), projectDir: dir, repoDir: dir, store });
  check('a second close is refused (one-use: CLOSED is not RESOLVED)', rAgain.ok === false && rAgain.outcome === 'NOT_CLOSED', JSON.stringify(rAgain));
}

{
  // A real Builder ticket is untouched by the recon branch.
  const { dir } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, GREEN);
  const { dres, store } = dispatch(dir);
  const t0 = T.get(store, dres.tickets.implementation.id);
  check('an E1 Builder ticket is NOT a recon ticket (close #1 path unchanged)', close.isReconTicket(t0) === false, JSON.stringify(t0));
}

section('10. the grep-pin — "CLOSED" as a close code appears only in bridge/close.js');
{
  const offenders = [];
  const skipDirs = new Set(['node_modules', '.git']);
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skipDirs.has(entry.name)) continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!entry.name.endsWith('.js')) continue;
      const rel = path.relative(MASTER, p).split(path.sep).join('/');
      if (rel.startsWith('tests/')) continue; // this suite itself, and its neighbors, legitimately quote the code
      // router/tickets.js is the ticket state machine itself: close(store, id,
      // {code, reason}) just echoes whatever code its caller passed into
      // t.outcome — it is the mechanism, not a decision-maker that ISSUES a
      // close. The pin is about call sites that DECIDE to pass 'CLOSED'.
      if (rel === 'router/tickets.js') continue;
      const text = fs.readFileSync(p, 'utf8');
      if (/code:\s*['"]CLOSED['"]/.test(text) && rel !== 'bridge/close.js') offenders.push(rel);
    }
  })(MASTER);
  check("only bridge/close.js issues a 'CLOSED' close code", offenders.length === 0, JSON.stringify(offenders));
}
