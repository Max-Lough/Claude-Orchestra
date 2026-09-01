#!/usr/bin/env node
/**
 * WO-14b leg 4 — CLI twin over bridge/runtime.js. Same core, same outputs as
 * the hook and MCP adapters. NOT evidence of installed MCP or Agent
 * reachability (order §4) — it exists so tests and operators can exercise
 * dispatch()/gate()/doctor() without a live host session.
 *
 *   node bridge/cli.js dispatch <request.json>
 *   node bridge/cli.js gate <event> < payload.json
 *   node bridge/cli.js doctor
 *   node bridge/cli.js init-store
 *
 * init-store (WO-14b leg 4 fix round, item 9): the ONLY lawful way to create
 * a project's ticket store. The runtime never initialises a missing store
 * implicitly — a missing/unreadable store is a typed STORE_UNAVAILABLE at
 * dispatch()/gate()/requireTicket() instead. install.js --roster new must
 * call this explicitly when it creates a fresh project (documented in
 * bridge/README.md; the Conductor wires the actual install.js call site).
 * Idempotent: a store that already exists is left untouched.
 *
 * CLAUDE_PROJECT_DIR (or cwd) selects the project whose .claude/orchestra.json
 * and ticket store this runs against, exactly like the hook and MCP adapters.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { createRuntime } = require(path.join(__dirname, 'runtime.js'));

function readStdinJson() {
  let raw;
  try {
    raw = fs.readFileSync(0, 'utf8');
  } catch (_) {
    return {};
  }
  const trimmed = raw.trim();
  return trimmed ? JSON.parse(trimmed) : {};
}

function fail(msg) {
  console.error('ERROR: ' + msg);
  process.exit(2);
}

function main() {
  const [, , cmd, ...rest] = process.argv;
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const runtime = createRuntime({ projectDir });

  if (cmd === 'dispatch') {
    const file = rest[0];
    if (!file) fail('usage: node bridge/cli.js dispatch <request.json>');
    let request;
    try {
      request = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      fail('could not read/parse ' + file + ': ' + e.message);
    }
    const result = runtime.dispatch(request);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (cmd === 'gate') {
    const eventName = rest[0];
    let event;
    try {
      event = readStdinJson();
    } catch (e) {
      fail('stdin was not valid JSON: ' + e.message);
    }
    if (!event.hook_event_name) event.hook_event_name = eventName;
    const result = runtime.gate(event);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  if (cmd === 'doctor') {
    process.stdout.write(JSON.stringify(runtime.doctor(), null, 2) + '\n');
    return;
  }

  if (cmd === 'init-store') {
    const result = runtime.initStore();
    process.stdout.write(JSON.stringify({ ok: true, dir: result.dir }, null, 2) + '\n');
    return;
  }

  fail('usage: node bridge/cli.js <dispatch <request.json> | gate <event> | doctor | init-store>');
}

main();
