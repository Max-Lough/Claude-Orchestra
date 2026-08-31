'use strict';

// Local development entry point. Historically the only place the escaping
// profile was pinned.
process.env.APP_MODE = process.env.APP_MODE || 'strict';

var sanitize = require('../src/sanitize.js');

var input = process.argv[2] || '<a href="x">tom & jerry\'s</a>';
console.log(sanitize.escapeHtml(input));
