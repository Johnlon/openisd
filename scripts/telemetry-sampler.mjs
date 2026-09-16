#!/usr/bin/env node
/**
 * telemetry-sampler.mjs — machine state every N seconds, on the same clock as the test events.
 *
 *   node scripts/telemetry-sampler.mjs [outFile] [intervalSeconds]
 *
 * Appends one JSON line per sample to build/ui-telemetry/memory.jsonl:
 *   {t, memFreeMB, memAvailableMB, swapUsedMB,
 *    chromiumRssMB, chromiumPssMB, chromiumProcs,
 *    chromiumCpuPct, chromiumCpuUserPct, chromiumCpuSysPct,
 *    viteRssMB, nodeRssMB, loadAvg1}
 *
 * Chromium calls setsid() which detaches it from our session.  We detect it by
 * checking parent session: if the process's ppid is in our session, it's ours.
 *
 * CPU% is computed from delta utime+stime between samples, normalised by
 * numCpus × ticksPerSec × elapsedSeconds.  Clamped to 0 if ticks went backwards
 * (process recycled its pid).
 *
 * No dependencies: /proc/meminfo, /proc/<pid>/{stat,cmdline,smaps_rollup} and os.loadavg only.
 * Runs until killed (SIGTERM/SIGINT) and flushes every sample as it takes it.
 */
import { appendFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadavg, cpus } from 'node:os';

const OUT = process.argv[2] ?? 'build/ui-telemetry/memory.jsonl';
const INTERVAL_MS = Number(process.argv[3] ?? 5) * 1000;
const PAGE_KB = 4;
const NUM_CPUS = cpus().length;
const TICKS_PER_SEC = 100; // CLK_TCK on Linux

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

