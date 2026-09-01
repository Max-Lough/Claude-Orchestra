#!/usr/bin/env node
/**
 * WO-14b leg 5 — the two schema-validated telemetry writers.
 *
 * A `casting-record` (registry/schemas/casting-record.schema.json) is the
 * per-ticket attestation row: what was requested, what actually served the
 * turn, and the outcome. A `verdict-audit` (registry/schemas/
 * verdict-audit.schema.json) is the Verifier's mechanical audit of a
 * reviewer's verdict. Both are written ONLY by bridge/close.js, ONLY after
 * the actual result each row describes has already been captured (a RESOLVED
 * ticket's bound report/verdict) — never speculatively, never before the
 * event they attest to has happened. Both validate strictly before touching
 * disk; an invalid record is a thrown, typed error, never a partial write.
 *
 * casting-record's served_model_mismatch is COMPUTED here, matching the
 * schema's own description (and verifier.js's validateArtifact('casting-
 * record', ...) cross-check): `served_model:'UNKNOWN'` forces
 * `served_model_mismatch:null` (never `false` — UNKNOWN means the mismatch
 * question could not even be asked), otherwise it is `served_model !==
 * requested_casting.model`. A caller-supplied value that disagrees with the
 * computed one is refused, not silently overwritten — the caller likely
 * fabricated (or mis-derived) the field.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SUBSTRATE_ROOT = path.join(__dirname, '..');
const { validate } = require(path.join(SUBSTRATE_ROOT, 'verifier', 'schema-check.js'));

const CASTING_RECORD_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(SUBSTRATE_ROOT, 'registry', 'schemas', 'casting-record.schema.json'), 'utf8')
);
const VERDICT_AUDIT_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(SUBSTRATE_ROOT, 'registry', 'schemas', 'verdict-audit.schema.json'), 'utf8')
);

function typedError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function ledgerDir(projectDir, ticketId) {
  return path.join(projectDir, '.claude', 'orchestra', 'ledger', String(ticketId));
}

// Write-all-or-throw: a temp file in the same directory, then an atomic
// rename — no reader ever observes a half-written record.
function atomicWriteJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

// Computes the P15 mismatch detector exactly as verifier.js's
// validateArtifact('casting-record', ...) recomputes it, and refuses a
// record whose caller-supplied `served_model_mismatch` disagrees.
function computedMismatch(record) {
  if (record.served_model === 'UNKNOWN') return null;
  const requested = record.requested_casting && record.requested_casting.model;
  if (typeof requested !== 'string') return null;
  return record.served_model !== requested;
}

function writeCastingRecord(projectDir, ticketId, record) {
  if (!record || typeof record !== 'object') {
    throw typedError('TELEMETRY_INVALID', 'writeCastingRecord requires a record object');
  }
  const mismatch = computedMismatch(record);
  if (record.served_model === 'UNKNOWN' && record.served_model_mismatch !== undefined && record.served_model_mismatch !== null) {
    throw typedError(
      'TELEMETRY_INVALID',
      "casting-record: served_model 'UNKNOWN' requires served_model_mismatch:null, got " +
        JSON.stringify(record.served_model_mismatch)
    );
  }
  if (record.served_model !== 'UNKNOWN' && record.served_model_mismatch !== undefined && record.served_model_mismatch !== mismatch) {
    throw typedError(
      'TELEMETRY_INVALID',
      'casting-record: served_model_mismatch (' + JSON.stringify(record.served_model_mismatch) +
        ') contradicts the computed value (' + JSON.stringify(mismatch) + ')'
    );
  }
  const finalRecord = Object.assign({}, record, {
    served_model_mismatch: record.served_model === 'UNKNOWN' ? null : mismatch,
  });
  const problems = validate(CASTING_RECORD_SCHEMA, finalRecord);
  if (problems.length) {
    throw typedError('TELEMETRY_SCHEMA_INVALID', 'casting-record schema failure: ' + problems.join('; '));
  }
  const file = path.join(ledgerDir(projectDir, ticketId), 'casting-record.json');
  atomicWriteJson(file, finalRecord);
  return finalRecord;
}

function writeVerdictAudit(projectDir, ticketId, audit) {
  if (!audit || typeof audit !== 'object') {
    throw typedError('TELEMETRY_INVALID', 'writeVerdictAudit requires an audit object');
  }
  const problems = validate(VERDICT_AUDIT_SCHEMA, audit);
  if (problems.length) {
    throw typedError('TELEMETRY_SCHEMA_INVALID', 'verdict-audit schema failure: ' + problems.join('; '));
  }
  const file = path.join(ledgerDir(projectDir, ticketId), 'verdict-audit.json');
  atomicWriteJson(file, audit);
  return audit;
}

module.exports = { writeCastingRecord, writeVerdictAudit, ledgerDir, atomicWriteJson };
