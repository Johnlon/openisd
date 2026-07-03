/**
 * External oracle tests — micka.de loudspeaker enclosure calculator.
 * https://www.micka.de/en/index.php#ideal
 *
 * These tests submit driver parameters to micka.de and assert that its computed
 * outputs match the expected values in test/scenarios.js. They serve as independent
 * validation that the expected values in scenarios.js are physically correct.
 *
 * ── When to run ──────────────────────────────────────────────────────────────
 * These tests hit an external site and are slow (~25s each). Run them when:
 *   - You add a new scenario to scenarios.js and need to verify the expected values
 *   - You change a formula and want to confirm the new expected values against an
 *     independent implementation
 *   - NOT in normal CI (the Resonate tests in app.browser.spec.js cover the same
 *     physics locally without network dependency)
 *
 * Run: npx playwright test test/micka-crosscheck.browser.spec.js
 *
 * ── Vented box NOT cross-checked here (documented discrepancy) ────────────────
 * For a 5 cm bore, 10 cm physical vent length:
 *   Resonate: Fb = 37.1 Hz  (Leff = L + 0.85·d, Beranek 1954)
 *   micka.de: Fb = 37.85 Hz (back-calculated: smaller end-correction, ~0.75·d)
 * This ~2% divergence is a known end-correction convention difference, not a bug.
 * See alignments.js tuningFromLength() for Resonate's documented choice.
 */

import { test, expect } from '@playwright/test';
import { SCENARIOS } from './scenarios.js';

const TEMP_C = 20; // air temperature — micka's default; matches Resonate's c = 343.68 m/s (20 °C)

for (const S of SCENARIOS) {
  if (!S.micka) continue;

  test(`micka.de: ${S.name}`, async ({ page }) => {
    await page.goto('https://www.micka.de/en/index.php#ideal');

    // Select "parameterinput" mode — allows manual T/S entry instead of a preset speaker
    await page.locator('select[name="chasis"]').selectOption('parameterinput');

    // Fill driver T/S — only fs, vas, qts, qtc are needed for the sealed formula
    await page.locator('input[name="fs"]').fill(String(S.driver.Fs));
    await page.locator('input[name="vas"]').fill(String(S.driver.Vas));
    await page.locator('input[name="qts"]').fill(String(S.driver.Qts));
    await page.locator('input[name="temp_luft"]').fill(String(TEMP_C));

    // Fill box-specific inputs
    if (S.box.type === 'sealed' && S.box.Qtc != null) {
      await page.locator('input[name="qtc"]').fill(String(S.box.Qtc));
    }

    // Submit — full page POST; Playwright waits for network idle before asserting
    await page.locator('input[type="submit"]').click();

    // Assert micka's computed outputs against scenario's expected values
    const table = page.locator('table.generouscolumns');
    if (S.micka?.Vb) await expect(table).toContainText(S.micka.Vb);
    if (S.micka?.fc) await expect(table).toContainText(S.micka.fc);
    if (S.micka?.Fb) await expect(table).toContainText(S.micka.Fb);
  });
}
