#!/usr/bin/env node
/**
 * WO-12 blind-read sampler — protocol §2.7 / amendment (vi).
 *
 *   node blind-draw.js --seed <string> --size <n> [--key <path>]
 *       [--exclude <id,id,…>] [--exclude-file <path>] [--json]
 *
 * Draws `n` SEEDED and `n` CONTROL artifact ids uniformly at random from
 * `corpus/key.json` for a fresh-evaluator blind classification, and prints
 * them. The evaluator is then given only those briefs, renamed and shuffled.
 *
 * ---------------------------------------------------------------- why it exists
 *
 * Amendment (vi) requires the blind test to be re-run after every content
 * change, and the sample has to be drawn by something other than the person who
 * knows the answers. Two properties matter, and both were learned the hard way:
 *
 * 1. **Never both members of a reused-base pair.** §2.1's pool-ran-short
 *    allowance lets one base commit serve a seeded variant AND a control, so
 *    10 pairs of artifacts share a `base` (and, for those pairs, a `commit` and
 *    a `subject`). An evaluator handed BOTH members of such a pair sees the
 *    same parent and the same commit subject under two different packets, and
 *    the synthetic one is the odd one out — a free answer that has nothing to
 *    do with how well the corpus is blinded. Blind test #2 scored 24/24 largely
 *    on exactly this kind of cross-packet linkage. A draw that can hand out both
 *    members is measuring the sampler, not the corpus.
 *
 *    Linkage is computed as a graph, not just as pairs: two artifacts are linked
 *    when they share a `base` OR a `commit`, and the constraint is applied over
 *    connected COMPONENTS, so a chain a–b–c can never contribute two of its
 *    members either.
 *
 * 2. **Deterministic by seed.** The same `--seed` and `--size` always produce
 *    the same draw, on any machine, so a review can state its seed and anyone
 *    can reproduce the exact sample it read. `--exclude` (or `--exclude-file`)
 *    carries the ids a previous round already used, so successive blind reads
 *    do not re-read the same packets.
 *
 * This script READS key.json and writes nothing. It never reveals which drawn
 * id is which kind beyond the two labelled lists it prints — and the caller who
 * runs the blind read is expected to shuffle and rename before handing anything
 * to an evaluator (`--json` exists to make that scripting easy).
 *
 * House rules: zero dependencies, CommonJS, same voice as build-corpus.js /
 * run-lane.js / score.js / assemble-key.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const HERE = __dirname;

function fail(msg) {
  process.stderr.write('blind-draw: ' + msg + '\n');
  process.exit(1);
}

// ------------------------------------------------------------------ random
//
// A seeded PRNG, so a draw is reproducible from its seed string alone. FNV-1a
// to turn the seed into 32 bits, then mulberry32 — both are a few lines, both
// are deterministic across platforms and Node versions, and neither depends on
// `Math.random`, which is exactly what must NOT be used here.

function fnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates, driven by the seeded PRNG. Returns a new array. */
function shuffle(items, rand) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
  }
  return out;
}

// --------------------------------------------------------------- linkage
//
// Two artifacts are LINKED when they share a `base` or a `commit`. Union-find
// over both keys gives the connected components; the draw then takes at most
// one artifact from each.

function linkageComponents(artifacts) {
  const parent = new Map();
  const find = (x) => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r);
    while (parent.get(x) !== r) { const nx = parent.get(x); parent.set(x, r); x = nx; }
    return r;
  };
  const union = (a, b) => {
    const ra = find(a); const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const a of artifacts) parent.set(a.id, a.id);

  const byKey = new Map(); // 'base:<sha>' / 'commit:<sha>' -> first id seen
  for (const a of artifacts) {
    for (const key of [a.base ? 'base:' + a.base : null, a.commit ? 'commit:' + a.commit : null]) {
      if (!key) continue;
      if (byKey.has(key)) union(a.id, byKey.get(key));
      else byKey.set(key, a.id);
    }
  }
  const component = new Map();
  for (const a of artifacts) component.set(a.id, find(a.id));
  return component;
}

/**
 * Draws `size` ids of `kind`, uniformly, skipping any artifact whose linkage
 * component is already represented in `usedComponents` and any id in
 * `excluded`. Returns {picked, shortfall}.
 */
function drawKind(artifacts, kind, size, rand, component, usedComponents, excluded) {
  const pool = shuffle(artifacts.filter((a) => a.kind === kind && !excluded.has(a.id)), rand);
  const picked = [];
  for (const a of pool) {
    if (picked.length >= size) break;
    const comp = component.get(a.id);
    if (usedComponents.has(comp)) continue;
    usedComponents.add(comp);
    picked.push(a.id);
  }
  return { picked, shortfall: size - picked.length };
}

/**
 * The draw. Seeds first, then controls, both against the SAME
 * `usedComponents` set — so a seed and the control that shares its base can
 * never both appear, which is the whole point.
 */
