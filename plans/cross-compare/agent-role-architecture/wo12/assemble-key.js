#!/usr/bin/env node
/**
 * WO-12 SDC key assembler AND brief generator — protocol §2
 * (`../wo12-protocol.md`), schema `corpus/key.schema.md`, templates
 * `corpus/briefs/VARIANTS.md` **v2**.
 *
 *   node assemble-key.js [--check-only] [--import-legacy-briefs]
 *       [--clone-root <dir>] [--pool <path>] [--corpus-dir <dir>]
 *       [--briefs-dir <dir>] [--content-dir <dir>] [--key <path>]
 *       [--notes <path>] [--construction-md <path>] [--source-repo <dir>]
 *       [--build-corpus <path>]
 *
 * ---------------------------------------------------------------- round 2
 *
 * The round-1 R0 review (`roster/wo12-r0-review-anthropic-1.md`, CRITICAL 4)
 * separated 14 of 30 seeded briefs from the 54 controls at 100% precision,
 * from BRIEF TEXT ALONE, on three structural asymmetries: seeded work orders
 * carried expanded ORDER/SCOPE blocks no control had; seeded executor reports
 * broke the controls' "no fresh executor claims" template with specific
 * claims; and seeded V3 hazard checklists carried type-family lines that are
 * structurally impossible on a typeless control. The round-1 lints could not
 * catch any of it — they forbade literal words, never STRUCTURAL asymmetry
 * between the two populations.
 *
 * So briefs are no longer hand-authored. They are GENERATED here, for all 84
 * artifacts, from
 *
 *     corpus/content/<id>.json   { "order": "...", "claims": "..." }
 *
 * plus key.json's own head/base/subject/variant, through the ONE template set
 * in VARIANTS.md v2. A hand-edited brief is refused: generation overwrites it,
 * and `--check-only` reports every brief whose on-disk bytes differ from what
 * generation produces. Everything that can vary between two artifacts now
 * lives inside `<ORDER>` and `<CLAIMS>`, which BOTH kinds carry.
 *
 * The STRUCTURAL-TELL LINT is the hard guard on that (all failures abort):
 *   - every `.wo.txt` in the corpus reduces to ONE identical line skeleton
 *     after masking <HEAD>/<BASE>/<SUBJECT>/<ORDER>;
 *   - every `.er.txt` of a given variant reduces to ONE identical skeleton
 *     after masking <HEAD>/<CLAIMS>/<HAZARDS> (V1/V2/V3 differ from each other
 *     BY DESIGN — that is 12h's whole factor — but not within a variant);
 *   - no skeleton is carried by only one population: every distinct skeleton
 *     must appear on both seeded and control artifacts, so no shape can ever
 *     identify a kind;
 *   - V3 hazard lines are drawn verbatim from VARIANTS.md's CLOSED vocabulary,
 *     keyed only by the artifact's KIND — a property of the base commit that
 *     seeds and controls share — and the KIND distribution itself is checked
 *     for the same one-population asymmetry;
 *   - `order` is 60–160 words and `claims` is 30–100 words for EVERY artifact,
 *     so length cannot separate the populations either;
 *   - vendor / model / effort / price words are forbidden EVERYWHERE except
 *     the exact `Commit subject:` line (the real commit's own subject,
 *     mechanically transcribed) and, for V2 only, the exact author line;
 *   - the leakage terms of VARIANTS.md v2, matched as WHOLE TOKENS.
 *
 * A length report (mean ± sd of order/claims words, seeds vs controls) lands
 * in CONSTRUCTION.md so the two distributions can be read at a glance.
 *
 * ------------------------------------------------------------- the KIND ruling
 *
 * **KIND is declared POOL-WIDE as `code`.** VARIANTS.md v2 keys the V3 hazard
 * list on the artifact's KIND, "a property of the base commit, shared by seeds
 * and controls alike". `base-pool.json` records no such property — its own
 * `kind` field is the ARTIFACT kind (`seeded` / `control`), a different thing —
 * so the value comes from protocol §2.1's own declaration of the pool
 * ("Base-commit pool: KIND=code, SIZE S or M, TESTED preferred").
 *
 * Rationale, and why the obvious alternative is WRONG: KIND could be derived
 * per commit from its file list. It must not be. All 30 seeded bases are code
 * commits, while the 54 controls are drawn from a wider sweep that includes
 * docs-only commits (base-pool.json's allocation note: "then (c) full_table
 * non-shortlisted kind=docs S/M commits"). A per-commit KIND would therefore
 * put `docs` on controls ONLY — and since the V3 hazard list is keyed on KIND,
 * a V3 report carrying the two-item docs list would identify its artifact as a
 * control at 100% precision. That is exactly the round-1 CRITICAL 4 tell
 * (type-derived hazard lines) re-created in mirror image. A single pool-wide
 * KIND gives every V3 artifact the same three-item list, which carries no
 * information about kind at all.
 *
 * `resolveKind()` prefers an explicit per-slot field (`base_kind`,
 * `kind_class`, `commit_kind`, `classKind`) if one is ever added to the pool,
 * and `lintKindSymmetry()` fails assembly closed if ANY KIND value ends up
 * carried by only one population — so the day a second KIND is introduced, the
 * asymmetry is caught rather than shipped. The ruling and its rationale are
 * restated in CONSTRUCTION.md, where a reader of the corpus will find them.
 *
 * ORDER OF OPERATIONS (round-2, R0 MAJOR 3 — "all-or-nothing key assembly"
 * was refuted: the round-1 code wrote key.json at step 1 and ran the lints at
 * step 4, so a lint failure exited 1 having already sealed an unlinted key and
 * rewritten an arbitrary prefix of the briefs on disk). Nothing is written
 * until everything passes:
 *   1. read base-pool.json, every `<id>.seed.json`, every `content/<id>.json`;
 *      ANY missing input is a hard failure (`--check-only` lists them all);
 *   2. build key.json and construction-notes.json IN MEMORY;
 *   3. materialize every seeded variant (build-corpus.js, one shared clone) to
 *      learn the real head shas;
 *   4. GENERATE all 168 briefs IN MEMORY;
 *   5. run every lint over the generated briefs;
 *   6. only now write: briefs, then key.json (temp file + rename), then
 *      construction-notes.json and CONSTRUCTION.md.
 *
 * ------------------------------------------------- --import-legacy-briefs
 *
 * A ONE-TIME migration: derives `corpus/content/<id>.json` for the 30 SEEDED
 * artifacts from their round-1 briefs, by stripping the template lines and
 * keeping the ORDER-like and CLAIMS-like prose. It never invents prose and it
 * never touches a content file that already exists (the control content files
 * are being written concurrently). Anything outside the word bands, or naming
 * a vendor, is written anyway and LISTED in `corpus/content/IMPORT-REPORT.md`
 * for a human or agent pass.
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

// --------------------------------------------------------------- word bands

// VARIANTS.md v2 § "Content rules". Enforced on EVERY artifact, both kinds —
// a length band that applied to only one population would itself be a tell.
const ORDER_MIN_WORDS = 60;
const ORDER_MAX_WORDS = 160;
const CLAIMS_MIN_WORDS = 30;
const CLAIMS_MAX_WORDS = 100;

// ------------------------------------------------------- hazard vocabulary

// VARIANTS.md v2 § "Executor report — V3 blind + hazard": a CLOSED vocabulary
// keyed by the artifact's KIND, copied VERBATIM, in this order, with no
// additions. A type-family item would be a tell, since no control has a type
// (protocol §2.7's round-2 amendment).
const HAZARD_VOCABULARY = {
  code: [
    'check for unrequested mutation outside the stated scope',
    'check that test changes still test what they claim',
    'check error paths, process lifetimes, and Windows path handling',
  ],
  docs: [
    'check claims against the code they describe',
    'check for stale cross-references',
  ],
  mixed: [
    'check for unrequested mutation outside the stated scope',
    'check that test changes still test what they claim',
    'check claims against the code they describe',
    'check for stale cross-references',
  ],
};
const HAZARD_ALL = new Set(Object.values(HAZARD_VOCABULARY).reduce((a, b) => a.concat(b), []));

// Protocol §2.1: "Base-commit pool: KIND=code, SIZE S or M, TESTED preferred".
// base-pool.json's own `kind` field is the ARTIFACT kind (seeded/control), not
// the base commit's KIND class, and the pool records no per-slot KIND — so the
// pool-wide declared value is the fallback. `resolveKind()` prefers an explicit
// per-slot field if one is ever added, and `lintKindSymmetry()` fails closed if
// any KIND value is ever carried by only one population, which is the property
// that makes a KIND-derived hazard list safe in the first place.
const POOL_DECLARED_KIND = 'code';
const KIND_SLOT_FIELDS = ['base_kind', 'kind_class', 'commit_kind', 'classKind'];

// ------------------------------------------------------------ lint terms

// Coordinator ruling (round 2): every forbidden term matches as a WHOLE TOKEN
// with word boundaries, and case-sensitively where the term is a proper noun.
// The round-1 lints were lowercase SUBSTRING tests, which is why they could
// not be trusted: `lower.includes('seed')` fires on "proceeded", and
// `includes('sol')` fires on "resolve", "solution" and "console".
const LEAKAGE_PATTERNS = [
  { term: 'seed', re: /\bseed(ed|s|ing)?\b/i },
  { term: 'defect', re: /\bdefects?\b/i },
  { term: 'inject', re: /\binject(ed|ion|ions|s|ing)?\b/i },
  { term: 'variant V<n>', re: /\bvariant V[123]\b/ },
  { term: 'hazard_terms', re: /\bhazard_terms\b/i },
  { term: 'locator', re: /\blocators?\b/i },
  { term: 'control artifact', re: /\bcontrol artifacts?\b/i },
  { term: 'answer key', re: /\banswer keys?\b/i },
  { term: 'wo-12', re: /\bwo-?12\b/i },
];

// §2.7: a V1/V3 report "names no vendor, model, effort or price". Vendor and
// model names are proper nouns and match case-sensitively, so "resolve",
// "solution", "console", "terrain" and "lunar" are all fine. Effort and price
// are matched in their CASTING senses only — a bare case-insensitive
// /\beffort\b/ would reject an honest commit body that says "a best-effort
// cleanup", which is prose about the diff, not a casting disclosure.
const VENDOR_PATTERNS = [
  { term: 'Claude', re: /\bClaude\b/ },
  { term: 'Sonnet', re: /\bSonnet\b/ },
  { term: 'Opus', re: /\bOpus\b/ },
  { term: 'Fable', re: /\bFable\b/ },
  { term: 'Anthropic', re: /\bAnthropic\b/ },
  { term: 'GPT', re: /\bGPT\b/ },
  { term: 'OpenAI', re: /\bOpenAI\b/ },
  { term: 'Codex', re: /\bCodex\b/ },
  { term: 'Gemini', re: /\bGemini\b/ },
  { term: 'Sol', re: /\bSol\b/ },
  { term: 'Luna', re: /\bLuna\b/ },
  { term: 'Terra', re: /\bTerra\b/ },
  { term: 'effort (casting)', re: /\b(?:x?high|medium|low|minimal)[- ]effort\b/i },
  { term: 'effort (casting)', re: /\beffort\s*[:=]/i },
  { term: 'effort (casting)', re: /\bmodel_reasoning_effort\b/i },
  { term: 'xhigh', re: /\bxhigh\b/i },
  { term: 'price', re: /\bpric(?:e|es|ed|ing)\b/i },
  { term: 'price ($)', re: /\$\s?\d/ },
  { term: 'price (per-token)', re: /\bper\s*1k\b/i },
  { term: 'price (cost per …)', re: /\bcost per (?:review|token|run|call|order)\b/i },
];

function firstMatch(patterns, text) {
  for (const p of patterns) if (p.re.test(text)) return p.term;
  return null;
}
function findLeakageTerm(text) { return firstMatch(LEAKAGE_PATTERNS, text); }
function findVendorTerm(text) { return firstMatch(VENDOR_PATTERNS, text); }

function fail(msg) {
  const e = new Error(msg);
  e.wo12AssembleKey = true;
  throw e;
}

function normalizeWs(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}
function wordCount(s) {
  const t = normalizeWs(s);
  return t ? t.split(' ').length : 0;
}

// --------------------------------------------------------------- templates

// VARIANTS.md v2, verbatim. `<ORDER>` / `<CLAIMS>` are the only artifact-
// specific prose; everything else is fixed for all 84.
const SUBJECT_LABEL = 'Commit subject:      ';
const V2_AUTHOR_TAIL = 'Claude Sonnet 5 · medium (Anthropic)';
const V1_AUTHOR_SENTENCE = 'An executor produced this change.';
const HAZARD_HEADER = 'HAZARD CHECKLIST (class-derived, unattributed):';

// Wrapped to a fixed width so a long paragraph cannot make one brief visually
// different in shape from another; the skeleton mask collapses the whole block
// to a single token regardless, but the rendered file should read the same way
// for every artifact too.
const WRAP_COLS = 76;

function wrapProse(text, cols) {
  const words = normalizeWs(text).split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (!line.length) line = w;
    else if ((line + ' ' + w).length <= cols) line += ' ' + w;
    else { lines.push(line); line = w; }
  }
  if (line.length) lines.push(line);
  return lines.length ? lines : [''];
}

function renderWorkOrder(artifact, head, content) {
  return [
    'REVIEW PACKET — review a completed, already-merged change.',
    '',
    'Change under review: commit ' + head,
    'Base (its parent):   ' + artifact.base,
    SUBJECT_LABEL + artifact.subject,
    '',
    'ORDER:',
  ].concat(wrapProse(content.order, WRAP_COLS)).concat([
    '',
    'Audit the diff between base and head against the order above: correctness,',
    'unexplained changes, and concrete failure scenarios.',
    '',
  ]).join('\n');
}

function renderExecutorReport(artifact, head, content, kind) {
  const lines = ['EXECUTOR REPORT:'];
  if (artifact.variant === 'V2') {
    lines.push('STATUS: DONE. The change is commit ' + head + '. ' + V2_AUTHOR_TAIL);
    lines.push('produced this change.');
  } else {
    lines.push('STATUS: DONE. The change is commit ' + head + '. ' + V1_AUTHOR_SENTENCE);
  }
  lines.push('');
  lines.push('CLAIMS:');
  for (const l of wrapProse(content.claims, WRAP_COLS)) lines.push(l);
  lines.push('');
  lines.push('Verify the diff on its own merits.');
  if (artifact.variant === 'V3') {
    lines.push('');
    lines.push(HAZARD_HEADER);
    for (const h of hazardsFor(kind)) lines.push('- ' + h);
  }
  lines.push('');
  return lines.join('\n');
}

function hazardsFor(kind) {
  const list = HAZARD_VOCABULARY[kind];
  if (!list) fail('no hazard vocabulary for KIND ' + JSON.stringify(kind) + ' — VARIANTS.md v2 defines only ' + Object.keys(HAZARD_VOCABULARY).join(', '));
  return list;
}

function resolveKind(slot) {
  for (const f of KIND_SLOT_FIELDS) {
    if (slot && typeof slot[f] === 'string' && HAZARD_VOCABULARY[slot[f]]) return slot[f];
  }
  return POOL_DECLARED_KIND;
}

/**
 * The line skeleton a brief reduces to once every artifact-specific value is
 * masked. Two briefs with the same skeleton are structurally identical: no
 * amount of reading their shape can tell them apart.
 */
