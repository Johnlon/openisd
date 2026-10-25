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

  test('passive-radiator chooser uses the short Select PR label', async ({ appPage: page }) => {
    await page.locator('.mob-tab', { hasText: 'Box' }).click();
    await page.locator('#mob-box-type').selectOption('box-passive-radiator');
    await expect(page.getByRole('button', { name: 'Select PR', exact: true })).toBeVisible();
  });

  test('End Correction matches the other enclosure selects in every box type with vents', async ({ appPage: page }) => {
    await page.locator('.mob-tab', { hasText: 'Box' }).click();
    const boxTypes = [
      { type: 'sealed', ventCount: 0 },
      { type: 'vented', ventCount: 1 },
      { type: 'box-passive-radiator', ventCount: 0 },
      { type: 'bandpass4', ventCount: 1 },
      { type: 'bandpass6', ventCount: 2 },
      { type: 'abc', ventCount: 3 },
    ];
    for (const { type: boxType, ventCount } of boxTypes) {
      await page.locator('#mob-box-type').selectOption(boxType);
      const rows = page.locator('.mob-crow').filter({
        has: page.locator('.mob-crow-label', { hasText: /^End Correction$/ }),
      });
      await expect(rows).toHaveCount(ventCount);
      for (const row of await rows.all()) {
        const section = row.locator('xpath=..');
        const endCorrection = row.locator('select');
        const shape = section.locator('.mob-crow', {
          has: page.locator('.mob-crow-label', { hasText: /^Shape$/ }),
        }).locator('select');
        const [endWidth, shapeWidth] = await Promise.all([
          endCorrection.evaluate(el => el.getBoundingClientRect().width),
          shape.evaluate(el => el.getBoundingClientRect().width),
        ]);
        expect(Math.abs(endWidth - shapeWidth), `${boxType} End Correction width`).toBeLessThanOrEqual(0.5);
      }
    }
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
