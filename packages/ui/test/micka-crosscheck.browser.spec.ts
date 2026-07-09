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
 *   - NOT in normal CI (the OpenISD tests in app.browser.spec.js cover the same
 *     physics locally without network dependency)
 *
 * Run: npx playwright test test/micka-crosscheck.browser.spec.js
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SCENARIOS } from './scenarios.js';
import type { Scenario } from './scenarios.js';

const TEMP_C = 20; // air temperature — micka's default; matches OpenISD's c = 343.68 m/s (20 °C)

// Which micka.de inputs apply depends on the scenario's box type — this is
// per-scenario setup, not a runtime test-assertion branch, so it lives in its
// own function rather than directly in the test body.
async function fillBoxInputs(page: Page, box: Scenario['box']) {
  if (box.type === 'sealed' && box.Qtc != null) {
    await page.locator('input[name="qtc"]').fill(String(box.Qtc));
  } else if (box.type === 'vented' && box.Vb != null && box.ventD != null && box.ventL != null) {
    // "Your own Box" (red curve) — arbitrary user-specified enclosure + vent dimensions
    await page.locator('input[name="vb2"]').fill(String(box.Vb));
    await page.locator('input[name="rd2"]').fill(String(box.ventD));
    await page.locator('input[name="lv2"]').fill(String(box.ventL));
  }
}

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

    await fillBoxInputs(page, S.box);

    // Submit — full page POST; Playwright waits for network idle before asserting
    await page.locator('input[type="submit"]').click();

    // Assert micka's computed outputs against scenario's expected values —
    // which fields apply (Vb/fc/Fb) is data-driven per scenario, so this
    // asserts whatever S.micka actually specifies. The length check guards
    // against a scenario whose `micka` object is present but empty silently
    // "passing" by asserting nothing at all.
    const table = page.locator('table.generouscolumns');
    const fields = Object.entries(S.micka!);
    expect(fields.length).toBeGreaterThan(0);
    for (const [, value] of fields) {
      await expect(table).toContainText(value);
    }
  });
}