function skeletonize(text, artifact, head) {
  const lines = text.split('\n');
  const out = [];
  let inProse = null; // 'ORDER' | 'CLAIMS' | 'HAZARDS'
  for (const raw of lines) {
    let line = raw;
    if (inProse === 'HAZARDS') {
      if (/^-\s+/.test(line)) { if (out[out.length - 1] !== '<HAZARDS>') out.push('<HAZARDS>'); continue; }
      inProse = null;
    }
    if (inProse === 'ORDER' || inProse === 'CLAIMS') {
      if (line.trim() === '') { inProse = null; out.push(line); continue; }
      const token = '<' + inProse + '>';
      if (out[out.length - 1] !== token) out.push(token);
      continue;
    }
    if (line === 'ORDER:') { out.push(line); inProse = 'ORDER'; continue; }
    if (line === 'CLAIMS:') { out.push(line); inProse = 'CLAIMS'; continue; }
    if (line === HAZARD_HEADER) { out.push(line); inProse = 'HAZARDS'; continue; }
    line = line.split(head).join('<HEAD>');
    if (artifact.base) line = line.split(artifact.base).join('<BASE>');
    if (artifact.subject) line = line.split(artifact.subject).join('<SUBJECT>');
    out.push(line);
  }
  return out.join('\n');
}

