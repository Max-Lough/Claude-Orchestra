#!/usr/bin/env node
/**
 * WO-14b leg 2a tests — the ticket state machine + store (router/tickets.js)
 * and its two contract schemas (registry/schemas/dispatch-request.schema.json,
 * registry/schemas/ticket.schema.json).
 *
 * Same house style as tests/router.test.js: a plain check(name, ok) runner,
 * no framework, no dependencies.
 *
 *   node tests/tickets.test.js
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const MASTER = path.resolve(__dirname, '..');
const T = require(path.join(MASTER, 'router', 'tickets.js'));
const { validate } = require(path.join(MASTER, 'verifier', 'schema-check.js'));

const DISPATCH_REQUEST_SCHEMA = JSON.parse(fs.readFileSync(path.join(MASTER, 'registry', 'schemas', 'dispatch-request.schema.json'), 'utf8'));
const TICKET_SCHEMA = JSON.parse(fs.readFileSync(path.join(MASTER, 'registry', 'schemas', 'ticket.schema.json'), 'utf8'));

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

function tmpDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanups.push(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
}
function freshStore(prefix) {
  const dir = tmpDir(prefix);
  return T.createTicketStore({ dir, init: true });
}
const CFG_HASH = crypto.createHash('sha256').update('castings+aliases+manifest fixture').digest('hex');

function baseFields(overrides) {
  return Object.assign({
    kind: 'implementation',
    task_id: 't-1',
    class: 'E2',
    role: 'Builder',
    rung: 'primary',
    casting: { vendor: 'anthropic', model: 'Sonnet 5', effort: 'med' },
    author_family: 'anthropic',
    config_hash: CFG_HASH,
  }, overrides || {});
}

// ============================================================ 1. schemas

section('1. dispatch-request.schema.json — accept/reject');

check('minimal valid request accepted', validate(DISPATCH_REQUEST_SCHEMA, { class: 'E2', risk: 'T1', goal: 'g', acceptance_criteria: ['a'] }).length === 0);
check('a request carrying integrity_nonce is rejected', validate(DISPATCH_REQUEST_SCHEMA, { class: 'E2', risk: 'T1', goal: 'g', acceptance_criteria: ['a'], integrity_nonce: 'deadbeefdeadbeef' }).length > 0);
check('a request carrying requested_casting is rejected', validate(DISPATCH_REQUEST_SCHEMA, { class: 'E2', risk: 'T1', goal: 'g', acceptance_criteria: ['a'], requested_casting: { vendor: 'anthropic', model: 'Sonnet 5', effort: 'med' } }).length > 0);
check('a request carrying author_family is rejected', validate(DISPATCH_REQUEST_SCHEMA, { class: 'E2', risk: 'T1', goal: 'g', acceptance_criteria: ['a'], author_family: 'anthropic' }).length > 0);
check('a request carrying review_policy is rejected', validate(DISPATCH_REQUEST_SCHEMA, { class: 'E2', risk: 'T1', goal: 'g', acceptance_criteria: ['a'], review_policy: 'mandatory' }).length > 0);
check('a request carrying implementation_author_family is rejected', validate(DISPATCH_REQUEST_SCHEMA, { class: 'E2', risk: 'T1', goal: 'g', acceptance_criteria: ['a'], implementation_author_family: 'openai' }).length > 0);
check('override without reason is rejected', validate(DISPATCH_REQUEST_SCHEMA, { class: 'E2', risk: 'T1', goal: 'g', acceptance_criteria: ['a'], override: { rung: 'deep' } }).length > 0);
check('override with a too-short reason is rejected', validate(DISPATCH_REQUEST_SCHEMA, { class: 'E2', risk: 'T1', goal: 'g', acceptance_criteria: ['a'], override: { rung: 'deep', reason: 'short' } }).length > 0);
check('override with rung+reason(>=8) is accepted', validate(DISPATCH_REQUEST_SCHEMA, { class: 'E2', risk: 'T1', goal: 'g', acceptance_criteria: ['a'], override: { rung: 'deep', reason: 'owner-approved escalation' } }).length === 0);
check('missing goal is rejected', validate(DISPATCH_REQUEST_SCHEMA, { class: 'E2', risk: 'T1', acceptance_criteria: ['a'] }).length > 0);
check('empty acceptance_criteria is rejected (minItems 1)', validate(DISPATCH_REQUEST_SCHEMA, { class: 'E2', risk: 'T1', goal: 'g', acceptance_criteria: [] }).length > 0);
check('an unknown class is rejected', validate(DISPATCH_REQUEST_SCHEMA, { class: 'Z9', risk: 'T1', goal: 'g', acceptance_criteria: ['a'] }).length > 0);
check('a fully-populated optional-field request is accepted', validate(DISPATCH_REQUEST_SCHEMA, {
  class: 'E2', risk: 'T2', goal: 'g', acceptance_criteria: ['a'],
  task_id: 'x', parent_ticket: 'tkt-0123456789abcdef', tier: 'dense',
  touches: ['auth'], context_shape: 'subsystem', scope_allow: ['src/**'], scope_deny: ['dist/**'],
  constraints: ['no new deps'], context_packet: 'packet text', verification_commands: ['node x.js'],
  verification_tier: 'full', tool_budget: 40, destructive_actions: [], human_authored: true, under_specified: false,
}).length === 0);

section('2. ticket.schema.json — accept/reject');

{
  const store = freshStore('tkt-schema-');
  const t = T.issue(store, baseFields());
  check('a freshly issued OPEN ticket validates against ticket.schema.json', validate(TICKET_SCHEMA, t).length === 0);
}
check('a ticket missing outcome is rejected (required)', (() => {
  const t = { id: 'tkt-0123456789abcdef', kind: 'implementation', task_id: 't', class: 'E2', role: 'Builder', rung: 'primary', tier: null, casting: { vendor: 'anthropic', model: 'Sonnet 5', effort: 'med' }, author_family: 'anthropic', parent_ticket: null, q0_ticket: null, reviewer_of: null, generation: 1, config_hash: CFG_HASH, issued_at: '2026-01-01T00:00:00.000Z', expires_at: '2026-01-01T06:00:00.000Z', status: 'OPEN', consumed: null, launched: null, resolved: null, attempts: [] };
  return validate(TICKET_SCHEMA, t).length > 0;
})());
check('a ticket with an unknown property is rejected (additionalProperties:false)', (() => {
  const store = freshStore('tkt-schema2-');
  const t = Object.assign({}, T.issue(store, baseFields()), { bogus: true });
  return validate(TICKET_SCHEMA, t).length > 0;
})());
check('a ticket id off the pattern is rejected', (() => {
  const store = freshStore('tkt-schema3-');
  const t = Object.assign({}, T.issue(store, baseFields()), { id: 'not-a-ticket-id' });
  return validate(TICKET_SCHEMA, t).length > 0;
})());
check('an invalid status enum value is rejected', (() => {
  const store = freshStore('tkt-schema4-');
  const t = Object.assign({}, T.issue(store, baseFields()), { status: 'BOGUS' });
  return validate(TICKET_SCHEMA, t).length > 0;
})());

// ==================================================== 3. leg-1 happy path

section('3. Happy path — verbatim leg-1 payload shapes (wo14b-leg1-lifecycle-proof-appendix.md)');

{
  const TOOL_USE_ID = 'toolu_01AuYt3hjvYc2Yws8FZriovJ';
  const AGENT_ID = 'a01ba92504d73e391';
  const RESOLVED_MODEL = 'claude-haiku-4-5-20251001';
  const LAST_ASSISTANT_MESSAGE = 'PROBE-AGENT-RESULT\nTICKET=tkt-aa11bb22cc33dd44';
  const AGENT_TRANSCRIPT_PATH = 'C:\\Users\\maxtl\\.claude\\projects\\C--Users-maxtl-AppData-Local-Temp-claude-C--Users-maxtl-Projects-Claude-Orchestra-157bcc07-bfcc-4328-b747-f8c512eb2d1c-scratchpad-leg1-target\\d787d05d-bcd7-4f4b-85b5-c531aaf2a430\\subagents\\agent-a01ba92504d73e391.jsonl';

  const store = freshStore('tkt-happy-');
  const issued = T.issue(store, baseFields({ role: 'probe-agent', task_id: 'leg1-probe' }));
  check('issue mints a tkt-<16 hex> id', /^tkt-[0-9a-f]{16}$/.test(issued.id) && issued.status === 'OPEN');

  const consumed = T.consume(store, issued.id, { tool_use_id: TOOL_USE_ID, role: 'probe-agent' });
  check('consume binds tool_use_id, status CONSUMED', consumed.status === 'CONSUMED' && consumed.consumed.tool_use_id === TOOL_USE_ID);

  const launched = T.launch(store, issued.id, { agent_id: AGENT_ID, served_model: RESOLVED_MODEL });
  check('launch binds agentId + resolvedModel verbatim, status LAUNCHED', launched.status === 'LAUNCHED' && launched.launched.agent_id === AGENT_ID && launched.launched.served_model === RESOLVED_MODEL);

  const resolved = T.resolve(store, issued.id, { agent_id: AGENT_ID, last_assistant_message: LAST_ASSISTANT_MESSAGE, agent_transcript_path: AGENT_TRANSCRIPT_PATH });
  check('resolve binds last_assistant_message + agent_transcript_path verbatim, status RESOLVED', resolved.status === 'RESOLVED' && resolved.resolved.last_assistant_message === LAST_ASSISTANT_MESSAGE && resolved.resolved.agent_transcript_path === AGENT_TRANSCRIPT_PATH);

  const closed = T.close(store, issued.id, { code: 'CLOSED' });
  check('close(CLOSED) on a resolved ticket with no reviewer requirement succeeds', closed.ok === true && closed.outcome === 'CLOSED' && closed.ticket.status === 'CLOSED' && closed.ticket.outcome.code === 'CLOSED');
  check('the fully-closed ticket still validates against ticket.schema.json', validate(TICKET_SCHEMA, closed.ticket).length === 0);
}

// ============================================= 4. refused transitions

section('4. Refused transitions throw TicketTransitionError; unlawful transitions never recorded');

check('consume on a non-OPEN ticket throws', (() => {
  const store = freshStore('tkt-t1-');
  const t = T.issue(store, baseFields());
  T.consume(store, t.id, { tool_use_id: 'tu', role: 'Builder' });
  try { T.consume(store, t.id, { tool_use_id: 'tu2', role: 'Builder' }); return false; }
  catch (e) { return e instanceof T.TicketTransitionError && /CONSUMED/.test(e.message); }
})());

check('launch on a non-CONSUMED (still OPEN) ticket throws, ticket status unchanged', (() => {
  const store = freshStore('tkt-t2-');
  const t = T.issue(store, baseFields());
  try { T.launch(store, t.id, { agent_id: 'a', served_model: 'm' }); return false; }
  catch (e) {
    const after = T.get(store, t.id);
    return e instanceof T.TicketTransitionError && /requires CONSUMED/.test(e.message) && after.status === 'OPEN';
  }
})());

check('resolve on a non-LAUNCHED (still CONSUMED) ticket throws', (() => {
  const store = freshStore('tkt-t3-');
  const t = T.issue(store, baseFields());
  T.consume(store, t.id, { tool_use_id: 'tu', role: 'Builder' });
  try { T.resolve(store, t.id, { agent_id: 'a', last_assistant_message: 'x', agent_transcript_path: 'p' }); return false; }
  catch (e) { return e instanceof T.TicketTransitionError && /requires LAUNCHED/.test(e.message); }
})());

check('resolve with a mismatched agent_id is refused', (() => {
  const store = freshStore('tkt-t4-');
  const t = T.issue(store, baseFields());
  T.consume(store, t.id, { tool_use_id: 'tu', role: 'Builder' });
  T.launch(store, t.id, { agent_id: 'agent-A', served_model: 'm' });
  try { T.resolve(store, t.id, { agent_id: 'agent-B', last_assistant_message: 'x', agent_transcript_path: 'p' }); return false; }
  catch (e) { return e instanceof T.TicketTransitionError && /launched as agent agent-A, not agent-B/.test(e.message); }
})());

check('close on a non-RESOLVED (still LAUNCHED) ticket throws', (() => {
  const store = freshStore('tkt-t5-');
  const t = T.issue(store, baseFields());
  T.consume(store, t.id, { tool_use_id: 'tu', role: 'Builder' });
  T.launch(store, t.id, { agent_id: 'a', served_model: 'm' });
  try { T.close(store, t.id, { code: 'CLOSED' }); return false; }
  catch (e) { return e instanceof T.TicketTransitionError && /requires RESOLVED/.test(e.message); }
})());

check('close(CLOSED) on an implementation ticket whose reviewer ticket is not RESOLVED is refused; succeeds once the reviewer resolves', (() => {
  const store = freshStore('tkt-t6-');
  const impl = T.issue(store, baseFields());
  T.consume(store, impl.id, { tool_use_id: 'tu-impl', role: 'Builder' });
  T.launch(store, impl.id, { agent_id: 'impl-agent', served_model: 'm' });
  T.resolve(store, impl.id, { agent_id: 'impl-agent', last_assistant_message: 'done', agent_transcript_path: 'p' });

  const rev = T.issue(store, baseFields({ kind: 'reviewer', role: 'Reviewer', rung: 'computed', reviewer_of: impl.id }));
  let refused = false;
  try { T.close(store, impl.id, { code: 'CLOSED' }); }
  catch (e) { refused = e instanceof T.TicketTransitionError && /reviewer ticket/.test(e.message); }

  T.consume(store, rev.id, { tool_use_id: 'tu-rev', role: 'Reviewer' });
  T.launch(store, rev.id, { agent_id: 'rev-agent', served_model: 'm' });
  T.resolve(store, rev.id, { agent_id: 'rev-agent', last_assistant_message: 'VERDICT: PASS', agent_transcript_path: 'p2' });

  const closed = T.close(store, impl.id, { code: 'CLOSED' });
  return refused && closed.ok === true && closed.ticket.status === 'CLOSED';
})());

check('close with a non-CLOSED code is a lawful, non-throwing NOT_CLOSED (status stays RESOLVED, reason kept, retryable)', (() => {
  const store = freshStore('tkt-t7-');
  const t = T.issue(store, baseFields());
  T.consume(store, t.id, { tool_use_id: 'tu', role: 'Builder' });
  T.launch(store, t.id, { agent_id: 'a', served_model: 'm' });
  T.resolve(store, t.id, { agent_id: 'a', last_assistant_message: 'x', agent_transcript_path: 'p' });
  const r = T.close(store, t.id, { code: 'REVIEW_REJECTED', reason: 'defect found in verification' });
  const stillResolved = r.ok === false && r.outcome === 'NOT_CLOSED' && r.ticket.status === 'RESOLVED' && r.ticket.outcome.code === 'NOT_CLOSED' && r.ticket.outcome.reason === 'defect found in verification';
  const retried = T.close(store, t.id, { code: 'CLOSED' });
  return stillResolved && retried.ok === true && retried.ticket.status === 'CLOSED';
})());

check('an unknown ticket id refuses every operation and is NOT recorded onto any real ticket', (() => {
  const store = freshStore('tkt-t8-');
  const bogus = 'tkt-0000000000000000';
  let all = true;
  for (const [fn, args] of [
    ['consume', [{ tool_use_id: 'x', role: 'Builder' }]],
    ['launch', [{ agent_id: 'x', served_model: 'm' }]],
    ['resolve', [{ agent_id: 'x', last_assistant_message: 'x', agent_transcript_path: 'p' }]],
    ['close', [{ code: 'CLOSED' }]],
  ]) {
    try { T[fn](store, bogus, ...args); all = false; }
    catch (e) { if (!(e instanceof T.TicketTransitionError) || !/unknown ticket/.test(e.message)) all = false; }
  }
  return all;
})());

// ==================================================== 5. replay + attempts

section('5. Replay refused and logged in attempts');

check('a replayed consume is refused and recorded in the ticket\'s attempts', (() => {
  const store = freshStore('tkt-replay-');
  const t = T.issue(store, baseFields());
  T.consume(store, t.id, { tool_use_id: 'tu1', role: 'Builder' });
  try { T.consume(store, t.id, { tool_use_id: 'tu2', role: 'Builder' }); } catch (e) { /* expected */ }
  try { T.consume(store, t.id, { tool_use_id: 'tu3', role: 'Builder' }); } catch (e) { /* expected */ }
  const after = T.get(store, t.id);
  const consumeAttempts = after.attempts.filter((a) => a.event === 'consume');
  return consumeAttempts.length === 2 && after.status === 'CONSUMED';
})());

