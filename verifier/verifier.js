#!/usr/bin/env node
/**
 * WO-5 Verifier substrate — the deterministic core (final-plan.md catalog
 * entry 23, class V0). Establishes FACTS about a change mechanically — did
 * the declared verification run and pass, does the tree match the claim, do
 * cited lines say what the report says — and returns evidence, never a
 * verdict. A Verifier PASS is not an approval; every result carries that in
 * its shape (`evidence_not_approval: true`) so no downstream renderer can
 * lose it.
 *
 * Checks implemented here, all code, no model in the loop:
 *
 *   - manifest execution + exit-code capture (commands, versions, durations,
 *     output tails, tree identity)
 *   - nonce echo (order.integrity_nonce vs report.integrity.nonce_echo)
 *   - schema validation of artifacts against the WO-4 registry schemas
 *   - diff parsing + claimed-changes comparison (a report's path:line change
 *     claims replayed against the actual base..head diff)
 *   - mutation check (invert an assertion in the disposable checkout; a suite
 *     that stays green cannot fail, and a test that cannot fail proves
 *     nothing)
 *   - invariant comparison (run the same probe before and after; compare)
 *   - citation replay (path:line and command citations, MATCHES / DIVERGES /
 *     UNREPLAYABLE per the verdict-audit schema)
 *   - tree audits: the disposable checkout's before/after delta with
 *     generated-artifact classification, and the dispatcher-side guard of the
 *     real tree across the Verifier's own run
 *
 * Typed outcomes: PASS | FAIL | UNAVAILABLE | COVERAGE_GAP. Scope illusion is
 * named in the plan as the substrate's own failure mode, so results report
 * what RAN and what coverage the manifest DECLARED — never "verified". A
 * deterministic-only closure requires declared-complete oracle coverage AND
 * an outcome untouched by model assistance; every result therefore records
 * model-assist provenance as schema fields (this core always emits
 * `used: false` — the fields exist so a future model-assisted checklist path
 * cannot omit them).
 *
 * Trust model (ruling 1a, WO-8): the manifest the Verifier executes is
 * pinned OUTSIDE the commit under audit — read from an owner ref (the base
 * ref by default) via git show, never from the head checkout, where the
 * party under audit could edit it in the very diff being checked. A
 * caller-supplied manifest asserts the dispatcher as its trust boundary.
 * Artifact-sourced commands additionally run with a minimal environment
 * (no inherited secrets) and redacted output tails.
 *
 * Usage:
 *   node verifier/verifier.js --repo <dir> --commit <ref>
 *        (--manifest <m.json> | --manifest-ref <ref> | --base <ref>)
 *        [--base <ref>] [--manifest-path <repo-rel path>]
 *        [--order <o.json>] [--report <r.json>]
 *        [--mutations <mu.json>] [--invariants <i.json>]
 *        [--citations <c.json>]
 *   Exit codes: 0 PASS · 1 FAIL · 2 UNAVAILABLE · 3 COVERAGE_GAP.
 *
 * No dependencies; plain node, plain git.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { createCheckout, guardTree } = require('./checkout.js');
const { validate } = require('./schema-check.js');
const registry = require(path.join(__dirname, '..', 'registry', 'load.js'));

const OUTCOMES = ['PASS', 'FAIL', 'UNAVAILABLE', 'COVERAGE_GAP'];
const TAIL_CHARS = 2000;
const DEFAULT_TIMEOUT_MS = 120000;

// ---------------------------------------------------------------- envelope

// Every check result gets the same envelope: the typed outcome, the
// not-an-approval marker, and model-assist provenance as fields, not prose.
function result(check, outcome, fields) {
  if (!OUTCOMES.includes(outcome)) throw new Error('untyped outcome: ' + outcome);
  return Object.assign(
    {
      check,
      outcome,
      evidence_not_approval: true,
      model_assist: {
        used: false,
        family: null,
        casting: null,
        influenced_outcome: false,
        absorbing_rule: null,
      },
    },
    fields || {}
  );
}

function tail(text) {
  const s = String(text || '');
  return s.length > TAIL_CHARS ? '…' + s.slice(-TAIL_CHARS) : s;
}

// Confine an artifact-supplied relative path to `baseDir`. Mutation targets
// and path:line citations come from the party under audit, so a `../` or
// absolute path must never let a read or write escape the disposable
// checkout — bound (1)/(2) of the substrate's own write model. Returns the
// resolved absolute path, or null if it would escape.
function confine(baseDir, relPath) {
  if (typeof relPath !== 'string' || relPath === '') return null;
  if (path.isAbsolute(relPath)) return null;
  const base = path.resolve(baseDir);
  const resolved = path.resolve(base, relPath);
  const rel = path.relative(base, resolved);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  // Lexical containment is not enough (WO-14 re-review, WO-5 outstanding): a
  // symlink committed INSIDE the checkout by the party under audit passes
  // the checks above and is then followed by the read/write — the exact
  // escape this function exists to prevent. Resolve the real path (of the
  // target when it exists, else of its nearest existing ancestor) and
  // re-check containment against the real base.
  let realBase;
  try { realBase = fs.realpathSync(base); } catch (_) { return null; }
  let probe = resolved;
  const suffix = [];
  for (;;) {
    let real = null;
    try { real = fs.realpathSync(probe); } catch (_) { /* does not exist yet */ }
    if (real !== null) {
      const realResolved = suffix.length > 0 ? path.join(real, ...suffix) : real;
      const realRel = path.relative(realBase, realResolved);
      if (realRel === '' || realRel.startsWith('..') || path.isAbsolute(realRel)) return null;
      return resolved;
    }
    const parent = path.dirname(probe);
    if (parent === probe) return null; // walked off the top without finding anything real
    suffix.unshift(path.basename(probe));
    probe = parent;
  }
}

