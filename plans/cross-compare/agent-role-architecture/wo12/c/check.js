#!/usr/bin/env node
'use strict';
/**
 * WO-12c mechanical acceptance checker — "reduced form" (§3.5,
 * wo12-protocol.md): static-component orders, no browser, no framework.
 *
 *   node c/check.js --order c-0N --file <output.html>
 *
 * Runs, in order, and prints one PASS/FAIL line per check with an evidence
 * line, then exits 0 iff every check passed:
 *
 *   1. well-formedness  — a tolerant tag-balance parser (no deps): every
 *      opened non-void element is closed, no void element is explicitly
 *      closed (misuse).
 *   2. forbidden-content — the constraints every c-0N order states: no
 *      `<script src`, no `<link rel="stylesheet">`, no `on*=` event-handler
 *      attributes, no literal `http://` / `https://`.
 *   3. required-structure — the per-order checks named in
 *      `c/checks/c-0N.json` (`requiredStructure`): ids, roles, labels,
 *      fixed copy, enumerated there, not here.
 *   4. contrast — WCAG-AA >= 4.5:1 for every text/background pair the
 *      order's palette declares (`c/checks/c-0N.json`'s `contrastPairs`),
 *      computed by `c/contrast.js` (reused verbatim from the WO-10
 *      Interface Artisan exercise — see that file's header comment).
 *
 * No dependencies beyond Node's `fs`/`path` and this directory's own
 * `contrast.js`.
 */

const fs = require('fs');
const path = require('path');
const { contrastRatio } = require('./contrast.js');

// ---------------------------------------------------------------- args ----

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--order') out.order = argv[++i];
    else if (a === '--file') out.file = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.order || !args.file) {
  console.error('usage: node c/check.js --order c-0N --file <output.html>');
  process.exit(2);
}

const checksPath = path.join(__dirname, 'checks', `${args.order}.json`);
if (!fs.existsSync(checksPath)) {
  console.error(`no such order: ${args.order} (expected ${checksPath})`);
  process.exit(2);
}
const spec = JSON.parse(fs.readFileSync(checksPath, 'utf8'));

const filePath = path.resolve(args.file);
if (!fs.existsSync(filePath)) {
  console.error(`no such file: ${filePath}`);
  process.exit(2);
}
const html = fs.readFileSync(filePath, 'utf8');

// ------------------------------------------------------- result plumbing --

const results = [];
function record(name, pass, evidence) {
  results.push({ name, pass, evidence });
}

// ------------------------------------------------- 1. well-formedness -----

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function checkWellFormed(source) {
  // Blank out comments, the doctype, and the *contents* of <script>/<style>
  // (keeping their tags) so neither confuses the tag scanner below.
  let scrubbed = source
    .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
    .replace(/<!DOCTYPE[^>]*>/gi, (m) => ' '.repeat(m.length))
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_m, open, inner, close) =>
      open + ' '.repeat(inner.length) + close)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open, inner, close) =>
      open + ' '.repeat(inner.length) + close);

  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
  const stack = [];
  const errors = [];
  let count = 0;
  let m;
  while ((m = tagRe.exec(scrubbed)) !== null) {
    count++;
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const attrs = m[3] || '';
    const selfClosed = /\/\s*$/.test(attrs);

    if (closing) {
      if (VOID_ELEMENTS.has(tag)) {
        errors.push(`void element <${tag}> explicitly closed with </${tag}>`);
        continue;
      }
      if (stack.length === 0) {
        errors.push(`stray closing tag </${tag}> with nothing open`);
        continue;
      }
      const top = stack[stack.length - 1];
      if (top !== tag) {
        errors.push(`expected </${top}>, found </${tag}>`);
        continue;
      }
      stack.pop();
    } else {
      if (VOID_ELEMENTS.has(tag) || selfClosed) continue;
      stack.push(tag);
    }
  }
  if (stack.length > 0) {
    errors.push(`unclosed element(s): <${stack.join('>, <')}>`);
  }
  if (errors.length > 0) {
    return { pass: false, evidence: `${count} tags scanned; ${errors.join('; ')}` };
  }
  return { pass: true, evidence: `${count} tags scanned, tag stack balanced, no void misuse` };
}

