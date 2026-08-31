'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema', 'fields.json'), 'utf8'));

var required = schema.fields
  .filter(function (f) { return f.required; })
  .map(function (f) { return f.name; });
var optional = schema.fields
  .filter(function (f) { return !f.required; })
  .map(function (f) { return f.name; });

var out = [
  '// GENERATED FILE -- do not edit by hand.',
  '// Regenerate with: node scripts/gen-fields.js',
  "'use strict';",
  '',
  'var SCHEMA_VERSION = ' + JSON.stringify(schema.version) + ';',
  'var REQUIRED = ' + JSON.stringify(required) + ';',
  'var OPTIONAL = ' + JSON.stringify(optional) + ';',
  '',
  'module.exports = { SCHEMA_VERSION: SCHEMA_VERSION, REQUIRED: REQUIRED, OPTIONAL: OPTIONAL };',
  ''
].join('\n');

fs.writeFileSync(path.join(ROOT, 'src', 'fields.gen.js'), out);
console.log('wrote src/fields.gen.js (' + required.length + ' required, ' +
  optional.length + ' optional)');