// A minimum floor and an explicit output ceiling: a manifest-supplied
// `timeout_ms: 1` or a suite that floods stdout must not silently become
// UNAVAILABLE and mask a red-reported-green (the contradiction check now
// fires on UNAVAILABLE too, but the floor/ceiling keep the common case a
// real result rather than a spawn artifact).
const MIN_TIMEOUT_MS = 1000;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

// Blast-radius reduction (ruling 1a, applied regardless of trust model):
// artifact-sourced commands run with a minimal environment — the party under
// audit must not inherit the dispatcher's secrets (API keys, tokens, cloud
// credentials). Only what a process needs to spawn and run at all survives.
const ENV_ALLOWLIST = [
  'PATH', 'PATHEXT', 'SYSTEMROOT', 'SYSTEMDRIVE', 'COMSPEC', 'WINDIR', 'OS',
  'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA',
  'PROGRAMFILES', 'PROGRAMDATA', 'COMMONPROGRAMFILES', 'NUMBER_OF_PROCESSORS',
  'PROCESSOR_ARCHITECTURE', 'LANG', 'LC_ALL', 'TZ', 'SHELL', 'USER', 'LOGNAME',
];
function minimalEnv() {
  const out = {};
  for (const k of ENV_ALLOWLIST) {
    if (process.env[k] !== undefined) out[k] = process.env[k];
  }
  return out;
}

// Redaction over recorded output tails — defense in depth behind the env
// allowlist, because tails are written into artifacts that outlive the run.
// Mechanical patterns for common credential shapes; never a parser.
const SECRET_PATTERNS = [
  [/\bsk-(?:ant-)?[A-Za-z0-9_-]{16,}\b/g, '[REDACTED]'],
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g, '[REDACTED]'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '[REDACTED]'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, '[REDACTED]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/g, '[REDACTED]'],
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}/gi, '$1[REDACTED]'],
  [/((?:API|ACCESS|SECRET|AUTH|SESSION)[_-]?(?:KEY|TOKEN|SECRET)["']?\s*[=:]\s*["']?)[^\s"']{8,}/gi, '$1[REDACTED]'],
];
function redact(text) {
  let s = String(text || '');
  for (const [re, sub] of SECRET_PATTERNS) s = s.replace(re, sub);
  return s;
}

// Requested castings are roster display names ("Sonnet 5", "GPT-5.6 Sol");
// served identities are runtime model ids ("claude-sonnet-5", "gpt-5.6-sol",
// "claude-opus-5[1m]", "claude-haiku-4-5-20251001"). The P15 detector asks
// whether a DIFFERENT model served the turn, so both sides are reduced to one
// canonical token before comparing: lower-case, vendor prefix and bracketed /
// date suffixes dropped, letters and digits only. A served id may carry a
// point release the roster name omits ("Fable 5" served as claude-fable-5-1),
// so the served token may extend the requested one. Shakedown order #5
// (PL-23): plain string equality flagged EVERY honest record as a P15 incident.
function canonicalModelToken(name) {
  let s = String(name || '').toLowerCase().trim();
  s = s.replace(/\[[^\]]*\]/g, '');
  s = s.replace(/^(anthropic|openai)[/:]/, '');
  s = s.replace(/^(claude|gpt)[-_ ]?/, '');
  s = s.replace(/[-_ .]?\d{8}$/, '');
  return s.replace(/[^a-z0-9]/g, '');
}
function modelNamesMatch(requested, served) {
  const a = canonicalModelToken(requested);
  const b = canonicalModelToken(served);
  if (!a || !b) return false;
  return a === b || b.startsWith(a);
}

// The shell could not even find the command (sh: 127, cmd.exe: 9009, or the
// shells' own not-found phrasing). Nothing was replayed, so nothing was
// refuted — the reviewer's sandbox may carry tools the replaying host does
// not (shakedown order #5: Sol cited `rg`, absent on the closing host).
function commandNotFound(r) {
  if (r.exit_code === 127 || r.exit_code === 9009) return true;
  if (r.exit_code === 0) return false;
  return /(?:^|\n)[^\n]*(?:: not found|command not found|is not recognized as an internal or external command)/i.test(r.stderr_tail || '');
}

function runShell(command, cwd, timeoutMs) {
  const started = Date.now();
  const effectiveTimeout = Math.max(MIN_TIMEOUT_MS, timeoutMs || DEFAULT_TIMEOUT_MS);
  const r = spawnSync(command, {
    shell: true,
    cwd,
    env: minimalEnv(),
    encoding: 'utf8',
    timeout: effectiveTimeout,
    maxBuffer: MAX_OUTPUT_BYTES,
    windowsHide: true,
  });
  return {
    command,
    exit_code: r.status,
    signal: r.signal || null,
    error: r.error ? String(r.error.message || r.error) : null,
    timed_out: !!(r.error && r.error.code === 'ETIMEDOUT'),
    duration_ms: Date.now() - started,
    // Redact BEFORE truncating (R0-EX3): tail-then-redact let a credential
    // straddle the cutoff and survive as a reconstructible suffix — the
    // pattern only matches whole tokens, and half a token is still a secret.
    stdout_tail: tail(redact(r.stdout)),
    stderr_tail: tail(redact(r.stderr)),
  };
}