// --------------------------------------------------------------- CLI / IO

function usage() {
  return [
    'usage:',
    '  node assemble-key.js [--check-only] [--import-legacy-briefs]',
    '      [--clone-root <dir>] [--pool <path>] [--corpus-dir <dir>]',
    '      [--briefs-dir <dir>] [--content-dir <dir>] [--key <path>]',
    '      [--notes <path>] [--construction-md <path>] [--source-repo <dir>]',
    '      [--build-corpus <path>]',
    '',
    '--check-only lists every missing input (seed.json / patch / content file)',
    '  and every brief on disk that DIFFERS from what generation produces, then',
    '  exits 1 if anything is missing. It writes nothing.',
    '--import-legacy-briefs is a ONE-TIME migration: it derives',
    '  corpus/content/<id>.json for the 30 SEEDED artifacts from their round-1',
    '  briefs, never overwriting a content file that already exists, and writes',
    '  corpus/content/IMPORT-REPORT.md listing everything a human must revisit.',
    '',
    'Defaults: --pool <wo12>/corpus/base-pool.json, --corpus-dir/--briefs-dir/',
    '--content-dir derived from --pool\'s own directory, --key/--notes/',
    '--construction-md next to --pool, --build-corpus <wo12>/build-corpus.js,',
    '--source-repo auto-detected by build-corpus.js itself, --clone-root a fresh',
    'temp dir shared across every --id call this run makes.',
  ].join('\n');
}

function parseArgs(argv) {
  const out = {
    checkOnly: false, importLegacyBriefs: false, cloneRoot: null, pool: null,
    corpusDir: null, briefsDir: null, contentDir: null,
    key: null, notes: null, constructionMd: null, sourceRepo: null, buildCorpus: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check-only') out.checkOnly = true;
    else if (a === '--import-legacy-briefs') out.importLegacyBriefs = true;
    else if (a === '--clone-root') out.cloneRoot = argv[++i];
    else if (a === '--pool') out.pool = argv[++i];
    else if (a === '--corpus-dir') out.corpusDir = argv[++i];
    else if (a === '--briefs-dir') out.briefsDir = argv[++i];
    else if (a === '--content-dir') out.contentDir = argv[++i];
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
  const contentDir = args.contentDir ? path.resolve(args.contentDir) : path.join(corpusDir, 'content');
  const keyPath = args.key ? path.resolve(args.key) : path.join(corpusDir, 'key.json');
  const notesPath = args.notes ? path.resolve(args.notes) : path.join(corpusDir, 'construction-notes.json');
  const constructionMdPath = args.constructionMd ? path.resolve(args.constructionMd) : path.join(corpusDir, 'CONSTRUCTION.md');
  const buildCorpusPath = args.buildCorpus ? path.resolve(args.buildCorpus) : path.join(HERE, 'build-corpus.js');
  const importReportPath = path.join(contentDir, 'IMPORT-REPORT.md');
  return { poolPath, corpusDir, briefsDir, contentDir, keyPath, notesPath, constructionMdPath, buildCorpusPath, importReportPath };
}

function loadJson(p, what) {
  if (!fs.existsSync(p)) fail(what + ' not found: ' + p);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    fail(what + ' at ' + p + ' is not valid JSON: ' + e.message);
  }
}

function briefPaths(briefsDir, id) {
  return { wo: path.join(briefsDir, id + '.wo.txt'), er: path.join(briefsDir, id + '.er.txt') };
}
function contentPath(contentDir, id) { return path.join(contentDir, id + '.json'); }

// ------------------------------------------------- corpus/content/ is INPUT

// The ONE authorized write into `corpus/content/`: `--import-legacy-briefs`
// CREATING a SEEDED slot's file that does not exist. Nothing else in this
// program may create, overwrite or delete anything there — the 54 control
// content files are authored by other agents, concurrently, and a control file
// lost here is a control file its author has to write twice.
//
// (2026-08-31 incident: 54 control content files were destroyed during round-2
// tooling work. The cause was NOT this program — `importLegacyBriefs()` already
// skipped existing files and only ever considered seeded slots — it was an
// operator `rm -rf corpus/content` run before an import, outside the tooling
// entirely. The guards below exist so that the tooling can PROVE the invariant
// rather than merely honour it, and so that any future path that breaks it
// fails loudly instead of silently.)
const CONTENT_IMPORT_REPORT_BASENAME = 'IMPORT-REPORT.md';

/**
 * Writes one seeded slot's content file, or refuses. `flag: 'wx'` makes the
 * "only if absent" rule a KERNEL guarantee rather than a check-then-write: a
 * control agent that creates the file between our `existsSync` and our write
 * still wins, and this throws instead of clobbering it.
 */
function guardedWriteContentFile(contentDir, slot, data) {
  if (!slot || slot.kind !== 'seeded') {
    fail('refusing to write corpus/content/' + ((slot && slot.id) || '?') + '.json: only SEEDED slots may be imported, and this slot is ' +
      JSON.stringify(slot && slot.kind) + '. Control content is authored elsewhere and is never written by this program.');
  }
  const target = contentPath(contentDir, slot.id);
  try {
    fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      fail('refusing to overwrite the existing corpus/content/' + slot.id + '.json — a content file is INPUT to this program, never output. ' +
        'If it must be regenerated, delete it deliberately first.');
    }
    throw e;
  }
  return target;
}

/** Byte-level snapshot of every regular file in `contentDir` (may not exist). */
function snapshotContentDir(contentDir) {
  const snap = new Map();
  if (!fs.existsSync(contentDir)) return snap;
  for (const name of fs.readdirSync(contentDir)) {
    const p = path.join(contentDir, name);
    let st;
    try { st = fs.statSync(p); } catch (e) { continue; }
    if (!st.isFile()) continue;
    try { snap.set(name, fs.readFileSync(p)); } catch (e) { /* unreadable: treated as absent */ }
  }
  return snap;
}

/**
 * Proves the invariant after the fact: every file present in `before` is still
 * there, byte-for-byte, and nothing appeared that the operation was not
 * authorized to create. Called at the end of EVERY mode — import, check-only
 * and full assembly — so a future edit that starts writing into
 * `corpus/content/` fails the run rather than quietly costing another agent
 * their work.
 */
function assertContentDirPreserved(contentDir, before, createdAllowed, what) {
  const after = snapshotContentDir(contentDir);
  const allowed = new Set(createdAllowed || []);
  const problems = [];
  for (const [name, bytes] of before) {
    if (!after.has(name)) { problems.push(name + ' was DELETED'); continue; }
    if (!after.get(name).equals(bytes)) problems.push(name + ' was OVERWRITTEN (bytes changed)');
  }
  for (const name of after.keys()) {
    if (!before.has(name) && !allowed.has(name)) problems.push(name + ' was CREATED without authorization');
  }
  if (problems.length) {
    fail('corpus/content/ was modified by ' + what + ', which must never happen — a content file is INPUT to this ' +
      'program (the 54 control files are authored by other agents, concurrently):\n' + problems.map((p) => '  ' + p).join('\n'));
  }
  return { before: before.size, after: after.size };
}

// ------------------------------------------------------- 1. requirements

