/**
 * Which enclosure tab the mobile tab bar offers for each box type — the tab bar's label is the box
 * type's own name, and sealed has none. The Vented and Passive Radiator tabs' own contents are
 * `mobile-vented-tab` and `mobile-pr-tab`.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test.describe('MobileEnclosureTab', () => {
  test('a sealed box drops the enclosure destination from the tab bar', async ({ page }) => {
    await expect(page.locator('.mob-tab', { hasText: 'Vented' })).toBeVisible();
    await page.locator('#mob-box-type').selectOption('sealed');
    await expect(page.locator('.mob-tab', { hasText: 'Vented' })).toHaveCount(0);
  });

  // BUG_20260918_bandpass4-front-chamber-tuning-writes-vented-cell: on a 4th-order bandpass the
  // Ffc entry and the vent diameter belong to the FRONT chamber; they were written to the vented
  // box's cells, so the diameter re-read empty and the vent length never solved.
  test('a 4th-order bandpass keeps its front-chamber tuning and vent diameter, and solves the vent length', async ({ page }) => {
    await page.locator('.mob-tab', { hasText: 'Box' }).click();
    await page.locator('#mob-box-type').selectOption('bandpass4');
    await page.locator('.mob-tab', { hasText: '4th Order Bandpass' }).click();
    const diameter = mobileFieldRow(page, 'Vent diameter').locator('input');
    await diameter.fill('5');
    await diameter.blur();
    await expect(diameter).toHaveValue(/5/);
    const tuning = mobileFieldRow(page, 'Target Tuning Freq (Ffc)').locator('input');
    await tuning.fill('47.8');
    await tuning.blur();
    await expect(tuning).toHaveValue(/47\.8/);
    await expect(mobileFieldRow(page, 'Vent length').locator('input')).toHaveValue(/\d/);
  });

  // bugs/BUG_20261005_no-common-ui-field-component.md: an emptied vent dimension clears, never stores 0.
  test('an emptied vent diameter stays blank instead of becoming 0', async ({ page }) => {
    await page.locator('.mob-tab', { hasText: 'Vented' }).click();
    const diameter = page.locator('.ui-field', { hasText: 'Vent diameter' }).locator('input');
    await diameter.fill('');
    await diameter.blur();
    await expect(diameter).toHaveValue('');
  });
});
