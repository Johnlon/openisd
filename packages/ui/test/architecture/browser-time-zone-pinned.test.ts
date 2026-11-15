import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

/**
 * A time the app shows is formatted in the browser's time zone, so a picture of one (a backup's "16 Oct 2026, 12:00") read
 * 13:00 on a machine in Europe/London and 12:00 in CI (UTC). The suite's browser has one time zone, whoever runs it
 * (John, 2026-11-15: the pictures must be the same on this machine as in CI).
 */
describe('the Playwright browser has a fixed time zone', () => {
  it('playwright.config.js sets use.timezoneId to UTC', () => {
    const config = readFileSync(new URL('../../../../playwright.config.js', import.meta.url), 'utf8');
    expect(config).toMatch(/timezoneId:\s*'UTC'/);
  });
});
