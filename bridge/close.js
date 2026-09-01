#!/usr/bin/env node
/**
 * WO-14b leg 5 — two-stage ticket closure.
 *
 * close({ ticket, projectDir, repoDir }) dispatches on the ticket's kind:
 *   - an implementation (or q0) ticket goes through CLOSE #1 (closeImplementation
 *     below): validate the bound executor report, run verifier.runVerification
 *     with the manifest pinned OUTSIDE the audited commit, and on PASS mint the
 *     computed opposite-family reviewer ticket.
 *   - a reviewer ticket goes through CLOSE #2 (closeReview below): parse the
 *     mandatory structured verdict-json block, construct the verdict audit
 *     deterministically from replayed evidence and dispatcher-owned family
 *     facts, and CLOSE both tickets only for a genuinely closing verdict.
 *
 * Every outcome that is not a genuine close is `{ ok:false, outcome:
 * 'NOT_CLOSED', reason }` — never an exception for a lawful refusal (an
 * exception is reserved for a caller error, e.g. an unknown ticket id).
 *
 * FILE PROVENANCE (order ruling 1a): the manifest used to verify a commit is
 * ALWAYS read pinned at a ref OUTSIDE that commit (never from the audited
 * tree itself) — see resolveBaseRef()/runVerification's own manifestRef
 * handling. router/tickets.js is a fixed contract this module calls, never
 * edits (beyond the leg-5 rider elsewhere in this same order). verifier/**
 * is likewise called only through its exported functions (runVerification,
 * citationReplay) plus verifier/checkout.js's createCheckout — never edited.
 *
 * A STRUCTURAL GAP this module works around, documented here once rather
 * than at every call site: neither the ticket shape (router/tickets.js) nor
 * the dispatch request schema currently records a ticket's base ref, risk
 * tier, or declared order/mutations. This leg's FILES list does not permit
 * widening tickets.js beyond its own rider. So:
 *   - baseRef is derived as the named commit's immediate parent (`<commit>^`)
 *     via git, not read from a ticket field. A root commit (no parent)
 *     degrades verification (invariants/claimedChanges are skipped — both
 *     already tolerate a missing baseRef) rather than blocking closure.
 *   - risk (required by router.reviewer()) and the canonical order/mutations
 *     are recovered from `.claude/orchestra/tickets/routing.events.jsonl`,
 *     which bridge/runtime.js's dispatch() already durably logs (request +
 *     outcome, keyed by the minted ticket ids) for exactly this purpose.
 *     When no matching routing event exists, close #1 refuses
 *     (NOT_CLOSED) rather than guessing a risk tier.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SUBSTRATE_ROOT = path.join(__dirname, '..');
const tickets = require(path.join(SUBSTRATE_ROOT, 'router', 'tickets.js'));
const { createRouter } = require(path.join(SUBSTRATE_ROOT, 'router', 'router.js'));
const quartermaster = require(path.join(SUBSTRATE_ROOT, 'quartermaster', 'quartermaster.js'));
const { validate } = require(path.join(SUBSTRATE_ROOT, 'verifier', 'schema-check.js'));
const verifier = require(path.join(SUBSTRATE_ROOT, 'verifier', 'verifier.js'));
const { createCheckout } = require(path.join(SUBSTRATE_ROOT, 'verifier', 'checkout.js'));
const { readTrustedManifest } = require(path.join(__dirname, 'manifest.js'));
const telemetry = require(path.join(__dirname, 'telemetry.js'));

const REPORT_SCHEMA = JSON.parse(fs.readFileSync(path.join(SUBSTRATE_ROOT, 'registry', 'schemas', 'report.schema.json'), 'utf8'));
const VERDICT_SCHEMA = JSON.parse(fs.readFileSync(path.join(SUBSTRATE_ROOT, 'registry', 'schemas', 'verdict.schema.json'), 'utf8'));
const ORDER_SCHEMA = JSON.parse(fs.readFileSync(path.join(SUBSTRATE_ROOT, 'registry', 'schemas', 'order.schema.json'), 'utf8'));

const REPORT_STATUSES = REPORT_SCHEMA.properties.status.enum;
const TICKETS_DIR_REL = ['.claude', 'orchestra', 'tickets'];
const LEDGER_DIR_REL = ['.claude', 'orchestra', 'ledger'];

function typedError(code, message, extra) {
  const e = new Error(message);
  e.code = code;
  if (extra) Object.assign(e, extra);
  return e;
}

function notClosed(reason, extra) {
  return Object.assign({ ok: false, outcome: 'NOT_CLOSED', reason: String(reason) }, extra || {});
}

// ------------------------------------------------------------ report parsing

// The Band C report contract (STATUS / CHANGES / VERIFICATION / DEVIATIONS /
// CONCERNS — final-plan.md §3.5, registry/schemas/report.schema.json's
// `status` enum is the authority for valid values). This is a lightweight
// prose parser, not a JSON-schema validate of the raw text (the text is
// prose, never JSON) — see buildVerifierReport() for how the parsed pieces
// are assembled into a report.schema.json-conformant object using
// dispatcher-owned data for the fields prose alone cannot carry honestly
// (requested_casting, author_family, served_model, integrity.nonce_echo).
function section(text, name, otherHeaders) {
  const startRe = new RegExp('^' + name + '\\s*$', 'm');
  const m = startRe.exec(text);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const stopRe = new RegExp('^(?:' + otherHeaders.join('|') + ')\\s*$', 'm');
  const stopM = stopRe.exec(rest);
  return (stopM ? rest.slice(0, stopM.index) : rest).trim();
}

const BAND_C_HEADERS = ['CHANGES', 'VERIFICATION', 'DEVIATIONS', 'CONCERNS'];

function parseBandCReport(text) {
  const s = String(text || '');
  const statusMatch = /^STATUS:\s*([A-Z_]+)/m.exec(s);
  const status = statusMatch ? statusMatch[1].trim() : null;
  const changesRaw = section(s, 'CHANGES', BAND_C_HEADERS.filter((h) => h !== 'CHANGES'));
  const verificationRaw = section(s, 'VERIFICATION', BAND_C_HEADERS.filter((h) => h !== 'VERIFICATION'));
  const deviationsRaw = section(s, 'DEVIATIONS', BAND_C_HEADERS.filter((h) => h !== 'DEVIATIONS'));
  const concernsRaw = section(s, 'CONCERNS', BAND_C_HEADERS.filter((h) => h !== 'CONCERNS'));
  // Each CHANGES bullet is "<path:line> — <prose>" (final-plan.md's Band C
  // format); verifier.claimedChanges()/parseChangeClaim() need the bare
  // "path:line" token, not the trailing prose, so split on the first
  // em-dash/hyphen separator and keep only the citation itself.
  const changes = changesRaw
    ? changesRaw
        .split('\n')
        .map((l) => l.replace(/^-+\s*/, '').trim())
        .filter((l) => l && l.toLowerCase() !== 'none')
        .map((l) => l.split(/\s+[—–-]\s+/)[0].trim())
        .filter((l) => l)
    : [];
  const commitMatch =
    /\bcommit\b\s*[:=]?\s*`?([0-9a-f]{7,40})`?/i.exec(s) ||
    /\bhead\b\s*[:=]\s*`?([0-9a-f]{7,40})`?/i.exec(s);
  const nonceMatch = /REPORT INTEGRITY:\s*(\S+)/.exec(s);
  return {
    raw: s,
    status,
    changes,
    verificationRaw,
    deviationsRaw,
    concernsRaw,
    commit: commitMatch ? commitMatch[1] : null,
    reportIntegrityToken: nonceMatch ? nonceMatch[1] : null,
  };
}