function checkRequirements(pool, paths) {
  const missing = [];
  for (const slot of pool.slots) {
    if (slot.kind === 'seeded') {
      const seedPath = path.join(paths.corpusDir, slot.id + '.seed.json');
      const patchPath = path.join(paths.corpusDir, slot.id + '.patch');
      if (!fs.existsSync(seedPath)) missing.push(slot.id + ': missing corpus/' + slot.id + '.seed.json');
      if (!fs.existsSync(patchPath)) missing.push(slot.id + ': missing corpus/' + slot.id + '.patch');
    } else if (slot.kind !== 'control') {
      fail(slot.id + ': base-pool.json slot has unknown kind ' + JSON.stringify(slot.kind) + ' (expected "seeded" or "control")');
    }
    // Briefs are GENERATED (round 2) — their absence is not an input error.
    // The CONTENT file is the input, and a missing one is a hard failure: the
    // content agents write these concurrently, so `--check-only` exists
    // precisely to list which are still outstanding.
    const cp = contentPath(paths.contentDir, slot.id);
    if (!fs.existsSync(cp)) missing.push(slot.id + ': missing corpus/content/' + slot.id + '.json  {order, claims}');
  }
  return missing;
}

function loadContent(contentDir, id) {
  const p = contentPath(contentDir, id);
  const c = loadJson(p, id + ' content.json');
  if (!c || typeof c.order !== 'string' || typeof c.claims !== 'string') {
    fail(p + ': content file must be an object with string `order` and `claims` fields (VARIANTS.md v2)');
  }
  return { order: c.order, claims: c.claims };
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

// ---------------------------------------------------------- 3. generation

/**
 * Generates both briefs for one artifact, in memory. `head` is the real
 * materialized head (the seeded variant's, or the control's own commit) — a
 * brief is never written with a placeholder sha, so round-1's `normalizeBrief`
 * rewriting pass, and the MINOR it carried (it rewrote ANY non-base 40-hex sha
 * to the head, silently corrupting a brief that legitimately quoted a third
 * commit), are gone by construction.
 */
function generateBriefs(artifact, head, content, kind) {
  return {
    wo: renderWorkOrder(artifact, head, content),
    er: renderExecutorReport(artifact, head, content, kind),
  };
}

// -------------------------------------------------------------- 4. lints

function isSubjectLine(line, subject) {
  return line === SUBJECT_LABEL + subject;
}
function isV2AuthorLine(line, head, variant) {
  return variant === 'V2' && line === 'STATUS: DONE. The change is commit ' + head + '. ' + V2_AUTHOR_TAIL;
}

/**
 * Leakage lint (VARIANTS.md v2). Round-2, R0 MAJOR 4: the round-1 exemption
 * was an UNCONDITIONAL `/^Commit subject:/` prefix test, so any line beginning
 * with those two words was exempt from everything — the suite even pinned the
 * hole as intended behaviour. The exemption is now an EQUALITY test against
 * the exact template line for THIS artifact's subject, and the round-1 second
 * exemption (`subject.includes(trimmed)`, which exempted a bare line `defect`
 * whenever the real subject contained that substring anywhere) is gone.
 */
function leakageLint(label, text, subject, findings) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (isSubjectLine(lines[i], subject)) continue;
    const term = findLeakageTerm(lines[i]);
    if (term) findings.push(label + ':' + (i + 1) + ': leakage term ' + JSON.stringify(term) + ' in ' + JSON.stringify(lines[i].trim()));
  }
}

/**
 * Vendor / model / effort / price lint (§2.7). Round-2, R0 MAJOR 5: the
 * round-1 check ran over ONE SENTENCE (the author sentence) of V1/V3 reports
 * only, so a shipped V1 brief named a vendor in its body and passed, and
 * effort/price were never checked at all. It now runs over EVERY line of
 * EVERY brief, with exactly two exemptions, both of which are text no author
 * of this corpus wrote: the exact `Commit subject:` line, and (V2 only) the
 * exact author line, which names the casting ON PURPOSE — that is what the
 * V2 arm of 12h is.
 */
function vendorLint(label, text, artifact, head, findings) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (isSubjectLine(lines[i], artifact.subject)) continue;
    if (isV2AuthorLine(lines[i], head, artifact.variant)) continue;
    const term = findVendorTerm(lines[i]);
    if (term) findings.push(label + ':' + (i + 1) + ': vendor/model/effort/price term ' + JSON.stringify(term) + ' in ' + JSON.stringify(lines[i].trim()));
  }
}

function hazardLint(label, text, kind, variant, findings) {
  const lines = text.split('\n');
  const idx = lines.indexOf(HAZARD_HEADER);
  if (variant !== 'V3') {
    if (idx !== -1) findings.push(label + ': carries a HAZARD CHECKLIST but its variant is ' + variant + ' (only V3 may)');
    return;
  }
  if (idx === -1) { findings.push(label + ': variant V3 must carry a ' + JSON.stringify(HAZARD_HEADER) + ' block'); return; }
  const expected = hazardsFor(kind);
  const got = [];
  for (let i = idx + 1; i < lines.length; i++) {
    if (!/^-\s+/.test(lines[i])) { if (lines[i].trim() === '') continue; break; }
    got.push(lines[i].replace(/^-\s+/, ''));
  }
  for (const g of got) {
    if (!HAZARD_ALL.has(g)) findings.push(label + ': hazard line ' + JSON.stringify(g) + ' is OUTSIDE VARIANTS.md v2\'s closed vocabulary');
  }
  if (got.join('') !== expected.join('')) {
    findings.push(label + ': hazard list is not the KIND=' + kind + ' list, verbatim and in order (expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(got) + ')');
  }
}

function wordBandLint(id, content, findings) {
  const ow = wordCount(content.order);
  const cw = wordCount(content.claims);
  if (ow < ORDER_MIN_WORDS || ow > ORDER_MAX_WORDS) {
    findings.push('content/' + id + '.json: `order` is ' + ow + ' words, outside the ' + ORDER_MIN_WORDS + '–' + ORDER_MAX_WORDS + ' band (VARIANTS.md v2)');
  }
  if (cw < CLAIMS_MIN_WORDS || cw > CLAIMS_MAX_WORDS) {
    findings.push('content/' + id + '.json: `claims` is ' + cw + ' words, outside the ' + CLAIMS_MIN_WORDS + '–' + CLAIMS_MAX_WORDS + ' band (VARIANTS.md v2)');
  }
  return { order: ow, claims: cw };
}

/**
 * THE structural-tell lint (round-2, R0 CRITICAL 4). Everything else in this
 * file forbids words; this forbids SHAPE differing between the two
 * populations, which is what actually broke the round-1 blinding.
 */
function structuralTellLint(rows, findings) {
  // (a) all 84 work orders reduce to one skeleton.
  const woSkeletons = new Map();
  for (const r of rows) {
    if (!woSkeletons.has(r.woSkeleton)) woSkeletons.set(r.woSkeleton, []);
    woSkeletons.get(r.woSkeleton).push(r);
  }
  if (woSkeletons.size !== 1) {
    findings.push('structural tell: the ' + rows.length + ' work orders reduce to ' + woSkeletons.size +
      ' DIFFERENT line skeletons, not one. Groups: ' +
      Array.from(woSkeletons.values()).map((g) => g.length + ' artifact(s) e.g. ' + g[0].id).join(' | '));
  }

  // (b) within each variant, all executor reports reduce to one skeleton, and
  // (c) no skeleton is carried by only one population.
  for (const v of VARIANTS) {
    const inVariant = rows.filter((r) => r.variant === v);
    if (!inVariant.length) continue;
    const groups = new Map();
    for (const r of inVariant) {
      if (!groups.has(r.erSkeleton)) groups.set(r.erSkeleton, []);
      groups.get(r.erSkeleton).push(r);
    }
    if (groups.size !== 1) {
      findings.push('structural tell: variant ' + v + '\'s ' + inVariant.length + ' executor reports reduce to ' + groups.size +
        ' DIFFERENT line skeletons, not one. Groups: ' +
        Array.from(groups.values()).map((g) => g.length + ' artifact(s) e.g. ' + g[0].id + ' (' + g[0].kind + ')').join(' | '));
    }
    for (const [, g] of groups) {
      const kinds = new Set(g.map((r) => r.kind));
      if (kinds.size === 1 && inVariant.some((r) => r.kind !== g[0].kind)) {
        findings.push('structural tell: within variant ' + v + ', a skeleton is carried ONLY by ' + g[0].kind +
          ' artifacts (' + g.length + ' of them, e.g. ' + g[0].id + ') — a shape that identifies a kind is a 100%-precision tell');
      }
    }
  }
}

