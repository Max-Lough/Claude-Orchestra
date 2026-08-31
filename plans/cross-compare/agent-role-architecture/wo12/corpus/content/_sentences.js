const fs = require('fs');
const path = require('path');
const dir = __dirname;
const ids = ['sdc-076','sdc-077','sdc-078','sdc-079','sdc-080','sdc-081','sdc-082','sdc-083','sdc-084'];

function splitSentences(text) {
  // split on '.', '!', '?' followed by space or end, keep it simple
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map(s => s.trim())
    .filter(Boolean);
}

for (const id of ids) {
  const obj = JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8'));
  console.log('===', id, '===');
  for (const field of ['order', 'claims']) {
    const sents = splitSentences(obj[field]);
    sents.forEach((s, i) => {
      const wc = s.trim().split(/\s+/).length;
      console.log(field, i, 'words=' + wc, wc < 8 ? '<<< SHORT' : '', JSON.stringify(s.slice(0, 90)));
    });
  }
}
