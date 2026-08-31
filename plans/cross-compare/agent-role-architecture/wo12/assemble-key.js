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
const buildCorpusLib = require(path.join(HERE, 'build-corpus.js'));
const TYPES = ['CV', 'OO', 'LC', 'FT', 'HF', 'RC'];
const VARIANTS = ['V1', 'V2', 'V3'];

// --------------------------------------------------------------- word bands

// VARIANTS.md v2 § "Content rules". Enforced on EVERY artifact, both kinds —
// a length band that applied to only one population would itself be a tell.
const ORDER_MIN_WORDS = 60;
const ORDER_MAX_WORDS = 160;
const CLAIMS_MIN_WORDS = 30;
const CLAIMS_MAX_WORDS = 100;

// ------------------------------------------------- population balance (round 3)
//
// The word BANDS above are satisfied by both populations and are not the test.
// Both round-2 delta reviews found the same residual tell and called it
// blocking: the corpus's own construction record printed
//
//     seeded  144.3 ± 11.7 order words   control 128.3 ± 18.3
//
// and shipped anyway, under a docstring that had already declared "a visible gap
// is a blinding finding". Measured over the sealed corpus, `ORDER < 121 words`
// identified a CONTROL at 100% precision across 21 of 54 controls. A blind
// re-read by a fresh evaluator, given only 24 brief files, then separated the
// populations at 83% — naming "density of hard absolute constraints in the
// ORDER" as its top signal and going 3 for 3 on its confident bets.
//
// So two distributional properties are now HARD FAILURES, not report lines:
//   - mean word count, seeded vs control, within MEAN_WORD_TOLERANCE for both
//     `order` and `claims`;
//   - a HARDNESS PROXY — how many absolute-constraint words the ORDER carries —
//     whose seeded/control ratio must sit inside [HARDNESS_RATIO_MIN,
//     HARDNESS_RATIO_MAX]. The register, not just the length.
// Both are reported in CONSTRUCTION.md's length report either way, so the
// numbers stay visible even when they pass.
const MEAN_WORD_TOLERANCE = 6;
const HARDNESS_RATIO_MIN = 0.8;
const HARDNESS_RATIO_MAX = 1.25;

// The blind evaluator's own vocabulary, as it described the signal: absolute
// constraint words. Whole-word, case-insensitive; `byte-identical` is hyphenated
// so it is matched as a unit.
const HARDNESS_TERMS_RE = /\b(?:must|never|exactly|only|byte-identical|unchanged|forbid(?:s|den|ding)?)\b/gi;

function hardnessScore(text) {
  const m = String(text || '').match(HARDNESS_TERMS_RE);
  return m ? m.length : 0;
}

// The round-3 R0 NIT: `only` is by far the most common of the seven terms in
// ordinary English, so a ratio of 1.0016 across two independently authored
// populations is "a very tidy number for a seven-word bag-of-terms". The
// sensitivity check the reviewer asked for: the same proxy with `only` removed.
// BOTH ratios are gated, so parity cannot rest on the one term that arrives by
// accident.
const HARDNESS_TERMS_STRICT_RE = /\b(?:must|never|exactly|byte-identical|unchanged|forbid(?:s|den|ding)?)\b/gi;
function hardnessScoreStrict(text) {
  const m = String(text || '').match(HARDNESS_TERMS_STRICT_RE);
  return m ? m.length : 0;
}

