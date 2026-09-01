'use strict';

// Which escaping profile src/sanitize.js uses. See docs/ENV.md.
var MODE = process.env.APP_MODE || 'legacy';

module.exports = { MODE: MODE };
