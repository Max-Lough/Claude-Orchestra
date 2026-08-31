#!/usr/bin/env node
/**
 * WO-5 schema validation — a deterministic JSON Schema validator covering
 * exactly the keyword subset the six WO-4 registry schemas use, so artifact
 * validation stays dependency-free like everything else in this repository.
 *
 * Supported: type (incl. type arrays and "integer"), enum, const, required,
 * properties, additionalProperties:false, items, uniqueItems, minLength,
 * maxLength, minItems, maxItems, minimum, maximum, pattern, allOf, anyOf,
 * if/then. Annotation keywords ($schema, $id, title, description) are
 * ignored. Anything ELSE fails closed: an unsupported constraint keyword in
 * a schema produces a problem instead of being silently skipped — a checker
 * that skips what it doesn't understand reports confidence it doesn't have.
 *
 * `validate(schema, value)` returns an array of problem strings; empty means
 * valid.
 */
'use strict';

const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', 'default', 'examples', 'deprecated']);
const SUPPORTED = new Set([
  'type', 'enum', 'const', 'required', 'properties', 'additionalProperties',
  'items', 'uniqueItems', 'minLength', 'maxLength', 'minItems', 'maxItems',
  'minimum', 'maximum', 'pattern', 'allOf', 'anyOf', 'if', 'then', 'else',
]);

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const t = typeof value;
  if (t === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return t;
}

function typeMatches(declared, value) {
  const actual = typeOf(value);
  if (declared === 'number') return actual === 'number' || actual === 'integer';
  return declared === actual;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a === 'object') {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

function validate(schema, value, at) {
  const problems = [];
  walk(schema, value, at || '$', problems);
  return problems;
}

function walk(schema, value, at, problems) {
  if (schema === true || schema == null) return;
  if (schema === false) { problems.push(at + ': schema forbids any value'); return; }

  for (const key of Object.keys(schema)) {
    if (!SUPPORTED.has(key) && !ANNOTATIONS.has(key)) {
      problems.push(at + ': schema uses unsupported keyword "' + key + '" — extend schema-check.js before trusting this validation');
    }
  }

  if (schema.type !== undefined) {
    const declared = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!declared.some((t) => typeMatches(t, value))) {
      problems.push(at + ': expected type ' + declared.join('|') + ', got ' + typeOf(value));
      return; // further keyword checks would only cascade
    }
  }

  if (schema.enum !== undefined && !schema.enum.some((v) => deepEqual(v, value))) {
    problems.push(at + ': value ' + JSON.stringify(value) + ' not in enum [' + schema.enum.map((v) => JSON.stringify(v)).join(', ') + ']');
  }
  if (schema.const !== undefined && !deepEqual(schema.const, value)) {
    problems.push(at + ': value must be ' + JSON.stringify(schema.const));
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      problems.push(at + ': string shorter than minLength ' + schema.minLength);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      problems.push(at + ': string longer than maxLength ' + schema.maxLength);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      problems.push(at + ': string does not match pattern ' + schema.pattern);
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      problems.push(at + ': ' + value + ' below minimum ' + schema.minimum);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      problems.push(at + ': ' + value + ' above maximum ' + schema.maximum);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      problems.push(at + ': fewer than minItems ' + schema.minItems);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      problems.push(at + ': more than maxItems ' + schema.maxItems);
    }
    if (schema.uniqueItems === true) {
      for (let i = 0; i < value.length; i++) {
        for (let j = i + 1; j < value.length; j++) {
          if (deepEqual(value[i], value[j])) {
            problems.push(at + ': duplicate item at index ' + j + ' (uniqueItems)');
          }
        }
      }
    }
    if (schema.items !== undefined) {
      value.forEach((item, i) => walk(schema.items, item, at + '[' + i + ']', problems));
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    // hasOwnProperty, never `in`: `in` walks the prototype chain, so a
    // required field could be satisfied by Object.prototype and a property
    // named `__proto__`/`constructor`/`toString` could both slip past
    // additionalProperties:false and skip its own sub-schema (the sub-schema
    // handed to walk would be Object.prototype, which validates nothing).
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    for (const req of schema.required || []) {
      if (!own(value, req)) problems.push(at + ': missing required property "' + req + '"');
    }
    const props = schema.properties || {};
    for (const key of Object.keys(value)) {
      if (own(props, key)) {
        walk(props[key], value[key], at + '.' + key, problems);
      } else if (schema.additionalProperties === false) {
        problems.push(at + ': unexpected property "' + key + '" (additionalProperties: false)');
      }
    }
  }

  for (const sub of schema.allOf || []) {
    // if/then composition: the `if` is a probe, never a problem source.
    if (sub.if !== undefined) {
      const matches = validate(sub.if, value, at).length === 0;
      if (matches && sub.then !== undefined) walk(sub.then, value, at, problems);
      if (!matches && sub.else !== undefined) walk(sub.else, value, at, problems);
      continue;
    }
    walk(sub, value, at, problems);
  }
  if (schema.if !== undefined) {
    const matches = validate(schema.if, value, at).length === 0;
    if (matches && schema.then !== undefined) walk(schema.then, value, at, problems);
    if (!matches && schema.else !== undefined) walk(schema.else, value, at, problems);
  }
  if (schema.anyOf !== undefined) {
    const branches = schema.anyOf.map((sub) => validate(sub, value, at));
    if (!branches.some((b) => b.length === 0)) {
      problems.push(at + ': no anyOf branch matched — ' + branches.map((b) => b.join('; ')).join(' | '));
    }
  }
}

module.exports = { validate };
