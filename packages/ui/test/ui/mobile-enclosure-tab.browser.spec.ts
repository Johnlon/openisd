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
