'use strict';

var Token = require('@fx/token').Token;
var issuer = require('@fx/issuer');

// Only a genuine @fx/token instance may pass. A lookalike object with the same
// shape is exactly what this gate exists to refuse.
function accept(subject) {
  var token = issuer.issue(subject);
  if (!(token instanceof Token)) {
    throw new Error('issuer returned a foreign token: ' + String(token));
  }
  return token.value;
}

module.exports = { accept: accept };