function blindDraw(key, opts) {
  const seed = String(opts.seed);
  const size = opts.size;
  const excluded = new Set(opts.exclude || []);
  const artifacts = key.artifacts;
  const component = linkageComponents(artifacts);
  const rand = mulberry32(fnv1a(seed));
  const usedComponents = new Set();

  const seeded = drawKind(artifacts, 'seeded', size, rand, component, usedComponents, excluded);
  const controls = drawKind(artifacts, 'control', size, rand, component, usedComponents, excluded);

  return {
    seed, size,
    seeded: seeded.picked, controls: controls.picked,
    all: seeded.picked.concat(controls.picked).sort(),
    shortfall: { seeded: seeded.shortfall, control: controls.shortfall },
    excludedCount: excluded.size,
    componentCount: new Set(Array.from(component.values())).size,
  };
}

// ------------------------------------------------------------------- CLI

function usage() {
  return [
    'usage:',
    '  node blind-draw.js --seed <string> --size <n> [--key <path>]',
    '      [--exclude <id,id,…>] [--exclude-file <path>] [--json]',
    '',
    'Draws <n> seeded + <n> control artifact ids from key.json for a blind read.',
    'Deterministic: the same --seed and --size always give the same draw.',
    'Never draws two artifacts that share a base or a commit (§2.1\'s reused-base',
    '  pairs would otherwise hand the evaluator a free answer).',
    '--exclude / --exclude-file carry ids a previous round already used.',
    '--json prints the draw as JSON instead of as two labelled lists.',
  ].join('\n');
}

function parseArgs(argv) {
  const out = { seed: null, size: null, key: null, exclude: [], excludeFile: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seed') out.seed = argv[++i];
    else if (a === '--size') {
      out.size = parseInt(argv[++i], 10);
      if (!Number.isFinite(out.size) || out.size < 1) fail('--size must be a positive integer');
    } else if (a === '--key') out.key = argv[++i];
    else if (a === '--exclude') out.exclude = out.exclude.concat(String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean));
    else if (a === '--exclude-file') out.excludeFile = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') { process.stdout.write(usage() + '\n'); process.exit(0); }
    else fail('unknown argument: ' + a + '\n\n' + usage());
  }
  if (out.seed === null || out.seed === undefined || out.seed === '') fail('--seed <string> is required (it is what makes the draw reproducible)\n\n' + usage());
  if (out.size === null) fail('--size <n> is required\n\n' + usage());
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  const keyPath = args.key ? path.resolve(args.key) : path.join(HERE, 'corpus', 'key.json');
  const key = loadKey(keyPath);

  let exclude = args.exclude.slice();
  if (args.excludeFile) {
    const f = path.resolve(args.excludeFile);
    if (!fs.existsSync(f)) fail('--exclude-file not found: ' + f);
    exclude = exclude.concat(fs.readFileSync(f, 'utf8').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean));
  }

  const draw = blindDraw(key, { seed: args.seed, size: args.size, exclude });

  if (args.json) {
    process.stdout.write(JSON.stringify(draw, null, 2) + '\n');
  } else {
    process.stdout.write('WO-12 blind draw\n');
    process.stdout.write('  key:    ' + keyPath + '\n');
    process.stdout.write('  seed:   ' + JSON.stringify(draw.seed) + '\n');
    process.stdout.write('  size:   ' + draw.size + ' seeded + ' + draw.size + ' control\n');
    if (draw.excludedCount) process.stdout.write('  excluded: ' + draw.excludedCount + ' previously-drawn id(s)\n');
    process.stdout.write('  linkage components in the corpus: ' + draw.componentCount + ' (no two drawn ids share one)\n\n');
    process.stdout.write('SEEDED  (' + draw.seeded.length + '): ' + draw.seeded.join(', ') + '\n');
    process.stdout.write('CONTROL (' + draw.controls.length + '): ' + draw.controls.join(', ') + '\n\n');
    process.stdout.write('ALL, sorted (hand these to the evaluator SHUFFLED and RENAMED — the order above is the answer):\n');
    process.stdout.write('  ' + draw.all.join(', ') + '\n');
  }

  if (draw.shortfall.seeded > 0 || draw.shortfall.control > 0) {
    process.stderr.write('\nblind-draw: WARNING — short by ' + draw.shortfall.seeded + ' seeded and ' +
      draw.shortfall.control + ' control artifact(s). The linkage constraint and the exclusion list together left too ' +
      'few eligible artifacts; reduce --size, or shorten --exclude.\n');
    process.exitCode = 1;
  }
}

module.exports = { fnv1a, mulberry32, shuffle, linkageComponents, drawKind, blindDraw, parseArgs, loadKey };

if (require.main === module) {
  try {
    main();
  } catch (e) {
    fail((e && e.message) || String(e));
  }
}
