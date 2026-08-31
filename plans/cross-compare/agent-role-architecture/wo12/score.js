#!/usr/bin/env node
/**
 * WO-12 SDC mechanical scorer — protocol §2.5 (scoring), §3.1 (12f gate),
 * §3.2 (12d contrast).
 *
 *   node score.js [--lane <lane>]... [--key <path>] [--results-dir <dir>]
 *       [--adjudication <path>] [--out <path>] [--lenient-paths]
 *
 * Reads `key.json` (the sealed corpus) and every `results-*.json` file next
 * to it (each an array of {id, base, head, lane, phase, variant,
 * expectedModel, attempts}) and computes, mechanically, from the verdict text
 * alone:
 *
 *   - hits: a FINDINGS-section entry citing a seed's locator.file AND
 *     (a line citation overlapping locator.lines within ±3, OR the finding
 *     text naming locator.symbol), AT SEVERITY >= MINOR — protocol §2.5.
 *     Citation parsing is DELIBERATELY liberal (path:line, "path ... lines
 *     N-M", backticked paths) because the reviewer prose this reads is not
 *     itself structured data; see parseCitations() below and the wo12 report's
 *     ambiguity notes for what "liberal" was made to mean concretely. The
 *     file-citation match itself is classified into two tiers
 *     (classifyFileMatch()): 'exact-path' (the citation IS the locator path,
 *     or a genuine path suffix of it) or 'basename-only' (the citation names
 *     only the bare filename, no path — indistinguishable from a citation of
 *     any OTHER file sharing that name).
 *
 *     *(Round-2 amendment, §2.5, after the round-1 R0 review's MAJOR 6: STRICT
 *     PATHS ARE THE DEFAULT. A basename-only citation is NEVER a hit — it is
 *     recorded as a `basename-only NEAR MISS`, reported in its own table for
 *     adjudication, and counted nowhere. The round-1 default scored a finding
 *     about `tests/quartermaster.js:557` as a hit on
 *     `quartermaster/quartermaster.js:556-559`, and that inflated count fed the
 *     headline recall table, every Wilson interval, and 12f gate 1.
 *     `--lenient-paths` restores the old behaviour, opt-in and disclosed.)*
 *
 *     *(Round-2 amendment, §2.5, after MAJOR 7: the SEVERITY FLOOR is
 *     enforced. §2.5 reads "with severity >= MINOR"; the round-1 code computed
 *     the severity and then never gated on it, so any stray prose line naming
 *     the file and a nearby line number counted as a find. An UNTAGGED block is
 *     not a hit. A hand-transcribed S-lane verdict that omits the tag is not
 *     lost: §2.5's adjudication arm can promote a mechanical miss to a hit on a
 *     quoted citation, which is exactly the path an untagged real finding
 *     should take.)*
 *   - recall (hits/seeds), overall / per severity / per type / per lane /
 *     per 12h variant, each with a Wilson 95% interval.
 *   - stability: UNAVAILABLE counts and streaks per lane (final status,
 *     after run-lane's own one retry).
 *   - INTEGRITY WARNING, IDENTITY_UNKNOWN and IDENTITY_MISMATCH counts per
 *     lane. Identity is checked against the LANE'S EXPECTED MODEL (§2.4), not
 *     merely for the presence of some engine header — round-2, MAJOR 1: a
 *     Terra qualification run silently served by the flagship used to pass
 *     gate 5 and be counted in Terra's recall.
 *   - the 12f Terra-T1-qualification gate table (§3.1 items 1,2,4,5,6
 *     mechanically; item 3, false-blocker rate, needs `adjudication.json`
 *     [{id, lane, finding, severity, kind, verdict, second}] — absent it
 *     prints NOT ADJUDICATED, never a fabricated PASS/FAIL).
 *   - the 12d cross-family-vs-same-family contrast (§3.2), including the
 *     seed-level union table (which seeds only one family found).
 *   - the construction-suspect list (§2.5 last bullet): seeds no lane, of
 *     either family, ever hit — emitted ONLY when both families are complete
 *     (round-2, MAJOR 8: scored from X-lanes alone, the list published every
 *     seed the X-lanes missed to the owner as possibly malformed, inverting
 *     §2.5's "hit by neither X-lane nor ANY S-lane").
 *
 * This is a SCORER, not a gate: it prints a markdown report to stdout, writes
 * `score-output.json` next to `key.json` (or --out), and exits 0 on every
 * SCORING outcome — a FAIL in the gate table is a result, not a build failure.
 * The two exceptions are input errors, which exit 1 because there is nothing
 * to score: an unreadable/invalid `key.json` and an unreadable `--adjudication`
 * file (`fail()`). An unreadable `results-*.json` is neither — it is recorded
 * in `malformedFiles` and reported.
 *
 * House rules: zero dependencies, CommonJS, same voice as build-corpus.js /
 * run-lane.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const HERE = __dirname;

// ---------------------------------------------------------------- Wilson

// Standard Wilson score interval (95%), z = 1.959963984540054 (the exact
// two-sided normal quantile for 0.975, not the common z=1.96 rounding — kept
// to full precision so this implementation's own anchors are reproducible
// bit-for-bit from the formula, not from someone else's rounding).
const Z95 = 1.959963984540054;
function wilson(hits, n) {
  if (!Number.isFinite(n) || n <= 0) return { hits: 0, n: 0, p: null, lo: null, hi: null };
  const p = hits / n;
  const z2 = Z95 * Z95;
  const denom = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const adj = Z95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  const lo = Math.max(0, (center - adj) / denom);
  const hi = Math.min(1, (center + adj) / denom);
  return { hits, n, p, lo, hi };
}
function pct(x) { return x === null || x === undefined ? 'n/a' : (x * 100).toFixed(1) + '%'; }
function fmtWilson(w) {
  return w.n === 0 ? 'n/a (n=0)' : w.hits + '/' + w.n + ' = ' + pct(w.p) + '  [' + pct(w.lo) + ', ' + pct(w.hi) + ']';
}

// -------------------------------------------------------------- findings

// Round-2, R0 MINOR 1: the round-1 matchers required a BARE `FINDINGS` line
// and a bare `CLAIMS CHECKED` / `NITS` terminator. The X-lane runner's own
// template does emit bare headers (packs/codex/hooks/orchestra-review.js:1815),
// so the X-lanes were aligned — but §2.4's S-lanes are hand-transcribed
// in-harness agents, and this repository's own R0 house format
// (roster/wo11-r0-review-1.md) writes `## FINDINGS` / `## CLAIMS CHECKED`. A
// markdown-headed verdict therefore scored ZERO for the whole artifact, with no
// diagnostic, and a correctly-cited CRITICAL read as a MISS. An optional
// leading `#`-run (and an optional trailing colon) is now accepted on both
// ends; scoreRecords() additionally records `emptyFindingsSection` on any
// non-UNAVAILABLE record that yields nothing, and the report warns loudly.
const FINDINGS_START = /^#*\s*FINDINGS\s*:?\s*$/i;
const FINDINGS_END_HEADERS = /^#*\s*(CLAIMS CHECKED|NITS)\s*:?\s*$/i;

function extractFindingsSection(text) {
  const lines = String(text || '').split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (FINDINGS_START.test(lines[i].trim())) { start = i + 1; break; }
  }
  if (start === -1) return '';
  let end = lines.length;
  for (let j = start; j < lines.length; j++) {
    if (FINDINGS_END_HEADERS.test(lines[j].trim())) { end = j; break; }
  }
  return lines.slice(start, end).join('\n');
}

// A finding block starts at a "- " bullet; any following non-bullet lines
// (the reviewer's own wrapped continuation) are folded into the same block
// until the next bullet or the section ends.
function splitFindingBlocks(sectionText) {
  const lines = String(sectionText || '').split('\n');
  const blocks = [];
  let current = null;
  for (const raw of lines) {
    if (/^\s*-\s+/.test(raw)) {
      if (current !== null) blocks.push(current.trim());
      current = raw.replace(/^\s*-\s+/, '');
    } else if (current !== null) {
      const t = raw.trim();
      if (t) current += ' ' + t;
    }
  }
  if (current !== null) blocks.push(current.trim());
  return blocks.filter((b) => b && !/^none\.?$/i.test(b));
}

function parseSeverity(block) {
  const bracketed = /\[(CRITICAL|MAJOR|MINOR)\]/i.exec(block);
  if (bracketed) return bracketed[1].toUpperCase();
  const bare = /\b(CRITICAL|MAJOR|MINOR)\b/i.exec(block);
  return bare ? bare[1].toUpperCase() : null;
}

// Liberal citation extraction: `path/to/file.js:123`, `path/to/file.js:120-130`,
// backticked paths (backticks are simply not in the path character class, so
// they fall out on their own), and "path ... lines 120-130" / "line 42" within
// PROXIMITY_WINDOW characters of the file mention.
//
// PROXIMITY_WINDOW is a judgement call in a rule that decides a qualification
// gate, so it is named and stated rather than inlined (round-2 nit): 80
// characters is about one wrapped line of reviewer prose, i.e. "the line number
// is in the same breath as the filename". Widen it and a finding about file A
// starts borrowing the line number of a later sentence about file B; narrow it
// and an honest `\`path/to/file.js\` — the guard at lines 120-130 ...` stops
// being read as one citation. Both failure directions are recorded in the wo12
// report's ambiguity notes, with this constant named as the knob.
const PROXIMITY_WINDOW = 80;

function parseCitations(block) {
  const citations = [];
  const reColonLine = /([A-Za-z0-9_][\w./\\-]*\.[A-Za-z]{1,10})\s*:\s*(\d+)(?:\s*[-–]\s*(\d+))?/g;
  let m;
  while ((m = reColonLine.exec(block))) {
    citations.push({ file: m[1], lineStart: parseInt(m[2], 10), lineEnd: m[3] ? parseInt(m[3], 10) : parseInt(m[2], 10) });
  }
  const reFile = /([A-Za-z0-9_][\w./\\-]*\.[A-Za-z]{1,10})/g;
  let f;
  while ((f = reFile.exec(block))) {
    const window = block.slice(f.index, f.index + PROXIMITY_WINDOW);
    const lm = /\blines?\s+(\d+)(?:\s*(?:-|–|to)\s*(\d+))?/i.exec(window);
    if (lm) citations.push({ file: f[1], lineStart: parseInt(lm[1], 10), lineEnd: lm[2] ? parseInt(lm[2], 10) : parseInt(lm[1], 10) });
  }
  return citations;
}

function normalizePath(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}
// Classifies a citation against a seed's locator.file into one of two tiers,
// or no match at all:
//   'exact-path'    — the citation IS the locator path, or one is a genuine
//                      path suffix of the other (a real path match, just
//                      possibly relative-vs-repo-root-relative).
//   'basename-only'  — the citation names only the bare filename, no path at
//                      all, so it is indistinguishable from a citation of any
//                      OTHER file sharing that name. NOT A HIT by default
//                      (round-2, MAJOR 6): reported separately as a NEAR MISS
//                      for adjudication, counted nowhere. `--lenient-paths`
//                      (score.js CLI) restores the round-1 behaviour of
//                      counting it, opt-in and disclosed in the report.
//   null             — no match.
function classifyFileMatch(cited, locator) {
  const a = normalizePath(cited);
  const b = normalizePath(locator);
  if (a === b) return 'exact-path';
  // A genuine path-suffix match requires the SHORTER side to itself carry at
  // least one path separator — otherwise "one ends with '/' + the other" is
  // true for ANY citation that names just the bare filename (a single-
  // segment "path" trivially suffix-matches the tail of any longer one),
  // which would silently swallow the basename-only tier into this one.
  if (a.includes('/') && b.endsWith('/' + a)) return 'exact-path';
  if (b.includes('/') && a.endsWith('/' + b)) return 'exact-path';
  const abase = a.split('/').pop();
  const bbase = b.split('/').pop();
  if (abase && abase === bbase) return 'basename-only';
  return null;
}
// Boolean convenience wrapper — kept for callers that only need yes/no.
function fileMatches(cited, locator) {
  return !!classifyFileMatch(cited, locator);
}
function overlapsWithTolerance(citeStart, citeEnd, seedStart, seedEnd, tol) {
  return citeStart <= seedEnd + tol && seedStart - tol <= citeEnd;
}
function mentionsSymbol(text, symbol) {
  if (!symbol) return false;
  const esc = String(symbol).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^A-Za-z0-9_])' + esc + '([^A-Za-z0-9_]|$)').test(text);
}

const SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'];

/**
 * Mechanical hit rule (§2.5): a finding cites locator.file AND (a line
 * citation overlaps locator.lines ±3 OR the block names locator.symbol), AT
 * SEVERITY >= MINOR.
 *
 * Round-2, R0 MAJOR 7 — the severity floor is ENFORCED. §2.5 says "with
 * severity >= MINOR"; the round-1 implementation parsed the severity, stored
 * it, and never gated on it, reasoning that a hand-transcribed S-lane verdict
 * might omit the tag. That leniency applied identically to the X-lanes, whose
 * runner template MANDATES `[SEVERITY]` tags, so any stray prose line naming
 * the file and a nearby line number scored as a find. An untagged block is now
 * NOT a mechanical hit for any lane. The S-lane case the leniency existed for
 * is served by the arm §2.5 already provides: adjudication may PROMOTE a
 * mechanical miss to a hit on a quoted citation, and promotions are reported
 * as their own count. Untagged near-hits are returned in `nearMisses` with
 * reason `severity` so they reach adjudication rather than vanishing.
 *
 * Round-2, R0 MAJOR 6 — STRICT PATHS ARE THE DEFAULT. A 'basename-only'
 * citation (the bare filename, no path) is not a citation of locator.file: it
 * is indistinguishable from a citation of any same-named file elsewhere in the
 * tree, and `quartermaster.js`, `router.js`, `checkout.js` and `index.js` all
 * exist at several depths in this repository. Such a block is returned in
 * `nearMisses` with reason `path` and counted nowhere. `opts.lenientPaths`
 * restores the round-1 behaviour of counting it, and the report says so at the
 * top of the path-tier table.
 */
