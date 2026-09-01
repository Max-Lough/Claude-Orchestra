#!/usr/bin/env node
/**
 * WO-14b leg 2a — the ticket state machine + store (final-plan.md consequences
 * carried from roster/wo14b-leg1-lifecycle-proof.md § Design consequences).
 *
 * Tickets are the only way work is reached under roster:new. The Agent tool is
 * async: PreToolUse fires before spawn (consume), PostToolUse(Agent) binds the
 * host's agentId + resolvedModel immediately but before the subagent runs
 * (launch), and the result arrives later at SubagentStop with
 * last_assistant_message + agent_transcript_path (resolve). This module is a
 * pure state machine + JSON-file store — no hook or MCP wiring; that is a
 * later leg's job.
 *
 * Every operation is synchronous (Node's single-threaded execution already
 * serialises calls within one process); a cross-process advisory lock file
 * (tickets.lock, O_EXCL create, {pid, token, at} content, stale after 30s —
 * configurable per store via lockStaleMs) guards the read-modify-write
 * against the real caller shape: separate PreToolUse/PostToolUse/SubagentStop/
 * Stop hook processes touching the same store. Stale-lock takeover is a
 * compare-and-swap (WO-14b leg 2 fix round, finding 1): a taker atomically
 * renames the stale lock to a tombstone before acquiring fresh, and every
 * holder re-validates its own token immediately before its write, aborting
 * typed (TicketStoreError) rather than silently overwriting a concurrent
 * update if a takeover happened while it held the lock.
 *
 * Pure Node >= 20, no dependencies.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { validate } = require(path.join(__dirname, '..', 'verifier', 'schema-check.js'));

const TICKET_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'registry', 'schemas', 'ticket.schema.json'), 'utf8')
);

const STATES = Object.freeze(['OPEN', 'CONSUMED', 'LAUNCHED', 'RESOLVED', 'CLOSED', 'EXPIRED', 'INVALIDATED']);
const TERMINAL = new Set(['CLOSED', 'EXPIRED', 'INVALIDATED']);
// The lawful edges, for reference/assertion — the code below enforces these
// directly rather than walking this table, but it is exported so a caller (or
// a test) can assert the two never drift apart.
const TRANSITIONS = Object.freeze({
  OPEN: Object.freeze(['CONSUMED', 'EXPIRED', 'INVALIDATED']),
  CONSUMED: Object.freeze(['LAUNCHED', 'EXPIRED', 'INVALIDATED']),
  LAUNCHED: Object.freeze(['RESOLVED', 'EXPIRED', 'INVALIDATED']),
  RESOLVED: Object.freeze(['CLOSED', 'INVALIDATED']),
  CLOSED: Object.freeze([]),
  EXPIRED: Object.freeze([]),
  INVALIDATED: Object.freeze([]),
});

const ID_RE = /^tkt-[0-9a-f]{16}$/;
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6h
// WO-14b leg 2 fix round (finding 1): stale-lock takeover was NOT
// ownership-safe — a writer legitimately active past this threshold got its
// lock unlinked by a second process, both entered the critical section, and
// whichever wrote last silently discarded the other's update. Raised from
// 10s to 30s (a synchronous, single-process critical section here normally
// completes in well under a second; 10s was too easy for a merely-slow
// holder to trip) and made configurable per store (store.lockStaleMs) so
// tests can exercise the takeover path without a real 30s wait.
const DEFAULT_LOCK_STALE_MS = 30 * 1000;
// A waiter's total give-up budget must comfortably outlast the staleness
// cutoff — otherwise a waiter times out on a merely-slow-but-live holder
// before ever getting the chance to detect and take over a genuinely stale
// one. Defaults to staleMs + this pad; also configurable (store.lockBudgetMs).
const LOCK_BUDGET_PAD_MS = 15 * 1000;
const LAUNCHED_OR_LATER = new Set(['LAUNCHED', 'RESOLVED', 'CLOSED']);

class TicketTransitionError extends Error {
  constructor(message, extra) {
    super(message);
    this.name = 'TicketTransitionError';
    if (extra) Object.assign(this, extra);
  }
}
class TicketStoreError extends Error {
  constructor(message, extra) {
    super(message);
    this.name = 'TicketStoreError';
    if (extra) Object.assign(this, extra);
  }
}
// Internal-only control-flow carrier: a `fail`/`refuse` closure inside a
// withStore() callback throws this instead of writing directly, so withStore
// remains the SINGLE choke point that re-validates lock ownership (the CAS
// token) before any write reaches disk — success path or typed refusal
// alike. Never exported; callers only ever see the wrapped `err`.
class TicketWriteAndThrow {
  constructor(data, events, err) {
    this.data = data;
    this.events = events;
    this.err = err;
  }
}

function nowIso() { return new Date().toISOString(); }
function mintId() { return 'tkt-' + crypto.randomBytes(8).toString('hex'); }

// ---------------------------------------------------------------- fs helpers

function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, ms);
}

function ticketsFile(dir) { return path.join(dir, 'tickets.json'); }
function eventsFile(dir) { return path.join(dir, 'tickets.events.jsonl'); }
function lockFile(dir) { return path.join(dir, 'tickets.lock'); }

function atomicWriteJson(file, obj) {
  const dir = path.dirname(file);
  const tmp = path.join(dir, '.' + path.basename(file) + '.' + process.pid + '.' + Date.now() + '.' + Math.random().toString(16).slice(2) + '.tmp');
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

// Finding 1: takeover of a stale lock is a compare-and-swap, not a bare
// unlink. The lock file carries {pid, token, at}; a taker of a lock it
// believes is stale must ATOMICALLY rename it to a uniquely-named tombstone
// (fs.renameSync — atomic on every platform Node supports, including
// Windows — so exactly one racing taker wins the rename; every loser gets
// ENOENT/EPERM and simply retries the acquire loop) before it may attempt a
// fresh O_EXCL create. This closes the old race where two processes could
// both observe staleness, both unlink, and both believe they held the only
// lock.
function acquireLock(dir, staleMs, budgetMs) {
  const file = lockFile(dir);
  const start = Date.now();
  const token = crypto.randomBytes(9).toString('hex');
  for (;;) {
    try {
      const fd = fs.openSync(file, 'wx');
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, token, at: Date.now() }));
      fs.closeSync(fd);
      return { file, token };
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw new TicketStoreError('tickets.lock could not be acquired: ' + e.message);
      }
      let mtimeMs;
      try { mtimeMs = fs.statSync(file).mtimeMs; } catch (e2) { continue; /* lock vanished between the failed create and this stat — retry */ }
      if (Date.now() - mtimeMs > staleMs) {
        const tombstone = file + '.stale-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
        try {
          fs.renameSync(file, tombstone); // the CAS: exactly one taker wins
        } catch (e3) {
          continue; // lost the takeover race (or the true holder released first) — retry the acquire loop
        }
        try { fs.unlinkSync(tombstone); } catch (e4) { /* best-effort cleanup; not load-bearing */ }
        continue; // fall through to a fresh O_EXCL create
      }
      if (Date.now() - start > budgetMs) {
        throw new TicketStoreError('tickets.lock held past ' + budgetMs + 'ms — refusing to wait longer');
      }
      sleepSync(15);
    }
  }
}
// Release only if the lock file still names OUR token — a stale-lock
// takeover may have already replaced it with a different holder's fresh
// lock, and unlinking that would release a lock we no longer own.
function releaseLockIfOwned(file, token) {
  try {
    const current = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (current.token === token) fs.unlinkSync(file);
  } catch (e) { /* vanished, foreign, or unreadable — nothing of ours to release */ }
}

