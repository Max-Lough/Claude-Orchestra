#!/usr/bin/env node
/**
 * WO-14b leg 4 — the shared activation runtime core.
 *
 * One core; `bridge/hooks/ticket-gate.js`, `bridge/cli.js`, and the engine
 * server (`packs/codex/hooks/orchestra-engine-mcp.js`) are thin adapters over
 * it. Every export here is pure with respect to its explicit inputs plus the
 * filesystem state under `projectDir` — no network, no model calls.
 *
 * MODULE RESOLUTION: this file is shipped two places — the source tree
 * (`<repo>/bridge/runtime.js`) and, after `install.js --roster new`, the
 * installed copy (`<target>/.claude/orchestra/bridge/runtime.js`). In BOTH
 * layouts the sibling substrates (`router/`, `registry/`, `verifier/`,
 * `quartermaster/`) sit one directory above `bridge/` — `<repo>/router/...`
 * or `<target>/.claude/orchestra/router/...` — so every substrate require
 * below is resolved relative to `__dirname`, never to a project's `cwd()` or
 * a hardcoded repo path.
 *
 * TICKET STORE INITIALISATION: `tickets.createTicketStore({dir, init:true})`
 * is called on every `createRuntime()`. This is safe, not silent
 * reinitialisation: per `router/tickets.js`, `init:true` only ever CREATES a
 * fresh generation-1 store when the file is genuinely absent (the honest
 * state the very first call after `install.js --roster new` finds); when the
 * file already exists it is read and schema-validated, never overwritten —
 * a corrupted or schema-invalid store still fails every operation closed via
 * the store's own `TicketStoreError`. So "init:true only on first install"
 * is this function's natural behaviour, not a conditional this file has to
 * implement itself.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const SUBSTRATE_ROOT = path.join(__dirname, '..');

const tickets = require(path.join(SUBSTRATE_ROOT, 'router', 'tickets.js'));
const { createRouter } = require(path.join(SUBSTRATE_ROOT, 'router', 'router.js'));
const quartermaster = require(path.join(SUBSTRATE_ROOT, 'quartermaster', 'quartermaster.js'));
const { validate } = require(path.join(SUBSTRATE_ROOT, 'verifier', 'schema-check.js'));
const { readTrustedManifest, pinFileFor } = require(path.join(__dirname, 'manifest.js'));
const closeModule = require(path.join(__dirname, 'close.js'));
const telemetry = require(path.join(__dirname, 'telemetry.js'));

const CASTINGS_FILE = path.join(SUBSTRATE_ROOT, 'router', 'castings.json');
const ALIASES_FILE = path.join(SUBSTRATE_ROOT, 'router', 'aliases.json');
const DISPATCH_REQUEST_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(SUBSTRATE_ROOT, 'registry', 'schemas', 'dispatch-request.schema.json'), 'utf8')
);

const MANIFEST_REL = ['.claude', 'orchestra.json'];
const TICKETS_DIR_REL = ['.claude', 'orchestra', 'tickets'];
const TICKET_ID_RE = /TICKET=(tkt-[0-9a-f]{16})/;

// WO-14b repair B item 1 (amended): the dispatch envelope — one record per
// dispatched task, keyed by task_id (already a required field on every
// ticket) so closure derives its path directly, never by searching
// routing.events.jsonl. router/tickets.js mints ticket ids internally and
// ticket.schema.json is closed (additionalProperties:false, not in this
// leg's FILES) — an envelope containing ticket ids cannot exist before
// issuance, and no `envelope` field is added to the ticket shape. Reuses
// bridge/telemetry.js's ledgerDir() for the path (the same `ledger/<id>/`
// layout, just keyed by task_id here instead of ticket id).
function envelopeFile(projectDir, taskId) {
  return path.join(telemetry.ledgerDir(projectDir, taskId), 'envelope.json');
}
// Exclusive-create (fs 'wx'): the envelope is written exactly once, before
// any ticket for this task is issued — a second dispatch() for the same
// task_id must not silently overwrite the first task's audit record.
function writeEnvelopeExclusive(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', { flag: 'wx' });
}

function typedError(code, message, extra) {
  const e = new Error(message);
  e.code = code;
  if (extra) Object.assign(e, extra);
  return e;
}

// ------------------------------------------------------------------ manifest
//
// WO-14b leg 4b: the manifest is never trusted on its own — see
// bridge/manifest.js and roster/wo14b-leg3-redteam-1.md's HIGH finding (an
// unpinned/tampered orchestra.json could silently change activation state
// with nothing to detect it). loadState() is the ONE place every export
// below reads roster/rosterGeneration/seats from; it is readTrustedManifest()
// verbatim plus one convenience flag: `failClosed` is true exactly when the
// resolved roster is 'new' but the manifest backing it is not trusted (an
// UNPINNED project is instead forced to roster:'legacy' by
// readTrustedManifest() itself — inert, not fail-closed, per the order's own
// rule — so failClosed can only go true on a PRESENT pin whose manifest hash
// does not match).
function loadState(projectDir) {
  const state = readTrustedManifest({ projectDir });
  return Object.assign({}, state, { failClosed: state.roster === 'new' && state.trusted !== true });
}

function isRosterNew(state) {
  return !!state && state.roster === 'new';
}

// sha256 of the castings + aliases + manifest this runtime is operating
// under, matching ticket.schema.json's config_hash (64 lowercase hex). No
// separate exported hashing helper exists elsewhere in the tree (leg 2a left
// this to the caller — see tests/tickets.test.js's own CFG_HASH fixture), so
// this is the runtime's own canonical computation.
function configHash(projectDir) {
  const parts = [];
  for (const p of [CASTINGS_FILE, ALIASES_FILE, path.join(projectDir, ...MANIFEST_REL)]) {
    try { parts.push(fs.readFileSync(p, 'utf8')); } catch (_) { parts.push(''); }
  }
  return crypto.createHash('sha256').update(parts.join(' ')).digest('hex');
}

function currentGeneration(ticketsDir) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(ticketsDir, 'tickets.json'), 'utf8'));
    return typeof data.generation === 'number' ? data.generation : null;
  } catch (_) {
    return null;
  }
}

// ---------------------------------------------------------- review reserve
//
// The Sol-override reserve check (order §1, "the reserve check for a Sol
// override"). quartermaster.js exports no dedicated review-reserve
// predicate — bucketState()/bucketStateDetail()/confirm()/predictThrottle()/
// report()/publish()/analyze()/defaultForecast()/recordReading()/
// recordThrottle()/readEntries() is the complete export list. Per the
// order's own fallback instruction: compute it exactly as the router's
// reserveGate() does, generalised to the OU bucket reserveGate() itself
// never covers (reserveGate only gates AU-opus/AU-fable). router.js's
// normalizeBuckets() builds exactly {state, belowReserve,
// quartermasterConfirmation} from whatever bucketState() returns per
// bucket, reading `raw.belowReserve === true` — and quartermaster.js's own
// analyze() (quartermaster.js:596) already computes that flag per bucket as
// `remainingFraction < requiredReserve(forecast, RESERVE_CFG)`, the SAME
// requiredReserve() router.js imports and reserveGate() itself calls. So the
// one fresh Quartermaster snapshot this runtime already reads carries the
// OU-bucket reserve verdict pre-computed; reading `buckets.OU.belowReserve`
// here is that same arithmetic, not a re-implementation of it.
function reviewReservePassed(buckets) {
  const ou = buckets && typeof buckets === 'object' ? buckets.OU : undefined;
  if (!ou) return false; // missing bucket -> fail closed, never a silent pass
  const belowReserve = typeof ou === 'object' ? ou.belowReserve === true : false;
  return !belowReserve;
}

function digestBuckets(buckets) {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(buckets)).digest('hex');
  } catch (_) {
    return null;
  }
}

// -------------------------------------------------------- subagent mapping
//
// The installed agent file name for the served role (order §1). Builder is
// unconditional; Test Designer's "vs-<family>" and Reviewer's "-<family>"
// suffixes match the installed file names in roster/ (test-designer-vs-
// anthropic.md, test-designer-vs-openai.md, reviewer-anthropic.md,
// reviewer-openai.md). Test Designer's family is the parent IMPLEMENTATION's
// author family (what the Q0 is testing against — order.implementation_
// author_family, the exact field createQ0Order() stamps); Reviewer's family
// is the SERVED review casting's own vendor (the file names the reviewer
// that runs, not who it reviews). Every other role (Architect, Investigator,
// Data Engineer, Red Team, Sweeper, codex-engine launchers) installs 1:1 as
// its lowercased, hyphenated role name — this is the one part of the
// mapping the order does not fully enumerate; see the CONCERNS note in the
// leg-4 report.
// Anthropic-served roles that ship an in-harness file named exactly their
// lowercased-hyphenated role — the default fallback below is only correct
// for these because a file happens to exist at that name; every other role
// must be explicitly enumerated (never assumed via the fallback) so a role
// with no Anthropic-served file (Architect) or no OpenAI-served file (every
// role but Reviewer/Test Designer/Architect/Builder) fails closed instead of
// silently returning a name with no installed launcher behind it.
const ANTHROPIC_INHARNESS_ROLES = new Set(['Investigator', 'Data Engineer', 'Red Team', 'Sweeper']);

function subagentTypeFor(roleName, order, casting) {
  const vendor = (casting && casting.casting && casting.casting.vendor) || 'anthropic';

  if (roleName === 'Builder') {
    // order §1 pin: the SERVED casting decides the launcher, never a fixed
    // name — OpenAI-served (Luna preferredBounded, Terra mirror/denseMirror,
    // Sol override) routes to the NEW roster/builder-openai.md launcher;
    // Anthropic-served (Sonnet primary/dense, Opus deepPrimary) routes to
    // the in-harness roster/builder.md.
    return vendor === 'openai' ? 'builder-openai' : 'builder';
  }
  if (roleName === 'Test Designer') {
    // Unaffected by this fix: the file selection here already tracks the
    // IMPLEMENTATION author's family (cast-opposite by construction), which
    // is a different axis from the served vendor of the Test Designer
    // ticket itself — both lane files already exist (vs-anthropic,
    // vs-openai) and each is inherently the opposite-vendor launcher.
    const fam = (order && order.implementation_author_family) || 'anthropic';
    return 'test-designer-vs-' + fam;
  }
  if (roleName === 'Reviewer') {
    // Both lanes already exist (reviewer-anthropic.md, reviewer-openai.md);
    // the SERVED review casting's own vendor names the file directly.
    return 'reviewer-' + vendor;
  }
  if (roleName === 'Architect') {
    // roster/architect.md is the OpenAI (Sol) launcher only — there is no
    // installed launcher for Architect's Anthropic (Fable/Opus) rungs.
    if (vendor === 'openai') return 'architect';
    throw typedError('NO_LAUNCHER', "Architect has no installed launcher for vendor 'anthropic' (roster/architect.md is the OpenAI/Sol launcher only)");
  }
  if (ANTHROPIC_INHARNESS_ROLES.has(roleName)) {
    if (vendor === 'anthropic') return String(roleName).toLowerCase().replace(/\s+/g, '-');
    throw typedError('NO_LAUNCHER', roleName + " has no installed launcher for vendor '" + vendor + "' (its roster file is Anthropic in-harness only)");
  }
  // Every other role (Conductor, Verifier, Quartermaster, and any future
  // role not yet enumerated above) — unrecognised by this mapping is a
  // configuration defect, not a vendor mismatch to paper over.
  const fallback = String(roleName).toLowerCase().replace(/\s+/g, '-');
  return fallback;
}

// --------------------------------------------------------------- audit log

// WO-14b leg 4 fix round (item 10): routing events are MANDATORY, not
// best-effort. Throws typed ROUTING_LOG_UNAVAILABLE on any append failure
// (the log path replaced by a directory, an unwritable dir, …) — the caller
// (dispatch()) must treat that as fatal and issue nothing.
function appendRoutingEvent(projectDir, rec) {
  const dir = path.join(projectDir, ...TICKETS_DIR_REL);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      path.join(dir, 'routing.events.jsonl'),
      JSON.stringify(Object.assign({ at: new Date().toISOString() }, rec)) + '\n'
    );
  } catch (e) {
    throw typedError('ROUTING_LOG_UNAVAILABLE', 'routing.events.jsonl could not be appended: ' + (e && e.message ? e.message : String(e)));
  }
}

// -------------------------------------------------------------- gate: Pre

function denyPre(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
}
function allowPre(reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: reason,
    },
  };
}

function findByToolUseId(store, toolUseId) {
  return tickets.list(store).find((t) => t.consumed && t.consumed.tool_use_id === toolUseId) || null;
}
function findByAgentId(store, agentId) {
  return tickets.list(store).find((t) => t.launched && t.launched.agent_id === agentId) || null;
}

// ----------------------------------------------------------------- runtime

function createRuntime({ projectDir, repoDir } = {}) {
  if (!projectDir || typeof projectDir !== 'string') {
    throw typedError('RUNTIME_CONFIG', 'createRuntime requires { projectDir }');
  }
  // WO-14b leg 5: close() needs a git repo to verify commits against. It is
  // almost always the project dir itself (the installed, single-repo case);
  // `repoDir` exists only for the rare split layout, and defaults to
  // `projectDir` so every leg-4 caller (which never passed it) is unaffected.
  const effectiveRepoDir = repoDir && typeof repoDir === 'string' ? repoDir : projectDir;
  const ticketsDir = path.join(projectDir, ...TICKETS_DIR_REL);
  let storeCache = null;
  let routerCache = null;

  // WO-14b leg 4 fix round (item 9): the runtime NEVER initialises a missing
  // store — that used to mean a deleted store silently got a fresh
  // generation-1 ledger and new capability on the very next dispatch/gate
  // call, in violation of the explicit first-install-only initialisation
  // rule. A missing/unreadable store is now a typed STORE_UNAVAILABLE the
  // caller (dispatch()/gate()/requireTicket()) must refuse on. The store is
  // created exactly once, explicitly, by `bridge/cli.js init-store` (which
  // install.js --roster new calls) — never implicitly by this getter.
  function getStore() {
    if (storeCache) return storeCache;
    try {
      storeCache = tickets.createTicketStore({ dir: ticketsDir, init: false });
    } catch (e) {
      throw typedError('STORE_UNAVAILABLE', 'ticket store unavailable at ' + ticketsDir + ': ' + (e && e.message ? e.message : String(e)));
    }
    return storeCache;
  }

  // Explicit, one-time store creation — bridge/cli.js's `init-store`
  // subcommand (install.js --roster new calls it) is the only lawful caller.
  // Idempotent: a store that already exists is left untouched (same
  // contract as tickets.createTicketStore({init:true}) itself).
  function initStore() {
    storeCache = tickets.createTicketStore({ dir: ticketsDir, init: true });
    return { dir: ticketsDir };
  }

  function getRouter() {
    if (routerCache) return routerCache;
    const state = loadState(projectDir);
    routerCache = createRouter({ seats: state.seats });
    return routerCache;
  }

  // Compares the manifest's rosterGeneration against the store's; if the
  // manifest is ahead (a legacy flip, or any owner-driven bump), bumps the
  // store to match FIRST, invalidating every non-terminal ticket. This is
  // how a roster:new -> legacy flip invalidates open capability without the
  // runtime having been told directly — the next call that reaches here,
  // dispatch or gate alike, notices and closes the window itself.
  function generationCheck() {
    const state = loadState(projectDir);
    const manifestGen = state.rosterGeneration;
    if (manifestGen === null) return { bumped: false };
    let storeGen = currentGeneration(ticketsDir);
    if (storeGen === null) return { bumped: false }; // no store yet — nothing to invalidate
    if (manifestGen <= storeGen) return { bumped: false };
    // bumpGeneration() only ever increments the store by exactly one — it has
    // no "set to X" form — so catching the store up to a manifest that has
    // advanced by more than one generation (install.js's own flip logic
    // always advances by exactly one, but a test or a hand-edited manifest
    // may not) means looping, once per generation, until they match.
    const store = getStore();
    let result;
    while (storeGen < manifestGen) {
      result = tickets.bumpGeneration(
        store,
        'roster generation advanced by the manifest (' + storeGen + ' -> ' + manifestGen + ')'
      );
      storeGen = result.generation;
    }
    return { bumped: true, result };
  }

  // ---------------------------------------------------------------- dispatch

  function dispatch(request) {
    const problems = validate(DISPATCH_REQUEST_SCHEMA, request || {});
    if (problems.length) {
      return { ok: false, outcome: 'INVALID_REQUEST', reason: problems.join('; ') };
    }
    const state = loadState(projectDir);
    if (!isRosterNew(state)) {
      return {
        ok: false,
        outcome: 'INVALID_REQUEST',
        reason: 'dispatch() requires roster:new; this project runs roster:' + state.roster,
      };
    }
    // WO-14b leg 4b: a PIN-asserted roster:new backed by an untrusted
    // manifest (hash mismatch, or the manifest went missing/unreadable after
    // being pinned) must not route on the strength of data that could have
    // been tampered with since it was pinned — fail closed rather than
    // guessing which of the manifest's fields, if any, are still honest.
    if (state.failClosed) {
      return { ok: false, outcome: 'MANIFEST_UNTRUSTED', reason: state.reason };
    }
    generationCheck();

    let buckets;
    try {
      // quartermaster.js's own DEFAULT_READINGS_FILE is relative to ITS OWN
      // install location (one level above quartermaster/), not to this
      // project — see quartermaster.js:88-91. "One fresh Quartermaster
      // snapshot ... from the project's readings file" means scoped to
      // `projectDir`, so the readings path is passed explicitly here rather
      // than left to quartermaster's own default.
      buckets = quartermaster.bucketState({ file: path.join(projectDir, '.claude', 'orchestra-pool-readings.jsonl') });
    } catch (e) {
      // failClosed and any other read failure alike: typed P0_UNAVAILABLE,
      // never Green, nothing written (no ticket, no routing event).
      return { ok: false, outcome: 'P0_UNAVAILABLE', reason: e && e.message ? e.message : String(e) };
    }

    const taskId = (request.task_id && String(request.task_id)) || 'rt-' + crypto.randomBytes(8).toString('hex');
    const order = {
      task_id: taskId,
      class: request.class,
      risk: request.risk,
      goal: request.goal,
      acceptance_criteria: request.acceptance_criteria,
      co_author_families: [],
    };
    for (const k of [
      'tier', 'touches', 'context_shape', 'scope_allow', 'scope_deny', 'constraints',
      'context_packet', 'verification_commands', 'verification_tier', 'tool_budget',
      'destructive_actions', 'medium',
    ]) {
      if (request[k] !== undefined) order[k] = request[k];
    }
    if (request.parent_ticket !== undefined) order.parent_ticket = request.parent_ticket;
    if (request.human_authored === true) order.author_family = 'human';

    const castOpts = {};
    if (request.override) {
      castOpts.override = request.override;
      castOpts.reserveCheck = reviewReservePassed(buckets) ? 'passed' : 'not-passed';
    }

    let result;
    try {
      result = getRouter().dispatch(order, buckets, {
        castOpts,
        flags: { underSpecified: request.under_specified === true },
      });
    } catch (e) {
      return { ok: false, outcome: 'P0_UNAVAILABLE', reason: 'router.dispatch() threw: ' + (e && e.message ? e.message : String(e)) };
    }

    if (!result.ok) {
      // Item 10 (unchanged): the routing event is still appended for a
      // non-routing outcome — an append failure is typed and fatal. No
      // envelope is written here: nothing is being issued.
      try {
        appendRoutingEvent(projectDir, { request, buckets_digest: digestBuckets(buckets), outcome: result });
      } catch (e) {
        return { ok: false, outcome: e.code || 'ROUTING_LOG_UNAVAILABLE', reason: e && e.message ? e.message : String(e) };
      }
      return result;
    }

    // PL-12 (shakedown finding #5, 2026-09-02): route() returns
    // `casting: null` for a COMPUTED role — R0 Reviewer, whose casting is
    // derived from the author family set at close #1 and never cast here.
    // A Conductor that dispatches class R0 directly must get a typed
    // outcome, not a crash on `result.casting.casting` below; reviewer
    // tickets are issued only by close() on a RESOLVED implementation ticket.
    if (!result.casting || !result.casting.casting) {
      const typed = {
        ok: false,
        outcome: 'COMPUTED_CASTING',
        class: result.class,
        role: result.role,
        reason: 'class ' + request.class + ' (' + result.role + ') has a computed casting and cannot be dispatched ' +
          'directly — reviewer tickets are issued by orchestra_close on the RESOLVED implementation ticket',
      };
      try {
        appendRoutingEvent(projectDir, { request, buckets_digest: digestBuckets(buckets), outcome: typed });
      } catch (e) {
        return { ok: false, outcome: e.code || 'ROUTING_LOG_UNAVAILABLE', reason: e && e.message ? e.message : String(e) };
      }
      return typed;
    }

    // Item 9: fail closed on a missing/unreadable store rather than
    // silently reinitialising one — checked here, right before any ticket
    // would be issued (a routing outcome that isn't ok:true, or fails
    // earlier, never touches the store at all).
    let store;
    try {
      store = getStore();
    } catch (e) {
      return { ok: false, outcome: 'STORE_UNAVAILABLE', reason: e && e.message ? e.message : String(e) };
    }
    const hash = configHash(projectDir);

    // Item 1: stamp the canonical order with the dispatcher-owned fields
    // order.schema.json requires but a raw request cannot carry —
    // dispatch-request.schema.json's own description names exactly these
    // four (requested_casting, author_family, review_policy,
    // integrity_nonce) as this runtime's to mint, never the caller's.
    order.author_family = order.author_family === 'human' ? 'human' : result.casting.casting.vendor;
    order.requested_casting = result.casting.casting;
    order.review_policy = result.review_policy;
    order.integrity_nonce = crypto.randomBytes(8).toString('hex');

    // base: the repo HEAD at dispatch — the immutable audit base close #1
    // reads instead of the reported commit's parent (repair A/B ruling).
    let base = null;
    try {
      const r = spawnSync('git', ['-C', effectiveRepoDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
      if (!r.error && r.status === 0) base = String(r.stdout || '').trim() || null;
    } catch (_) { /* base stays null — e.g. a repo with no commits yet */ }

    const envelopePath = envelopeFile(projectDir, order.task_id);
    const envelope = {
      request,
      order,
      base,
      risk: request.risk,
      requested_casting: (result.casting && result.casting.requested) || result.casting.casting,
      served_casting: result.casting.casting,
      routing_result: result,
      at: new Date().toISOString(),
    };
    // Item 1 (amended): written exclusively, BEFORE any ticket is issued —
    // a write failure (including a pre-existing envelope for this task_id)
    // is typed ENVELOPE_UNAVAILABLE and nothing is issued. No ticket ids
    // are recorded here — closure derives this same path from a ticket's
    // own task_id.
    try {
      writeEnvelopeExclusive(envelopePath, envelope);
    } catch (e) {
      return { ok: false, outcome: 'ENVELOPE_UNAVAILABLE', reason: e && e.message ? e.message : String(e) };
    }

    // Item 10: the routing event stays the ticket census (request + routing
    // outcome) — unchanged by the envelope.
    try {
      appendRoutingEvent(projectDir, { request, buckets_digest: digestBuckets(buckets), outcome: result });
    } catch (e) {
      return { ok: false, outcome: e.code || 'ROUTING_LOG_UNAVAILABLE', reason: e && e.message ? e.message : String(e) };
    }

    // ticket.role is compared, verbatim, against the REAL Agent tool call's
    // tool_input.subagent_type by gate()'s PreToolUse consume() — that is
    // the installed agent FILE name ("builder"), not the router's internal
    // display role name ("Builder"). So the ticket's role field must be the
    // resolved installed subagent_type, computed once here and reused for
    // both the ticket and the returned spawn instruction, never the raw
    // router role name. subagentTypeFor() throws typed NO_LAUNCHER when the
    // served vendor has no installed launcher for the role (item 1) —
    // nothing is issued in that case either.
    let q0SubagentType = null;
    let q0Ticket = null;
    try {
      if (result.q0 && result.q0.cast && result.q0.cast.ok) {
        const q0Order = result.q0.order;
        const q0Cast = result.q0.cast;
        q0SubagentType = subagentTypeFor(q0Cast.role, q0Order, q0Cast);
        q0Ticket = tickets.issue(store, {
          kind: 'q0',
          task_id: q0Order.task_id,
          class: q0Order.class,
          role: q0SubagentType,
          rung: q0Cast.rung,
          tier: q0Cast.tier === undefined ? null : q0Cast.tier,
          casting: q0Cast.casting,
          author_family: q0Cast.casting.vendor,
          parent_ticket: null,
          config_hash: hash,
        });
      }

      var implAuthorFamily = order.author_family === 'human' ? 'human' : result.casting.casting.vendor;
      var implSubagentType = subagentTypeFor(result.role, order, result.casting);
    } catch (e) {
      return { ok: false, outcome: e.code || 'NO_LAUNCHER', reason: e && e.message ? e.message : String(e) };
    }
    const implTicket = tickets.issue(store, {
      kind: 'implementation',
      task_id: order.task_id,
      class: result.class,
      role: implSubagentType,
      rung: result.casting.rung,
      tier: result.casting.tier === undefined ? (order.tier || null) : result.casting.tier,
      casting: result.casting.casting,
      author_family: implAuthorFamily,
      q0_ticket: q0Ticket ? q0Ticket.id : null,
      config_hash: hash,
      parent_ticket: request.parent_ticket !== undefined ? request.parent_ticket : null,
    });

    // Item 1: the codex-launcher body extracts TICKET=/MODEL=/EFFORT=/ROLE=
    // from its own Agent-tool prompt (reviewer-openai.md, test-designer-vs-
    // anthropic.md, roster/builder-openai.md, architect.md) — the header
    // this runtime hands back must carry all four, not just the ticket id.
    // MODEL is the SERVED casting's model (e.g. "GPT-5.6 Terra"), never the
    // requested one; ROLE is the resolved installed subagent_type (the same
    // value bound into the ticket's own role field above).
    const promptHeader =
      'TICKET=' + implTicket.id + '\n' +
      'MODEL=' + (result.casting.casting.model || '') + '\n' +
      'EFFORT=' + (result.casting.casting.effort || '') + '\n' +
      'ROLE=' + implSubagentType + '\n';

    return {
      ok: true,
      tickets: { implementation: implTicket, q0: q0Ticket },
      spawn: {
        subagent_type: implSubagentType,
        prompt_header: promptHeader,
      },
      review_policy: result.review_policy,
      casting: result.casting,
      requested: result.casting && result.casting.requested,
      recastFrom: result.casting && result.casting.recastFrom,
    };
  }

  // -------------------------------------------------------------------- gate

  function gate(event) {
    const state = loadState(projectDir);
    if (!isRosterNew(state)) return { inert: true };
    const hookEvent = event && event.hook_event_name;

    try {
      // WO-14b leg 4b: a PIN-asserted roster:new backed by an untrusted
      // manifest fails EVERY gate decision closed instead of running the
      // normal ticket logic against data that could have been tampered with
      // since it was pinned — deny every PreToolUse(Agent), block every
      // Stop; Post/SubagentStop bind nothing (there is no ticket state left
      // to safely mutate) and are reported inert rather than silently
      // "log and continue", which would suggest a real decision was made.
      if (state.failClosed) {
        if (hookEvent === 'PreToolUse' && event.tool_name === 'Agent') {
          return denyPre('manifest untrusted (' + state.reason + ') — ticket gate fails closed under roster:new');
        }
        if (hookEvent === 'Stop') {
          // PL-16 (shakedown finding, 2026-09-01, order #3): blocking every
          // Stop attempt while the mismatch persisted (a builder had an older
          // branch checked out) looped the helm through dozens of identical
          // block/`Waiting.` rounds until the host's 9-block cap overrode.
          // One block per stop gesture informs; repeats are pure spin.
          if (event.stop_hook_active) return {};
          return {
            decision: 'block',
            reason: 'manifest untrusted (' + state.reason + ') — ticket gate fails closed under roster:new',
          };
        }
        // PL-15 (shakedown finding, 2026-09-01, order #3 — the telemetry
        // killer): SubagentStop used to be inert here, so the builder's REAL
        // Band-C report (which arrived while a subagent's branch checkout had
        // the manifest untrusted) was never bound; the one-use resolve() then
        // bound a 5-line housekeeping reply from the next warm resume, and
        // close #1 could never parse a report. Binding a host-recorded result
        // records evidence — it grants no authority, spawns nothing, and the
        // ticket store is not the manifest — so it must not fail closed.
        if (hookEvent !== 'SubagentStop') return { inert: true };
      }

      generationCheck();

      if (hookEvent === 'PreToolUse') {
        if (event.tool_name !== 'Agent') return { inert: true };
        if (event.agent_id) {
          return denyPre(
            'nested spawn from subagent ' + event.agent_id + ' is not permitted — only Conductor-issued ' +
              'tickets grant SPAWN, and no ticket issued to a subagent does'
          );
        }
        const store = getStore();
        const prompt = String((event.tool_input && event.tool_input.prompt) || '');
        const m = TICKET_ID_RE.exec(prompt);
        if (!m) return denyPre('no TICKET=<id> found in the Agent prompt');
        // Item 8: config_hash is checked at every consume — a ticket issued
        // under a castings/aliases/manifest configuration that has since
        // changed (a roster:new reinstall without a generation bump, a hand
        // edit) is INVALIDATED rather than consumed against stale config.
        const existing = tickets.get(store, m[1]);
        if (existing && !['CLOSED', 'EXPIRED', 'INVALIDATED'].includes(existing.status)) {
          const currentHash = configHash(projectDir);
          if (existing.config_hash !== currentHash) {
            try {
              tickets.invalidate(store, m[1], 'config_hash changed since issue (' + existing.config_hash + ' -> ' + currentHash + ')');
            } catch (_) { /* best effort — the deny below still fires */ }
            return denyPre('CONFIG_CHANGED: ticket ' + m[1] + ' was issued under a different configuration (config_hash mismatch) — invalidated');
          }
        }
        try {
          tickets.consume(store, m[1], {
            tool_use_id: event.tool_use_id,
            role: event.tool_input && event.tool_input.subagent_type,
          });
        } catch (e) {
          return denyPre(e && e.message ? e.message : String(e));
        }
        return allowPre('ticket ' + m[1] + ' consumed');
      }

      if (hookEvent === 'PostToolUse') {
        if (event.tool_name !== 'Agent') return { inert: true };
        if (event.agent_id) return {}; // nested subagent's own PostToolUse — not ours to bind
        const store = getStore();
        const t = findByToolUseId(store, event.tool_use_id);
        if (t) {
          try {
            tickets.launch(store, t.id, {
              agent_id: event.tool_response && event.tool_response.agentId,
              served_model: event.tool_response && event.tool_response.resolvedModel,
            });
          } catch (_) {
            /* log-and-continue: launch() already records the typed refusal in attempts */
          }
        }
        return {};
      }

      if (hookEvent === 'SubagentStop') {
        const store = getStore();
        const t = findByAgentId(store, event.agent_id);
        if (t) {
          try {
            tickets.resolve(store, t.id, {
              agent_id: event.agent_id,
              last_assistant_message: event.last_assistant_message,
              agent_transcript_path: event.agent_transcript_path,
            });
          } catch (_) {
            /* log-and-continue */
          }
        }
        return {};
      }

      if (hookEvent === 'Stop') {
        const store = getStore();
        const open = tickets.openTickets(store); // CONSUMED + LAUNCHED
        if (open.length === 0) return {};
        const bgIds = new Set((event.background_tasks || []).map((b) => b && b.id));
        const stillOpen = [];
        const HOST_DISAGREEMENT_REASON = 'host reports no running subagent';
        for (const t of open) {
          const agentId = t.launched && t.launched.agent_id;
          if (agentId && !bgIds.has(agentId)) {
            // The host reports no running subagent for a LAUNCHED ticket's
            // agent_id — mark it EXPIRED and do not block on it. tickets.js's
            // expire() is TTL-gated (it only sweeps a ticket whose real
            // expires_at has passed) and hardcodes its own outcome.reason —
            // it has no "force expire now, with this reason" form, and
            // tickets.js is a fixed contract this leg calls, never edits. So
            // the transition itself is forced by sweeping AT the ticket's own
            // expires_at boundary (never a later, fabricated "now"), and the
            // host-disagreement reason this order requires is recorded
            // alongside it via denied() (into ticket.attempts) since
            // expire()'s own outcome.reason cannot be overridden.
            try {
              tickets.expire(store, { id: t.id, now: t.expires_at });
              tickets.denied(store, t.id, 'stop-host-disagreement', HOST_DISAGREEMENT_REASON);
            } catch (_) { /* best effort */ }
            continue;
          }
          stillOpen.push(t);
        }
        if (stillOpen.length && !event.stop_hook_active) {
          return {
            decision: 'block',
            reason:
              'open tickets awaiting result: ' +
              stillOpen.map((t) => t.id + ' (' + t.role + ', ' + t.status + ')').join(', ') +
              ' — wait for the subagent result before stopping',
          };
        }
        return {};
      }

      return { inert: true };
    } catch (e) {
      const reason = 'ticket gate internal error — fail closed: ' + (e && e.message ? e.message : String(e));
      if (hookEvent === 'PreToolUse') return denyPre(reason);
      if (hookEvent === 'Stop') return { decision: 'block', reason };
      return {}; // Post/SubagentStop: log-and-continue, never block on these
    }
  }

  // ------------------------------------------------------- engine ticketing

  // For the engine server (packs/codex/hooks/orchestra-engine-mcp.js):
  // WO-14b leg 4 fix round (item 2 — the two-pass fix): this NO LONGER
  // consumes the ticket. The Agent tool's own Pre/PostToolUse hooks already
  // carried the codex-launcher ticket OPEN -> CONSUMED -> LAUNCHED before
  // the launcher subagent ever calls the engine server (the launcher IS the
  // ticket's Agent spawn) — a second consume() here rejected that same
  // ticket as a replay, so no ticket issued by dispatch() could ever
  // traverse Agent -> Codex successfully. This now requires the ticket to
  // already be LAUNCHED and records a separate, idempotent `enginePass()`
  // marker the moment codex is actually about to be invoked — a second call
  // on the same ticket is a real replay and is refused typed TICKET_REPLAY,
  // still without ever calling consume(). The final RESOLVED transition
  // still comes from the launcher's own SubagentStop, never from here.
  //
  // Item 5: bound to BOTH role and vendor, not just kind/phase — the
  // launcher supplies `role` from its own ROLE=<role> header line (item 1),
  // and every engine ticket must be OpenAI-served by construction (only the
  // OpenAI-served castings route through a codex launcher at all).
  // Item 8: config_hash is re-checked here too (every consume/enginePass) —
  // a mismatch INVALIDATES the ticket and refuses typed CONFIG_CHANGED.
  function requireTicket({ id, role, phase, casting } = {}) {
    if (phase !== 'exec' && phase !== 'review') {
      throw typedError('TICKET_MISMATCH', 'requireTicket phase must be "exec" or "review", got ' + JSON.stringify(phase));
    }
    const state = loadState(projectDir);
    if (!isRosterNew(state)) {
      throw typedError('TICKET_NOT_REQUIRED', 'roster is not "new" — ticket enforcement does not apply');
    }
    if (state.failClosed) {
      throw typedError(
        'TICKET_REQUIRED',
        'manifest untrusted (' + state.reason + ') — ticket enforcement fails closed under roster:new'
      );
    }
    if (typeof id !== 'string' || !id.trim()) {
      throw typedError('TICKET_REQUIRED', phase + ' requires a ticket id under roster:new; none was supplied');
    }
    if (typeof role !== 'string' || !role.trim()) {
      throw typedError('TICKET_REQUIRED', phase + ' requires a role (the launcher\'s own ROLE=<role> header) under roster:new; none was supplied');
    }
    generationCheck();
    let store;
    try {
      store = getStore();
    } catch (e) {
      throw typedError('STORE_UNAVAILABLE', e && e.message ? e.message : String(e));
    }
    const t = tickets.get(store, id);
    if (!t) throw typedError('TICKET_REQUIRED', 'unknown ticket ' + id);

    const wantsReviewer = phase === 'review';
    const isReviewerTicket = t.kind === 'reviewer';
    if (wantsReviewer !== isReviewerTicket) {
      throw typedError(
        'TICKET_MISMATCH',
        'ticket ' + id + ' is kind ' + t.kind + ', not valid for phase ' + phase
      );
    }
    if (t.role !== role) {
      throw typedError('TICKET_MISMATCH', 'ticket ' + id + ' is bound to role ' + t.role + ', not ' + role);
    }
    if (!t.casting || t.casting.vendor !== 'openai') {
      throw typedError(
        'TICKET_MISMATCH',
        'ticket ' + id + ' casting vendor is ' + (t.casting && t.casting.vendor) + ', not openai — engine tickets must be OpenAI-served'
      );
    }
    // Item 6: the caller (the engine server) may declare the model/effort it
    // was ASKED to run, for comparison ONLY — never as the value that is
    // actually invoked (see orchestra-engine-mcp.js's handler, which always
    // invokes the ticket's own casting.model/casting.effort). A declared
    // value that disagrees with the ticket's own casting refuses outright,
    // BEFORE enginePass() commits below, so a rejected call never leaves the
    // ticket consumed for a run that never happened under the caller's terms.
    if (casting && (typeof casting.model === 'string' || typeof casting.effort === 'string')) {
      const wantModel = typeof casting.model === 'string' ? casting.model : null;
      const wantEffort = typeof casting.effort === 'string' ? casting.effort : null;
      const haveModel = t.casting.model;
      const haveEffort = t.casting.effort;
      if ((wantModel !== null && wantModel !== haveModel) || (wantEffort !== null && wantEffort !== haveEffort)) {
        throw typedError(
          'CASTING_MISMATCH',
          'ticket ' + id + ' is cast ' + JSON.stringify({ model: haveModel, effort: haveEffort }) +
            ', caller supplied ' + JSON.stringify({ model: wantModel, effort: wantEffort })
        );
      }
    }

    const currentHash = configHash(projectDir);
    if (t.config_hash !== currentHash) {
      try {
        tickets.invalidate(store, id, 'config_hash changed since issue (' + t.config_hash + ' -> ' + currentHash + ')');
      } catch (_) { /* best effort — the throw below still fires */ }
      throw typedError('CONFIG_CHANGED', 'ticket ' + id + ' was issued under a different configuration (config_hash mismatch) — invalidated');
    }

    if (t.status !== 'LAUNCHED') {
      throw typedError(
        'TICKET_REQUIRED',
        'ticket ' + id + ' is ' + t.status + ', engine enforcement requires LAUNCHED (bound via the Agent tool Pre/PostToolUse hooks before the launcher calls the engine)'
      );
    }
    try {
      // Item 7: never invent an identity. Codex has not run yet at this
      // point (enginePass() is the PRE-spawn marker — see the file header
      // above requireTicket()) so there is no real "engine-reported" nonce
      // to record here; a plausible-looking random hex string previously
      // stood in for one, which is worse than admitting the truth — it lets
      // this field be mistaken for a verified identity when it never was
      // one. 'UNKNOWN' is the honest value; the run's real identity (the
      // runner's own "RUN NONCE: ..." header, and any reported model) is
      // captured verbatim, after the run actually happens, in
      // engine_result.report — see orchestra-engine-mcp.js's bindTicket().
      return tickets.enginePass(store, id, {
        run_nonce: 'UNKNOWN',
        role,
        vendor: t.casting.vendor,
      });
    } catch (e) {
      const code = (e && e.code) || 'TICKET_REQUIRED';
      throw typedError(code, e && e.message ? e.message : String(e));
    }
  }

  function ticketFor(phase, opts) {
    return requireTicket(Object.assign({}, opts, { phase }));
  }

  // ------------------------------------------------------- engine lifecycle
  //
  // Bound by packs/codex/hooks/orchestra-engine-mcp.js once a codex run this
  // ticket authorized (via requireTicket()/ticketFor() above) finishes. The
  // engine server holds no store of its own — these are thin wrappers over
  // router/tickets.js's launch/resolve/denied, bound to THIS runtime's store,
  // so the server can bind the CONSUMED ticket through LAUNCHED (launch) and
  // RESOLVED (resolve) on a completed run, or record a denied() attempt and
  // leave the ticket for its own TTL to expire when the run produced no
  // usable result (cancelled by the client, or killed by the server's own
  // kill-backstop). Every call here can throw the same typed
  // TicketTransitionError/TicketStoreError tickets.js itself throws — the
  // caller (never this runtime) decides whether that is fatal to the tool
  // result or merely logged; this runtime never fabricates a launch/resolve
  // that did not actually happen.
  function launch(id, opts) {
    return tickets.launch(getStore(), id, opts);
  }
  function resolve(id, opts) {
    return tickets.resolve(getStore(), id, opts);
  }
  function denied(id, event, reason) {
    return tickets.denied(getStore(), id, event, reason);
  }
  // Item 2: binds the engine's own verbatim report onto an already-
  // enginePass()'d ticket — additive to (never a substitute for) the
  // launcher's own SubagentStop resolve().
  function engineResult(id, opts) {
    return tickets.engineResult(getStore(), id, opts);
  }

  // ------------------------------------------------------------------ doctor

  function doctor() {
    const state = loadState(projectDir);
    const result = {
      roster: state.roster,
      rosterGeneration: state.rosterGeneration,
      store: { ok: false, dir: ticketsDir },
      openTickets: null,
      pin: {
        trusted: state.trusted,
        reason: state.reason,
        file: pinFileFor(projectDir),
        failClosed: state.failClosed,
        moved: state.moved === true, // WO-14b leg 5 Rider 2 (round-3 rule iv)
      },
    };
    try {
      const store = getStore();
      result.store.ok = true;
      result.openTickets = tickets.openTickets(store).length;
    } catch (e) {
      result.store.ok = false;
      result.store.error = e && e.message ? e.message : String(e);
    }
    return result;
  }

  // ------------------------------------------------------------------ close

  // WO-14b leg 5: two-stage closure (bridge/close.js). `ticketId` names a
  // RESOLVED ticket already bound by gate()'s SubagentStop handling (or the
  // engine lifecycle wrappers above, for a codex-lane ticket) — this never
  // accepts a caller-supplied report or verdict, only the id.
  function close(ticketId) {
    if (typeof ticketId !== 'string' || !ticketId.trim()) {
      throw typedError('CLOSE_CONFIG', 'close() requires a ticket id');
    }
    const store = getStore();
    const t = tickets.get(store, ticketId);
    if (!t) throw typedError('CLOSE_CONFIG', 'unknown ticket ' + ticketId);
    return closeModule.close({ ticket: t, projectDir, repoDir: effectiveRepoDir, store });
  }

  return {
    dispatch,
    gate,
    ticketFor,
    requireTicket,
    generationCheck,
    launch,
    resolve,
    denied,
    engineResult,
    initStore,
    doctor,
    close,
    _internal: { loadState, isRosterNew, configHash, currentGeneration, subagentTypeFor, reviewReservePassed, ticketsDir },
  };
}

module.exports = { createRuntime };