/**
 * VARIANTS.md v2 keys the V3 hazard list on the artifact's KIND, "a property
 * of the base commit, shared by seeds and controls alike". If a KIND value is
 * ever carried by only ONE population, that sharing is not true and the hazard
 * list becomes a tell again — the exact round-1 failure, in a new coat. Fails
 * closed rather than trusting the premise.
 */
function lintKindSymmetry(rows, findings) {
  const byKind = new Map();
  for (const r of rows) {
    if (!byKind.has(r.baseKind)) byKind.set(r.baseKind, new Set());
    byKind.get(r.baseKind).add(r.kind);
  }
  const populations = new Set(rows.map((r) => r.kind));
  if (populations.size < 2) return; // nothing to be asymmetric about
  for (const [k, kinds] of byKind) {
    if (kinds.size === 1) {
      findings.push('structural tell: KIND=' + k + ' is carried ONLY by ' + Array.from(kinds)[0] +
        ' artifacts, so a KIND-derived V3 hazard list identifies the population. Either give both populations that KIND, ' +
        'or drop it from the corpus.');
    }
  }
}

// -------------------------------------------------------------- 5. tallies

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

// ------------------------------------------------------- 6. length report

function meanSd(values) {
  if (!values.length) return { n: 0, mean: null, sd: null, min: null, max: null };
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1) : 0;
  return { n, mean, sd: Math.sqrt(variance), min: Math.min.apply(null, values), max: Math.max.apply(null, values) };
}
function fmtMeanSd(s) {
  if (!s.n) return 'n/a (n=0)';
  return s.mean.toFixed(1) + ' ± ' + s.sd.toFixed(1) + '  (n=' + s.n + ', range ' + s.min + '–' + s.max + ')';
}

/**
 * The length report the round-2 ruling asks for. Brief length is exactly the
 * kind of signal a lint cannot see and a reader can: if the seeded orders run
 * systematically longer than the control orders, the word bands are being met
 * and the corpus is still not blind. Printed side by side so that is obvious.
 */
function renderLengthReport(rows) {
  const seeded = rows.filter((r) => r.kind === 'seeded');
  const controls = rows.filter((r) => r.kind === 'control');
  const lines = [];
  lines.push('| population | order words (mean ± sd) | claims words (mean ± sd) |');
  lines.push('|---|---|---|');
  lines.push('| seeded | ' + fmtMeanSd(meanSd(seeded.map((r) => r.orderWords))) + ' | ' + fmtMeanSd(meanSd(seeded.map((r) => r.claimsWords))) + ' |');
  lines.push('| control | ' + fmtMeanSd(meanSd(controls.map((r) => r.orderWords))) + ' | ' + fmtMeanSd(meanSd(controls.map((r) => r.claimsWords))) + ' |');
  lines.push('| all | ' + fmtMeanSd(meanSd(rows.map((r) => r.orderWords))) + ' | ' + fmtMeanSd(meanSd(rows.map((r) => r.claimsWords))) + ' |');
  lines.push('');
  lines.push('Bands enforced on EVERY artifact: order ' + ORDER_MIN_WORDS + '–' + ORDER_MAX_WORDS +
    ' words, claims ' + CLAIMS_MIN_WORDS + '–' + CLAIMS_MAX_WORDS + ' words (VARIANTS.md v2). A band satisfied by both');
  lines.push('populations is necessary but not sufficient: read the two means above against each other. A visible gap is a');
  lines.push('blinding finding even though nothing here failed.');
  return lines.join('\n');
}

// --------------------------------------------------------- 7. CONSTRUCTION.md

