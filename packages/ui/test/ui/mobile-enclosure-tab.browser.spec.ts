/**
 * The mobile Enclosure tab. The FIELD WIRING itself (the vent-group Helmholtz relation, PR
 * readouts) is proven once, in `packages/ui/test/hooks/OriginalShell-hooks.test.ts`'s
 * `createVentReadouts`/`createSealedReadouts`/`createPassiveRadiatorActions` suites and the
 * domain's own tests — the same factories this tab calls. These specs prove the UI is correctly
 * WIRED to that shared logic, not that the logic itself is correct.
 *
 * The sample fixture (`SAMPLE_PROJECT_OWPR`) opens as a VENTED box, which is what puts the
 * Enclosure tab in the bar to begin with (sealed has none — mirrors desktop's own gate).
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

function fieldRow(page: import('@playwright/test').Page, label: string) {
  return page.locator('.mob-field-row', { has: page.locator('.mob-field-label', { hasText: label }) });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await openAMobileProject(page);
});

test('a vented project shows the Enclosure tab with vent config and readouts', async ({ page }) => {
  // The tab bar's label is the box type's own name ("Vented" — enclosureNavLabel falls back to
  // boxLabel for anything that isn't sealed/PR); the panel's own section header inside says
  // "Vents", a different string.
  await page.locator('.mob-tab', { hasText: 'Vented' }).click();
  await expect(page.locator('.mob-panel-head').first()).toHaveText('Vents');
  await expect(page.getByText('Number of Vents')).toBeVisible();
  await expect(page.getByText('Shape')).toBeVisible();
  await expect(fieldRow(page, 'Vent diameter')).toBeVisible();
  await expect(fieldRow(page, '1st port resonance')).toBeVisible();
});

test('editing the vent diameter writes through to the field', async ({ page }) => {
  await page.locator('.mob-tab', { hasText: 'Vented' }).click();
  const diameterInput = fieldRow(page, 'Vent diameter').locator('input');
  await diameterInput.fill('6');
  await diameterInput.blur();
  await expect(diameterInput).toHaveValue(/6/);
});

// Bug (John, live on his phone, 2026-10-01): clearing an entered Target Tuning Freq left both
// it and Vent length stuck as read-only blanks — the template only ever rendered an input for
// the 'E' state, so once a clear drove both to 'N' there was no way back in without reloading
// the project. Mirrors the desktop repro in original-tuning-target.browser.spec.ts.
//
// John's own follow-up ("clear ... should probably default to ... an alignment") is the actual
// fix where the driver resolves: `clearVentField` now calls `Box.resetVentedAlignment()`, so
// the pair comes back alive with a real QB3 design rather than merely blank-but-typeable.
test('clearing Target Tuning Freq re-derives a QB3 design, not a dead blank', async ({ page }) => {
  await page.locator('.mob-tab', { hasText: 'Vented' }).click();
  const fbInput = fieldRow(page, 'Target Tuning Freq').locator('input');
  await fbInput.fill('40');
  await fbInput.blur();
  await expect(fbInput).toHaveValue(/40/);

  await fbInput.fill('');
  await fbInput.blur();
  // Still a live input, not a dead readonly span (the regression made this locator find
  // nothing) — AND non-empty: the default alignment re-derived a real tuning, not a dead blank.
  const fbAfterClear = fieldRow(page, 'Target Tuning Freq').locator('input');
  await expect(fbAfterClear).toBeVisible();
  const fb = Number(await fbAfterClear.inputValue());
  expect(fb).toBeGreaterThan(0);
  expect(fb, 'a different design, not the stale 40 surviving the clear').not.toBeCloseTo(40, 1);

  // Vent length is the pair's now-calculated side — a real length, not the '—' impossible mark.
  await expect(fieldRow(page, 'Vent length').locator('.mob-readonly')).not.toHaveText('—');
});

test('a sealed box drops the Enclosure destination from the tab bar', async ({ page }) => {
  await expect(page.locator('.mob-tab', { hasText: 'Vented' })).toBeVisible();
  await page.locator('#mob-box-type').selectOption('sealed');
  await expect(page.locator('.mob-tab', { hasText: 'Vented' })).toHaveCount(0);
});

test('switching to a passive-radiator box shows PR fields and Select PR opens the browser', async ({ page }) => {
  await page.locator('#mob-box-type').selectOption('box-passive-radiator');
  await page.locator('.mob-tab', { hasText: 'Passive Radiator' }).click();
  await expect(page.locator('.mob-panel-head').first()).toHaveText('Passive radiator');
  await expect(fieldRow(page, 'Vas')).toBeVisible();
  await expect(fieldRow(page, 'Fpr (with added mass)')).toBeVisible();

  await page.getByText('Select PR', { exact: true }).click();
  await expect(page.getByText('Passive radiator library')).toBeVisible();
  await page.locator('.modal .x').click();
  await expect(page.getByText('Passive radiator library')).toHaveCount(0);
});

// John, 2026-10-01: the port velocity limit sits on the vent section in both layouts.
test('the port velocity limit shows 17 m/s and takes an edit', async ({ page }) => {
  await page.locator('.mob-tab', { hasText: 'Vented' }).click();
  const input = page.locator('#mob-vent-velocity-limit');
  await expect(input).toHaveValue(/^17(\.0+)?$/);
  await input.fill('25');
  await input.blur();
  await expect(input).toHaveValue(/^25(\.0+)?$/);
});