// ==================================================== 6. wrong role

section('6. Wrong-role refused');

check('consuming with a role that does not match the ticket is refused, ticket stays OPEN', (() => {
  const store = freshStore('tkt-role-');
  const t = T.issue(store, baseFields({ role: 'Builder' }));
  try { T.consume(store, t.id, { tool_use_id: 'tu', role: 'Scout' }); return false; }
  catch (e) {
    const after = T.get(store, t.id);
    return e instanceof T.TicketTransitionError && /for role Builder, not Scout/.test(e.message) && after.status === 'OPEN';
  }
})());

// ==================================================== 7. expiry

section('7. Expiry');

check('consume refuses a ticket already past its ttl', (() => {
  const store = freshStore('tkt-exp1-');
  const t = T.issue(store, baseFields({ ttlMs: -60000 }));
  try { T.consume(store, t.id, { tool_use_id: 'tu', role: 'Builder' }); return false; }
  catch (e) { return e instanceof T.TicketTransitionError && /expired/.test(e.message); }
})());

check('expire() sweeps an OPEN ticket to EXPIRED once "now" passes expires_at', (() => {
  const store = freshStore('tkt-exp2-');
  const t = T.issue(store, baseFields({ ttlMs: 1000 }));
  const future = new Date(Date.parse(t.expires_at) + 1000);
  const swept = T.expire(store, { now: future });
  const after = T.get(store, t.id);
  return swept.includes(t.id) && after.status === 'EXPIRED' && after.outcome.code === 'EXPIRED';
})());

