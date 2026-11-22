// Records the memory each spec file needs: the highest proportional set size (PSS) of its worker's
// whole process tree (the worker, its Chromium and their children) seen while one of the file's tests
// ran. PSS divides shared pages between the processes that map them, so the figures add up across
// workers. Written at the end of the run to SPEC_MEMORY_OUT (default build/spec-memory.json) as
//   { "<spec file relative to the repo>": <peak GB>, ... }
// scripts/spec-costs.mjs folds a green run's figures into the cost table the admission script reads.
//
// Workers are the reporter's own child processes running workerProcessEntry.js. Playwright sets
// TEST_WORKER_INDEX inside the worker after it starts, which /proc/<pid>/environ does not show, so a
// live worker is matched to its index by order: workers start in index order, and the live ones sorted
// by pid line up with the live indexes sorted ascending. Linux only; where /proc cannot be read the
// reporter records nothing and says so.
import {readdirSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, relative} from 'node:path';

const SAMPLE_MS = 500;
const GB = 1024 * 1024;   // kB per GB

/** pid -> parent pid for every process, from /proc/<pid>/stat. */
function parentMap() {
  const parents = new Map();
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const stat = readFileSync(`/proc/${name}/stat`, 'utf8');
      const afterName = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      parents.set(Number(name), Number(afterName[1]));
    } catch { /* the process ended between the listing and the read */ }
  }
  return parents;
}

function descendants(root, parents) {
  const found = [root];
  for (let i = 0; i < found.length; i++) {
    for (const [pid, ppid] of parents) if (ppid === found[i]) found.push(pid);
  }
  return found;
}

function pssKb(pid) {
  try {
    const m = /^Pss:\s+(\d+) kB/m.exec(readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8'));
    return m === null ? 0 : Number(m[1]);
  } catch { return 0; }
}

function isWorker(pid) {
  try { return readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes('workerProcessEntry.js'); } catch { return false; }
}

export default class SpecMemoryReporter {
  constructor() {
    this.out = process.env.SPEC_MEMORY_OUT ?? 'build/spec-memory.json';
    this.running = new Map();   // workerIndex -> spec file now running on it
    this.liveIndexes = new Set();   // every worker index seen and not yet replaced
    this.peakKb = new Map();   // spec file -> highest tree PSS
    this.timer = null;
    this.readable = true;
  }

  onBegin() {
    try { readdirSync('/proc'); } catch { this.readable = false; return; }
    this.timer = setInterval(() => this.sample(), SAMPLE_MS);
    this.timer.unref();
  }

  onTestBegin(test, result) {
    this.liveIndexes.add(result.workerIndex);
    this.running.set(result.workerIndex, relative(process.cwd(), test.location.file));
  }

  onTestEnd(test, result) {
    this.sample();
    this.running.delete(result.workerIndex);
  }

  sample() {
    if (!this.readable || this.running.size === 0) return;
    const parents = parentMap();
    const workers = [...parents].filter(([pid, parent]) => parent === process.pid && isWorker(pid)).map(([pid]) => pid).sort((a, b) => a - b);
    const indexes = [...this.liveIndexes].sort((a, b) => a - b).slice(-workers.length);
    for (const [index, file] of this.running) {
      const pid = workers[indexes.indexOf(index)];
      if (pid === undefined) continue;
      let total = 0;
      for (const p of descendants(pid, parents)) total += pssKb(p);
      if (total > (this.peakKb.get(file) ?? 0)) this.peakKb.set(file, total);
    }
  }

  onEnd() {
    if (this.timer !== null) clearInterval(this.timer);
    if (!this.readable) { console.error('spec-memory: /proc is not readable here; nothing recorded'); return; }
    const table = {};
    for (const [file, kb] of [...this.peakKb].sort()) table[file] = Number((kb / GB).toFixed(3));
    mkdirSync(dirname(this.out), {recursive: true});
    writeFileSync(this.out, JSON.stringify(table, null, 2) + '\n');
  }
}
