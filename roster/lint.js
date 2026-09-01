#!/usr/bin/env node
/**
 * WO-8–11 roster contract lint — "each role ships only with all nine fields
 * populated and its contract lint passing (mirror-or-declared-exception
 * included)".
 *
 *   node roster/lint.js            # lint every roster/*.md, exit 0/1
 *
 * The nine fields are Part 2.0's role-entry fields, carried as body headings
 * in every shipped roster file:
 *
 *   Purpose · Casting · Rationale · Tools · Strengths ·
 *   Weaknesses / failure modes · Owns / must not receive · Escalation · Review
 *
 * Per file the lint checks:
 *   - frontmatter parses and carries name, description, model, seat (plus
 *     rung, or lane for the computed Reviewer); the name collides with no
 *     legacy agents/*.md name (both rosters co-install during shadow, §6.6);
 *   - the seat exists in router/castings.json and router/charters.json, and
 *     the frontmatter model+effort match the declared rung's documented
 *     casting (launcher files declare engine/engine_model instead, matched
 *     the same way);
 *   - all nine headings are present with non-empty bodies;
 *   - mirror-or-declared-exception: the seat's casting table carries a
 *     mirror rung, a declared noMirrorFor exception (any rung key — a
 *     partial-rung refusal like Archivist's videoAudio, or a whole-rung
 *     exception like Interface Artisan's primary), a declared
 *     crossFamilyByConstruction exception (Test Designer — mirror
 *     substitution is unlawful by the seat's own cast rule), or is the
 *     computed Reviewer (whose matrix spans both families by
 *     construction). A declared exception only counts with a non-empty
 *     `reason` string — a truthy key alone does not satisfy the check.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROSTER_DIR = __dirname;
const MASTER = path.resolve(ROSTER_DIR, '..');
const castings = JSON.parse(fs.readFileSync(path.join(MASTER, 'router', 'castings.json'), 'utf8'));
const charters = JSON.parse(fs.readFileSync(path.join(MASTER, 'router', 'charters.json'), 'utf8'));

// Non-role documents living in roster/ — everything else *.md must be a
// role file with full frontmatter and the nine fields. Record documents
// (work-order dispositions, exercise orders/reports/verdicts) carry a
// `woN-` or `rN-exN-` prefix by convention; dated campaign records
// (readiness-*, roster-*) carry a `-YYYY-MM-DD.md` suffix.
const NON_ROLE_NAMES = new Set(['README.md', 'EXERCISES.md']);
const RECORD_DOC_RE = /^(wo\d+-|r\d+-ex\d+-|(readiness|roster)-.*-\d{4}-\d{2}-\d{2}\.md$)/;
const isRoleFile = (f) => f.endsWith('.md') && !NON_ROLE_NAMES.has(f) && !RECORD_DOC_RE.test(f);

const NINE_FIELDS = [
  'Purpose', 'Casting', 'Rationale', 'Tools', 'Strengths',
  'Weaknesses / failure modes', 'Owns / must not receive', 'Escalation', 'Review',
];
const MODEL_BY_FRONTMATTER = { fable: 'Fable 5', opus: 'Opus 5', sonnet: 'Sonnet 5', haiku: 'Haiku 4.5' };
const EFFORT_ALIAS = { medium: 'med', med: 'med', low: 'low', high: 'high', xhigh: 'xhigh', max: 'max', off: 'off' };

function parseFrontmatter(text, file, problems) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) { problems.push(file + ': no frontmatter block'); return null; }
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

function effortMatches(fmEffort, castingEffort) {
  if (!fmEffort) return false;
  const e = EFFORT_ALIAS[fmEffort] || fmEffort;
  return String(castingEffort).split('–').includes(e);
}

function lint() {
  const problems = [];
  // Lowercased throughout — the collision check is case-insensitive so a
  // roster file cannot dodge it by case alone (e.g. a roster file whose
  // frontmatter `name` is `_template` would still collide with the
  // legacy `agents/specialists/_TEMPLATE.md`).
  const legacyNames = new Set(
    fs.readdirSync(path.join(MASTER, 'agents')).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '').toLowerCase())
  );
  // agents/ is not flat — agents/specialists/*.md carries live specialist
  // files (e.g. modeler.md) that a roster seat can supersede/shadow by name
  // (WO-10: spatial-specialist.md supersedes agents/specialists/modeler.md
  // per router/aliases.json). A roster file named e.g. modeler.md would
  // collide undetected if this directory were left unscanned.
  const specialistsDir = path.join(MASTER, 'agents', 'specialists');
  if (fs.existsSync(specialistsDir)) {
    for (const f of fs.readdirSync(specialistsDir)) {
      if (f.endsWith('.md')) legacyNames.add(f.replace(/\.md$/, '').toLowerCase());
    }
  }
  const files = fs.readdirSync(ROSTER_DIR).filter(isRoleFile);
  const seen = new Set();

  for (const file of files) {
    const text = fs.readFileSync(path.join(ROSTER_DIR, file), 'utf8');
    const fm = parseFrontmatter(text, file, problems);
    if (!fm) continue;

    for (const key of ['name', 'description', 'model', 'seat']) {
      if (!fm[key]) problems.push(file + ': frontmatter missing ' + key);
    }
    if (fm.name) {
      // Case-insensitive, matching the legacy-collision check just below —
      // `data-engineer` and `Data-Engineer` are the same collision, not two
      // distinct roster names.
      const nameLower = fm.name.toLowerCase();
      if (seen.has(nameLower)) problems.push(file + ': duplicate roster agent name ' + fm.name);
      seen.add(nameLower);
      if (legacyNames.has(nameLower)) {
        problems.push(file + ': name "' + fm.name + '" collides with a legacy agents/*.md or agents/specialists/*.md — both rosters co-install during shadow (§6.6)');
      }
    }

    const seat = fm.seat;
    const role = seat && castings.roles[seat];
    const charter = seat && charters.charters[seat];
    if (!role) { problems.push(file + ': seat ' + JSON.stringify(seat) + ' not in router/castings.json'); continue; }
    if (!charter) problems.push(file + ': seat ' + JSON.stringify(seat) + ' has no charter in router/charters.json');

    // Casting cross-check: rung for cast seats, lane for the computed Reviewer.
    if (role.computed) {
      const lane = fm.lane;
      if (!['anthropic', 'openai'].includes(lane)) {
        problems.push(file + ': computed seat needs lane: anthropic|openai');
      } else {
        const row = castings.reviewMatrix[lane === 'anthropic' ? 'openai' : 'anthropic'].T2;
        const expected = row.model;
        const got = fm.engine_model || MODEL_BY_FRONTMATTER[fm.model];
        if (got !== expected) {
          problems.push(file + ': ' + lane + ' reviewer lane must carry the matrix casting ' + expected + ' (mandatory tier); frontmatter resolves to ' + got);
        }
        if (fm.engine_model && fm.engine !== 'codex') problems.push(file + ': engine_model without engine: codex');
        if (!fm.engine && !effortMatches(fm.effort, row.effort)) {
          problems.push(file + ': effort ' + JSON.stringify(fm.effort) + ' does not match the matrix effort ' + row.effort);
        }
      }
    } else {
      const rung = fm.rung && (role.rungs || {})[fm.rung];
      if (!rung) {
        problems.push(file + ': rung ' + JSON.stringify(fm.rung) + ' not documented for ' + seat);
      } else {
        const expectedModel = rung.model;
        const got = fm.engine_model || MODEL_BY_FRONTMATTER[fm.model];
        if (got !== expectedModel) {
          problems.push(file + ': model resolves to ' + got + ' but ' + seat + '.' + fm.rung + ' is cast ' + expectedModel);
        }
        if (fm.engine_model && fm.engine !== 'codex') problems.push(file + ': engine_model without engine: codex');
        if (!fm.engine && !effortMatches(fm.effort, rung.effort)) {
          problems.push(file + ': effort ' + JSON.stringify(fm.effort) + ' does not sit on ' + seat + '.' + fm.rung + '’s documented effort ' + rung.effort);
        }
      }
    }

    // The nine fields, each with a non-empty body.
    const body = text.slice(text.indexOf('---', 4) + 3);
    for (const field of NINE_FIELDS) {
      const re = new RegExp('^##\\s+' + field.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\s*$', 'mi');
      const hit = re.exec(body);
      if (!hit) { problems.push(file + ': missing field heading "## ' + field + '"'); continue; }
      const rest = body.slice(hit.index + hit[0].length);
      const next = rest.search(/^##\s+/m);
      const content = (next === -1 ? rest : rest.slice(0, next)).trim();
      if (content.length < 20) problems.push(file + ': field "' + field + '" is empty or trivial');
    }

    // Mirror-or-declared-exception. A declared exception must carry a
    // non-empty reason string to count — a truthy key alone is not enough.
    const hasMirror = !!(role.rungs || {}).mirror;
    const noMirrorReasons = Object.keys(role.noMirrorFor || {})
      .filter((k) => k !== 'unstatedInPlan')
      .map((k) => role.noMirrorFor[k]);
    const hasNoMirrorException = noMirrorReasons.length > 0
      && noMirrorReasons.every((r) => typeof r === 'string' && r.trim().length > 0);
    const cfbc = role.crossFamilyByConstruction;
    const hasCrossFamilyException = !!cfbc && typeof cfbc.reason === 'string' && cfbc.reason.trim().length > 0;
    if (!hasMirror && !hasNoMirrorException && !hasCrossFamilyException && !role.computed && seat !== 'Conductor') {
      // Conductor's mirror is a rung named mirror too, so this is general.
      problems.push(file + ': seat ' + seat + ' has neither a mirror rung nor a declared no-mirror exception in castings.json');
    }
  }
  return problems;
}

module.exports = { lint, NINE_FIELDS };

if (require.main === module) {
  const problems = lint();
  if (problems.length) {
    console.error('ROSTER CONTRACT LINT FAILED — ' + problems.length + ' violation(s):');
    for (const p of problems) console.error('  - ' + p);
    process.exitCode = 1;
  } else {
    const n = fs.readdirSync(ROSTER_DIR).filter(isRoleFile).length;
    console.log('roster contract lint OK: ' + n + ' role file(s), all nine fields populated, castings cross-checked, mirror-or-declared-exception verified');
  }
}
