import { defineConfig } from '@playwright/test';
import base from '../playwright.config.js';

// Tracked (unlike build/tmp/, which is git-ignored scratch) — this config is load-bearing for
// running probe specs under build/tmp/ and must not be silently overwritten or lost.
const { webServer: _unused, reporter: _unused2, testDir: _unused3, ...rest } = base;

export default defineConfig({
  ...rest,
  testDir: '../build/tmp',
  reporter: [['list']],
  webServer: { ...base.webServer, command: `cd .. && ${base.webServer.command}` },
});