function buildVerifierReport(parsed, ticket) {
  const nonce = parsed.reportIntegrityToken && parsed.reportIntegrityToken.length >= 8 ? parsed.reportIntegrityToken : ticket.id;
  return {
    status: parsed.status,
    summary: (parsed.changes[0] || parsed.status || 'report').slice(0, 500),
    changes: parsed.changes,
    requested_casting: ticket.casting,
    author_family: ticket.author_family === 'human' ? 'human' : ticket.author_family,
    co_author_families: [],
    served_model: (ticket.launched && ticket.launched.served_model) || 'UNKNOWN',
    integrity: { nonce_echo: nonce },
  };
}

// ------------------------------------------------------------ routing lookup

// The dispatch record this ticket (or its q0) was minted from —
// bridge/runtime.js's dispatch() already appends one for every dispatch,
// verbatim, before issuing any ticket (appendRoutingEvent). See the module
// doc comment for why this is where risk/order/mutations come from.
function findRoutingEvent(projectDir, ticketId) {
  const file = path.join(projectDir, ...TICKETS_DIR_REL, 'routing.events.jsonl');
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (_) {
    return null;
  }
  const lines = raw.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.trim()) continue;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch (_) {
      continue;
    }
    const t = ev.outcome && ev.outcome.tickets;
    if (t && ((t.implementation && t.implementation.id === ticketId) || (t.q0 && t.q0.id === ticketId))) {
      return ev;
    }
  }
  return null;
}

