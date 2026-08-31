#!/usr/bin/env node
/**
 * WO-12 SDC mechanical scorer — protocol §2.5 (scoring), §3.1 (12f gate),
 * §3.2 (12d contrast).
 *
 *   node score.js [--lane <lane>]... [--key <path>] [--results-dir <dir>]
 *       [--adjudication <path>] [--out <path>] [--strict-paths]
 *
 * Reads `key.json` (the sealed corpus) and every `results-*.json` file next
 * to it (each an array of {id, base, head, lane, phase, variant, attempts})
 * and computes, mechanically, from the verdict text alone:
 *
 *   - hits: a FINDINGS-section entry citing a seed's locator.file AND
 *     (a line citation overlapping locator.lines within ±3, OR the finding
 *     text naming locator.symbol) — protocol §2.5. Citation parsing is
 *     DELIBERATELY liberal (path:line, "path ... lines N-M", backticked
 *     paths) because the reviewer prose this reads is not itself structured
 *     data; see parseCitations() below and the wo12 report's ambiguity notes
 *     for what "liberal" was made to mean concretely. The file-citation match
 *     itself is classified into two tiers (classifyFileMatch()): 'exact-path'
 *     (the citation IS the locator path, or a genuine path suffix of it) or
 *     'basename-only' (a last-resort fallback — the citation names only the
 *     bare filename, indistinguishable from any other file sharing that
 *     name). Both counts are reported per lane, in the markdown AND
 *     score-output.json; `--strict-paths` disables the basename-only tier
 *     entirely, so a bare-filename citation no longer counts as citing
 *     locator.file at all.
 *   - recall (hits/seeds), overall / per severity / per type / per lane /
 *     per 12h variant, each with a Wilson 95% interval.
 *   - stability: UNAVAILABLE counts and streaks per lane (final status,
 *     after run-lane's own one retry).
 *   - INTEGRITY WARNING and IDENTITY_UNKNOWN counts per lane.
 *   - the 12f Terra-T1-qualification gate table (§3.1 items 1,2,4,5,6
 *     mechanically; item 3, false-blocker rate, needs `adjudication.json`
 *     [{id, lane, finding, verdict, second}] — absent it prints NOT
 *     ADJUDICATED, never a fabricated PASS/FAIL).
 *   - the 12d cross-family-vs-same-family contrast (§3.2), including the
 *     seed-level union table (which seeds only one family found).
 *   - the construction-suspect list (§2.5 last bullet): seeds no lane, of
 *     either family, ever hit.
 *
 * This is a SCORER, not a gate: it prints a markdown report to stdout,
 * writes `score-output.json` next to `key.json` (or --out), and always
 * exits 0. The gate table's own PASS/FAIL/INCOMPLETE cells are the only
 * place a verdict is rendered; nothing here fails a build.
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

const FINDINGS_END_HEADERS = /^(CLAIMS CHECKED|NITS)\s*$/;

function extractFindingsSection(text) {
  const lines = String(text || '').split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^FINDINGS\s*$/.test(lines[i].trim())) { start = i + 1; break; }
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
// ~80 characters of the file mention.
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
    const window = block.slice(f.index, f.index + 80);
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
//   'basename-only'  — LAST-RESORT liberal fallback: the citation names only
//                      the bare filename, no path at all — still a real
//                      citation of that file, just terse, but indistinguishable
//                      from a citation of any OTHER file sharing that name.
//   null             — no match.
// `--strict-paths` (score.js CLI) disables the basename-only tier entirely.
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

/**
 * Mechanical hit rule (§2.5): a finding cites locator.file AND (a line
 * citation overlaps locator.lines ±3 OR the block names locator.symbol),
 * with a severity present (MINOR is the floor — an untagged block, e.g. from
 * a hand-transcribed S-lane brief that does not follow the exact `[SEVERITY]
 * [BUCKET]` template, is still counted: the protocol reads "severity >=
 * MINOR" as excluding nothing-found, not as requiring the tag literally be
 * present — see the wo12 report's ambiguity note).
 *
 * Every file citation that qualifies a hit is classified 'exact-path' or
 * 'basename-only' (classifyFileMatch above); the hit itself carries that
 * classification as `pathMatchKind` so recall can be reported both ways —
 * a basename-only hit is real but weaker evidence (indistinguishable from a
 * same-named file elsewhere in the tree). `opts.strictPaths` drops the
 * basename-only tier entirely, so a citation that only names the bare
 * filename no longer counts as citing locator.file at all.
 */
