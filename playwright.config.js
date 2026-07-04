import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './packages/ui/test',
  testMatch: '**/*.browser.spec.ts',
  timeout: 30000,
  // Baselines use the bundled Inter font (see canvas.ts), which renders identically on
  // every OS — so drop the {platform} segment and keep one snapshot set for all platforms.
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',
  use: {
    browserName: 'chromium',
    headless: true,
    baseURL: 'http://localhost:4100',
  },
  webServer: {
    command: 'npm run dev -- --port 4100',
    url: 'http://localhost:4100',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
