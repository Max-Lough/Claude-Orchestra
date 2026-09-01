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
const CASTINGS = JSON.parse(fs.readFileSync(path.join(SUBSTRATE_ROOT, 'router', 'castings.json'), 'utf8'));

const REPORT_STATUSES = REPORT_SCHEMA.properties.status.enum;
const TICKETS_DIR_REL = ['.claude', 'orchestra', 'tickets'];

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

const BAND_C_HEADERS = ['CHANGES', 'VERIFICATION', 'DEVIATIONS', 'CONCERNS', 'COMMIT', 'OPEN ISSUES'];

function parseBandCReport(text) {
  const s = String(text || '');
  const statusMatch = /^STATUS:\s*([A-Z_]+)/m.exec(s);
  const status = statusMatch ? statusMatch[1].trim() : null;
  const changesRaw = section(s, 'CHANGES', BAND_C_HEADERS.filter((h) => h !== 'CHANGES'));
  const verificationRaw = section(s, 'VERIFICATION', BAND_C_HEADERS.filter((h) => h !== 'VERIFICATION'));
  const deviationsRaw = section(s, 'DEVIATIONS', BAND_C_HEADERS.filter((h) => h !== 'DEVIATIONS'));
  // PL-15 hardening (order #3, 2026-09-01): builders emit near-miss labels —
  // "OPEN ISSUES" for CONCERNS, and a COMMIT section whose hash rides a
  // "Full hash:" bullet. Accept those exact aliases; anything else still
  // refuses, so a report with no concerns/commit at all parses no further.
  const concernsRaw =
    section(s, 'CONCERNS', BAND_C_HEADERS.filter((h) => h !== 'CONCERNS')) ||
    section(s, 'OPEN ISSUES', BAND_C_HEADERS.filter((h) => h !== 'OPEN ISSUES'));
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
    // PL-15 hardening: the "Full hash:" bullet builders write under a COMMIT
    // heading ("- Full hash: `902ed9e2...`").
    /\b(?:full\s+)?hash\b\s*[:=]\s*`?([0-9a-f]{7,40})`?/i.exec(s) ||
    /\bhead\b\s*[:=]\s*`?([0-9a-f]{7,40})`?/i.exec(s);
  const nonceMatch = /REPORT INTEGRITY:\s*(\S+)/.exec(s);
  return {
    raw: s,
    status,
    changes,
    changesRaw,
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

// ------------------------------------------------------------- envelope

// WO-14b repair B item 1/2: the dispatch envelope bridge/runtime.js's
// dispatch() writes before issuing any ticket, keyed by task_id (already a
// required field on every ticket) — closure locates it directly, never by
// searching routing.events.jsonl.
function envelopeFile(projectDir, taskId) {
  return path.join(telemetry.ledgerDir(projectDir, taskId), 'envelope.json');
}
function readEnvelope(projectDir, taskId) {
  try {
    return JSON.parse(fs.readFileSync(envelopeFile(projectDir, taskId), 'utf8'));
  } catch (_) {
    return null;
  }
}

// ------------------------------------------------------------- git helpers

function resolveParentRef(repoDir, commit) {
  const r = spawnSync('git', ['-C', repoDir, 'rev-parse', '--verify', String(commit) + '^'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return String(r.stdout || '').trim() || null;
}

// DRY (repair B amendment): ledgerDir()/atomicWriteJson() are bridge/
// telemetry.js's own — no duplicate definitions here.
const { ledgerDir, atomicWriteJson } = telemetry;

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
  // Item 3: all four Band-C sections must be present and non-empty (a
  // literal "none" bullet counts as present) — never a partial report
  // reaching the Verifier as if it were complete.
  for (const [name, raw] of [
    ['CHANGES', parsed.changesRaw],
    ['VERIFICATION', parsed.verificationRaw],
    ['DEVIATIONS', parsed.deviationsRaw],
    ['CONCERNS', parsed.concernsRaw],
  ]) {
    if (!raw || !String(raw).trim()) {
      return notClosed('incomplete report: missing or empty ' + name + ' section');
    }
  }

  // Item 2: close #1 reads the dispatch envelope by ticket (task_id) —
  // never the reported commit's parent, never a routing-log search.
  const envelope = readEnvelope(ctx.projectDir, ticket.task_id);
  if (!envelope) {
    return notClosed('envelope unavailable for task ' + ticket.task_id);
  }
  const baseRef = envelope.base || null; // the repo HEAD at dispatch — the immutable audit base
  const report = buildVerifierReport(parsed, ticket);

  // Item 2: the canonical order is the envelope's, validated against
  // order.schema.json — if it does not validate, refuse (never skipped).
  const orderProblems = validate(ORDER_SCHEMA, envelope.order || {});
  if (orderProblems.length) {
    return notClosed('envelope invalid: ' + orderProblems.join('; '));
  }
  const order = envelope.order;
  const mutations = Array.isArray(order.mutations) ? order.mutations : undefined;

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
  if (!envelope.risk) {
    return notClosed('envelope invalid: missing risk for ticket ' + ticket.id);
  }
  const risk = envelope.risk;

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

  // Item 9: close #1's spawn.prompt_header carries TICKET=, MODEL=,
  // EFFORT=, ROLE=, and PINNED_RANGE=<base>..<head> — the same four-plus-one
  // shape dispatch()'s own implementation spawn header carries, so the
  // reviewer launcher can extract MODEL=/EFFORT=/ROLE= for itself and pass
  // ticket/role to its engine tool verbatim (roster/reviewer-openai.md).
  const reviewerCasting = revResult.casting || {};
  const reviewerSubagentType = 'reviewer-' + reviewerFamily;
  const promptHeader =
    'TICKET=' + reviewerTicket.id + '\n' +
    'MODEL=' + (reviewerCasting.model || '') + '\n' +
    'EFFORT=' + (reviewerCasting.effort || '') + '\n' +
    'ROLE=' + reviewerSubagentType + '\n' +
    'PINNED_RANGE=' + (baseRef || '') + '..' + parsed.commit + '\n';

  return {
    ok: true,
    stage: 'REVIEW_PENDING',
    reviewer_ticket: reviewerTicket,
    spawn: {
      subagent_type: reviewerSubagentType,
      prompt_header: promptHeader,
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
  // Item 4: when the ticket carries a bound engine_result, the verdict/
  // report is taken ONLY from engine_result.report — the engine server's own
  // captured output, bound via requireTicket()/engineResult() — never from
  // the outer launcher's SubagentStop relay (resolved.last_assistant_message
  // is model-narrated and forgeable by the launcher).
  const hasEngineResult = !!(ticket.engine_result && typeof ticket.engine_result.report === 'string');
  const bound = hasEngineResult ? ticket.engine_result.report : (ticket.resolved && ticket.resolved.last_assistant_message);

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

  // Item 5: cross_family is derived from familyOf(casting.model) on each
  // ticket's own dispatcher-owned SERVED casting — never from author_family
  // fields (which the ticket schema stamps but this must not trust for the
  // family comparison itself) and never from the verdict text.
  const manifestStateForFamily = readTrustedManifest({ projectDir: ctx.projectDir });
  const rtForFamily = createRouter({ seats: manifestStateForFamily.seats });
  const implFamily = rtForFamily.familyOf(implTicket.casting && implTicket.casting.model);
  const reviewerFamily2 = rtForFamily.familyOf(ticket.casting && ticket.casting.model);
  const crossFamily = !!implFamily && !!reviewerFamily2 && implFamily !== reviewerFamily2;

  // Codex-lane run_nonce: the runner's own asserted line (inside the
  // authoritative bound report) must match the verdict block's own
  // run_nonce for an engine-driven review (item 4).
  if (hasEngineResult) {
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

  // Item 6: a non-MATCHES citation is excused ONLY by a reproduced finding
  // whose OWN path matches that citation's path — never by any unrelated
  // reproduced finding elsewhere in the same verdict.
  function citationPath(citation) {
    const s = String(citation || '');
    const m = /^([^:]+):\d+$/.exec(s);
    return m ? m[1] : s;
  }
  const badCitations = citationReplayItems.filter((c) => c.result !== 'MATCHES');
  const citationsOk = badCitations.every((c) => {
    const cp = citationPath(c.citation);
    return findings.some((f) => f.reproduced === true && f.path === cp);
  });

  // Item 7: gate_class — whether this verdict authorizes Principal-tier,
  // data, or security work — computed from the dispatch envelope's declared
  // class/touches, using the real trigger lists (securityTriggerList,
  // mandatoryReview.classes), never a fictitious touch value. Missing
  // envelope data leaves gate_class false (never fabricated true), which
  // only ever makes the audit LESS permissive.
  const envelope = readEnvelope(ctx.projectDir, implTicket.task_id);
  const envOrder = envelope && envelope.order;
  const envTouches = envOrder && Array.isArray(envOrder.touches) ? envOrder.touches : [];
  const gateClass = !!(
    envOrder &&
    (CASTINGS.mandatoryReview.classes.includes(envOrder.class) ||
      envTouches.some((t) => CASTINGS.securityTriggerList.includes(t)))
  );

  // Item 7 (amended by the finish oracle, roster/wo14b-finish-plan.md): this
  // tranche builds no falsification_run — there is no falsification
  // mechanism yet, so a gate-class closure is refused outright, typed
  // UNSUPPORTED_GATE_CLASS, before any audit is constructed. Non-gate-class
  // closure proceeds as ordered.
  if (gateClass) {
    return notClosed('UNSUPPORTED_GATE_CLASS: gate-class work (security touches or a mandatory-review class) has no falsification mechanism in this tranche');
  }

  const audit = {
    task_id: implTicket.task_id,
    verdict: verdictObj.verdict === 'APPROVE' ? 'APPROVE' : (verdictObj.verdict === 'REJECT' ? 'REJECT' : 'REVISE'),
    citation_replay: citationReplayItems,
    refutation_duty_present: refutationDutyPresent,
    cross_family: crossFamily,
    gate_class: false,
    outcome: 'FAIL',
  };
  const noBlockingFindings = !findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'MAJOR');
  const auditPasses =
    verdictObj.verdict === 'APPROVE' &&
    crossFamily === true &&
    refutationDutyPresent === true &&
    citationsOk &&
    noBlockingFindings;
  audit.outcome = auditPasses ? 'PASS' : 'FAIL';

  const auditProblems = validate(
    JSON.parse(fs.readFileSync(path.join(SUBSTRATE_ROOT, 'registry', 'schemas', 'verdict-audit.schema.json'), 'utf8')),
    audit
  );
  if (auditProblems.length) {
    return notClosed('unauditable: ' + auditProblems.join('; '));
  }

  // ---- decide (order §3.3) ----
  let closeReason = null;
  if (verdictObj.verdict === 'REVISE' || verdictObj.verdict === 'REJECT') {
    closeReason = verdictObj.verdict;
  } else if (!crossFamily) {
    // verdictObj.verdict === 'APPROVE' from here on.
    closeReason = 'same-family review does not close — dispatch defect: reviewer ' + ticket.id + ' and implementation ' + implTicket.id + ' share a family';
  } else if (!noBlockingFindings) {
    closeReason = 'CRITICAL/MAJOR finding under APPROVE';
  } else if (!citationsOk) {
    closeReason = 'citation MISMATCH unexplained';
  }

  // Item 8 / order §3.4: telemetry is written for EVERY genuinely-audited
  // outcome — closing or not — never only on the happy path. The reviewer's
  // served_model comes from the engine result (the verdict block's own
  // self-reported served_model, itself part of the authoritative bound
  // report) for an engine-driven review, or 'UNKNOWN' — never the outer
  // launcher's ticket.launched.served_model, which on the codex lane names
  // the Haiku launcher, not the engine that actually served the review.
  const implServed = (implTicket.launched && implTicket.launched.served_model) || 'UNKNOWN';
  const reviewerServed = hasEngineResult
    ? ((verdictObj && typeof verdictObj.served_model === 'string' && verdictObj.served_model) || 'UNKNOWN')
    : ((ticket.launched && ticket.launched.served_model) || 'UNKNOWN');
  let implStatus = 'DONE';
  try {
    const implArtifact = JSON.parse(fs.readFileSync(path.join(ledgerDir(ctx.projectDir, implTicket.id), 'verifier.json'), 'utf8'));
    if (implArtifact.executorStatus) implStatus = implArtifact.executorStatus;
  } catch (_) {
    /* best effort — keep the DONE default (this branch is only reachable via a prior PASS close #1) */
  }
  const riskForTelemetry = (envelope && envelope.risk) || 'T1';

  telemetry.writeCastingRecord(ctx.projectDir, implTicket.id, {
    task_id: implTicket.task_id,
    class: implTicket.class,
    risk: riskForTelemetry,
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
    risk: riskForTelemetry,
    role: ticket.role,
    requested_casting: ticket.casting,
    served_model: reviewerServed,
    bucket: 'OU',
    context_shape: 'repo',
    status: 'DONE',
    verdict: verdictObj.verdict === 'APPROVE' ? 'APPROVE' : 'REVISE', // casting-record's own verdict enum has no REJECT (out of this leg's FILES)
    review_cross_family: crossFamily,
  });
  telemetry.writeVerdictAudit(ctx.projectDir, ticket.id, audit);

  if (closeReason) {
    // Item 8: durable NOT_CLOSED on BOTH tickets — status stays RESOLVED
    // (retryable), but the disclosed non-close is now recorded rather than
    // only ever returned to this one caller.
    const implClose = tickets.close(ctx.store, implTicket.id, { code: 'NOT_CLOSED', reason: closeReason });
    const revClose = tickets.close(ctx.store, ticket.id, { code: 'NOT_CLOSED', reason: closeReason });
    return notClosed(closeReason, {
      findings: (verdictObj.verdict === 'REVISE' || verdictObj.verdict === 'REJECT') ? findings : undefined,
      implementation: implClose,
      reviewer: revClose,
      audit,
    });
  }

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
