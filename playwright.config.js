import { defineConfig } from '@playwright/test';
import os from 'os';

export default defineConfig({
  testDir: './packages/ui/test',
  testMatch: '**/*.browser.spec.ts',
  timeout: 60000,
  // A SKIP IS A FAIL — see scripts/test-reporters/no-skips-playwright.js.
  reporter: [['list'], ['./scripts/test-reporters/no-skips-playwright.js']],
  // A stray `test.only` must not silently narrow the suite either.
  forbidOnly: true,
  // Baselines use the bundled Inter font (see canvas.ts), which renders identically on
  // every OS — so drop the {platform} segment and keep one snapshot set for all platforms.
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',
  // A launch that dies is not a failing test, and reporting it as one has cost whole sessions
  // here: every such run showed a transport or launch error and ZERO assertion mismatches.
  // One retry absorbs it; a test that genuinely fails still fails on the retry.
  retries: 1,
  // Runs tests within a single file in parallel.
  fullyParallel: true,
  // Scale workers based on cores (up to 8) to speed up local runs, but capped to avoid renderer death under heavy WSL load.
  workers: Math.min(8, Math.ceil(os.cpus().length / 2)),
  use: {
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
    baseURL: 'http://localhost:4100',
    launchOptions: {
      args: ['--disable-gpu', '--disable-software-rasterizer', '--disable-dev-shm-usage', '--no-sandbox'],
    },
  },
  webServer: {
    command: 'bash scripts/kill-http.sh 4100 && npx vite --port 4100',
    url: 'http://localhost:4100',
    reuseExistingServer: true,
    timeout: 120000,
  },


});
