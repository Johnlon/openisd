import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './packages/ui/test',
  testMatch: '**/*.browser.spec.ts',
  testIgnore: '**/micka-crosscheck.browser.spec.ts',
  timeout: 30000,
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
