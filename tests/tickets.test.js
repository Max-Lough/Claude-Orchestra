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
const ORDER_SCHEMA = JSON.parse(fs.readFileSync(path.join(MASTER, 'registry', 'schemas', 'order.schema.json'), 'utf8'));

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

// WO-14b leg 2 fix round 2 (finding 3, MAJOR, fixed): review #2 found the
// restored M0 video/audio UNAVAILABLE guard unreachable through the public
// request contract — dispatch-request.schema.json rejected `medium` as an
// additional property, so a Conductor submitting medium:"videoAudio" could
// never trigger it. Both dispatch-request.schema.json and order.schema.json
// now carry an optional `medium` enum (documents/images/videoAudio),
// additive, otherwise ignored.
check('finding 3: a dispatch-request carrying medium:"documents" is accepted', validate(DISPATCH_REQUEST_SCHEMA, { class: 'M0', risk: 'T1', goal: 'g', acceptance_criteria: ['a'], medium: 'documents' }).length === 0);
check('finding 3: a dispatch-request carrying medium:"videoAudio" is accepted (the schema-validated M0 intake modality)', validate(DISPATCH_REQUEST_SCHEMA, { class: 'M0', risk: 'T1', goal: 'g', acceptance_criteria: ['a'], medium: 'videoAudio' }).length === 0);
check('finding 3: a dispatch-request carrying an unrecognized medium value is rejected', validate(DISPATCH_REQUEST_SCHEMA, { class: 'M0', risk: 'T1', goal: 'g', acceptance_criteria: ['a'], medium: 'audio-only' }).length > 0);

function baseOrder(overrides) {
  return Object.assign({
    task_id: 't-1', class: 'M0', risk: 'T1',
    requested_casting: { vendor: 'anthropic', model: 'Sonnet 5', effort: 'med' },
    author_family: 'anthropic', co_author_families: [],
    goal: 'g', acceptance_criteria: ['a'],
    review_policy: 'mandatory', integrity_nonce: 'deadbeefdeadbeef',
  }, overrides || {});
}
check('finding 3: a routed order carrying medium:"videoAudio" is accepted by order.schema.json', validate(ORDER_SCHEMA, baseOrder({ medium: 'videoAudio' })).length === 0);
check('finding 3: a routed order carrying an unrecognized medium value is rejected by order.schema.json', validate(ORDER_SCHEMA, baseOrder({ medium: 'audio-only' })).length > 0);
check('finding 3: a routed order with no medium at all is still accepted (additive, optional)', validate(ORDER_SCHEMA, baseOrder()).length === 0);

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
  const dir = corruptedStoreDir(JSON.stringify({ generation: 1, seq: 1, tickets: { 'tkt-aaaaaaaaaaaaaaaa': { id: 'tkt-aaaaaaaaaaaaaaaa', status: 'OPEN' } }, unknown_attempts: [] }));
  const store = { dir };
  try { T.list(store, {}); return false; } catch (e) { return e instanceof T.TicketStoreError && /schema/.test(e.message); }
})());