check('expire() sweeps a LAUNCHED ticket to EXPIRED (the killed-subagent case)', (() => {
  const store = freshStore('tkt-exp3-');
  const t = T.issue(store, baseFields({ ttlMs: 1000 }));
  T.consume(store, t.id, { tool_use_id: 'tu', role: 'Builder' });
  T.launch(store, t.id, { agent_id: 'a', served_model: 'm' });
  const future = new Date(Date.parse(t.expires_at) + 1000);
  T.expire(store, { now: future });
  return T.get(store, t.id).status === 'EXPIRED';
})());

check('expire() leaves a not-yet-expired ticket untouched', (() => {
  const store = freshStore('tkt-exp4-');
  const t = T.issue(store, baseFields({ ttlMs: 60 * 60 * 1000 }));
  T.expire(store, { now: new Date() });
  return T.get(store, t.id).status === 'OPEN';
})());

function realSleepMs(ms) {
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

// WO-14b leg 2 fix round, finding 2 (MAJOR, fixed): launch() never checked
// expires_at — a ticket consumed before expiry but launched after
// transitioned to LAUNCHED regardless. Same gap in resolve(). Both must
// transition to EXPIRED (a lawful CONSUMED->EXPIRED / LAUNCHED->EXPIRED
// edge) instead, typed-refusing the call that arrived too late.
check('finding 2: launch() on a ticket consumed before expiry but launched afterward transitions the ticket to EXPIRED, typed refusal, never LAUNCHED', (() => {
  const store = freshStore('tkt-exp5-');
  const t = T.issue(store, baseFields({ ttlMs: 300 })); // generous margin over the consume() fs round-trip
  T.consume(store, t.id, { tool_use_id: 'tu', role: 'Builder' }); // before expiry
  realSleepMs(400); // now past expires_at
  try {
    T.launch(store, t.id, { agent_id: 'a', served_model: 'm' });
    return false;
  } catch (e) {
    const after = T.get(store, t.id);
    return e instanceof T.TicketTransitionError && /expired/.test(e.message) &&
      after.status === 'EXPIRED' && after.outcome.code === 'EXPIRED' && after.launched === null;
  }
})());
check('finding 2: resolve() on a ticket launched before expiry but resolved afterward transitions the ticket to EXPIRED, typed refusal, never RESOLVED', (() => {
  const store = freshStore('tkt-exp6-');
  const t = T.issue(store, baseFields({ ttlMs: 300 })); // generous margin over the consume()+launch() fs round-trips
  T.consume(store, t.id, { tool_use_id: 'tu', role: 'Builder' });
  T.launch(store, t.id, { agent_id: 'a', served_model: 'm' }); // before expiry
  realSleepMs(400); // now past expires_at
  try {
    T.resolve(store, t.id, { agent_id: 'a', last_assistant_message: 'x', agent_transcript_path: 'p' });
    return false;
  } catch (e) {
    const after = T.get(store, t.id);
    return e instanceof T.TicketTransitionError && /expired/.test(e.message) &&
      after.status === 'EXPIRED' && after.outcome.code === 'EXPIRED' && after.resolved === null;
  }
})());
check('finding 2 report note: close() does NOT expire a RESOLVED ticket — RESOLVED is post-work; close(CLOSED) still succeeds even when called long after expires_at', (() => {
  const store = freshStore('tkt-exp7-');
  const t = T.issue(store, baseFields({ ttlMs: 300 })); // generous margin over the consume()+launch()+resolve() fs round-trips
  T.consume(store, t.id, { tool_use_id: 'tu', role: 'Builder' });
  T.launch(store, t.id, { agent_id: 'a', served_model: 'm' });
  T.resolve(store, t.id, { agent_id: 'a', last_assistant_message: 'x', agent_transcript_path: 'p' }); // all before expiry
  realSleepMs(400); // well past expires_at — but the ticket is already RESOLVED
  const closed = T.close(store, t.id, { code: 'CLOSED' });
  return closed.ok === true && closed.ticket.status === 'CLOSED';
})());

// ============================================ 8. generation bump / rollback

section('8. bumpGeneration invalidates every non-terminal ticket, leaves terminal ones untouched');

{
  const store = freshStore('tkt-gen-');
  const open = T.issue(store, baseFields({ task_id: 'gen-open' }));
  const consumedTkt = T.issue(store, baseFields({ task_id: 'gen-consumed' }));
  T.consume(store, consumedTkt.id, { tool_use_id: 'tu-c', role: 'Builder' });
  const launchedTkt = T.issue(store, baseFields({ task_id: 'gen-launched' }));
  T.consume(store, launchedTkt.id, { tool_use_id: 'tu-l', role: 'Builder' });
  T.launch(store, launchedTkt.id, { agent_id: 'a-l', served_model: 'm' });
  const resolvedTkt = T.issue(store, baseFields({ task_id: 'gen-resolved' }));
  T.consume(store, resolvedTkt.id, { tool_use_id: 'tu-r', role: 'Builder' });
  T.launch(store, resolvedTkt.id, { agent_id: 'a-r', served_model: 'm' });
  T.resolve(store, resolvedTkt.id, { agent_id: 'a-r', last_assistant_message: 'x', agent_transcript_path: 'p' });
  const closedTkt = T.issue(store, baseFields({ task_id: 'gen-closed' }));
  T.consume(store, closedTkt.id, { tool_use_id: 'tu-x', role: 'Builder' });
  T.launch(store, closedTkt.id, { agent_id: 'a-x', served_model: 'm' });
  T.resolve(store, closedTkt.id, { agent_id: 'a-x', last_assistant_message: 'x', agent_transcript_path: 'p' });
  T.close(store, closedTkt.id, { code: 'CLOSED' });
  const expiredTkt = T.issue(store, baseFields({ task_id: 'gen-expired', ttlMs: 1000 }));
  T.expire(store, { now: new Date(Date.parse(expiredTkt.expires_at) + 1000) });

  const genBefore = T.get(store, open.id).generation;
  const bump = T.bumpGeneration(store, 'roster:new -> legacy rollback');

  check('bumpGeneration increments store.generation', bump.generation === genBefore + 1);
  check('an OPEN ticket is invalidated with the reason', T.get(store, open.id).status === 'INVALIDATED' && T.get(store, open.id).outcome.reason === 'roster:new -> legacy rollback');
  check('a CONSUMED ticket is invalidated', T.get(store, consumedTkt.id).status === 'INVALIDATED');
  check('a LAUNCHED ticket is invalidated', T.get(store, launchedTkt.id).status === 'INVALIDATED');
  check('a RESOLVED (not yet closed) ticket is invalidated too — non-terminal is the rule, not a status allowlist', T.get(store, resolvedTkt.id).status === 'INVALIDATED');
  check('a CLOSED (terminal) ticket is left untouched', T.get(store, closedTkt.id).status === 'CLOSED');
  check('an EXPIRED (terminal) ticket is left untouched', T.get(store, expiredTkt.id).status === 'EXPIRED');
  check('a ticket consumed under the OLD generation can no longer be launched to matter — a fresh consume on it is refused by status, not generation (already non-OPEN)', (() => {
    try { T.consume(store, open.id, { tool_use_id: 'tu', role: 'Builder' }); return false; }
    catch (e) { return /INVALIDATED/.test(e.message); }
  })());
}

check('consume refuses a ticket whose generation does not match the current store generation', (() => {
  const store = freshStore('tkt-gen2-');
  const t = T.issue(store, baseFields());
  T.bumpGeneration(store, 'unrelated bump'); // invalidates t, but also proves the generation guard independently:
  const stale = T.issue(store, baseFields({ generation: 1 })); // minted claiming stale generation 1 while store is now at 2
  try { T.consume(store, stale.id, { tool_use_id: 'tu', role: 'Builder' }); return false; }
  catch (e) { return /generation/.test(e.message); }
})());

// ==================================================== 9. Q0-before-implementation

section('9. Q0-before-implementation ordering');

check('an implementation ticket with a q0_ticket refuses consume until the Q0 ticket is LAUNCHED or later', (() => {
  const store = freshStore('tkt-q0-');
  const q0 = T.issue(store, baseFields({ kind: 'q0', role: 'Test Designer', rung: 'vsAnthropicAuthor', casting: { vendor: 'openai', model: 'GPT-5.6 Terra', effort: 'med' }, author_family: 'openai' }));
  const impl = T.issue(store, baseFields({ q0_ticket: q0.id }));

  let refusedAtOpen = false;
  try { T.consume(store, impl.id, { tool_use_id: 'tu', role: 'Builder' }); }
  catch (e) { refusedAtOpen = e instanceof T.TicketTransitionError && /requires Q0 ticket/.test(e.message); }

  T.consume(store, q0.id, { tool_use_id: 'tu-q0', role: 'Test Designer' });
  let refusedAtConsumed = false;
  try { T.consume(store, impl.id, { tool_use_id: 'tu2', role: 'Builder' }); }
  catch (e) { refusedAtConsumed = e instanceof T.TicketTransitionError && /requires Q0 ticket/.test(e.message); }

  T.launch(store, q0.id, { agent_id: 'q0-agent', served_model: 'gpt-5.6-terra' });
  const allowed = T.consume(store, impl.id, { tool_use_id: 'tu3', role: 'Builder' });

  return refusedAtOpen && refusedAtConsumed && allowed.status === 'CONSUMED';
})());

check('an implementation ticket with no q0_ticket has no such gate', (() => {
  const store = freshStore('tkt-q0-none-');
  const impl = T.issue(store, baseFields());
  const c = T.consume(store, impl.id, { tool_use_id: 'tu', role: 'Builder' });
  return c.status === 'CONSUMED';
})());

// WO-14b leg 2 fix round, finding 5 (MAJOR, fixed): the Q0 gate used to
// accept ANY referenced ticket kind — a launched REVIEWER ticket sitting in
// the q0_ticket slot satisfied the gate. consume() must require the
// referenced ticket to exist, be kind:'q0', AND be LAUNCHED or later.
check('finding 5: a q0_ticket that references a LAUNCHED REVIEWER ticket (wrong kind) refuses consume, typed', (() => {
  const store = freshStore('tkt-q0-kind-');
  const reviewer = T.issue(store, baseFields({ kind: 'reviewer', role: 'Reviewer', rung: 'computed', reviewer_of: 'tkt-0000000000000000' }));
  T.consume(store, reviewer.id, { tool_use_id: 'tu-rev', role: 'Reviewer' });
  T.launch(store, reviewer.id, { agent_id: 'rev-agent', served_model: 'm' }); // reviewer ticket is LAUNCHED — the OLD gate only checked status, not kind
  const impl = T.issue(store, baseFields({ q0_ticket: reviewer.id }));
  try {
    T.consume(store, impl.id, { tool_use_id: 'tu-impl', role: 'Builder' });
    return false;
  } catch (e) {
    return e instanceof T.TicketTransitionError && /requires Q0 ticket .* to have kind 'q0'/.test(e.message) && T.get(store, impl.id).status === 'OPEN';
  }
})());
check('finding 5: a q0_ticket referencing a MISSING ticket id still refuses consume, typed (unchanged by the kind fix)', (() => {
  const store = freshStore('tkt-q0-missing-');
  const impl = T.issue(store, baseFields({ q0_ticket: 'tkt-ffffffffffffffff' }));
  try { T.consume(store, impl.id, { tool_use_id: 'tu', role: 'Builder' }); return false; }
  catch (e) { return e instanceof T.TicketTransitionError && /requires Q0 ticket .* to exist \(missing\)/.test(e.message); }
})());

// ==================================================== 10. events log

section('10. events log line count equals transitions + denials');

{
  const store = freshStore('tkt-events-');
  const t = T.issue(store, baseFields());                                   // 1 (issue)
  T.consume(store, t.id, { tool_use_id: 'tu', role: 'Builder' });           // 2 (consume)
  try { T.consume(store, t.id, { tool_use_id: 'tu2', role: 'Builder' }); } catch (e) { /* 3 (denied replay) */ }
  T.launch(store, t.id, { agent_id: 'a', served_model: 'm' });              // 4 (launch)
  T.resolve(store, t.id, { agent_id: 'a', last_assistant_message: 'x', agent_transcript_path: 'p' }); // 5 (resolve)
  T.close(store, t.id, { code: 'CLOSED' });                                 // 6 (close)
  T.denied(store, 'tkt-ffffffffffffffff', 'manual', 'forged id probe');     // 7 (unknown-id denial)
  const EXPECTED_LINES = 7;

  const lines = fs.readFileSync(path.join(store.dir, 'tickets.events.jsonl'), 'utf8').trim().split('\n').filter(Boolean);
  check('events.jsonl carries exactly one line per transition/denial (' + EXPECTED_LINES + ')', lines.length === EXPECTED_LINES, 'got ' + lines.length + ' lines');
  check('every event line is valid JSON with at/id/from/to/event/data', lines.every((l) => {
    const o = JSON.parse(l);
    return 'at' in o && 'id' in o && 'from' in o && 'to' in o && 'event' in o && 'data' in o;
  }));
}

// ==================================================== 11. atomic write

section('11. Atomic write leaves no temp file');

check('after a full lifecycle, the store directory carries no .tmp file', (() => {
  const store = freshStore('tkt-atomic-');
  const t = T.issue(store, baseFields());
  T.consume(store, t.id, { tool_use_id: 'tu', role: 'Builder' });
  T.launch(store, t.id, { agent_id: 'a', served_model: 'm' });
  T.resolve(store, t.id, { agent_id: 'a', last_assistant_message: 'x', agent_transcript_path: 'p' });
  T.close(store, t.id, { code: 'CLOSED' });
  const entries = fs.readdirSync(store.dir);
  return entries.every((e) => !e.endsWith('.tmp'));
})());

// ==================================================== 12. corrupted store

section('12. A corrupted or schema-invalid tickets.json makes every operation throw TicketStoreError');

function corruptedStoreDir(writeRaw) {
  const dir = tmpDir('tkt-corrupt-');
  const store = T.createTicketStore({ dir, init: true });
  T.issue(store, baseFields());
  fs.writeFileSync(path.join(dir, 'tickets.json'), writeRaw);
  return dir;
}

check('invalid JSON in tickets.json fails every operation closed', (() => {
  const dir = corruptedStoreDir('{ not json ][');
  const store = { dir };
  let all = true;
  try { T.createTicketStore({ dir }); all = false; } catch (e) { all = all && e instanceof T.TicketStoreError; }
  try { T.get(store, 'tkt-0000000000000000'); all = false; } catch (e) { all = all && e instanceof T.TicketStoreError; }
  try { T.list(store, {}); all = false; } catch (e) { all = all && e instanceof T.TicketStoreError; }
  try { T.issue(store, baseFields()); all = false; } catch (e) { all = all && e instanceof T.TicketStoreError; }
  return all;
})());

check('a store missing the generation field fails closed', (() => {
  const dir = corruptedStoreDir(JSON.stringify({ tickets: {}, unknown_attempts: [] }));
  const store = { dir };
  try { T.get(store, 'tkt-0000000000000000'); return false; } catch (e) { return e instanceof T.TicketStoreError && /generation/.test(e.message); }
})());

check('a store whose ticket fails the ticket schema fails closed', (() => {
  const dir = corruptedStoreDir(JSON.stringify({ generation: 1, tickets: { 'tkt-aaaaaaaaaaaaaaaa': { id: 'tkt-aaaaaaaaaaaaaaaa', status: 'OPEN' } }, unknown_attempts: [] }));
  const store = { dir };
  try { T.list(store, {}); return false; } catch (e) { return e instanceof T.TicketStoreError && /schema/.test(e.message); }
})());

check('a store that is valid JSON but not an object fails closed', (() => {
  const dir = corruptedStoreDir('null');
  const store = { dir };
  try { T.get(store, 'tkt-0000000000000000'); return false; } catch (e) { return e instanceof T.TicketStoreError; }
})());

// ==================================================== 13. concurrent writers

section('13. Two concurrent writer processes — no lost update');

{
  const dir = tmpDir('tkt-concurrent-');
  T.createTicketStore({ dir, init: true });
  const startGen = 1; // createTicketStore({init:true}) always starts a store at generation 1

  const N = 12;
  const workerScript = path.join(dir, 'worker.js');
  fs.writeFileSync(workerScript, `
    const T = require(${JSON.stringify(path.join(MASTER, 'router', 'tickets.js'))});
    const fs = require('fs');
    const path = require('path');
    const dir = process.argv[2];
    const label = process.argv[3];
    const n = Number(process.argv[4]);
    const store = { dir };
    for (let i = 0; i < n; i++) {
      T.bumpGeneration(store, 'concurrent-worker-' + label + '-' + i);
    }
    fs.writeFileSync(path.join(dir, 'worker-' + label + '.done'), 'ok');
  `);

  const children = ['A', 'B'].map((label) => spawn(process.execPath, [workerScript, dir, label, String(N)], { stdio: 'ignore' }));

  function sleepSync(ms) {
    const sab = new SharedArrayBuffer(4);
    Atomics.wait(new Int32Array(sab), 0, 0, ms);
  }
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline && !(fs.existsSync(path.join(dir, 'worker-A.done')) && fs.existsSync(path.join(dir, 'worker-B.done')))) {
    sleepSync(50);
  }
  const bothDone = fs.existsSync(path.join(dir, 'worker-A.done')) && fs.existsSync(path.join(dir, 'worker-B.done'));
  check('both concurrent workers finished within the deadline', bothDone);

  const final = JSON.parse(fs.readFileSync(path.join(dir, 'tickets.json'), 'utf8'));
  check('every increment from both processes landed — no lost update (generation = ' + startGen + ' + ' + (2 * N) + ')', final.generation === startGen + 2 * N, 'got generation ' + final.generation);

  // Confirm — via process.kill(pid, 0), which on every platform Node
  // supports (including Windows) only probes existence — that neither child
  // OS process is still alive before this suite ends; kill defensively if so.
  sleepSync(300);
  for (const c of children) {
    let alive = true;
    try { process.kill(c.pid, 0); } catch (e) { alive = false; }
    if (alive) { try { c.kill(); } catch (e) { /* best effort */ } sleepSync(300); }
  }
}

