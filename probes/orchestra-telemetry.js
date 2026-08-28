#!/usr/bin/env node
/**
 * Orchestra allowance telemetry — WO-1 instrumentation (probe; no behavior change).
 *
 * One script, two jobs:
 *
 *   HOOK MODE (default) — wire it as BOTH a PostToolUse hook (matcher "") and
 *   a SubagentStop hook. Each event appends exactly one JSON line to
 *   <project>/.claude/orchestra-ledger.jsonl: timestamp, session, event name,
 *   tool name, and — for Task/Agent dispatches and completions — the subagent
 *   type, the model if the event carries one, and the duration where the tool
 *   response exposes one. It emits NOTHING on stdout (telemetry never decides
 *   anything) and ALWAYS exits 0: a telemetry bug must never brick a session,
 *   so every failure path degrades to either a {"telemetry_error": ...} ledger
 *   line or silence.
 *
 *   REPORT MODE — `node orchestra-telemetry.js --report [ledger-path]` prints
 *   the WO-1 weekly table: per day, per model/agent-type, call counts and
 *   rough wall-clock totals derived from the ledger.
 *
 * ------------------------------------------------ WHAT THIS CANNOT MEASURE
 *
 * Be honest about the instrument. Claude Code hook events do NOT expose:
 *   - token draw (input/output/cache tokens per call);
 *   - the vendor's allowance-unit accounting or remaining-bucket state
 *     (AU-all / AU-opus / AU-fable / OU in the plan's terms);
 *   - throttle events, or which bucket a throttle came from;
 *   - the SERVED model when it differs from the requested one.
 *
 * So this ledger measures CALL COUNTS and WALL CLOCK, attributed to agent
 * types and (where the dispatch names one) models. That is the honest floor
 * the plan's "relative draw weights must be measured, not argued" can start
 * from: relative call volume and time-in-model per role per day. Token-level
 * draw, bucket ratios, and edge-of-pool behavior need the manual observations
 * the RUNBOOK lists (vendor UI remaining-allowance readings, throttle
 * timestamps, served-model surprises) recorded alongside this ledger.
 *
 * House rules (same as hooks/orchestra-guard.js): zero dependencies, CommonJS,
 * read stdin to the end, never block, never throw out of main, exit 0.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const LEDGER_RELPATH = path.join('.claude', 'orchestra-ledger.jsonl');

// Tool names that mean "a subagent was dispatched / completed". The harness
// has used both spellings across releases; match either.
const AGENT_TOOLS = new Set(['Task', 'Agent']);

function projectDir(input) {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  if (input && typeof input.cwd === 'string' && input.cwd) return input.cwd;
  return process.cwd();
}

function ledgerPath(input) {
  return path.join(projectDir(input), LEDGER_RELPATH);
}

// Append one line; create the parent directory on first use. Failures are
// swallowed — there is nowhere useful to report a telemetry write failure
// from inside a hook, and stderr noise on every tool call is worse than a
// gap in the ledger.
function appendLine(file, obj) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(obj) + '\n', 'utf8');
  } catch (_) {
    /* swallowed by design — see above */
  }
}

// Pull a numeric duration (ms) out of a tool response, wherever this Claude
// Code version put it. Returns null when none is derivable — the report
// counts those calls but excludes them from duration math.
function extractDurationMs(resp) {
  if (!resp || typeof resp !== 'object') return null;
  const candidates = [
    resp.totalDurationMs,
    resp.total_duration_ms,
    resp.durationMs,
    resp.duration_ms,
    resp.duration,
  ];
  for (const c of candidates) {
    if (typeof c === 'number' && isFinite(c) && c >= 0) return Math.round(c);
  }
  // Some shapes nest usage/stats one level down.
  for (const key of ['usage', 'stats', 'meta']) {
    const nested = extractDurationMs(resp[key]);
    if (nested !== null) return nested;
  }
  return null;
}

// Token totals are NOT exposed by current hook events; if a future Claude Code
// starts putting them in the tool response, record them rather than losing
// them. Absence is the expected case.
function extractTokens(resp) {
  if (!resp || typeof resp !== 'object') return null;
  const candidates = [resp.totalTokens, resp.total_tokens];
  for (const c of candidates) {
    if (typeof c === 'number' && isFinite(c) && c >= 0) return c;
  }
  if (resp.usage && typeof resp.usage === 'object') {
    const u = resp.usage;
    const parts = [u.input_tokens, u.output_tokens].filter(
      (n) => typeof n === 'number' && isFinite(n)
    );
    if (parts.length) return parts.reduce((a, b) => a + b, 0);
  }
  return null;
}

function buildRecord(input) {
  const rec = { ts: new Date().toISOString() };
  if (typeof input.session_id === 'string' && input.session_id) rec.session = input.session_id;
  if (typeof input.hook_event_name === 'string' && input.hook_event_name) {
    rec.event = input.hook_event_name;
  }
  if (typeof input.tool_name === 'string' && input.tool_name) rec.tool = input.tool_name;

  const ti = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input : null;
  const tr =
    input.tool_response && typeof input.tool_response === 'object' ? input.tool_response : null;

  // Agent dispatch/completion detail — the rows WO-1 actually cares about.
  if (rec.tool && AGENT_TOOLS.has(rec.tool) && ti) {
    if (typeof ti.subagent_type === 'string' && ti.subagent_type) {
      rec.subagent_type = ti.subagent_type;
    }
    if (typeof ti.model === 'string' && ti.model) rec.model = ti.model;
    if (typeof ti.description === 'string' && ti.description) {
      rec.description = ti.description.slice(0, 120);
    }
  }
  // SubagentStop events carry agent identity at the top level in some
  // versions; keep whatever is there.
  if (typeof input.agent_type === 'string' && input.agent_type) rec.subagent_type = input.agent_type;
  if (typeof input.agent_id === 'string' && input.agent_id) rec.agent_id = input.agent_id;

  const dur = extractDurationMs(tr);
  if (dur !== null) rec.duration_ms = dur;
  const tok = extractTokens(tr);
  if (tok !== null) rec.total_tokens = tok;
  return rec;
}

