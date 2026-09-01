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

const SUBSTRATE_ROOT = path.join(__dirname, '..');

const tickets = require(path.join(SUBSTRATE_ROOT, 'router', 'tickets.js'));
const { createRouter } = require(path.join(SUBSTRATE_ROOT, 'router', 'router.js'));
const quartermaster = require(path.join(SUBSTRATE_ROOT, 'quartermaster', 'quartermaster.js'));
const { validate } = require(path.join(SUBSTRATE_ROOT, 'verifier', 'schema-check.js'));
const { readTrustedManifest, pinFileFor } = require(path.join(__dirname, 'manifest.js'));
const closeModule = require(path.join(__dirname, 'close.js'));

const CASTINGS_FILE = path.join(SUBSTRATE_ROOT, 'router', 'castings.json');
const ALIASES_FILE = path.join(SUBSTRATE_ROOT, 'router', 'aliases.json');
const DISPATCH_REQUEST_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(SUBSTRATE_ROOT, 'registry', 'schemas', 'dispatch-request.schema.json'), 'utf8')
);

const MANIFEST_REL = ['.claude', 'orchestra.json'];
const TICKETS_DIR_REL = ['.claude', 'orchestra', 'tickets'];
const TICKET_ID_RE = /TICKET=(tkt-[0-9a-f]{16})/;

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
function subagentTypeFor(roleName, order, casting) {
  if (roleName === 'Builder') return 'builder';
  if (roleName === 'Test Designer') {
    const fam = (order && order.implementation_author_family) || 'anthropic';
    return 'test-designer-vs-' + fam;
  }
  if (roleName === 'Reviewer') {
    const fam = (casting && casting.casting && casting.casting.vendor) || 'anthropic';
    return 'reviewer-' + fam;
  }
  return String(roleName).toLowerCase().replace(/\s+/g, '-');
}

// --------------------------------------------------------------- audit log

function appendRoutingEvent(projectDir, rec) {
  try {
    const dir = path.join(projectDir, ...TICKETS_DIR_REL);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      path.join(dir, 'routing.events.jsonl'),
      JSON.stringify(Object.assign({ at: new Date().toISOString() }, rec)) + '\n'
    );
  } catch (_) {
    /* best-effort audit trail — never blocks a dispatch outcome */
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

  function getStore() {
    if (storeCache) return storeCache;
    storeCache = tickets.createTicketStore({ dir: ticketsDir, init: true });
    return storeCache;
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
      'destructive_actions',
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

    appendRoutingEvent(projectDir, { request, buckets_digest: digestBuckets(buckets), outcome: result });

    if (!result.ok) return result;

    const store = getStore();
    const hash = configHash(projectDir);

    // ticket.role is compared, verbatim, against the REAL Agent tool call's
    // tool_input.subagent_type by gate()'s PreToolUse consume() — that is
    // the installed agent FILE name ("builder"), not the router's internal
    // display role name ("Builder"). So the ticket's role field must be the
    // resolved installed subagent_type, computed once here and reused for
    // both the ticket and the returned spawn instruction, never the raw
    // router role name.
    let q0SubagentType = null;
    let q0Ticket = null;
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

    const implAuthorFamily = order.author_family === 'human' ? 'human' : result.casting.casting.vendor;
    const implSubagentType = subagentTypeFor(result.role, order, result.casting);
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
    });

    return {
      ok: true,
      tickets: { implementation: implTicket, q0: q0Ticket },
      spawn: {
        subagent_type: implSubagentType,
        prompt_header: 'TICKET=' + implTicket.id + '\n',
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
          return {
            decision: 'block',
            reason: 'manifest untrusted (' + state.reason + ') — ticket gate fails closed under roster:new',
          };
        }
        return { inert: true };
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
  // consumes a ticket bound to `phase` ('exec'|'review') or throws typed
  // TICKET_REQUIRED / TICKET_MISMATCH. `phase:'exec'` accepts an
  // implementation or q0 ticket (anything that is not a reviewer ticket);
  // `phase:'review'` requires a reviewer ticket. The engine server has no
  // independent way to declare which ROLE it expects (orchestra_exec/
  // orchestra_review carry only an optional `ticket` id, per the order), so
  // the ticket's own recorded role is trusted and passed through to
  // consume() — see the leg-4 report CONCERNS for this reading of the
  // order's requireTicket({id, role, phase}) shape.
  function requireTicket({ id, phase } = {}) {
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
    generationCheck();
    const store = getStore();
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
    try {
      return tickets.consume(store, id, {
        tool_use_id: 'mcp:' + phase + ':' + crypto.randomBytes(6).toString('hex'),
        role: t.role,
      });
    } catch (e) {
      throw typedError('TICKET_REQUIRED', e && e.message ? e.message : String(e));
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
    doctor,
    close,
    _internal: { loadState, isRosterNew, configHash, currentGeneration, subagentTypeFor, reviewReservePassed, ticketsDir },
  };
}

module.exports = { createRuntime };