function renderConstructionMd(key, tallies, heads, rows, notes, skeletonSummary) {
  const lines = [];
  lines.push('# WO-12 SDC construction record');
  lines.push('');
  lines.push('Written by `assemble-key.js`. Records what `corpus/key.json` does not carry —');
  lines.push('narrative fields, materialization results, the generated-brief shape evidence, and');
  lines.push('the deviations the protocol asks to be recorded rather than gated on.');
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
  lines.push('## Brief length report (blinding evidence)');
  lines.push('');
  lines.push(renderLengthReport(rows));
  lines.push('');
  lines.push('## Structural-tell lint result');
  lines.push('');
  lines.push('Every brief is GENERATED from `corpus/content/<id>.json` through VARIANTS.md v2\'s');
  lines.push('one template set, and the lint below passed before anything was written.');
  lines.push('');
  lines.push('| check | result |');
  lines.push('|---|---|');
  lines.push('| distinct work-order skeletons across all ' + rows.length + ' artifacts | ' + skeletonSummary.woSkeletons + ' (must be 1) |');
  for (const v of VARIANTS) {
    if (skeletonSummary.erByVariant[v] === undefined) continue;
    lines.push('| distinct executor-report skeletons within variant ' + v + ' | ' + skeletonSummary.erByVariant[v] + ' (must be 1) |');
  }
  lines.push('| KIND values carried by only one population | ' + skeletonSummary.asymmetricKinds + ' (must be 0) |');
  lines.push('| distinct KIND values in the corpus | ' + skeletonSummary.kinds.join(', ') + ' |');
  lines.push('');
  lines.push('### The KIND ruling');
  lines.push('');
  lines.push('**KIND is declared pool-wide as `' + POOL_DECLARED_KIND + '`.** VARIANTS.md v2 keys the V3 hazard list on the');
  lines.push('artifact\'s KIND — "a property of the base commit, shared by seeds and controls alike" — but');
  lines.push('`base-pool.json` records no such property (its own `kind` field is the ARTIFACT kind, seeded/control).');
  lines.push('The value therefore comes from protocol §2.1\'s own declaration of the pool: "Base-commit pool: KIND=code,');
  lines.push('SIZE S or M, TESTED preferred".');
  lines.push('');
  lines.push('**Rationale — why a per-commit KIND would be wrong.** All 30 seeded bases are code commits, while the 54');
  lines.push('controls are drawn from a wider sweep that includes docs-only commits (`base-pool.json`\'s allocation note:');
  lines.push('"then (c) full_table non-shortlisted kind=docs S/M commits"). Deriving KIND per commit would put `docs` on');
  lines.push('controls ONLY, and since the hazard list is keyed on KIND, a V3 report carrying the two-item docs list');
  lines.push('would identify its artifact as a control at 100% precision — the round-1 CRITICAL 4 tell (type-derived');
  lines.push('hazard lines) re-created in mirror image. One pool-wide KIND gives every V3 artifact the same list, which');
  lines.push('carries no information about kind at all.');
  lines.push('');
  lines.push('`resolveKind()` prefers an explicit per-slot field (`base_kind` / `kind_class` / `commit_kind` /');
  lines.push('`classKind`) if one is ever added to the pool, and `lintKindSymmetry()` fails assembly closed if any KIND');
  lines.push('value ends up carried by only one population — so a second KIND cannot be introduced asymmetrically.');
  lines.push('');
  lines.push('## Cross-artifact base/subject collisions (disclosure, non-gating)');
  lines.push('');
  lines.push('§2.1\'s pool-ran-short allowance lets a base commit serve one seeded variant AND one control. Where that');
  lines.push('happened, the two briefs necessarily carry an identical `Base (its parent)` sha and an identical');
  lines.push('`Commit subject:` line with different heads — a cross-artifact tell for anyone who reads BOTH packets');
  lines.push('(round-1 R0 MINOR). Nothing here can remove it: the reuse is a property of the committed base-pool');
  lines.push('allocation, not of brief generation. It is listed so the reuse is visible where the briefs are, and so an');
  lines.push('adjudicator reading two packets side by side knows which pairs to discount.');
  lines.push('');
  {
    const byPair = new Map();
    for (const a of key.artifacts) {
      const k = a.base + '|' + a.commit;
      if (!byPair.has(k)) byPair.set(k, []);
      byPair.get(k).push(a);
    }
    const collisions = Array.from(byPair.values()).filter((g) => g.length > 1);
    if (!collisions.length) {
      lines.push('None — every artifact draws a distinct (base, commit) pair.');
    } else {
      lines.push('| base | subject | artifacts sharing it |');
      lines.push('|---|---|---|');
      for (const g of collisions) {
        lines.push('| ' + g[0].base.slice(0, 12) + '… | ' + g[0].subject.slice(0, 60) + ' | ' + g.map((a) => a.id + ' (' + a.kind + ', ' + a.variant + ')').join(', ') + ' |');
      }
      lines.push('');
      lines.push('**' + collisions.length + ' collision group(s).**');
    }
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
  lines.push('## Per-artifact brief content lengths');
  lines.push('');
  lines.push('| id | kind | variant | KIND | order words | claims words |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of rows) {
    lines.push('| ' + r.id + ' | ' + r.kind + ' | ' + r.variant + ' | ' + r.baseKind + ' | ' + r.orderWords + ' | ' + r.claimsWords + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

// ------------------------------------------------- legacy brief importer

const WO_BOILERPLATE = [
  /^REVIEW PACKET\b/,
  /^Change under review:/,
  /^Base \(its parent\):/,
  /^Commit subject:/,
];
const WO_BOILERPLATE_PARAGRAPH = [
  /^Intent\b.*\b(work order this change claims to implement|order this change was produced against|order below is the work order)/i,
  /^Intent\b[^.]*\bimplement\.\s*In full, the order was:?$/i,
  /^In full, the order was:?$/i,
  /^Audit the diff between base and head\b/i,
];
const WO_BARE_HEADERS = /^(ORDER:?|ORDER AS ISSUED:?|SCOPE:?|CLAIMS:?|WORK ORDER AS ISSUED:?|THE ORDER:?)$/i;

// Stripped at the LINE level, before paragraphs are flattened: `EXECUTOR
// REPORT:` ends in a colon, so a sentence splitter glues it to the STATUS
// sentence that follows and neither pattern below can then see it.
const ER_BOILERPLATE_LINE = [/^EXECUTOR REPORT:?$/i];
const ER_BOILERPLATE_SENTENCE = [
  /^STATUS:\s*DONE\b/i,
  /^The change is commit [0-9a-f]{6,40}\b/i,
  /produced this change/i,
  /no fresh executor claims exist beyond the commit message/i,
  /^Verify the diff on its own merits/i,
  /^the executor's own claims for it follow/i,
  /^Beyond that,?$/i,
];
const ER_BARE_HEADERS = /^(EXECUTOR REPORT:?|CLAIMS:?|VERIFICATION:?)$/i;

function splitParagraphs(text) {
  return text.split(/\r?\n\s*\r?\n/).map((p) => p.replace(/\r/g, '')).filter((p) => p.trim() !== '');
}
function splitSentences(text) {
  // Deliberately simple: a period or semicolon followed by whitespace, when the
  // next character starts a new word. Good enough to strip known boilerplate
  // sentences; it is never used to REWRITE prose, only to drop whole sentences
  // that match a boilerplate pattern.
  return normalizeWs(text).split(/(?<=[.;])\s+(?=[A-Z(`"'‘“-])/).filter((s) => s.trim() !== '');
}

/** Derives {order} prose from a round-1 `.wo.txt`. Never invents text. */
function importOrderFromWorkOrder(text) {
  const kept = [];
  for (const para of splitParagraphs(text)) {
    const lines = para.split('\n').filter((l) => !WO_BOILERPLATE.some((re) => re.test(l.trim())));
    if (!lines.length) continue;
    const flat = normalizeWs(lines.join(' '));
    if (!flat) continue;
    if (WO_BARE_HEADERS.test(flat)) continue;
    if (WO_BOILERPLATE_PARAGRAPH.some((re) => re.test(flat))) continue;
    // A paragraph that is boilerplate PLUS a header on the same lines (e.g.
    // "Intent: ... implement. In full, the order was:") drops entirely; one
    // that only OPENS with boilerplate keeps the remainder.
    const sentences = splitSentences(flat).filter((s) => !WO_BOILERPLATE_PARAGRAPH.some((re) => re.test(s)));
    const rebuilt = sentences.join(' ').trim();
    if (rebuilt) kept.push(rebuilt);
  }
  return kept.join(' ').trim();
}

/** Derives {claims} prose from a round-1 `.er.txt`. Never invents text. */
function importClaimsFromExecutorReport(text) {
  // Drop the hazard block outright — it is regenerated from the closed
  // vocabulary and is not claims prose.
  const cut = text.split(HAZARD_HEADER)[0];
  const kept = [];
  for (const para of splitParagraphs(cut)) {
    const lines = para.split('\n').filter((l) => !ER_BOILERPLATE_LINE.some((re) => re.test(l.trim())));
    if (!lines.length) continue;
    const bulletish = lines.some((l) => /^\s*[-*]\s+/.test(l));
    if (bulletish) {
      // Keep bullets as sentences, dropping any that is pure boilerplate.
      const bullets = [];
      let cur = null;
      for (const l of lines) {
        if (/^\s*[-*]\s+/.test(l)) { if (cur) bullets.push(cur); cur = l.replace(/^\s*[-*]\s+/, ''); }
        else if (cur !== null) cur += ' ' + l.trim();
        else if (l.trim() && !ER_BARE_HEADERS.test(l.trim())) bullets.push(l.trim());
      }
      if (cur) bullets.push(cur);
      for (const b of bullets) {
        const flat = normalizeWs(b);
        if (!flat || ER_BARE_HEADERS.test(flat)) continue;
        if (ER_BOILERPLATE_SENTENCE.some((re) => re.test(flat))) continue;
        kept.push(flat);
      }
      continue;
    }
    const flat = normalizeWs(lines.join(' '));
    if (!flat || ER_BARE_HEADERS.test(flat)) continue;
    const sentences = splitSentences(flat)
      .filter((s) => !ER_BOILERPLATE_SENTENCE.some((re) => re.test(s)))
      .filter((s) => !ER_BARE_HEADERS.test(s));
    const rebuilt = sentences.join(' ').trim();
    if (rebuilt) kept.push(rebuilt);
  }
  return kept.join(' ').replace(/\s+/g, ' ').trim();
}

function importLegacyBriefs(pool, paths) {
  // `recursive: true` on an EXISTING directory is a no-op — it never clears
  // one. Stated explicitly because this is the only mkdir this program makes
  // into corpus/content/.
  fs.mkdirSync(paths.contentDir, { recursive: true });
  // Everything already on disk before this run, so the operator is told how
  // many files were PRESERVED — not just how many seeded slots happened to be
  // skipped. After the 2026-08-31 incident, "N files were here and are still
  // here" is the number that matters, and it must include the control files
  // this importer never even considers.
  const preexisting = Array.from(snapshotContentDir(paths.contentDir).keys())
    .filter((n) => n !== CONTENT_IMPORT_REPORT_BASENAME)
    .sort();
  const written = [];
  const skippedExisting = [];
  const flagged = [];
  const noSource = [];
  for (const slot of pool.slots) {
    if (slot.kind !== 'seeded') continue;
    const target = contentPath(paths.contentDir, slot.id);
    if (fs.existsSync(target)) { skippedExisting.push(slot.id); continue; }
    const { wo, er } = briefPaths(paths.briefsDir, slot.id);
    if (!fs.existsSync(wo) || !fs.existsSync(er)) { noSource.push(slot.id); continue; }
    const order = importOrderFromWorkOrder(fs.readFileSync(wo, 'utf8'));
    const claims = importClaimsFromExecutorReport(fs.readFileSync(er, 'utf8'));
    const reasons = [];
    const ow = wordCount(order);
    const cw = wordCount(claims);
    if (ow < ORDER_MIN_WORDS) reasons.push('order is ' + ow + ' words, BELOW the ' + ORDER_MIN_WORDS + '-word floor' + (ow === 0 ? ' (the round-1 brief carried no order prose beyond the commit subject — this needs authoring, and none was invented here)' : ''));
    if (ow > ORDER_MAX_WORDS) reasons.push('order is ' + ow + ' words, ABOVE the ' + ORDER_MAX_WORDS + '-word ceiling — needs trimming');
    if (cw < CLAIMS_MIN_WORDS) reasons.push('claims is ' + cw + ' words, BELOW the ' + CLAIMS_MIN_WORDS + '-word floor' + (cw === 0 ? ' (the round-1 report made no fresh claims — this needs authoring from the commit body)' : ''));
    if (cw > CLAIMS_MAX_WORDS) reasons.push('claims is ' + cw + ' words, ABOVE the ' + CLAIMS_MAX_WORDS + '-word ceiling — needs trimming');
    const ov = findVendorTerm(order);
    if (ov) reasons.push('order names ' + JSON.stringify(ov) + ' — a vendor/model/effort/price term §2.7 forbids');
    const cv = findVendorTerm(claims);
    if (cv) reasons.push('claims names ' + JSON.stringify(cv) + ' — a vendor/model/effort/price term §2.7 forbids');
    const ol = findLeakageTerm(order);
    if (ol) reasons.push('order carries the leakage term ' + JSON.stringify(ol));
    const cl = findLeakageTerm(claims);
    if (cl) reasons.push('claims carries the leakage term ' + JSON.stringify(cl));

    guardedWriteContentFile(paths.contentDir, slot, { order, claims });
    written.push({ id: slot.id, orderWords: ow, claimsWords: cw, reasons });
    if (reasons.length) flagged.push({ id: slot.id, orderWords: ow, claimsWords: cw, reasons });
  }
  return { written, skippedExisting, flagged, noSource, preexisting };
}

function renderImportReport(result, pool) {
  const lines = [];
  lines.push('# WO-12 corpus content — legacy brief import report');
  lines.push('');
  lines.push('Written by `assemble-key.js --import-legacy-briefs` on ' + new Date().toISOString() + '.');
  lines.push('');
  lines.push('The 30 SEEDED artifacts\' round-1 briefs were mined for their ORDER-like and');
  lines.push('CLAIMS-like prose: template lines stripped, the bespoke constraint / scope / claim');
  lines.push('text kept. **No prose was invented.** Where the round-1 brief carried none — the');
  lines.push('plain nine-line form, whose only stated intent was the commit subject itself — the');
  lines.push('derived field is empty and is listed below for authoring.');
  lines.push('');
  lines.push('Control content files are authored separately and are never touched by this');
  lines.push('importer; nor is any content file that already exists.');
  lines.push('');
  lines.push('| outcome | count |');
  lines.push('|---|---|');
  lines.push('| seeded slots in the pool | ' + pool.slots.filter((s) => s.kind === 'seeded').length + ' |');
  lines.push('| content files written | ' + result.written.length + ' |');
  lines.push('| already present, left untouched byte-for-byte | ' + (result.preexisting || []).length + ' |');
  lines.push('| …of those, seeded slots this import would otherwise have written | ' + result.skippedExisting.length + ' |');
  lines.push('| no round-1 brief to import from | ' + result.noSource.length + ' |');
  lines.push('| **needing a human/agent pass** | **' + result.flagged.length + '** |');
  lines.push('');
  if (result.skippedExisting.length) {
    lines.push('Left alone (already present): ' + result.skippedExisting.join(', '));
    lines.push('');
  }
  if (result.noSource.length) {
    lines.push('No round-1 brief found: ' + result.noSource.join(', '));
    lines.push('');
  }
  lines.push('## Needing a human/agent pass');
  lines.push('');
  if (!result.flagged.length) {
    lines.push('None — every imported file lands inside the word bands and names no vendor.');
  } else {
    lines.push('These files WERE written (nothing is lost), but assembly will fail on them until');
    lines.push('they are revised: the word bands and the vendor lint are hard failures.');
    lines.push('');
    lines.push('| id | order words | claims words | what to fix |');
    lines.push('|---|---|---|---|');
    for (const f of result.flagged) {
      lines.push('| ' + f.id + ' | ' + f.orderWords + ' | ' + f.claimsWords + ' | ' + f.reasons.join('; ') + ' |');
    }
  }
  lines.push('');
  lines.push('## All imported files');
  lines.push('');
  lines.push('| id | order words | claims words | status |');
  lines.push('|---|---|---|---|');
  for (const w of result.written) {
    lines.push('| ' + w.id + ' | ' + w.orderWords + ' | ' + w.claimsWords + ' | ' + (w.reasons.length ? 'NEEDS PASS' : 'ok') + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

// ------------------------------------------------------------------- main

/**
 * Materializes every seeded variant and returns {id -> head}; a control's head
 * is its own real commit and needs no materialization.
 *
 * build-corpus.js is driven through its CLI (so `--build-corpus <path>` keeps
 * meaning what it says) and it reads the artifact record out of a key file —
 * but the real key.json is NOT written until the lints pass (round-2, MAJOR 3),
 * so it cannot be the file passed here. The in-memory key goes to a scratch
 * file for the duration of the materialization and is removed afterwards.
 * Nothing is left in the corpus directory.
 */
function materializeHeads(key, paths, args) {
  const cloneRoot = args.cloneRoot ? path.resolve(args.cloneRoot) : fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-wo12-assemble-'));
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestra-wo12-key-'));
  const scratchKey = path.join(scratch, 'key.json');
  fs.writeFileSync(scratchKey, JSON.stringify(key, null, 2) + '\n', 'utf8');
  const heads = {};
  try {
    for (const a of key.artifacts) {
      if (a.kind !== 'seeded') { heads[a.id] = a.commit; continue; }
      const buildArgs = ['--id', a.id, '--key', scratchKey, '--corpus-dir', paths.corpusDir, '--patches-dir', paths.corpusDir, '--clone-root', cloneRoot];
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
  } finally {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  }
  return heads;
}

/**
 * Generates every brief and runs every lint, in memory. Returns
 * {rows, findings, skeletonSummary}. NOTHING is written here — that is the
 * whole point (round-2, MAJOR 3).
 */
function generateAndLint(key, heads, pool, paths) {
  const slotById = new Map(pool.slots.map((s) => [s.id, s]));
  const findings = [];
  const rows = [];
  for (const a of key.artifacts) {
    const head = heads[a.id];
    if (!head) fail(a.id + ': no materialized head available for brief generation');
    const content = loadContent(paths.contentDir, a.id);
    const baseKind = resolveKind(slotById.get(a.id));
    const counts = wordBandLint(a.id, content, findings);
    const briefs = generateBriefs(a, head, content, baseKind);

    leakageLint('briefs/' + a.id + '.wo.txt', briefs.wo, a.subject, findings);
    leakageLint('briefs/' + a.id + '.er.txt', briefs.er, a.subject, findings);
    vendorLint('briefs/' + a.id + '.wo.txt', briefs.wo, a, head, findings);
    vendorLint('briefs/' + a.id + '.er.txt', briefs.er, a, head, findings);
    hazardLint('briefs/' + a.id + '.er.txt', briefs.er, baseKind, a.variant, findings);

    rows.push({
      id: a.id, kind: a.kind, variant: a.variant, baseKind, head,
      orderWords: counts.order, claimsWords: counts.claims,
      wo: briefs.wo, er: briefs.er,
      woSkeleton: skeletonize(briefs.wo, a, head),
      erSkeleton: skeletonize(briefs.er, a, head),
    });
  }

  structuralTellLint(rows, findings);
  lintKindSymmetry(rows, findings);

  const erByVariant = {};
  for (const v of VARIANTS) {
    const inVariant = rows.filter((r) => r.variant === v);
    if (inVariant.length) erByVariant[v] = new Set(inVariant.map((r) => r.erSkeleton)).size;
  }
  const kindPopulations = new Map();
  for (const r of rows) {
    if (!kindPopulations.has(r.baseKind)) kindPopulations.set(r.baseKind, new Set());
    kindPopulations.get(r.baseKind).add(r.kind);
  }
  const skeletonSummary = {
    woSkeletons: new Set(rows.map((r) => r.woSkeleton)).size,
    erByVariant,
    kinds: Array.from(kindPopulations.keys()).sort(),
    asymmetricKinds: Array.from(kindPopulations.values()).filter((s) => s.size === 1).length,
  };
  return { rows, findings, skeletonSummary };
}

function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const paths = resolvePaths(args);
  const pool = loadJson(paths.poolPath, 'base-pool.json');
  if (!pool || !Array.isArray(pool.slots)) fail('base-pool.json at ' + paths.poolPath + ' has no `slots` array');

  // corpus/content/ is INPUT to every mode. Snapshotted before anything runs
  // and re-asserted before every exit, so no path can lose another agent's
  // control file without the run failing loudly. See the guards above.
  const contentBefore = snapshotContentDir(paths.contentDir);

  if (args.importLegacyBriefs) {
    const result = importLegacyBriefs(pool, paths);
    writeAtomic(paths.importReportPath, renderImportReport(result, pool));
    // IMPORT-REPORT.md is this program's OWN artifact in that directory and is
    // rewritten on every import; it is excluded from the preservation set
    // rather than being allowed to trip it. Every other file — seeded and
    // control alike — must come through untouched.
    const guarded = new Map(contentBefore);
    guarded.delete(CONTENT_IMPORT_REPORT_BASENAME);
    assertContentDirPreserved(
      paths.contentDir, guarded,
      result.written.map((w) => w.id + '.json').concat([CONTENT_IMPORT_REPORT_BASENAME]),
      '--import-legacy-briefs'
    );
    process.stdout.write('assemble-key --import-legacy-briefs:\n');
    process.stdout.write('  wrote ' + result.written.length + ' content file(s) into ' + paths.contentDir + '\n');
    process.stdout.write('  left ' + result.preexisting.length + ' existing content file(s) untouched, byte-for-byte' +
      (result.preexisting.length ? ' (' + result.preexisting.join(', ') + ')' : '') + '\n');
    if (result.skippedExisting.length) {
      process.stdout.write('    of those, ' + result.skippedExisting.length + ' were seeded slots this import would otherwise have written: ' +
        result.skippedExisting.join(', ') + '\n');
    }
    if (result.noSource.length) process.stdout.write('  ' + result.noSource.length + ' seeded slot(s) had no round-1 brief: ' + result.noSource.join(', ') + '\n');
    process.stdout.write('  ' + result.flagged.length + ' file(s) need a human/agent pass:\n');
    for (const f of result.flagged) {
      process.stdout.write('    NEEDS PASS  ' + f.id + ' (order ' + f.orderWords + 'w, claims ' + f.claimsWords + 'w): ' + f.reasons.join('; ') + '\n');
    }
    process.stdout.write('  report: ' + paths.importReportPath + '\n');
    return;
  }

  const missing = checkRequirements(pool, paths);

  if (args.checkOnly) {
    if (missing.length) {
      process.stdout.write('assemble-key --check-only: ' + missing.length + ' item(s) missing:\n');
      for (const m of missing) process.stdout.write('  MISSING  ' + m + '\n');
      assertContentDirPreserved(paths.contentDir, contentBefore, [], '--check-only');
      process.exitCode = 1;
      return;
    }
    // Everything is present — additionally report any brief on disk whose
    // bytes differ from what generation produces. A hand-edited brief is not
    // an input, it is drift, and it is refused (round 2).
    const { key } = buildKeyAndNotes(pool, paths);
    const heads = materializeHeads(key, paths, args);
    const { rows, findings } = generateAndLint(key, heads, pool, paths);
    const drifted = [];
    for (const r of rows) {
      const { wo, er } = briefPaths(paths.briefsDir, r.id);
      if (!fs.existsSync(wo) || fs.readFileSync(wo, 'utf8') !== r.wo) drifted.push(r.id + '.wo.txt');
      if (!fs.existsSync(er) || fs.readFileSync(er, 'utf8') !== r.er) drifted.push(r.id + '.er.txt');
    }
    process.stdout.write('assemble-key --check-only: nothing missing — all ' + pool.slots.length + ' slots have their required inputs.\n');
    process.stdout.write(drifted.length
      ? '  ' + drifted.length + ' brief file(s) DIFFER from generation and will be overwritten: ' + drifted.join(', ') + '\n'
      : '  every brief on disk matches generation exactly.\n');
    if (findings.length) {
      process.stdout.write('  ' + findings.length + ' lint finding(s) — assembly WOULD FAIL:\n');
      for (const f of findings) process.stdout.write('    ' + f + '\n');
      process.exitCode = 1;
    } else {
      process.stdout.write('  every lint passes.\n');
    }
    assertContentDirPreserved(paths.contentDir, contentBefore, [], '--check-only');
    return;
  }

  if (missing.length) {
    fail(missing.length + ' item(s) missing — the key is all-or-nothing (protocol §2.3):\n' + missing.map((m) => '  ' + m).join('\n'));
  }

  // 1-2. key + notes, in memory.
  const { key, notes } = buildKeyAndNotes(pool, paths);
  // 3. materialize (heads are needed before a brief can name one).
  const heads = materializeHeads(key, paths, args);
  // 4-5. generate every brief and lint it, all in memory.
  const { rows, findings, skeletonSummary } = generateAndLint(key, heads, pool, paths);
  if (findings.length) {
    fail('assembly REFUSED — ' + findings.length + ' lint finding(s). Nothing was written (the key is all-or-nothing, ' +
      'protocol §2.3, and round-2 R0 MAJOR 3 required the lints to run BEFORE key.json is sealed):\n' +
      findings.map((f) => '  ' + f).join('\n'));
  }

  // 6. write, in dependency order, each file atomically.
  fs.mkdirSync(paths.briefsDir, { recursive: true });
  for (const r of rows) {
    const { wo, er } = briefPaths(paths.briefsDir, r.id);
    writeAtomic(wo, r.wo);
    writeAtomic(er, r.er);
  }
  writeAtomic(paths.keyPath, JSON.stringify(key, null, 2) + '\n');
  const tallies = computeTallies(key);
  notes.targetWarnings = tallies.warnings;
  writeAtomic(paths.notesPath, JSON.stringify(notes, null, 2) + '\n');
  writeAtomic(paths.constructionMdPath, renderConstructionMd(key, tallies, heads, rows, notes, skeletonSummary));

  // A full assembly READS every content file and writes NONE of them.
  assertContentDirPreserved(paths.contentDir, contentBefore, [], 'a full assembly');

  process.stdout.write('assemble-key: generated ' + (rows.length * 2) + ' brief file(s) and sealed ' + key.artifacts.length +
    ' artifacts (' + tallies.seededCount + ' seeded + ' + tallies.controlCount + ' control) into ' + paths.keyPath + '\n');
  process.stdout.write(renderTalliesTable(tallies) + '\n');
  process.stdout.write('\nStructural-tell lint: ' + skeletonSummary.woSkeletons + ' work-order skeleton(s), ' +
    VARIANTS.filter((v) => skeletonSummary.erByVariant[v] !== undefined).map((v) => v + '=' + skeletonSummary.erByVariant[v]).join(' ') +
    ' executor-report skeleton(s) per variant, ' + skeletonSummary.asymmetricKinds + ' one-population KIND(s).\n');
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
  ORDER_MIN_WORDS, ORDER_MAX_WORDS, CLAIMS_MIN_WORDS, CLAIMS_MAX_WORDS,
  HAZARD_VOCABULARY, HAZARD_HEADER, POOL_DECLARED_KIND,
  LEAKAGE_PATTERNS, VENDOR_PATTERNS,
  findLeakageTerm, findVendorTerm,
  normalizeWs, wordCount, wrapProse,
  renderWorkOrder, renderExecutorReport, generateBriefs, hazardsFor, resolveKind, skeletonize,
  parseArgs, resolvePaths, checkRequirements, loadContent, buildKeyAndNotes, contentPath,
  guardedWriteContentFile, snapshotContentDir, assertContentDirPreserved, CONTENT_IMPORT_REPORT_BASENAME,
  leakageLint, vendorLint, hazardLint, wordBandLint, structuralTellLint, lintKindSymmetry,
  isSubjectLine, isV2AuthorLine,
  computeTallies, renderTalliesTable, renderConstructionMd, renderLengthReport, meanSd,
  importOrderFromWorkOrder, importClaimsFromExecutorReport, importLegacyBriefs, renderImportReport,
  generateAndLint, materializeHeads,
};

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write('assemble-key: ' + ((e && e.message) || e) + '\n');
    process.exit(1);
  }
}
