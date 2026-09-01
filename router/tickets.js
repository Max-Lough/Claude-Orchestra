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
 * serialises calls within one process); a cross-process advisory lock
 * DIRECTORY (tickets.lock/, fs.mkdirSync — atomic + exclusive on every
 * platform Node supports, including Windows — carrying an owner.json
 * {pid, token, at, host} sidecar, stale after 30s — configurable per store
 * via lockStaleMs) guards the read-modify-write against the real caller
 * shape: separate PreToolUse/PostToolUse/SubagentStop/Stop hook processes
 * touching the same store.
 *
 * WO-14b leg 2 fix round 2 (finding 1, MAJOR, fixed): stale-lock takeover is
 * now LIVENESS-GATED, never merely time-gated. A taker may only displace a
 * lock when the recorded holder pid is PROVABLY DEAD (process.kill(pid, 0)
 * throws ESRCH, or the recorded pid isn't even a number) AND the lock is
 * older than lockStaleMs. A live holder — however slow — is never taken
 * over; a waiter polls until lockBudgetMs and then fails closed with a typed
 * TicketStoreError naming the live pid, rather than racing a still-running
 * holder. Because a live holder is never displaced, the classic
 * check-to-write race (a taker acquiring, writing, and releasing between a
 * live holder's read and its own write) cannot happen — a dead holder
 * cannot write. Takeover mechanics stay CAS (a taker atomically renames the
 * stale lock to a unique tombstone before acquiring fresh — fs.renameSync,
 * atomic on every platform Node supports including Windows, so exactly one
 * racing taker wins). The pre-write lock-token re-validation and the new
 * pre-commit seq re-check are kept as belt-and-braces assertions (loud typed
 * throws) rather than the safety mechanism itself — under correct liveness
 * gating neither should ever actually trip.
 *
 * WO-14b leg 2 fix round 2 (finding 2, MAJOR, fixed): every state mutation
 * writes tickets.events.jsonl BEFORE it commits tickets.json (write-ahead),
 * fsync'd, so a write that can't reach the log changes nothing and throws;
 * a crash between the two leaves a log tail ahead of the committed state.
 * The store also now carries an optimistic `seq` (finding 1): every
 * committed write increments it by exactly one, and every event line the
 * write produces carries that same seq.
 *
 * WO-14b leg 2 fix round 3 (review #3, MAJOR x2, fixed):
 *
 * (a) [tickets.js:192] The lock is now a DIRECTORY (fs.mkdirSync — atomic
 * AND exclusive on every platform, unlike an O_EXCL file whose EEXIST retry
 * previously had a parse-retry path that could spin forever on a half-written
 * owner.json without ever sleeping or checking lockBudgetMs). Exclusivity
 * never depends on owner.json being present or parseable: acquisition is the
 * mkdirSync succeeding, full stop. On EEXIST — malformed, missing, or absent
 * owner.json all fold into a single "unknown holder" case, aged off the lock
 * DIRECTORY's own mtime/birthtime rather than a pid. EVERY contention path
 * — known-holder or unknown-holder alike — now goes through one waitOrThrow()
 * choke point that always sleeps (~25ms) and always checks lockBudgetMs
 * before looping again; nothing retries unconditionally. See acquireLock().
 *
 * (b) [tickets.js:273] Reconciliation moved from an unlocked read
 * (readStore(), called by every get/list/openTickets — wrong: a reader
 * mid-race with an in-flight writer could see the writer's own not-yet-
 * committed event and misfile it as a dropped orphan, even though the
 * writer went on to commit normally) to a WRITER-ONLY, UNDER-LOCK step
 * inside withStore(). readStore() now only reads and validates — it never
 * writes and never reconciles; it may attach non-enumerable
 * `pendingEventSeqs` (events in the log with seq > state.seq) as a
 * diagnostic, and get()/list()/openTickets() mirror that onto the caller's
 * `store` object as `store.pendingEventSeqs` for inspection. Only
 * withStore(), immediately after acquiring the lock (so no other writer can
 * possibly be mid-flight — a genuine orphan is a crash between append and
 * rename, not a race), re-reads state and the events log and treats any
 * seq > state.seq it finds there as a real orphan. It then commits at
 * newSeq = max(state.seq, maxOrphanSeq) + 1, appending one `reconcile`
 * line (seq = maxOrphanSeq, naming the dropped seq(s)) BEFORE this write's
 * own event line(s) (seq = newSeq) in the same fsync'd append — so the log
 * always reads [orphan(s)…, reconcile, this-event]. If the lock cannot be
 * acquired, no reconciliation happens (a reader observing a gap is
 * observing an in-flight write, not an orphan).
 *
 * INVARIANT: committed seq is monotonic; every seq in the log appears at
 * most once as a non-orphan (i.e. as the seq some write actually committed
 * as its state.seq); orphans are always followed by a reconcile marker
 * written under the lock, and the write that follows an orphan always
 * carries a seq strictly greater than every orphan it named. The last line
 * of the events log is always a complete JSON record at the start of a
 * locked write (fix round 5 corrected this from the weaker "always
 * newline-terminated" — see below); a torn tail is closed (if it doesn't
 * already end in a physical newline) and recorded as a reconcile with
 * torn_tail (fix round 4, below).
 *
 * WO-14b leg 2 fix round 4 (review #4, MAJOR + MINOR x2 + NIT, fixed):
 *
 * (a) [MAJOR, tickets.js:396] A torn JSONL tail (a partial line left by a
 * writer that crashed or short-wrote mid-append, no trailing '\n') used to
 * be silently concatenated onto by the next append, corrupting the audit
 * trail without ever documenting the gap. withStore() now detects a torn
 * tail (last byte of the events file isn't '\n') right after acquiring the
 * lock and, as part of its own fsync'd append, closes the boundary (a
 * leading '\n') and folds the fragment into that write's reconcile line as
 * `data.torn_tail = { bytes, sha256 }` — the same line that names any
 * ordinary dropped orphan seqs. `readEventsRaw()` already tolerated a torn
 * last line (JSON.parse failure on that one segment is swallowed) and never
 * merges it with a neighbour into one parsed event, since split('\n') keeps
 * them on separate segments. An unlocked reader (readStore(), mirrored onto
 * `store.tornTail` by get()/list()/openTickets()) surfaces the same
 * detection as a diagnostic without writing anything — only a locked write
 * actually repairs it.
 *
 * (b) [MINOR, tickets.js:600] Post-commit lock-ownership loss (a confirmed
 * token mismatch at release time — the mutation itself already committed)
 * no longer just gets swallowed silently: withStore() records it on
 * `store.lastLockAnomaly = { at, detail, expectedToken, foundOwner }`. The
 * NEXT locked write, if it finds that flag set, appends a `lock_anomaly`
 * event line (carrying its own commit seq) before its own event line(s) and
 * clears the flag only once that write actually commits. A caller never
 * sees a committed mutation reported as a failure. releaseLockIfOwned() also
 * now best-effort removes a confirmed-foreign lock via the same CAS
 * tombstone mechanism acquireLock() uses for takeover — but ONLY when that
 * foreign owner's pid is provably dead; a live foreign owner's lock is never
 * touched.
 *
 * (c) [MINOR, tickets.js:318] Tombstone accumulation: a takeover's own
 * `rmSync` was best-effort and, if it failed, left the tombstone forever
 * with nothing ever revisiting it. acquireLock() now also sweeps `.tomb-*`
 * siblings of the lock directory older than `staleMs` on every successful
 * acquisition (best-effort, errors ignored) — a fresh tombstone is left
 * alone.
 *
 * (d) [NIT] The unknown-holder timeout message no longer duplicates
 * "for > budget" (it was being appended both by the caller and by
 * waitOrThrow() itself).
 *
 * WO-14b leg 2 fix round 5 (review #5, MAJOR + MINOR x3, fixed):
 *
 * (a) [MAJOR, tickets.js:625] appendEventsOrThrow()'s default path used to
 * call fs.writeSync() exactly once and assume the whole payload landed —
 * writeSync is permitted to write fewer bytes than asked (short write) and
 * the old code never checked its return value, so a short-write left a torn
 * partial line on disk while the caller proceeded to commit tickets.json as
 * though the append had fully succeeded (review #5's exact repro: a
 * multi-event bumpGeneration() append short-writes after its first
 * newline — three tickets go INVALIDATED and state commits, but only the
 * bump event is durably logged). The write loop now tracks a byte offset
 * and keeps calling writeSync from that offset until every byte of the
 * payload is written; after the loop, fs.fstatSync(fd).size is compared
 * against the pre-append size + payload length as a belt-and-braces
 * integrity check — a mismatch (writeSync reporting more progress than
 * actually landed, in principle impossible but not to be trusted blindly)
 * throws TicketStoreError('short write...') BEFORE any state change, same
 * as any other append failure: write-ahead ordering means withStore() never
 * reaches writeStore() when this throws. A test-only `_fs.writeSync` (and
 * optionally `_fs.openSync`/`_fs.fsyncSync`/`_fs.closeSync`/`_fs.fstatSync`)
 * override lets a test inject a short/throwing writeSync against a REAL fd
 * without relying on OS permission bits.
 *
 * (b) [MINOR, tickets.js:769] `lastLockAnomaly` used to live only on the
 * process-local `store` object — a hook process that observed a post-commit
 * ownership mismatch and then exited took the record with it; the next hook
 * process opens the directory with a brand-new store object and never knew.
 * releaseLockIfOwned()'s caller now ALSO durably appends the anomaly to a
 * sidecar `tickets.anomalies.jsonl` (no lock needed — append-only, same
 * write-all-or-throw discipline as appendEventsOrThrow, but best-effort:
 * never lets a failure here mask the write that already committed) in
 * addition to setting `store.lastLockAnomaly` (kept for same-process
 * introspection). The NEXT locked write, in ANY process, reads the sidecar
 * under the lock, emits one `lock_anomaly` event per surviving line into
 * the main events log (before its own event line(s)), and truncates the
 * sidecar once that write actually commits — mirroring exactly when
 * `store.lastLockAnomaly` itself is cleared.
 *
 * (c) [MINOR, tickets.js:524] detectTornTail() used to treat "the file's
 * last byte is '\n'" as proof the last line is a complete JSON record. It
 * isn't: a crash can leave a raw, unescaped newline byte INSIDE an
 * unterminated JSON string as the literal last byte written, which read as
 * "newline-terminated" and slipped through uncaught. The check now also
 * requires the last non-empty '\n'-delimited segment to JSON.parse; if it
 * doesn't, that segment (plus everything after it, to EOF) is the torn
 * fragment, named the same way (bytes/sha256) regardless of whether it
 * happens to end in a physical '\n'. Because that fragment may already end
 * in a real newline, the returned descriptor now also carries
 * `needsBoundaryNewline` so withStore() only prepends its own boundary '\n'
 * when the file doesn't already end in one — no redundant blank line.
 *
 * (d) [MINOR, tests/tickets.test.js:1206] The review-#4 post-commit-loss
 * test injected the owner.json swap from inside the append hook, i.e.
 * BEFORE writeStore()'s commit rename — it never actually exercised the
 * post-rename timing window the behavior is supposed to cover. withStore()
 * now calls a test-only `_fs.afterRename(ctx)` hook (never used in
 * production) immediately after the state rename commits and before
 * release, so the test can swap the token at exactly that boundary.
 *
 * INVARIANT (restated): the last line of the events log is a complete JSON
 * record at the start of a locked write — not merely "the file ends in
 * '\n'"; a torn tail (whether or not its own last byte is a physical '\n')
 * is closed and recorded as a reconcile with torn_tail.
 *
 * Pure Node >= 20, no dependencies.
 */
'use strict';

const fs = require('fs');
const os = require('os');
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
// tests can exercise the takeover path without a real 30s wait. Fix round 2
// additionally gates takeover on the holder being provably dead — see the
// module header and acquireLock() below.
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
// remains the SINGLE choke point that performs the write-ahead event append
// and the state commit — success path or typed refusal alike. Never
// exported; callers only ever see the wrapped `err`.
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
// Fix round 5 (review #5, MINOR, tickets.js:769): durable, cross-process
// carrier for a post-commit lock-ownership anomaly — see
// appendAnomalySidecar()/readAnomaliesSidecar()/truncateAnomaliesSidecar().
function anomaliesFile(dir) { return path.join(dir, 'tickets.anomalies.jsonl'); }
// Fix round 3: this is now a DIRECTORY path, not a file path — kept the
// name (and the _internal export name) for continuity with fix-round-2
// callers/docs that already say "tickets.lock".
function lockFile(dir) { return path.join(dir, 'tickets.lock'); }
function ownerFile(lockDir) { return path.join(lockDir, 'owner.json'); }
// Every wait in acquireLock's contention loop goes through this one choke
// point: sleep ~25ms, but ONLY after confirming the budget hasn't already
// been exceeded (in which case throw instead of sleeping again). Fix round
// 3: the review-#3 MAJOR was a contention path that retried unconditionally
// with neither a sleep nor a budget check — every path now funnels through
// here, so none can spin.
const LOCK_POLL_MS = 25;
function waitOrThrow(start, budgetMs, descriptor) {
  if (Date.now() - start > budgetMs) {
    throw new TicketStoreError('tickets.lock held ' + descriptor + ' for > budget');
  }
  sleepSync(LOCK_POLL_MS);
}

function atomicWriteJson(file, obj) {
  const dir = path.dirname(file);
  const tmp = path.join(dir, '.' + path.basename(file) + '.' + process.pid + '.' + Date.now() + '.' + Math.random().toString(16).slice(2) + '.tmp');
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

// Fix round 2, finding 1: is the recorded lock holder provably dead? A pid
// that isn't even a finite number is treated as dead outright. Otherwise,
// process.kill(pid, 0) — a pure existence probe on every platform Node
// supports, including Windows, no signal actually delivered — throws ESRCH
// only when the process genuinely does not exist. Any other failure (e.g.
// EPERM: exists, but this process may not signal it) is NOT proof of death;
// fail closed by treating the holder as alive.
function isPidAlive(pid) {
  if (typeof pid !== 'number' || !Number.isFinite(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if (e && e.code === 'ESRCH') return false;
    return true; // EPERM or anything else: alive, just unsignalable by us
  }
}

// Fix round 4 (review #4, MINOR, tickets.js:318): a takeover's own tombstone
// rmSync is best-effort and, if it fails (e.g. a transient handle held open
// on the platform), nothing ever revisits it — `.tomb-*` dirs could
// accumulate forever. Called on every successful acquisition: best-effort
// sweep of `.tomb-*` siblings of the lock dir older than staleMs. Never
// load-bearing (acquisition already succeeded by the time this runs) —
// every failure here is swallowed. A fresh tombstone (age <= staleMs, e.g.
// one another process is mid-takeover on right now) is left alone.
function sweepStaleTombstones(storeDir, lockDir, staleMs) {
  const prefix = path.basename(lockDir) + '.tomb-';
  let entries;
  try {
    entries = fs.readdirSync(storeDir);
  } catch (e) {
    return;
  }
  const now = Date.now();
  for (const name of entries) {
    if (!name.startsWith(prefix)) continue;
    const full = path.join(storeDir, name);
    let st;
    try {
      st = fs.statSync(full);
    } catch (e) {
      continue; // vanished already (another sweeper, or the taker's own cleanup)
    }
    if (now - st.mtimeMs > staleMs) {
      try { fs.rmSync(full, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
    }
  }
}

// Fix round 3 (review #3, MAJOR #1, tickets.js:192): the lock is a
// DIRECTORY. fs.mkdirSync is atomic AND exclusive on every platform Node
// supports (including Windows) — unlike the fix-round-2 O_EXCL FILE, whose
// EEXIST retry path had a parse-retry branch that could `continue` forever
// without ever sleeping or checking budgetMs if the holder crashed mid-way
// through writing its JSON. Exclusivity here never depends on owner.json
// being present or parseable: acquisition IS the mkdirSync succeeding.
//
// On EEXIST, the holder is classified:
//  (i)  owner.json parses to an object → holder pid liveness as before
//       (alive → wait; dead && age > staleMs → takeover). Age is the
//       owner.json file's own mtime.
//  (ii) owner.json missing, unreadable, or not a parseable object →
//       "unknown holder": age off the LOCK DIRECTORY's own mtime/birthtime
//       instead of a pid; stale by age alone takes it over, otherwise wait.
// Every wait — every one, including case (ii)'s parse failure, which used
// to be the unbounded-spin bug — goes through waitOrThrow(): sleep ~25ms,
// but only after confirming lockBudgetMs hasn't already been exceeded (else
// throw a typed TicketStoreError naming which case). No path in this loop
// retries without either taking over or calling waitOrThrow first.
//
// Takeover is still CAS: fs.renameSync the lock dir to a unique tombstone
// (atomic — exactly one racing taker wins; every loser retries via
// waitOrThrow rather than spinning) before creating fresh. The taker
// removes the tombstone (best-effort, not load-bearing).
function acquireLock(dir, staleMs, budgetMs) {
  const lockDir = lockFile(dir);
  const start = Date.now();
  const token = crypto.randomBytes(9).toString('hex');
  for (;;) {
    try {
      fs.mkdirSync(lockDir);
      try {
        fs.writeFileSync(ownerFile(lockDir), JSON.stringify({ pid: process.pid, token, at: Date.now(), host: os.hostname() }));
      } catch (eOwner) {
        // Exclusivity never depends on this write succeeding — we already
        // hold the directory. A crash right here is exactly the "unknown
        // holder" case a future contender must handle (and does, above).
      }
      try { sweepStaleTombstones(dir, lockDir, staleMs); } catch (eSweep) { /* best-effort; not load-bearing */ }
      return { dir: lockDir, token };
    } catch (e) {
      if (e.code !== 'EEXIST') {
        throw new TicketStoreError('tickets.lock could not be acquired: ' + e.message);
      }
    }

    // Contention: classify the holder.
    let holder = null;
    let parseOk = false;
    try {
      holder = JSON.parse(fs.readFileSync(ownerFile(lockDir), 'utf8'));
      parseOk = !!holder && typeof holder === 'object';
    } catch (eRead) {
      parseOk = false; // missing / unreadable / partial write — "unknown holder"
    }

    let ageMs, holderPid, dead, descriptor;
    if (parseOk) {
      let mtimeMs;
      try {
        mtimeMs = fs.statSync(ownerFile(lockDir)).mtimeMs;
      } catch (eStat) {
        waitOrThrow(start, budgetMs, '(owner.json vanished mid-check)');
        continue;
      }
      ageMs = Date.now() - mtimeMs;
      holderPid = holder.pid;
      dead = !isPidAlive(holderPid);
      descriptor = dead
        ? ('by dead pid ' + holderPid + ' but not yet stale (' + ageMs + 'ms < ' + staleMs + 'ms)')
        : ('by live pid ' + holderPid);
    } else {
      let st;
      try {
        st = fs.statSync(lockDir);
      } catch (eStatDir) {
        waitOrThrow(start, budgetMs, '(lock dir vanished mid-check)');
        continue;
      }
      const birth = typeof st.birthtimeMs === 'number' && st.birthtimeMs > 0 ? st.birthtimeMs : st.mtimeMs;
      ageMs = Date.now() - birth;
      holderPid = null;
      dead = true; // no pid to probe for an unknown holder — age is the only signal
      descriptor = 'by an unknown holder (missing/unparseable owner.json, ' + ageMs + 'ms < ' + staleMs + 'ms)';
    }

    if (dead && ageMs > staleMs) {
      const tombstone = lockDir + '.tomb-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
      try {
        fs.renameSync(lockDir, tombstone); // the CAS: exactly one taker wins
      } catch (eRename) {
        waitOrThrow(start, budgetMs, descriptor); // lost the race (or the true holder released first) — wait, don't spin
        continue;
      }
      try { fs.rmSync(tombstone, { recursive: true, force: true }); } catch (eClean) { /* best-effort cleanup; not load-bearing */ }
      continue; // fall through to a fresh mkdirSync
    }
    waitOrThrow(start, budgetMs, parseOk ? descriptor : 'by an unknown holder');
  }
}
// Release only if the lock dir's owner.json still names OUR token — a
// stale-lock takeover may have already replaced it with a different
// holder's fresh lock, and removing that would release a lock we no longer
// own. Fix round 3: a confirmed MISMATCH (parseable owner.json naming a
// different token) is now a loud typed throw ('lock ownership lost') rather
// than a silent no-op — a vanished/foreign/unreadable owner.json (we can't
// even confirm whose lock it is) still stays a silent no-op, since there is
// nothing of ours to safely remove either way. Fix round 4 (MINOR,
// tickets.js:600): the thrown error now carries `expectedToken`/
// `foundOwner` so withStore()'s caller can record the anomaly instead of
// merely swallowing it (see withStore()'s finally). Also fix round 4: on a
// confirmed mismatch, if the foreign owner now sitting there is provably
// dead, best-effort remove ITS lock too via the same CAS tombstone rename
// acquireLock() uses for takeover — never touched while that owner is
// alive. This is cleanup, not the safety mechanism: the throw still always
// happens so the caller knows its own release did not occur as expected.
function releaseLockIfOwned(lockDir, token) {
  let current;
  try {
    current = JSON.parse(fs.readFileSync(ownerFile(lockDir), 'utf8'));
  } catch (e) {
    return; // vanished, foreign, or unreadable — nothing of ours to safely release
  }
  if (current && current.token === token) {
    fs.rmSync(lockDir, { recursive: true, force: true });
    return;
  }
  const foreignPid = current && typeof current === 'object' ? current.pid : undefined;
  if (!isPidAlive(foreignPid)) {
    const tombstone = lockDir + '.tomb-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    try {
      fs.renameSync(lockDir, tombstone); // CAS: only proceeds if this rename wins
      fs.rmSync(tombstone, { recursive: true, force: true });
    } catch (e) { /* best-effort; lost the race, or the dead owner's lock was already gone */ }
  }
  const err = new TicketStoreError('lock ownership lost');
  err.expectedToken = token;
  err.foundOwner = current;
  throw err;
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
  // Fix round 2, finding 1: optimistic write counter — every committed
  // write increments this by exactly one; withStore() re-checks it
  // immediately before the commit rename as a belt-and-braces assertion.
  if (!Number.isInteger(data.seq) || data.seq < 0) {
    throw new TicketStoreError('tickets store corrupted: seq must be a non-negative integer');
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

// Fix round 3 (review #3, MAJOR #2, tickets.js:273): tolerant raw read of
// the events log — used both by the unlocked diagnostic (readStore(), via
// findOrphanSeqs()) and by the locked reconciliation step in withStore().
// Never throws: a missing file is "no events yet"; a corrupt trailing line
// is skipped (not this pass's job to repair). This includes a torn tail (a
// partial line with no closing '\n', left by a writer that crashed or
// short-wrote mid-append, fix round 4): split('\n') keeps it as its own
// final segment, JSON.parse on that segment throws and is swallowed just
// like any other corrupt line — it is NEVER concatenated with a neighbouring
// line and misparsed as one merged event, since a '\n' always separates
// segments. Repairing a torn tail (closing the boundary, recording it) is
// withStore()'s job, not this read's — see detectTornTail() below.
function readEventsRaw(dir) {
  const file = eventsFile(dir);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return [];
  }
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch (e) { /* tolerate a corrupt trailing line */ }
  }
  return out;
}

// Fix round 4 (review #4, MAJOR, tickets.js:396) / fix round 5 (review #5,
// MINOR, tickets.js:524): read-only detection of a torn JSONL tail — the
// last non-empty '\n'-delimited segment of the events file fails to
// JSON.parse, meaning it's a partial write (crash or short-write
// mid-append), not a complete-but-uncommitted event (that case is
// findOrphanSeqs()'s job). Fix round 5 corrected the fix-round-4 heuristic
// ("last byte isn't '\n'") — that missed a crash that leaves a raw,
// unescaped newline byte INSIDE an unterminated JSON string as the file's
// literal last byte: it reads as "newline-terminated" while the content is
// still a torn fragment. Parseability of the last real line is now the
// actual test; the physical trailing-newline check only decides whether a
// repair needs to add its own boundary '\n' (`needsBoundaryNewline`) or not
// (the fragment may already end in one).
//
// Returns null when there's nothing torn (file missing, empty, blank, or
// the last real line parses cleanly); otherwise
// { bytes, sha256, needsBoundaryNewline } describing the raw torn fragment
// (everything from the start of that unparseable last segment to EOF) —
// forensic enough to name the gap without trying to parse or repair it
// here. Safe to call unlocked: it never writes. Repairing it (closing the
// boundary if needed, recording the fragment in a reconcile line) only ever
// happens inside withStore(), under the lock.
function detectTornTail(dir) {
  const file = eventsFile(dir);
  let raw;
  try {
    raw = fs.readFileSync(file);
  } catch (e) {
    return null; // no log yet — nothing to be torn
  }
  if (raw.length === 0) return null;
  const text = raw.toString('utf8');
  const segments = text.split('\n');
  let lastIdx = segments.length - 1;
  while (lastIdx >= 0 && segments[lastIdx] === '') lastIdx--;
  if (lastIdx < 0) return null; // nothing but blank lines/newlines
  const lastLine = segments[lastIdx];
  try {
    JSON.parse(lastLine);
    return null; // the last real line is a complete, parseable JSON record
  } catch (e) {
    const prefix = segments.slice(0, lastIdx).join('\n') + (lastIdx > 0 ? '\n' : '');
    const prefixBytes = Buffer.byteLength(prefix, 'utf8');
    const fragment = raw.slice(prefixBytes);
    return {
      bytes: fragment.length,
      sha256: crypto.createHash('sha256').update(fragment).digest('hex'),
      needsBoundaryNewline: raw[raw.length - 1] !== 0x0a,
    };
  }
}

// Which logged seqs exceed the given committed seq? Read-only, no side
// effect — safe to call from an unlocked reader. A seq found here is NOT
// necessarily an orphan: an in-flight writer (holding the lock right now)
// may have appended its event and not yet committed state, which is
// indistinguishable from a genuine crash-orphan to an unlocked observer.
// That ambiguity is exactly why only withStore() (after acquiring the
// lock, when no writer can possibly be in flight) may treat these as real
// orphans and reconcile.
function findOrphanSeqs(dir, committedSeq) {
  const seqs = new Set();
  for (const ev of readEventsRaw(dir)) {
    if (typeof ev.seq === 'number' && ev.seq > committedSeq) seqs.add(ev.seq);
  }
  return Array.from(seqs).sort((a, b) => a - b);
}

// Reads + validates tickets.json only. NEVER touches the events log, NEVER
// writes, NEVER reconciles. Used both by the unlocked queries (via
// readStore(), below) and by withStore()'s own locked read.
function readStoreRaw(dir) {
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

// Fix round 3 (review #3, MAJOR #2): the UNLOCKED read path — used by
// get()/list()/openTickets() and by createTicketStore()'s open-time fail-
// closed check. Never writes, never reconciles (reconciliation is a
// writer-only, under-lock operation now — see withStore()). It DOES attach
// a non-enumerable `pendingEventSeqs` diagnostic (events in the log whose
// seq exceeds the committed state.seq) so a caller/test can observe an
// in-flight-or-orphaned tail without this read ever mutating anything.
function readStore(dir) {
  const data = readStoreRaw(dir);
  const pending = findOrphanSeqs(dir, data.seq);
  if (pending.length) {
    Object.defineProperty(data, 'pendingEventSeqs', { value: pending, enumerable: false, configurable: true });
  }
  // Fix round 4 (MAJOR, tickets.js:396): a torn tail is reported the same
  // read-only way — never repaired here, only in withStore() under the lock.
  if (detectTornTail(dir)) {
    Object.defineProperty(data, 'tornTail', { value: true, enumerable: false, configurable: true });
  }
  return data;
}

function writeStore(dir, data) {
  validateStoreShape(data);
  atomicWriteJson(ticketsFile(dir), data);
}

// Fix round 2, finding 2: the single place that appends to
// tickets.events.jsonl. Default path opens for append, writes, fsyncs, and
// closes — a write that can't reach the log throws and changes nothing
// upstream (withStore never proceeds to the state commit). `fsHooks` is a
// test-only override (store._fs): passing `{ appendFileSync }` lets a test
// inject a failing (or otherwise instrumented) append without relying on OS
// permission bits, which Windows does not enforce the same way a chmod
// would on POSIX; that path performs no fsync, since it exists for tests,
// not production. `prefixNewline` (fix round 4, MAJOR, tickets.js:396) is
// set by withStore() when the log's existing tail is torn (no trailing
// '\n') — prepending one '\n' before this write's own lines closes the
// boundary as the very first bytes of this single fsync'd append, so
// nothing this write writes can ever land concatenated onto a prior torn
// fragment.
// Fix round 5 (review #5, MAJOR, tickets.js:625): the default path used to
// call fs.writeSync() once and trust its return value's absence — writeSync
// may write FEWER bytes than asked (a short write) without throwing, and
// the old code never checked the count, so a short write left a torn
// partial line on disk while the caller proceeded as though the whole
// payload had landed. The write loop below tracks a byte offset and keeps
// calling writeSync from that offset until every byte is written; a
// zero/negative/non-finite progress report is treated as a hard failure
// (not an infinite retry). After the loop, fs.fstatSync(fd).size is
// compared against the pre-append size + payload length as a
// belt-and-braces integrity check — a mismatch throws
// TicketStoreError('tickets.events.jsonl short write...') BEFORE returning,
// so (write-ahead ordering) withStore() never reaches the state commit.
//
// `fsHooks` (store._fs) supports two override shapes, both test-only:
//  - `appendFileSync`: bypasses the write loop entirely (a full custom
//    single-call append, used when a test wants to inject a real side
//    effect mid-append via a wrapped fs.appendFileSync — e.g. the
//    post-commit lock-anomaly probe). No fsync in this path.
//  - `openSync`/`writeSync`/`fsyncSync`/`closeSync`/`fstatSync`: individual
//    overrides of the low-level calls the write loop makes, defaulting to
//    the real `fs.*` for anything not overridden — lets a test simulate a
//    genuine short write (or a throw) against a REAL fd without relying on
//    OS permission bits, which Windows does not enforce the same way a
//    chmod would on POSIX.
function appendEventsOrThrow(dir, fsHooks, lines, prefixNewline) {
  const file = eventsFile(dir);
  const text = (prefixNewline ? '\n' : '') + lines.join('\n') + '\n';
  if (fsHooks && typeof fsHooks.appendFileSync === 'function') {
    try {
      fsHooks.appendFileSync(file, text);
    } catch (e) {
      throw new TicketStoreError('tickets.events.jsonl append failed: ' + e.message);
    }
    return;
  }

  const openSync = (fsHooks && fsHooks.openSync) || fs.openSync;
  const writeSync = (fsHooks && fsHooks.writeSync) || fs.writeSync;
  const fsyncSync = (fsHooks && fsHooks.fsyncSync) || fs.fsyncSync;
  const closeSync = (fsHooks && fsHooks.closeSync) || fs.closeSync;
  const fstatSync = (fsHooks && fsHooks.fstatSync) || fs.fstatSync;

  let fd;
  try {
    fd = openSync(file, 'a');
  } catch (e) {
    throw new TicketStoreError('tickets.events.jsonl append failed: ' + e.message);
  }

  let preSize = null;
  try {
    preSize = fstatSync(fd).size;
  } catch (e) {
    // Non-fatal: the post-loop integrity check below just degrades to
    // "unknown" (skipped) if we couldn't establish a baseline size.
  }

  const buf = Buffer.from(text, 'utf8');
  let offset = 0;
  try {
    while (offset < buf.length) {
      let written;
      try {
        written = writeSync(fd, buf, offset, buf.length - offset);
      } catch (e) {
        throw new TicketStoreError('tickets.events.jsonl append failed (short write at byte ' + offset + '/' + buf.length + '): ' + e.message);
      }
      if (!Number.isFinite(written) || written <= 0) {
        throw new TicketStoreError('tickets.events.jsonl append failed: writeSync made no progress at byte ' + offset + '/' + buf.length);
      }
      offset += written;
    }
    fsyncSync(fd);
  } catch (e) {
    try { closeSync(fd); } catch (e2) { /* best effort */ }
    throw e instanceof TicketStoreError ? e : new TicketStoreError('tickets.events.jsonl append failed: ' + e.message);
  }

  let postSize = null;
  try {
    postSize = fstatSync(fd).size;
  } catch (e) {
    // Non-fatal — see preSize above.
  }
  try { closeSync(fd); } catch (e) { /* best effort */ }

  if (preSize !== null && postSize !== null && postSize !== preSize + buf.length) {
    throw new TicketStoreError(
      'tickets.events.jsonl short write: expected size ' + (preSize + buf.length) + ' after append but file is ' + postSize + ' bytes ' +
      '(writeSync reported full progress that fstatSync did not confirm)'
    );
  }
}

// Fix round 5 (review #5, MINOR, tickets.js:769): durable, cross-process
// carrier for a post-commit lock-ownership anomaly. `store.lastLockAnomaly`
// alone only survives within the process that observed it — a hook process
// that records it and then exits takes the record with it, and the next
// hook process opens a brand-new store object that never knew. Appended
// under the same write-all-or-throw discipline as appendEventsOrThrow's
// default path (loop writeSync to a real fd until every byte lands, fsync),
// but best-effort end-to-end: this runs from inside withStore()'s `finally`
// (see below), where a failure here must never mask the write that already
// committed, so every failure is swallowed rather than thrown. No lock is
// taken or needed — this file is append-only, and the only reader
// (readAnomaliesSidecar(), below) only ever runs under the ticket-store
// lock itself.
function appendAnomalySidecar(dir, anomaly) {
  const file = anomaliesFile(dir);
  const buf = Buffer.from(JSON.stringify(anomaly) + '\n', 'utf8');
  let fd;
  try {
    fd = fs.openSync(file, 'a');
  } catch (e) {
    return; // best-effort — store.lastLockAnomaly (same-process) is still set
  }
  try {
    let offset = 0;
    while (offset < buf.length) {
      const written = fs.writeSync(fd, buf, offset, buf.length - offset);
      if (!Number.isFinite(written) || written <= 0) break; // give up quietly; best-effort
      offset += written;
    }
    fs.fsyncSync(fd);
  } catch (e) {
    /* best-effort */
  } finally {
    try { fs.closeSync(fd); } catch (e2) { /* best-effort */ }
  }
}

// Called only from inside withStore(), under the lock. Tolerant read, same
// shape as readEventsRaw(): a missing file is "no anomalies"; a corrupt
// trailing line (e.g. a concurrent appendAnomalySidecar() caught mid-write
// by a reader that isn't holding this store's lock — cannot happen for THIS
// store's own lock, but keeps the reader honest regardless) is skipped, not
// this read's job to repair.
function readAnomaliesSidecar(dir) {
  const file = anomaliesFile(dir);
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return [];
  }
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch (e) { /* tolerate a corrupt trailing line */ }
  }
  return out;
}

// Called only from withStore(), only once the write that consumed the
// sidecar's contents (by emitting lock_anomaly lines for them) has actually
// committed — mirrors exactly when store.lastLockAnomaly itself is cleared.
// Best-effort: a failure here just means the same lines get re-emitted (as
// harmless duplicate lock_anomaly audit lines) on the next write, never a
// correctness problem.
function truncateAnomaliesSidecar(dir) {
  try { fs.writeFileSync(anomaliesFile(dir), ''); } catch (e) { /* best-effort */ }
}

// Run `fn(data)` under the cross-process lock, persisting whatever `fn`
// returns (or, for a typed refusal, whatever it threw via
// TicketWriteAndThrow) as the new store state. `fn` returns
// { data, result, events } on success; events is an array of
// {at, id, from, to, event, data} rows.
//
// Fix round 2 (findings 1+2) / fix round 3 (review #3, MAJOR #2): this is
// the ONE place that writes either tickets.events.jsonl or tickets.json,
// and it does so in a fixed order — (1) NOW that the lock is held, re-read
// state AND the events log directly (readStoreRaw + findOrphanSeqs) — no
// other writer can possibly be in flight, so any logged seq > state.seq
// here is a genuine orphan (a crash between a prior append and its rename),
// never a live writer's not-yet-committed event; (2) fn() builds the new
// state in memory; (3) the lock-token re-check runs as a belt-and-braces
// assertion (should be unreachable under a liveness-gated lock — see
// acquireLock()); (4) if an orphan was found, ONE reconcile line (naming
// the dropped seq(s)) is appended BEFORE this write's own event line(s), in
// the same fsync'd append, so the log always reads
// [orphan(s)…, reconcile, this-event] and orphan seqs are never reused —
// this write commits at newSeq = max(state.seq, maxOrphanSeq) + 1; (5)
// immediately before the commit rename, the on-disk seq is re-read and
// compared to what was read at the top — a mismatch is impossible under
// correct locking and throws loudly rather than silently overwriting; (6)
// the state commits (temp-file-then-rename). Success or typed refusal
// alike goes through every step — a refusal still legitimately mutates
// state (attempts / unknown_attempts) and must still be durably logged. If
// the lock cannot be acquired at all, none of this runs — no reconciliation
// happens (a reader observing a gap without the lock is observing an
// in-flight write, not an orphan).
function withStore(store, fn) {
  const staleMs = store.lockStaleMs || DEFAULT_LOCK_STALE_MS;
  const budgetMs = store.lockBudgetMs || (staleMs + LOCK_BUDGET_PAD_MS);
  const fsHooks = store._fs || null;
  const { dir: lockDir, token } = acquireLock(store.dir, staleMs, budgetMs);
  let ownLock = true;
  try {
    const data = readStoreRaw(store.dir);
    const readSeq = data.seq;
    const orphanSeqs = findOrphanSeqs(store.dir, readSeq); // safe now: lock held, no writer can be mid-flight
    // Fix round 4 (MAJOR, tickets.js:396): read-only detection now, under
    // the lock — the actual repair (closing the boundary) happens as part
    // of this write's own append, below, alongside the reconcile line that
    // documents it.
    const tornTail = detectTornTail(store.dir);

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

    // Belt-and-braces assertion, not the safety mechanism (fix round 2,
    // finding 1): under a liveness-gated lock a live holder is never
    // preempted, so this can only trip on a genuine bug.
    let current;
    try {
      current = JSON.parse(fs.readFileSync(ownerFile(lockDir), 'utf8'));
    } catch (e) {
      ownLock = false;
      throw new TicketStoreError('tickets.lock owner.json vanished before write — belt-and-braces assertion tripped (should be unreachable under a liveness-gated lock): ' + e.message);
    }
    if (current.token !== token) {
      ownLock = false;
      throw new TicketStoreError('tickets.lock token changed before write (belt-and-braces assertion tripped — should be unreachable under a liveness-gated lock)');
    }

    // Orphan reconciliation (fix round 3) + torn-tail reconciliation (fix
    // round 4, MAJOR, tickets.js:396), under lock only. The marker's own
    // seq documents the highest dropped seq it explains (== baseSeq); this
    // write's event(s) then commit strictly above it at baseSeq + 1, so an
    // orphan seq is never reused by a real commit. A torn tail carries no
    // seq of its own (it never parsed), so it never raises baseSeq by
    // itself — it just rides along on the same reconcile line (or gets one
    // of its own, if there were no ordinary orphans) as `torn_tail`.
    let baseSeq = readSeq;
    const preLines = [];
    if (orphanSeqs.length || tornTail) {
      if (orphanSeqs.length) baseSeq = Math.max(readSeq, orphanSeqs[orphanSeqs.length - 1]);
      const recData = { dropped: orphanSeqs };
      if (tornTail) recData.torn_tail = { bytes: tornTail.bytes, sha256: tornTail.sha256 };
      preLines.push(JSON.stringify({ at: nowIso(), id: null, from: null, to: null, event: 'reconcile', data: recData, seq: baseSeq }));
    }

    next.seq = baseSeq + 1;

    // Fix round 4 (MINOR, tickets.js:600) / fix round 5 (review #5, MINOR,
    // tickets.js:769): a lock anomaly recorded by a PRIOR write's release
    // (post-commit ownership loss — see withStore()'s finally, below) is
    // surfaced here, on the very next locked write, as its own event line
    // (one per surviving sidecar entry, in file order) before this write's
    // own event(s). The sidecar is the durable, cross-process source of
    // truth — it carries the anomaly even when the process that observed it
    // has since exited and this is a brand-new store object; `readSeq`-time
    // capture would be wrong here since we want whatever's on disk NOW,
    // under the lock. `store.lastLockAnomaly` (same-process fast path) is a
    // fallback only for the rare case the sidecar append itself failed.
    const anomalyRecords = readAnomaliesSidecar(store.dir);
    if (!anomalyRecords.length && store.lastLockAnomaly) anomalyRecords.push(store.lastLockAnomaly);
    for (const anomaly of anomalyRecords) {
      preLines.push(JSON.stringify({ at: nowIso(), id: null, from: null, to: null, event: 'lock_anomaly', data: anomaly, seq: next.seq }));
    }

    const evList = (events || []).map((ev) => Object.assign({}, ev, { seq: next.seq }));
    const allLines = preLines.concat(evList.map((ev) => JSON.stringify(ev)));
    if (allLines.length) {
      appendEventsOrThrow(store.dir, fsHooks, allLines, !!(tornTail && tornTail.needsBoundaryNewline));
    }

    // Immediately before the commit rename: re-read the on-disk seq.
    // Belt-and-braces (finding 1) — under correct liveness-gated locking
    // this can never actually change underneath us.
    let onDiskSeq;
    try {
      onDiskSeq = JSON.parse(fs.readFileSync(ticketsFile(store.dir), 'utf8')).seq;
    } catch (e) {
      onDiskSeq = undefined; // unreadable/corrupt — writeStore()'s own validateStoreShape will catch real corruption
    }
    if (onDiskSeq !== undefined && onDiskSeq !== readSeq) {
      throw new TicketStoreError('seq advanced under lock');
    }

    writeStore(store.dir, next); // the commit point

    // Fix round 5 (review #5, MINOR, tests/tickets.test.js:1206): a
    // test-only hook, never used in production, that fires immediately
    // after the state rename commits and before release — lets a test
    // inject a lock-ownership change at exactly the post-commit timing
    // window the anomaly-recording behavior is supposed to cover, rather
    // than faking it earlier (mid-append) as fix round 4's test did.
    if (fsHooks && typeof fsHooks.afterRename === 'function') {
      try { fsHooks.afterRename({ dir: store.dir, lockDir, token }); } catch (e) { /* test-only hook; never let it mask a real commit */ }
    }

    // Only clear/truncate once this write's anomaly line(s) are logged AND
    // the state commit above actually succeeded.
    if (anomalyRecords.length) truncateAnomaliesSidecar(store.dir);
    if (store.lastLockAnomaly) delete store.lastLockAnomaly;

    if (pendingErr) throw pendingErr;
    return result;
  } finally {
    if (ownLock) {
      try {
        releaseLockIfOwned(lockDir, token);
      } catch (e) {
        // releaseLockIfOwned() throws on a confirmed token mismatch (fix
        // round 3) — a real bug signal, but it must never mask the write
        // that already committed (or the error already in flight) here.
        // Fix round 4 (MINOR, tickets.js:600): record it instead of merely
        // swallowing it — the NEXT locked write logs it as `lock_anomaly`
        // (see above) and clears this flag once that write commits.
        // Fix round 5 (review #5, MINOR, tickets.js:769): ALSO append it to
        // the durable sidecar (tickets.anomalies.jsonl) — store.lastLockAnomaly
        // alone doesn't survive this process exiting before the next write,
        // which is exactly the shape a separate hook-process caller takes.
        const anomaly = {
          at: nowIso(),
          detail: 'lock ownership lost after commit',
          expectedToken: e && e.expectedToken,
          foundOwner: e && e.foundOwner,
        };
        store.lastLockAnomaly = anomaly;
        appendAnomalySidecar(store.dir, anomaly);
      }
    }
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

function createTicketStore({ dir, init, lockStaleMs, lockBudgetMs, _fs } = {}) {
  if (!dir) throw new TicketStoreError('createTicketStore requires { dir }');
  const file = ticketsFile(dir);
  const staleMs = lockStaleMs || DEFAULT_LOCK_STALE_MS;
  const budgetMs = lockBudgetMs || (staleMs + LOCK_BUDGET_PAD_MS);
  if (!fs.existsSync(file)) {
    if (init !== true) {
      throw new TicketStoreError('tickets store does not exist at ' + file + ' (pass { init: true } to create generation 1)');
    }
    fs.mkdirSync(dir, { recursive: true });
    const { dir: lockDir, token } = acquireLock(dir, staleMs, budgetMs);
    try {
      if (!fs.existsSync(file)) {
        writeStore(dir, { generation: 1, seq: 0, tickets: {}, unknown_attempts: [] });
      }
    } finally {
      try { releaseLockIfOwned(lockDir, token); } catch (e) { /* see withStore()'s finally for why this is swallowed here too */ }
    }
  } else {
    // Fail closed immediately on a corrupted/unreadable store rather than
    // waiting for the first operation to discover it.
    readStoreRaw(dir);
  }
  return { dir, lockStaleMs, lockBudgetMs, _fs };
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
      engine_pass: null,
      engine_result: null,
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
    // Fix round 2 (finding 3, MINOR): this shortcut bypasses fail()'s
    // recordAttempt(), so it must record its OWN denial event alongside the
    // expire transition — the reviewer's expected shape: events [..., expire,
    // denied(launch)] with attempts [launch].
    if (Date.parse(at) >= Date.parse(t.expires_at)) {
      const from = t.status;
      const reason = 'ticket ' + id + ' expired at ' + t.expires_at + ' — consumed but not launched before expiry';
      t.status = 'EXPIRED';
      t.outcome = { code: 'EXPIRED', reason, at };
      t.attempts.push({ at, event: 'launch', reason });
      const events = [
        { at, id, from, to: 'EXPIRED', event: 'expire', data: { expires_at: t.expires_at, trigger: 'launch' } },
        { at, id, from: 'EXPIRED', to: 'EXPIRED', event: 'denied', data: { attempted: 'launch', reason } },
      ];
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
    // which agent is asking. Fix round 2 (finding 3, MINOR): same denial
    // event as launch()'s expiry shortcut, above.
    if (Date.parse(at) >= Date.parse(t.expires_at)) {
      const from = t.status;
      const reason = 'ticket ' + id + ' expired at ' + t.expires_at + ' — launched but not resolved before expiry';
      t.status = 'EXPIRED';
      t.outcome = { code: 'EXPIRED', reason, at };
      t.attempts.push({ at, event: 'resolve', reason });
      const events = [
        { at, id, from, to: 'EXPIRED', event: 'expire', data: { expires_at: t.expires_at, trigger: 'resolve' } },
        { at, id, from: 'EXPIRED', to: 'EXPIRED', event: 'denied', data: { attempted: 'resolve', reason } },
      ];
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

// ---------------------------------------------------------------- enginePass
//
// WO-14b leg 4 fix round: the codex-engine ticket lifecycle is TWO passes,
// not two consumes. The Agent tool's own Pre/PostToolUse hooks already carry
// a codex-launcher ticket OPEN -> CONSUMED -> LAUNCHED before the launcher
// ever calls the engine server; enginePass() is a SEPARATE, idempotent
// marker recorded on an already-LAUNCHED ticket the moment the engine
// server actually invokes codex — never a second consume() (which used to
// reject the launcher's own call as a replay of the Agent-hook consume).
// Lawful only when: status is LAUNCHED, casting.vendor is 'openai' (engine
// tickets are OpenAI-served by construction), role matches the ticket's own
// recorded role, and engine_pass is still null (a second call is a replay —
// refused, never overwritten). The engine server calls this BEFORE spawning
// codex, never consume(); final resolve() still comes from the launcher's
// own SubagentStop (see engineResult() below).
function enginePass(store, id, { run_nonce, role, vendor } = {}) {
  return withStore(store, (data) => {
    const at = nowIso();
    const t = data.tickets[id];
    const fail = (reason, code) => {
      const events = recordAttempt(data, id, 'enginePass', reason, at);
      const err = new TicketTransitionError(reason, { id, ticket: t });
      if (code) err.code = code;
      throw new TicketWriteAndThrow(data, events, err);
    };
    if (!t) return fail('unknown ticket ' + id);
    if (t.status !== 'LAUNCHED') return fail('ticket ' + id + ' is ' + t.status + ', enginePass requires LAUNCHED (bound via the Agent tool Pre/PostToolUse hooks before the launcher calls the engine)');
    if (!t.casting || t.casting.vendor !== 'openai') return fail('ticket ' + id + ' casting vendor is ' + (t.casting && t.casting.vendor) + ', not openai — engine tickets must be OpenAI-served');
    if (role !== t.role) return fail('ticket ' + id + ' is for role ' + t.role + ', not ' + role);
    if (t.engine_pass !== null) return fail('ticket ' + id + ' engine_pass already recorded at ' + t.engine_pass.at + ' — replay refused', 'TICKET_REPLAY');
    t.engine_pass = { run_nonce: run_nonce || null, at };
    return {
      data, result: t,
      events: [{ at, id, from: t.status, to: t.status, event: 'enginePass', data: { run_nonce: run_nonce || null, role, vendor } }],
    };
  });
}

// --------------------------------------------------------------- engineResult
//
// Binds the engine's own verbatim report onto the ticket once codex has
// actually run — additive to (never a substitute for) the launcher's own
// SubagentStop resolve(), which is the ticket's real terminal transition.
// Requires a prior enginePass() (never called standalone). Does not itself
// change status: the ticket stays LAUNCHED until the outer Agent's
// SubagentStop resolves it — a caller (e.g. close(), leg 5) that wants the
// engine's own verbatim text rather than the launcher's relay reads
// ticket.engine_result.report.
function engineResult(store, id, { report, run_log } = {}) {
  return withStore(store, (data) => {
    const at = nowIso();
    const t = data.tickets[id];
    const fail = (reason) => {
      const events = recordAttempt(data, id, 'engineResult', reason, at);
      throw new TicketWriteAndThrow(data, events, new TicketTransitionError(reason, { id, ticket: t }));
    };
    if (!t) return fail('unknown ticket ' + id);
    if (!t.engine_pass) return fail('ticket ' + id + ' has no engine_pass recorded — engineResult() requires a prior enginePass()');
    t.engine_result = { report: typeof report === 'string' ? report : null, run_log: typeof run_log === 'string' ? run_log : null, at };
    return {
      data, result: t,
      events: [{ at, id, from: t.status, to: t.status, event: 'engineResult', data: { hasReport: typeof report === 'string' } }],
    };
  });
}

// ----------------------------------------------------------------- invalidate
//
// WO-14b leg 4 fix round (config_hash enforcement): a single-ticket,
// caller-named INVALIDATED transition — bumpGeneration()'s per-store sweep
// generalised to one id, for the config_hash mismatch guard in
// bridge/runtime.js (castings/aliases/manifest changed since this ticket was
// issued). Refuses (typed, recorded in attempts) on an unknown ticket or one
// already terminal — never re-invalidates or silently no-ops.
function invalidate(store, id, reason) {
  return withStore(store, (data) => {
    const at = nowIso();
    const t = data.tickets[id];
    const fail = (why) => {
      const events = recordAttempt(data, id, 'invalidate', why, at);
      throw new TicketWriteAndThrow(data, events, new TicketTransitionError(why, { id, ticket: t }));
    };
    if (!t) return fail('unknown ticket ' + id);
    if (TERMINAL.has(t.status)) return fail('ticket ' + id + ' is already ' + t.status + ', cannot invalidate');
    const from = t.status;
    t.status = 'INVALIDATED';
    t.outcome = { code: 'INVALIDATED', reason: reason || null, at };
    return {
      data, result: t,
      events: [{ at, id, from, to: 'INVALIDATED', event: 'invalidate', data: { reason: reason || null } }],
    };
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

// Fix round 3: readStore() here is a genuinely unlocked, non-reconciling
// read (see its header comment). Any pendingEventSeqs diagnostic it finds
// is mirrored onto the caller's own `store` object — not returned inline —
// so the query's return shape (ticket | null, or an array of tickets) stays
// exactly as it was; a caller that wants the diagnostic reads
// store.pendingEventSeqs after the call.
function get(store, id) {
  const data = readStore(store.dir);
  store.pendingEventSeqs = data.pendingEventSeqs || [];
  store.tornTail = !!data.tornTail;
  return data.tickets[id] || null;
}

function list(store, { status } = {}) {
  const data = readStore(store.dir);
  store.pendingEventSeqs = data.pendingEventSeqs || [];
  store.tornTail = !!data.tornTail;
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
  enginePass,
  engineResult,
  invalidate,
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
    acquireLock, releaseLockIfOwned, withStore, isPidAlive,
    DEFAULT_LOCK_STALE_MS, LOCK_BUDGET_PAD_MS,
  },
};
