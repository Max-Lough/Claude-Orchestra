#!/usr/bin/env node
/**
 * orchestra-ledger-report — read-only roll-up of an installed project's
 * ticket ledger: how long each work order took, what it drew, and what went
 * wrong. Never writes to the target. Not installed into projects; run it from
 * the master checkout against any roster:new install.
 *
 *   node tools/orchestra-ledger-report.js <projectDir> [--since <ISO>] [--json] [--all]
 *
 * Sources (all under <projectDir>/.claude/):
 *   orchestra/tickets/tickets.json          ticket records (timestamps, casting, outcome)
 *   orchestra/tickets/tickets.events.jsonl  transitions incl. refused ones
 *   orchestra/tickets/routing.events.jsonl  dispatch requests (goal text)
 *   orchestra/ledger/<ticket>/casting-record.json, verifier.json, verdict-audit.json
 *   orchestra-pool-readings.jsonl           owner-recorded bucket readings
 *   <ticket>.resolved.agent_transcript_path  Claude Code subagent transcript → token usage
 *
 * Usage figures are per-turn `usage` objects summed over the subagent's
 * transcript: every turn re-reads the prompt, so cache_read is the bulk of the
 * draw. Cost is the Claude API list-price equivalent — a proxy for bucket draw
 * on a subscription, not a bill. Codex-engine tickets (thin Haiku launcher
 * driving an OpenAI model) show only the launcher's usage; the engine's own
 * usage is not captured anywhere and is marked "engine usage n/a".
 */
'use strict';

const fs = require('fs');
const path = require('path');

