#!/usr/bin/env node
// analyze-telemetry.mjs — turn build/ui-telemetry/{events,memory}.jsonl into a report.
// Usage: node analyze-telemetry.mjs [events.jsonl] [memory.jsonl]
import {readFileSync} from 'node:fs';

const EV = process.argv[2] ?? 'build/ui-telemetry/events.jsonl';
const MEM = process.argv[3] ?? 'build/ui-telemetry/memory.jsonl';

function load(path) {
  return readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}

const events = load(EV);
const mem = load(MEM);
const ends = events.filter((e) => e.event === 'test-end');
const runEnd = events.find((e) => e.event === 'run-end');
const runBegin = events.find((e) => e.event === 'run-begin');

const passed = ends.filter((e) => e.status === 'passed');
const timed = ends.filter((e) => e.status === 'timedOut');
const failed = ends.filter((e) => e.status === 'failed');

const out = [];
const line = (s) => out.push(s);
const sep = () => line('='.repeat(72));

sep();
line(`RUN  ${ends.length}/${runBegin?.total ?? '?'} tests  |  ${passed.length} passed  ${failed.length} failed  ${timed.length} timedOut  |  duration ${(runEnd?.durationMs ?? 0) / 60000 | 0}min`);
sep();

line('\n## Failure clusters (file -> count, by status)');
const byFile = new Map();
for (const e of [...failed, ...timed]) {
  const k = e.file ?? 'unknown';
  if (!byFile.has(k)) byFile.set(k, { timeout: 0, failed: 0, titles: [] });
  const v = byFile.get(k);
  if (e.status === 'timedOut') v.timeout++; else v.failed++;
  v.titles.push(`${e.status} ${e.line}:${(e.title ?? '').slice(0, 60)}`);
}
[...byFile.entries()]
  .sort((a, b) => (b[1].timeout + b[1].failed) - (a[1].timeout + a[1].failed))
  .forEach(([file, v]) => {
    line(`\n${v.timeout + v.failed}x ${file}  (${v.timeout} timeout, ${v.failed} fail)`);
    v.titles.forEach((t) => line(`   ${t}`));
  });

line('\n## Bottlenecks: slowest 15 tests');
[...ends].sort((a, b) => b.durationMs - a.durationMs).slice(0, 15).forEach((e, i) => {
  line(`  ${String(i + 1).padStart(2)}. ${String(Math.round(e.durationMs / 1000)).padStart(3)}s ${e.status.padEnd(9)} ${(e.file ?? '').split('/').pop()}:${e.line} ${(e.title ?? '').slice(0, 60)}`);
});

const passDur = passed.map((e) => e.durationMs).sort((a, b) => a - b);
if (passDur.length) {
  const q = (p) => passDur[Math.min(passDur.length - 1, Math.floor(passDur.length * p))];
  const sum = passDur.reduce((a, b) => a + b, 0);
  line(`\n## Passed-test timing  median ${q(0.5)}ms  p95 ${q(0.95)}ms  max ${q(1)}ms  total ${(sum / 60000).toFixed(1)}min`);
}

line('\n## Memory (per-sample, whole run)');
const avail = mem.map((m) => m.memAvailableMB).filter(Boolean);
const pss = mem.map((m) => m.chromiumPssMB).filter((v) => v !== null);
const rss = mem.map((m) => m.chromiumRssMB).filter((v) => v && v > 0);
const cpu = mem.map((m) => m.chromiumCpuPct ?? 0);
const min = (a) => (a.length ? Math.min(...a) : '—');
const max = (a) => (a.length ? Math.max(...a) : '—');
const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(0) : '—');
if (avail.length) line(`  memAvailableMB   min ${min(avail)}  max ${max(avail)}  avg ${avg(avail)}`);
if (pss.length) line(`  chromiumPssMB    min ${min(pss)}  max ${max(pss)}  avg ${avg(pss)}  (${pss.length}/${mem.length} samples had a browser)`);
if (rss.length) line(`  chromiumRssMB    min ${min(rss)}  max ${max(rss)}  avg ${avg(rss)}`);
line(`  chromiumCpuPct   max ${max(cpu)}  (idle-stuck = deadlock; pegged = busy-loop)`);

// correlate timeout windows with memory samples
line('\n## Timeouts vs memory pressure during each timed-out test');
const memByT = mem.map((m) => ({ t: new Date(m.t).getTime(), avail: m.memAvailableMB, procs: m.chromiumProcs ?? 0, cpu: m.chromiumCpuPct ?? 0 }));
for (const t of timed) {
  const start = new Date(t.t).getTime() - t.durationMs;
  const end = new Date(t.t).getTime();
  const ov = memByT.filter((m) => m.t >= start - 3000 && m.t <= end + 3000);
  if (!ov.length) continue;
  const a = ov.reduce((x, y) => x + y.avail, 0) / ov.length;
  const c = ov.reduce((x, y) => x + y.cpu, 0) / ov.length;
  const p = Math.max(...ov.map((m) => m.procs));
  line(`  ${t.durationMs / 1000 | 0}s ${(t.file ?? '').split('/').pop()}:${t.line} ${(t.title ?? '').slice(0, 50)}  avail~${a | 0}MB cpu~${c.toFixed(1)}% procs${p}`);
}

sep();
console.log(out.join('\n'));