function validateTicketShape(ticket) {
  const problems = validate(TICKET_SCHEMA, ticket);
  if (problems.length) {
    throw new TicketStoreError('ticket ' + (ticket && ticket.id) + ' fails the ticket schema: ' + problems.join('; '));
  }
}

function validateStoreShape(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TicketStoreError('tickets store corrupted: root is not an object');
  }
  if (!Number.isInteger(data.generation) || data.generation < 1) {
    throw new TicketStoreError('tickets store corrupted: generation must be a positive integer');
  }
  if (!data.tickets || typeof data.tickets !== 'object' || Array.isArray(data.tickets)) {
    throw new TicketStoreError('tickets store corrupted: tickets must be an object map');
  }
  if (!Array.isArray(data.unknown_attempts)) {
    throw new TicketStoreError('tickets store corrupted: unknown_attempts must be an array');
  }
  for (const [id, t] of Object.entries(data.tickets)) {
    if (!ID_RE.test(id) || !t || t.id !== id) {
      throw new TicketStoreError('tickets store corrupted: ticket key/id mismatch for ' + id);
    }
    validateTicketShape(t);
  }
}

function readStore(dir) {
  const file = ticketsFile(dir);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw new TicketStoreError('tickets store unreadable at ' + file + ': ' + e.message);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new TicketStoreError('tickets store corrupted (invalid JSON) at ' + file + ': ' + e.message);
  }
  validateStoreShape(data);
  return data;
}

