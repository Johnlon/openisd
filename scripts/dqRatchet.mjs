#!/usr/bin/env node
/**
 * dqRatchet.mjs — Gate A of sync-driver-snapshot.sh: dq.alert counts by kind never rise.
 *
 *   node scripts/dqRatchet.mjs scan  <datasheets-dir>
 *   node scripts/dqRatchet.mjs check <datasheets-dir> <baseline.json> [QO<n>]
 *   node scripts/dqRatchet.mjs write <datasheets-dir> <baseline.json> [QO<n>]
 *
 * dq.alert: one warning per line, "<field>: <text>". kind = "<field>: <text with digit runs as #>".
 * scan prints {counts, lines} as JSON (counts sorted by kind; lines[kind] = "<record>: <line>", sorted).
 * check exits 1 and prints every kind whose count rose (or is new) when no ruling is given.
 * write stores counts; a kind that rose under a ruling keeps that ruling id in "rulings".
 * Baseline file: {"counts": {kind: n}, "rulings": {kind: "QO<n>"}}.
 */
import {existsSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

export const RULING_RE = /^QO[0-9]+$/;
const SHOW_MAX = 50;

export function kindOf(line) {
  const text = line.trim().replace(/\s+/g, ' ');
  const i = text.indexOf(': ');
  const field = i < 0 ? '' : text.slice(0, i).trim();
  const msg = (i < 0 ? text : text.slice(i + 2)).replace(/\d+(?:\.\d+)?/g, '#').trim();
  return `${field}: ${msg}`;
}

function alertFiles(dir, rel = '') {
  return readdirSync(dir, {withFileTypes: true}).flatMap(e => {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) return alertFiles(join(dir, e.name), r);
    return e.name === 'dq.alert' ? [r] : [];
  });
}

export function scan(dir) {
  const lines = {};
  for (const file of alertFiles(dir).sort()) {
    const record = file.replace(/\/?dq\.alert$/, '');
    for (const raw of readFileSync(join(dir, file), 'utf8').split(/\r?\n/)) {
      if (!raw.trim()) continue;
      (lines[kindOf(raw)] ??= []).push(`${record}: ${raw.trim()}`);
    }
  }
  const kinds = Object.keys(lines).sort();
  return {counts: Object.fromEntries(kinds.map(k => [k, lines[k].length])),
          lines: Object.fromEntries(kinds.map(k => [k, lines[k].sort()]))};
}

export function readBaseline(path) {
  if (!existsSync(path)) return {counts: {}, rulings: {}};
  const b = JSON.parse(readFileSync(path, 'utf8'));
  return {counts: b.counts ?? {}, rulings: b.rulings ?? {}};
}

export function rises(counts, baseline) {
  return Object.keys(counts).filter(k => counts[k] > (baseline.counts[k] ?? 0))
    .map(k => ({kind: k, from: baseline.counts[k] ?? 0, to: counts[k]}));
}

export function nextBaseline(counts, baseline, ruling) {
  const rulings = {};
  for (const k of Object.keys(counts)) if (baseline.rulings[k]) rulings[k] = baseline.rulings[k];
  if (ruling) for (const r of rises(counts, baseline)) rulings[r.kind] = ruling;
  const sorted = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
  return {counts: sorted(counts), rulings: sorted(rulings)};
}

function main([cmd, dir, baselinePath, ruling]) {
  if (!['scan', 'check', 'write'].includes(cmd) || !dir || (cmd !== 'scan' && !baselinePath)) {
    console.error('usage: dqRatchet.mjs scan <dir> | check|write <dir> <baseline.json> [QO<n>]');
    return 2;
  }
  if (ruling !== undefined && !RULING_RE.test(ruling)) { console.error(`dqRatchet: bad ruling id "${ruling}" (want QO<n>)`); return 2; }
  const {counts, lines} = scan(dir);
  if (cmd === 'scan') { console.log(JSON.stringify({counts, lines}, null, 2)); return 0; }
  const baseline = readBaseline(baselinePath);
  if (cmd === 'write') {
    writeFileSync(baselinePath, `${JSON.stringify(nextBaseline(counts, baseline, ruling), null, 2)}\n`);
    return 0;
  }
  const up = rises(counts, baseline);
  if (!up.length) return 0;
  const total = up.reduce((n, r) => n + r.to - r.from, 0);
  if (ruling) { console.error(`dqRatchet: ${total} more dq.alert line(s) allowed by ruling ${ruling}`); return 0; }
  console.error(`dqRatchet: dq.alert counts rose (${up.length} kind(s)); a rise needs --dq-ruling QO<n>`);
  for (const r of up) {
    console.error(`  ${r.kind}  ${r.from} -> ${r.to}`);
    const all = lines[r.kind];
    for (const l of all.slice(0, SHOW_MAX)) console.error(`    ${l}`);
    if (all.length > SHOW_MAX) console.error(`    ... and ${all.length - SHOW_MAX} more`);
  }
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = main(process.argv.slice(2));
