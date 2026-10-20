/**
 * The Box page's vent sections and the five-tab bar: there is no enclosure tab, and a sealed box has
 * no Vents section. The vent and passive radiator sections' own contents are `mobile-vented-tab` and
 * `mobile-pr-tab`.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ appPage: page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test.describe('MobileEnclosureTab', () => {
  test('the tab bar has five tabs whatever the box; a sealed box has no Vents section on the Box page', async ({ appPage: page }) => {
    await expect(page.locator('.mob-tab')).toHaveText(['Box', 'Driver', 'Signal', 'Filters', 'Graph']);
    await expect(page.locator('.mob-band-title', { hasText: /^Vents$/ })).toHaveCount(1);
    await page.locator('#mob-box-type').selectOption('sealed');
    await expect(page.locator('.mob-tab')).toHaveText(['Box', 'Driver', 'Signal', 'Filters', 'Graph']);
    await expect(page.locator('.mob-band-title', { hasText: /^Vents$/ })).toHaveCount(0);
  });

  // BUG_20260918_bandpass4-front-chamber-tuning-writes-vented-cell: on a 4th-order bandpass the
  // Ffc entry and the vent diameter belong to the FRONT chamber; they were written to the vented
  // box's cells, so the diameter re-read empty and the vent length never solved.
  test('a 4th-order bandpass keeps its front-chamber tuning and vent diameter, and solves the vent length', async ({ appPage: page }) => {
    await page.locator('.mob-tab', { hasText: 'Box' }).click();
    await page.locator('#mob-box-type').selectOption('bandpass4');
    const diameter = mobileFieldRow(page, 'Vent diameter').locator('input');
    await diameter.fill('5');
    await diameter.blur();
    await expect(diameter).toHaveValue(/5/);
    const tuning = mobileFieldRow(page, 'Ffc').locator('input');
    await tuning.fill('47.8');
    await tuning.blur();
    await expect(tuning).toHaveValue(/47\.8/);
    await expect(mobileFieldRow(page, 'Vent length').locator('input')).toHaveValue(/\d/);
  });

  // bugs/BUG_20261005_no-common-ui-field-component.md: an emptied vent dimension clears, never
  // stores 0. A cleared diameter settles to the 50 mm starting port (John, 2026-10-09).
  test('an emptied vent diameter settles to the starting port instead of becoming 0', async ({ appPage: page }) => {
    const diameter = page.locator('.ui-field', { hasText: 'Vent diameter' }).locator('input');
    await diameter.fill('');
    await diameter.blur();
    await expect(diameter).toHaveValue(/^5(\.0+)?$/);
  });
});