/** Every live pid, with identifying strings, session, parent session, RSS, and CPU ticks. */
function processes() {
  const out = [];
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const stat = readFileSync(`/proc/${name}/stat`, 'utf8');
      const after = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      const comm = stat.slice(stat.indexOf('(') + 1, stat.lastIndexOf(')'));
      const cmdline = readFileSync(`/proc/${name}/cmdline`, 'utf8').replace(/\0/g, ' ');
      // Fields after ')': [0]=state [1]=ppid [2]=pgrp [3]=session ... [11]=utime [12]=stime [20]=vsize [21]=rss
      const ppid = Number(after[1]);
      let parentSession = -1;
      try {
        const pstat = readFileSync(`/proc/${ppid}/stat`, 'utf8');
        parentSession = Number(pstat.slice(pstat.lastIndexOf(')') + 2).split(' ')[3]);
      } catch { /* parent exited */ }

      out.push({
        pid: Number(name), comm, cmdline,
        session: Number(after[3]),
        parentSession,
        ppid,
        rssKB: Number(after[21]) * PAGE_KB,
        utime: Number(after[11]),
        stime: Number(after[12]),
      });
    } catch {
      // Process exited between readdir and read — normal, skip it.
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

/**
 * Compute CPU % from two tick snapshots.
 * @returns {{ userPct: number, sysPct: number, totalPct: number }}
 */
function computeCpuPercent(prevUtime, prevStime, curUtime, curStime, deltaSec) {
  const dU = curUtime - prevUtime;
  const dS = curStime - prevStime;
  if (dU < 0 || dS < 0) return { userPct: 0, sysPct: 0, totalPct: 0 };
  const userPct = Math.round((dU / (deltaSec * TICKS_PER_SEC * NUM_CPUS)) * 10000) / 100;
  const sysPct  = Math.round((dS / (deltaSec * TICKS_PER_SEC * NUM_CPUS)) * 10000) / 100;
  return { userPct, sysPct, totalPct: Math.round((userPct + sysPct) * 100) / 100 };
}

const isChromium = (p) => /^(chrome|chromium|headless_shell)/.test(p.comm);
const isVite = (p) => /\bvite\b/.test(p.cmdline) && !/telemetry-sampler/.test(p.cmdline);
const isRunner = (p) => /playwright/.test(p.cmdline) && !/telemetry-sampler/.test(p.cmdline);

// Which process tree belongs to this run?  Session matching alone is TOO brittle:
// scripts/run-ui-telemetry.sh launches us in a setsid'd session (good), but Chromium
// calls setsid() itself so a browser's session is its OWN pid and its children inherit
// that private session.  And when this sampler is relaunched mid-run into a fresh
// setsid, nothing shares our session at all.
//
// Robust rule: every pid whose session (or ancestry) reaches a process in the PORT
// session is the run's.  We (a) locate the Playwright runner's session — either our
// own when launched by run-ui-telemetry.sh, or any live `playwright ... test` process
// when relaunched manually — and (b) flood-fill its descendant subtree via ppid.
const RUN_RUNNER_SESSION = (() => {
  const selfSession = Number(
    readFileSync('/proc/self/stat', 'utf8').split(') ')[1].split(' ')[3]);
  const all = processes();
  if (all.some((p) => p.session === selfSession && isRunner(p))) return selfSession;
  const runner = all.find(isRunner);
  return runner ? runner.session : selfSession;
})();

/** pids that are this run's: same session as the runner, or a descendant of one. */
function runPidSubtree(all) {
  const children = new Map();
  for (const p of all) {
    if (!children.has(p.ppid)) children.set(p.ppid, []);
    children.get(p.ppid).push(p.pid);
  }
  const inRun = new Set(
    all.filter((p) => p.session === RUN_RUNNER_SESSION).map((p) => p.pid));
  const stack = [...inRun];
  while (stack.length) {
    for (const c of children.get(stack.pop()) ?? []) {
      if (!inRun.has(c)) {
        inRun.add(c);
        stack.push(c);
      }
    }
  }
  return inRun;
}

// Previous CPU ticks per pid — carried across samples for delta computation.
let prevTicks = new Map(); // pid -> { utime, stime }

function sample(deltaSec) {
  const all = processes();
  const runPids = runPidSubtree(all);
  const procs = all.filter((p) => runPids.has(p.pid));
  const chromium = procs.filter(isChromium);
  const chromiumElsewhere = all.filter((p) => isChromium(p) && !runPids.has(p.pid));
  const vite = procs.filter(isVite);
  const runner = procs.filter(isRunner);

  let chromiumPssKB = 0;
  let pssSeen = false;
  for (const p of chromium) {
    const pss = pssKB(p.pid);
    if (pss !== null) {
      chromiumPssKB += pss;
      pssSeen = true;
    }
  }

  // CPU% for chromium processes this run
  let totalUserTicks = 0;
  let totalSysTicks = 0;
  for (const p of chromium) {
    const prev = prevTicks.get(p.pid);
    if (prev) {
      const dU = p.utime - prev.utime;
      const dS = p.stime - prev.stime;
      if (dU >= 0) totalUserTicks += dU;
      if (dS >= 0) totalSysTicks += dS;
    }
  }
  const cpu = deltaSec > 0
    ? computeCpuPercent(0, 0, totalUserTicks, totalSysTicks, deltaSec)
    : { userPct: 0, sysPct: 0, totalPct: 0 };

  // Snapshot ticks for next delta
  const newTicks = new Map();
  for (const p of chromium) newTicks.set(p.pid, { utime: p.utime, stime: p.stime });
  // Also track runner + vite for completeness
  for (const p of [...vite, ...runner]) newTicks.set(p.pid, { utime: p.utime, stime: p.stime });
  prevTicks = newTicks;

  // CPU% for the playwright runner (detect tight-loop assertions)
  let runnerUserTicks = 0;
  let runnerSysTicks = 0;
  for (const p of runner) {
    const prev = prevTicks.get(p.pid);
    if (prev) {
      const dU = p.utime - prev.utime;
      const dS = p.stime - prev.stime;
      if (dU >= 0) runnerUserTicks += dU;
      if (dS >= 0) runnerSysTicks += dS;
    }
  }
  const runnerCpu = deltaSec > 0
    ? computeCpuPercent(0, 0, runnerUserTicks, runnerSysTicks, deltaSec)
    : { userPct: 0, sysPct: 0, totalPct: 0 };

  return {
    t: new Date().toISOString(),
    ...meminfo(),
    chromiumRssMB: sumMB(chromium),
    chromiumPssMB: pssSeen ? Math.round(chromiumPssKB / 1024) : null,
    chromiumProcs: chromium.length,
    chromiumCpuPct: cpu.totalPct,
    chromiumCpuUserPct: cpu.userPct,
    chromiumCpuSysPct: cpu.sysPct,
    viteRssMB: sumMB(vite),
    nodeRssMB: sumMB(runner),
    runnerCpuPct: runnerCpu.totalPct,
    otherChromiumRssMB: sumMB(chromiumElsewhere),
    otherChromiumProcs: chromiumElsewhere.length,
    loadAvg1: Number(loadavg()[0].toFixed(2)),
  };
}

mkdirSync(dirname(OUT), { recursive: true });
const deltaSec = INTERVAL_MS / 1000;
appendFileSync(OUT, JSON.stringify({ ...sample(deltaSec), note: 'sampler-start' }) + '\n');
const timer = setInterval(() => {
  try {
    appendFileSync(OUT, JSON.stringify(sample(deltaSec)) + '\n');
  } catch (err) {
    appendFileSync(OUT, JSON.stringify({ t: new Date().toISOString(), error: String(err) }) + '\n');
  }
}, INTERVAL_MS);

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    clearInterval(timer);
    appendFileSync(OUT, JSON.stringify({ ...sample(0), note: 'sampler-stop' }) + '\n');
    process.exit(0);
  });
}