function evaluateSeedHit(seed, blocks, opts) {
  opts = opts || {};
  const strict = !!opts.strictPaths;
  for (const block of blocks) {
    const citations = parseCitations(block).map((c) => Object.assign({}, c, { matchKind: classifyFileMatch(c.file, seed.locator.file) }));
    const fileCited = citations.filter((c) => c.matchKind && (!strict || c.matchKind === 'exact-path'));
    if (!fileCited.length) continue;
    const lineHitCitation = fileCited.find((c) => overlapsWithTolerance(c.lineStart, c.lineEnd, seed.locator.lines[0], seed.locator.lines[1], 3));
    const symbolHit = mentionsSymbol(block, seed.locator.symbol);
    if (lineHitCitation || symbolHit) {
      const pathMatchKind = lineHitCitation
        ? lineHitCitation.matchKind
        : (fileCited.some((c) => c.matchKind === 'exact-path') ? 'exact-path' : 'basename-only');
      return { hit: true, finding: block, severity: parseSeverity(block), via: lineHitCitation ? 'line' : 'symbol', pathMatchKind };
    }
  }
  return { hit: false, finding: null, severity: null, via: null, pathMatchKind: null };
}

// -------------------------------------------------------------------- I/O

function fail(msg) {
  process.stderr.write('score: ' + msg + '\n');
  process.exit(1);
}

function usage() {
  return [
    'usage: node score.js [--lane <lane>]... [--key <path>] [--results-dir <dir>]',
    '                      [--adjudication <path>] [--out <path>] [--strict-paths]',
    '',
    '--lane may repeat to restrict scoring to specific lanes; omitted, every',
    '  lane present in the loaded results is scored.',
    '--strict-paths disables the basename-only file-citation fallback: a',
    '  finding that names only a bare filename (no path) no longer counts as',
    '  citing locator.file at all, so it can never contribute a hit.',
    'Always exits 0 — this is a scorer, not a gate. The 12f gate TABLE prints',
    '  PASS / FAIL / INCOMPLETE per item.',
  ].join('\n');
}

