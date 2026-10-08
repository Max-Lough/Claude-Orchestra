#!/usr/bin/env node
/**
 * WO-0 probe 6 helper: print the distinct model ids served in a Claude Code
 * transcript (JSONL), e.g. a subagent's agent_transcript_path from the probe log.
 *
 *   node probe-models.js <transcript.jsonl>
 *
 * Reads the file once, O(lines). Partial or non-JSON lines are skipped, since a
 * transcript can be mid-write. Exit 2 on bad usage, 1 when the file can't be read.
 */
'use strict';

const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('usage: node probe-models.js <transcript.jsonl>');
  process.exit(2);
}

let text;
try {
  text = fs.readFileSync(file, 'utf8');
} catch (e) {
  console.error('cannot read ' + file + ': ' + e.message);
  process.exit(1);
}

const models = new Set();
for (const line of text.split(/\r?\n/)) {
  if (!line.trim()) continue;
  try {
    const entry = JSON.parse(line);
    const model = entry && entry.message && entry.message.model;
    if (typeof model === 'string' && model) models.add(model);
  } catch (_) {
    // A partial last line while the transcript is still being written.
  }
}

console.log(models.size ? Array.from(models).join('\n') : '(no model field found)');