// ============================================ 14. stale-lock CAS takeover

section('14. Finding 1 — stale-lock takeover is a compare-and-swap; no lost update, no silent overwrite');

check('the stale-lock threshold defaults to 30s (raised from 10s) and is configurable per store',
  T._internal.DEFAULT_LOCK_STALE_MS === 30000 && typeof T._internal.LOCK_BUDGET_PAD_MS === 'number');

{
  // The reviewer's exact reproducer, fixed: one process's critical section
  // (fn() itself, deliberately slow) runs LONGER than the configured stale
  // threshold while a second process is trying to write. Before the fix, a
  // bare unlink-and-recreate let both processes believe they held the only
  // lock, and the loser's write silently vanished (the reviewer's probe:
  // generation 2 instead of 3). After the fix: the CAS takeover means at
  // most one of the two ever writes past the other's work — the "loser"
  // either never gets to write (genuinely serializes, no takeover needed)
  // or, if it holds long enough to look stale, is rejected with a typed
  // TicketStoreError when it tries to write past a takeover — never a
  // silent, undetected overwrite. Either way: generation === 1 + (number of
  // writers whose increment actually landed), and nothing is double-counted
  // or lost.
  const dir = tmpDir('tkt-cas-');
  T.createTicketStore({ dir, init: true });
  const STALE_MS = 300;
  const BUDGET_MS = 5000;
  const SLOW_DELAY_MS = 1500; // the "slow holder"'s critical section
  const FAST_STARTUP_DELAY_MS = 700; // > STALE_MS: by the time B looks, A's lock already reads stale

  const slowScript = path.join(dir, 'slow.js');
  fs.writeFileSync(slowScript, `
    'use strict';
    const T = require(${JSON.stringify(path.join(MASTER, 'router', 'tickets.js'))});
    const fs = require('fs');
    const path = require('path');
    const dir = ${JSON.stringify(dir)};
    function sleepSync(ms) { const sab = new SharedArrayBuffer(4); Atomics.wait(new Int32Array(sab), 0, 0, ms); }
    const store = { dir, lockStaleMs: ${STALE_MS}, lockBudgetMs: ${BUDGET_MS} };
    let outcome;
    try {
      T._internal.withStore(store, (data) => {
        sleepSync(${SLOW_DELAY_MS}); // simulate a writer whose critical section runs past the stale threshold
        data.generation += 1;
        const at = new Date().toISOString();
        return { data, result: null, events: [{ at, id: null, from: null, to: null, event: 'bumpGeneration', data: { generation: data.generation, reason: 'cas-slow-holder' } }] };
      });
      outcome = { ok: true };
    } catch (e) {
      outcome = { ok: false, name: e && e.name, message: e && e.message };
    }
    fs.writeFileSync(path.join(dir, 'slow.done'), JSON.stringify(outcome));
  `);
  const fastScript = path.join(dir, 'fast.js');
  fs.writeFileSync(fastScript, `
    'use strict';
    const T = require(${JSON.stringify(path.join(MASTER, 'router', 'tickets.js'))});
    const fs = require('fs');
    const path = require('path');
    const dir = ${JSON.stringify(dir)};
    function sleepSync(ms) { const sab = new SharedArrayBuffer(4); Atomics.wait(new Int32Array(sab), 0, 0, ms); }
    sleepSync(${FAST_STARTUP_DELAY_MS});
    const store = { dir, lockStaleMs: ${STALE_MS}, lockBudgetMs: ${BUDGET_MS} };
    let outcome;
    try {
      T.bumpGeneration(store, 'cas-fast-writer');
      outcome = { ok: true };
    } catch (e) {
      outcome = { ok: false, name: e && e.name, message: e && e.message };
    }
    fs.writeFileSync(path.join(dir, 'fast.done'), JSON.stringify(outcome));
  `);

  const children = [spawn(process.execPath, [slowScript], { stdio: 'ignore' }), spawn(process.execPath, [fastScript], { stdio: 'ignore' })];

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline && !(fs.existsSync(path.join(dir, 'slow.done')) && fs.existsSync(path.join(dir, 'fast.done')))) {
    realSleepMs(50);
  }
  const bothDone = fs.existsSync(path.join(dir, 'slow.done')) && fs.existsSync(path.join(dir, 'fast.done'));
  check('both the slow holder and the fast (takeover) writer finish within the deadline', bothDone);

  const slowOutcome = bothDone ? JSON.parse(fs.readFileSync(path.join(dir, 'slow.done'), 'utf8')) : null;
  const fastOutcome = bothDone ? JSON.parse(fs.readFileSync(path.join(dir, 'fast.done'), 'utf8')) : null;
  const final = JSON.parse(fs.readFileSync(path.join(dir, 'tickets.json'), 'utf8'));
  const successCount = [slowOutcome, fastOutcome].filter((o) => o && o.ok === true).length;

  check('the fast (takeover) writer completed successfully', !!(fastOutcome && fastOutcome.ok === true), JSON.stringify(fastOutcome));
  check('the slow holder either completed or failed with a TYPED TicketStoreError — never a silent bad outcome',
    !!(slowOutcome && (slowOutcome.ok === true || (slowOutcome.ok === false && slowOutcome.name === 'TicketStoreError'))),
    JSON.stringify(slowOutcome));
  check('no lost update: generation = 1 + (number of writers whose increment actually landed), never fewer',
    final.generation === 1 + successCount,
    'got generation ' + final.generation + ', successCount ' + successCount);
  check('no leftover tombstone files from the takeover rename', fs.readdirSync(dir).every((e) => !e.includes('.stale-')));
  check('the lock file itself is released (not left held forever) once both processes finish', !fs.existsSync(path.join(dir, 'tickets.lock')));

  realSleepMs(300);
  for (const c of children) {
    let alive = true;
    try { process.kill(c.pid, 0); } catch (e) { alive = false; }
    if (alive) { try { c.kill(); } catch (e) { /* best effort */ } realSleepMs(300); }
  }
}