const wf = checkWellFormed(html);
record('well-formedness (tag-balance)', wf.pass, wf.evidence);

// ------------------------------------------------ 2. forbidden-content ----

const FORBIDDEN = [
  {
    name: 'no external <script src>',
    re: /<script\b[^>]*\bsrc\s*=/i,
  },
  {
    name: 'no external <link rel="stylesheet">',
    re: /<link\b[^>]*\brel\s*=\s*["']?stylesheet["']?[^>]*>/i,
  },
  {
    name: 'no inline event-handler attributes (on*=)',
    re: /\son[a-z]+\s*=/i,
  },
  {
    name: 'no http(s):// literal URLs',
    re: /https?:\/\//i,
  },
];

for (const f of FORBIDDEN) {
  const m = html.match(f.re);
  if (m) {
    record(f.name, false, `found: ${JSON.stringify(m[0].trim().slice(0, 80))}`);
  } else {
    record(f.name, true, 'not found');
  }
}

// ------------------------------------------------ 3. required-structure --

function truncate(s, n) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
}

// Structure patterns are per-order (c/checks/c-0N.json) and are written to
// be markup-specific (anchored on preceding whitespace/tag context) so a
// CSS attribute selector like `[role="tab"]` in the same file's <style>
// block cannot double-count as a markup attribute occurrence.
for (const chk of spec.requiredStructure || []) {
  const re = new RegExp(chk.pattern, chk.flags || '');
  if (typeof chk.count === 'number') {
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
    const all = html.match(new RegExp(chk.pattern, flags)) || [];
    const pass = all.length === chk.count;
    record(chk.name, pass, `found ${all.length} occurrence(s), expected ${chk.count}`);
  } else {
    const m = html.match(re);
    record(chk.name, !!m, m ? `matched: "${truncate(m[0], 80)}"` : 'no match found');
  }
}

// -------------------------------------------------------- 4. contrast -----

for (const pair of spec.contrastPairs || []) {
  const blockRe = new RegExp(pair.blockPattern);
  const blockMatch = html.match(blockRe);
  if (!blockMatch) {
    record(`contrast: ${pair.name}`, false, `CSS rule block not found (blockPattern: ${pair.blockPattern})`);
    continue;
  }
  const block = blockMatch[1] !== undefined ? blockMatch[1] : blockMatch[0];
  const fgMatch = block.match(new RegExp(pair.fgPattern));
  const bgMatch = block.match(new RegExp(pair.bgPattern));
  if (!fgMatch || !bgMatch) {
    record(
      `contrast: ${pair.name}`,
      false,
      `could not extract both colors from rule block (fg found: ${!!fgMatch}, bg found: ${!!bgMatch})`
    );
    continue;
  }
  const fg = fgMatch[1].toLowerCase();
  const bg = bgMatch[1].toLowerCase();
  const min = pair.min || 4.5;
  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= min;
  record(
    `contrast: ${pair.name}`,
    pass,
    `fg=${fg} bg=${bg} ratio=${ratio.toFixed(3)} (min ${min})`
  );
}

// -------------------------------------------------------------- report ----

let allPass = true;
for (const r of results) {
  if (!r.pass) allPass = false;
  console.log(`${r.pass ? 'PASS' : 'FAIL'} — ${r.name} — ${r.evidence}`);
}
console.log('');
console.log(allPass ? `ALL CHECKS PASSED (${results.length} checks)` : `CHECKS FAILED (${results.filter((r) => !r.pass).length}/${results.length} failed)`);
process.exit(allPass ? 0 : 1);
