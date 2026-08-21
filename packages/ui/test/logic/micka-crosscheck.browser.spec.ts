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

import { test, expect } from '../fixtures.js';
import { SCENARIOS } from '../scenarios.js';

const TEMP_C = 20; // air temperature — micka's default; matches OpenISD's c = 343.68 m/s (20 °C)

/** The box inputs micka's form needs for this scenario, as `[input name, value]` pairs. Which
 *  ones those are is fixed by the scenario table, so it is decided here rather than in the
 *  test body — the run itself has nothing to choose. */
function boxFields(box: (typeof SCENARIOS)[number]['box']): Array<[string, string]> {
  if (box.type === 'sealed' && box.Qtc != null) return [['qtc', String(box.Qtc)]];
  // "Your own Box" (red curve) — arbitrary user-specified enclosure + vent dimensions
  if (box.type === 'vented' && box.Vb != null && box.ventD != null && box.ventL != null) {
    return [['vb2', String(box.Vb)], ['rd2', String(box.ventD)], ['lv2', String(box.ventL)]];
  }
  return [];
}

for (const S of SCENARIOS) {
  if (!S.micka) continue;

  const micka = S.micka;
  const box = boxFields(S.box);
  /** The expected output strings this scenario pins. */
  const expected = [micka.Vb, micka.fc, micka.Fb].filter((v): v is string => !!v);

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
    for (const [name, value] of box) await page.locator(`input[name="${name}"]`).fill(value);

    // Submit — full page POST; Playwright waits for network idle before asserting
    await page.locator('input[type="submit"]').click();

    // Assert micka's computed outputs against scenario's expected values
    const table = page.locator('table.generouscolumns');
    for (const text of expected) await expect(table).toContainText(text);
  });
}
