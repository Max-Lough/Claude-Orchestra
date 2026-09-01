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
 * (tickets.lock, O_EXCL create, stale after 10s) guards the read-modify-write
 * against the real caller shape: separate PreToolUse/PostToolUse/SubagentStop/
 * Stop hook processes touching the same store.
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
const LOCK_STALE_MS = 10 * 1000;
const LOCK_BUDGET_MS = 15 * 1000;
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

function acquireLock(dir) {
  const file = lockFile(dir);
  const start = Date.now();
  for (;;) {
    try {
      const fd = fs.openSync(file, 'wx');
      fs.writeSync(fd, String(process.pid) + '@' + start);
      fs.closeSync(fd);
      return file;
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw new TicketStoreError('tickets.lock could not be acquired: ' + e.message);
      }
      let mtimeMs;
      try { mtimeMs = fs.statSync(file).mtimeMs; } catch (e2) { continue; /* lock vanished, retry */ }
      if (Date.now() - mtimeMs > LOCK_STALE_MS) {
        try { fs.unlinkSync(file); } catch (e3) { /* lost the unlink race — retry */ }
        continue;
      }
      if (Date.now() - start > LOCK_BUDGET_MS) {
        throw new TicketStoreError('tickets.lock held past ' + LOCK_BUDGET_MS + 'ms — refusing to wait longer');
      }
      sleepSync(15);
    }
  }
}
function releaseLock(file) { try { fs.unlinkSync(file); } catch (e) { /* best effort */ } }

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
// returns as the new store state (fn may also just read and return data
// unchanged). `fn` returns { data, result, events } — events is an array of
// {at, id, from, to, event, data} rows appended after the write succeeds.
function withStore(store, fn) {
  const lock = acquireLock(store.dir);
  try {
    const data = readStore(store.dir);
    const { data: next, result, events } = fn(data);
    writeStore(store.dir, next);
    for (const ev of events || []) appendEvent(store.dir, ev);
    return result;
  } finally {
    releaseLock(lock);
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

function createTicketStore({ dir, init } = {}) {
  if (!dir) throw new TicketStoreError('createTicketStore requires { dir }');
  const file = ticketsFile(dir);
  if (!fs.existsSync(file)) {
    if (init !== true) {
      throw new TicketStoreError('tickets store does not exist at ' + file + ' (pass { init: true } to create generation 1)');
    }
    fs.mkdirSync(dir, { recursive: true });
    const lock = acquireLock(dir);
    try {
      if (!fs.existsSync(file)) {
        writeStore(dir, { generation: 1, tickets: {}, unknown_attempts: [] });
      }
    } finally {
      releaseLock(lock);
    }
  } else {
    // Fail closed immediately on a corrupted/unreadable store rather than
    // waiting for the first operation to discover it.
    readStore(dir);
  }
  return { dir };
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
      writeStore(store.dir, data);
      for (const ev of events) appendEvent(store.dir, ev);
      throw new TicketTransitionError(reason, { id, ticket: t });
    };
    if (!t) return fail('unknown ticket ' + id);
    if (t.status !== 'OPEN') return fail('ticket ' + id + ' is ' + t.status + ' (one-use)');
    if (Date.parse(at) >= Date.parse(t.expires_at)) return fail('ticket ' + id + ' expired at ' + t.expires_at);
    if (role !== t.role) return fail('ticket ' + id + ' is for role ' + t.role + ', not ' + role);
    if (t.generation !== data.generation) return fail('ticket ' + id + ' is generation ' + t.generation + ', store is at ' + data.generation);
    if (t.q0_ticket) {
      const q0 = data.tickets[t.q0_ticket];
      if (!q0 || !LAUNCHED_OR_LATER.has(q0.status)) {
        return fail('ticket ' + id + ' requires Q0 ticket ' + t.q0_ticket + ' to be LAUNCHED or later (is ' + (q0 ? q0.status : 'missing') + ')');
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
      writeStore(store.dir, data);
      for (const ev of events) appendEvent(store.dir, ev);
      throw new TicketTransitionError(reason, { id, ticket: t });
    };
    if (!t) return fail('unknown ticket ' + id);
    if (t.status !== 'CONSUMED') return fail('ticket ' + id + ' is ' + t.status + ', launch requires CONSUMED');
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
      writeStore(store.dir, data);
      for (const ev of events) appendEvent(store.dir, ev);
      throw new TicketTransitionError(reason, { id, ticket: t });
    };
    if (!t) return fail('unknown ticket ' + id);
    if (t.status !== 'LAUNCHED') return fail('ticket ' + id + ' is ' + t.status + ', resolve requires LAUNCHED');
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
      writeStore(store.dir, data);
      for (const ev of events) appendEvent(store.dir, ev);
      throw new TicketTransitionError(why, { id, ticket: t });
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
  _internal: { ticketsFile, eventsFile, lockFile, mintId },
};
