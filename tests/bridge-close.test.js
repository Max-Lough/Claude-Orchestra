#!/usr/bin/env node
/**
 * WO-14b leg 5 tests — bridge/close.js (two-stage closure) + bridge/telemetry.js.
 * Same house style as tests/bridge.test.js / tests/tickets.test.js: a plain
 * check(name, ok) runner, no framework, no dependencies. Temp git repos; no
 * live models.
 *
 *   node tests/bridge-close.test.js
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const MASTER = path.resolve(__dirname, '..');
const T = require(path.join(MASTER, 'router', 'tickets.js'));
const close = require(path.join(MASTER, 'bridge', 'close.js'));
const { validate } = require(path.join(MASTER, 'verifier', 'schema-check.js'));

const CASTING_RECORD_SCHEMA = JSON.parse(fs.readFileSync(path.join(MASTER, 'registry', 'schemas', 'casting-record.schema.json'), 'utf8'));
const VERDICT_AUDIT_SCHEMA = JSON.parse(fs.readFileSync(path.join(MASTER, 'registry', 'schemas', 'verdict-audit.schema.json'), 'utf8'));

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

const PASS_MANIFEST = JSON.stringify({ commands: [{ command: 'node -e "process.exit(0)"' }], coverage: 'complete', versions: [] }, null, 2);
const FAIL_MANIFEST = JSON.stringify({ commands: [{ command: 'node -e "process.exit(1)"' }], coverage: 'complete', versions: [] }, null, 2);

// A project dir that IS its own git repo (the installed single-repo layout):
// projectDir === repoDir throughout this suite. Returns { dir, base, head }.
function makeRepo(manifestJson) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-close-fixture-'));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  git(dir, ['init']);
  git(dir, ['config', 'user.email', 'bridge-close-suite@example.invalid']);
  git(dir, ['config', 'user.name', 'Bridge Close Suite']);
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'orchestra.json'), manifestJson);
  fs.writeFileSync(path.join(dir, 'lib.js'), "module.exports = { ok: true };\n");
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'base']);
  const base = git(dir, ['rev-parse', 'HEAD']);
  fs.writeFileSync(path.join(dir, 'feature.js'), "module.exports = { feature: true };\n");
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'add feature']);
  const head = git(dir, ['rev-parse', 'HEAD']);
  return { dir, base, head };
}

const GREEN = { 'AU-all': 0.95, 'AU-opus': 0.95, 'AU-fable': 0.95, 'OU': 0.95 };
const RED = { 'AU-all': 0.01, 'AU-opus': 0.01, 'AU-fable': 0.01, 'OU': 0.01 };
function seedReadings(dir, fractions) {
  const file = path.join(dir, '.claude', 'orchestra-pool-readings.jsonl');
  const lines = Object.entries(fractions).map(([bucket, remainingFraction]) => JSON.stringify({
    ts: new Date().toISOString(), kind: 'reading', bucket, remainingFraction, source: 'bridge-close.test.js fixture',
  }));
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

function writeRoutingEvent(dir, ticketId, request) {
  const file = path.join(dir, '.claude', 'orchestra', 'tickets', 'routing.events.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ request, outcome: { tickets: { implementation: { id: ticketId } } } }) + '\n');
}

function makeStore(dir) {
  return T.createTicketStore({ dir: path.join(dir, '.claude', 'orchestra', 'tickets'), init: true });
}

const CFG_HASH = 'a'.repeat(64);

function issueImpl(store, overrides) {
  return T.issue(store, Object.assign({
    kind: 'implementation', task_id: 'wo14b-close-task', class: 'E2', role: 'builder',
    rung: 'dense', tier: null, casting: { vendor: 'anthropic', model: 'claude-sonnet-5', effort: 'high' },
    author_family: 'anthropic', config_hash: CFG_HASH,
  }, overrides || {}));
}

function driveToResolved(store, ticketId, role, message, servedModel) {
  T.consume(store, ticketId, { tool_use_id: 'tu-' + ticketId, role });
  // The ticket schema requires a non-empty served_model once LAUNCHED (there
  // is no "not yet known" state for an already-resolved ticket) — the
  // runtime's own "genuinely exposed none" case is represented by the
  // literal string 'UNKNOWN' (report.schema.json's own vocabulary), passed
  // explicitly by callers that want that case, never by omission.
  T.launch(store, ticketId, { agent_id: 'agent-' + ticketId, served_model: servedModel || 'claude-sonnet-5-20260101' });
  return T.resolve(store, ticketId, { agent_id: 'agent-' + ticketId, last_assistant_message: message, agent_transcript_path: '/tmp/transcript-' + ticketId + '.jsonl' });
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

// ------------------------------------------------------------------ section 1

section('1. close #1 — refusals');
{
  const { dir, head } = makeRepo(PASS_MANIFEST);
  const store = makeStore(dir);

  const openTicket = issueImpl(store);
  const r1 = close.close({ ticket: openTicket, projectDir: dir, repoDir: dir, store });
  check('non-RESOLVED ticket refused', r1.outcome === 'NOT_CLOSED' && /RESOLVED/.test(r1.reason), JSON.stringify(r1));

  const revTicket = T.issue(store, {
    kind: 'reviewer', task_id: 't', class: 'E2', role: 'reviewer-openai', rung: 'frontier', tier: null,
    casting: { vendor: 'openai', model: 'gpt-5.6-sol', effort: 'high' }, author_family: 'openai',
    reviewer_of: 'tkt-0000000000000000', config_hash: CFG_HASH,
  });
  driveToResolved(store, revTicket.id, 'reviewer-openai', 'not a report at all');
  const revResolved = T.get(store, revTicket.id);
  const r2 = close.close({ ticket: revResolved, projectDir: dir, repoDir: dir, store });
  check('close #1 dispatch of a reviewer ticket goes through close #2, not close #1', r2.outcome === 'NOT_CLOSED');

  const q0 = T.issue(store, { kind: 'q0', task_id: 't', class: 'E2', role: 'sweeper', rung: 'dense', tier: null, casting: { vendor: 'anthropic', model: 'claude-sonnet-5', effort: 'med' }, author_family: 'anthropic', config_hash: CFG_HASH });
  T.consume(store, q0.id, { tool_use_id: 'tu-' + q0.id, role: 'sweeper' });
  T.launch(store, q0.id, { agent_id: 'agent-' + q0.id, served_model: 'claude-sonnet-5-20260101' }); // LAUNCHED, deliberately not RESOLVED
  const impl2 = issueImpl(store, { q0_ticket: q0.id });
  driveToResolved(store, impl2.id, 'builder', bandCReport('DONE', head));
  const r3 = close.close({ ticket: T.get(store, impl2.id), projectDir: dir, repoDir: dir, store });
  check('Q0-not-resolved refused', r3.outcome === 'NOT_CLOSED' && /q0/i.test(r3.reason), JSON.stringify(r3));

  const impl3 = issueImpl(store);
  driveToResolved(store, impl3.id, 'builder', bandCReport('BLOCKED', head));
  const r4 = close.close({ ticket: T.get(store, impl3.id), projectDir: dir, repoDir: dir, store });
  check('executor BLOCKED refused', r4.outcome === 'NOT_CLOSED' && /BLOCKED/.test(r4.reason), JSON.stringify(r4));

  const impl4 = issueImpl(store);
  driveToResolved(store, impl4.id, 'builder', 'STATUS: DONE\n\nCHANGES\n- none\n\nVERIFICATION\n- none\n\nDEVIATIONS\n- none\n\nCONCERNS\n- none\n');
  const r5 = close.close({ ticket: T.get(store, impl4.id), projectDir: dir, repoDir: dir, store });
  check('no commit named refused', r5.outcome === 'NOT_CLOSED' && /no commit named/.test(r5.reason), JSON.stringify(r5));

  const impl5 = issueImpl(store);
  driveToResolved(store, impl5.id, 'builder', bandCReport('DONE', head));
  const r6a = close.close({ ticket: T.get(store, impl5.id), projectDir: dir, repoDir: dir, store, report: 'FORGED STATUS: DONE COMMIT ffffffffffffffffffffffffffffffffffffffff' });
  check('caller-supplied report ignored (close() has no report param and never reads one)', r6a.outcome === 'NOT_CLOSED' && !/ffffffff/.test(r6a.reason || ''));
}

// ------------------------------------------------------------------ section 2

section('2. close #1 — verifier FAIL vs PASS');
{
  const { dir, head } = makeRepo(FAIL_MANIFEST);
  seedReadings(dir, GREEN);
  const store = makeStore(dir);
  const impl = issueImpl(store);
  writeRoutingEvent(dir, impl.id, { risk: 'T2', class: 'E2' });
  driveToResolved(store, impl.id, 'builder', bandCReport('DONE', head), 'claude-sonnet-5-20260101');
  const r = close.close({ ticket: T.get(store, impl.id), projectDir: dir, repoDir: dir, store });
  check('Verifier FAIL -> NOT_CLOSED', r.outcome === 'NOT_CLOSED' && /verifier FAIL/.test(r.reason), JSON.stringify(r));
  const reviewers = T.list(store).filter((t) => t.reviewer_of === impl.id);
  check('Verifier FAIL issues no reviewer ticket', reviewers.length === 0);
}

let PASS_FIXTURE = null; // shared into section 4/5 for close #2 tests
{
  const { dir, base, head } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, GREEN);
  const store = makeStore(dir);
  const impl = issueImpl(store);
  writeRoutingEvent(dir, impl.id, { risk: 'T2', class: 'E2' });
  driveToResolved(store, impl.id, 'builder', bandCReport('DONE', head), 'claude-sonnet-5-20260101');
  const r = close.close({ ticket: T.get(store, impl.id), projectDir: dir, repoDir: dir, store });
  check('Verifier PASS -> REVIEW_PENDING with the computed opposite family', r.ok === true && r.stage === 'REVIEW_PENDING' && r.reviewer_ticket && r.reviewer_ticket.author_family === 'openai', JSON.stringify(r));
  check('reviewer ticket carries the right subagent_type', !!r.ok && r.spawn.subagent_type === 'reviewer-openai', JSON.stringify(r && r.spawn));
  PASS_FIXTURE = { dir, base, head, store, impl: T.get(store, impl.id), reviewerTicket: r.ok ? r.reviewer_ticket : null };
}

section('3. close #1 — gated reviewer');
{
  const { dir, head } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, RED); // exhausts every lane, including the mandatory openai review lane
  const store = makeStore(dir);
  const impl = issueImpl(store);
  writeRoutingEvent(dir, impl.id, { risk: 'T2', class: 'E2' });
  driveToResolved(store, impl.id, 'builder', bandCReport('DONE', head), 'claude-sonnet-5-20260101');
  const r = close.close({ ticket: T.get(store, impl.id), projectDir: dir, repoDir: dir, store });
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
  }
  if (fs.existsSync(revRecordPath)) {
    const rec = JSON.parse(fs.readFileSync(revRecordPath, 'utf8'));
    check('reviewer casting-record is schema-valid', validate(CASTING_RECORD_SCHEMA, rec).length === 0, JSON.stringify(validate(CASTING_RECORD_SCHEMA, rec)));
    check('served_model UNKNOWN -> served_model_mismatch null', rec.served_model === 'UNKNOWN' && rec.served_model_mismatch === null, JSON.stringify(rec));
  }
  if (fs.existsSync(auditPath)) {
    const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    check('verdict-audit is schema-valid', validate(VERDICT_AUDIT_SCHEMA, audit).length === 0, JSON.stringify(validate(VERDICT_AUDIT_SCHEMA, audit)));
  }
}

section('5. close #2 — malformed / unavailable / non-closing verdicts');
function freshApprovedPair(opts) {
  const { dir, base, head } = makeRepo(PASS_MANIFEST);
  seedReadings(dir, GREEN);
  const store = makeStore(dir);
  const impl = issueImpl(store, opts && opts.implOverrides);
  writeRoutingEvent(dir, impl.id, { risk: 'T2', class: 'E2' });
  driveToResolved(store, impl.id, 'builder', bandCReport('DONE', head), 'claude-sonnet-5-20260101');
  const dispatchResult = close.close({ ticket: T.get(store, impl.id), projectDir: dir, repoDir: dir, store });
  return { dir, base, head, store, impl: T.get(store, impl.id), reviewerTicket: dispatchResult.reviewer_ticket, dispatchResult };
}

{
  const { dir, store, reviewerTicket } = freshApprovedPair();
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', 'REVIEW ENGINE: OpenAI via Codex CLI\n\nno block here at all\n');
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('no verdict-json block -> NOT_CLOSED malformed', r.outcome === 'NOT_CLOSED' && /malformed/.test(r.reason), JSON.stringify(r));
}
{
  const { dir, store, reviewerTicket } = freshApprovedPair();
  const two = verdictBlock(approveVerdict()) + '\n' + verdictBlock(approveVerdict());
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', two);
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('two verdict-json blocks -> NOT_CLOSED malformed', r.outcome === 'NOT_CLOSED' && /malformed/.test(r.reason), JSON.stringify(r));
}
{
  const { dir, store, reviewerTicket } = freshApprovedPair();
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', '```verdict-json\n{ not valid json\n```\n');
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('bad JSON in block -> NOT_CLOSED malformed', r.outcome === 'NOT_CLOSED' && /malformed/.test(r.reason), JSON.stringify(r));
}
{
  const { dir, store, reviewerTicket } = freshApprovedPair();
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', verdictBlock({ verdict: 'APPROVE' })); // fails schema: missing required fields
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('schema-failing block -> NOT_CLOSED malformed', r.outcome === 'NOT_CLOSED' && /malformed/.test(r.reason), JSON.stringify(r));
}
{
  const { dir, store, reviewerTicket } = freshApprovedPair();
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', 'VERDICT: REVIEW_UNAVAILABLE\nFINALITY: this runner made 3 engine attempts\n');
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('REVIEW_UNAVAILABLE text -> NOT_CLOSED review unavailable', r.outcome === 'NOT_CLOSED' && /review unavailable/.test(r.reason), JSON.stringify(r));
}
{
  const { dir, store, reviewerTicket } = freshApprovedPair();
  const revise = approveVerdict({ verdict: 'REVISE', findings: [{ severity: 'MAJOR', path: 'feature.js', line: 1, claim: 'broken', reproduced: true, evidence: 'ran it' }] });
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', 'REVIEW RUN NONCE: n1\n' + verdictBlock(Object.assign({}, revise, { run_nonce: 'n1' })));
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('REVISE -> NOT_CLOSED with findings attached', r.outcome === 'NOT_CLOSED' && r.reason === 'REVISE' && Array.isArray(r.findings) && r.findings.length === 1, JSON.stringify(r));
}
{
  const { dir, store, reviewerTicket } = freshApprovedPair();
  const majorApprove = approveVerdict({ findings: [{ severity: 'MAJOR', path: 'feature.js', line: 1, claim: 'edge case', reproduced: false, evidence: 'inspection' }] });
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', 'REVIEW RUN NONCE: n2\n' + verdictBlock(Object.assign({}, majorApprove, { run_nonce: 'n2' })));
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('MAJOR finding under APPROVE -> NOT_CLOSED', r.outcome === 'NOT_CLOSED', JSON.stringify(r));
}
{
  const { dir, store, reviewerTicket } = freshApprovedPair();
  const badCitation = approveVerdict({ citation_replay: [{ citation: 'fails', command: 'node -e "process.exit(1)"', result: 'MATCH' }] });
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', 'REVIEW RUN NONCE: n3\n' + verdictBlock(Object.assign({}, badCitation, { run_nonce: 'n3' })));
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('citation MISMATCH unexplained -> NOT_CLOSED', r.outcome === 'NOT_CLOSED' && /citation MISMATCH/.test(r.reason), JSON.stringify(r));
}
{
  const { dir, store, reviewerTicket } = freshApprovedPair();
  driveToResolved(store, reviewerTicket.id, 'reviewer-openai', 'REVIEW RUN NONCE: actual-nonce\n' + verdictBlock(approveVerdict({ run_nonce: 'declared-different-nonce' })));
  const r = close.close({ ticket: T.get(store, reviewerTicket.id), projectDir: dir, repoDir: dir, store });
  check('run_nonce mismatch on codex-lane verdict -> NOT_CLOSED', r.outcome === 'NOT_CLOSED' && /run_nonce mismatch/.test(r.reason), JSON.stringify(r));
}

section('6. close #2 — same-family (forged) reviewer ticket');
{
  const { dir, store, impl } = freshApprovedPair();
  const forged = T.issue(store, {
    kind: 'reviewer', task_id: impl.task_id, class: impl.class, role: 'reviewer-anthropic', rung: 'frontier', tier: null,
    casting: { vendor: 'anthropic', model: 'claude-opus-5', effort: 'high' }, author_family: 'anthropic',
    reviewer_of: impl.id, config_hash: impl.config_hash,
  });
  driveToResolved(store, forged.id, 'reviewer-anthropic', verdictBlock(approveVerdict({ served_model: 'claude-opus-5' })));
  const r = close.close({ ticket: T.get(store, forged.id), projectDir: dir, repoDir: dir, store });
  check('same-family reviewer ticket -> NOT_CLOSED', r.outcome === 'NOT_CLOSED' && /same-family/.test(r.reason), JSON.stringify(r));
}

// ------------------------------------------------------------------ section 7

section('7. the grep-pin — "CLOSED" as a close code appears only in bridge/close.js');
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