function writeStore(dir, data) {
  validateStoreShape(data);
  atomicWriteJson(ticketsFile(dir), data);
}

function appendEvent(dir, rec) {
  fs.appendFileSync(eventsFile(dir), JSON.stringify(rec) + '\n');
}

// Run `fn(data)` under the cross-process lock, persisting whatever `fn`
// returns (or, for a typed refusal, whatever it threw via
// TicketWriteAndThrow) as the new store state. `fn` returns
// { data, result, events } on success; events is an array of
// {at, id, from, to, event, data} rows appended after the write succeeds.
//
// Finding 1: this is the ONE place that writes tickets.json, and — success
// or typed refusal alike — it re-validates ownership immediately before
// that write: it re-reads the lock file and confirms the token it acquired
// is still the one on disk. A mismatch (or the lock file having vanished)
// means a stale-lock takeover happened while this holder was between its
// read and its write; rather than silently overwriting whatever the taker
// already did, this aborts with a typed TicketStoreError and writes
// nothing. The lock is released only if it still names our token — a
// takeover's fresh lock must never be deleted by the process it took the
// lock FROM.
function withStore(store, fn) {
  const staleMs = store.lockStaleMs || DEFAULT_LOCK_STALE_MS;
  const budgetMs = store.lockBudgetMs || (staleMs + LOCK_BUDGET_PAD_MS);
  const { file: lock, token } = acquireLock(store.dir, staleMs, budgetMs);
  let ownLock = true;
  try {
    const data = readStore(store.dir);
    let next, result, events, pendingErr = null;
    try {
      ({ data: next, result, events } = fn(data));
    } catch (e) {
      if (e instanceof TicketWriteAndThrow) {
        next = e.data; events = e.events; pendingErr = e.err;
      } else {
        throw e; // a genuine bug or a non-refusal error from fn — no write
      }
    }
    let current;
    try {
      current = JSON.parse(fs.readFileSync(lock, 'utf8'));
    } catch (e) {
      ownLock = false;
      throw new TicketStoreError('tickets.lock vanished before write — a stale-lock takeover occurred mid-operation; aborting rather than writing past it');
    }
    if (current.token !== token) {
      ownLock = false;
      throw new TicketStoreError('tickets.lock token changed before write (owned by another process now) — aborting rather than silently overwriting a concurrent update');
    }
    writeStore(store.dir, next);
    for (const ev of events || []) appendEvent(store.dir, ev);
    if (pendingErr) throw pendingErr;
    return result;
  } finally {
    if (ownLock) releaseLockIfOwned(lock, token);
  }
}

function recordAttempt(data, id, event, reason, at) {
  const events = [];
  const t = data.tickets[id];
  if (t) {
    t.attempts.push({ at, event, reason });
    events.push({ at, id, from: t.status, to: t.status, event, data: { reason } });
  } else {
    data.unknown_attempts.push({ at, id, event, reason });
    events.push({ at, id, from: null, to: null, event, data: { reason, unknown: true } });
  }
  return events;
}

// -------------------------------------------------------------- store admin

function createTicketStore({ dir, init, lockStaleMs, lockBudgetMs } = {}) {
  if (!dir) throw new TicketStoreError('createTicketStore requires { dir }');
  const file = ticketsFile(dir);
  const staleMs = lockStaleMs || DEFAULT_LOCK_STALE_MS;
  const budgetMs = lockBudgetMs || (staleMs + LOCK_BUDGET_PAD_MS);
  if (!fs.existsSync(file)) {
    if (init !== true) {
      throw new TicketStoreError('tickets store does not exist at ' + file + ' (pass { init: true } to create generation 1)');
    }
    fs.mkdirSync(dir, { recursive: true });
    const { file: lock, token } = acquireLock(dir, staleMs, budgetMs);
    try {
      if (!fs.existsSync(file)) {
        writeStore(dir, { generation: 1, tickets: {}, unknown_attempts: [] });
      }
    } finally {
      releaseLockIfOwned(lock, token);
    }
  } else {
    // Fail closed immediately on a corrupted/unreadable store rather than
    // waiting for the first operation to discover it.
    readStore(dir);
  }
  return { dir, lockStaleMs, lockBudgetMs };
}