function evaluateSeedHit(seed, blocks, opts) {
  opts = opts || {};
  const lenient = !!opts.lenientPaths;
  const nearMisses = [];
  for (const block of blocks) {
    const citations = parseCitations(block).map((c) => Object.assign({}, c, { matchKind: classifyFileMatch(c.file, seed.locator.file) }));
    const anyFileCited = citations.filter((c) => c.matchKind);
    if (!anyFileCited.length) continue;
    const fileCited = anyFileCited.filter((c) => lenient || c.matchKind === 'exact-path');
    if (!fileCited.length) {
      // The block DOES name the locator's basename, but only the basename.
      if (anyFileCited.some((c) => overlapsWithTolerance(c.lineStart, c.lineEnd, seed.locator.lines[0], seed.locator.lines[1], 3)) ||
          mentionsSymbol(block, seed.locator.symbol)) {
        nearMisses.push({ reason: 'path', pathMatchKind: 'basename-only', severity: parseSeverity(block), finding: block });
      }
      continue;
    }
    const lineHitCitation = fileCited.find((c) => overlapsWithTolerance(c.lineStart, c.lineEnd, seed.locator.lines[0], seed.locator.lines[1], 3));
    const symbolHit = mentionsSymbol(block, seed.locator.symbol);
    if (!lineHitCitation && !symbolHit) continue;
    const severity = parseSeverity(block);
    const pathMatchKind = lineHitCitation
      ? lineHitCitation.matchKind
      : (fileCited.some((c) => c.matchKind === 'exact-path') ? 'exact-path' : 'basename-only');
    if (!severity || !SEVERITIES.includes(severity)) {
      nearMisses.push({ reason: 'severity', pathMatchKind, severity: null, finding: block });
      continue;
    }
    return { hit: true, finding: block, severity, via: lineHitCitation ? 'line' : 'symbol', pathMatchKind, nearMisses };
  }
  return { hit: false, finding: null, severity: null, via: null, pathMatchKind: null, nearMisses };
}

// -------------------------------------------------------------------- I/O

function fail(msg) {
  process.stderr.write('score: ' + msg + '\n');
  process.exit(1);
}

function usage() {
  return [
    'usage: node score.js [--lane <lane>]... [--key <path>] [--results-dir <dir>]',
    '                      [--adjudication <path>] [--out <path>] [--lenient-paths]',
    '',
    '--lane may repeat to restrict scoring to specific lanes; omitted, every',
    '  lane present in the loaded results is scored.',
    'Strict path matching is the DEFAULT (round 2): a finding that names only a',
    '  bare filename (no path) does not count as citing locator.file, and is',
    '  reported as a basename-only NEAR MISS for adjudication instead.',
    '--lenient-paths restores the round-1 behaviour of counting those as hits.',
    '  Disclosed at the top of the path-tier table whenever it is on.',
    'Exits 0 on every scoring outcome — this is a scorer, not a gate; the 12f',
    '  gate TABLE prints PASS / FAIL / INCOMPLETE per item. It exits 1 only on an',
    '  input it cannot score at all: an unreadable/invalid key.json, or an',
    '  unreadable --adjudication file.',
  ].join('\n');
}

