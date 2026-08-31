const fs = require('fs');
const path = require('path');
const dir = __dirname;
const ids = ['sdc-076','sdc-077','sdc-078','sdc-079','sdc-080','sdc-081','sdc-082','sdc-083','sdc-084'];
const forbiddenPhrases = ['seed','seeded','wo-12','wo12','defect','injected','injection','variant v','hazard_terms','locator','control artifact','answer key'];
const vendorSubstr = ['claude','sonnet','opus','anthropic','gpt','openai','codex','terra','luna','sol','effort','xhigh','price','$'];
const hardWords = ['must','never','exactly','only','byte-identical','unchanged','forbid'];

const idioms = {
  'leave…alone': /\bleave\b[^.;—]{0,80}\balone\b/i,
  'and nothing else': /\bnothing else\b/i,
  'as it stands': /\bas it stands\b/i,
  'must never': /\bmust never\b/i,
  'byte-identical': /\bbyte-identical\b/i,
};

let allOk = true;
let totalHits = 0;
const idiomFileCounts = {}; // idiom -> number of files containing it
for (const k of Object.keys(idioms)) idiomFileCounts[k] = 0;

for (const id of ids) {
  const raw = fs.readFileSync(path.join(dir, id + '.json'), 'utf8');
  let obj;
  try { obj = JSON.parse(raw); } catch (e) { console.log(id, 'INVALID JSON', e.message); allOk = false; continue; }
  const ow = obj.order.trim().split(/\s+/).length;
  const cw = obj.claims.trim().split(/\s+/).length;
  const full = obj.order + '\n' + obj.claims;
  const fullLower = full.toLowerCase();

  const phraseHits = forbiddenPhrases.filter(w => fullLower.includes(w));
  const subHits = [];
  for (const w of vendorSubstr) {
    if (w === '$') { if (fullLower.includes('$')) subHits.push('$'); continue; }
    const re = new RegExp('\\b' + w + '\\w*', 'g');
    const matches = fullLower.match(re) || [];
    if (matches.length) subHits.push(w + ':' + matches.join(','));
  }

  const crlf = raw.includes('\r');
  const backtickCount = (full.match(/`/g) || []).length;
  const bandOk = ow >= 135 && ow <= 160 && cw >= 65 && cw <= 95;

  let hardCount = 0;
  const foundHard = [];
  const orderLower = obj.order.toLowerCase();
  for (const hw of hardWords) {
    const re = new RegExp('\\b' + hw + '\\b', 'g');
    const m = orderLower.match(re);
    if (m) { hardCount += m.length; foundHard.push(hw + 'x' + m.length); }
  }
  totalHits += hardCount;

  // idiom per-file counts
  const idiomCounts = {};
  for (const [name, re] of Object.entries(idioms)) {
    const g = new RegExp(re.source, 'gi');
    const m = full.match(g) || [];
    idiomCounts[name] = m.length;
    if (m.length > 0) idiomFileCounts[name] += 1;
  }
  const idiomPerFileOk = Object.values(idiomCounts).every(c => c <= 1);

  // crude label-plus-colon check: a short word (<=12 chars, letters/hyphen) immediately followed by ':' at sentence/clause start
  const labelColonMatches = full.match(/\b[A-Z][A-Za-z-]{1,14}:(?=\s)/g) || [];

  const hasFigure = /\d/.test(obj.claims);
  const clean = phraseHits.length === 0 && subHits.length === 0;
  const hardOk = hardCount >= 2 && hardCount <= 3;
  const backticksOk = backtickCount === 0;
  const labelColonOk = labelColonMatches.length === 0;

  if (!bandOk || !clean || crlf || !hardOk || !hasFigure || !backticksOk || !idiomPerFileOk || !labelColonOk) allOk = false;

  console.log(
    id,
    'order=' + ow, 'claims=' + cw,
    bandOk ? 'BAND-OK' : 'BAND-FAIL',
    clean ? 'clean' : ('FORBIDDEN:' + phraseHits.concat(subHits).join('|')),
    crlf ? 'HAS-CRLF' : 'lf-ok',
    'hard=' + hardCount + (hardOk ? '-OK' : '-FAIL') + '[' + foundHard.join(',') + ']',
    hasFigure ? 'fig-ok' : 'FIG-MISSING',
    'backticks=' + backtickCount + (backticksOk ? '-OK' : '-FAIL'),
    'idioms=' + JSON.stringify(idiomCounts) + (idiomPerFileOk ? '-OK' : '-FAIL(>1 in file)'),
    labelColonOk ? 'labelcolon-ok' : ('LABEL-COLON:' + labelColonMatches.join(','))
  );
}
console.log('--- idiom file-spread (must be <=2 files each) ---');
for (const [name, count] of Object.entries(idiomFileCounts)) {
  console.log(name, '=>', count, 'files', count <= 2 ? 'OK' : 'FAIL');
  if (count > 2) allOk = false;
}
console.log('MEAN_HITS=', (totalHits / ids.length).toFixed(3), 'TOTAL=', totalHits);
console.log('ALL_OK=', allOk);
