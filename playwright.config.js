import { defineConfig } from '@playwright/test';
import os from 'os';
import fs from 'fs';

// Each worker's chromium (browser process + renderer) has cost the WSL VM real OOM incidents
// mid-suite — see bugs/BUG_20260913_oom_kills_wsl_vm_during_ui_tests.md. os.freemem() reports
// raw MemFree, which undercounts reclaimable page cache and made this over-throttle; /proc/
// meminfo's MemAvailable is the kernel's own "safe to hand out" estimate, so read that first.
function availableMemGB() {
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const match = meminfo.match(/^MemAvailable:\s+(\d+)\s*kB/m);
    if (match) return Number(match[1]) / (1024 * 1024);
  } catch {
    // Not Linux (e.g. config loaded under Git Bash on Windows) — fall through.
  }
  return os.freemem() / (1024 * 1024 * 1024);
}

// Budget per worker: measured via /proc/<pid>/smaps_rollup's Pss field (Proportional Set
// Size), not summed RSS — RSS double-counts pages Chromium's ~10-13 subprocesses per worker
// share (its own binary text, libGL, libc), so summed RSS overstated this by roughly 2x in an
// earlier pass. PSS divides each shared page by how many processes map it, giving actual
// physical memory. Peak observed sampling a --workers=3 run of packages/ui/test/ui/ every 2s:
// 1.80 GB PSS at peak load, ~0.6 GB/worker; the app's own bundle is 11 MB, so this is Chromium's
// per-instance overhead, not app weight. Rounded up for headroom on a worse-case page. reserveGB
// keeps room for vite, the OS, and whatever else is running so the suite backs off instead of
// being the straw that triggers the VM's OOM killer.
const MEM_PER_WORKER_GB = 0.7;
const RESERVE_GB = 2;
const MAX_SAFE_WORKERS = 2;

function computeWorkerCount() {
  const cpuCapped = Math.min(MAX_SAFE_WORKERS, Math.ceil(os.cpus().length / 2));
  const memCapped = Math.floor((availableMemGB() - RESERVE_GB) / MEM_PER_WORKER_GB);
  return Math.max(1, Math.min(cpuCapped, memCapped));
}

// scripts/test-browser.sh (via scripts/test-concurrency.sh) sets these after atomically
// reserving a slot against what OTHER concurrent runs have already claimed — see
// bugs/BUG_20260913_oom_kills_wsl_vm_during_ui_tests.md "Still open" for why a single process
// computing this alone isn't enough once more than one run can be going at a time. A direct
// `npx playwright test` invocation (bypassing that wrapper) has neither var set and falls back
// to this process's own single-run numbers, uncoordinated with anything else running.
const WORKERS = process.env.OPENISD_TEST_WORKERS ? Number(process.env.OPENISD_TEST_WORKERS) : computeWorkerCount();
const PORT = process.env.OPENISD_TEST_PORT || '4100';

// Specs that reach a third-party site. The default gate must depend on THIS repo only:
// combined with "A SKIP IS A FAIL" below, an outage at micka.de would otherwise turn
// `npx playwright test` and scripts/health-check.sh red for a cause outside the codebase.
// They stay fully runnable — `npm run test:crosscheck` sets OPENISD_EXTERNAL=1, and so can
// any ad-hoc run: `OPENISD_EXTERNAL=1 npx playwright test <path>`.
const EXTERNAL_NETWORK_SPECS = ['**/micka-crosscheck.browser.spec.ts'];