// A ref beginning with '-' could be parsed by git as an option; refs enter
// from opts today and may be artifact-adjacent tomorrow. Reject at the door.
function badRef(ref) {
  return (typeof ref !== 'string' && typeof ref !== 'number') || String(ref).startsWith('-');
}

function runGit(args, cwd) {
  return spawnSync('git', args, { encoding: 'utf8', cwd, windowsHide: true });
}

// Commit + dirty marker: the identity every result pins its evidence to.
function treeIdentity(dir) {
  const head = runGit(['rev-parse', 'HEAD'], dir);
  if (head.error || head.status !== 0) return null;
  const status = runGit(['status', '--porcelain'], dir);
  const dirty = !status.error && status.status === 0 && (status.stdout || '').trim() !== '';
  return head.stdout.trim() + (dirty ? '+dirty' : '');
}

// ---------------------------------------------------------------- manifest

/**
 * Execute a verification manifest in `dir`. The manifest declares what to run
 * and what coverage that constitutes:
 *   { commands: [{ command, expect_exit?, timeout_ms? }, ...],
 *     coverage: 'complete' | 'partial',   // DECLARED, never derived
 *     versions: ['node --version', ...] }
 *
 * Outcome: FAIL on any wrong exit code; UNAVAILABLE on spawn error/timeout;
 * COVERAGE_GAP when everything ran green but the declared oracle is not
 * complete (the plan: COVERAGE_GAP forces model review); PASS otherwise.
 */
function runManifest(dir, manifest) {
  if (!manifest || !Array.isArray(manifest.commands) || manifest.commands.length === 0) {
    return result('manifest', 'UNAVAILABLE', { reason: 'no verification manifest declared — nothing ran, nothing is known' });
  }
  const versions = (manifest.versions || []).map((cmd) => {
    const r = runShell(cmd, dir, 30000);
    return { command: cmd, output: (r.stdout_tail || r.stderr_tail || '').trim(), exit_code: r.exit_code };
  });
  const commands = [];
  let failed = false;
  let unavailable = false;
  for (const spec of manifest.commands) {
    const expect = spec.expect_exit === undefined ? 0 : spec.expect_exit;
    const r = runShell(spec.command, dir, spec.timeout_ms);
    r.expected_exit = expect;
    commands.push(r);
    if (r.error || r.timed_out || r.exit_code === null) unavailable = true;
    else if (r.exit_code !== expect) failed = true;
  }
  const declaredComplete = manifest.coverage === 'complete';
  const outcome = failed ? 'FAIL' : unavailable ? 'UNAVAILABLE' : declaredComplete ? 'PASS' : 'COVERAGE_GAP';
  return result('manifest', outcome, {
    ran: commands.map((c) => c.command),
    commands,
    versions,
    tree_identity: treeIdentity(dir),
    coverage_declared: manifest.coverage || 'undeclared',
    note: 'reports what ran under the declared manifest — a green run on an incomplete manifest verifies nothing beyond itself',
  });
}

// The owner-manifest location and the pinning rule (ruling 1a, WO-8 Red Team
// CRITICAL): the manifest the Verifier executes must come from OUTSIDE the
// commit under audit. `.claude/orchestra.json` inside the head commit is
// editable by the executor in the very diff being checked, so the manifest is
// read from an owner ref — the base ref by default — via `git show` against
// the real repository, never from the head checkout. A manifest change takes
// effect only after it lands in a reviewed base.
const DEFAULT_MANIFEST_PATH = '.claude/orchestra.json';

function manifestFromRef(repoDir, ref, relPath) {
  const p = String(relPath || DEFAULT_MANIFEST_PATH).replace(/\\/g, '/');
  if (badRef(ref) || p.startsWith('-') || p.startsWith('/') || p.includes('..')) {
    return { error: 'manifest ref/path rejected (leading dash, absolute, or traversal)' };
  }
  const r = runGit(['show', String(ref) + ':' + p], repoDir);
  if (r.error || r.status !== 0) {
    return { error: 'no manifest at ' + ref + ':' + p + ' (' + (((r.stderr || '').trim().split('\n')[0]) || 'git error') + ')' };
  }
  let parsed;
  try {
    parsed = JSON.parse(String(r.stdout).replace(/^﻿/, ''));
  } catch (e) {
    return { error: 'manifest at ' + ref + ':' + p + ' unparseable: ' + e.message };
  }
  const manifest = parsed && parsed.verifier && parsed.verifier.manifest
    ? parsed.verifier.manifest
    : (parsed && Array.isArray(parsed.commands) ? parsed : null);
  if (!manifest) {
    return { error: 'no verifier manifest declared at ' + ref + ':' + p + ' (expected verifier.manifest, or a bare { commands, coverage } manifest)' };
  }
  return { manifest, path: p };
}

// -------------------------------------------------------------- nonce echo

