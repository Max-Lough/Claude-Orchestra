#!/usr/bin/env node
/**
 * WO-12 SDC key assembler — protocol §2 (`../wo12-protocol.md`), schema
 * `corpus/key.schema.md`.
 *
 *   node assemble-key.js [--check-only] [--clone-root <dir>]
 *       [--pool <path>] [--corpus-dir <dir>] [--briefs-dir <dir>]
 *       [--key <path>] [--notes <path>] [--construction-md <path>]
 *       [--source-repo <dir>] [--build-corpus <path>]
 *
 * Reads `corpus/base-pool.json` (the 84-slot draw) and, for every slot,
 * the per-artifact inputs a seeder/README author has to supply:
 *   - `seeded` slots: `corpus/<id>.seed.json`, `corpus/<id>.patch`, and both
 *     `corpus/briefs/<id>.{wo,er}.txt`.
 *   - `control` slots: both `corpus/briefs/<id>.{wo,er}.txt` only.
 *
 * `--check-only` lists everything missing and exits 1 if anything is; it
 * touches nothing else. Without it, ANY missing input is a hard failure —
 * the key is all-or-nothing, never partially sealed (protocol §2.3 "the
 * complete key is `corpus/key.json`, committed before any review pass").
 *
 * When everything is present, this script:
 *   1. builds `corpus/key.json` (schema-exact: controls get `seed: null`;
 *      seeded artifacts get the seed.json's own `seed` object — severity AS
 *      ACHIEVED, not the target the pool records — plus id/kind/phase/
 *      variant/base/commit/subject from base-pool.json; a seed.json whose
 *      id/base/commit/type/phase/variant disagrees with its slot is a hard
 *      failure naming both records) and, alongside it, `construction-notes.json`
 *      (the `suite_at_variant` / `design_note` narrative fields that do NOT
 *      belong in the sealed key);
 *   2. materializes every seeded variant via `build-corpus.js --id <id>`
 *      (one shared clone, so this never re-clones per artifact) and
 *      normalizes the two seeded briefs in place: the placeholder tokens
 *      `<<HEAD>>` / `<COMMIT>`, and any OTHER 40-hex sha that isn't the
 *      slot's own `base` (or, on a re-run, the already-written `head`
 *      itself — normalization is idempotent), are rewritten to the real
 *      materialized head — then asserted (head present in the file; base
 *      present too, required on `.wo.txt` where VARIANTS.md's work-order
 *      template states it, not required on `.er.txt`, whose templates never
 *      name the parent; no foreign 40-hex sha left in either file) —
 *      because a seeder writes a brief before the variant commit exists and
 *      can only guess (or placeholder) the sha a reviewer will actually see;
 *   3. runs a leakage lint over EVERY brief (seeded and control) for the
 *      terms a review packet must never carry (`seed`, `wo-12`, `wo12`,
 *      `defect`, `injected`, `variant v`, `hazard_terms`, `locator`) and a
 *      12h template-conformance check per VARIANTS.md (V1: the V1 author
 *      phrase, no vendor/model name; V2: the exact V2 author phrase; V3: the
 *      V1 author phrase plus a HAZARD CHECKLIST block) — either is a hard
 *      failure naming the file. Two coordinator-ruled SCOPING exemptions —
 *      both because this corpus's real content is drawn from an AI-tooling
 *      repo's own history and will legitimately discuss the very terms the
 *      lints exist to catch, in text no seeder authored:
 *        (a) the vendor/model-name check (V1/V3) applies ONLY to the AUTHOR
 *            SENTENCE — the whitespace-normalized sentence containing
 *            "produced this change" (from the preceding sentence boundary,
 *            a `.`/`;`, or line/text start, to the next `.`/`;`) — never to
 *            the rest of the report, where the diff's own real subject
 *            matter (e.g. "...no longer weaker than the Codex path...")
 *            may legitimately name a vendor/tool;
 *        (b) the leakage lint exempts (i) any line beginning with
 *            `Commit subject:` and (ii) any line that is itself a verbatim
 *            substring of THIS artifact's `key.json` `subject` — both are
 *            the real commit's own subject, mechanically transcribed, never
 *            seeder-authored prose; every other line is still fully
 *            checked, so `seed`/`defect`/etc. anywhere else in the same
 *            brief is still caught;
 *   4. tallies the corpus against protocol §2.2/§2.3/§2.6/§2.7 targets and
 *      prints a table; a MISSED target is a WARNING (recorded in
 *      construction-notes.json's `targetWarnings`), never a failure — the
 *      key is sealed as constructed, and deviations are the protocol's to
 *      report, not this script's to enforce;
 *   5. writes `corpus/CONSTRUCTION.md` — the tallies, the seeded-id list
 *      (type/severity/locator.file), the materialized-heads table, any
 *      seeder severity deviation from the pool's `target_severity` (quoting
 *      `rationale`), and the brief-normalization log.
 *
 * Idempotent / re-runnable: normalization only rewrites a token or a
 * non-base 40-hex sha, so a second run over already-normalized briefs is a
 * no-op (the assertions still re-run and still pass), and build-corpus.js's
 * own reproducibility (same base + patch + fixed seeder identity -> same
 * head sha, every time, protocol §2.1) means the materialized heads — and
 * therefore key.json/CONSTRUCTION.md — come out byte-identical across runs.
 *
 * House rules: zero dependencies, CommonJS, same voice as build-corpus.js /
 * run-lane.js / score.js. Nothing outside
 * plans/cross-compare/agent-role-architecture/wo12/ is touched.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HERE = __dirname;
const TYPES = ['CV', 'OO', 'LC', 'FT', 'HF', 'RC'];
const VARIANTS = ['V1', 'V2', 'V3'];
const LEAKAGE_TERMS = ['seed', 'wo-12', 'wo12', 'defect', 'injected', 'variant v', 'hazard_terms', 'locator'];
// Case-sensitive, whole-word only (a coordinator ruling after `sol`/`terra`/
// `luna` — ordinary English words — proved too broad as lowercase
// substrings; these seven are unambiguous vendor/model/org names).
const VENDOR_TERMS = ['Claude', 'Sonnet', 'Opus', 'Anthropic', 'GPT', 'OpenAI', 'Codex'];

// Matched as a whitespace-normalized SUBSTRING, not the full templated
// sentence — VARIANTS.md's author line is a prefix an honest brief may
// legitimately continue past (real report content between "this change"
// and the closing "no fresh executor claims..." clause, as construction
// briefs do in practice), and a seeder may re-wrap the sentence across
// different line breaks than the template's own. Matching the fixed prefix
// phrase (case-sensitive otherwise) is robust to both.
const V1_AUTHOR_PHRASE = normalizeWs('An executor produced this change');
const V2_AUTHOR_PHRASE = normalizeWs('Claude Sonnet 5 · medium (Anthropic) produced this change');
const HAZARD_PHRASE = 'HAZARD CHECKLIST';

// Whole-word, case-sensitive vendor/model-name detection (coordinator
// ruling — see VENDOR_TERMS above). Returns the first term found, or null.
function findVendorTerm(content) {
  const norm = normalizeWs(content);
  for (const term of VENDOR_TERMS) {
    if (new RegExp('\\b' + term + '\\b').test(norm)) return term;
  }
  return null;
}

function fail(msg) {
  const e = new Error(msg);
  e.wo12AssembleKey = true;
  throw e;
}

function normalizeWs(s) {
  return s.replace(/\s+/g, ' ').trim();
}

// --------------------------------------------------------------- CLI / IO

function usage() {
  return [
    'usage:',
    '  node assemble-key.js [--check-only] [--clone-root <dir>]',
    '      [--pool <path>] [--corpus-dir <dir>] [--briefs-dir <dir>]',
    '      [--key <path>] [--notes <path>] [--construction-md <path>]',
    '      [--source-repo <dir>] [--build-corpus <path>]',
    '',
    'Defaults: --pool <wo12>/corpus/base-pool.json, --corpus-dir/--briefs-dir',
    'derived from --pool\'s own directory, --key/--notes/--construction-md next',
    'to --pool, --build-corpus <wo12>/build-corpus.js, --source-repo auto-',
    'detected by build-corpus.js itself, --clone-root a fresh temp dir shared',
    'across every --id call this run makes.',
  ].join('\n');
}

function parseArgs(argv) {
  const out = {
    checkOnly: false, cloneRoot: null, pool: null, corpusDir: null, briefsDir: null,
    key: null, notes: null, constructionMd: null, sourceRepo: null, buildCorpus: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check-only') out.checkOnly = true;
    else if (a === '--clone-root') out.cloneRoot = argv[++i];
    else if (a === '--pool') out.pool = argv[++i];
    else if (a === '--corpus-dir') out.corpusDir = argv[++i];
    else if (a === '--briefs-dir') out.briefsDir = argv[++i];
    else if (a === '--key') out.key = argv[++i];
    else if (a === '--notes') out.notes = argv[++i];
    else if (a === '--construction-md') out.constructionMd = argv[++i];
    else if (a === '--source-repo') out.sourceRepo = argv[++i];
    else if (a === '--build-corpus') out.buildCorpus = argv[++i];
    else if (a === '--help' || a === '-h') { process.stdout.write(usage() + '\n'); process.exit(0); }
    else fail('unknown argument: ' + a + '\n\n' + usage());
  }
  return out;
}

function resolvePaths(args) {
  const poolPath = args.pool ? path.resolve(args.pool) : path.join(HERE, 'corpus', 'base-pool.json');
  const corpusDir = args.corpusDir ? path.resolve(args.corpusDir) : path.dirname(poolPath);
  const briefsDir = args.briefsDir ? path.resolve(args.briefsDir) : path.join(corpusDir, 'briefs');
  const keyPath = args.key ? path.resolve(args.key) : path.join(corpusDir, 'key.json');
  const notesPath = args.notes ? path.resolve(args.notes) : path.join(corpusDir, 'construction-notes.json');
  const constructionMdPath = args.constructionMd ? path.resolve(args.constructionMd) : path.join(corpusDir, 'CONSTRUCTION.md');
  const buildCorpusPath = args.buildCorpus ? path.resolve(args.buildCorpus) : path.join(HERE, 'build-corpus.js');
  return { poolPath, corpusDir, briefsDir, keyPath, notesPath, constructionMdPath, buildCorpusPath };
}

function loadJson(p, what) {
  if (!fs.existsSync(p)) fail(what + ' not found: ' + p);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    fail(what + ' at ' + p + ' is not valid JSON: ' + e.message);
  }
}

// ------------------------------------------------------- 1. requirements

function briefPaths(briefsDir, id) {
  return { wo: path.join(briefsDir, id + '.wo.txt'), er: path.join(briefsDir, id + '.er.txt') };
}

function checkRequirements(pool, paths) {
  const missing = [];
  for (const slot of pool.slots) {
    const { wo, er } = briefPaths(paths.briefsDir, slot.id);
    if (!fs.existsSync(wo)) missing.push(slot.id + ': missing briefs/' + slot.id + '.wo.txt');
    if (!fs.existsSync(er)) missing.push(slot.id + ': missing briefs/' + slot.id + '.er.txt');
    if (slot.kind === 'seeded') {
      const seedPath = path.join(paths.corpusDir, slot.id + '.seed.json');
      const patchPath = path.join(paths.corpusDir, slot.id + '.patch');
      if (!fs.existsSync(seedPath)) missing.push(slot.id + ': missing corpus/' + slot.id + '.seed.json');
      if (!fs.existsSync(patchPath)) missing.push(slot.id + ': missing corpus/' + slot.id + '.patch');
    } else if (slot.kind !== 'control') {
      fail(slot.id + ': base-pool.json slot has unknown kind ' + JSON.stringify(slot.kind) + ' (expected "seeded" or "control")');
    }
  }
  return missing;
}

// ------------------------------------------------------ 2. key + notes

function buildKeyAndNotes(pool, paths) {
  const artifacts = [];
  const notes = { seeds: {}, targetWarnings: [] };
  for (const slot of pool.slots) {
    if (slot.kind === 'control') {
      artifacts.push({
        id: slot.id, kind: 'control', phase: slot.phase, variant: slot.variant,
        base: slot.base, commit: slot.commit, subject: slot.subject, seed: null,
      });
      continue;
    }

    const seedJsonPath = path.join(paths.corpusDir, slot.id + '.seed.json');
    const seedJson = loadJson(seedJsonPath, slot.id + ' seed.json');

    const mismatches = [];
    if (seedJson.id !== slot.id) mismatches.push('id (seed.json=' + JSON.stringify(seedJson.id) + ' vs base-pool slot=' + JSON.stringify(slot.id) + ')');
    if (seedJson.base !== slot.base) mismatches.push('base (seed.json=' + seedJson.base + ' vs base-pool slot=' + slot.base + ')');
    if (seedJson.commit !== slot.commit) mismatches.push('commit (seed.json=' + seedJson.commit + ' vs base-pool slot=' + slot.commit + ')');
    if (!seedJson.seed || seedJson.seed.type !== (slot.seed_slot && slot.seed_slot.type)) {
      mismatches.push('type (seed.json seed.type=' + JSON.stringify(seedJson.seed && seedJson.seed.type) + ' vs base-pool slot.seed_slot.type=' + JSON.stringify(slot.seed_slot && slot.seed_slot.type) + ')');
    }
    if (seedJson.phase !== slot.phase) mismatches.push('phase (seed.json=' + seedJson.phase + ' vs base-pool slot=' + slot.phase + ')');
    if (seedJson.variant !== slot.variant) mismatches.push('variant (seed.json=' + seedJson.variant + ' vs base-pool slot=' + slot.variant + ')');
    if (mismatches.length) {
      fail(slot.id + ': ' + seedJsonPath + ' disagrees with base-pool.json\'s slot for this id — ' + mismatches.join('; '));
    }
    if (!seedJson.seed || !seedJson.seed.severity || !seedJson.seed.locator || !seedJson.seed.consequence || !seedJson.seed.rationale || !seedJson.seed.hazard_terms) {
      fail(slot.id + ': ' + seedJsonPath + '\'s `seed` object is missing one of type/severity/locator/consequence/rationale/hazard_terms');
    }

    artifacts.push({
      id: slot.id, kind: 'seeded', phase: slot.phase, variant: slot.variant,
      base: slot.base, commit: slot.commit, subject: slot.subject,
      seed: {
        type: seedJson.seed.type,
        severity: seedJson.seed.severity,
        locator: seedJson.seed.locator,
        consequence: seedJson.seed.consequence,
        rationale: seedJson.seed.rationale,
        hazard_terms: seedJson.seed.hazard_terms,
      },
    });
    notes.seeds[slot.id] = {
      target_severity: slot.seed_slot && slot.seed_slot.target_severity,
      achieved_severity: seedJson.seed.severity,
      suite_at_variant: seedJson.suite_at_variant || null,
      design_note: seedJson.design_note || null,
    };
  }
  return { key: { version: 1, artifacts }, notes };
}

// ---------------------------------------------------- 3a. brief normalize

const HEX40_RE = /(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])/gi;
// One combined pass (token alternatives OR a bare 40-hex sha) so a sha we
// just inserted for a token is never re-scanned and "replaced" again by a
// second pass over the already-rewritten text.
const COMBINED_RE = /<<HEAD>>|<COMMIT>|(?<![0-9a-f])[0-9a-f]{40}(?![0-9a-f])/gi;

// Rewrites `<<HEAD>>` / `<COMMIT>` and any 40-hex sha that is NOT `base`
// to `head`, in place, byte-for-byte otherwise (no other text is touched,
// so any existing LF/CRLF in the file is preserved as-is). Returns a log
// entry describing what was rewritten (empty `replaced` if the file was
// already normalized — the idempotent no-op case).
//
// `requireBase` (default true) gates the "the file itself must name base"
// assertion: VARIANTS.md's work-order template states the parent/base sha
// ("Base (its parent): <PARENT>"), but its executor-report templates never
// do (V1/V2/V3 all name only the head commit) — so the `.er.txt` half of a
// seeded pair is normalized with `requireBase: false`, while `.wo.txt` (and
// the artifact pair as a whole, since base appears there) keeps the default.
function normalizeBrief(filePath, base, head, opts) {
  const requireBase = !opts || opts.requireBase !== false;
  const original = fs.readFileSync(filePath, 'utf8');
  const replaced = [];
  const out = original.replace(COMBINED_RE, (m) => {
    if (m === '<<HEAD>>' || m === '<COMMIT>') { replaced.push(m); return head; }
    // a bare 40-hex sha: base is left alone, and a sha ALREADY equal to head
    // (an earlier run's own rewrite) is left alone too — otherwise a second
    // pass over an already-normalized file would "replace" head with itself
    // forever, defeating idempotency's own no-op check.
    if (m.toLowerCase() === base.toLowerCase() || m.toLowerCase() === head.toLowerCase()) return m;
    replaced.push(m);
    return head;
  });
  if (out !== original) fs.writeFileSync(filePath, out, 'utf8');

  if (!out.includes(head)) fail(filePath + ': normalized brief does not contain the materialized head ' + head + ' anywhere');
  if (requireBase && !out.includes(base)) fail(filePath + ': normalized brief does not contain the base ' + base + ' anywhere');
  const leftover = (out.match(HEX40_RE) || []).filter((s) => s.toLowerCase() !== base.toLowerCase() && s.toLowerCase() !== head.toLowerCase());
  if (leftover.length) fail(filePath + ': still contains 40-hex sha(s) other than base/head after normalization: ' + leftover.join(', '));

  return { file: path.relative(HERE, filePath), replaced, changed: out !== original };
}

// -------------------------------------------------------- 3b. leakage lint

// Coordinator ruling (scoping exemption b): a line is exempt from the
// leakage terms when it is either the mechanically-transcribed
// `Commit subject:` line of the work-order template, or itself a verbatim
// substring of THIS artifact's real `subject` (key.json/base-pool.json) —
// both are the real commit's own subject line, never seeder-authored prose,
// and this repository's own history legitimately uses words like "defect"
// in its real commit subjects. Every other line is still fully checked.
function isExemptLeakageLine(line, subject) {
  const trimmed = line.trim();
  if (/^Commit subject:/.test(trimmed)) return true;
  if (typeof subject === 'string' && subject.length > 0 && trimmed.length > 0 && subject.includes(trimmed)) return true;
  return false;
}

function leakageLint(filePath, subject) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (isExemptLeakageLine(lines[i], subject)) continue;
    const lower = lines[i].toLowerCase();
    for (const term of LEAKAGE_TERMS) {
      if (lower.includes(term)) {
        fail(filePath + ': leakage lint — contains forbidden term ' + JSON.stringify(term) + ' (line ' + (i + 1) + ')');
      }
    }
  }
}

// ------------------------------------------------- 3c. template conformance

// Coordinator ruling (scoping exemption a): extracts just the AUTHOR
// SENTENCE — the sentence containing "produced this change" — from
// whitespace-normalized text: from the preceding sentence boundary (a `.`
// or `;`) or the start of the text, to the next `.` or `;` (or the end of
// the text). The vendor/model-name check runs ONLY over this extracted
// sentence, never the rest of the report, so real technical prose
// elsewhere (e.g. "...no longer weaker than the Codex path...", describing
// the diff's own subject matter) cannot trip it.
function extractAuthorSentence(norm) {
  const marker = 'produced this change';
  const idx = norm.indexOf(marker);
  if (idx === -1) return norm; // caller already asserted the phrase is present; defensive fallback only
  let start = 0;
  for (let i = idx - 1; i >= 0; i--) {
    if (norm[i] === '.' || norm[i] === ';') { start = i + 1; break; }
  }
  let end = norm.length;
  for (let i = idx + marker.length; i < norm.length; i++) {
    if (norm[i] === '.' || norm[i] === ';') { end = i + 1; break; }
  }
  return norm.slice(start, end).trim();
}

// Runs against an EXECUTOR REPORT (`.er.txt`) only — VARIANTS.md's work
// order is identical across all three variants and names no vendor/model,
// so it carries nothing variant-specific to conform to.
function templateConformance(erPath, variant) {
  const content = fs.readFileSync(erPath, 'utf8');
  const norm = normalizeWs(content);
  if (variant === 'V1' || variant === 'V3') {
    if (!norm.includes(V1_AUTHOR_PHRASE)) {
      fail(erPath + ': variant ' + variant + ' must contain the V1 author phrase, whitespace-normalized (VARIANTS.md § "Executor report — V1 blind")');
    }
  } else if (variant === 'V2') {
    if (!norm.includes(V2_AUTHOR_PHRASE)) {
      fail(erPath + ': variant V2 must contain the V2 author phrase, whitespace-normalized (VARIANTS.md § "Executor report — V2 identity-visible")');
    }
    return; // V2 is identity-visible on purpose; the vendor-name check below is V1/V3-only
  } else {
    fail(erPath + ': unrecognized variant ' + JSON.stringify(variant) + ' — expected V1, V2 or V3');
  }
  if (variant === 'V1' || variant === 'V3') {
    const authorSentence = extractAuthorSentence(norm);
    const hit = findVendorTerm(authorSentence);
    if (hit) fail(erPath + ': variant ' + variant + ' must name no vendor/model/effort/price IN THE AUTHOR SENTENCE — found ' + JSON.stringify(hit) + ' (whole word, case-sensitive) in ' + JSON.stringify(authorSentence));
  }
  if (variant === 'V3' && !norm.includes(HAZARD_PHRASE)) {
    fail(erPath + ': variant V3 must contain a HAZARD CHECKLIST block, whitespace-normalized (VARIANTS.md § "Executor report — V3 blind + hazard")');
  }
}

// -------------------------------------------------------------- 4. tallies

function computeTallies(key) {
  const seeded = key.artifacts.filter((a) => a.kind === 'seeded');
  const controls = key.artifacts.filter((a) => a.kind === 'control');

  const byType = {};
  for (const t of TYPES) byType[t] = 0;
  const severityCounts = { CRITICAL: 0, MAJOR: 0, MINOR: 0 };
  const criticalTypes = new Set();
  for (const a of seeded) {
    byType[a.seed.type] = (byType[a.seed.type] || 0) + 1;
    severityCounts[a.seed.severity] = (severityCounts[a.seed.severity] || 0) + 1;
    if (a.seed.severity === 'CRITICAL') criticalTypes.add(a.seed.type);
  }

  const seedVariant = { V1: 0, V2: 0, V3: 0 };
  for (const a of seeded) seedVariant[a.variant] = (seedVariant[a.variant] || 0) + 1;
  const controlVariant = { V1: 0, V2: 0, V3: 0 };
  for (const a of controls) controlVariant[a.variant] = (controlVariant[a.variant] || 0) + 1;

  const phaseCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const a of key.artifacts) phaseCounts[a.phase] = (phaseCounts[a.phase] || 0) + 1;

  const warnings = [];
  for (const t of TYPES) {
    if (byType[t] !== 5) warnings.push('type ' + t + ' has ' + byType[t] + ' seeds (target 5)');
  }
  if (severityCounts.MAJOR < 20) warnings.push('MAJOR seeds = ' + severityCounts.MAJOR + ' (target >=20)');
  if (severityCounts.CRITICAL < 6) warnings.push('CRITICAL seeds = ' + severityCounts.CRITICAL + ' (target >=6)');
  if (severityCounts.MINOR > 4) warnings.push('MINOR seeds = ' + severityCounts.MINOR + ' (target <=4)');
  if (criticalTypes.size < 4) warnings.push('CRITICAL seeds land in only ' + criticalTypes.size + ' type(s) (target >=4)');
  for (const v of VARIANTS) {
    if (seedVariant[v] !== 10) warnings.push('seed variant ' + v + ' = ' + seedVariant[v] + ' (target 10)');
    if (controlVariant[v] !== 18) warnings.push('control variant ' + v + ' = ' + controlVariant[v] + ' (target 18)');
  }
  const phaseTargets = { 0: 12, 1: 24, 2: 24, 3: 24 };
  for (const p of [0, 1, 2, 3]) {
    if (phaseCounts[p] !== phaseTargets[p]) warnings.push('phase ' + p + ' has ' + phaseCounts[p] + ' artifacts (target ' + phaseTargets[p] + ')');
  }

  return { byType, severityCounts, criticalTypes: [...criticalTypes].sort(), seedVariant, controlVariant, phaseCounts, warnings, seededCount: seeded.length, controlCount: controls.length };
}

function renderTalliesTable(t) {
  const lines = [];
  lines.push('Total: ' + (t.seededCount + t.controlCount) + ' (' + t.seededCount + ' seeded + ' + t.controlCount + ' control)');
  lines.push('');
  lines.push('| Type | count (target 5) |');
  lines.push('|---|---|');
  for (const type of TYPES) lines.push('| ' + type + ' | ' + t.byType[type] + ' |');
  lines.push('');
  lines.push('| Severity | count | target |');
  lines.push('|---|---|---|');
  lines.push('| CRITICAL | ' + t.severityCounts.CRITICAL + ' | >=6 |');
  lines.push('| MAJOR | ' + t.severityCounts.MAJOR + ' | >=20 |');
  lines.push('| MINOR | ' + t.severityCounts.MINOR + ' | <=4 |');
  lines.push('CRITICAL present in types: ' + (t.criticalTypes.join(', ') || '(none)') + ' (target >=4 types)');
  lines.push('');
  lines.push('| Variant | seeds (target 10) | controls (target 18) |');
  lines.push('|---|---|---|');
  for (const v of VARIANTS) lines.push('| ' + v + ' | ' + t.seedVariant[v] + ' | ' + t.controlVariant[v] + ' |');
  lines.push('');
  lines.push('| Phase | count | target |');
  lines.push('|---|---|---|');
  lines.push('| 0 | ' + t.phaseCounts[0] + ' | 12 |');
  lines.push('| 1 | ' + t.phaseCounts[1] + ' | 24 |');
  lines.push('| 2 | ' + t.phaseCounts[2] + ' | 24 |');
  lines.push('| 3 | ' + t.phaseCounts[3] + ' | 24 |');
  return lines.join('\n');
}

// --------------------------------------------------------- 5. CONSTRUCTION.md

function renderConstructionMd(key, tallies, heads, normalizationLog, notes) {
  const lines = [];
  lines.push('# WO-12 SDC construction record');
  lines.push('');
  lines.push('Written by `assemble-key.js`. Records what `corpus/key.json` does not carry —');
  lines.push('narrative fields, materialization results, and the deviations the protocol');
  lines.push('asks to be recorded rather than gated on.');
  lines.push('');
  lines.push('## Tallies (protocol §2.2/§2.3/§2.6/§2.7 targets)');
  lines.push('');
  lines.push(renderTalliesTable(tallies));
  lines.push('');
  if (tallies.warnings.length) {
    lines.push('**WARNINGS (non-gating — the key is sealed as constructed):**');
    for (const w of tallies.warnings) lines.push('- ' + w);
  } else {
    lines.push('No target warnings — every §2.2/§2.3/§2.6/§2.7 target is met exactly.');
  }
  lines.push('');
  lines.push('## Seeded artifacts');
  lines.push('');
  lines.push('| id | type | severity | locator.file | phase | variant |');
  lines.push('|---|---|---|---|---|---|');
  for (const a of key.artifacts) {
    if (a.kind !== 'seeded') continue;
    lines.push('| ' + a.id + ' | ' + a.seed.type + ' | ' + a.seed.severity + ' | ' + a.seed.locator.file + ' | ' + a.phase + ' | ' + a.variant + ' |');
  }
  lines.push('');
  lines.push('## Materialized heads');
  lines.push('');
  lines.push('| id | base | head |');
  lines.push('|---|---|---|');
  for (const a of key.artifacts) {
    if (a.kind !== 'seeded') continue;
    lines.push('| ' + a.id + ' | ' + a.base + ' | ' + (heads[a.id] || '(not materialized)') + ' |');
  }
  lines.push('');
  lines.push('## Seeder severity deviations');
  lines.push('');
  const deviations = [];
  for (const a of key.artifacts) {
    if (a.kind !== 'seeded') continue;
    const n = notes.seeds[a.id];
    if (n && n.target_severity && n.achieved_severity !== n.target_severity) {
      deviations.push({ id: a.id, target: n.target_severity, achieved: n.achieved_severity, rationale: a.seed.rationale });
    }
  }
  if (deviations.length) {
    for (const d of deviations) {
      lines.push('- **' + d.id + '**: target ' + d.target + ' -> achieved ' + d.achieved + ' — "' + d.rationale + '"');
    }
  } else {
    lines.push('None — every seed.json `severity` matches its base-pool `target_severity`.');
  }
  lines.push('');
  lines.push('## Brief normalization log');
  lines.push('');
  if (normalizationLog.length) {
    lines.push('| file | replaced tokens/shas | changed |');
    lines.push('|---|---|---|');
    for (const e of normalizationLog) {
      lines.push('| ' + e.file + ' | ' + (e.replaced.length ? e.replaced.join(', ') : '(already normalized)') + ' | ' + (e.changed ? 'yes' : 'no') + ' |');
    }
  } else {
    lines.push('No seeded briefs were normalized this run (nothing to materialize).');
  }
  lines.push('');
  return lines.join('\n');
}

// ------------------------------------------------------------------- main

function main() {
  const args = parseArgs(process.argv.slice(2));
  const paths = resolvePaths(args);
  const pool = loadJson(paths.poolPath, 'base-pool.json');
  if (!pool || !Array.isArray(pool.slots)) fail('base-pool.json at ' + paths.poolPath + ' has no `slots` array');

  const missing = checkRequirements(pool, paths);

  if (args.checkOnly) {
    if (missing.length) {
      process.stdout.write('assemble-key --check-only: ' + missing.length + ' item(s) missing:\n');
      for (const m of missing) process.stdout.write('  MISSING  ' + m + '\n');
      process.exitCode = 1;
      return;
    }
    process.stdout.write('assemble-key --check-only: nothing missing — all ' + pool.slots.length + ' slots have their required inputs.\n');
    return;
  }

  if (missing.length) {
    fail(missing.length + ' item(s) missing — the key is all-or-nothing (protocol §2.3):\n' + missing.map((m) => '  ' + m).join('\n'));
  }

  // 1. key.json + construction-notes.json (narrative half)
  const { key, notes } = buildKeyAndNotes(pool, paths);
  fs.mkdirSync(paths.corpusDir, { recursive: true });
  fs.writeFileSync(paths.keyPath, JSON.stringify(key, null, 2) + '\n', 'utf8');

  // 2. materialize every seeded variant, one shared clone for the whole run
  const seededIds = key.artifacts.filter((a) => a.kind === 'seeded').map((a) => a.id);
  const cloneRoot = args.cloneRoot ? path.resolve(args.cloneRoot) : fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-wo12-assemble-'));
  const heads = {};
  for (const a of key.artifacts) {
    if (a.kind !== 'seeded') continue;
    const buildArgs = ['--id', a.id, '--key', paths.keyPath, '--corpus-dir', paths.corpusDir, '--patches-dir', paths.corpusDir, '--clone-root', cloneRoot];
    if (args.sourceRepo) buildArgs.push('--source-repo', path.resolve(args.sourceRepo));
    const r = spawnSync(process.execPath, [paths.buildCorpusPath].concat(buildArgs), { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (r.status !== 0) fail(a.id + ': build-corpus.js failed to materialize:\n' + (r.stderr || r.stdout || '(no output)'));
    let parsed;
    try {
      parsed = JSON.parse((r.stdout || '').trim().split('\n').pop());
    } catch (e) {
      fail(a.id + ': could not parse build-corpus.js JSON output: ' + r.stdout);
    }
    if (!parsed.head) fail(a.id + ': build-corpus.js produced no `head` in its output: ' + r.stdout);
    heads[a.id] = parsed.head;
  }

  // 3. normalize the seeded briefs against the real materialized heads
  const normalizationLog = [];
  for (const a of key.artifacts) {
    if (a.kind !== 'seeded') continue;
    const { wo, er } = briefPaths(paths.briefsDir, a.id);
    normalizationLog.push(normalizeBrief(wo, a.base, heads[a.id], { requireBase: true }));
    normalizationLog.push(normalizeBrief(er, a.base, heads[a.id], { requireBase: false }));
  }

  // 4. leakage lint + template conformance over EVERY brief
  for (const a of key.artifacts) {
    const { wo, er } = briefPaths(paths.briefsDir, a.id);
    leakageLint(wo, a.subject);
    leakageLint(er, a.subject);
    templateConformance(er, a.variant);
  }

  // 5. tallies
  const tallies = computeTallies(key);
  notes.targetWarnings = tallies.warnings;
  fs.writeFileSync(paths.notesPath, JSON.stringify(notes, null, 2) + '\n', 'utf8');

  // 6. CONSTRUCTION.md
  const md = renderConstructionMd(key, tallies, heads, normalizationLog, notes);
  fs.writeFileSync(paths.constructionMdPath, md, 'utf8');

  process.stdout.write('assemble-key: sealed ' + key.artifacts.length + ' artifacts (' + tallies.seededCount + ' seeded + ' + tallies.controlCount + ' control) into ' + paths.keyPath + '\n');
  process.stdout.write(renderTalliesTable(tallies) + '\n');
  if (tallies.warnings.length) {
    process.stdout.write('\nWARNINGS (' + tallies.warnings.length + ', non-gating):\n');
    for (const w of tallies.warnings) process.stdout.write('  - ' + w + '\n');
  } else {
    process.stdout.write('\nNo target warnings.\n');
  }
  process.stdout.write('\nWrote ' + paths.notesPath + ' and ' + paths.constructionMdPath + '\n');
}

module.exports = {
  TYPES,
  VARIANTS,
  LEAKAGE_TERMS,
  VENDOR_TERMS,
  V1_AUTHOR_PHRASE,
  V2_AUTHOR_PHRASE,
  HAZARD_PHRASE,
  findVendorTerm,
  extractAuthorSentence,
  isExemptLeakageLine,
  normalizeWs,
  parseArgs,
  resolvePaths,
  checkRequirements,
  buildKeyAndNotes,
  normalizeBrief,
  leakageLint,
  templateConformance,
  computeTallies,
  renderTalliesTable,
  renderConstructionMd,
};

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write('assemble-key: ' + ((e && e.message) || e) + '\n');
    process.exit(1);
  }
}
