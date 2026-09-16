#!/usr/bin/env node
/**
 * telemetry-sampler.mjs — machine state every N seconds, on the same clock as the test events.
 *
 *   node scripts/telemetry-sampler.mjs [outFile] [intervalSeconds]
 *
 * Appends one JSON line per sample to build/ui-telemetry/memory.jsonl:
 *   {t, memFreeMB, memAvailableMB, swapUsedMB, chromiumRssMB, chromiumPssMB, chromiumProcs,
 *    viteRssMB, nodeRssMB, loadAvg1}
 *
 * BOTH Rss and Pss for chromium, on purpose. Summed RSS double-counts the pages Chromium's
 * ~10-13 processes per browser share (its own binary text, libGL, libc) and overstated real
 * usage by roughly 2x when this was measured for
 * bugs/BUG_20260913_oom_kills_wsl_vm_during_ui_tests.md; PSS divides each shared page by how
 * many processes map it and is the figure that answers "how much memory is this actually
 * using". RSS is kept because it is the number everything else (ps, top) reports.
 *
 * No dependencies: /proc/meminfo, /proc/<pid>/{stat,cmdline,smaps_rollup} and os.loadavg only.
 * Runs until killed (SIGTERM/SIGINT) and flushes every sample as it takes it.
 */
import { appendFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadavg } from 'node:os';

const OUT = process.argv[2] ?? 'build/ui-telemetry/memory.jsonl';
const INTERVAL_MS = Number(process.argv[3] ?? 5) * 1000;
const PAGE_KB = 4;

function meminfo() {
  const text = readFileSync('/proc/meminfo', 'utf8');
  const kb = (key) => {
    const m = text.match(new RegExp('^' + key + ':\\s+(\\d+) kB', 'm'));
    return m ? Number(m[1]) : null;
  };
  const swapTotal = kb('SwapTotal');
  const swapFree = kb('SwapFree');
  return {
    memFreeMB: Math.round((kb('MemFree') ?? 0) / 1024),
    memAvailableMB: Math.round((kb('MemAvailable') ?? 0) / 1024),
    swapUsedMB: swapTotal === null || swapFree === null
      ? null
      : Math.round((swapTotal - swapFree) / 1024),
  };
}

/** Every live pid, with the two identifying strings and its resident pages. */
function processes() {
  const out = [];
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      // Field 24 of /proc/<pid>/stat is RSS in pages. The process name in field 2 can contain
      // spaces and brackets, so split after the closing paren rather than on whitespace.
      const stat = readFileSync(`/proc/${name}/stat`, 'utf8');
      const after = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      const comm = stat.slice(stat.indexOf('(') + 1, stat.lastIndexOf(')'));
      const cmdline = readFileSync(`/proc/${name}/cmdline`, 'utf8').replace(/\0/g, ' ');
      // after[0] is field 3 (state), so session id is field 6 -> after[3] and RSS pages are
      // field 24 -> after[21].
      out.push({
        pid: name, comm, cmdline,
        session: Number(after[3]),
        rssKB: Number(after[21]) * PAGE_KB,
      });
    } catch {
      // The process exited between readdir and read — normal, skip it.
    }
  }
  return out;
}

/** Proportional Set Size in kB, or null where the kernel will not show it. */
function pssKB(pid) {
  try {
    const m = readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8').match(/^Pss:\s+(\d+) kB/m);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

function sumMB(procs) {
  return Math.round(procs.reduce((a, p) => a + p.rssKB, 0) / 1024);
}

// Everything this run started shares this process's session id, because
// scripts/run-ui-telemetry.sh is launched under setsid. Without this, a sample counts every
// chromium on the machine — 32 processes showed up during a ONE-worker sanity run, because
// other agent sessions had browsers of their own open. Per-run figures use the session filter;
// the box-wide figures are reported separately so contention from other sessions stays visible
// instead of being silently folded into this run's numbers.
const OUR_SESSION = Number(
  readFileSync('/proc/self/stat', 'utf8').split(') ')[1].split(' ')[3]);
const isChromium = (p) => /^(chrome|chromium|headless_shell)/.test(p.comm);

function sample() {
  const all = processes();
  const procs = all.filter((p) => p.session === OUR_SESSION);
  const chromium = procs.filter(isChromium);
  const chromiumElsewhere = all.filter((p) => isChromium(p) && p.session !== OUR_SESSION);
  const vite = procs.filter((p) => /\bvite\b/.test(p.cmdline) && !/telemetry-sampler/.test(p.cmdline));
  const runner = procs.filter((p) => /playwright/.test(p.cmdline) && !/telemetry-sampler/.test(p.cmdline));

  let chromiumPssKB = 0;
  let pssSeen = false;
  for (const p of chromium) {
    const pss = pssKB(p.pid);
    if (pss !== null) {
      chromiumPssKB += pss;
      pssSeen = true;
    }
  }

  return {
    t: new Date().toISOString(),
    ...meminfo(),
    chromiumRssMB: sumMB(chromium),
    chromiumPssMB: pssSeen ? Math.round(chromiumPssKB / 1024) : null,
    chromiumProcs: chromium.length,
    viteRssMB: sumMB(vite),
    nodeRssMB: sumMB(runner),
    // Other sessions' browsers: not this run's cost, but they compete for the same RAM, which
    // is what killed three runs on 2026-09-15.
    otherChromiumRssMB: sumMB(chromiumElsewhere),
    otherChromiumProcs: chromiumElsewhere.length,
    loadAvg1: Number(loadavg()[0].toFixed(2)),
  };
}

mkdirSync(dirname(OUT), { recursive: true });
appendFileSync(OUT, JSON.stringify({ ...sample(), note: 'sampler-start' }) + '\n');
const timer = setInterval(() => {
  try {
    appendFileSync(OUT, JSON.stringify(sample()) + '\n');
  } catch (err) {
    appendFileSync(OUT, JSON.stringify({ t: new Date().toISOString(), error: String(err) }) + '\n');
  }
}, INTERVAL_MS);

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    clearInterval(timer);
    appendFileSync(OUT, JSON.stringify({ ...sample(), note: 'sampler-stop' }) + '\n');
    process.exit(0);
  });
}