// -------------------------------------------------------------------- issue

function issue(store, fields) {
  return withStore(store, (data) => {
    const at = nowIso();
    let id = mintId();
    while (Object.prototype.hasOwnProperty.call(data.tickets, id)) id = mintId();
    const ttlMs = typeof fields.ttlMs === 'number' ? fields.ttlMs : DEFAULT_TTL_MS;
    const expiresAt = new Date(Date.parse(at) + ttlMs).toISOString();
    const ticket = {
      id,
      kind: fields.kind,
      task_id: fields.task_id,
      class: fields.class,
      role: fields.role,
      rung: fields.rung,
      tier: fields.tier === undefined ? null : fields.tier,
      casting: fields.casting,
      author_family: fields.author_family,
      parent_ticket: fields.parent_ticket === undefined ? null : fields.parent_ticket,
      q0_ticket: fields.q0_ticket === undefined ? null : fields.q0_ticket,
      reviewer_of: fields.reviewer_of === undefined ? null : fields.reviewer_of,
      generation: fields.generation === undefined ? data.generation : fields.generation,
      config_hash: fields.config_hash,
      issued_at: at,
      expires_at: expiresAt,
      status: 'OPEN',
      consumed: null,
      launched: null,
      resolved: null,
      outcome: null,
      attempts: [],
    };
    validateTicketShape(ticket);
    data.tickets[id] = ticket;
    return {
      data,
      result: ticket,
      events: [{ at, id, from: null, to: 'OPEN', event: 'issue', data: { kind: ticket.kind, role: ticket.role, task_id: ticket.task_id } }],
    };
  });
}

// ------------------------------------------------------------------ consume

function consume(store, id, { tool_use_id, role } = {}) {
  return withStore(store, (data) => {
    const at = nowIso();
    const t = data.tickets[id];
    const fail = (reason) => {
      const events = recordAttempt(data, id, 'consume', reason, at);
      throw new TicketWriteAndThrow(data, events, new TicketTransitionError(reason, { id, ticket: t }));
    };
    if (!t) return fail('unknown ticket ' + id);
    if (t.status !== 'OPEN') return fail('ticket ' + id + ' is ' + t.status + ' (one-use)');
    if (Date.parse(at) >= Date.parse(t.expires_at)) return fail('ticket ' + id + ' expired at ' + t.expires_at);
    if (role !== t.role) return fail('ticket ' + id + ' is for role ' + t.role + ', not ' + role);
    if (t.generation !== data.generation) return fail('ticket ' + id + ' is generation ' + t.generation + ', store is at ' + data.generation);
    if (t.q0_ticket) {
      const q0 = data.tickets[t.q0_ticket];
      // Finding 5: the gate used to accept ANY referenced ticket kind (a
      // launched reviewer ticket satisfied a q0_ticket reference). It must
      // require the referenced ticket to actually exist, be kind:'q0', and
      // be LAUNCHED or later — a wrong-kind ticket in that slot is a typed
      // refusal, same as a missing or not-yet-launched one.
      if (!q0) {
        return fail('ticket ' + id + ' requires Q0 ticket ' + t.q0_ticket + ' to exist (missing)');
      }
      if (q0.kind !== 'q0') {
        return fail('ticket ' + id + ' requires Q0 ticket ' + t.q0_ticket + " to have kind 'q0' (is " + q0.kind + ')');
      }
      if (!LAUNCHED_OR_LATER.has(q0.status)) {
        return fail('ticket ' + id + ' requires Q0 ticket ' + t.q0_ticket + ' to be LAUNCHED or later (is ' + q0.status + ')');
      }
    }
    t.status = 'CONSUMED';
    t.consumed = { tool_use_id, at };
    return { data, result: t, events: [{ at, id, from: 'OPEN', to: 'CONSUMED', event: 'consume', data: { tool_use_id, role } }] };
  });
}

// ------------------------------------------------------------------- launch