function parseArgs(argv) {
  const out = { lanes: [], key: null, resultsDir: null, adjudication: null, out: null, lenientPaths: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lane') out.lanes.push(argv[++i]);
    else if (a === '--key') out.key = argv[++i];
    else if (a === '--results-dir') out.resultsDir = argv[++i];
    else if (a === '--adjudication') out.adjudication = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--lenient-paths') out.lenientPaths = true;
    else if (a === '--strict-paths') {
      // Round-2: strict IS the default. The flag is accepted as a no-op so an
      // existing invocation keeps working and says what changed, rather than
      // dying on an unknown argument.
      process.stderr.write('score: --strict-paths is now the DEFAULT and the flag is a no-op; pass --lenient-paths for the old behaviour.\n');
    } else if (a === '--help' || a === '-h') { process.stdout.write(usage() + '\n'); process.exit(0); }
    else fail('unknown argument: ' + a + '\n\n' + usage());
  }
  return out;
}

function loadKey(keyPath) {
  if (!fs.existsSync(keyPath)) fail('key.json not found: ' + keyPath);
  let key;
  try { key = JSON.parse(fs.readFileSync(keyPath, 'utf8')); }
  catch (e) { fail('key.json at ' + keyPath + ' is not valid JSON: ' + e.message); }
  if (!key || !Array.isArray(key.artifacts)) fail('key.json at ' + keyPath + ' has no `artifacts` array');
  return key;
}

function findResultsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => /^results-.*\.json$/.test(f))
    .map((f) => path.join(dir, f));
}

