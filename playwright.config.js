import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './packages/ui/test',
  testMatch: '**/*.browser.spec.js',
  timeout: 30000,
  use: {
    browserName: 'chromium',
    headless: true,
    baseURL: 'http://localhost:4000',
  },
  webServer: {
    command: 'npm run dev -- --port 4000',
    url: 'http://localhost:4000',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