function launch(store, id, { agent_id, served_model } = {}) {
  return withStore(store, (data) => {
    const at = nowIso();
    const t = data.tickets[id];
    const fail = (reason) => {
      const events = recordAttempt(data, id, 'launch', reason, at);
      throw new TicketWriteAndThrow(data, events, new TicketTransitionError(reason, { id, ticket: t }));
    };
    if (!t) return fail('unknown ticket ' + id);
    if (t.status !== 'CONSUMED') return fail('ticket ' + id + ' is ' + t.status + ', launch requires CONSUMED');
    // Finding 2: a ticket consumed before expiry but launched afterward must
    // transition to EXPIRED (a lawful CONSUMED -> EXPIRED edge), not
    // LAUNCHED. This is a real transition (status actually flips, an
    // 'expire' event is recorded — same as expire()'s own sweep) as well as
    // a typed refusal of THIS launch call (recorded in attempts, thrown).
    if (Date.parse(at) >= Date.parse(t.expires_at)) {
      const from = t.status;
      const reason = 'ticket ' + id + ' expired at ' + t.expires_at + ' — consumed but not launched before expiry';
      t.status = 'EXPIRED';
      t.outcome = { code: 'EXPIRED', reason, at };
      t.attempts.push({ at, event: 'launch', reason });
      const events = [{ at, id, from, to: 'EXPIRED', event: 'expire', data: { expires_at: t.expires_at, trigger: 'launch' } }];
      throw new TicketWriteAndThrow(data, events, new TicketTransitionError(reason, { id, ticket: t }));
    }
    t.status = 'LAUNCHED';
    t.launched = { agent_id, served_model, at };
    return { data, result: t, events: [{ at, id, from: 'CONSUMED', to: 'LAUNCHED', event: 'launch', data: { agent_id, served_model } }] };
  });
}

// ------------------------------------------------------------------ resolve

function resolve(store, id, { agent_id, last_assistant_message, agent_transcript_path } = {}) {
  return withStore(store, (data) => {
    const at = nowIso();
    const t = data.tickets[id];
    const fail = (reason) => {
      const events = recordAttempt(data, id, 'resolve', reason, at);
      throw new TicketWriteAndThrow(data, events, new TicketTransitionError(reason, { id, ticket: t }));
    };
    if (!t) return fail('unknown ticket ' + id);
    if (t.status !== 'LAUNCHED') return fail('ticket ' + id + ' is ' + t.status + ', resolve requires LAUNCHED');
    // Finding 2: the same expires_at check as launch() — a ticket LAUNCHED
    // before expiry but resolved afterward transitions to EXPIRED (lawful
    // LAUNCHED -> EXPIRED edge), never RESOLVED. Checked before the
    // agent_id match so an expired ticket refuses on expiry regardless of
    // which agent is asking.
    if (Date.parse(at) >= Date.parse(t.expires_at)) {
      const from = t.status;
      const reason = 'ticket ' + id + ' expired at ' + t.expires_at + ' — launched but not resolved before expiry';
      t.status = 'EXPIRED';
      t.outcome = { code: 'EXPIRED', reason, at };
      t.attempts.push({ at, event: 'resolve', reason });
      const events = [{ at, id, from, to: 'EXPIRED', event: 'expire', data: { expires_at: t.expires_at, trigger: 'resolve' } }];
      throw new TicketWriteAndThrow(data, events, new TicketTransitionError(reason, { id, ticket: t }));
    }
    if (!t.launched || t.launched.agent_id !== agent_id) {
      return fail('ticket ' + id + ' was launched as agent ' + (t.launched && t.launched.agent_id) + ', not ' + agent_id);
    }
    t.status = 'RESOLVED';
    t.resolved = { last_assistant_message, agent_transcript_path, at };
    return { data, result: t, events: [{ at, id, from: 'LAUNCHED', to: 'RESOLVED', event: 'resolve', data: { agent_id } }] };
  });
}

// --------------------------------------------------------------------- close

