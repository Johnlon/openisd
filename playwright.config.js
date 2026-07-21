import { defineConfig } from '@playwright/test';

// Per-run stamp for the durable JSON report below. playwright WIPES test-results/ at the
// start of the next run, so a failure's assertion values survive ONLY in a per-run file
// outside it (winisd_tools BUGS.md 2026-07-21 observability entry: the 2026-07-20
// original-skin flake's assertion diff was unrecoverable after the passing rerun).
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-');

export default defineConfig({
  testDir: './packages/ui/test',
  testMatch: '**/*.browser.spec.ts',
  timeout: 30000,
  // Baselines use the bundled Inter font (see canvas.ts), which renders identically on
  // every OS — so drop the {platform} segment and keep one snapshot set for all platforms.
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',
  // stdout list as before, PLUS the durable per-run report (git-ignored test-logs/).
  reporter: [['list'], ['json', { outputFile: `test-logs/playwright-${RUN_STAMP}.json` }]],
  use: {
    browserName: 'chromium',
    headless: true,
    baseURL: 'http://localhost:4100',
    // Keep the trace of every FAILED test for post-mortem (cleared with test-results/ on
    // the next run — the JSON report above is the long-lived record).
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'bash scripts/kill-http.sh 4100 && npm run dev -- --port 4100',
    url: 'http://localhost:4100',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