// ------------------------------------------------------------- git helpers

function resolveParentRef(repoDir, commit) {
  const r = spawnSync('git', ['-C', repoDir, 'rev-parse', '--verify', String(commit) + '^'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return String(r.stdout || '').trim() || null;
}

function ledgerDir(projectDir, ticketId) {
  return path.join(projectDir, ...LEDGER_DIR_REL, String(ticketId));
}
function atomicWriteJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

// ---------------------------------------------------------------- close #1

// close({ ticket }) on a RESOLVED implementation (or q0) ticket. See the
// order's §1 — this is a 1:1 mapping of its four numbered steps.
function closeImplementation(ctx, ticket) {
  if (ticket.status !== 'RESOLVED') {
    return notClosed('ticket ' + ticket.id + ' is ' + ticket.status + ', close requires RESOLVED');
  }
  if (ticket.kind !== 'implementation') {
    return notClosed('close #1 requires an implementation ticket; ' + ticket.id + ' is kind ' + ticket.kind);
  }
  if (ticket.q0_ticket) {
    const q0 = tickets.get(ctx.store, ticket.q0_ticket);
    if (!q0 || q0.status !== 'RESOLVED') {
      return notClosed('q0 ticket ' + ticket.q0_ticket + ' is not RESOLVED (' + (q0 ? q0.status : 'missing') + ')');
    }
  }

  // Never accept a report passed in by the caller — the report is the one
  // the host bound at SubagentStop (or the engine run log for codex
  // tickets), i.e. ticket.resolved.last_assistant_message, and nothing else.
  const bound = ticket.resolved && ticket.resolved.last_assistant_message;
  const parsed = parseBandCReport(bound);
  if (!parsed.status) {
    return notClosed('executor report unparseable — no STATUS line found in the bound report');
  }
  if (!REPORT_STATUSES.includes(parsed.status)) {
    return notClosed('executor status ' + parsed.status);
  }
  if (parsed.status !== 'DONE' && parsed.status !== 'PARTIAL') {
    return notClosed('executor status ' + parsed.status);
  }
  if (!parsed.commit) {
    return notClosed('no commit named');
  }

  const baseRef = resolveParentRef(ctx.repoDir, parsed.commit);
  const report = buildVerifierReport(parsed, ticket);

  const routingEvent = findRoutingEvent(ctx.projectDir, ticket.id);
  const candidateOrder = routingEvent && routingEvent.request && typeof routingEvent.request === 'object' ? routingEvent.request : undefined;
  // The routing record is the raw dispatch REQUEST, not a full order.schema.json
  // artifact (see the module doc comment) — only thread it through to
  // runVerification when it actually validates; a non-conformant object would
  // turn an omitted (skipped) check into a hard, unearned FAIL.
  const order = candidateOrder && validate(ORDER_SCHEMA, candidateOrder).length === 0 ? candidateOrder : undefined;
  const mutations = candidateOrder && Array.isArray(candidateOrder.mutations) ? candidateOrder.mutations : undefined;

  const vOpts = {
    repoDir: ctx.repoDir,
    commit: parsed.commit,
    report,
  };
  if (baseRef) {
    vOpts.baseRef = baseRef;
    vOpts.manifestRef = baseRef; // manifest pinned OUTSIDE the audited commit — ruling 1a
  }
  if (order) vOpts.order = order;
  if (mutations) vOpts.mutations = mutations;

  const vResult = verifier.runVerification(vOpts);
  atomicWriteJson(path.join(ledgerDir(ctx.projectDir, ticket.id), 'verifier.json'), {
    ticket: ticket.id,
    commit: parsed.commit,
    baseRef: baseRef || null,
    executorStatus: parsed.status,
    verification: vResult,
    at: new Date().toISOString(),
  });

  if (vResult.outcome !== 'PASS') {
    const failing = (vResult.checks || []).filter((c) => c.outcome !== 'PASS').map((c) => c.check + ':' + c.outcome);
    return notClosed('verifier ' + vResult.outcome + (failing.length ? ' (' + failing.join(', ') + ')' : ''));
  }

  // No review request is issued before this point.
  if (!routingEvent || !routingEvent.request || !routingEvent.request.risk) {
    return notClosed('cannot recover the dispatch record for ticket ' + ticket.id + ' — routing.events.jsonl has no matching entry with a risk tier; refusing to guess one');
  }
  const risk = routingEvent.request.risk;

  let buckets;
  try {
    buckets = quartermaster.bucketState({ file: path.join(ctx.projectDir, '.claude', 'orchestra-pool-readings.jsonl') });
  } catch (e) {
    return notClosed('quartermaster snapshot unavailable: ' + (e && e.message ? e.message : String(e)));
  }
  const manifestState = readTrustedManifest({ projectDir: ctx.projectDir });
  const rt = createRouter({ seats: manifestState.seats });

  const authorFamilies = [ticket.author_family].concat(order && Array.isArray(order.co_author_families) ? order.co_author_families : []);
  let revResult;
  try {
    revResult = rt.reviewer(authorFamilies, risk, { buckets });
  } catch (e) {
    return notClosed('reviewer computation failed: ' + (e && e.message ? e.message : String(e)));
  }
  if (!revResult.closes) {
    const lawful = (revResult.options || []).join(', ');
    return notClosed('review unavailable (' + revResult.reason + ')' + (lawful ? ' — lawful responses: ' + lawful : ''));
  }

  const reviewerFamily = revResult.casting.vendor;
  const reviewerTicket = tickets.issue(ctx.store, {
    kind: 'reviewer',
    task_id: ticket.task_id,
    class: ticket.class,
    role: 'reviewer-' + reviewerFamily,
    rung: ticket.rung || 'frontier',
    tier: ticket.tier === undefined ? null : ticket.tier,
    casting: revResult.casting,
    author_family: reviewerFamily, // dispatcher-owned — never asserted by the reviewer
    reviewer_of: ticket.id,
    config_hash: ticket.config_hash,
  });

  return {
    ok: true,
    stage: 'REVIEW_PENDING',
    reviewer_ticket: reviewerTicket,
    spawn: {
      subagent_type: 'reviewer-' + reviewerFamily,
      prompt_header: 'TICKET=' + reviewerTicket.id + '\n',
      pinned_range: baseRef ? { base_ref: baseRef, head_ref: parsed.commit } : { head_ref: parsed.commit },
    },
  };
}

// ----------------------------------------------------------- verdict parsing

// Exactly one ```verdict-json fenced block, valid JSON, schema-valid against
// verdict.schema.json — order §2. No block, two blocks, invalid JSON, or a
// schema failure are ALL "malformed" (never partially trusted).
function extractVerdictBlock(text) {
  const s = String(text || '');
  const re = /```verdict-json\r?\n([\s\S]*?)```/g;
  const found = [];
  let m;
  while ((m = re.exec(s))) found.push(m[1]);
  if (found.length !== 1) {
    return {
      malformed: true,
      reason: found.length === 0 ? 'no verdict-json block found' : found.length + ' verdict-json blocks found (exactly one required)',
    };
  }
  let obj;
  try {
    obj = JSON.parse(found[0]);
  } catch (e) {
    return { malformed: true, reason: 'invalid JSON in verdict-json block: ' + e.message };
  }
  const problems = validate(VERDICT_SCHEMA, obj);
  if (problems.length) {
    return { malformed: true, reason: 'schema failure: ' + problems.join('; ') };
  }
  return { malformed: false, value: obj };
}

function isReviewUnavailableText(text) {
  const s = String(text || '');
  return /VERDICT:\s*REVIEW_UNAVAILABLE/.test(s) || /REVIEW ENGINE:\s*NONE/.test(s);
}

// ---------------------------------------------------------------- close #2

function closeReview(ctx, ticket) {
  if (ticket.status !== 'RESOLVED') {
    return notClosed('ticket ' + ticket.id + ' is ' + ticket.status + ', close requires RESOLVED');
  }
  if (ticket.kind !== 'reviewer') {
    return notClosed('close #2 requires a reviewer ticket; ' + ticket.id + ' is kind ' + ticket.kind);
  }
  const bound = ticket.resolved && ticket.resolved.last_assistant_message;

  if (isReviewUnavailableText(bound)) {
    return notClosed('review unavailable');
  }

  const block = extractVerdictBlock(bound);
  if (block.malformed) {
    return notClosed('malformed verdict: ' + block.reason);
  }
  const verdictObj = block.value;

  if (!ticket.reviewer_of) {
    return notClosed('reviewer ticket ' + ticket.id + ' carries no reviewer_of — cannot locate the implementation ticket it reviews');
  }
  const implTicket = tickets.get(ctx.store, ticket.reviewer_of);
  if (!implTicket) {
    return notClosed('reviewer_of target ' + ticket.reviewer_of + ' does not exist');
  }

  // cross_family: computed from the two tickets' dispatcher-owned
  // author_family fields, NEVER from the verdict text.
  const crossFamily = implTicket.author_family !== ticket.author_family;

  // Codex-lane run_nonce: the runner's own asserted line must match the
  // verdict block's own run_nonce for a codex-driven (OpenAI-family) review.
  const isCodexLane = ticket.author_family === 'openai';
  if (isCodexLane) {
    const runnerNonceMatch = /REVIEW RUN NONCE:\s*(\S+)/.exec(String(bound || ''));
    const runnerNonce = runnerNonceMatch ? runnerNonceMatch[1] : null;
    if (runnerNonce && verdictObj.run_nonce !== runnerNonce) {
      return notClosed('run_nonce mismatch: verdict-json declares ' + JSON.stringify(verdictObj.run_nonce) + ', runner asserted ' + JSON.stringify(runnerNonce));
    }
    if (!runnerNonce && verdictObj.run_nonce) {
      return notClosed('run_nonce mismatch: verdict-json declares ' + JSON.stringify(verdictObj.run_nonce) + ' but the runner asserted no REVIEW RUN NONCE line');
    }
  }

  // Re-run every citation the block claims to have checked, through the
  // Verifier's own citation replay — never trust the block's self-reported
  // MATCH/MISMATCH.
  let citationReplayItems = [];
  const citationsClaimed = Array.isArray(verdictObj.citation_replay) ? verdictObj.citation_replay : [];
  if (citationsClaimed.length) {
    const verifierArtifactPath = path.join(ledgerDir(ctx.projectDir, implTicket.id), 'verifier.json');
    let verifierArtifact = null;
    try {
      verifierArtifact = JSON.parse(fs.readFileSync(verifierArtifactPath, 'utf8'));
    } catch (_) {
      verifierArtifact = null;
    }
    if (verifierArtifact && verifierArtifact.commit) {
      const checkout = createCheckout(ctx.repoDir, verifierArtifact.commit, {});
      if (!checkout.error) {
        try {
          const replay = verifier.citationReplay(
            checkout.dir,
            citationsClaimed.map((c) => ({ citation: c.citation, command: c.command }))
          );
          citationReplayItems = (replay.items || []).map((it) => ({
            citation: it.citation,
            replayed: it.replayed,
            result: it.result === 'DIVERGES' ? 'DIVERGES' : it.result === 'MATCHES' ? 'MATCHES' : 'UNREPLAYABLE',
          }));
        } finally {
          checkout.teardown();
        }
      } else {
        citationReplayItems = citationsClaimed.map((c) => ({ citation: c.citation, replayed: false, result: 'UNREPLAYABLE' }));
      }
    } else {
      citationReplayItems = citationsClaimed.map((c) => ({ citation: c.citation, replayed: false, result: 'UNREPLAYABLE' }));
    }
  }

  const findings = Array.isArray(verdictObj.findings) ? verdictObj.findings : [];
  const refutationDutyPresent = !!(verdictObj.refutation_duty && verdictObj.refutation_duty.present === true);

  // gate_class: whether this verdict authorizes Principal-tier, data, or
  // security work. Neither ticket carries the order's declared touches/tier
  // today (see module doc comment) — the routing event, when recoverable,
  // is the honest source; absent that, gate_class is false (never fabricated
  // true), which only ever makes the audit LESS permissive (falsification_run
  // stays optional rather than required).
  const routingEvent = findRoutingEvent(ctx.projectDir, implTicket.id);
  const gateClass = !!(
    routingEvent &&
    routingEvent.request &&
    (routingEvent.request.tier === 'principal' || (Array.isArray(routingEvent.request.touches) && routingEvent.request.touches.some((t) => ['security', 'data'].includes(t))))
  );

  const audit = {
    task_id: implTicket.task_id,
    verdict: verdictObj.verdict === 'APPROVE' ? 'APPROVE' : 'REVISE', // audit vocabulary has no REJECT — a REJECT never passes the audit either way
    citation_replay: citationReplayItems,
    refutation_duty_present: refutationDutyPresent,
    cross_family: crossFamily,
    gate_class: gateClass,
    outcome: 'FAIL',
  };
  const noBlockingFindings = !findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'MAJOR');
  const badCitations = citationReplayItems.filter((c) => c.result !== 'MATCHES');
  const hasReproducedFinding = findings.some((f) => f.reproduced === true);
  const citationsOk = badCitations.length === 0 || hasReproducedFinding;
  const auditPasses =
    verdictObj.verdict === 'APPROVE' &&
    crossFamily === true &&
    refutationDutyPresent === true &&
    citationsOk &&
    noBlockingFindings &&
    (!gateClass || (audit.falsification_run && audit.falsification_run.outcome === 'SURVIVED'));
  audit.outcome = auditPasses ? 'PASS' : 'FAIL';

  const auditProblems = validate(
    JSON.parse(fs.readFileSync(path.join(SUBSTRATE_ROOT, 'registry', 'schemas', 'verdict-audit.schema.json'), 'utf8')),
    audit
  );
  if (auditProblems.length) {
    return notClosed('unauditable: ' + auditProblems.join('; '));
  }

  // ---- decide (order §3.3) ----
  if (verdictObj.verdict === 'REVISE' || verdictObj.verdict === 'REJECT') {
    return notClosed(verdictObj.verdict, { findings });
  }
  // verdictObj.verdict === 'APPROVE' from here on.
  if (!crossFamily) {
    return notClosed('same-family review does not close — dispatch defect: reviewer ' + ticket.id + ' (' + ticket.author_family + ') and implementation ' + implTicket.id + ' (' + implTicket.author_family + ') share a family');
  }
  if (!noBlockingFindings) {
    return notClosed('CRITICAL/MAJOR finding under APPROVE', { findings });
  }
  if (!citationsOk) {
    return notClosed('citation MISMATCH unexplained');
  }

  // ---- telemetry (order §3.4) — only once we have a genuinely closing,
  // fully-audited verdict: casting-record is written only after the actual
  // result is captured, never speculatively.
  const implServed = (implTicket.launched && implTicket.launched.served_model) || 'UNKNOWN';
  const reviewerServed = (ticket.launched && ticket.launched.served_model) || 'UNKNOWN';
  let implStatus = 'DONE';
  try {
    const implArtifact = JSON.parse(fs.readFileSync(path.join(ledgerDir(ctx.projectDir, implTicket.id), 'verifier.json'), 'utf8'));
    if (implArtifact.executorStatus) implStatus = implArtifact.executorStatus;
  } catch (_) {
    /* best effort — keep the DONE default (this branch is only reachable via a prior PASS close #1) */
  }

  telemetry.writeCastingRecord(ctx.projectDir, implTicket.id, {
    task_id: implTicket.task_id,
    class: implTicket.class,
    risk: (routingEvent && routingEvent.request && routingEvent.request.risk) || 'T1',
    role: implTicket.role,
    requested_casting: implTicket.casting,
    served_model: implServed,
    bucket: 'OU',
    context_shape: 'repo',
    status: implStatus,
    review_cross_family: crossFamily,
  });
  telemetry.writeCastingRecord(ctx.projectDir, ticket.id, {
    task_id: ticket.task_id,
    class: ticket.class,
    risk: (routingEvent && routingEvent.request && routingEvent.request.risk) || 'T1',
    role: ticket.role,
    requested_casting: ticket.casting,
    served_model: reviewerServed,
    bucket: 'OU',
    context_shape: 'repo',
    status: 'DONE',
    verdict: verdictObj.verdict === 'APPROVE' ? 'APPROVE' : 'REVISE',
    review_cross_family: crossFamily,
  });
  telemetry.writeVerdictAudit(ctx.projectDir, ticket.id, audit);

  // There is no other path in this module that writes a CLOSED outcome.
  const implClose = tickets.close(ctx.store, implTicket.id, { code: 'CLOSED', reason: 'reviewer ' + ticket.id + ' APPROVE, cross-family, audited PASS' });
  const revClose = tickets.close(ctx.store, ticket.id, { code: 'CLOSED', reason: 'closes ' + implTicket.id });

  return {
    ok: true,
    outcome: 'CLOSED',
    implementation: implClose,
    reviewer: revClose,
    audit,
  };
}

// -------------------------------------------------------------------- close

function close({ ticket, projectDir, repoDir, store } = {}) {
  if (!ticket || typeof ticket !== 'object' || !ticket.id) {
    throw typedError('CLOSE_CONFIG', 'close() requires { ticket } — a real ticket object, not an id');
  }
  if (!projectDir || !repoDir) {
    throw typedError('CLOSE_CONFIG', 'close() requires { projectDir, repoDir }');
  }
  const ticketsDir = path.join(projectDir, ...TICKETS_DIR_REL);
  const ctx = { projectDir, repoDir, store: store || tickets.createTicketStore({ dir: ticketsDir, init: true }) };
  if (ticket.kind === 'reviewer') return closeReview(ctx, ticket);
  return closeImplementation(ctx, ticket);
}

module.exports = {
  close,
  closeImplementation,
  closeReview,
  parseBandCReport,
  buildVerifierReport,
  extractVerdictBlock,
  findRoutingEvent,
  ledgerDir,
};
