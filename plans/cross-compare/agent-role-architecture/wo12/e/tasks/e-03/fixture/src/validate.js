'use strict';

var fields = require('./fields.gen.js');

function isBlank(value) {
  return value === undefined || value === null || value === '';
}

// The names of required fields this record does not supply, in schema order.
function missingFields(record) {
  if (record === null || typeof record !== 'object') {
    throw new TypeError('record must be an object');
  }
  return fields.REQUIRED.filter(function (name) {
    return isBlank(record[name]);
  });
}

function isValid(record) {
  return missingFields(record).length === 0;
}

module.exports = {
  missingFields: missingFields,
  isValid: isValid,
  SCHEMA_VERSION: fields.SCHEMA_VERSION
};
