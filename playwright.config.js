import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  testMatch: '**/*.browser.spec.js',
  timeout: 30000,
  use: {
    browserName: 'chromium',
    headless: true,
    baseURL: 'http://localhost:5173',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