// The report must echo the order's integrity nonce byte-for-byte. A missing
// echo fails closed; a missing nonce on the ORDER means the check cannot be
// established at all.
function nonceEcho(order, report) {
  const nonce = order && order.integrity_nonce;
  if (!nonce || String(nonce).length < 8) {
    return result('nonce-echo', 'UNAVAILABLE', { reason: 'order carries no usable integrity_nonce' });
  }
  const echo = report && report.integrity && report.integrity.nonce_echo;
  if (echo === nonce) return result('nonce-echo', 'PASS', { nonce_length: String(nonce).length });
  return result('nonce-echo', 'FAIL', {
    reason: echo ? 'nonce echo diverges from the order nonce' : 'report carries no nonce echo (fails closed)',
  });
}

// ------------------------------------------------------- schema validation

const ARTIFACT_SCHEMAS = {
  order: 'order.schema.json',
  report: 'report.schema.json',
  verdict: 'verdict.schema.json',
  'authorization-packet': 'authorization-packet.schema.json',
  'casting-record': 'casting-record.schema.json',
  'verdict-audit': 'verdict-audit.schema.json',
};

let registryCache = null;
function loadedRegistry() {
  if (!registryCache) registryCache = registry.load();
  return registryCache;
}

// Validate an artifact against its WO-4 registry schema. If the REGISTRY
// itself is invalid, every validation is UNAVAILABLE — a broken source of
// truth must not silently pass artifacts.
function validateArtifact(kind, value) {
  const schemaName = ARTIFACT_SCHEMAS[kind];
  if (!schemaName) {
    return result('schema:' + kind, 'UNAVAILABLE', { reason: 'unknown artifact kind ' + JSON.stringify(kind) });
  }
  const { schemas, problems } = loadedRegistry();
  if (problems.length > 0) {
    return result('schema:' + kind, 'UNAVAILABLE', {
      reason: 'registry invalid — refusing to validate against a broken source of truth',
      registry_problems: problems,
    });
  }
  const violations = validate(schemas[schemaName], value);
  // The served-model mismatch detector is COMPUTED, never trusted from the
  // record (ruling 4, WO-8): recompute requested vs served whenever served
  // is known, and refuse a record that contradicts — or omits — a computable
  // mismatch. A cross-field lie here is a masked P15 routing incident.
  if (kind === 'casting-record' && value && typeof value === 'object' && !Array.isArray(value)) {
    const requested = value.requested_casting && value.requested_casting.model;
    const served = value.served_model;
    if (typeof requested === 'string' && typeof served === 'string' && served !== 'UNKNOWN') {
      const mismatch = !modelNamesMatch(requested, served);
      if (value.served_model_mismatch === undefined ? mismatch : value.served_model_mismatch !== mismatch) {
        violations.push('$.served_model_mismatch: ' + (value.served_model_mismatch === undefined
          ? 'omitted while requested≠served — a P15 routing incident must be flagged'
          : 'contradicts the computed detector (requested ' + requested + ', served ' + served + ' → mismatch ' + mismatch + ')'));
      }
    }
  }
  return violations.length === 0
    ? result('schema:' + kind, 'PASS', { schema: schemaName })
    : result('schema:' + kind, 'FAIL', { schema: schemaName, violations });
}

// ------------------------------------------------------------ diff parsing