export default defineConfig({
  testDir: './packages/ui/test',
  testMatch: '**/*.browser.spec.ts',
  testIgnore: process.env.OPENISD_EXTERNAL === '1' ? [] : EXTERNAL_NETWORK_SPECS,
  timeout: 10000,
  expect: {
    timeout: 2000,
  },
  // A SKIP IS A FAIL — see scripts/test-reporters/no-skips-playwright.js.
  // The json reporter is what makes "is the suite faster?" answerable at all: `list` prints a
  // wall clock to a terminal that scrolls away, so every speed claim about this suite has so far
  // been unbacked. This persists per-test and per-run durations to build/pw-report.json on EVERY
  // run, so the next comparison reads two files instead of re-running a benchmark.
  // telemetry-reporter appends one json line per test event as the run goes, so a long run can
  // be analysed (and a dead run post-mortemed) without waiting for a summary that only exists
  // at the end. Cheap enough to leave on for every run; scripts/run-ui-telemetry.sh relies on
  // it being here rather than passing --reporter, which would drop the no-skips gate below.
  reporter: [['list'], ['json', { outputFile: 'build/pw-report.json' }], ['./scripts/telemetry-reporter.mjs'], ['./scripts/test-reporters/no-skips-playwright.js']],
  // A stray `test.only` must not silently narrow the suite either.
  forbidOnly: true,
  // Baselines use the bundled Inter font (see canvas.ts), which renders identically on
  // every OS — so drop the {platform} segment and keep one snapshot set for all platforms.
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',
  retries: 0,
  // STOP a collapsed run rather than let it manufacture a total. `reuseExistingServer` means a
  // vite that dies mid-run is never restarted, so every remaining test fails identically on
  // ERR_CONNECTION_REFUSED — once turning one server death into "210 failed", an hour spent
  // producing a number that measured nothing about the code.
  // bugs/BUG_20260909_the_playwright_vite_server_dies_mid_run_and_fakes_hundreds_of_failures.md
  //
  // Set well ABOVE any plausible real red so it never truncates a genuine result: the suite's
  // worst honest run to date was 161. This bites only when the run has stopped measuring the
  // code at all.
  maxFailures: 180,
  // Runs tests within a single file in parallel.
  fullyParallel: true,
  // Scale workers based on cores (up to 8) to speed up local runs, further capped by available
  // memory so the suite backs off instead of OOM-killing the WSL VM under memory pressure.
  workers: WORKERS,
  use: {
    actionTimeout: 2000,
    navigationTimeout: 5000,
    browserName: 'chromium',
    // `channel: 'chromium'` selects the full browser. WITHOUT it Playwright launches
    // `chrome-headless-shell`, and on this machine that binary is SIGKILLed (exit 137) the
    // moment it forks a renderer, under concurrent load. Reproduced with a single standalone
    // launch — no test runner, no server — while the full binary launched cleanly in the same
    // window; `--version` works on both, only the render path dies. The kill is external and
    // arrives ~26 ms after fork, before Playwright can attach. `free` reported 15 GB available
    // and /dev/shm empty at the time and `dmesg` showed no OOM record, but neither rules out a
    // kernel OOM kill: dmesg is restricted under WSL2 and the Windows-side memory budget is
    // not what `free` measures.
    channel: 'chromium',
    headless: true,
    baseURL: `http://localhost:${PORT}`,
    launchOptions: {
      args: ['--disable-gpu', '--disable-software-rasterizer', '--disable-dev-shm-usage', '--no-sandbox'],
    },
  },
  webServer: {
    // version-info.mjs stamps packages/ui/public/build-info.json, which this vite serves at
    // /build-info.json — the toolbar's version chip (toolbar-version browser spec) reads it.
    // PORT varies per run (see WORKERS/PORT above) so concurrent runs don't collide on 4100.
    // The suite's vite serves the small test catalogue (six reference devices, cut from the
    // tracked one by scripts/test-bundle.mjs — no corpus needed) and runs no file watcher.
    command: `bash scripts/kill-http.sh ${PORT} && node scripts/version-info.mjs && node scripts/test-bundle.mjs build/test-bundle && OPENISD_DRIVERS_BUNDLE_DIR=build/test-bundle OPENISD_TEST_SERVER=1 npx vite --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120000,
  },


});