check('a store missing the seq field fails closed', (() => {
  const dir = corruptedStoreDir(JSON.stringify({ generation: 1, tickets: {}, unknown_attempts: [] }));
  const store = { dir };
  try { T.get(store, 'tkt-0000000000000000'); return false; } catch (e) { return e instanceof T.TicketStoreError && /seq/.test(e.message); }
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

// ============================================ 14. liveness-gated lock

section('14. Fix round 2, finding 1 — lock takeover is liveness-gated: a live holder is NEVER taken over; a provably dead one IS');

check('the stale-lock threshold defaults to 30s (raised from 10s in fix round 1) and is configurable per store',
  T._internal.DEFAULT_LOCK_STALE_MS === 30000 && typeof T._internal.LOCK_BUDGET_PAD_MS === 'number');
check('isPidAlive: this process\'s own pid reads alive',
  T._internal.isPidAlive(process.pid) === true);
check('isPidAlive: a non-numeric or missing pid is treated as dead outright (never a throw)',
  T._internal.isPidAlive('not-a-pid') === false && T._internal.isPidAlive(undefined) === false && T._internal.isPidAlive(null) === false && T._internal.isPidAlive(NaN) === false);

// 14a. Review #2's exact reproducer, this time fixed at the design level
// rather than merely patched: a holder is genuinely ALIVE and merely slow
// (its critical section runs past lockStaleMs). A second writer arriving
// must WAIT, observe staleness, but — because the holder is alive — never
// take over; when its OWN budget (deliberately shorter than the holder's
// critical section) expires it fails closed with a typed TicketStoreError
// naming the live pid. The holder, never preempted, completes normally and
// its write lands. No lost update, no silent overwrite, no takeover of a
// live process at all.
{
  const dir = tmpDir('tkt-live-');
  T.createTicketStore({ dir, init: true });
  const STALE_MS = 300;
  const HOLDER_BUDGET_MS = 10000; // the holder isn't waiting on anyone
  const WAITER_BUDGET_MS = 700;   // > STALE_MS (observes staleness) but well under the holder's critical section — forces a genuine timeout against a still-alive holder
  const HOLDER_CRITICAL_SECTION_MS = 2200;

  const holderScript = path.join(dir, 'holder.js');
  fs.writeFileSync(holderScript, `
    'use strict';
    const T = require(${JSON.stringify(path.join(MASTER, 'router', 'tickets.js'))});
    const fs = require('fs');
    const path = require('path');
    const dir = ${JSON.stringify(dir)};
    function sleepSync(ms) { const sab = new SharedArrayBuffer(4); Atomics.wait(new Int32Array(sab), 0, 0, ms); }
    const store = { dir, lockStaleMs: ${STALE_MS}, lockBudgetMs: ${HOLDER_BUDGET_MS} };
    let outcome;
    try {
      T._internal.withStore(store, (data) => {
        sleepSync(${HOLDER_CRITICAL_SECTION_MS}); // alive and busy for well past STALE_MS
        data.generation += 1;
        const at = new Date().toISOString();
        return { data, result: null, events: [{ at, id: null, from: null, to: null, event: 'bumpGeneration', data: { generation: data.generation, reason: 'live-holder' } }] };
      });
      outcome = { ok: true };
    } catch (e) {
      outcome = { ok: false, name: e && e.name, message: e && e.message };
    }
    fs.writeFileSync(path.join(dir, 'holder.done'), JSON.stringify(outcome));
  `);
  const waiterScript = path.join(dir, 'waiter.js');
  fs.writeFileSync(waiterScript, `
    'use strict';
    const T = require(${JSON.stringify(path.join(MASTER, 'router', 'tickets.js'))});
    const fs = require('fs');
    const path = require('path');
    const dir = ${JSON.stringify(dir)};
    function sleepSync(ms) { const sab = new SharedArrayBuffer(4); Atomics.wait(new Int32Array(sab), 0, 0, ms); }
    sleepSync(400); // let the holder acquire and start its critical section first
    const store = { dir, lockStaleMs: ${STALE_MS}, lockBudgetMs: ${WAITER_BUDGET_MS} };
    let outcome;
    try {
      T.bumpGeneration(store, 'waiter-must-never-take-over-a-live-holder');
      outcome = { ok: true };
    } catch (e) {
      outcome = { ok: false, name: e && e.name, message: e && e.message };
    }
    fs.writeFileSync(path.join(dir, 'waiter.done'), JSON.stringify(outcome));
  `);

  const children = [spawn(process.execPath, [holderScript], { stdio: 'ignore' }), spawn(process.execPath, [waiterScript], { stdio: 'ignore' })];
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline && !(fs.existsSync(path.join(dir, 'holder.done')) && fs.existsSync(path.join(dir, 'waiter.done')))) {
    realSleepMs(50);
  }
  const bothDone = fs.existsSync(path.join(dir, 'holder.done')) && fs.existsSync(path.join(dir, 'waiter.done'));
  check('14a: both the live holder and the waiter finish within the deadline', bothDone);

  const holderOutcome = bothDone ? JSON.parse(fs.readFileSync(path.join(dir, 'holder.done'), 'utf8')) : null;
  const waiterOutcome = bothDone ? JSON.parse(fs.readFileSync(path.join(dir, 'waiter.done'), 'utf8')) : null;
  check('14a: the live (slow) holder completes successfully — never preempted', !!(holderOutcome && holderOutcome.ok === true), JSON.stringify(holderOutcome));
  check('14a: the waiter never takes over a live holder — it fails closed with a typed TicketStoreError naming the live pid',
    !!(waiterOutcome && waiterOutcome.ok === false && waiterOutcome.name === 'TicketStoreError' && /lock held by live pid \d+ for > budget/.test(waiterOutcome.message)),
    JSON.stringify(waiterOutcome));

  const final = JSON.parse(fs.readFileSync(path.join(dir, 'tickets.json'), 'utf8'));
  check('14a: no lost update — generation = 1 + exactly the one successful call (the waiter never landed)', final.generation === 2, 'got generation ' + final.generation);
  check('14a: no tombstone was ever created — the waiter never attempted a takeover of a live holder', fs.readdirSync(dir).every((e) => !e.includes('.stale-')));
  check('14a: the lock file is released once the live holder finishes', !fs.existsSync(path.join(dir, 'tickets.lock')));

  realSleepMs(300);
  for (const c of children) {
    let alive = true;
    try { process.kill(c.pid, 0); } catch (e) { alive = false; }
    if (alive) { try { c.kill(); } catch (e) { /* best effort */ } realSleepMs(300); }
  }
}

// 14b. A provably DEAD holder — its OS process actually killed (SIGKILL)
// while it held the lock — IS taken over once the lock is also past
// lockStaleMs, via the CAS tombstone rename, and the store remains
// consistent afterward.
{
  const dir = tmpDir('tkt-dead-');
  T.createTicketStore({ dir, init: true });
  const STALE_MS = 300;

  const doomedScript = path.join(dir, 'doomed.js');
  fs.writeFileSync(doomedScript, `
    'use strict';
    const T = require(${JSON.stringify(path.join(MASTER, 'router', 'tickets.js'))});
    function sleepSync(ms) { const sab = new SharedArrayBuffer(4); Atomics.wait(new Int32Array(sab), 0, 0, ms); }
    const store = { dir: ${JSON.stringify(dir)}, lockStaleMs: ${STALE_MS}, lockBudgetMs: 30000 };
    T._internal.withStore(store, (data) => {
      sleepSync(60000); // never reached in practice — this process is killed from outside first
      return { data, result: null, events: [] };
    });
  `);
  const doomed = spawn(process.execPath, [doomedScript], { stdio: 'ignore' });

  const lockPath = path.join(dir, 'tickets.lock');
  const acquireDeadline = Date.now() + 10000;
  while (Date.now() < acquireDeadline && !fs.existsSync(lockPath)) realSleepMs(25);
  check('14b: the doomed holder actually acquired the lock before being killed', fs.existsSync(lockPath));

  try { process.kill(doomed.pid, 'SIGKILL'); } catch (e) { /* already gone */ }
  realSleepMs(400); // let the OS actually reap it
  let doomedAlive = true;
  try { process.kill(doomed.pid, 0); } catch (e) { doomedAlive = false; }
  check('14b: the doomed holder\'s OS process is confirmed dead', !doomedAlive);

  realSleepMs(STALE_MS + 200); // cross the staleness threshold with the holder already dead

  const store = { dir, lockStaleMs: STALE_MS, lockBudgetMs: 5000 };
  let takeoverOutcome;
  try {
    const r = T.bumpGeneration(store, 'takeover-of-a-dead-holder');
    takeoverOutcome = { ok: true, generation: r.generation };
  } catch (e) {
    takeoverOutcome = { ok: false, name: e.name, message: e.message };
  }
  check('14b: a second writer takes over the dead holder\'s lock and its write lands', !!(takeoverOutcome && takeoverOutcome.ok === true), JSON.stringify(takeoverOutcome));

  const final = JSON.parse(fs.readFileSync(path.join(dir, 'tickets.json'), 'utf8'));
  check('14b: the store is consistent after takeover — generation = 2 (genesis 1 + the taker\'s one increment)', final.generation === 2, 'got generation ' + final.generation);
  check('14b: no leftover tombstone file after takeover', fs.readdirSync(dir).every((e) => !e.includes('.stale-')));
  check('14b: the lock file is released (not left held) after the takeover completes', !fs.existsSync(lockPath));
}

// 14c. Fix round 3 (review #3, MAJOR #1, tickets.js:192): the lock is now a
// DIRECTORY, and owner.json inside it can be missing or half-written (a
// holder that crashed after mkdirSync but before/mid owner.json write).
// The review's exact reproducer: a probe with a short budget spun 10s
// instead of taking over or throwing. Every such "unknown holder" case must
// (a) take over cleanly once past staleMs (aged off the lock DIRECTORY's
// own timestamp, since there's no pid to check), and (b) when still fresh,
// fail closed with a typed TicketStoreError WITHIN budget + 200ms — never
// spin.
{
  const dir = tmpDir('tkt-unknownholder-');
  T.createTicketStore({ dir, init: true });
  const lockDir = T._internal.lockFile(dir);

  function probeFreshUnknownHolder(label, makeLockDir) {
    makeLockDir();
    const BUDGET = 150;
    const store = { dir, lockStaleMs: 10000, lockBudgetMs: BUDGET };
    const t0 = Date.now();
    let threw = null;
    try { T.bumpGeneration(store, 'probe-' + label); } catch (e) { threw = e; }
    const elapsed = Date.now() - t0;
    check('14c: ' + label + ' (fresh) — waiter fails closed with a typed TicketStoreError within budget(' + BUDGET + 'ms) + 200ms, never spins',
      threw instanceof T.TicketStoreError && elapsed <= BUDGET + 200,
      'elapsed=' + elapsed + 'ms threw=' + (threw && threw.name + ': ' + threw.message));
    fs.rmSync(lockDir, { recursive: true, force: true });
  }

  function probeStaleUnknownHolder(label, makeLockDir) {
    makeLockDir();
    const STALE = 300;
    realSleepMs(STALE + 250); // age the lock dir past staleness via the wall clock (birthtime isn't fakeable cross-platform)
    const before = JSON.parse(fs.readFileSync(path.join(dir, 'tickets.json'), 'utf8'));
    const store = { dir, lockStaleMs: STALE, lockBudgetMs: 5000 };
    let outcome;
    try { outcome = { ok: true, r: T.bumpGeneration(store, 'takeover-' + label) }; }
    catch (e) { outcome = { ok: false, name: e.name, message: e.message }; }
    check('14c: ' + label + ' (stale) — taken over cleanly once past staleMs, write lands',
      !!(outcome.ok && outcome.r.generation === before.generation + 1), JSON.stringify(outcome));
    check('14c: ' + label + ' (stale) — no leftover tombstone after takeover', fs.readdirSync(dir).every((e) => !e.includes('.tomb-')));
  }

  probeFreshUnknownHolder('half-written owner.json', () => {
    fs.mkdirSync(lockDir);
    fs.writeFileSync(path.join(lockDir, 'owner.json'), '{"pid": '); // truncated mid-write — unparseable
  });
  probeStaleUnknownHolder('half-written owner.json', () => {
    fs.mkdirSync(lockDir);
    fs.writeFileSync(path.join(lockDir, 'owner.json'), '{"pid": '); // truncated mid-write — unparseable
  });
  probeFreshUnknownHolder('lock dir with no owner.json at all', () => {
    fs.mkdirSync(lockDir); // owner.json never created — the crash-right-after-mkdirSync case
  });
  probeStaleUnknownHolder('lock dir with no owner.json at all', () => {
    fs.mkdirSync(lockDir);
  });
}

// ==================================================== 15. seq

section('15. Fix round 2, finding 1 — seq: every committed write increments it by exactly one; event lines carry the matching seq');

{
  const store = freshStore('tkt-seq-');
  const before = JSON.parse(fs.readFileSync(path.join(store.dir, 'tickets.json'), 'utf8'));
  check('a freshly initialized store starts at seq 0', before.seq === 0);

  const t = T.issue(store, baseFields());                                        // 0 -> 1
  T.consume(store, t.id, { tool_use_id: 'tu', role: 'Builder' });                // 1 -> 2
  try { T.consume(store, t.id, { tool_use_id: 'tu2', role: 'Builder' }); } catch (e) { /* denied, still a committed write: 2 -> 3 */ }
  T.launch(store, t.id, { agent_id: 'a', served_model: 'm' });                   // 3 -> 4
  T.resolve(store, t.id, { agent_id: 'a', last_assistant_message: 'x', agent_transcript_path: 'p' }); // 4 -> 5
  T.close(store, t.id, { code: 'CLOSED' });                                      // 5 -> 6

  const after = JSON.parse(fs.readFileSync(path.join(store.dir, 'tickets.json'), 'utf8'));
  check('seq incremented by exactly one per committed write (6 writes -> seq 6)', after.seq === 6, 'got seq ' + after.seq);

  const lines = fs.readFileSync(path.join(store.dir, 'tickets.events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const seqs = lines.map((l) => l.seq);
  check('every event line carries a numeric seq', seqs.every((s) => typeof s === 'number'));
  check('the highest event seq equals the final store seq', Math.max(...seqs) === after.seq);
  check('seqs used are exactly 1..6, one per committed write (none skipped, none repeated across different writes)',
    Array.from(new Set(seqs)).sort((a, b) => a - b).join(',') === '1,2,3,4,5,6', 'got seqs ' + seqs.join(','));
}

// ==================================================== 16. unwritable events log

section('16. Fix round 2, finding 2 — an unwritable events log leaves the state UNCHANGED and throws TicketStoreError');

check('events log path replaced by a directory: issue() throws TicketStoreError, tickets.json byte-identical after, no ticket created',
  (() => {
    const dir = tmpDir('tkt-unwritable-');
    const store = T.createTicketStore({ dir, init: true });
    const eventsPath = T._internal.eventsFile(dir);
    fs.mkdirSync(eventsPath); // makes every append attempt fail closed, on every OS — unlike chmod, which Windows does not reliably enforce
    const before = fs.readFileSync(path.join(dir, 'tickets.json'), 'utf8');
    let threw = null;
    try { T.issue(store, baseFields()); } catch (e) { threw = e; }
    const after = fs.readFileSync(path.join(dir, 'tickets.json'), 'utf8');
    const afterParsed = JSON.parse(after);
    return threw instanceof T.TicketStoreError && before === after && Object.keys(afterParsed.tickets).length === 0 && afterParsed.seq === 0;
  })());

check('_fs hook: an injected failing appendFileSync leaves state unchanged and throws TicketStoreError, zero bytes appended to the log',
  (() => {
    const dir = tmpDir('tkt-fshook-');
    const store = T.createTicketStore({ dir, init: true, _fs: { appendFileSync: () => { throw new Error('simulated append failure'); } } });
    const before = fs.readFileSync(path.join(dir, 'tickets.json'), 'utf8');
    let threw = null;
    try { T.issue(store, baseFields()); } catch (e) { threw = e; }
    const after = fs.readFileSync(path.join(dir, 'tickets.json'), 'utf8');
    const eventsRaw = fs.existsSync(path.join(dir, 'tickets.events.jsonl')) ? fs.readFileSync(path.join(dir, 'tickets.events.jsonl'), 'utf8') : '';
    return threw instanceof T.TicketStoreError && /append failed/.test(threw.message) && before === after && eventsRaw.trim() === '';
  })());

// ==================================================== 17. crash between append and rename

section('17. Fix round 3 (review #3, MAJOR #2, tickets.js:273) — reconciliation is a writer-only, under-lock operation');

// Review #3's exact defect: the OLD reconcileEventsLog() ran on every
// UNLOCKED load (get/list/openTickets), so a reader racing a genuinely
// in-flight writer (event appended, state not yet committed) recorded that
// event as "dropped" even though the writer went on to commit it normally
// — an independent probe reproduced committed generation 2/seq 1 while the
// log simultaneously carried both the real event AND a reconcile marking
// it dropped. Reconciliation now happens ONLY inside withStore(), only
// after the lock is held (so no writer can possibly be in flight — a
// logged seq > state.seq at that point is a genuine crash-orphan, not a
// race).
{
  const store = freshStore('tkt-orphan-read-');
  const t = T.issue(store, baseFields()); // seq 0 -> 1, committed normally
  const before = JSON.parse(fs.readFileSync(path.join(store.dir, 'tickets.json'), 'utf8'));

  // Simulate exactly the crash window: append an event carrying seq+1
  // directly (bypassing withStore) and do NOT write state — this is what a
  // process death between the event append and the state rename leaves
  // behind. From an unlocked reader's point of view this is indistinguishable
  // from a live writer mid-flight — which is exactly why a reader must never
  // reconcile it.
  const orphanSeq = before.seq + 1;
  fs.appendFileSync(path.join(store.dir, 'tickets.events.jsonl'), JSON.stringify({ at: new Date().toISOString(), id: t.id, from: 'OPEN', to: 'CONSUMED', event: 'consume', data: { simulated: 'crash' }, seq: orphanSeq }) + '\n');
  const linesBeforeReads = fs.readFileSync(path.join(store.dir, 'tickets.events.jsonl'), 'utf8').trim().split('\n').filter(Boolean);

  const fetched = T.get(store, t.id);
  const listed = T.list(store, {});
  const opened = T.openTickets(store);
  const pendingAfterGet = store.pendingEventSeqs;

  const stateAfterReads = JSON.parse(fs.readFileSync(path.join(store.dir, 'tickets.json'), 'utf8'));
  const linesAfterReads = fs.readFileSync(path.join(store.dir, 'tickets.events.jsonl'), 'utf8').trim().split('\n').filter(Boolean);

  check('17: get()/list()/openTickets() between append and rename never append a reconcile line',
    linesAfterReads.length === linesBeforeReads.length, 'before=' + linesBeforeReads.length + ' after=' + linesAfterReads.length);
  check('17: an unlocked read never changes committed state', stateAfterReads.seq === before.seq && fetched.status === 'OPEN');
  check('17: get() mirrors the orphan onto store.pendingEventSeqs for diagnostics', Array.isArray(pendingAfterGet) && pendingAfterGet.includes(orphanSeq), JSON.stringify(pendingAfterGet));
  check('17: list()/openTickets() ran cleanly alongside the pending orphan (sanity)', Array.isArray(listed) && Array.isArray(opened));

  // Now a real write happens under the lock: it must reconcile — exactly
  // one reconcile line naming the orphan, this write's own event strictly
  // above it, committed state.seq matching.
  const consumed = T.consume(store, t.id, { tool_use_id: 'tu-reconcile', role: 'Builder' });
  const linesAfterWrite = fs.readFileSync(path.join(store.dir, 'tickets.events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const reconcileLines = linesAfterWrite.filter((l) => l.event === 'reconcile');
  const thisWriteLine = linesAfterWrite[linesAfterWrite.length - 1];
  const stateAfterWrite = JSON.parse(fs.readFileSync(path.join(store.dir, 'tickets.json'), 'utf8'));

  check('17: a write under the lock appends exactly one reconcile line naming the orphan seq',
    reconcileLines.length === 1 && reconcileLines[0].data.dropped.includes(orphanSeq), JSON.stringify(reconcileLines));
  check('17: this write\'s own event carries a seq strictly greater than the orphan\'s',
    thisWriteLine.event === 'consume' && thisWriteLine.seq > orphanSeq, 'thisWriteLine=' + JSON.stringify(thisWriteLine) + ' orphanSeq=' + orphanSeq);
  check('17: committed state.seq matches this write\'s event seq; the write itself succeeded',
    stateAfterWrite.seq === thisWriteLine.seq && consumed.status === 'CONSUMED');

  // A later crash-free write continues monotonically past the reconciliation.
  const launched = T.launch(store, t.id, { agent_id: 'a', served_model: 'm' });
  const stateAfterLaunch = JSON.parse(fs.readFileSync(path.join(store.dir, 'tickets.json'), 'utf8'));
  check('17: a later crash-free write continues monotonically (seq +1, no further reconcile)',
    stateAfterLaunch.seq === stateAfterWrite.seq + 1 && launched.status === 'LAUNCHED');
  const finalReconcileCount = fs.readFileSync(path.join(store.dir, 'tickets.events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((l) => l.event === 'reconcile').length;
  check('17: still exactly one reconcile line total after the follow-on write', finalReconcileCount === 1);
}

// Two writers + one orphan present: only the FIRST writer under the lock
// reconciles; the second, arriving after, sees no orphan at all (the first
// writer's commit already advanced state.seq past it).
{
  const store = freshStore('tkt-orphan-twowriters-');
  const t = T.issue(store, baseFields());
  const before = JSON.parse(fs.readFileSync(path.join(store.dir, 'tickets.json'), 'utf8'));
  const orphanSeq = before.seq + 1;
  fs.appendFileSync(path.join(store.dir, 'tickets.events.jsonl'), JSON.stringify({ at: new Date().toISOString(), id: t.id, from: 'OPEN', to: 'CONSUMED', event: 'consume', data: { simulated: 'crash2' }, seq: orphanSeq }) + '\n');

  T.consume(store, t.id, { tool_use_id: 'tu-w1', role: 'Builder' });        // writer 1: reconciles the orphan
  T.launch(store, t.id, { agent_id: 'a', served_model: 'm' });               // writer 2: no orphan left to see

  const lines = fs.readFileSync(path.join(store.dir, 'tickets.events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const reconcileLines = lines.filter((l) => l.event === 'reconcile');
  check('17: two subsequent writers with one orphan present produce exactly one reconcile line total', reconcileLines.length === 1, JSON.stringify(reconcileLines));
}

// The review's own reproduction, re-run for real: a writer genuinely
// mid-flight (its event physically appended to the log, its state commit
// still pending, held up under a real OS-level sleep) alongside a
// concurrent unlocked reader in a SEPARATE process. No reconcile line may
// ever appear for a seq that goes on to commit.
{
  const dir = tmpDir('tkt-midflight-');
  T.createTicketStore({ dir, init: true });
  const SLEEP_MS = 1500;

  const writerScript = path.join(dir, 'midflight-writer.js');
  fs.writeFileSync(writerScript, `
    'use strict';
    const T = require(${JSON.stringify(path.join(MASTER, 'router', 'tickets.js'))});
    const fs = require('fs');
    function sleepSync(ms) { const sab = new SharedArrayBuffer(4); Atomics.wait(new Int32Array(sab), 0, 0, ms); }
    const store = {
      dir: ${JSON.stringify(dir)},
      lockStaleMs: 5000,
      lockBudgetMs: 20000,
      _fs: {
        appendFileSync: (file, text) => {
          fs.appendFileSync(file, text); // the event line lands on disk now — a concurrent unlocked reader CAN see it
          sleepSync(${SLEEP_MS});        // hold the append-to-commit gap open, exactly what review #3 exploited
        },
      },
    };
    T.bumpGeneration(store, 'midflight-writer');
    fs.writeFileSync(require('path').join(${JSON.stringify(dir)}, 'midflight-writer.done'), 'ok');
  `);
  const writer = spawn(process.execPath, [writerScript], { stdio: 'ignore' });

  realSleepMs(400); // let the writer acquire the lock and get into its (now-stalled) append

  const readerStore = { dir };
  T.get(readerStore, 'tkt-0000000000000000'); // unlocked reads WHILE the writer is genuinely mid-flight
  T.list(readerStore, {});
  const midFlightHasReconcile = fs.readFileSync(path.join(dir, 'tickets.events.jsonl'), 'utf8').trim().split('\n').filter(Boolean)
    .some((l) => { try { return JSON.parse(l).event === 'reconcile'; } catch (e) { return false; } });
  check('17: no reconcile line appears while a reader races a genuinely mid-flight writer', !midFlightHasReconcile);

  const deadline = Date.now() + 20000;
  while (Date.now() < deadline && !fs.existsSync(path.join(dir, 'midflight-writer.done'))) realSleepMs(50);
  check('17: the mid-flight writer finished within the deadline', fs.existsSync(path.join(dir, 'midflight-writer.done')));

  const finalState = JSON.parse(fs.readFileSync(path.join(dir, 'tickets.json'), 'utf8'));
  const finalLines = fs.readFileSync(path.join(dir, 'tickets.events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const finalReconcileLines = finalLines.filter((l) => l.event === 'reconcile');
  check('17: the committed generation matches the log — the writer\'s event landed and NO reconcile line was ever produced for its own seq',
    finalState.generation === 2 && finalReconcileLines.length === 0, 'generation=' + finalState.generation + ' reconcileLines=' + JSON.stringify(finalReconcileLines));

  realSleepMs(200);
  let alive = true;
  try { process.kill(writer.pid, 0); } catch (e) { alive = false; }
  if (alive) { try { writer.kill(); } catch (e) { /* best effort */ } realSleepMs(200); }
}

// ==================================================== 18. expiry denial events

section('18. Fix round 2, finding 3 — expiry-triggered launch/resolve refusals carry BOTH the expire transition and a denied event');

check('finding 3: a late launch produces events [issue, consume, expire, denied] with attempts [launch], not just [issue, consume, expire]',
  (() => {
    const store = freshStore('tkt-denyev-launch-');
    const t = T.issue(store, baseFields({ ttlMs: 300 }));
    T.consume(store, t.id, { tool_use_id: 'tu', role: 'Builder' });
    realSleepMs(400);
    try { T.launch(store, t.id, { agent_id: 'a', served_model: 'm' }); } catch (e) { /* expected */ }
    const lines = fs.readFileSync(path.join(store.dir, 'tickets.events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const names = lines.map((l) => l.event);
    const deniedLine = lines.find((l) => l.event === 'denied');
    const after = T.get(store, t.id);
    return names.join(',') === 'issue,consume,expire,denied' &&
      !!deniedLine && deniedLine.data.attempted === 'launch' &&
      after.attempts.length === 1 && after.attempts[0].event === 'launch' &&
      after.status === 'EXPIRED';
  })());

check('finding 3: a late resolve produces events [issue, consume, launch, expire, denied] with attempts [resolve]',
  (() => {
    const store = freshStore('tkt-denyev-resolve-');
    const t = T.issue(store, baseFields({ ttlMs: 300 }));
    T.consume(store, t.id, { tool_use_id: 'tu', role: 'Builder' });
    T.launch(store, t.id, { agent_id: 'a', served_model: 'm' });
    realSleepMs(400);
    try { T.resolve(store, t.id, { agent_id: 'a', last_assistant_message: 'x', agent_transcript_path: 'p' }); } catch (e) { /* expected */ }
    const lines = fs.readFileSync(path.join(store.dir, 'tickets.events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const names = lines.map((l) => l.event);
    const deniedLine = lines.find((l) => l.event === 'denied');
    const after = T.get(store, t.id);
    return names.join(',') === 'issue,consume,launch,expire,denied' &&
      !!deniedLine && deniedLine.data.attempted === 'resolve' &&
      after.attempts.length === 1 && after.attempts[0].event === 'resolve' &&
      after.status === 'EXPIRED';
  })());

// ==================================================== 19. other typed refusals still land in the events log

section('19. Refusal events for replay / wrong-role / wrong-kind land in the events log too (unchanged by the write-ahead redesign)');

check('a replayed consume is refused AND recorded as an event line (event:"consume", from===to, carrying a seq)',
  (() => {
    const store = freshStore('tkt-refuse-replay-');
    const t = T.issue(store, baseFields());
    T.consume(store, t.id, { tool_use_id: 'tu1', role: 'Builder' });
    try { T.consume(store, t.id, { tool_use_id: 'tu2', role: 'Builder' }); } catch (e) { /* expected */ }
    const lines = fs.readFileSync(path.join(store.dir, 'tickets.events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const replayLine = lines[lines.length - 1];
    return replayLine.event === 'consume' && replayLine.from === 'CONSUMED' && replayLine.to === 'CONSUMED' &&
      /one-use/.test(replayLine.data.reason) && typeof replayLine.seq === 'number' && replayLine.seq === lines.length;
  })());

check('a wrong-role consume is refused AND recorded as an event line',
  (() => {
    const store = freshStore('tkt-refuse-role-');
    const t = T.issue(store, baseFields({ role: 'Builder' }));
    try { T.consume(store, t.id, { tool_use_id: 'tu', role: 'Scout' }); } catch (e) { /* expected */ }
    const lines = fs.readFileSync(path.join(store.dir, 'tickets.events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const wrongRoleLine = lines[lines.length - 1];
    return wrongRoleLine.event === 'consume' && wrongRoleLine.from === 'OPEN' && wrongRoleLine.to === 'OPEN' &&
      /for role Builder, not Scout/.test(wrongRoleLine.data.reason);
  })());

check('a wrong-kind Q0 reference (finding 5) is refused AND recorded as an event line',
  (() => {
    const store = freshStore('tkt-refuse-kind-');
    const reviewer = T.issue(store, baseFields({ kind: 'reviewer', role: 'Reviewer', rung: 'computed', reviewer_of: 'tkt-0000000000000000' }));
    T.consume(store, reviewer.id, { tool_use_id: 'tu-rev', role: 'Reviewer' });
    T.launch(store, reviewer.id, { agent_id: 'rev-agent', served_model: 'm' });
    const impl = T.issue(store, baseFields({ q0_ticket: reviewer.id }));
    try { T.consume(store, impl.id, { tool_use_id: 'tu-impl', role: 'Builder' }); } catch (e) { /* expected */ }
    const lines = fs.readFileSync(path.join(store.dir, 'tickets.events.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const wrongKindLine = lines.filter((l) => l.id === impl.id).pop();
    return !!wrongKindLine && wrongKindLine.event === 'consume' && /to have kind 'q0'/.test(wrongKindLine.data.reason);
  })());