function loadResultRecords(files) {
  const records = [];
  const malformedFiles = [];
  for (const f of files) {
    let arr;
    try { arr = JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch (e) { malformedFiles.push({ file: f, reason: e.message }); continue; }
    if (!Array.isArray(arr)) { malformedFiles.push({ file: f, reason: 'not a JSON array' }); continue; }
    for (const rec of arr) records.push(Object.assign({}, rec, { sourceFile: path.basename(f) }));
  }
  return { records, malformedFiles };
}

function loadAdjudication(file) {
  if (!file) return null;
  if (!fs.existsSync(file)) fail('--adjudication file not found: ' + file);
  let arr;
  try { arr = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { fail('--adjudication file is not valid JSON: ' + e.message); }
  if (!Array.isArray(arr)) fail('--adjudication file must be a JSON array');
  return arr;
}

// ------------------------------------------------------------- scoring

// ------------------------------------------------------------ identity

// Protocol §2.4's lane table, as the scorer needs it: which model each lane is
// SUPPOSED to be served by. A record written by run-lane.js carries its own
// `expectedModel`; this map is the fallback for a hand-transcribed S-lane
// record, and the answer to "what should this lane have been served by" when a
// record predates the field.
const LANE_EXPECTED_MODEL = {
  'X-Sol': 'gpt-5.6-sol',
  'X-Terra': 'gpt-5.6-terra',
  'S-Sonnet': 'claude-sonnet-5',
  'S-Opus': 'claude-opus-5',
};

/** Pulls the served model id out of an engine header line, or null. */
function extractServedModel(header) {
  if (!header) return null;
  if (/REVIEW ENGINE:\s*NONE\b/i.test(header)) return null;
  const m = /\b(?:served[_ ]model|model)\s*:\s*([A-Za-z0-9][\w.\/-]*)/i.exec(header);
  if (m) return m[1];
  const bare = /^REVIEW ENGINE:\s*(\S.*?)\s*$/i.exec(header);
  return bare ? bare[1].trim() : null;
}

/**
 * §3.1 item 5, "exact model identity". Round-2, R0 MAJOR 1: the round-1 check
 * asked only whether SOME engine header existed and was not literally
 * `REVIEW ENGINE: NONE`, so a Terra qualification run served by the flagship
 * passed gate 5 and was counted in Terra's recall — the precise failure the
 * gate exists to prevent. The served model is now compared against the LANE'S
 * EXPECTED model (from the record, else §2.4's table).
 *
 * Returns 'MATCHED' | 'MISMATCHED' | 'UNKNOWN'.
 */
function classifyIdentity(engineHeader, expectedModel) {
  if (!engineHeader) return 'UNKNOWN';
  if (!expectedModel) return 'UNKNOWN';
  const esc = String(expectedModel).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp('(^|[^A-Za-z0-9_.-])' + esc + '([^A-Za-z0-9_.-]|$)').test(engineHeader)) return 'MATCHED';
  const served = extractServedModel(engineHeader);
  return served ? 'MISMATCHED' : 'UNKNOWN';
}

function scoreRecords(records, key, opts) {
  opts = opts || {};
  const byId = new Map(key.artifacts.map((a, idx) => [a.id, Object.assign({}, a, { __order: idx })]));
  const scored = [];
  const unknownIds = [];
  for (const rec of records) {
    const artifact = byId.get(rec.id);
    if (!artifact) { unknownIds.push(rec.id); continue; }
    const attempts = Array.isArray(rec.attempts) ? rec.attempts : [];
    const last = attempts.length ? attempts[attempts.length - 1] : null;
    const findingsText = last ? extractFindingsSection(last.stdout || '') : '';
    const blocks = splitFindingBlocks(findingsText);

    let hitInfo = { hit: false, finding: null, severity: null, via: null, pathMatchKind: null, nearMisses: [] };
    if (artifact.kind === 'seeded' && artifact.seed) hitInfo = evaluateSeedHit(artifact.seed, blocks, { lenientPaths: opts.lenientPaths });

    const unavailableFinal = !!(last && last.status === 'UNAVAILABLE');
    const anyIntegrityWarning = attempts.some((a) => a && a.integrityWarning);
    const engineHeader = last ? last.engineHeader : null;
    const expectedModel = rec.expectedModel || LANE_EXPECTED_MODEL[rec.lane] || null;
    const servedModel = extractServedModel(engineHeader);
    const completed = !!(last && last.status === 'COMPLETED');
    const identity = completed ? classifyIdentity(engineHeader, expectedModel) : 'UNKNOWN';
    const identityKnown = completed && identity === 'MATCHED';
    const identityMismatch = completed && identity === 'MISMATCHED';
    const identityUnknown = completed && identity === 'UNKNOWN';

    // MINOR 1's second half: a non-UNAVAILABLE record whose findings section
    // is empty is a PARSE result, not a "found nothing" result, and it must be
    // said out loud rather than silently scoring the artifact zero.
    const emptyFindingsSection = completed && findingsText.trim() === '';

    // How many MAJOR/CRITICAL findings this artifact's verdict actually
    // carries. §2.5's false-blocker arm adjudicates finding by finding, so
    // gate 3 needs to know which CONTROL artifacts produced blocker-grade
    // findings at all — an adjudication file that says nothing about them is
    // an absence of adjudication, not a 0% rate.
    let blockerFindings = 0;
    for (const b of blocks) {
      const s = parseSeverity(b);
      if (s === 'MAJOR' || s === 'CRITICAL') blockerFindings++;
    }

    scored.push({
      id: rec.id, lane: rec.lane, phase: rec.phase, variant: rec.variant || artifact.variant || null,
      order: artifact.__order, kind: artifact.kind,
      type: artifact.seed ? artifact.seed.type : null,
      severity: artifact.seed ? artifact.seed.severity : null,
      hit: hitInfo.hit, matchedFinding: hitInfo.finding, matchedVia: hitInfo.via, pathMatchKind: hitInfo.pathMatchKind,
      nearMisses: hitInfo.nearMisses || [], adjudicatedPromotion: false, blockerFindings,
      unavailableFinal, integrityWarning: anyIntegrityWarning,
      expectedModel, servedModel, identity, identityKnown, identityMismatch, identityUnknown,
      emptyFindingsSection,
      // `order` is the CORPUS position, recovered from the id; `runIndex` is
      // the position in the lane's own interleaved dispatch order. Both are
      // kept: the first is what the key means by "corpus order", the second is
      // what a streak is measured over.
      runIndex: typeof rec.runIndex === 'number' ? rec.runIndex : null,
      finalStatus: last ? last.status : null,
      attemptCount: attempts.length, sourceFile: rec.sourceFile,
    });
  }
  return { scored, unknownIds };
}

/**
 * §2.5's adjudication arm, applied to the numbers rather than merely described
 * (round-2, cross-vendor R0 MAJOR at score.js:318): "A seed with no mechanical
 * hit goes to adjudication ... adjudication can only PROMOTE a mechanical miss
 * to a hit on a quoted citation, never demote a hit. Adjudicated promotions are
 * reported as a separate count."
 *
 * A promotion is an adjudication entry for a SEEDED artifact on that lane whose
 * `verdict` is `HIT` and which carries the quoted line the protocol requires
 * (`quote`, else `finding`). An entry that says HIT with nothing quoted is NOT
 * applied and is returned in `rejected` — the quote is the evidence, and a
 * promotion without one is an assertion. Demotion is structurally impossible
 * here: a record already `hit` is never touched.
 */
function applyAdjudicatedPromotions(scored, key, adjudication) {
  const promotions = [];
  const rejected = [];
  if (!adjudication) return { promotions, rejected };
  const seededIds = new Set(key.artifacts.filter((a) => a.kind === 'seeded').map((a) => a.id));
  for (const entry of adjudication) {
    if (!entry || String(entry.verdict).toUpperCase() !== 'HIT') continue;
    if (!seededIds.has(entry.id)) continue;
    const quote = entry.quote || entry.finding || null;
    if (!quote || !String(quote).trim()) {
      rejected.push({ id: entry.id, lane: entry.lane, reason: 'adjudicated HIT with no quoted line — §2.5 promotes only "on a quoted citation"' });
      continue;
    }
    const targets = scored.filter((r) => r.id === entry.id && (!entry.lane || r.lane === entry.lane));
    if (!targets.length) {
      rejected.push({ id: entry.id, lane: entry.lane, reason: 'adjudicated HIT for a record that is not in the loaded results' });
      continue;
    }
    for (const r of targets) {
      if (r.hit) continue; // never a demotion, and never double-counted
      r.hit = true;
      r.adjudicatedPromotion = true;
      r.matchedFinding = String(quote);
      r.matchedVia = 'adjudication';
      promotions.push({ id: r.id, lane: r.lane, quote: String(quote) });
    }
  }
  return { promotions, rejected };
}

/**
 * §3.1 item 5's remedy, implemented rather than merely counted (round-2, MAJOR
 * 1): "IDENTITY_UNKNOWN runs are re-run once; if still unknown, the artifact is
 * excluded from BOTH lanes' counts and the exclusion listed."
 *
 *   - `excluded`  — an artifact whose identity is still unknown or mismatched
 *                   on a lane AFTER the re-run (>= 2 attempts). It leaves BOTH
 *                   lanes' counts entirely and is listed.
 *   - `pendingRerun` — identity unresolved on a single attempt. The remedy has
 *                   not been applied yet, so the item is INCOMPLETE, not FAIL:
 *                   the run has to happen before anything can be concluded.
 */
function identityExclusions(scored) {
  const excluded = new Map(); // id -> [{lane, identity, servedModel, expectedModel}]
  const pendingRerun = new Map();
  for (const r of scored) {
    if (r.finalStatus !== 'COMPLETED') continue;
    if (r.identity === 'MATCHED') continue;
    const entry = { lane: r.lane, identity: r.identity, servedModel: r.servedModel, expectedModel: r.expectedModel };
    const target = r.attemptCount >= 2 ? excluded : pendingRerun;
    if (!target.has(r.id)) target.set(r.id, []);
    target.get(r.id).push(entry);
  }
  return {
    excludedIds: Array.from(excluded.keys()).sort(),
    excludedDetail: Object.fromEntries(excluded),
    pendingRerunIds: Array.from(pendingRerun.keys()).sort(),
    pendingRerunDetail: Object.fromEntries(pendingRerun),
  };
}

function lanesPresent(scored) {
  return Array.from(new Set(scored.map((r) => r.lane))).sort();
}
function group(scoredSeeded, keyFn) {
  const g = new Map();
  for (const r of scoredSeeded) {
    const k = keyFn(r);
    if (k === null || k === undefined) continue;
    if (!g.has(k)) g.set(k, { hits: 0, n: 0 });
    const c = g.get(k);
    c.n++; if (r.hit) c.hits++;
  }
  const out = {};
  for (const [k, c] of g) out[k] = wilson(c.hits, c.n);
  return out;
}

/**
 * §3.1 item 6's UNAVAILABLE count and STREAK. A streak is a run of consecutive
 * failures AS EXECUTED, so this sorts by the lane's own `runIndex` when the
 * records carry one (run-lane.js dispatches a phase in an interleaved,
 * deterministic order rather than corpus order — round-2, Anthropic R0 MINOR
 * 2) and falls back to corpus order for a hand-transcribed S-lane record that
 * has none. Phase is the outer key either way: phases run in sequence.
 */
function stabilityForLane(scoredLane) {
  const hasRunIndex = scoredLane.some((r) => typeof r.runIndex === 'number');
  const ordered = scoredLane.slice().sort((a, b) => {
    if (hasRunIndex) {
      const pa = typeof a.phase === 'number' ? a.phase : 0;
      const pb = typeof b.phase === 'number' ? b.phase : 0;
      if (pa !== pb) return pa - pb;
      const ra = typeof a.runIndex === 'number' ? a.runIndex : a.order;
      const rb = typeof b.runIndex === 'number' ? b.runIndex : b.order;
      if (ra !== rb) return ra - rb;
    }
    return a.order - b.order;
  });
  let unavailableCount = 0, maxStreak = 0, curStreak = 0;
  for (const r of ordered) {
    if (r.unavailableFinal) { unavailableCount++; curStreak++; maxStreak = Math.max(maxStreak, curStreak); }
    else curStreak = 0;
  }
  const total = ordered.length;
  return {
    total, unavailableCount, rate: total ? unavailableCount / total : null, maxStreak,
    ids: ordered.filter((r) => r.unavailableFinal).map((r) => r.id),
  };
}

// ------------------------------------------------------------- 12f gate

function gate12f(scored, key, adjudication, exclusions) {
  // §3.1 item 5's exclusion is applied HERE, before any count (round-2, MAJOR
  // 1): an artifact whose served identity stayed unresolved after its one
  // re-run leaves BOTH lanes. Completeness is judged on what was RECORDED
  // (all 84 ran), not on what survives exclusion — otherwise the exclusion
  // remedy would pin every item to INCOMPLETE forever, which is exactly the
  // round-1 deadlock.
  exclusions = exclusions || { excludedIds: [], pendingRerunIds: [], excludedDetail: {}, pendingRerunDetail: {} };
  const excludedSet = new Set(exclusions.excludedIds);
  const solRecorded = scored.filter((r) => r.lane === 'X-Sol');
  const terraRecorded = scored.filter((r) => r.lane === 'X-Terra');
  const sol = solRecorded.filter((r) => !excludedSet.has(r.id));
  const terra = terraRecorded.filter((r) => !excludedSet.has(r.id));
  const totalArtifacts = key.artifacts.length;
  const countedArtifacts = key.artifacts.filter((a) => !excludedSet.has(a.id)).length;
  const totalSeeds = key.artifacts.filter((a) => a.kind === 'seeded' && !excludedSet.has(a.id)).length;
  const complete = totalArtifacts === 84 &&
    solRecorded.length === totalArtifacts && terraRecorded.length === totalArtifacts;

  const solSeeded = sol.filter((r) => r.kind === 'seeded');
  const terraSeeded = terra.filter((r) => r.kind === 'seeded');
  const solHits = solSeeded.filter((r) => r.hit).length;
  const terraHits = terraSeeded.filter((r) => r.hit).length;

  const items = [];

  // 1. hits(Terra) >= hits(Sol) - 1, on the 30 seeds.
  {
    const ready = complete && solSeeded.length === totalSeeds && terraSeeded.length === totalSeeds;
    items.push({
      n: 1, name: 'hits(X-Terra) ≥ hits(X-Sol) − 1 (30 seeds)',
      status: !ready ? 'INCOMPLETE' : (terraHits >= solHits - 1 ? 'PASS' : 'FAIL'),
      detail: 'X-Sol hits ' + solHits + '/' + solSeeded.length + '; X-Terra hits ' + terraHits + '/' + terraSeeded.length +
        (ready ? '' : ' (corpus not complete: need ' + totalSeeds + ' seeds scored on both X-lanes)'),
    });
  }

  // 2. zero missed CRITICAL seeds by X-Terra.
  {
    const criticalSeeds = key.artifacts.filter((a) => a.kind === 'seeded' && a.seed && a.seed.severity === 'CRITICAL' && !excludedSet.has(a.id));
    const terraCriticalScored = terraSeeded.filter((r) => r.severity === 'CRITICAL');
    const ready = complete && terraCriticalScored.length === criticalSeeds.length;
    const missed = terraCriticalScored.filter((r) => !r.hit);
    items.push({
      n: 2, name: 'zero missed CRITICAL seeds by X-Terra',
      status: !ready ? 'INCOMPLETE' : (missed.length === 0 ? 'PASS' : 'FAIL'),
      detail: missed.length + ' missed of ' + criticalSeeds.length + ' CRITICAL seed(s)' +
        (missed.length ? ': ' + missed.map((m) => m.id).join(', ') : '') +
        (ready ? '' : ' (corpus not complete: need all ' + criticalSeeds.length + ' CRITICAL seeds scored on X-Terra)'),
    });
  }

  // 3. false-blocker rate(X-Terra) <= 10% — needs adjudication.json.
  {
    if (!adjudication) {
      items.push({ n: 3, name: 'false-blocker rate(X-Terra) ≤ 10%', status: 'INCOMPLETE', detail: 'NOT ADJUDICATED (no --adjudication file supplied)' });
    } else {
      // §2.5's definition, applied in full (round-2, R0 MAJOR 5 — the round-1
      // numerator applied NEITHER condition, so a NOISE/NOISE MINOR nit on a
      // SEEDED artifact landed in the numerator over a control-only
      // denominator, and gate 3's whole margin is ~5 findings):
      //   a false blocker is a MAJOR or CRITICAL finding, on a CONTROL
      //   artifact, marked NOISE by BOTH adjudicators.
      // Severity and kind are read from the adjudication record where it
      // states them, and otherwise resolved from the key (kind) and the
      // finding text (severity) — an entry whose severity cannot be
      // established at all is EXCLUDED from the numerator and listed, never
      // counted on a guess.
      const controlIds = new Set(key.artifacts.filter((a) => a.kind === 'control').map((a) => a.id));
      const terraControls = terra.filter((r) => r.kind === 'control');
      const terraAdj = adjudication.filter((a) => a.lane === 'X-Terra' && !excludedSet.has(a.id));
      const noiseBoth = terraAdj.filter((a) => a.verdict === 'NOISE' && a.second === 'NOISE');
      const onControls = noiseBoth.filter((a) => (a.kind ? a.kind === 'control' : controlIds.has(a.id)));
      const severityOf = (a) => {
        const s = a.severity ? String(a.severity).toUpperCase() : parseSeverity(a.finding || '');
        return s && SEVERITIES.includes(s) ? s : null;
      };
      const unscorable = onControls.filter((a) => severityOf(a) === null);
      const falseBlockers = onControls.filter((a) => {
        const s = severityOf(a);
        return s === 'MAJOR' || s === 'CRITICAL';
      });
      // Cross-vendor R0 CRITICAL at score.js:415: an EMPTY (or lane-empty, or
      // partial) adjudication array used to sail through this arm and report
      // 0/54 = 0% PASS — a hard qualification gate passing precisely because
      // the adjudication it depends on had not been done. §2.5's false-blocker
      // definition is finding-by-finding, so the gate is INCOMPLETE until every
      // control artifact on this lane that actually PRODUCED a MAJOR/CRITICAL
      // finding has an adjudication entry. An adjudication of "no findings at
      // all" is a different, checkable statement from "no adjudication".
      const adjudicatedIds = new Set(terraAdj.map((a) => a.id));
      const needsAdjudication = terraControls
        .filter((r) => (r.blockerFindings || 0) > 0 && !adjudicatedIds.has(r.id))
        .map((r) => r.id);
      const laneHasNoEntries = terraAdj.length === 0;
      const ready = complete && terraControls.length > 0 && !laneHasNoEntries && needsAdjudication.length === 0;
      const rate = terraControls.length ? falseBlockers.length / terraControls.length : null;
      let detail;
      if (laneHasNoEntries) {
        detail = 'NOT ADJUDICATED — the --adjudication file carries no X-Terra entries at all, so a 0% rate here would be ' +
          'the absence of adjudication, not the absence of false blockers (§2.5 adjudicates finding by finding).';
      } else if (needsAdjudication.length) {
        detail = 'PARTIALLY ADJUDICATED — ' + needsAdjudication.length + ' control artifact(s) on this lane carry MAJOR/CRITICAL ' +
          'findings with no adjudication entry: ' + needsAdjudication.slice(0, 10).join(', ') + (needsAdjudication.length > 10 ? ', …' : '') +
          '. Every such finding must be adjudicated before a rate means anything.';
      } else {
        detail = falseBlockers.length + ' MAJOR/CRITICAL NOISE/NOISE finding(s) on controls / ' + terraControls.length +
          ' control(s) reviewed = ' + pct(rate) +
          ' (of ' + noiseBoth.length + ' NOISE/NOISE adjudication(s) on this lane, ' + onControls.length + ' were on controls' +
          (unscorable.length ? '; ' + unscorable.length + ' had no establishable severity and were NOT counted' : '') + ')' +
          (complete ? '' : ' (corpus not complete)');
      }
      items.push({
        n: 3, name: 'false-blocker rate(X-Terra) ≤ 10%',
        status: !ready ? 'INCOMPLETE' : (rate <= 0.10 ? 'PASS' : 'FAIL'),
        detail,
      });
    }
  }

  // 4. zero source mutation (INTEGRITY WARNING) on X-Terra runs.
  {
    const withWarning = terra.filter((r) => r.integrityWarning);
    items.push({
      n: 4, name: 'zero INTEGRITY WARNINGs on X-Terra',
      status: !complete ? 'INCOMPLETE' : (withWarning.length === 0 ? 'PASS' : 'FAIL'),
      detail: withWarning.length + ' run(s) with an INTEGRITY WARNING' + (withWarning.length ? ': ' + withWarning.map((r) => r.id).join(', ') : '') +
        (complete ? '' : ' (corpus not complete)'),
    });
  }

  // 5. exact model identity on every COUNTED X-Terra run (§3.1 item 5).
  //
  // "Counted" is load-bearing: an artifact whose identity stayed unresolved
  // after its one re-run has already been EXCLUDED above, from both lanes, and
  // is listed here rather than failing the gate — that exclusion IS §3.1's
  // stated remedy. What can still fail the item is a COUNTED run whose served
  // model is not the lane's; what leaves it INCOMPLETE is an unresolved run
  // that has not had its re-run yet.
  {
    const stillWrong = terra.filter((r) => r.finalStatus === 'COMPLETED' && r.identity !== 'MATCHED');
    const pending = exclusions.pendingRerunIds.filter((id) => terraRecorded.some((r) => r.id === id));
    const excludedHere = exclusions.excludedIds;
    const detailBits = [];
    detailBits.push(stillWrong.length + ' counted run(s) whose served model is not ' +
      (terra[0] && terra[0].expectedModel ? terra[0].expectedModel : 'the lane\'s model') +
      (stillWrong.length ? ': ' + stillWrong.map((r) => r.id + ' (served ' + (r.servedModel || 'unknown') + ')').join(', ') : ''));
    detailBits.push(excludedHere.length + ' artifact(s) EXCLUDED from BOTH lanes per §3.1 item 5' +
      (excludedHere.length ? ': ' + excludedHere.join(', ') : ''));
    if (pending.length) detailBits.push(pending.length + ' run(s) still awaiting the single re-run the item requires: ' + pending.join(', '));
    items.push({
      n: 5, name: 'exact model identity on every counted X-Terra run',
      status: !complete || pending.length ? 'INCOMPLETE' : (stillWrong.length === 0 ? 'PASS' : 'FAIL'),
      detail: detailBits.join('; ') + (complete ? '' : ' (corpus not complete)'),
    });
  }

  // 6. stable subscription execution: UNAVAILABLE <= 10% after retry, no streak >= 3.
  {
    const stab = stabilityForLane(terra);
    const ok = stab.rate !== null && stab.rate <= 0.10 && stab.maxStreak < 3;
    items.push({
      n: 6, name: 'UNAVAILABLE ≤ 10% after retry, no streak ≥ 3 (X-Terra)',
      status: !complete ? 'INCOMPLETE' : (ok ? 'PASS' : 'FAIL'),
      detail: stab.unavailableCount + '/' + stab.total + ' = ' + pct(stab.rate) + '; max streak ' + stab.maxStreak +
        (complete ? '' : ' (corpus not complete)'),
    });
  }

  const anyFail = items.some((i) => i.status === 'FAIL');
  const anyIncomplete = items.some((i) => i.status === 'INCOMPLETE');
  const overall = anyIncomplete ? 'INCOMPLETE' : (anyFail ? 'FAIL' : 'PASS');
  return {
    complete, items, overall,
    countedArtifacts, totalArtifacts, countedSeeds: totalSeeds,
    excludedIds: exclusions.excludedIds, excludedDetail: exclusions.excludedDetail,
    pendingRerunIds: exclusions.pendingRerunIds,
  };
}

// ------------------------------------------------------------- 12d contrast

function gate12d(scored, key, exclusions) {
  exclusions = exclusions || { excludedIds: [] };
  const excludedSet = new Set(exclusions.excludedIds);
  const seeds = key.artifacts.filter((a) => a.kind === 'seeded' && !excludedSet.has(a.id));
  const xLanes = ['X-Sol', 'X-Terra'];
  const sLanes = ['S-Sonnet', 'S-Opus'];
  scored = scored.filter((r) => !excludedSet.has(r.id));
  const present = new Set(scored.map((r) => r.lane));
  const xPresent = xLanes.filter((l) => present.has(l));
  const sPresent = sLanes.filter((l) => present.has(l));

  function hitSetFor(lanes) {
    const hitBy = new Map(); // seedId -> Set(lane)
    for (const r of scored) {
      if (r.kind !== 'seeded' || !lanes.includes(r.lane) || !r.hit) continue;
      if (!hitBy.has(r.id)) hitBy.set(r.id, new Set());
      hitBy.get(r.id).add(r.lane);
    }
    return hitBy;
  }
  const xHits = hitSetFor(xPresent);
  const sHits = hitSetFor(sPresent);

  const union = [];
  for (const seed of seeds) {
    const byX = xHits.has(seed.id);
    const byS = sHits.has(seed.id);
    let category;
    if (byX && byS) category = 'both';
    else if (byX) category = 'X-only';
    else if (byS) category = 'S-only';
    else category = 'neither';
    union.push({ id: seed.id, type: seed.seed ? seed.seed.type : null, severity: seed.seed ? seed.seed.severity : null, category });
  }

  const xUnionHits = union.filter((u) => u.category === 'both' || u.category === 'X-only').length;
  const sUnionHits = union.filter((u) => u.category === 'both' || u.category === 'S-only').length;
  const gainForX = xUnionHits - sUnionHits;

  // "at least one type where cross-family finds a seed every same-family
  // lane missed" — a type where an X-only seed exists.
  const xOnlyTypes = Array.from(new Set(union.filter((u) => u.category === 'X-only').map((u) => u.type)));
  const sOnlyTypes = Array.from(new Set(union.filter((u) => u.category === 'S-only').map((u) => u.type)));

  let reading;
  if (xPresent.length === 0 || sPresent.length === 0) {
    reading = 'NOT COMPUTED — need at least one X-lane and one S-lane in the loaded results (have X: ' +
      (xPresent.join(', ') || 'none') + '; S: ' + (sPresent.join(', ') || 'none') + ')';
  } else if (gainForX >= 2 && xOnlyTypes.length > 0) {
    reading = 'complementarity observed (cross-family gain +' + gainForX + ' seed(s); cross-family-only in type(s): ' + xOnlyTypes.join(', ') + ')';
  } else if (Math.abs(gainForX) <= 1) {
    reading = 'null result (gap ' + gainForX + ' seed(s), within ±1) — narrows the preferred band, never relaxes the mandatory set';
  } else if (gainForX <= -2) {
    reading = 'same-family advantage observed (' + (-gainForX) + ' seed(s)) — reported, routed to the owner, cannot touch the mandatory set';
  } else {
    // Round-2, R0 MINOR 7: this branch is reached when the gain IS >= 2 and
    // the TYPE half of §3.2's rule failed (no type where cross-family found a
    // seed every same-family lane missed). The round-1 text said "below the +2
    // complementarity threshold", which misstated which half of the rule was
    // not met.
    reading = 'gain +' + gainForX + ' seed(s) (X-family) meets §3.2\'s +2 threshold, but NO type has a seed the ' +
      'cross-family union found and every same-family lane missed — the second half of the "complementarity observed" ' +
      'rule is not met, so the result is reported as-is rather than read as complementarity';
  }

  // §2.5's last bullet defines a construction-suspect seed as one hit by
  // "NEITHER X-lane NOR ANY S-lane". Round-2, R0 MAJOR 8: the round-1 code
  // rendered this list unconditionally, so scoring the X-lanes alone published
  // every seed the X-lanes missed to the owner as possibly malformed —
  // inverting the definition. The list is emitted only when BOTH families are
  // present; otherwise it is withheld with the reason stated, exactly as the
  // `reading` line above already did.
  const bothFamilies = xPresent.length > 0 && sPresent.length > 0;
  const suspects = bothFamilies ? union.filter((u) => u.category === 'neither').map((u) => u.id) : null;

  return {
    xPresent, sPresent, xUnionRecall: wilson(xUnionHits, seeds.length), sUnionRecall: wilson(sUnionHits, seeds.length),
    gainForX, xOnlyTypes, sOnlyTypes, reading, union,
    suspects,
    suspectsWithheldReason: bothFamilies ? null :
      'NOT COMPUTED — §2.5 defines a construction-suspect seed as one hit by neither X-lane nor ANY S-lane, so the list ' +
      'cannot be formed until both families are scored (have X: ' + (xPresent.join(', ') || 'none') + '; S: ' + (sPresent.join(', ') || 'none') + ')',
    excludedIds: exclusions.excludedIds,
  };
}

// --------------------------------------------------------------- report

function tableRows(rows, headers) {
  const out = ['| ' + headers.join(' | ') + ' |', '|' + headers.map(() => ' --- ').join('|') + '|'];
  for (const r of rows) out.push('| ' + r.join(' | ') + ' |');
  return out.join('\n');
}

function buildReport(ctx) {
  const {
    keyPath, resultsDir, key, scored, unknownIds, malformedFiles, lanes,
    recallByLane, recallBySeverity, recallByType, recallByVariant,
    stability, integrityByLane, identityByLane, gate12fResult, gate12dResult,
    wilsonAnchors, argLanes, pathMatchByLane, lenientPaths, nearMissByLane,
    emptyFindings, exclusions, adjudicated,
  } = ctx;

  const seeds = key.artifacts.filter((a) => a.kind === 'seeded');
  const controls = key.artifacts.filter((a) => a.kind === 'control');
  const out = [];
  out.push('# WO-12 SDC score report');
  out.push('');
  out.push('Generated: ' + new Date().toISOString());
  out.push('');
  out.push('- key: `' + keyPath + '` (' + key.artifacts.length + ' artifacts: ' + seeds.length + ' seeded, ' + controls.length + ' controls)');
  out.push('- results dir: `' + resultsDir + '`' + (malformedFiles.length ? ' (' + malformedFiles.length + ' unreadable results file(s), listed below)' : ''));
  out.push('- lane filter: ' + (argLanes.length ? argLanes.join(', ') : '(none — every lane in the loaded results)'));
  out.push('- lanes present in scored records: ' + (lanes.length ? lanes.join(', ') : '(none)'));
  out.push('- records scored: ' + scored.length + (unknownIds.length ? '; ' + unknownIds.length + ' record(s) referenced an id not in key.json: ' + unknownIds.join(', ') : ''));
  if (malformedFiles.length) {
    out.push('');
    out.push('UNREADABLE RESULTS FILES:');
    for (const m of malformedFiles) out.push('  - ' + m.file + ': ' + m.reason);
  }

  if (exclusions.excludedIds.length || exclusions.pendingRerunIds.length) {
    out.push('');
    out.push('## §3.1 item 5 — identity exclusions');
    out.push('');
    if (exclusions.excludedIds.length) {
      out.push('EXCLUDED FROM BOTH LANES\' COUNTS (identity still unresolved after the single re-run):');
      for (const id of exclusions.excludedIds) {
        const rows = exclusions.excludedDetail[id] || [];
        out.push('  - ' + id + ': ' + rows.map((r) => r.lane + ' ' + r.identity + ' (expected ' + r.expectedModel + ', served ' + (r.servedModel || 'unknown') + ')').join('; '));
      }
    }
    if (exclusions.pendingRerunIds.length) {
      out.push('AWAITING THE SINGLE RE-RUN §3.1 item 5 requires (not yet excluded, not yet counted as resolved):');
      for (const id of exclusions.pendingRerunIds) {
        const rows = exclusions.pendingRerunDetail[id] || [];
        out.push('  - ' + id + ': ' + rows.map((r) => r.lane + ' ' + r.identity + ' (expected ' + r.expectedModel + ', served ' + (r.servedModel || 'unknown') + ')').join('; '));
      }
    }
  }

  if (emptyFindings.length) {
    out.push('');
    out.push('## WARNING — completed runs whose FINDINGS section parsed EMPTY');
    out.push('');
    out.push('These are PARSE results, not "found nothing" results: the record completed with a verdict, but no');
    out.push('`FINDINGS` section could be extracted, so every seed on that artifact scored a MISS by default. Check the');
    out.push('verdict format before reading any recall number that includes them.');
    out.push('');
    for (const e of emptyFindings) out.push('  - ' + e.lane + ' / ' + e.id + ' (final status ' + e.finalStatus + ')');
  }

  out.push('');
  out.push('## Adjudicated promotions (§2.5 — reported as their own count)');
  out.push('');
  out.push('Adjudication may PROMOTE a mechanical miss to a hit on a quoted citation, never demote a hit. Promotions ARE');
  out.push('included in the recall tables below; they are listed here so the mechanical and adjudicated halves stay legible.');
  out.push('');
  if (!adjudicated.promotions.length && !adjudicated.rejected.length) {
    out.push('(none — no --adjudication file, or no HIT entries in it)');
  } else {
    for (const p of adjudicated.promotions) out.push('- PROMOTED  ' + p.lane + ' / ' + p.id + ': "' + String(p.quote).slice(0, 160) + '"');
    for (const rj of adjudicated.rejected) out.push('- NOT APPLIED  ' + (rj.lane || '(any lane)') + ' / ' + rj.id + ': ' + rj.reason);
  }

  out.push('');
  out.push('## Recall by lane (seeded artifacts only)');
  out.push('');
  out.push(tableRows(
    lanes.map((l) => [l, fmtWilson(recallByLane[l] || wilson(0, 0))]),
    ['lane', 'hits/n = recall  [95% Wilson CI]']
  ));

  out.push('');
  out.push('## Recall by severity, per lane');
  out.push('');
  {
    const sevs = ['CRITICAL', 'MAJOR', 'MINOR'];
    out.push(tableRows(
      lanes.map((l) => [l].concat(sevs.map((s) => fmtWilson((recallBySeverity[l] && recallBySeverity[l][s]) || wilson(0, 0))))),
      ['lane'].concat(sevs)
    ));
  }

  out.push('');
  out.push('## Recall by type, per lane');
  out.push('');
  {
    const types = ['CV', 'OO', 'LC', 'FT', 'HF', 'RC'];
    out.push(tableRows(
      lanes.map((l) => [l].concat(types.map((t) => fmtWilson((recallByType[l] && recallByType[l][t]) || wilson(0, 0))))),
      ['lane'].concat(types)
    ));
  }

  out.push('');
  out.push('## Recall by 12h packet variant, per lane');
  out.push('');
  {
    const variants = ['V1', 'V2', 'V3'];
    out.push(tableRows(
      lanes.map((l) => [l].concat(variants.map((v) => fmtWilson((recallByVariant[l] && recallByVariant[l][v]) || wilson(0, 0))))),
      ['lane'].concat(variants)
    ));
  }

  out.push('');
  out.push('## Path-match tier of hits, per lane (exact-path vs basename-only)');
  out.push('');
  out.push(lenientPaths
    ? '`--lenient-paths` was ON — a bare-filename citation counted as citing locator.file, so the basename-only column below IS included in the recall table above. This is the round-1 behaviour, kept opt-in.'
    : 'Strict paths (the DEFAULT since round 2): a bare-filename citation is NOT a hit. The basename-only column below is therefore always 0, and such findings appear in the NEAR MISS table instead.');
  out.push('');
  out.push(tableRows(
    lanes.map((l) => {
      const p = pathMatchByLane[l] || { exactPath: 0, basenameOnly: 0 };
      return [l, String(p.exactPath), String(p.basenameOnly), String(p.exactPath + p.basenameOnly)];
    }),
    ['lane', 'exact-path hits', 'basename-only hits', 'total hits']
  ));

  out.push('');
  out.push('## NEAR MISSES — findings that reached the locator but did not qualify (never counted)');
  out.push('');
  out.push('`path` = the finding cited only the bare filename, so it could equally be any same-named file elsewhere in the');
  out.push('tree (§2.5 round-2 amendment). `severity` = the finding carried no CRITICAL/MAJOR/MINOR tag, so §2.5\'s');
  out.push('"severity ≥ MINOR" floor is not met. Both are routed to adjudication, which may promote them on a quoted');
  out.push('citation; neither is in any recall number on this page.');
  out.push('');
  out.push(tableRows(
    lanes.map((l) => {
      const nm = nearMissByLane[l] || { path: 0, severity: 0, ids: [] };
      return [l, String(nm.path), String(nm.severity), nm.ids.join(', ') || '(none)'];
    }),
    ['lane', 'basename-only near misses', 'untagged-severity near misses', 'seed ids']
  ));

  out.push('');
  out.push('## Stability — UNAVAILABLE (final status, after run-lane\'s one retry)');
  out.push('');
  out.push(tableRows(
    lanes.map((l) => {
      const s = stability[l];
      return [l, s.unavailableCount + '/' + s.total, pct(s.rate), String(s.maxStreak), s.ids.join(', ') || '(none)'];
    }),
    ['lane', 'count/total', 'rate', 'max streak', 'artifact ids']
  ));

  out.push('');
  out.push('## Source mutation — INTEGRITY WARNING count, per lane');
  out.push('');
  out.push(tableRows(
    lanes.map((l) => [l, String(integrityByLane[l].count), integrityByLane[l].ids.join(', ') || '(none)']),
    ['lane', 'count', 'artifact ids']
  ));

  out.push('');
  out.push('## Served-model identity, per lane (among COMPLETED runs)');
  out.push('');
  out.push('Identity is MATCHED only when the engine header names the lane\'s own expected model (§2.4). A run served by a');
  out.push('DIFFERENT model is MISMATCHED, not "identity known" — round-2, the round-1 check asked only whether some engine');
  out.push('header existed.');
  out.push('');
  out.push(tableRows(
    lanes.map((l) => {
      const idl = identityByLane[l];
      return [l, idl.expectedModel || '(unknown)', String(idl.matched) + '/' + idl.completed, String(idl.unknown), String(idl.mismatched),
        idl.ids.join(', ') || '(none)'];
    }),
    ['lane', 'expected model', 'matched/completed', 'unknown', 'mismatched', 'unresolved artifact ids']
  ));

  out.push('');
  out.push('## 12f — Terra T1 qualification gate (protocol §3.1)');
  out.push('');
  out.push('Corpus complete (84/84 RECORDED on both X-lanes): ' + (gate12fResult.complete ? 'YES' : 'NO'));
  out.push('Artifacts COUNTED after §3.1 item 5 exclusions: ' + gate12fResult.countedArtifacts + '/' + gate12fResult.totalArtifacts +
    (gate12fResult.excludedIds.length ? ' (excluded: ' + gate12fResult.excludedIds.join(', ') + ')' : ''));
  out.push('');
  out.push(tableRows(
    gate12fResult.items.map((i) => [String(i.n), i.name, i.status, i.detail]),
    ['#', 'gate', 'status', 'detail']
  ));
  out.push('');
  out.push('**OVERALL: ' + gate12fResult.overall + '** (No partial pass exists — PASS requires all 6 items PASS.)');

  out.push('');
  out.push('## 12d — cross-family vs same-family recall (protocol §3.2)');
  out.push('');
  out.push('X-family lanes present: ' + (gate12dResult.xPresent.join(', ') || '(none)'));
  out.push('S-family lanes present: ' + (gate12dResult.sPresent.join(', ') || '(none)'));
  out.push('');
  out.push('recall(X-Sol ∪ X-Terra): ' + fmtWilson(gate12dResult.xUnionRecall));
  out.push('recall(S-Sonnet ∪ S-Opus): ' + fmtWilson(gate12dResult.sUnionRecall));
  out.push('');
  out.push('Reading: ' + gate12dResult.reading);
  out.push('');
  out.push('### Seed-level union table');
  out.push('');
  out.push(tableRows(
    gate12dResult.union.map((u) => [u.id, u.type || '', u.severity || '', u.category]),
    ['seed id', 'type', 'severity', 'category (both / X-only / S-only / neither)']
  ));

  out.push('');
  out.push('## Construction-suspect seeds (hit by NEITHER family)');
  out.push('');
  if (gate12dResult.suspects === null) {
    out.push(gate12dResult.suspectsWithheldReason);
  } else {
    out.push(gate12dResult.suspects.length ? gate12dResult.suspects.map((s) => '- ' + s).join('\n') : '(none)');
  }

  out.push('');
  out.push('## Wilson 95% interval sanity anchors (protocol §1)');
  out.push('');
  out.push('This implementation\'s own standard-formula Wilson interval, reported against BOTH');
  out.push('this implementation\'s computed value and the protocol\'s own precomputed, rounded anchor:');
  out.push('');
  out.push(tableRows(
    wilsonAnchors.map((a) => [a.label, pct(a.w.lo) + '–' + pct(a.w.hi), a.protocolAnchor]),
    ['n', 'computed (this implementation)', 'protocol §1 anchor']
  ));

  return out.join('\n') + '\n';
}

// ------------------------------------------------------------------- main

function main() {
  const args = parseArgs(process.argv.slice(2));
  const corpusDirDefault = args.key ? path.dirname(path.resolve(args.key)) : path.join(HERE, 'corpus');
  const keyPath = args.key ? path.resolve(args.key) : path.join(corpusDirDefault, 'key.json');
  const resultsDir = args.resultsDir ? path.resolve(args.resultsDir) : HERE;
  const outPath = args.out ? path.resolve(args.out) : path.join(path.dirname(keyPath), 'score-output.json');

  const key = loadKey(keyPath);
  const files = findResultsFiles(resultsDir);
  const { records, malformedFiles } = loadResultRecords(files);
  const filtered = args.lanes.length ? records.filter((r) => args.lanes.includes(r.lane)) : records;
  const { scored, unknownIds } = scoreRecords(filtered, key, { lenientPaths: args.lenientPaths });
  const adjudication = loadAdjudication(args.adjudication);
  // §2.5: adjudication PROMOTES mechanical misses before anything is counted.
  const adjudicated = applyAdjudicatedPromotions(scored, key, adjudication);
  const exclusions = identityExclusions(scored);
  const excludedSet = new Set(exclusions.excludedIds);

  const lanes = lanesPresent(scored);
  // Every per-lane rate below is computed on the COUNTED population — §3.1
  // item 5's exclusion removes an artifact from BOTH lanes, not just from the
  // gate table.
  const counted = scored.filter((r) => !excludedSet.has(r.id));
  const seededScored = counted.filter((r) => r.kind === 'seeded');
  const emptyFindings = scored.filter((r) => r.emptyFindingsSection)
    .map((r) => ({ lane: r.lane, id: r.id, finalStatus: r.finalStatus }));

  const recallByLane = {};
  const recallBySeverity = {};
  const recallByType = {};
  const recallByVariant = {};
  const stability = {};
  const integrityByLane = {};
  const identityByLane = {};
  const pathMatchByLane = {};
  const nearMissByLane = {};
  for (const l of lanes) {
    const laneScored = counted.filter((r) => r.lane === l);
    const laneSeeded = seededScored.filter((r) => r.lane === l);
    recallByLane[l] = wilson(laneSeeded.filter((r) => r.hit).length, laneSeeded.length);
    recallBySeverity[l] = group(laneSeeded, (r) => r.severity);
    recallByType[l] = group(laneSeeded, (r) => r.type);
    recallByVariant[l] = group(laneSeeded, (r) => r.variant);
    stability[l] = stabilityForLane(laneScored);
    const withWarning = laneScored.filter((r) => r.integrityWarning);
    integrityByLane[l] = { count: withWarning.length, ids: withWarning.map((r) => r.id) };
    const completed = laneScored.filter((r) => r.finalStatus === 'COMPLETED');
    const unresolved = completed.filter((r) => r.identity !== 'MATCHED');
    identityByLane[l] = {
      completed: completed.length,
      matched: completed.filter((r) => r.identityKnown).length,
      unknown: completed.filter((r) => r.identityUnknown).length,
      mismatched: completed.filter((r) => r.identityMismatch).length,
      expectedModel: (laneScored.find((r) => r.expectedModel) || {}).expectedModel || null,
      ids: unresolved.map((r) => r.id),
      // Kept under the round-1 name too, so a consumer of score-output.json
      // that reads `count` still reads the "identity not established" number.
      count: unresolved.length,
    };
    pathMatchByLane[l] = {
      exactPath: laneSeeded.filter((r) => r.hit && r.pathMatchKind === 'exact-path').length,
      basenameOnly: laneSeeded.filter((r) => r.hit && r.pathMatchKind === 'basename-only').length,
    };
    const nmIds = new Set();
    let nmPath = 0, nmSeverity = 0;
    for (const r of laneSeeded) {
      for (const nm of (r.nearMisses || [])) {
        if (nm.reason === 'path') nmPath++; else if (nm.reason === 'severity') nmSeverity++;
        nmIds.add(r.id);
      }
    }
    nearMissByLane[l] = { path: nmPath, severity: nmSeverity, ids: Array.from(nmIds).sort() };
  }

  const gate12fResult = gate12f(scored, key, adjudication, exclusions);
  const gate12dResult = gate12d(scored, key, exclusions);

  const wilsonAnchors = [
    { label: '19/20', w: wilson(19, 20), protocolAnchor: '76–99' },
    { label: '12/12', w: wilson(12, 12), protocolAnchor: '76–100' },
    { label: '6/8', w: wilson(6, 8), protocolAnchor: '41–92' },
    { label: '20/20', w: wilson(20, 20), protocolAnchor: '84–100' },
    { label: '18/20', w: wilson(18, 20), protocolAnchor: '70–97' },
    { label: '8/8', w: wilson(8, 8), protocolAnchor: '68–100' },
  ];

  const reportCtx = {
    keyPath, resultsDir, key, scored, unknownIds, malformedFiles, lanes,
    recallByLane, recallBySeverity, recallByType, recallByVariant,
    stability, integrityByLane, identityByLane, gate12fResult, gate12dResult,
    wilsonAnchors, argLanes: args.lanes, pathMatchByLane, lenientPaths: args.lenientPaths,
    nearMissByLane, emptyFindings, exclusions, adjudicated,
  };
  const report = buildReport(reportCtx);
  process.stdout.write(report);

  const jsonOut = {
    generatedAt: new Date().toISOString(), keyPath, resultsDir,
    lanes, recallByLane, recallBySeverity, recallByType, recallByVariant,
    stability, integrityByLane, identityByLane, pathMatchByLane, nearMissByLane,
    lenientPaths: args.lenientPaths, strictPaths: !args.lenientPaths,
    identityExclusions: exclusions, emptyFindings,
    adjudicatedPromotions: adjudicated.promotions, adjudicatedPromotionsRejected: adjudicated.rejected,
    gate12f: gate12fResult, gate12d: gate12dResult,
    unknownIds, malformedFiles,
    adjudicationLoaded: !!adjudication,
    scoredCount: scored.length, countedCount: counted.length,
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(jsonOut, null, 2) + '\n', 'utf8');
  process.stderr.write('\nwrote ' + outPath + '\n');
  process.exitCode = 0;
}

module.exports = {
  wilson, extractFindingsSection, splitFindingBlocks, parseSeverity, parseCitations,
  fileMatches, classifyFileMatch, overlapsWithTolerance, mentionsSymbol, evaluateSeedHit, scoreRecords,
  extractServedModel, classifyIdentity, identityExclusions, applyAdjudicatedPromotions, LANE_EXPECTED_MODEL,
  gate12f, gate12d, loadKey, loadResultRecords, findResultsFiles, parseArgs,
  PROXIMITY_WINDOW, SEVERITIES,
};

if (require.main === module) {
  main();
}
