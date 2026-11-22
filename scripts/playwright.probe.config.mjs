import { defineConfig } from '@playwright/test';
import base from '../playwright.config.js';

// Tracked (unlike build/tmp/, which is git-ignored scratch) — this config is load-bearing for
// running probe specs under build/tmp/ and must not be silently overwritten or lost.
const rest = { ...base };
delete rest.webServer;
delete rest.reporter;
delete rest.testDir;

export default defineConfig({
  ...rest,
  testDir: '../build/tmp',
  // Probes may be named zz-foo.spec.ts or zz-foo.browser.spec.ts (the base config matches only the latter).
  testMatch: ['**/*.spec.ts', '**/*.browser.spec.ts'],
  reporter: [['list']],
  webServer: { ...base.webServer, command: `cd .. && ${base.webServer.command}` },
});
