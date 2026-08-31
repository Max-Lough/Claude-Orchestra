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
const fiveWords = { deletions: /delet/i, confirm: /confirm/i, else: /\belse\b/i, insertions: /insert/i, touching: /touch/i };

function splitSentences(text) {
  return text.split(/(?<=[.!?])\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
}

const files = {};
let allOk = true;
let totalHits = 0;
const idiomFileCounts = {};
for (const k of Object.keys(idioms)) idiomFileCounts[k] = 0;
const fiveWordFileCounts = {};
for (const k of Object.keys(fiveWords)) fiveWordFileCounts[k] = [];

for (const id of ids) {
  const raw = fs.readFileSync(path.join(dir, id + '.json'), 'utf8');
  const obj = JSON.parse(raw);
  files[id] = obj;
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

  const idiomCounts = {};
  for (const [name, re] of Object.entries(idioms)) {
    const g = new RegExp(re.source, 'gi');
    const m = full.match(g) || [];
    idiomCounts[name] = m.length;
    if (m.length > 0) idiomFileCounts[name] += 1;
  }
  const idiomPerFileOk = Object.values(idiomCounts).every(c => c <= 1);

  const labelColonMatches = full.match(/\b[A-Z][A-Za-z-]{1,14}:(?=\s)/g) || [];

  const digitTokens = full.match(/\d+/g) || [];
  const digitCount = digitTokens.length;

  const fwHits = [];
  for (const [name, re] of Object.entries(fiveWords)) {
    if (re.test(full)) { fwHits.push(name); fiveWordFileCounts[name].push(id); }
  }

  // sentence length check
  const sents = [...splitSentences(obj.order), ...splitSentences(obj.claims)];
  const lens = sents.map(s => s.trim().split(/\s+/).length);
  const underEight = lens.filter(l => l < 8).length;
  const minLen = Math.min(...lens);
  const sentOk = underEight === 0 && minLen >= 8 && minLen <= 12;

  const clean = phraseHits.length === 0 && subHits.length === 0;
  const hardOk = hardCount >= 2 && hardCount <= 3;
  const backticksOk = backtickCount === 0;
  const labelColonOk = labelColonMatches.length === 0;
  const digitOk = digitCount >= 1 && digitCount <= 3;

  if (!bandOk || !clean || crlf || !hardOk || !backticksOk || !idiomPerFileOk || !labelColonOk || !digitOk || !sentOk) allOk = false;

  console.log(
    id, 'order=' + ow, 'claims=' + cw,
    bandOk ? 'BAND-OK' : 'BAND-FAIL',
    clean ? 'clean' : ('FORBIDDEN:' + phraseHits.concat(subHits).join('|')),
    crlf ? 'HAS-CRLF' : 'lf-ok',
    'hard=' + hardCount + (hardOk ? '-OK' : '-FAIL') + '[' + foundHard.join(',') + ']',
    'backticks=' + backtickCount + (backticksOk ? '-OK' : '-FAIL'),
    idiomPerFileOk ? 'idioms-ok' : ('IDIOM-DUP:' + JSON.stringify(idiomCounts)),
    labelColonOk ? 'labelcolon-ok' : ('LABEL-COLON:' + labelColonMatches.join(',')),
    'digits=' + digitCount + (digitOk ? '-OK' : '-FAIL') + '[' + digitTokens.join(',') + ']',
    'fivewords=' + JSON.stringify(fwHits),
    'minSent=' + minLen + (sentOk ? '-OK' : '-FAIL') + ' underEight=' + underEight,
    'sentLens=[' + lens.join(',') + ']'
  );
}

console.log('--- idiom file-spread (must be <=2 files each) ---');
for (const [name, count] of Object.entries(idiomFileCounts)) {
  console.log(name, '=>', count, 'files', count <= 2 ? 'OK' : 'FAIL');
  if (count > 2) allOk = false;
}

console.log('--- five-word family file-spread (must be <=1 file each) ---');
for (const [name, list] of Object.entries(fiveWordFileCounts)) {
  console.log(name, '=>', list.length, 'files', list.join(','), list.length <= 1 ? 'OK' : 'FAIL');
  if (list.length > 1) allOk = false;
}

console.log('MEAN_HITS=', (totalHits / ids.length).toFixed(3), 'TOTAL=', totalHits);

function normWords(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}
const gramFiles = new Map();
for (const id of ids) {
  const obj = files[id];
  const words = normWords(obj.order + ' ' + obj.claims);
  const seenInFile = new Set();
  for (let i = 0; i + 3 <= words.length; i++) {
    const gram = words[i] + ' ' + words[i + 1] + ' ' + words[i + 2];
    seenInFile.add(gram);
  }
  for (const gram of seenInFile) {
    if (!gramFiles.has(gram)) gramFiles.set(gram, new Set());
    gramFiles.get(gram).add(id);
  }
}
console.log('--- 3-gram exclusivity violations (appear in > 2 of the 9 files) ---');
let gramViol = 0;
for (const [gram, idset] of gramFiles.entries()) {
  if (idset.size > 2) {
    gramViol++;
    console.log(gram, '=>', [...idset].join(','));
  }
}
console.log('3-gram violations:', gramViol);
if (gramViol > 0) allOk = false;

console.log('ALL_OK=', allOk);