function parseArgs(argv) {
  const out = { lanes: [], key: null, resultsDir: null, adjudication: null, out: null, strictPaths: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lane') out.lanes.push(argv[++i]);
    else if (a === '--key') out.key = argv[++i];
    else if (a === '--results-dir') out.resultsDir = argv[++i];
    else if (a === '--adjudication') out.adjudication = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--strict-paths') out.strictPaths = true;
    else if (a === '--help' || a === '-h') { process.stdout.write(usage() + '\n'); process.exit(0); }
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

    let hitInfo = { hit: false, finding: null, severity: null, via: null, pathMatchKind: null };
    if (artifact.kind === 'seeded' && artifact.seed) hitInfo = evaluateSeedHit(artifact.seed, blocks, { strictPaths: opts.strictPaths });

    const unavailableFinal = !!(last && last.status === 'UNAVAILABLE');
    const anyIntegrityWarning = attempts.some((a) => a && a.integrityWarning);
    const engineHeader = last ? last.engineHeader : null;
    const identityKnown = !!(last && last.status === 'COMPLETED' && engineHeader && !/REVIEW ENGINE:\s*NONE/i.test(engineHeader));
    const identityUnknown = !!(last && last.status === 'COMPLETED' && !identityKnown);

    scored.push({
      id: rec.id, lane: rec.lane, phase: rec.phase, variant: rec.variant || artifact.variant || null,
      order: artifact.__order, kind: artifact.kind,
      type: artifact.seed ? artifact.seed.type : null,
      severity: artifact.seed ? artifact.seed.severity : null,
      hit: hitInfo.hit, matchedFinding: hitInfo.finding, matchedVia: hitInfo.via, pathMatchKind: hitInfo.pathMatchKind,
      unavailableFinal, integrityWarning: anyIntegrityWarning,
      identityKnown, identityUnknown, finalStatus: last ? last.status : null,
      attemptCount: attempts.length, sourceFile: rec.sourceFile,
    });
  }
  return { scored, unknownIds };
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

function stabilityForLane(scoredLane) {
  const ordered = scoredLane.slice().sort((a, b) => a.order - b.order);
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

function gate12f(scored, key, adjudication) {
  const sol = scored.filter((r) => r.lane === 'X-Sol');
  const terra = scored.filter((r) => r.lane === 'X-Terra');
  const totalArtifacts = key.artifacts.length;
  const totalSeeds = key.artifacts.filter((a) => a.kind === 'seeded').length;
  const complete = totalArtifacts === 84 && sol.length === totalArtifacts && terra.length === totalArtifacts;

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
    const criticalSeeds = key.artifacts.filter((a) => a.kind === 'seeded' && a.seed && a.seed.severity === 'CRITICAL');
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
      const terraControls = terra.filter((r) => r.kind === 'control');
      const terraAdj = adjudication.filter((a) => a.lane === 'X-Terra');
      const falseBlockers = terraAdj.filter((a) => a.verdict === 'NOISE' && a.second === 'NOISE');
      const ready = complete && terraControls.length > 0;
      const rate = terraControls.length ? falseBlockers.length / terraControls.length : null;
      items.push({
        n: 3, name: 'false-blocker rate(X-Terra) ≤ 10%',
        status: !ready ? 'INCOMPLETE' : (rate <= 0.10 ? 'PASS' : 'FAIL'),
        detail: falseBlockers.length + ' NOISE/NOISE blocker(s) / ' + terraControls.length + ' control(s) reviewed = ' + pct(rate) +
          (ready ? '' : ' (corpus not complete)'),
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

  // 5. exact model identity on every counted X-Terra run.
  {
    const unknown = terra.filter((r) => r.identityUnknown);
    items.push({
      n: 5, name: 'exact model identity on every counted X-Terra run',
      status: !complete ? 'INCOMPLETE' : (unknown.length === 0 ? 'PASS' : 'FAIL'),
      detail: unknown.length + ' IDENTITY_UNKNOWN run(s)' + (unknown.length ? ': ' + unknown.map((r) => r.id).join(', ') : '') +
        (complete ? '' : ' (corpus not complete)'),
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
  return { complete, items, overall };
}

// ------------------------------------------------------------- 12d contrast

function gate12d(scored, key) {
  const seeds = key.artifacts.filter((a) => a.kind === 'seeded');
  const xLanes = ['X-Sol', 'X-Terra'];
  const sLanes = ['S-Sonnet', 'S-Opus'];
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
    reading = 'gain +' + gainForX + ' seed(s) (X-family), below the +2 complementarity threshold and outside the ±1 null band — reported as-is';
  }

  return {
    xPresent, sPresent, xUnionRecall: wilson(xUnionHits, seeds.length), sUnionRecall: wilson(sUnionHits, seeds.length),
    gainForX, xOnlyTypes, sOnlyTypes, reading, union,
    suspects: union.filter((u) => u.category === 'neither').map((u) => u.id),
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
    wilsonAnchors, argLanes, pathMatchByLane, strictPaths,
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
  out.push('## Path-match tier of hits, per lane (exact-path vs basename-only fallback)');
  out.push('');
  out.push('`--strict-paths` was ' + (strictPaths ? 'ON — the basename-only tier is DISABLED; every count below is exact-path.' : 'off — both tiers count toward recall above.'));
  out.push('');
  out.push(tableRows(
    lanes.map((l) => {
      const p = pathMatchByLane[l] || { exactPath: 0, basenameOnly: 0 };
      return [l, String(p.exactPath), String(p.basenameOnly), String(p.exactPath + p.basenameOnly)];
    }),
    ['lane', 'exact-path hits', 'basename-only hits', 'total hits']
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
  out.push('## IDENTITY_UNKNOWN count, per lane (among COMPLETED runs)');
  out.push('');
  out.push(tableRows(
    lanes.map((l) => [l, String(identityByLane[l].count) + '/' + identityByLane[l].completed, identityByLane[l].ids.join(', ') || '(none)']),
    ['lane', 'count/completed', 'artifact ids']
  ));

  out.push('');
  out.push('## 12f — Terra T1 qualification gate (protocol §3.1)');
  out.push('');
  out.push('Corpus complete (84/84 on both X-lanes): ' + (gate12fResult.complete ? 'YES' : 'NO'));
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
  out.push(gate12dResult.suspects.length ? gate12dResult.suspects.map((s) => '- ' + s).join('\n') : '(none)');

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
  const { scored, unknownIds } = scoreRecords(filtered, key, { strictPaths: args.strictPaths });
  const adjudication = loadAdjudication(args.adjudication);

  const lanes = lanesPresent(scored);
  const seededScored = scored.filter((r) => r.kind === 'seeded');

  const recallByLane = {};
  const recallBySeverity = {};
  const recallByType = {};
  const recallByVariant = {};
  const stability = {};
  const integrityByLane = {};
  const identityByLane = {};
  const pathMatchByLane = {};
  for (const l of lanes) {
    const laneScored = scored.filter((r) => r.lane === l);
    const laneSeeded = seededScored.filter((r) => r.lane === l);
    recallByLane[l] = wilson(laneSeeded.filter((r) => r.hit).length, laneSeeded.length);
    recallBySeverity[l] = group(laneSeeded, (r) => r.severity);
    recallByType[l] = group(laneSeeded, (r) => r.type);
    recallByVariant[l] = group(laneSeeded, (r) => r.variant);
    stability[l] = stabilityForLane(laneScored);
    const withWarning = laneScored.filter((r) => r.integrityWarning);
    integrityByLane[l] = { count: withWarning.length, ids: withWarning.map((r) => r.id) };
    const completed = laneScored.filter((r) => r.finalStatus === 'COMPLETED');
    const unknown = completed.filter((r) => r.identityUnknown);
    identityByLane[l] = { count: unknown.length, completed: completed.length, ids: unknown.map((r) => r.id) };
    pathMatchByLane[l] = {
      exactPath: laneSeeded.filter((r) => r.hit && r.pathMatchKind === 'exact-path').length,
      basenameOnly: laneSeeded.filter((r) => r.hit && r.pathMatchKind === 'basename-only').length,
    };
  }

  const gate12fResult = gate12f(scored, key, adjudication);
  const gate12dResult = gate12d(scored, key);

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
    wilsonAnchors, argLanes: args.lanes, pathMatchByLane, strictPaths: args.strictPaths,
  };
  const report = buildReport(reportCtx);
  process.stdout.write(report);

  const jsonOut = {
    generatedAt: new Date().toISOString(), keyPath, resultsDir,
    lanes, recallByLane, recallBySeverity, recallByType, recallByVariant,
    stability, integrityByLane, identityByLane, pathMatchByLane, strictPaths: args.strictPaths,
    gate12f: gate12fResult, gate12d: gate12dResult,
    unknownIds, malformedFiles,
    adjudicationLoaded: !!adjudication,
    scoredCount: scored.length,
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(jsonOut, null, 2) + '\n', 'utf8');
  process.stderr.write('\nwrote ' + outPath + '\n');
  process.exitCode = 0;
}

module.exports = {
  wilson, extractFindingsSection, splitFindingBlocks, parseSeverity, parseCitations,
  fileMatches, classifyFileMatch, overlapsWithTolerance, mentionsSymbol, evaluateSeedHit, scoreRecords,
  gate12f, gate12d, loadKey, loadResultRecords, findResultsFiles,
};

if (require.main === module) {
  main();
}