// ------------------------------------------------------------------ report

function fmtMs(msTotal) {
  if (msTotal >= 3600000) return (msTotal / 3600000).toFixed(1) + 'h';
  if (msTotal >= 60000) return (msTotal / 60000).toFixed(1) + 'm';
  if (msTotal >= 1000) return (msTotal / 1000).toFixed(1) + 's';
  return msTotal + 'ms';
}

function pad(s, w) {
  s = String(s);
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

function padLeft(s, w) {
  s = String(s);
  return s.length >= w ? s : ' '.repeat(w - s.length) + s;
}

// The attribution key for a ledger row: model wins (it is the thing the
// allowance bills), then agent type, then the bare tool/event name.
function rowKey(rec) {
  const who = rec.subagent_type || rec.tool || rec.event || '(unknown)';
  return rec.model ? who + ' [' + rec.model + ']' : who;
}

function report(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    process.stderr.write('cannot read ledger ' + file + ': ' + ((e && e.message) || e) + '\n');
    process.exitCode = 1;
    return;
  }
  // day -> key -> { calls, durMs, durCalls, errors }
  const days = new Map();
  let errors = 0;
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let rec;
    try {
      rec = JSON.parse(t);
    } catch (_) {
      errors++;
      continue;
    }
    if (!rec || typeof rec !== 'object') continue;
    if (rec.telemetry_error) {
      errors++;
      continue;
    }
    const day = typeof rec.ts === 'string' ? rec.ts.slice(0, 10) : '(no-date)';
    const key = rowKey(rec);
    if (!days.has(day)) days.set(day, new Map());
    const perKey = days.get(day);
    if (!perKey.has(key)) perKey.set(key, { calls: 0, durMs: 0, durCalls: 0 });
    const cell = perKey.get(key);
    cell.calls++;
    if (typeof rec.duration_ms === 'number' && isFinite(rec.duration_ms)) {
      cell.durMs += rec.duration_ms;
      cell.durCalls++;
    }
  }

  const out = [];
  out.push('ORCHESTRA LEDGER REPORT — ' + file);
  out.push('(call counts + wall clock only; token draw and bucket state are NOT in hook');
  out.push(' events — pair this with the manual observations in probes/RUNBOOK.md)');
  out.push('');
  const KEY_W = 44;
  out.push(
    pad('day', 12) + pad('model / agent-type / tool', KEY_W) +
      padLeft('calls', 7) + padLeft('timed', 7) + padLeft('total', 10) + padLeft('mean', 10)
  );
  out.push('-'.repeat(12 + KEY_W + 7 + 7 + 10 + 10));
  for (const day of Array.from(days.keys()).sort()) {
    const perKey = days.get(day);
    const keys = Array.from(perKey.keys()).sort(
      (a, b) => perKey.get(b).calls - perKey.get(a).calls || a.localeCompare(b)
    );
    for (const key of keys) {
      const c = perKey.get(key);
      out.push(
        pad(day, 12) +
          pad(key.slice(0, KEY_W - 1), KEY_W) +
          padLeft(c.calls, 7) +
          padLeft(c.durCalls, 7) +
          padLeft(c.durCalls ? fmtMs(c.durMs) : '-', 10) +
          padLeft(c.durCalls ? fmtMs(c.durMs / c.durCalls) : '-', 10)
      );
    }
  }
  if (!days.size) out.push('(ledger is empty)');
  if (errors) {
    out.push('');
    out.push(errors + ' unparseable / telemetry_error line(s) skipped.');
  }
  out.push('');
  out.push('"timed" = calls whose tool response exposed a duration; "total"/"mean" cover');
  out.push('only those. Task/Agent rows approximate subagent wall clock; other rows are');
  out.push('single tool calls.');
  process.stdout.write(out.join('\n') + '\n');
}

// ------------------------------------------------------------------ hook

function hookMain(raw) {
  let input = null;
  try {
    input = JSON.parse(raw);
    if (!input || typeof input !== 'object') throw new Error('event is not an object');
  } catch (e) {
    appendLine(ledgerPath(null), {
      ts: new Date().toISOString(),
      telemetry_error: 'unparseable hook event: ' + ((e && e.message) || String(e)),
      raw_head: String(raw).slice(0, 200),
    });
    return;
  }
  try {
    appendLine(ledgerPath(input), buildRecord(input));
  } catch (e) {
    appendLine(ledgerPath(input), {
      ts: new Date().toISOString(),
      telemetry_error: 'record build failed: ' + ((e && e.message) || String(e)),
    });
  }
}

// ------------------------------------------------------------------ entry

const argv = process.argv.slice(2);
if (argv[0] === '--report') {
  report(path.resolve(argv[1] || path.join(projectDir(null), LEDGER_RELPATH)));
} else {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (raw += chunk));
  process.stdin.on('end', () => {
    try {
      hookMain(raw);
    } catch (_) {
      /* never brick the session on a telemetry bug */
    }
    process.exit(0);
  });
  // A hook invoked with no stdin at all (or a harness that never closes it)
  // must still terminate promptly and exit 0.
  process.stdin.on('error', () => process.exit(0));
}