// Unified-diff parser (git diff output). Returns
//   [{ path, oldPath, hunks: [{ oldStart, oldCount, newStart, newCount }] }]
// with `path` the new-side path ('/dev/null' → null for deletions).
function parseDiff(text) {
  const files = [];
  let current = null;
  const stripSide = (p) => {
    if (!p || p === '/dev/null') return null;
    let out = p.replace(/^[ab]\//, '');
    if (out.startsWith('"') && out.endsWith('"')) out = out.slice(1, -1);
    return out;
  };
  for (const line of String(text || '').split('\n')) {
    if (line.startsWith('diff --git ')) {
      current = { path: null, oldPath: null, hunks: [] };
      files.push(current);
    } else if (current && line.startsWith('--- ')) {
      current.oldPath = stripSide(line.slice(4).trim());
    } else if (current && line.startsWith('+++ ')) {
      current.path = stripSide(line.slice(4).trim());
    } else if (current && line.startsWith('@@ ')) {
      const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (m) {
        current.hunks.push({
          oldStart: parseInt(m[1], 10),
          oldCount: m[2] === undefined ? 1 : parseInt(m[2], 10),
          newStart: parseInt(m[3], 10),
          newCount: m[4] === undefined ? 1 : parseInt(m[4], 10),
        });
      }
    }
  }
  return files;
}

// Parse "path:12" / "path:12-20" / bare "path" claims.
function parseChangeClaim(claim) {
  const m = /^(.*?):(\d+)(?:-(\d+))?$/.exec(String(claim));
  if (m && m[1]) {
    return { path: m[1], from: parseInt(m[2], 10), to: m[3] ? parseInt(m[3], 10) : parseInt(m[2], 10) };
  }
  return { path: String(claim), from: null, to: null };
}

/**
 * Replay a report's change claims against the ACTUAL base..head diff. This is
 * the "changes claimed against an untouched tree" catch: an empty diff with
 * standing claims, a claim naming an unchanged file, or a claim naming lines
 * no hunk touched all DIVERGE.
 */
function claimedChanges(dir, baseRef, headRef, claims) {
  if (!Array.isArray(claims) || claims.length === 0) {
    return result('claimed-changes', 'UNAVAILABLE', { reason: 'no change claims to replay' });
  }
  if (badRef(baseRef) || badRef(headRef || 'HEAD')) {
    return result('claimed-changes', 'UNAVAILABLE', { reason: 'ref rejected (leading dash or non-string) — refs are never passed where git could read them as options' });
  }
  const diff = runGit(['diff', '--unified=0', String(baseRef), String(headRef || 'HEAD'), '--'], dir);
  if (diff.error || diff.status !== 0) {
    return result('claimed-changes', 'UNAVAILABLE', { reason: 'git diff failed: ' + ((diff.stderr || '').trim() || 'git error') });
  }
  const files = parseDiff(diff.stdout);
  const byPath = new Map();
  for (const f of files) {
    if (f.path) byPath.set(f.path.replace(/\\/g, '/'), f);
    if (f.oldPath) byPath.set(f.oldPath.replace(/\\/g, '/'), f); // deletions claimable by old path
  }
  const items = claims.map((claim) => {
    const { path: p, from, to } = parseChangeClaim(claim);
    const file = byPath.get(p.replace(/\\/g, '/'));
    if (!file) return { claim: String(claim), result: 'DIVERGES', reason: 'path not in the base..head diff' };
    if (from === null) return { claim: String(claim), result: 'MATCHES' };
    const hit = file.hunks.some((h) => {
      if (h.newCount === 0) return from === h.newStart || to === h.newStart; // pure deletion sits between lines
      const lo = h.newStart;
      const hi = h.newStart + h.newCount - 1;
      return from <= hi && to >= lo;
    });
    return hit
      ? { claim: String(claim), result: 'MATCHES' }
      : { claim: String(claim), result: 'DIVERGES', reason: 'no hunk touches the claimed lines' };
  });
  const diverged = items.filter((i) => i.result === 'DIVERGES');
  return result('claimed-changes', diverged.length > 0 ? 'FAIL' : 'PASS', {
    base: String(baseRef),
    head: String(headRef || 'HEAD'),
    diff_files: files.filter((f) => f.path || f.oldPath).length,
    items,
    reason: diverged.length > 0 && files.length === 0 ? 'changes claimed against an untouched tree' : undefined,
  });
}

// ---------------------------------------------------------- mutation check

/**
 * The green-by-construction detector: apply each mutation (typically an
 * inverted assertion) in a disposable checkout and re-run the manifest. A
 * suite that STAYS GREEN under the inversion cannot fail, and a test that
 * cannot fail proves nothing — that mutation SURVIVED, and the check FAILs.
 *
 * Requires a green baseline: on a red baseline every mutation "catches"
 * vacuously, so the check reports UNAVAILABLE instead of false confidence.
 *
 * mutations: [{ path, find, replace, description? }]
 */
function mutationCheck(repoDir, commitish, manifest, mutations, opts) {
  if (!Array.isArray(mutations) || mutations.length === 0) {
    return result('mutation', 'UNAVAILABLE', { reason: 'no mutations declared' });
  }
  const checkout = createCheckout(repoDir, commitish, opts);
  if (checkout.error) return result('mutation', 'UNAVAILABLE', { reason: checkout.error });
  try {
    const baseline = runManifest(checkout.dir, manifest);
    if (baseline.outcome === 'FAIL' || baseline.outcome === 'UNAVAILABLE') {
      return result('mutation', 'UNAVAILABLE', {
        reason: 'baseline is not green — a mutation on a red suite proves nothing',
        baseline_outcome: baseline.outcome,
      });
    }
    const items = [];
    for (const mut of mutations) {
      const target = confine(checkout.dir, mut.path);
      if (!target) {
        // A mutation path that escapes the checkout is not a survivable
        // test — it is an attempted write outside the sandbox. FAIL, never
        // a silent write to the real tree.
        items.push({ mutation: mut, result: 'ESCAPE', reason: 'mutation path escapes the disposable checkout — refused' });
        continue;
      }
      let content;
      try {
        content = fs.readFileSync(target, 'utf8');
      } catch (e) {
        items.push({ mutation: mut, result: 'UNAVAILABLE', reason: 'target unreadable: ' + e.message });
        continue;
      }
      if (!content.includes(mut.find)) {
        items.push({ mutation: mut, result: 'UNAVAILABLE', reason: 'find-string absent from target' });
        continue;
      }
      fs.writeFileSync(target, content.replace(mut.find, mut.replace), 'utf8');
      const mutated = runManifest(checkout.dir, manifest);
      // Restore from the commit so mutations never compound. A restore that
      // does not clean the tree is itself a failure — a dirty checkout means
      // the next mutation runs against corrupted state.
      const restore = runGit(['checkout', '--', mut.path], checkout.dir);
      const restored = !restore.error && restore.status === 0;
      if (!restored) {
        items.push({ mutation: mut, result: 'UNAVAILABLE', reason: 'restore failed — checkout left dirty, results after this point are void' });
        break;
      }
      if (mutated.outcome === 'FAIL') {
        items.push({ mutation: mut, result: 'CAUGHT' });
      } else if (mutated.outcome === 'UNAVAILABLE') {
        items.push({ mutation: mut, result: 'UNAVAILABLE', reason: 'manifest could not run under the mutation' });
      } else {
        items.push({ mutation: mut, result: 'SURVIVED', reason: 'suite stayed green under the inversion — the test cannot fail' });
      }
    }
    const survived = items.filter((i) => i.result === 'SURVIVED');
    const escaped = items.filter((i) => i.result === 'ESCAPE');
    const unavailable = items.filter((i) => i.result === 'UNAVAILABLE');
    const outcome = (survived.length > 0 || escaped.length > 0) ? 'FAIL'
      : unavailable.length > 0 ? 'UNAVAILABLE' : 'PASS';
    return result('mutation', outcome, { commit: checkout.commit, items });
  } finally {
    checkout.teardown();
  }
}

// --------------------------------------------------- invariant comparison

/**
 * Run the same deterministic probe in a before-dir and an after-dir and
 * compare the extracted values.
 *
 * spec: { name, command, extract?, compare? }
 *   extract — regex string whose first capture group is the value
 *             (default: first number in stdout)
 *   compare — 'equal' (default) | 'lte' | 'gte'  (after vs before)
 * Single-sided form: { name, command, expected } runs only in afterDir.
 */
function invariantComparison(spec, beforeDir, afterDir) {
  const name = 'invariant:' + (spec.name || spec.command);
  const extract = (dir) => {
    const r = runShell(spec.command, dir, spec.timeout_ms);
    if (r.error || r.timed_out || r.exit_code !== 0) {
      return { error: 'probe failed (exit ' + r.exit_code + (r.error ? ', ' + r.error : '') + ')' };
    }
    const re = spec.extract ? new RegExp(spec.extract) : /(-?\d+(?:\.\d+)?)/;
    const m = re.exec(r.stdout_tail || '');
    if (!m || m[1] === undefined) return { error: 'no value extracted from probe output' };
    const num = Number(m[1]);
    return { value: Number.isNaN(num) ? m[1] : num };
  };

  const after = extract(afterDir);
  if (after.error) return result(name, 'UNAVAILABLE', { reason: 'after-side: ' + after.error });

  if (spec.expected !== undefined) {
    const ok = after.value === spec.expected;
    return result(name, ok ? 'PASS' : 'FAIL', { expected: spec.expected, after: after.value });
  }

  const before = extract(beforeDir);
  if (before.error) return result(name, 'UNAVAILABLE', { reason: 'before-side: ' + before.error });
  const mode = spec.compare || 'equal';
  const ok =
    mode === 'equal' ? after.value === before.value :
    mode === 'lte' ? after.value <= before.value :
    mode === 'gte' ? after.value >= before.value :
    null;
  if (ok === null) return result(name, 'UNAVAILABLE', { reason: 'unknown compare mode ' + JSON.stringify(mode) });
  return result(name, ok ? 'PASS' : 'FAIL', { before: before.value, after: after.value, compare: mode });
}

// --------------------------------------------------------- citation replay

/**
 * Replay citations mechanically. Two forms:
 *   { citation: 'path:line', expect_substring? } — the cited line must exist
 *     (and contain the substring when given)
 *   { command, expect_substring? , expect_count? } — re-run the command;
 *     expect_count compares the count of non-empty stdout lines
 * Results use the verdict-audit vocabulary: MATCHES / DIVERGES /
 * UNREPLAYABLE. Any DIVERGES fails; UNREPLAYABLE without a divergence is a
 * COVERAGE_GAP — an unreplayed citation forces model review, never a pass.
 */
function citationReplay(dir, citations) {
  if (!Array.isArray(citations) || citations.length === 0) {
    return result('citation-replay', 'UNAVAILABLE', { reason: 'no citations to replay' });
  }
  const items = citations.map((c) => {
    if (c.command) {
      const label = c.citation || c.command;
      const r = runShell(c.command, dir, c.timeout_ms);
      if (r.error || r.timed_out) return { citation: label, replayed: false, result: 'UNREPLAYABLE' };
      if (commandNotFound(r)) return { citation: label, replayed: false, result: 'UNREPLAYABLE' }; // not found on the replaying host
      if (c.expect_count !== undefined) {
        const count = (r.stdout_tail || '').split('\n').filter((l) => l.trim()).length;
        return { citation: label, replayed: true, result: count === c.expect_count ? 'MATCHES' : 'DIVERGES' };
      }
      if (c.expect_substring !== undefined) {
        const hit = (r.stdout_tail || '').includes(c.expect_substring) || (r.stderr_tail || '').includes(c.expect_substring);
        return { citation: label, replayed: true, result: hit ? 'MATCHES' : 'DIVERGES' };
      }
      return { citation: label, replayed: true, result: r.exit_code === 0 ? 'MATCHES' : 'DIVERGES' };
    }
    const parsed = /^(.*?):(\d+)$/.exec(String(c.citation || ''));
    if (!parsed) return { citation: String(c.citation || ''), replayed: false, result: 'UNREPLAYABLE' };
    const citedPath = confine(dir, parsed[1]);
    if (!citedPath) {
      // A citation resolving outside the checkout is not a comparison — it
      // would be an arbitrary-file oracle over the host. Refuse to replay.
      return { citation: c.citation, replayed: false, result: 'UNREPLAYABLE', reason: 'citation path escapes the checkout' };
    }
    let lines;
    try {
      lines = fs.readFileSync(citedPath, 'utf8').split(/\r?\n/);
    } catch (_) {
      return { citation: c.citation, replayed: true, result: 'DIVERGES' }; // cited file does not exist — the claim is refuted
    }
    const line = lines[parseInt(parsed[2], 10) - 1];
    if (line === undefined) return { citation: c.citation, replayed: true, result: 'DIVERGES' };
    if (c.expect_substring !== undefined && !line.includes(c.expect_substring)) {
      return { citation: c.citation, replayed: true, result: 'DIVERGES' };
    }
    return { citation: c.citation, replayed: true, result: 'MATCHES' };
  });
  const diverged = items.some((i) => i.result === 'DIVERGES');
  const unreplayable = items.some((i) => i.result === 'UNREPLAYABLE');
  return result('citation-replay', diverged ? 'FAIL' : unreplayable ? 'COVERAGE_GAP' : 'PASS', { items });
}

// -------------------------------------------------------------- aggregate

// FAIL dominates (a refuted claim is a fact); then UNAVAILABLE (something
// mandatory could not be established); then COVERAGE_GAP (everything ran,
// the oracle is incomplete — model review is forced); only then PASS.
function aggregate(checks) {
  const outcomes = checks.map((c) => c.outcome);
  if (outcomes.includes('FAIL')) return 'FAIL';
  if (outcomes.includes('UNAVAILABLE')) return 'UNAVAILABLE';
  if (outcomes.includes('COVERAGE_GAP')) return 'COVERAGE_GAP';
  return 'PASS';
}

/**
 * The full verification round WO-6's dispatcher will call: schema-validate
 * the artifacts, replay the nonce, stand up the disposable checkout, run the
 * manifest, replay change claims and citations, compare invariants, audit
 * both trees, tear everything down, aggregate.
 *
 * opts: { repoDir, commit, baseRef?, order?, report?, manifest?,
 *         manifestRef?, manifestPath?, mutations?, invariants?, citations?,
 *         generatedPatterns? }
 *
 * Manifest provenance (ruling 1a): pass `manifest` only from a
 * dispatcher-trusted source — NEVER read from the commit under audit. Omit
 * it and the manifest is read pinned from `manifestRef` (default: baseRef)
 * at `manifestPath` (default: .claude/orchestra.json) via git show against
 * the real repo, so the audited commit cannot edit its own oracle.
 */
function runVerification(opts) {
  const started = Date.now();
  const checks = [];
  const guard = guardTree(opts.repoDir, opts.generatedPatterns);

  let manifest = opts.manifest;
  let manifestProvenance = null;
  if (manifest !== undefined && manifest !== null) {
    manifestProvenance = { pinned: false, source: 'caller-supplied', note: 'the dispatcher is the trust boundary — a manifest read from the commit under audit must never be passed here' };
  } else if (opts.manifestRef !== undefined || opts.baseRef !== undefined) {
    const ref = opts.manifestRef !== undefined ? opts.manifestRef : opts.baseRef;
    const pinned = manifestFromRef(opts.repoDir, ref, opts.manifestPath);
    if (pinned.error) {
      manifest = null;
      manifestProvenance = { pinned: true, ref: String(ref), error: pinned.error };
    } else {
      manifest = pinned.manifest;
      manifestProvenance = { pinned: true, ref: String(ref), path: pinned.path };
    }
  }

  if (opts.order !== undefined) checks.push(validateArtifact('order', opts.order));
  if (opts.report !== undefined) checks.push(validateArtifact('report', opts.report));
  if (opts.order !== undefined && opts.report !== undefined) checks.push(nonceEcho(opts.order, opts.report));

  const checkout = createCheckout(opts.repoDir, opts.commit, opts);
  let baseCheckout = null;
  if (checkout.error) {
    checks.push(result('checkout', 'UNAVAILABLE', { reason: checkout.error }));
  } else {
    try {
      const manifestResult = runManifest(checkout.dir, manifest);
      if (manifestProvenance) manifestResult.manifest_provenance = manifestProvenance;
      checks.push(manifestResult);

      // The red-reported-green catch, made legible: a report that claims the
      // work is done while the declared verification is red is a refuted
      // claim in its own right, not just a failing manifest.
      const report = opts.report;
      if (report && (manifestResult.outcome === 'FAIL' || manifestResult.outcome === 'UNAVAILABLE') &&
          (report.status === 'DONE' || report.status === 'WAITING_FOR_REVIEW')) {
        // Red OR un-runnable both refute a DONE claim: a suite that could
        // not run (timeout, output overflow, spawn error) is not evidence
        // of green, so a report calling it done is contradicted either way.
        checks.push(result('report-contradiction', 'FAIL', {
          reason: 'report status ' + report.status + ' but the declared verification manifest is ' +
            (manifestResult.outcome === 'FAIL' ? 'red' : 'un-runnable (' + manifestResult.outcome + ') — absence of a green run is not a green run'),
        }));
      }

      if (report && Array.isArray(report.changes) && report.changes.length > 0 && opts.baseRef) {
        checks.push(claimedChanges(checkout.dir, opts.baseRef, checkout.commit, report.changes));
      }

      if (Array.isArray(opts.invariants) && opts.invariants.length > 0) {
        if (!opts.baseRef) {
          checks.push(result('invariants', 'UNAVAILABLE', { reason: 'invariant comparison needs baseRef for the before side' }));
        } else {
          baseCheckout = createCheckout(opts.repoDir, opts.baseRef, opts);
          if (baseCheckout.error) {
            checks.push(result('invariants', 'UNAVAILABLE', { reason: baseCheckout.error }));
            baseCheckout = null;
          } else {
            for (const spec of opts.invariants) {
              checks.push(invariantComparison(spec, baseCheckout.dir, checkout.dir));
            }
          }
        }
      }

      if (Array.isArray(opts.citations) && opts.citations.length > 0) {
        checks.push(citationReplay(checkout.dir, opts.citations));
      }

      // The mutation check is part of the integrated round (WO-8 gate MAJOR
      // #1): green-by-construction detection must not be a separate call the
      // CLI never makes. It stands up its own disposable checkout and runs
      // the SAME pinned manifest.
      if (Array.isArray(opts.mutations) && opts.mutations.length > 0) {
        checks.push(mutationCheck(opts.repoDir, opts.commit, manifest, opts.mutations, opts));
      }

      // Bound (3): the checkout's own before/after audit. Expected churn is a
      // NOTE; a suspect path means something edited source mid-verification.
      const delta = checkout.delta(opts.generatedPatterns);
      if (!delta) {
        checks.push(result('checkout-tree-audit', 'UNAVAILABLE', { reason: 'checkout fingerprint unavailable' }));
      } else {
        checks.push(result('checkout-tree-audit', delta.suspect.length > 0 ? 'FAIL' : 'PASS', {
          suspect: delta.suspect,
          expected_churn: delta.expected,
          note: delta.suspect.length > 0
            ? 'INTEGRITY WARNING: non-generated paths changed during verification'
            : delta.expected.length > 0
              ? 'INTEGRITY NOTE: only declared-generated paths churned'
              : 'checkout untouched',
        }));
      }
    } finally {
      checkout.teardown();
      if (baseCheckout) baseCheckout.teardown();
    }
  }

  // Bound (4): the dispatcher-side audit of the REAL tree across this run.
  const guardDelta = guard.check();
  if (guardDelta === null) {
    checks.push(result('dispatcher-tree-audit', 'UNAVAILABLE', { reason: 'real-tree fingerprint unavailable' }));
  } else {
    checks.push(result('dispatcher-tree-audit', guardDelta.suspect.length > 0 ? 'FAIL' : 'PASS', {
      suspect: guardDelta.suspect,
      expected_churn: guardDelta.expected,
      note: guardDelta.suspect.length > 0
        ? 'INTEGRITY WARNING: the real tree moved during the Verifier run (write-scope escape or concurrent writer)'
        : 'real tree held still across the run',
    }));
  }

  const outcome = aggregate(checks);
  const anyAssist = checks.some((c) => c.model_assist && c.model_assist.used);
  return result('verification', outcome, {
    commit: checkout.error ? null : checkout.commit,
    duration_ms: Date.now() - started,
    checks,
    // The deterministic-only closure gate (catalog entry 23): complete-oracle
    // proof AND an outcome untouched by model assistance. Anything else takes
    // the COVERAGE_GAP path to model review.
    deterministic_only_closure:
      outcome === 'PASS' && !anyAssist &&
      checks.some((c) => c.check === 'manifest' && c.coverage_declared === 'complete'),
  });
}

module.exports = {
  result,
  runManifest,
  manifestFromRef,
  nonceEcho,
  validateArtifact,
  parseDiff,
  parseChangeClaim,
  claimedChanges,
  mutationCheck,
  invariantComparison,
  citationReplay,
  aggregate,
  runVerification,
  confine,
  redact,
  minimalEnv,
  modelNamesMatch,
};

// --------------------------------------------------------------------- CLI

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[i + 1];
  }
  // Strip a UTF-8 BOM: PowerShell's Out-File writes one by default, so JSON
  // artifacts produced on Windows routinely carry it.
  const readJson = (p) => (p ? JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')) : undefined);
  if (!opt.repo || !opt.commit || (!opt.manifest && !opt['manifest-ref'] && !opt.base)) {
    console.error('usage: node verifier/verifier.js --repo <dir> --commit <ref>');
    console.error('       (--manifest <m.json> | --manifest-ref <ref> | --base <ref>)');
    console.error('       [--base <ref>] [--manifest-path <repo-rel path>]');
    console.error('       [--order <o.json>] [--report <r.json>] [--mutations <mu.json>]');
    console.error('       [--invariants <i.json>] [--citations <c.json>]');
    console.error('');
    console.error('Without --manifest, the manifest is read PINNED from --manifest-ref');
    console.error('(default: --base) at --manifest-path (default: .claude/orchestra.json)');
    console.error('via git show — never from the commit under audit (ruling 1a).');
    process.exit(2);
  }
  const out = runVerification({
    repoDir: path.resolve(opt.repo),
    commit: opt.commit,
    baseRef: opt.base,
    manifest: readJson(opt.manifest),
    manifestRef: opt['manifest-ref'],
    manifestPath: opt['manifest-path'],
    order: readJson(opt.order),
    report: readJson(opt.report),
    mutations: readJson(opt.mutations),
    invariants: readJson(opt.invariants),
    citations: readJson(opt.citations),
  });
  console.log(JSON.stringify(out, null, 2));
  console.log('\nMECHANICAL EVIDENCE ONLY — a Verifier PASS is not an approval.');
  process.exit(out.outcome === 'PASS' ? 0 : out.outcome === 'FAIL' ? 1 : out.outcome === 'UNAVAILABLE' ? 2 : 3);
}