// USD per MTok: [input, output, cache write (5m), cache read]
const PRICES = [
  [/fable-5-1|mythos-5-1/, [10, 50, 12.5, 0.25]],
  [/fable-5|mythos-5/, [10, 50, 12.5, 1.0]],
  [/opus-5|opus-4-8|opus-4-7|opus-4-6/, [5, 25, 6.25, 0.5]],
  [/sonnet-5/, [2, 10, 2.5, 0.2]],
  [/sonnet-4-6/, [3, 15, 3.75, 0.3]],
  [/haiku-4-5/, [1, 5, 1.25, 0.1]],
];
function priceFor(model) {
  const m = String(model || '').toLowerCase();
  for (const [re, p] of PRICES) if (re.test(m)) return p;
  return null;
}

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return fallback; }
}
function readJsonl(p) {
  let txt = '';
  try { txt = fs.readFileSync(p, 'utf8'); } catch (_) { return []; }
  const out = [];
  for (const line of txt.split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch (_) { /* skip torn line */ }
  }
  return out;
}
function ms(a, b) {
  if (!a || !b) return null;
  const d = Date.parse(b) - Date.parse(a);
  return Number.isFinite(d) ? d : null;
}
function fmtDur(m) {
  if (m == null) return '-';
  if (m < 1000) return m + 'ms';
  const s = Math.round(m / 1000);
  if (s < 60) return s + 's';
  const mm = Math.floor(s / 60), ss = s % 60;
  if (mm < 60) return mm + 'm' + String(ss).padStart(2, '0') + 's';
  return Math.floor(mm / 60) + 'h' + String(mm % 60).padStart(2, '0') + 'm';
}
function fmtK(n) {
  if (n == null) return '-';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function transcriptUsage(p) {
  if (!p || !fs.existsSync(p)) return null;
  const agg = { turns: 0, input: 0, output: 0, cache_write: 0, cache_read: 0, models: new Set() };
  for (const j of readJsonl(p)) {
    const m = j && j.message;
    if (!m || !m.usage) continue;
    agg.turns++;
    agg.input += m.usage.input_tokens || 0;
    agg.output += m.usage.output_tokens || 0;
    agg.cache_write += m.usage.cache_creation_input_tokens || 0;
    agg.cache_read += m.usage.cache_read_input_tokens || 0;
    if (m.model) agg.models.add(m.model);
  }
  if (!agg.turns) return null;
  agg.model = [...agg.models].join('+');
  delete agg.models;
  const p4 = priceFor(agg.model);
  agg.usd = p4
    ? (agg.input * p4[0] + agg.output * p4[1] + agg.cache_write * p4[2] + agg.cache_read * p4[3]) / 1e6
    : null;
  return agg;
}

function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir) {
    console.error('usage: node tools/orchestra-ledger-report.js <projectDir> [--since <ISO>] [--json] [--all]');
    process.exit(1);
  }
  const sinceArg = args.includes('--since') ? args[args.indexOf('--since') + 1] : null;
  const since = sinceArg ? Date.parse(sinceArg) : 0;
  const asJson = args.includes('--json');
  const showAll = args.includes('--all');

  const C = path.join(dir, '.claude');
  const store = readJson(path.join(C, 'orchestra', 'tickets', 'tickets.json'), { tickets: {} });
  const events = readJsonl(path.join(C, 'orchestra', 'tickets', 'tickets.events.jsonl'));
  const routing = readJsonl(path.join(C, 'orchestra', 'tickets', 'routing.events.jsonl'));
  const readings = readJsonl(path.join(C, 'orchestra-pool-readings.jsonl'));

  const goalByTask = new Map();
  for (const r of routing) {
    const req = r.request || {};
    // The routing event carries the goal; the task id lives wherever the
    // dispatch outcome put it (envelope id / task_id), so index every rt-* id.
    const ids = new Set();
    const collect = (v) => {
      if (typeof v === 'string' && /^rt-[0-9a-f]+(-q0)?$/.test(v)) ids.add(v);
      else if (v && typeof v === 'object') for (const x of Object.values(v)) collect(x);
    };
    collect({ a: r.task_id, b: r.envelope_id, c: r.envelope, d: r.outcome });
    for (const id of ids) if (!goalByTask.has(id)) goalByTask.set(id, req.goal || '');
  }
  // Fallback: envelope.json in the ledger carries the order goal; a Q0
  // companion (task id "<parent>-q0") inherits its parent's goal.
  const ledgerDir = path.join(C, 'orchestra', 'ledger');
  const goalOf = (taskId) => {
    if (!taskId) return '';
    if (goalByTask.has(taskId)) return goalByTask.get(taskId);
    const env = readJson(path.join(ledgerDir, taskId, 'envelope.json'), null);
    let g = (env && env.order && env.order.goal) || '';
    if (!g && /-q0$/.test(taskId)) g = '(Q0 for) ' + goalOf(taskId.replace(/-q0$/, ''));
    goalByTask.set(taskId, g);
    return g;
  };

  const tickets = Object.values(store.tickets || {})
    .filter((t) => Date.parse(t.issued_at || 0) >= since)
    .sort((a, b) => Date.parse(a.issued_at) - Date.parse(b.issued_at));

  const refusedByTicket = new Map();
  for (const e of events) {
    if (Date.parse(e.at || 0) < since) continue;
    const id = e.ticket_id || e.id;
    if (e.from === e.to && e.data && e.data.reason) {
      refusedByTicket.set(id, (refusedByTicket.get(id) || []).concat(e.event + ': ' + e.data.reason));
    }
  }

  const rows = [];
  const totals = { byRole: {}, byModel: {}, usd: 0, active_ms: 0, n: 0 };
  const errors = [];
  for (const t of tickets) {
    const cr = readJson(path.join(ledgerDir, t.id, 'casting-record.json'), null);
    const va = readJson(path.join(ledgerDir, t.id, 'verdict-audit.json'), null);
    const vf = readJson(path.join(ledgerDir, t.id, 'verifier.json'), null);
    const launchedAt = t.launched && t.launched.at;
    const resolvedAt = t.resolved && t.resolved.at;
    const closedAt = t.outcome && t.outcome.at;
    const engine = !!(t.engine_pass || t.engine_result);
    const usage = transcriptUsage(t.resolved && t.resolved.agent_transcript_path);
    const row = {
      id: t.id,
      issued_at: t.issued_at,
      kind: t.kind,
      class: t.class,
      role: t.role,
      rung: t.rung,
      tier: t.tier,
      requested: t.casting ? `${t.casting.model} · ${t.casting.effort}` : '-',
      served: (t.launched && t.launched.served_model) || '-',
      status: t.status,
      outcome: t.outcome ? t.outcome.code : null,
      outcome_reason: t.outcome ? t.outcome.reason : null,
      wait_ms: ms(t.issued_at, launchedAt),
      active_ms: ms(launchedAt, resolvedAt),
      close_ms: ms(resolvedAt, closedAt),
      engine,
      engine_run_nonce: t.engine_pass && t.engine_pass.run_nonce,
      usage,
      casting_record: !!cr,
      served_model_mismatch: cr ? !!cr.served_model_mismatch : null,
      verifier: vf ? (vf.result || vf.status || vf.verdict || 'present') : null,
      verdict_audit: va ? (va.result || va.status || va.stage || 'present') : null,
      refused: refusedByTicket.get(t.id) || [],
      attempts: Array.isArray(t.attempts) ? t.attempts.length : 0,
      goal: String(
        goalOf(t.task_id) ||
          (t.parent_ticket && store.tickets[t.parent_ticket]
            ? '(Q0 for) ' + goalOf(store.tickets[t.parent_ticket].task_id)
            : '')
      ).replace(/\s+/g, ' ').slice(0, 110),
    };
    rows.push(row);

    // ---- error / anomaly detection
    const flag = (msg) => errors.push({ id: t.id, role: t.role, msg });
    if (t.status === 'EXPIRED') flag('ticket EXPIRED (never resolved, or resolved after TTL)');
    if (t.status === 'INVALIDATED') flag('ticket INVALIDATED (generation bump / config change)');
    if (t.status === 'RESOLVED' && t.kind !== 'reviewer' && t.kind !== 'q0') flag('RESOLVED but never CLOSED — no casting record written');
    if (t.outcome && /NOT_CLOSED|REFUSED|BLOCKED|FAILED/i.test(t.outcome.code || '')) flag(`outcome ${t.outcome.code}: ${t.outcome.reason || ''}`.slice(0, 200));
    if (row.refused.length) flag(`refused transitions: ${row.refused.join(' | ')}`.slice(0, 200));
    if (row.attempts && !row.refused.length) flag(`${row.attempts} typed refusal(s) recorded in attempts`);
    if (cr && cr.served_model_mismatch) flag(`served_model_mismatch: requested ${row.requested}, served ${cr.served_model}`);
    if (engine && (!t.engine_pass || t.engine_pass.run_nonce === 'UNKNOWN')) flag('engine run_nonce UNKNOWN (PL-28)');
    if (engine && t.engine_result && t.engine_result.hasReport === false) flag('engine returned no report');
    if (va && /FAIL/i.test(JSON.stringify(va))) flag('verdict audit FAIL');
    if (vf && /FAIL|REFUTED/i.test(JSON.stringify(vf).slice(0, 400))) flag('verifier reported FAIL/REFUTED (see verifier.json)');
    if (t.status === 'LAUNCHED') flag('still LAUNCHED (in flight, or orphaned if no subagent is running)');

    // ---- totals
    if (row.active_ms != null) totals.active_ms += row.active_ms;
    totals.n++;
    const r = totals.byRole[t.role] = totals.byRole[t.role] || { n: 0, active_ms: 0, usd: 0, cache_read: 0, output: 0 };
    r.n++; if (row.active_ms) r.active_ms += row.active_ms;
    if (usage) {
      r.usd += usage.usd || 0; r.cache_read += usage.cache_read; r.output += usage.output;
      const m = totals.byModel[usage.model] = totals.byModel[usage.model] || { n: 0, usd: 0, cache_read: 0, cache_write: 0, output: 0 };
      m.n++; m.usd += usage.usd || 0; m.cache_read += usage.cache_read; m.cache_write += usage.cache_write; m.output += usage.output;
      totals.usd += usage.usd || 0;
    }
  }

  // ---- pool draw between first and last reading in window
  const pool = {};
  for (const r of readings) {
    if (r.kind !== 'reading' || Date.parse(r.ts || 0) < since) continue;
    const b = pool[r.bucket] = pool[r.bucket] || { first: null, last: null };
    if (!b.first) b.first = r;
    b.last = r;
  }

  if (asJson) {
    console.log(JSON.stringify({ since: sinceArg, rows, totals, errors, pool }, null, 2));
    return;
  }

  console.log(`Orchestra ledger report — ${dir}${sinceArg ? '  (since ' + sinceArg + ')' : ''}`);
  console.log(`tickets: ${rows.length}   summed active time: ${fmtDur(totals.active_ms)}   API-price equivalent: $${totals.usd.toFixed(2)}\n`);

  const shown = showAll ? rows : rows.filter((r) => r.kind !== 'q0' || r.status !== 'OPEN');
  console.log('TICKETS  (wait = issue→launch, active = launch→resolve, close = resolve→close)');
  for (const r of shown) {
    const u = r.usage
      ? `${r.usage.turns} turns  out ${fmtK(r.usage.output)}  cache-read ${fmtK(r.usage.cache_read)}  write ${fmtK(r.usage.cache_write)}  ~$${(r.usage.usd || 0).toFixed(2)}`
      : (r.engine ? 'engine usage n/a (launcher only)' : 'no transcript');
    console.log(`- ${r.id}  ${r.issued_at.slice(5, 16)}Z  ${r.class}/${r.role}${r.tier ? ' [' + r.tier + ']' : ''}  ${r.requested} → ${r.served}`);
    console.log(`    ${r.status}${r.outcome ? ' · ' + r.outcome : ''}   wait ${fmtDur(r.wait_ms)}  active ${fmtDur(r.active_ms)}  close ${fmtDur(r.close_ms)}   ${u}`);
    if (r.goal) console.log(`    ${r.goal}`);
  }

  console.log('\nBY ROLE');
  for (const [role, v] of Object.entries(totals.byRole)) {
    console.log(`- ${role.padEnd(26)} n=${String(v.n).padStart(2)}  active ${fmtDur(v.active_ms).padStart(8)}  out ${fmtK(v.output).padStart(7)}  cache-read ${fmtK(v.cache_read).padStart(8)}  ~$${v.usd.toFixed(2)}`);
  }
  console.log('\nBY MODEL (from subagent transcripts; Codex engines not captured)');
  for (const [model, v] of Object.entries(totals.byModel)) {
    console.log(`- ${model.padEnd(26)} n=${String(v.n).padStart(2)}  out ${fmtK(v.output).padStart(7)}  cache-read ${fmtK(v.cache_read).padStart(8)}  cache-write ${fmtK(v.cache_write).padStart(8)}  ~$${v.usd.toFixed(2)}`);
  }

  console.log('\nPOOL READINGS (owner-recorded; draw = first → last in window)');
  for (const [b, v] of Object.entries(pool)) {
    const d = v.first && v.last ? (v.first.remainingFraction - v.last.remainingFraction) : null;
    console.log(`- ${b.padEnd(9)} ${v.first.ts.slice(5, 16)}Z ${(v.first.remainingFraction * 100).toFixed(0)}% → ${v.last.ts.slice(5, 16)}Z ${(v.last.remainingFraction * 100).toFixed(0)}% remaining   draw ${d == null ? '-' : (d * 100).toFixed(0) + ' pts'}`);
  }

  console.log(`\nERRORS / ANOMALIES (${errors.length})`);
  for (const e of errors) console.log(`- ${e.id} ${e.role}: ${e.msg}`);
  if (!errors.length) console.log('- none');
}

main();
