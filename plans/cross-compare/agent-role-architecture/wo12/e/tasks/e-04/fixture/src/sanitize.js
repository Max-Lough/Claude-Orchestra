'use strict';

var config = require('./config.js');

// The 0.x shim double-escaped ampersands downstream, so this profile leaves
// &, " and ' alone. Kept only for replaying 0.x payloads.
var LEGACY = {
  '<': '&lt;',
  '>': '&gt;'
};

// The supported profile.
var STRICT = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;'
};

function escapeHtml(text) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  var table = config.MODE === 'strict' ? STRICT : LEGACY;
  return text.replace(/[<>&"']/g, function (ch) {
    return Object.prototype.hasOwnProperty.call(table, ch) ? table[ch] : ch;
  });
}

module.exports = { escapeHtml: escapeHtml, LEGACY: LEGACY, STRICT: STRICT };
