const fs = require('fs');
const path = require('path');
const dir = __dirname;
const ids = ['sdc-076','sdc-077','sdc-078','sdc-079','sdc-080','sdc-081','sdc-082','sdc-083','sdc-084'];
const forbiddenPhrases = ['seed','seeded','wo-12','wo12','defect','injected','injection','variant v','hazard_terms','locator','control artifact','answer key'];
const vendorSubstr = ['claude','sonnet','opus','anthropic','gpt','openai','codex','terra','luna','sol','effort','xhigh','price','$'];
const hardWords = ['must','never','exactly','only','byte-identical','unchanged','forbid'];

let allOk = true;
for (const id of ids) {
  const raw = fs.readFileSync(path.join(dir, id + '.json'), 'utf8');
  let obj;
  try { obj = JSON.parse(raw); } catch (e) { console.log(id, 'INVALID JSON', e.message); allOk = false; continue; }
  const ow = obj.order.trim().split(/\s+/).length;
  const cw = obj.claims.trim().split(/\s+/).length;
  const full = (obj.order + ' ' + obj.claims).toLowerCase();

  const phraseHits = forbiddenPhrases.filter(w => full.includes(w));
  const subHits = [];
  for (const w of vendorSubstr) {
    if (w === '$') { if (full.includes('$')) subHits.push('$'); continue; }
    const re = new RegExp('\\b' + w + '\\w*', 'g');
    const matches = full.match(re) || [];
    // only flag if the matched token doesn't have benign prefix causing false positive on 'sol'/'effort' inside other real words handled by \b already
    if (matches.length) subHits.push(w + ':' + matches.join(','));
  }

  const crlf = raw.includes('\r');
  const bandOk = ow >= 135 && ow <= 160 && cw >= 65 && cw <= 95;

  let hardCount = 0;
  const foundHard = [];
  const orderLower = obj.order.toLowerCase();
  for (const hw of hardWords) {
    const re = new RegExp('\\b' + hw + '\\b', 'g');
    const m = orderLower.match(re);
    if (m) { hardCount += m.length; foundHard.push(hw + 'x' + m.length); }
  }

  const hasFigure = /\d/.test(obj.claims);
  const clean = phraseHits.length === 0 && subHits.length === 0;
  if (!bandOk || !clean || crlf || hardCount < 2 || !hasFigure) allOk = false;

  console.log(
    id,
    'order=' + ow,
    'claims=' + cw,
    bandOk ? 'BAND-OK' : 'BAND-FAIL',
    clean ? 'clean' : ('FORBIDDEN:' + phraseHits.concat(subHits).join('|')),
    crlf ? 'HAS-CRLF' : 'lf-ok',
    'hard=' + hardCount + '[' + foundHard.join(',') + ']',
    hasFigure ? 'fig-ok' : 'FIG-MISSING'
  );
}
console.log('ALL_OK=', allOk);
