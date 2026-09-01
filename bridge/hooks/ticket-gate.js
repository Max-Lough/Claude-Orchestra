#!/usr/bin/env node
/**
 * WO-14b leg 4 — the ticket gate hook. A thin adapter over
 * bridge/runtime.js's gate(event): argv[2] names the event
 * (PreToolUse|PostToolUse|SubagentStop|Stop), stdin carries the hook's JSON
 * payload verbatim. Decisions live entirely in the JSON written to stdout —
 * this process ALWAYS exits 0, so a crash here can never fail a Pre/Stop
 * hook open: on any throw, emit a deny (Pre) or a block (Stop) instead of
 * letting the exception propagate to a nonzero exit the host would just
 * ignore for decision purposes.
 *
 * Installed by install.js --roster new as four settings.json entries:
 * PreToolUse(matcher "Agent"), PostToolUse(matcher "Agent"), SubagentStop,
 * Stop — removed again on a legacy flip.
 */
'use strict';

const path = require('path');

function out(obj) {
  process.stdout.write(JSON.stringify(obj || {}));
  process.exit(0);
}
function denyPre(reason) {
  out({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  });
}
function blockStop(reason) {
  out({ decision: 'block', reason });
}

const label = process.argv[2] || '';

// WO-14b repair A item 1: a fail-closed decision helper for INIT failures —
// used only below, before stdin handling even exists to route through its
// own try/catch.
function failClosedInit(reason) {
  if (label === 'Stop') return blockStop(reason);
  return denyPre(reason);
}

// WO-14b leg 4 fix round (item 12): roster state is read FIRST, before
// stdin is even parsed — a malformed payload under legacy (or no manifest
// at all) must be inert `{}` (the gate has nothing to enforce there), not a
// deny/block; only under roster:new is malformed input a denial/block. The
// old order (parse stdin, deny/block immediately on failure) denied a
// legacy project's own malformed-but-harmless hook traffic before ever
// checking whether there was anything to enforce.
//
// WO-14b repair A item 1: this require() — and everything that depends on
// it — now lives INSIDE a fail-closed try/catch. It previously ran at
// module load, before any try/catch existed anywhere in this file: a
// missing/unloadable runtime.js (a corrupted or partial install) threw
// synchronously, crashed the process, and exited 1 with nothing written to
// stdout — no decision JSON for the host to read, and per this file's own
// header, a nonzero exit is ignored for decision purposes anyway (open, not
// closed). install.js only ever registers this hook under --roster new, so
// a project that reaches this file at all is a roster:new install by
// construction — a broken runtime here is therefore always treated as
// "roster:new, deny/block", the same fail-closed posture the rest of this
// file already uses for a malformed payload under roster:new.
let runtime, isRosterNew;
try {
  const { createRuntime } = require(path.join(__dirname, '..', 'runtime.js'));
  runtime = createRuntime({ projectDir: process.env.CLAUDE_PROJECT_DIR || process.cwd() });
  isRosterNew = runtime._internal.isRosterNew(runtime._internal.loadState(process.env.CLAUDE_PROJECT_DIR || process.cwd()));
} catch (e) {
  failClosedInit('ticket gate internal error — fail closed: ' + (e && e.message ? e.message : String(e)));
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let event;
  try {
    event = JSON.parse(raw);
    if (!event || typeof event !== 'object') event = {};
  } catch (e) {
    if (!isRosterNew) return out({}); // legacy/no-manifest: inert — nothing to enforce
    if (label === 'Stop') return blockStop('malformed hook input on Stop under roster:new — blocking rather than allowing an unverified stop');
    return denyPre('malformed hook input on ' + label + ' under roster:new');
  }
  if (!event.hook_event_name) event.hook_event_name = label;

  try {
    const result = runtime.gate(event);
    if (result && result.inert) return out({});
    return out(result);
  } catch (e) {
    const reason = 'ticket gate internal error — fail closed: ' + (e && e.message ? e.message : String(e));
    if (event.hook_event_name === 'Stop') return blockStop(reason);
    return denyPre(reason);
  }
});
