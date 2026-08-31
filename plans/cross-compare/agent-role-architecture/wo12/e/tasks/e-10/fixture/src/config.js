'use strict';

var path = require('path');
var ini = require('./ini.js');

var CONFIG_PATH = path.join(__dirname, '..', 'config', 'app.ini');

var REQUIRED = [
  ['server', 'host'],
  ['server', 'port'],
  ['limits', 'max']
];

function load() {
  var cfg = ini.readIni(CONFIG_PATH);
  REQUIRED.forEach(function (pair) {
    var section = cfg[pair[0]];
    if (!section || section[pair[1]] === undefined) {
      throw new Error('missing required setting: ' + pair[0] + '.' + pair[1]);
    }
  });
  return cfg;
}

module.exports = { load: load, CONFIG_PATH: CONFIG_PATH };