function close(store, id, { code, reason } = {}) {
  return withStore(store, (data) => {
    const at = nowIso();
    const t = data.tickets[id];
    const refuse = (why) => {
      const events = recordAttempt(data, id, 'close', why, at);
      throw new TicketWriteAndThrow(data, events, new TicketTransitionError(why, { id, ticket: t }));
    };
    if (!t) return refuse('unknown ticket ' + id);
    if (t.status !== 'RESOLVED') return refuse('ticket ' + id + ' is ' + t.status + ', close requires RESOLVED');

    // Shape-only reviewer gate: if any ticket names this one via
    // reviewer_of, every such reviewer ticket must be RESOLVED before this
    // ticket may CLOSE. Verdict *content* validation is leg 5's job.
    const reviewers = Object.values(data.tickets).filter((x) => x.reviewer_of === id);
    if (reviewers.length && !reviewers.every((r) => r.status === 'RESOLVED')) {
      const unresolved = reviewers.filter((r) => r.status !== 'RESOLVED').map((r) => r.id + ':' + r.status);
      return refuse('ticket ' + id + ' close refused: reviewer ticket(s) not RESOLVED (' + unresolved.join(', ') + ')');
    }

    if (code === 'CLOSED') {
      t.status = 'CLOSED';
      t.outcome = { code: 'CLOSED', reason: reason || null, at };
      return {
        data,
        result: { ok: true, outcome: 'CLOSED', ticket: t },
        events: [{ at, id, from: 'RESOLVED', to: 'CLOSED', event: 'close', data: { code, reason: reason || null } }],
      };
    }
    // A typed, non-exceptional non-close: status stays RESOLVED (retryable
    // once the underlying reason is addressed).
    t.outcome = { code: 'NOT_CLOSED', reason: reason || String(code), at };
    return {
      data,
      result: { ok: false, outcome: 'NOT_CLOSED', reason: t.outcome.reason, ticket: t },
      events: [{ at, id, from: 'RESOLVED', to: 'RESOLVED', event: 'close', data: { code, reason: t.outcome.reason, outcome: 'NOT_CLOSED' } }],
    };
  });
}

// -------------------------------------------------------------------- expire

function expire(store, { id, now } = {}) {
  return withStore(store, (data) => {
    const at = (now instanceof Date ? now : now ? new Date(now) : new Date()).toISOString();
    const events = [];
    const expired = [];
    const targets = id ? [data.tickets[id]].filter(Boolean) : Object.values(data.tickets);
    for (const t of targets) {
      if (!['OPEN', 'CONSUMED', 'LAUNCHED'].includes(t.status)) continue;
      if (Date.parse(at) < Date.parse(t.expires_at)) continue;
      const from = t.status;
      t.status = 'EXPIRED';
      t.outcome = { code: 'EXPIRED', reason: 'past expires_at ' + t.expires_at, at };
      expired.push(t.id);
      events.push({ at, id: t.id, from, to: 'EXPIRED', event: 'expire', data: { expires_at: t.expires_at } });
    }
    return { data, result: expired, events };
  });
}

// -------------------------------------------------------------- bumpGeneration

function bumpGeneration(store, reason) {
  return withStore(store, (data) => {
    const at = nowIso();
    data.generation += 1;
    const events = [{ at, id: null, from: null, to: null, event: 'bumpGeneration', data: { generation: data.generation, reason } }];
    const invalidated = [];
    for (const t of Object.values(data.tickets)) {
      if (TERMINAL.has(t.status)) continue;
      const from = t.status;
      t.status = 'INVALIDATED';
      t.outcome = { code: 'INVALIDATED', reason, at };
      invalidated.push(t.id);
      events.push({ at, id: t.id, from, to: 'INVALIDATED', event: 'bumpGeneration', data: { reason } });
    }
    return { data, result: { generation: data.generation, invalidated }, events };
  });
}

// -------------------------------------------------------------------- denied

function denied(store, id, event, reason) {
  return withStore(store, (data) => {
    const at = nowIso();
    const events = recordAttempt(data, id, event, reason, at);
    return { data, result: null, events };
  });
}

// ------------------------------------------------------------------- queries

function get(store, id) {
  const data = readStore(store.dir);
  return data.tickets[id] || null;
}

function list(store, { status } = {}) {
  const data = readStore(store.dir);
  const all = Object.values(data.tickets);
  if (status === undefined) return all;
  const wanted = Array.isArray(status) ? new Set(status) : new Set([status]);
  return all.filter((t) => wanted.has(t.status));
}

function openTickets(store) {
  return list(store, { status: ['CONSUMED', 'LAUNCHED'] });
}

module.exports = {
  createTicketStore,
  issue,
  consume,
  launch,
  resolve,
  close,
  expire,
  bumpGeneration,
  denied,
  get,
  list,
  openTickets,
  TicketTransitionError,
  TicketStoreError,
  STATES,
  TRANSITIONS,
  // exposed for tests only
  _internal: {
    ticketsFile, eventsFile, lockFile, mintId,
    acquireLock, releaseLockIfOwned, withStore,
    DEFAULT_LOCK_STALE_MS, LOCK_BUDGET_PAD_MS,
  },
};
