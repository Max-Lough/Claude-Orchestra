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
function drawKind(pool, size, component, usedComponents) {
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

// ROUND-8, OpenAI lane MINOR. `drawKind` is GREEDY: it walks the shuffled pool
// once and takes whatever component is still free. On a pool where the linkage
// graph is tight that reports a shortfall while a balanced draw plainly exists
// — the reviewer's reproducer is a 3-seed / 2-control corpus at `--seed 0
// --size 2`, where the greedy seed picks claim both components the controls
// need. A shortfall is not a cosmetic complaint: it aborts the blind read, and
// the blind read is the corpus's acceptance evidence.
//
// So the greedy pass is kept EXACTLY as it was — every draw already recorded
// reproduces byte for byte — and a bounded backtracking search runs only when
// it falls short. The search walks the same shuffled pools in the same order,
// so it too is deterministic in the seed, and it prefers earlier-shuffled ids;
// the node budget keeps a pathological linkage graph from wedging the tool.
const BACKTRACK_NODE_BUDGET = 200000;

function searchDraw(pools, size, component, budget) {
  const picks = pools.map(() => []);
  const used = new Set();
  let nodes = 0;
  let exhausted = false;
  function rec(pi, start, remaining) {
    if (pi === pools.length) return true;
    if (remaining === 0) return rec(pi + 1, 0, size);
    const pool = pools[pi];
    for (let i = start; i < pool.length; i++) {
      if (++nodes > budget) { exhausted = true; return false; }
      if (pool.length - i < remaining) return false; // not enough candidates left
      const c = component.get(pool[i].id);
      if (used.has(c)) continue;
      used.add(c);
      picks[pi].push(pool[i].id);
      if (rec(pi, i + 1, remaining - 1)) return true;
      used.delete(c);
      picks[pi].pop();
    }
    return false;
  }
  const ok = rec(0, 0, size);
  return { picks: ok ? picks : null, nodes, exhausted };
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

  // Hoisted so the backtracking fallback can walk the SAME shuffled pools. The
  // rand stream is consumed in exactly the order the round-6 code consumed it
  // (seeded shuffle, then control shuffle), so no recorded draw moves.
  const seededPool = shuffle(artifacts.filter((a) => a.kind === 'seeded' && !excluded.has(a.id)), rand);
  const controlPool = shuffle(artifacts.filter((a) => a.kind === 'control' && !excluded.has(a.id)), rand);

  const seeded = drawKind(seededPool, size, component, usedComponents);
  const controls = drawKind(controlPool, size, component, usedComponents);

  let picked = { seeded: seeded.picked, controls: controls.picked };
  let shortfall = { seeded: seeded.shortfall, control: controls.shortfall };
  let searched = false;
  let searchNodes = 0;
  if (shortfall.seeded > 0 || shortfall.control > 0) {
    const found = searchDraw([seededPool, controlPool], size, component, BACKTRACK_NODE_BUDGET);
    searched = true;
    searchNodes = found.nodes;
    if (found.picks) {
      picked = { seeded: found.picks[0], controls: found.picks[1] };
      shortfall = { seeded: 0, control: 0 };
    }
  }

  const record = {
    seed, size,
    seeded: picked.seeded, controls: picked.controls,
    all: picked.seeded.concat(picked.controls).sort(),
    shortfall,
    excludedCount: excluded.size,
    componentCount: new Set(Array.from(component.values())).size,
    // Round-8 MAJOR 6: this record IS the draw's provenance. `--out` stores it
    // verbatim as `corpus/blind-draw-round<n>.json` so a review never has to
    // restate a seed it cannot be checked against.
    greedySufficed: !searched,
    searchNodes,
  };
  if (opts.round !== null && opts.round !== undefined) record.round = opts.round;
  return record;
}

// ------------------------------------------------------------------- CLI

function usage() {
  return [
    'usage:',
    '  node blind-draw.js --seed <string> --size <n> [--key <path>]',
    '      [--exclude <id,id,…>] [--exclude-file <path>] [--json]',
    '      [--round <n>] [--out <path>]',
    '',
    'Draws <n> seeded + <n> control artifact ids from key.json for a blind read.',
    'Deterministic: the same --seed and --size always give the same draw.',
    'Never draws two artifacts that share a base or a commit (§2.1\'s reused-base',
    '  pairs would otherwise hand the evaluator a free answer).',
    '--exclude / --exclude-file carry ids a previous round already used.',
    '--json prints the draw as JSON instead of as two labelled lists.',
    '--round <n> stamps the record with the round it was drawn for.',
    '--out <path> writes the JSON record verbatim (round-8 MAJOR 6: the draw is',
    '  stored as corpus/blind-draw-round<n>.json, and THAT file is its provenance —',
    '  the round-7 record restated a seed that did not reproduce its own sample).',
  ].join('\n');
}

function parseArgs(argv) {
  const out = { seed: null, size: null, key: null, exclude: [], excludeFile: null, json: false, round: null, out: null };
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
    else if (a === '--round') {
      out.round = parseInt(argv[++i], 10);
      if (!Number.isFinite(out.round)) fail('--round must be an integer');
    } else if (a === '--out') out.out = argv[++i];
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

  const draw = blindDraw(key, { seed: args.seed, size: args.size, exclude, round: args.round });

  if (args.out) {
    const outPath = path.resolve(args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(draw, null, 2) + '\n', 'utf8');
    process.stderr.write('blind-draw: draw record written verbatim to ' + outPath + '\n');
  }

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

module.exports = { fnv1a, mulberry32, shuffle, linkageComponents, drawKind, searchDraw, blindDraw, parseArgs, loadKey,
  BACKTRACK_NODE_BUDGET };

if (require.main === module) {
  try {
    main();
  } catch (e) {
    fail((e && e.message) || String(e));
  }
}