// ----------------------------------------------------- label tells (round 4)
//
// A blind evaluator separated the populations on a purely LEXICAL label that
// only seeds carried: `IN SCOPE:` / `Constraint:` appeared inside the ORDER
// prose of 5 seeded content files and 0 controls. Nothing upstream could see
// it — the word bands passed, the register (hardness) matched, and
// `skeletonize` collapses the whole ORDER block to one `<ORDER>` token, so the
// structural-tell lint is blind to anything INSIDE the prose by construction.
//
// A label is an inline section heading: a capitalized phrase of one to four
// words followed by a colon, at a line start or after a sentence end —
// `Constraint:`, `IN SCOPE:`, `Note:`, `Verification:`, `Suites:`.
//
// The rule is ZERO TOLERANCE: any such label in `order` or `claims` is a hard
// failure. The first draft of this lint asked only that each label appear in
// BOTH populations or NEITHER, which sounds weaker but is unusable in practice:
// a scan of all 84 content files found 15 distinct labels and EVERY ONE was
// one-population — `Verification:` on 3 seeds, `Suites:` on 7 controls, and a
// dozen one-offs like `Prove it:` and `The diff is small:`. Balancing a
// long tail of bespoke labels across two populations is not achievable; not
// writing them is. Nothing is exempt — the generated template's own headings
// (`ORDER:`, `CLAIMS:`, `Commit subject:`) live in the template, not in the
// content fields this lint reads.
const LABEL_RE = /(^|[\r\n]|[.!?]["'’”)\]]?[ \t])[ \t]*([A-Z][A-Za-z -]{1,24}):/g;
const LABEL_MAX_WORDS = 4;

/** Every distinct inline label in a piece of content prose. */
function extractLabels(text) {
  const out = new Set();
  const s = String(text || '');
  let m;
  LABEL_RE.lastIndex = 0;
  while ((m = LABEL_RE.exec(s))) {
    const label = m[2].trim();
    if (!label) continue;
    if (label.split(/\s+/).length > LABEL_MAX_WORDS) continue; // a clause, not a heading
    out.add(label);
  }
  return out;
}

function contentLabels(content) {
  const out = new Set();
  for (const label of extractLabels(content.order)) out.add(label);
  for (const label of extractLabels(content.claims)) out.add(label);
  return Array.from(out).sort();
}

/**
 * The label-tell lint (round 4). ZERO TOLERANCE: every inline label is a hard
 * failure naming the file and the token.
 *
 * Why not "both populations or neither": that was the first rule, and a scan of
 * the sealed corpus refuted it — 15 distinct labels, all 15 carried by exactly
 * one population. Labels are bespoke to the change each brief describes, so
 * they do not repeat across the populations and cannot be balanced. The lint
 * that can actually be satisfied is the one that says: don't write them.
 *
 * Nothing upstream can see this. `skeletonize()` collapses the whole ORDER
 * block to a single `<ORDER>` token, so the structural-tell lint is blind to
 * anything inside the prose by construction; the word bands and the hardness
 * ratio are distributional and a single label is decisive.
 */
function labelTellLint(rows, findings) {
  const byLabel = new Map();
  for (const r of rows) {
    for (const label of (r.labels || [])) {
      if (!byLabel.has(label)) byLabel.set(label, { seeded: [], control: [] });
      const bucket = byLabel.get(label)[r.kind];
      if (bucket) bucket.push(r.id);
      findings.push('label tell: content/' + r.id + '.json (' + r.kind + ') carries the inline label ' +
        JSON.stringify(label + ':') + ' in its `order`/`claims` prose. Inline labels are forbidden outright — they are ' +
        'bespoke to the change, so they never balance across the two populations, and a single one is enough for a reader ' +
        'to key on. Fold the labelled text into ordinary prose (write the constraint as a sentence, not as a heading).');
    }
  }
  return { byLabel, labelled: rows.filter((r) => (r.labels || []).length).map((r) => r.id) };
}

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

// VARIANTS.md v3: the STATUS line names no sha — "the commit at HEAD", not
// "commit <HEAD>". Defined once and used by BOTH the renderer and the V2
// vendor-lint exemption, so the two cannot drift apart: the round-6 change
// broke the exemption precisely because the exemption carried its own copy of
// the sentence, which still had the sha in it.
const STATUS_PREFIX = 'STATUS: DONE. The change is the commit at HEAD. ';
const V1_STATUS_LINE = STATUS_PREFIX + V1_AUTHOR_SENTENCE;
const V2_STATUS_LINE = STATUS_PREFIX + V2_AUTHOR_TAIL;

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
    // VARIANTS.md v3: NO SHA. The runner is handed --base-ref/--head-ref out of
    // band (run-lane.js), so the packet never needs to name either one, and
    // naming them was a 24/24 oracle — see HEX_IN_BRIEF_RE.
    'Change under review: the commit checked out at HEAD in this checkout,',
    'compared against its parent.',
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
    lines.push(V2_STATUS_LINE);
    lines.push('produced this change.');
  } else {
    lines.push(V1_STATUS_LINE);
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
    // Round-3 NIT: mask the SUBJECT first. The round-2 order wrote `<HEAD>` /
    // `<BASE>` into the line before substituting the subject, so a subject that
    // happened to be a substring of those tokens corrupted the mask
    // (`Base (its parent):   <BA<SUBJECT>E>`, reproducible with a
    // one-character subject). Real subjects are long sentences, and the
    // corruption differed per artifact so it would have made the lint FIRE
    // rather than pass — but ordering the substitutions correctly costs
    // nothing and removes the trap.
    if (artifact.subject) line = line.split(artifact.subject).join('<SUBJECT>');
    line = line.split(head).join('<HEAD>');
    if (artifact.base) line = line.split(artifact.base).join('<BASE>');
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
    // Every id here is interpolated into a filesystem path (`<id>.patch`,
    // `<id>.seed.json`, `content/<id>.json`, `briefs/<id>.wo.txt`). Validated
    // with build-corpus's own rule so one shape is enforced everywhere
    // (round-3, cross-vendor CRITICAL).
    buildCorpusLib.assertSafeArtifactId(slot && slot.id, 'base-pool.json slot');
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
// `head` is no longer part of the line (VARIANTS.md v3) — the parameter stays
// for call-site compatibility and is deliberately unused.
function isV2AuthorLine(line, head, variant) {
  return variant === 'V2' && line === V2_STATUS_LINE;
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

// ------------------------------------------------------ sha linkage (round 6)
//
// Blind test #2 scored 24/24 — a perfect classification — without reading a
// word of the prose, purely by linking packets through their shas. The round-2
// templates printed three of them:
//
//     Change under review: commit <HEAD>
//     Base (its parent):   <BASE>
//     STATUS: DONE. The change is commit <HEAD>.
//
// Two linkages follow immediately. A CONTROL's head is, by construction, some
// other packet's base — the corpus draws parent/child pairs out of one history
// — so the graph of "this packet's base equals that packet's head" wires the 84
// packets into chains that identify which are which. And the 10 reused-base
// pairs (§2.1's pool-ran-short allowance) print the SAME base and the SAME
// `Commit subject:` under two DIFFERENT heads, which names the synthetic one
// outright.
//
// The fix is that a packet does not need a sha at all: `run-lane.js` hands the
// runner `--base-ref` and `--head-ref` out of band, and the checkout is already
// pinned at the head. So every sha is removed from the brief text and this lint
// keeps them out.
//
// The pattern is deliberately broad — 7 to 40 hex characters, case-insensitive,
// whole token — because an abbreviated sha is as good a join key as a full one.
// It will also match an ordinary English word made only of a-f (`defaced`,
// `acceded`, `effaced`); that is an accepted cost, the failure names the token
// and the line, and a content author can re-word.
const HEX_IN_BRIEF_RE = /\b[0-9a-f]{7,40}\b/gi;

function hexLint(label, text, findings) {
  const lines = String(text || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    HEX_IN_BRIEF_RE.lastIndex = 0;
    const hits = lines[i].match(HEX_IN_BRIEF_RE);
    if (!hits) continue;
    for (const hit of hits) {
      findings.push(label + ':' + (i + 1) + ': the token ' + JSON.stringify(hit) + ' looks like a commit sha ' +
        '(7-40 hex characters). No brief may name a sha: a control\'s head is another packet\'s base, and the reused-base ' +
        'pairs share a base and a subject under two heads, so shas link the packets into a graph that classified the whole ' +
        'corpus 24/24 in blind test #2. The runner receives --base-ref/--head-ref out of band; the packet does not need them.');
    }
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
  if (got.join(' | ') !== expected.join(' | ')) {
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
 * The population-balance lint (round 3, both delta records). Hard failure —
 * the round-2 code computed these numbers, printed them, and shipped a visible
 * gap. See MEAN_WORD_TOLERANCE above for why this is a gate rather than a note.
 */
function populationBalanceLint(rows, findings) {
  const seeded = rows.filter((r) => r.kind === 'seeded');
  const controls = rows.filter((r) => r.kind === 'control');
  if (!seeded.length || !controls.length) return null; // nothing to balance

  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const sOrder = mean(seeded.map((r) => r.orderWords));
  const cOrder = mean(controls.map((r) => r.orderWords));
  const sClaims = mean(seeded.map((r) => r.claimsWords));
  const cClaims = mean(controls.map((r) => r.claimsWords));
  const sHard = mean(seeded.map((r) => r.orderHardness));
  const cHard = mean(controls.map((r) => r.orderHardness));
  const sHardStrict = mean(seeded.map((r) => r.orderHardnessStrict || 0));
  const cHardStrict = mean(controls.map((r) => r.orderHardnessStrict || 0));

  if (Math.abs(sOrder - cOrder) > MEAN_WORD_TOLERANCE) {
    findings.push('population balance: mean ORDER words differ by ' + Math.abs(sOrder - cOrder).toFixed(1) +
      ' (seeded ' + sOrder.toFixed(1) + ', control ' + cOrder.toFixed(1) + '), above the ' + MEAN_WORD_TOLERANCE +
      '-word tolerance. Length alone separated the populations in round 2 (ORDER < 121 words was a control at 100% precision).');
  }
  if (Math.abs(sClaims - cClaims) > MEAN_WORD_TOLERANCE) {
    findings.push('population balance: mean CLAIMS words differ by ' + Math.abs(sClaims - cClaims).toFixed(1) +
      ' (seeded ' + sClaims.toFixed(1) + ', control ' + cClaims.toFixed(1) + '), above the ' + MEAN_WORD_TOLERANCE + '-word tolerance.');
  }
  // The hardness ratio. A zero on either side is itself the extreme case of an
  // imbalance, so it fails rather than dividing.
  let ratio = null;
  if (cHard === 0 || sHard === 0) {
    if (sHard !== cHard) {
      findings.push('population balance: the ORDER hardness proxy is ' + sHard.toFixed(2) + ' (seeded) vs ' + cHard.toFixed(2) +
        ' (control) — one population carries absolute-constraint language and the other carries none, which is the register ' +
        'tell a blind reader used to separate them at 83%.');
    }
  } else {
    ratio = sHard / cHard;
    if (ratio < HARDNESS_RATIO_MIN || ratio > HARDNESS_RATIO_MAX) {
      findings.push('population balance: the ORDER hardness proxy ratio is ' + ratio.toFixed(2) +
        ' (seeded ' + sHard.toFixed(2) + ' vs control ' + cHard.toFixed(2) + ' absolute-constraint words per order), outside [' +
        HARDNESS_RATIO_MIN + ', ' + HARDNESS_RATIO_MAX + ']. "Density of hard absolute constraints in the ORDER" was the ' +
        'top-ranked signal in the round-2 blind read.');
    }
  }
  // The `only`-free sensitivity check (round-3 NIT), gated on the same band.
  let ratioStrict = null;
  if (cHardStrict === 0 || sHardStrict === 0) {
    if (sHardStrict !== cHardStrict) {
      findings.push('population balance: the ORDER hardness proxy WITHOUT the term `only` is ' + sHardStrict.toFixed(2) +
        ' (seeded) vs ' + cHardStrict.toFixed(2) + ' (control) — one population carries the strict absolute-constraint ' +
        'vocabulary and the other does not. `only` is common in ordinary prose, so parity that depends on it is not parity.');
    }
  } else {
    ratioStrict = sHardStrict / cHardStrict;
    if (ratioStrict < HARDNESS_RATIO_MIN || ratioStrict > HARDNESS_RATIO_MAX) {
      findings.push('population balance: the ORDER hardness ratio WITHOUT the term `only` is ' + ratioStrict.toFixed(2) +
        ' (seeded ' + sHardStrict.toFixed(2) + ' vs control ' + cHardStrict.toFixed(2) + '), outside [' +
        HARDNESS_RATIO_MIN + ', ' + HARDNESS_RATIO_MAX + ']. The headline ratio of ' + (ratio === null ? 'n/a' : ratio.toFixed(2)) +
        ' is carried by `only`, which arrives by accident in ordinary prose.');
    }
  }
  return { sOrder, cOrder, sClaims, cClaims, sHard, cHard, ratio, sHardStrict, cHardStrict, ratioStrict };
}

// ------------------------------------------------- distribution (round 5)
//
// Round 4 gated three MEANS and they passed — Δmean ORDER 3.20, Δmean CLAIMS
// 1.84, hardness ratio 1.0016 — while the tell simply moved into the TAILS and
// the VOCABULARY, where nothing looked. The round-3 R0 review built a
// seven-feature disjunction that identified 25 of 30 seeds at 100% precision
// with zero control false positives: WIDER coverage than the round-2 tell the
// means gate had replaced.
//
// The mechanism was the authoring instruction itself. Controls were re-authored
// into a narrow band (135–160 order words, 65–95 claims words) while the 30
// seeds kept the round-2 spread, so "outside the control band" became an
// exclusively seeded signature: ORDER < 135 fired on 8 seeds and 0 controls,
// CLAIMS < 65 on 8/0, hardness 0 on 3/0, hardness ≥ 4 on 7/0. Two more were
// purely lexical and needed no distribution at all — backticks appeared in 10
// seeded orders and 0 controls, and "leave … alone" / "and nothing else" in 15
// controls and 0 seeds.
//
// So a mean is not enough. These five gates check the shape of the two
// distributions, not just their centres, and two of them are vocabulary rather
// than arithmetic.
const RANGE_TOLERANCE_WORDS = 8;   // (1) min-vs-min and max-vs-max, per field
const SD_RATIO_MIN = 0.6;          // (1) dispersion parity
const SD_RATIO_MAX = 1.6;
const DIGIT_DENSITY_TOLERANCE = 1.5; // (3) digits per 100 words
// (4) Round-5 recalibration, after the first pass fired on 133 3-grams over the
// sealed corpus. The strongest were `"the band record"` (9 controls),
// `"delta re-review order"`, `"report as new files"`, `"with zero deletions"` —
// none of which is a writing habit. They are the SUBJECT MATTER of the control
// commits, and the control pool deliberately includes 24 docs/records commits
// while all 30 seeded bases are code (base-pool.json's allocation). A phrasing
// pass cannot remove them without misdescribing what the commits did, so the
// rule was measuring the pool rather than the authorship.
//
// Retuned to catch a shared PHRASE rather than a shared TOPIC: a 3-gram counts
// only when it carries at least two content words, and it fails only at a
// document frequency of 6+ in one population and 0 in the other. The 4-5 band
// is still computed and PUBLISHED — it is evidence for the topic-asymmetry
// disclosure — but it does not fail the assembly.
// (6) UNIGRAM exclusivity — amendment (xii). The 3-gram gate passes with zero
// violations while single WORDS separate the populations far more sharply:
// `deletions` 0 seeds / 13 controls, `confirm` 0/12, `else` 0/12, `insertions`
// 0/11, `touching` 0/10, `protocol` 8/0. A habit that varies its phrasing
// ("50 insertions and 31 deletions" / "a substantial batch of insertions and far
// fewer deletions") never produces a shared 3-gram and always produces a shared
// unigram, so the 3-gram window was looking past the strongest evidence.
//
// `else` is the specific proof that the round-5 idiom fix was a string edit
// rather than a habit fix: the literal `and nothing else` is 0/0 in both
// populations and passes, while `with nothing else touched`, `nowhere else`,
// `anything else`, `anywhere else` are 12 controls and 0 seeds.
const UNIGRAM_MIN_LENGTH = 4;      // (6) shorter words are function words
const UNIGRAM_MIN_FILES = 8;       // (6) document frequency that FAILS
const UNIGRAM_REPORT_MIN_FILES = 5; // (6) document frequency that is REPORTED
const UNIGRAM_FINDINGS_SHOWN = 25;

const NGRAM_MIN_CONTENT_WORDS = 2; // (4) stopwords and bare numbers do not count
const NGRAM_MIN_FILES = 6;         // (4) document frequency that FAILS
const NGRAM_REPORT_MIN_FILES = 4;  // (4) document frequency that is merely REPORTED
const NGRAM_FINDINGS_SHOWN = 40;   // (4) cap on individually-listed n-grams; the total is always stated
const IDIOM_RATIO_MIN = 0.5;       // (5)
const IDIOM_RATIO_MAX = 2.0;

// (5) Phrases the round-3 review found split cleanly between the populations,
// plus the round-2 register idioms. "leave … alone" is matched with a short gap
// because the corpus spells it "leave the guard alone" / "leave it alone".
const IDIOMS = [
  { label: 'leave … alone', re: /\bleave\b[^.;]{0,30}?\balone\b/gi },
  { label: 'and nothing else', re: /\band nothing else\b/gi },
  { label: 'as it stands', re: /\bas it stands\b/gi },
  { label: 'must never', re: /\bmust never\b/gi },
  { label: 'byte-identical', re: /\bbyte-identical\b/gi },
];

// (4) A 3-gram of nothing but stopwords carries no authorial signature, so it is
// not evidence of anything and would only produce noise.
const NGRAM_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'at', 'by', 'from', 'with', 'as',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its', 'this', 'that', 'these', 'those',
  'there', 'their', 'they', 'we', 'you', 'he', 'she', 'has', 'have', 'had', 'do', 'does', 'did',
  'will', 'would', 'can', 'could', 'should', 'may', 'might', 'so', 'than', 'then', 'if', 'but',
  'not', 'no', 'any', 'all', 'each', 'both', 'into', 'out', 'up', 'down', 'over', 'under', 'when',
  'while', 'where', 'which', 'who', 'what', 'how', 'why', 'one', 'two', 'more', 'most', 'other',
]);

// ------------------------------------------------- sentence shape (round 7)
//
// Protocol amendment (xii). Rounds 3 and 5 gated the word TOTALS — floors,
// ceilings, sd — and the separation moved one level down, into how those words
// are divided into sentences. Nothing measured that, and it was the strongest
// signal in the corpus: the shortest sentence in a packet separated the
// populations at Cohen's d = -1.80, `minSent >= 14` was 26 artifacts and all 26
// controls, and a style-only classifier using no topic word and no digit
// reached 90% precision / 90% recall under leave-one-out CV.
//
// The mechanism was legible without arithmetic: seeded packets land a short
// emphatic sentence ("Done." appeared in 4 seeded packets and 0 controls; of the
// 26 artifacts whose shortest sentence is <= 6 words, 22 were seeded) while
// control packets are written in long measured ones.
//
// Two gates follow. A FLOOR on every sentence removes the punchy register
// outright; a comparison of the per-population shortest-sentence MEANS catches
// the same asymmetry arriving in a subtler form.
const MIN_SENTENCE_WORDS = 8;
const SHORTEST_SENTENCE_MEAN_TOLERANCE = 3;

// Sentence splitting has to survive this corpus's own prose, which is full of
// dotted tokens: `install.js`, `tests/quartermaster.test.js`, `.cmd`,
// `orchestra.json`, version numbers. So a split happens only at `[.!?]`
// followed by whitespace-then-an-uppercase-letter (or a quote/bracket then an
// uppercase letter), or at end of text. `install.js runs` never splits, because
// `r` is lowercase; `…refusing. The next` does.
const SENTENCE_SPLIT_RE = /([.!?]["'’”)\]]?)\s+(?=["'“(\[]?[A-Z])/g;

// Named `splitIntoSentences`, not `splitSentences`: the legacy-brief importer
// further down already owns that name, and a second definition would silently
// replace it, breaking --import-legacy-briefs.
function splitIntoSentences(text) {
  const t = normalizeWs(text);
  if (!t) return [];
  const SEP = String.fromCharCode(1); // a separator no brief can contain
  return t.replace(SENTENCE_SPLIT_RE, '$1' + SEP).split(SEP)
    .map((x) => x.trim()).filter(Boolean);
}

function sentenceWordCounts(text) {
  return splitIntoSentences(text).map((x) => wordCount(x)).filter((n) => n > 0);
}

/** The shortest sentence in a piece of content prose, in words (0 if none). */
function shortestSentenceWords(text) {
  const counts = sentenceWordCounts(text);
  return counts.length ? Math.min.apply(null, counts) : 0;
}

function countMatches(text, re) {
  const m = String(text || '').match(re);
  return m ? m.length : 0;
}
function backtickCount(text) { return countMatches(text, /`/g); }
function digitDensity(text) {
  const words = wordCount(text);
  if (!words) return 0;
  return (countMatches(text, /[0-9]/g) / words) * 100;
}
/** Lowercase content unigrams of a piece of prose, as a Set (document freq). */
function unigramsOf(text) {
  const words = normalizeWs(String(text || '')).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
  const out = new Set();
  for (const w of words) {
    if (w.length < UNIGRAM_MIN_LENGTH) continue;
    if (!isContentWord(w)) continue;
    out.add(w);
  }
  return out;
}

/** A word that carries meaning: not a stopword, not a bare number. */
function isContentWord(w) {
  if (!w) return false;
  if (NGRAM_STOPWORDS.has(w)) return false;
  if (/^[0-9]+$/.test(w)) return false;
  return true;
}

/**
 * Lowercase word 3-grams carrying at least NGRAM_MIN_CONTENT_WORDS content
 * words. Returns a Set, so a repeated phrase counts once per document.
 *
 * The round-5 recalibration lives here: requiring two content words drops
 * connective scaffolding like "the order and" / "and a full", which recurs in
 * any prose about the same repository and says nothing about who wrote it.
 */
function trigramsOf(text) {
  const words = normalizeWs(String(text || '')).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
  const out = new Set();
  for (let i = 0; i + 2 < words.length; i++) {
    const tri = [words[i], words[i + 1], words[i + 2]];
    if (tri.filter(isContentWord).length < NGRAM_MIN_CONTENT_WORDS) continue;
    out.add(tri.join(' '));
  }
  return out;
}
function idiomCounts(text) {
  const out = {};
  for (const idiom of IDIOMS) {
    idiom.re.lastIndex = 0;
    out[idiom.label] = countMatches(text, idiom.re);
  }
  return out;
}

function statsOf(values) {
  if (!values.length) return { n: 0, mean: 0, sd: 0, min: 0, max: 0 };
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1) : 0;
  return { n, mean, sd: Math.sqrt(variance), min: Math.min.apply(null, values), max: Math.max.apply(null, values) };
}

/**
 * The distribution lint (round 5). Hard failure. Five gates, computed on the
 * CONTENT fields, that between them cover every feature the round-3 oracle used.
 */
function distributionLint(rows, findings) {
  const seeded = rows.filter((r) => r.kind === 'seeded');
  const controls = rows.filter((r) => r.kind === 'control');
  const report = { fields: {}, backticks: null, digits: null, ngrams: [], ngramsReported: [], idioms: [],
    sentences: null, unigrams: [], unigramsReported: [] };
  if (!seeded.length || !controls.length) return report;

  // (1) RANGE floors/ceilings and dispersion parity, per field. The round-3
  // oracle's four strongest rules were all "outside the other population's
  // range", so the ranges themselves are what must agree.
  for (const field of ['orderWords', 'claimsWords']) {
    const s = statsOf(seeded.map((r) => r[field]));
    const c = statsOf(controls.map((r) => r[field]));
    const label = field === 'orderWords' ? 'ORDER' : 'CLAIMS';
    report.fields[label] = { seeded: s, control: c };
    if (Math.abs(s.min - c.min) > RANGE_TOLERANCE_WORDS) {
      findings.push('distribution: ' + label + ' word-count FLOORS differ by ' + Math.abs(s.min - c.min).toFixed(0) +
        ' (seeded min ' + s.min + ', control min ' + c.min + '), above the ' + RANGE_TOLERANCE_WORDS + '-word tolerance. ' +
        'A disjoint floor makes "below the other population\'s minimum" a 100%-precision rule — that is exactly how ' +
        '`ORDER < 135` identified 8 seeds and 0 controls in round 3.');
    }
    if (Math.abs(s.max - c.max) > RANGE_TOLERANCE_WORDS) {
      findings.push('distribution: ' + label + ' word-count CEILINGS differ by ' + Math.abs(s.max - c.max).toFixed(0) +
        ' (seeded max ' + s.max + ', control max ' + c.max + '), above the ' + RANGE_TOLERANCE_WORDS + '-word tolerance.');
    }
    const ratio = c.sd === 0 ? (s.sd === 0 ? 1 : Infinity) : s.sd / c.sd;
    report.fields[label].sdRatio = ratio;
    if (!(ratio >= SD_RATIO_MIN && ratio <= SD_RATIO_MAX)) {
      findings.push('distribution: ' + label + ' word-count SD ratio is ' + (ratio === Infinity ? '∞' : ratio.toFixed(2)) +
        ' (seeded sd ' + s.sd.toFixed(1) + ', control sd ' + c.sd.toFixed(1) + '), outside [' + SD_RATIO_MIN + ', ' + SD_RATIO_MAX +
        ']. One population authored into a tighter band than the other is what pushes the tell into the tails.');
    }
  }

  // (2) BACKTICKS — forbidden outright, both populations. In round 3 exactly 10
  // of 84 orders carried one and all 10 were seeded: the seeded orders quote
  // identifiers, the control authors never did. A balance rule cannot fix a
  // habit, so the punctuation is simply not allowed.
  const withTicks = rows.filter((r) => r.backticks > 0);
  report.backticks = { files: withTicks.map((r) => r.id), seeded: withTicks.filter((r) => r.kind === 'seeded').length, control: withTicks.filter((r) => r.kind === 'control').length };
  for (const r of withTicks) {
    findings.push('distribution: content/' + r.id + '.json (' + r.kind + ') contains ' + r.backticks +
      ' backtick(s) in its `order`/`claims` prose. Backticks are forbidden in both populations — in round 3 all 10 ' +
      'backtick-carrying orders were seeded and all 54 controls had none, a single-brief-visible tell in punctuation. ' +
      'Name identifiers in plain words.');
  }

  // (3) DIGIT DENSITY.
  {
    const s = statsOf(seeded.map((r) => r.digitsPer100));
    const c = statsOf(controls.map((r) => r.digitsPer100));
    report.digits = { seeded: s, control: c, delta: Math.abs(s.mean - c.mean) };
    if (Math.abs(s.mean - c.mean) > DIGIT_DENSITY_TOLERANCE) {
      findings.push('distribution: digit density differs by ' + Math.abs(s.mean - c.mean).toFixed(2) +
        ' digits per 100 words (seeded ' + s.mean.toFixed(2) + ', control ' + c.mean.toFixed(2) + '), above the ' +
        DIGIT_DENSITY_TOLERANCE + ' tolerance. Round 3 found "digits in ORDER > 9" firing on 2 seeds and 0 controls.');
    }
  }

  // (4) N-GRAM EXCLUSIVITY. A phrase several artifacts of one population share
  // and the other never uses is an authorship fingerprint, whatever the means say.
  {
    const df = new Map(); // trigram -> { seeded: [ids], control: [ids] }
    for (const r of rows) {
      for (const tri of (r.trigrams || [])) {
        if (!df.has(tri)) df.set(tri, { seeded: [], control: [] });
        const bucket = df.get(tri)[r.kind];
        if (bucket) bucket.push(r.id);
      }
    }
    for (const tri of Array.from(df.keys()).sort()) {
      const use = df.get(tri);
      const seededOnly = use.control.length === 0 && use.seeded.length >= NGRAM_REPORT_MIN_FILES;
      const controlOnly = use.seeded.length === 0 && use.control.length >= NGRAM_REPORT_MIN_FILES;
      if (!seededOnly && !controlOnly) continue;
      const only = seededOnly ? 'seeded' : 'control';
      const ids = seededOnly ? use.seeded : use.control;
      const entry = { ngram: tri, only, ids };
      // At NGRAM_MIN_FILES+ it fails; in the 4-5 band it is published as
      // evidence for the topic-asymmetry disclosure but does not fail.
      if (ids.length >= NGRAM_MIN_FILES) report.ngrams.push(entry);
      else report.ngramsReported.push(entry);
    }
    // Strongest first, and capped: on a corpus this size the rule can fire on a
    // hundred phrases at once, and a refusal nobody can read is a refusal
    // nobody can act on. The count is always stated in full.
    const byFreq = (a, b) => b.ids.length - a.ids.length || (a.ngram < b.ngram ? -1 : 1);
    report.ngrams.sort(byFreq);
    report.ngramsReported.sort(byFreq);
    const shown = report.ngrams.slice(0, NGRAM_FINDINGS_SHOWN);
    for (const n of shown) {
      findings.push('distribution: the 3-gram ' + JSON.stringify(n.ngram) + ' occurs in ' + n.ids.length + ' ' + n.only +
        ' artifact(s) and 0 of the other population (' + n.ids.slice(0, 8).join(', ') + (n.ids.length > 8 ? ', …' : '') +
        '). A phrase one population shares and the other never uses is an authorship fingerprint. Re-word it, or use ' +
        'it in both populations.');
    }
    if (report.ngrams.length > shown.length) {
      findings.push('distribution: ' + report.ngrams.length + ' distinct 3-gram(s) are exclusive to one population at a ' +
        'document frequency of ' + NGRAM_MIN_FILES + '+; the ' + shown.length + ' strongest are listed above. The full list ' +
        'is in CONSTRUCTION.md\'s distribution section after a successful assembly, and in `distributionLint().ngrams`.');
    }
  }

  // (5) IDIOM BALANCE.
  {
    for (const idiom of IDIOMS) {
      const sTotal = seeded.reduce((a, r) => a + ((r.idioms || {})[idiom.label] || 0), 0);
      const cTotal = controls.reduce((a, r) => a + ((r.idioms || {})[idiom.label] || 0), 0);
      const sRate = sTotal / seeded.length;
      const cRate = cTotal / controls.length;
      const entry = { label: idiom.label, seeded: sTotal, control: cTotal, seededRate: sRate, controlRate: cRate, ratio: null };
      report.idioms.push(entry);
      if (sTotal === 0 && cTotal === 0) continue; // absent from both: fine
      if (sRate === 0 || cRate === 0) {
        findings.push('distribution: the idiom "' + idiom.label + '" appears ' + sTotal + '× across the seeds and ' +
          cTotal + '× across the controls — present in one population and absent from the other. In round 3 ' +
          '"leave … alone" / "and nothing else" split 0 seeds / 15 controls. Use it in both, or in neither.');
        continue;
      }
      const ratio = sRate / cRate;
      entry.ratio = ratio;
      if (!(ratio >= IDIOM_RATIO_MIN && ratio <= IDIOM_RATIO_MAX)) {
        findings.push('distribution: the idiom "' + idiom.label + '" has a per-artifact frequency ratio of ' + ratio.toFixed(2) +
          ' (seeded ' + sRate.toFixed(3) + '/artifact, control ' + cRate.toFixed(3) + '/artifact), outside [' +
          IDIOM_RATIO_MIN + ', ' + IDIOM_RATIO_MAX + '].');
      }
    }
  }

  // (6) SENTENCE FLOOR and shortest-sentence parity — amendment (xii)(a).
  {
    for (const r of rows) {
      for (const field of ['order', 'claims']) {
        for (const s of (r.sentences && r.sentences[field]) || []) {
          if (s.words < MIN_SENTENCE_WORDS) {
            findings.push('distribution: content/' + r.id + '.json (' + r.kind + ') `' + field + '` contains a ' +
              s.words + '-word sentence: ' + JSON.stringify(s.text) + '. Every sentence must carry at least ' +
              MIN_SENTENCE_WORDS + ' words. A short emphatic sentence is the single strongest tell the corpus has had — ' +
              '"Done." appeared in 4 seeded packets and 0 controls, and of the 26 artifacts whose shortest sentence was ' +
              '6 words or fewer, 22 were seeded. Fold it into the sentence beside it.');
          }
        }
      }
    }
    const sShort = statsOf(seeded.map((r) => r.shortestSentence || 0));
    const cShort = statsOf(controls.map((r) => r.shortestSentence || 0));
    report.sentences = { seeded: sShort, control: cShort, delta: Math.abs(sShort.mean - cShort.mean) };
    if (Math.abs(sShort.mean - cShort.mean) > SHORTEST_SENTENCE_MEAN_TOLERANCE) {
      findings.push('distribution: the mean SHORTEST SENTENCE differs by ' + Math.abs(sShort.mean - cShort.mean).toFixed(2) +
        ' words (seeded ' + sShort.mean.toFixed(2) + ', control ' + cShort.mean.toFixed(2) + '), above the ' +
        SHORTEST_SENTENCE_MEAN_TOLERANCE + '-word tolerance. This was a d = -1.80 separation in round 5 — the word budgets ' +
        'were balanced to a single word at both ends while the SENTENCE budgets were not balanced at all.');
    }
  }

  // (7) UNIGRAM exclusivity — amendment (xii)(b).
  {
    const df = new Map();
    for (const r of rows) {
      for (const w of (r.unigrams || [])) {
        if (!df.has(w)) df.set(w, { seeded: [], control: [] });
        const bucket = df.get(w)[r.kind];
        if (bucket) bucket.push(r.id);
      }
    }
    for (const w of Array.from(df.keys()).sort()) {
      const use = df.get(w);
      const seededOnly = use.control.length === 0 && use.seeded.length >= UNIGRAM_REPORT_MIN_FILES;
      const controlOnly = use.seeded.length === 0 && use.control.length >= UNIGRAM_REPORT_MIN_FILES;
      if (!seededOnly && !controlOnly) continue;
      const only = seededOnly ? 'seeded' : 'control';
      const ids = seededOnly ? use.seeded : use.control;
      const entry = { word: w, only, ids };
      if (ids.length >= UNIGRAM_MIN_FILES) report.unigrams.push(entry);
      else report.unigramsReported.push(entry);
    }
    const byFreq = (a, b) => b.ids.length - a.ids.length || (a.word < b.word ? -1 : 1);
    report.unigrams.sort(byFreq);
    report.unigramsReported.sort(byFreq);
    const shownU = report.unigrams.slice(0, UNIGRAM_FINDINGS_SHOWN);
    for (const u of shownU) {
      findings.push('distribution: the word ' + JSON.stringify(u.word) + ' occurs in ' + u.ids.length + ' ' + u.only +
        ' artifact(s) and 0 of the other population (' + u.ids.slice(0, 8).join(', ') + (u.ids.length > 8 ? ', …' : '') +
        '). A single-brief-visible lexical rule at 100% precision is exactly what the exclusivity gate exists to catch — ' +
        'and a habit that varies its phrasing never shows up as a shared 3-gram but always as a shared word. Use the word ' +
        'in both populations, or in neither.');
    }
    if (report.unigrams.length > shownU.length) {
      findings.push('distribution: ' + report.unigrams.length + ' word(s) are exclusive to one population at a document ' +
        'frequency of ' + UNIGRAM_MIN_FILES + '+; the ' + shownU.length + ' strongest are listed above.');
    }
  }

  return report;
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
  lines.push('| population | order words (mean ± sd) | claims words (mean ± sd) | ORDER hardness (mean ± sd) |');
  lines.push('|---|---|---|---|');
  const row = (label, set) => '| ' + label + ' | ' + fmtMeanSd(meanSd(set.map((r) => r.orderWords))) +
    ' | ' + fmtMeanSd(meanSd(set.map((r) => r.claimsWords))) +
    ' | ' + fmtMeanSd(meanSd(set.map((r) => r.orderHardness || 0))) + ' |';
  lines.push(row('seeded', seeded));
  lines.push(row('control', controls));
  lines.push(row('all', rows));
  lines.push('');
  lines.push('Bands enforced on EVERY artifact: order ' + ORDER_MIN_WORDS + '–' + ORDER_MAX_WORDS +
    ' words, claims ' + CLAIMS_MIN_WORDS + '–' + CLAIMS_MAX_WORDS + ' words (VARIANTS.md v2).');
  lines.push('');
  lines.push('**The bands are not the test — the two populations\' MEANS are.** Round 2 shipped a corpus whose bands all');
  lines.push('passed while `ORDER < 121 words` identified a control at 100% precision, and a blind reader given only brief');
  lines.push('text separated the populations at 83% using constraint register. Both are now HARD GATES, checked before');
  lines.push('anything is written:');
  lines.push('');
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const dOrder = Math.abs(mean(seeded.map((r) => r.orderWords)) - mean(controls.map((r) => r.orderWords)));
  const dClaims = Math.abs(mean(seeded.map((r) => r.claimsWords)) - mean(controls.map((r) => r.claimsWords)));
  const sHard = mean(seeded.map((r) => r.orderHardness || 0));
  const cHard = mean(controls.map((r) => r.orderHardness || 0));
  const ratio = cHard === 0 ? null : sHard / cHard;
  lines.push('| gate | value | limit | verdict |');
  lines.push('|---|---|---|---|');
  lines.push('| \\|mean ORDER words seeded − control\\| | ' + dOrder.toFixed(1) + ' | ≤ ' + MEAN_WORD_TOLERANCE + ' | ' +
    (dOrder <= MEAN_WORD_TOLERANCE ? 'pass' : '**FAIL**') + ' |');
  lines.push('| \\|mean CLAIMS words seeded − control\\| | ' + dClaims.toFixed(1) + ' | ≤ ' + MEAN_WORD_TOLERANCE + ' | ' +
    (dClaims <= MEAN_WORD_TOLERANCE ? 'pass' : '**FAIL**') + ' |');
  lines.push('| ORDER hardness ratio (seeded ÷ control) | ' + (ratio === null ? 'n/a' : ratio.toFixed(2)) + ' | ' +
    HARDNESS_RATIO_MIN + '–' + HARDNESS_RATIO_MAX + ' | ' +
    (ratio !== null && ratio >= HARDNESS_RATIO_MIN && ratio <= HARDNESS_RATIO_MAX ? 'pass' : '**FAIL**') + ' |');
  const sHardStrict = mean(seeded.map((r) => r.orderHardnessStrict || 0));
  const cHardStrict = mean(controls.map((r) => r.orderHardnessStrict || 0));
  const ratioStrict = cHardStrict === 0 ? null : sHardStrict / cHardStrict;
  lines.push('| …the same ratio WITHOUT `only` (sensitivity check) | ' + (ratioStrict === null ? 'n/a' : ratioStrict.toFixed(2)) + ' | ' +
    HARDNESS_RATIO_MIN + '–' + HARDNESS_RATIO_MAX + ' | ' +
    (ratioStrict !== null && ratioStrict >= HARDNESS_RATIO_MIN && ratioStrict <= HARDNESS_RATIO_MAX ? 'pass' : '**FAIL**') + ' |');
  lines.push('');
  lines.push('`only` is the most common of the seven hardness terms in ordinary English, so the headline ratio can land');
  lines.push('near 1.00 by accident. The second row re-computes it without `only`; both are gated.');
  lines.push('');
  lines.push('The hardness proxy counts whole-word occurrences of `must`, `never`, `exactly`, `only`, `byte-identical`,');
  lines.push('`unchanged` and `forbid*` in the ORDER prose — the vocabulary the round-2 blind evaluator named when it');
  lines.push('explained how it was telling the populations apart.');
  lines.push('');
  lines.push('### Inline labels (round 4)');
  lines.push('');
  lines.push('A round-3 blind evaluator separated the populations on a purely lexical label — `IN SCOPE:` / `Constraint:`');
  lines.push('inside the ORDER prose of 5 seeded content files and 0 controls. Inline labels are now forbidden OUTRIGHT in');
  lines.push('`order` and `claims`: a capitalized phrase of up to ' + LABEL_MAX_WORDS + ' words followed by a colon, at a line start or after a');
  lines.push('sentence end, is a hard failure. A first draft asked only that each label appear in both populations or');
  lines.push('neither, but a scan of the sealed corpus found 15 distinct labels of which all 15 were one-population —');
  lines.push('labels are bespoke to the change they describe, so they never balance. The skeleton lint cannot see any of');
  lines.push('this: `skeletonize()` collapses the whole ORDER block to a single `<ORDER>` token.');
  lines.push('');
  {
    const byLabel = new Map();
    for (const r of rows) {
      for (const label of (r.labels || [])) {
        if (!byLabel.has(label)) byLabel.set(label, { seeded: 0, control: 0 });
        if (byLabel.get(label)[r.kind] !== undefined) byLabel.get(label)[r.kind]++;
      }
    }
    if (!byLabel.size) {
      lines.push('**No inline labels in any content file.** (This table is empty in every corpus that assembles — a');
      lines.push('non-empty one would have failed the lint.)');
    } else {
      lines.push('| label | seeded | control |');
      lines.push('|---|---|---|');
      for (const label of Array.from(byLabel.keys()).sort()) {
        const u = byLabel.get(label);
        lines.push('| `' + label + ':` | ' + u.seeded + ' | ' + u.control + ' |');
      }
    }
  }
  lines.push('');
  lines.push(renderDistributionReport(rows));
  lines.push('');
  lines.push(renderStoppingStandard(rows));
  return lines.join('\n');
}

/**
 * The stopping standard — amendment (xii). Five rounds ran the same loop: gate a
 * statistic, watch the separation move one level down, gate that. This section
 * states the standard that ends it and lists EVERY gated feature with its
 * verdict, so a reader can see at a glance what is actually being enforced
 * rather than inferring it from prose.
 */
function renderStoppingStandard(rows) {
  const lines = [];
  lines.push('## Stopping standard (protocol amendment (xii))');
  lines.push('');
  lines.push('> The corpus is blind enough to run when every feature below is gated and passing, the blind-read');
  lines.push('> precision is at or below the amendment (vi) ceiling, and each remaining separation is DISCLOSED in this');
  lines.push('> record rather than removed. Rounds 3, 5 and 6 each gated the statistic a review named and found the');
  lines.push('> separation one level down — means, then ranges, then sentence shape, then vocabulary. The standard is not');
  lines.push('> "no reader has noticed yet"; it is "every feature family a reader could key on is measured, and the ones');
  lines.push('> that cannot be removed are written down."');
  lines.push('');
  const seeded = rows.filter((r) => r.kind === 'seeded');
  const controls = rows.filter((r) => r.kind === 'control');
  if (!seeded.length || !controls.length) {
    lines.push('Only one population present — nothing to compare.');
    return lines.join('\n');
  }
  const findings = [];
  const report = distributionLint(rows, findings);
  const balance = [];
  populationBalanceLint(rows, balance);
  const labels = [];
  labelTellLint(rows, labels);

  const has = (re) => findings.some((f) => re.test(f));
  const verdict = (ok) => (ok ? 'pass' : '**FAIL**');
  lines.push('| # | gated feature | amendment | verdict |');
  lines.push('|---|---|---|---|');
  lines.push('| 1 | ORDER / CLAIMS mean word count | (x) | ' + verdict(!balance.some((f) => /mean (ORDER|CLAIMS) words/.test(f))) + ' |');
  lines.push('| 2 | ORDER hardness ratio, and the `only`-free ratio | (x) | ' + verdict(!balance.some((f) => /hardness/.test(f))) + ' |');
  lines.push('| 3 | inline colon labels | (ix) | ' + verdict(labels.length === 0) + ' |');
  lines.push('| 4 | word-count ranges (floor, ceiling) and sd ratio | (x) | ' + verdict(!has(/word-count (FLOORS|CEILINGS)|SD ratio/)) + ' |');
  lines.push('| 5 | backticks | (x) | ' + verdict(!has(/backtick/)) + ' |');
  lines.push('| 6 | digit density | (x) | ' + verdict(!has(/digit density/)) + ' |');
  lines.push('| 7 | 3-gram exclusivity (df ≥ ' + NGRAM_MIN_FILES + ') | (x) | ' + verdict(report.ngrams.length === 0) + ' |');
  lines.push('| 8 | idiom balance | (x) | ' + verdict(!has(/idiom/)) + ' |');
  lines.push('| 9 | sentence floor (≥ ' + MIN_SENTENCE_WORDS + ' words) | (xii)(a) | ' + verdict(!has(/-word sentence/)) + ' |');
  lines.push('| 10 | shortest-sentence mean parity (≤ ' + SHORTEST_SENTENCE_MEAN_TOLERANCE + ' words) | (xii)(a) | ' + verdict(!has(/mean SHORTEST SENTENCE/)) + ' |');
  lines.push('| 11 | unigram exclusivity (df ≥ ' + UNIGRAM_MIN_FILES + ') | (xii)(b) | ' + verdict(report.unigrams.length === 0) + ' |');
  lines.push('| 12 | no sha in any brief | VARIANTS v3 | ' + verdict(true) + ' (enforced by `hexLint` at generation) |');
  lines.push('');
  lines.push('**Reported but not gated** (evidence for the disclosures above, not failures): ' +
    report.ngramsReported.length + ' 3-gram(s) exclusive at ' + NGRAM_REPORT_MIN_FILES + '–' + (NGRAM_MIN_FILES - 1) +
    ' documents, ' + report.unigramsReported.length + ' word(s) exclusive at ' + UNIGRAM_REPORT_MIN_FILES + '–' +
    (UNIGRAM_MIN_FILES - 1) + ' documents.');
  lines.push('');
  lines.push('**Disclosed rather than removed:** the topic asymmetry (the control pool carries docs/records commits the');
  lines.push('seeded pool cannot), the corpus-directory oracle (`.patch` / `.seed.json` for exactly the 30 seeded ids),');
  lines.push('and the base/subject collisions of the 10 reused-base pairs. Each is a corpus-level property, each is');
  lines.push('unreachable from a sanitized run clone, and each has its own section above.');
  return lines.join('\n');
}

/**
 * TOPIC ASYMMETRY — disclosed, not hidden (round-5 ruling).
 *
 * The first n-gram pass fired on 133 phrases. Reading them showed the rule was
 * measuring what the commits are ABOUT, not how they are written: the control
 * pool deliberately includes docs and records commits ("the band record",
 * "delta re-review order", "report as new files") while all 30 seeded bases are
 * code (`base-pool.json`'s allocation). No phrasing pass can remove that without
 * misdescribing the commits, so it is stated here instead.
 */
function renderTopicAsymmetry(rows) {
  const lines = [];
  lines.push('### Topic asymmetry — a corpus-level property, disclosed');
  lines.push('');
  lines.push('The seeded and control pools are drawn from different slices of this repository\'s history. Every one of the');
  lines.push('30 seeded bases is a CODE commit (a defect has to be injectable into behaviour); the 54 controls are drawn');
  lines.push('from a wider sweep that includes documentation and records commits — roughly two dozen of them. The two');
  lines.push('populations therefore talk about different subject matter, and no amount of re-phrasing can change that');
  lines.push('without misdescribing what the commits actually did.');
  lines.push('');
  lines.push('**The consequence, stated plainly.** A classifier with access to the WHOLE corpus can separate the two');
  lines.push('populations by topic. That is real and it is not fixed.');
  lines.push('');
  lines.push('**Why it does not compromise the trial.** §2.4 gives every lane ONE packet in fresh context. A reviewer');
  lines.push('holding a single brief about a records commit learns nothing about whether THAT packet is seeded: it cannot');
  lines.push('see the other 83, and the corpus-level frequency that makes the signal exploitable is exactly what a');
  lines.push('per-packet reviewer does not have. The sanitized run clone (see the section above) puts `wo12/` — key,');
  lines.push('patches and this record included — out of every lane\'s reach, so the distribution cannot be recovered from');
  lines.push('inside a review either. The exposure is to an adjudicator, a scorer, or anyone with repository access; it');
  lines.push('is disclosed here so those readers know to discount it.');
  lines.push('');
  lines.push('**Evidence.** The strongest topic-exclusive 3-grams in the sealed content, with the number of artifacts of');
  lines.push('one population carrying each and zero of the other:');
  lines.push('');
  const seeded = rows.filter((r) => r.kind === 'seeded');
  const controls = rows.filter((r) => r.kind === 'control');
  if (!seeded.length || !controls.length) {
    lines.push('(only one population present — nothing to compare)');
    return lines.join('\n');
  }
  const report = distributionLint(rows, []);
  const all = report.ngrams.concat(report.ngramsReported)
    .sort((a, b) => b.ids.length - a.ids.length || (a.ngram < b.ngram ? -1 : 1))
    .slice(0, 10);
  if (!all.length) {
    lines.push('(no 3-gram is exclusive to one population at ' + NGRAM_REPORT_MIN_FILES + '+ documents)');
  } else {
    lines.push('| 3-gram | population | documents | example artifacts |');
    lines.push('|---|---|---|---|');
    for (const n of all) {
      lines.push('| `' + n.ngram + '` | ' + n.only + ' | ' + n.ids.length + ' | ' + n.ids.slice(0, 4).join(', ') +
        (n.ids.length > 4 ? ', …' : '') + ' |');
    }
  }
  return lines.join('\n');
}

/**
 * The round-5 distribution gates, rendered. Round 4 gated three means, they
 * passed, and the tell moved into the tails and the vocabulary — where a
 * seven-feature disjunction then identified 25 of 30 seeds at 100% precision.
 * These five gates check the SHAPE of the two distributions, so the numbers are
 * published whether they pass or fail.
 */
function renderDistributionReport(rows) {
  const seeded = rows.filter((r) => r.kind === 'seeded');
  const controls = rows.filter((r) => r.kind === 'control');
  const lines = [];
  lines.push('### Distribution gates (round 5)');
  lines.push('');
  if (!seeded.length || !controls.length) {
    lines.push('Only one population present — nothing to compare.');
    return lines.join('\n');
  }
  lines.push('A mean is not enough. Round 4 gated Δmean ORDER, Δmean CLAIMS and the hardness ratio; all three passed while');
  lines.push('`ORDER < 135` still identified 8 seeds and 0 controls, backticks 10 seeds and 0 controls, and "leave … alone"');
  lines.push('15 controls and 0 seeds. These gates check ranges, dispersion, punctuation and vocabulary.');
  lines.push('');
  lines.push('**(1) Word-count ranges and dispersion**');
  lines.push('');
  lines.push('| field | population | min | max | sd | floor Δ (≤' + RANGE_TOLERANCE_WORDS + ') | ceiling Δ (≤' + RANGE_TOLERANCE_WORDS + ') | sd ratio (' + SD_RATIO_MIN + '–' + SD_RATIO_MAX + ') |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const [label, field] of [['ORDER', 'orderWords'], ['CLAIMS', 'claimsWords']]) {
    const s = statsOf(seeded.map((r) => r[field]));
    const c = statsOf(controls.map((r) => r[field]));
    const dMin = Math.abs(s.min - c.min);
    const dMax = Math.abs(s.max - c.max);
    const ratio = c.sd === 0 ? (s.sd === 0 ? 1 : Infinity) : s.sd / c.sd;
    const verdict = (v, ok) => v + (ok ? '' : ' **FAIL**');
    lines.push('| ' + label + ' | seeded | ' + s.min + ' | ' + s.max + ' | ' + s.sd.toFixed(1) + ' | ' +
      verdict(String(dMin), dMin <= RANGE_TOLERANCE_WORDS) + ' | ' + verdict(String(dMax), dMax <= RANGE_TOLERANCE_WORDS) + ' | ' +
      verdict(ratio === Infinity ? '∞' : ratio.toFixed(2), ratio >= SD_RATIO_MIN && ratio <= SD_RATIO_MAX) + ' |');
    lines.push('| ' + label + ' | control | ' + c.min + ' | ' + c.max + ' | ' + c.sd.toFixed(1) + ' | | | |');
  }
  lines.push('');
  lines.push('**(2) Backticks** — forbidden outright in `order` and `claims`, both populations.');
  lines.push('');
  {
    const withTicks = rows.filter((r) => r.backticks > 0);
    lines.push(withTicks.length
      ? '**FAIL** — ' + withTicks.length + ' file(s) carry backticks: ' + withTicks.map((r) => r.id + ' (' + r.kind + ', ' + r.backticks + ')').join(', ')
      : 'pass — no content file carries a backtick.');
  }
  lines.push('');
  lines.push('**(3) Digit density** (digits per 100 words, `order` + `claims`)');
  lines.push('');
  {
    const s = statsOf(seeded.map((r) => r.digitsPer100));
    const c = statsOf(controls.map((r) => r.digitsPer100));
    const d = Math.abs(s.mean - c.mean);
    lines.push('| population | mean | sd |');
    lines.push('|---|---|---|');
    lines.push('| seeded | ' + s.mean.toFixed(2) + ' | ' + s.sd.toFixed(2) + ' |');
    lines.push('| control | ' + c.mean.toFixed(2) + ' | ' + c.sd.toFixed(2) + ' |');
    lines.push('');
    lines.push('Δmean ' + d.toFixed(2) + ' (limit ' + DIGIT_DENSITY_TOLERANCE + ') — ' + (d <= DIGIT_DENSITY_TOLERANCE ? 'pass' : '**FAIL**'));
  }
  lines.push('');
  lines.push('**(4) N-gram exclusivity** — a lowercase 3-gram carrying ≥' + NGRAM_MIN_CONTENT_WORDS + ' content words (stopwords and bare');
  lines.push('numbers excluded), occurring in ≥' + NGRAM_MIN_FILES + ' artifacts of one population and 0 of the other.');
  lines.push('');
  {
    const findings = [];
    const report = distributionLint(rows, findings);
    lines.push(report.ngrams.length
      ? '**FAIL** — ' + report.ngrams.length + ' exclusive 3-gram(s) at ≥' + NGRAM_MIN_FILES + ' documents: ' +
        report.ngrams.slice(0, 12).map((n) => '`' + n.ngram + '` (' + n.only + ' ×' + n.ids.length + ')').join(', ') +
        (report.ngrams.length > 12 ? ', …' : '')
      : 'pass — no 3-gram is exclusive to one population at ≥' + NGRAM_MIN_FILES + ' documents.');
    lines.push('');
    lines.push('*Reported, not gated:* ' + report.ngramsReported.length + ' 3-gram(s) are exclusive to one population at ' +
      NGRAM_REPORT_MIN_FILES + '–' + (NGRAM_MIN_FILES - 1) + ' documents. That band is published rather than enforced — see');
    lines.push('the topic-asymmetry disclosure above for why.');
    if (report.ngramsReported.length) {
      lines.push('');
      lines.push('| 3-gram | population | documents |');
      lines.push('|---|---|---|');
      for (const n of report.ngramsReported.slice(0, 15)) {
        lines.push('| `' + n.ngram + '` | ' + n.only + ' | ' + n.ids.length + ' |');
      }
      if (report.ngramsReported.length > 15) lines.push('| …' + (report.ngramsReported.length - 15) + ' more | | |');
    }
    lines.push('');
    lines.push('**(6) Sentence shape** — amendment (xii)(a): every sentence in `order` and `claims` carries ≥' + MIN_SENTENCE_WORDS + ' words,');
    lines.push('and the two populations\' mean SHORTEST sentence agree within ' + SHORTEST_SENTENCE_MEAN_TOLERANCE + ' words.');
    lines.push('');
    {
      const short = report.sentences || { seeded: statsOf([]), control: statsOf([]), delta: 0 };
      const under = [];
      for (const r of rows) {
        for (const field of ['order', 'claims']) {
          for (const s of (r.sentences && r.sentences[field]) || []) {
            if (s.words < MIN_SENTENCE_WORDS) under.push(r.id + ' (' + r.kind + ', ' + field + ', ' + s.words + 'w)');
          }
        }
      }
      lines.push('| population | shortest sentence (mean ± sd) | min | max |');
      lines.push('|---|---|---|---|');
      lines.push('| seeded | ' + short.seeded.mean.toFixed(2) + ' ± ' + short.seeded.sd.toFixed(2) + ' | ' + short.seeded.min + ' | ' + short.seeded.max + ' |');
      lines.push('| control | ' + short.control.mean.toFixed(2) + ' ± ' + short.control.sd.toFixed(2) + ' | ' + short.control.min + ' | ' + short.control.max + ' |');
      lines.push('');
      lines.push('Δmean ' + short.delta.toFixed(2) + ' (limit ' + SHORTEST_SENTENCE_MEAN_TOLERANCE + ') — ' +
        (short.delta <= SHORTEST_SENTENCE_MEAN_TOLERANCE ? 'pass' : '**FAIL**'));
      lines.push('');
      lines.push(under.length
        ? '**FAIL** — ' + under.length + ' sentence(s) below the ' + MIN_SENTENCE_WORDS + '-word floor: ' + under.slice(0, 12).join(', ') + (under.length > 12 ? ', …' : '')
        : 'pass — no sentence is below the ' + MIN_SENTENCE_WORDS + '-word floor.');
    }
    lines.push('');
    lines.push('**(7) Unigram exclusivity** — amendment (xii)(b): a lowercase content word of ≥' + UNIGRAM_MIN_LENGTH + ' characters present in');
    lines.push('≥' + UNIGRAM_MIN_FILES + ' artifacts of one population and 0 of the other.');
    lines.push('');
    lines.push(report.unigrams.length
      ? '**FAIL** — ' + report.unigrams.length + ' exclusive word(s): ' +
        report.unigrams.slice(0, 12).map((u) => '`' + u.word + '` (' + u.only + ' ×' + u.ids.length + ')').join(', ') +
        (report.unigrams.length > 12 ? ', …' : '')
      : 'pass — no word is exclusive to one population at ≥' + UNIGRAM_MIN_FILES + ' documents.');
    lines.push('');
    lines.push('*Reported, not gated:* ' + report.unigramsReported.length + ' word(s) exclusive at ' +
      UNIGRAM_REPORT_MIN_FILES + '–' + (UNIGRAM_MIN_FILES - 1) + ' documents.');
    if (report.unigramsReported.length) {
      lines.push('');
      lines.push('| word | population | documents |');
      lines.push('|---|---|---|');
      for (const u of report.unigramsReported.slice(0, 15)) {
        lines.push('| `' + u.word + '` | ' + u.only + ' | ' + u.ids.length + ' |');
      }
      if (report.unigramsReported.length > 15) lines.push('| …' + (report.unigramsReported.length - 15) + ' more | | |');
    }
    lines.push('');
    lines.push('**(5) Idiom balance** — per-artifact frequency ratio within ' + IDIOM_RATIO_MIN + '–' + IDIOM_RATIO_MAX + ', or absent from both');
    lines.push('');
    lines.push('| idiom | seeded (total / per artifact) | control (total / per artifact) | ratio | verdict |');
    lines.push('|---|---|---|---|---|');
    for (const e of report.idioms) {
      let verdict;
      if (e.seeded === 0 && e.control === 0) verdict = 'absent from both — pass';
      else if (e.seededRate === 0 || e.controlRate === 0) verdict = '**FAIL** (one population only)';
      else verdict = (e.ratio >= IDIOM_RATIO_MIN && e.ratio <= IDIOM_RATIO_MAX) ? 'pass' : '**FAIL**';
      lines.push('| "' + e.label + '" | ' + e.seeded + ' / ' + e.seededRate.toFixed(3) + ' | ' + e.control + ' / ' +
        e.controlRate.toFixed(3) + ' | ' + (e.ratio === null ? 'n/a' : e.ratio.toFixed(2)) + ' | ' + verdict + ' |');
    }
  }
  return lines.join('\n');
}

// --------------------------------------------------------- 7. CONSTRUCTION.md

function renderConstructionMd(key, tallies, heads, rows, notes, skeletonSummary, corpusDir) {
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
  lines.push('### The corpus directory is an oracle — and it is out of every lane\'s reach');
  lines.push('');
  lines.push('Round-3 R0 MINOR (A-m5), disclosed here because the same adjudicator who reads the collisions above reads');
  lines.push('this. A bare `ls` of `corpus/` labels the entire key: a `.patch` and a `.seed.json` exist for exactly the 30');
  lines.push('SEEDED ids and for no control. The seeded ids also occupy contiguous blocks (`001-006`, `013-020`,');
  lines.push('`037-044`, `061-068`). Neither can be removed without moving the corpus off disk.');
  lines.push('');
  lines.push('**This oracle is reachable only with repository-level access. It is unreachable from any review lane.**');
  lines.push('Every lane runs in a SANITIZED run clone built by `build-corpus.js` `prepareRunClone()`, and');
  lines.push('`sanitizeClone()` asserts — it does not assume — that:');
  lines.push('');
  lines.push('- `git for-each-ref` is empty (no branch, tag or remote-tracking ref survives);');
  lines.push('- `git rev-list --all` equals `git rev-list HEAD` (nothing is reachable beyond the pinned head\'s ancestry);');
  lines.push('- `git ls-tree -r HEAD -- <wo12 corpus path>` is EMPTY (the corpus is not in the pinned tree);');
  lines.push('- `git log --all -- <wo12 corpus path>` is EMPTY (no reachable commit ever touched it);');
  lines.push('- the sealed `key.json` blob is absent from the object store (`git cat-file -e` fails).');
  lines.push('');
  lines.push('Controls take the identical path, so the stripping is not itself a tell. A lane therefore cannot list');
  lines.push('`corpus/`, cannot `git show` it from any ref, and cannot recover it from history — the oracle exists for a');
  lines.push('reader of this repository, never for a reviewer of an artifact.');
  lines.push('');
  lines.push(renderTopicAsymmetry(rows));
  lines.push('');
  lines.push('### Amendment (vi) — blind-classification record');
  lines.push('');
  lines.push('(vi) requires a fresh-evaluator blind classification over 12+12 briefs, re-run after every content change');
  lines.push('and reported HERE (target: precision at or near chance; anything above 65% reopens the pass). This section');
  lines.push('is generated from `corpus/blind-read.json` when that file exists, so the evidence lives in the artifact');
  lines.push('that exists to carry it rather than only in a review record.');
  lines.push('');
  {
    const blindPath = corpusDir ? path.join(corpusDir, 'blind-read.json') : null;
    let blind = null;
    try { if (blindPath && fs.existsSync(blindPath)) blind = JSON.parse(fs.readFileSync(blindPath, 'utf8')); } catch (e) { blind = null; }
    if (!blind) {
      lines.push('**NOT RECORDED.** No `corpus/blind-read.json` is present, so amendment (vi)\'s acceptance evidence is');
      lines.push('missing from this record. Run the blind classification and write the result there as');
      lines.push('`{"date","evaluator","n","precision","recall","accuracy","note"}`; until then this corpus carries no');
      lines.push('in-artifact evidence that it is blind, whatever the lints say.');
    } else {
      lines.push('| field | value |');
      lines.push('|---|---|');
      for (const k of ['date', 'evaluator', 'n', 'precision', 'recall', 'accuracy', 'note']) {
        if (blind[k] !== undefined) lines.push('| ' + k + ' | ' + String(blind[k]) + ' |');
      }
      const p = Number(blind.precision);
      if (Number.isFinite(p)) {
        lines.push('');
        lines.push(p > 0.65 || p > 65
          ? '**ABOVE (vi)\'s 65% ceiling — the content pass is reopened.**'
          : 'Within (vi)\'s 65% ceiling.');
      }
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
    hexLint('briefs/' + a.id + '.wo.txt', briefs.wo, findings);
    hexLint('briefs/' + a.id + '.er.txt', briefs.er, findings);

    rows.push({
      id: a.id, kind: a.kind, variant: a.variant, baseKind, head,
      orderWords: counts.order, claimsWords: counts.claims,
      orderHardness: hardnessScore(content.order),
      orderHardnessStrict: hardnessScoreStrict(content.order),
      labels: contentLabels(content),
      // Round-5 distribution metrics, computed on the CONTENT fields.
      backticks: backtickCount(content.order) + backtickCount(content.claims),
      digitsPer100: digitDensity(content.order + ' ' + content.claims),
      trigrams: Array.from(trigramsOf(content.order + ' ' + content.claims)),
      idioms: idiomCounts(content.order + ' ' + content.claims),
      // Round-7 amendment (xii): sentence shape and unigram vocabulary.
      unigrams: Array.from(unigramsOf(content.order + ' ' + content.claims)),
      sentences: {
        order: splitIntoSentences(content.order).map((t) => ({ text: t, words: wordCount(t) })),
        claims: splitIntoSentences(content.claims).map((t) => ({ text: t, words: wordCount(t) })),
      },
      shortestSentence: (() => {
        const parts = [shortestSentenceWords(content.order), shortestSentenceWords(content.claims)].filter((n) => n > 0);
        return parts.length ? Math.min.apply(null, parts) : 0;
      })(),
      wo: briefs.wo, er: briefs.er,
      woSkeleton: skeletonize(briefs.wo, a, head),
      erSkeleton: skeletonize(briefs.er, a, head),
    });
  }

  structuralTellLint(rows, findings);
  lintKindSymmetry(rows, findings);
  const balance = populationBalanceLint(rows, findings);
  const labelUse = labelTellLint(rows, findings);
  const distribution = distributionLint(rows, findings);

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
  return { rows, findings, skeletonSummary, balance, labelUse, distribution };
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
  writeAtomic(paths.constructionMdPath, renderConstructionMd(key, tallies, heads, rows, notes, skeletonSummary, paths.corpusDir));

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
  STATUS_PREFIX, V1_STATUS_LINE, V2_STATUS_LINE,
  LEAKAGE_PATTERNS, VENDOR_PATTERNS,
  findLeakageTerm, findVendorTerm,
  normalizeWs, wordCount, wrapProse,
  renderWorkOrder, renderExecutorReport, generateBriefs, hazardsFor, resolveKind, skeletonize,
  parseArgs, resolvePaths, checkRequirements, loadContent, buildKeyAndNotes, contentPath,
  guardedWriteContentFile, snapshotContentDir, assertContentDirPreserved, CONTENT_IMPORT_REPORT_BASENAME,
  leakageLint, vendorLint, hazardLint, hexLint, HEX_IN_BRIEF_RE, wordBandLint, structuralTellLint, lintKindSymmetry,
  populationBalanceLint, hardnessScore, hardnessScoreStrict,
  distributionLint, renderDistributionReport, renderTopicAsymmetry, renderStoppingStandard, isContentWord,
  splitIntoSentences, sentenceWordCounts, shortestSentenceWords, unigramsOf,
  MIN_SENTENCE_WORDS, SHORTEST_SENTENCE_MEAN_TOLERANCE, UNIGRAM_MIN_FILES, UNIGRAM_REPORT_MIN_FILES, UNIGRAM_MIN_LENGTH, backtickCount, digitDensity, trigramsOf, idiomCounts, statsOf,
  RANGE_TOLERANCE_WORDS, SD_RATIO_MIN, SD_RATIO_MAX, DIGIT_DENSITY_TOLERANCE, NGRAM_MIN_FILES,
  IDIOM_RATIO_MIN, IDIOM_RATIO_MAX, IDIOMS, NGRAM_STOPWORDS, NGRAM_FINDINGS_SHOWN,
  NGRAM_MIN_CONTENT_WORDS, NGRAM_REPORT_MIN_FILES,
  labelTellLint, extractLabels, contentLabels, LABEL_RE, LABEL_MAX_WORDS,
  MEAN_WORD_TOLERANCE, HARDNESS_RATIO_MIN, HARDNESS_RATIO_MAX,
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
