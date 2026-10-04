/**
 * The mobile "Choose alignment" sheet, opened from the Box tab: pick an alignment, Accept writes it
 * to the box, Cancel discards the draft.
 */
import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test.describe('MobileAlignmentPopup', () => {
  test('the sealed sheet picks an alignment and writes its volume on Accept', async ({ page }) => {
    await page.locator('#mob-box-type').selectOption('sealed');
    await expect(page.locator('.mob-btn', { hasText: 'Choose alignment' })).toBeVisible();

    await page.locator('.mob-btn', { hasText: 'Choose alignment' }).click();
    await expect(page.locator('.mob-align-sheet')).toBeVisible();

    const volumeInput = page.locator('.mob-align-sheet .mob-field-value input');
    await volumeInput.fill('20');
    await expect(page.locator('.mob-align-readout')).toContainText('EBP');

    await page.locator('.mob-align-footer .mob-btn-primary', { hasText: 'Accept' }).click();
    await expect(page.locator('.mob-align-sheet')).toHaveCount(0);

    const volumeField = page.locator('.mob-field-row.mob-field-entered .mob-field-value input').first();
    await expect(volumeField).toHaveValue(/20/);
  });

  test('the vented sheet picks an alignment and writes volume + tuning on Accept', async ({ page }) => {
    // The default sample project has no T/S params, so ventedDesign() has nothing to compute from
    // (recalculate() would silently no-op) — needs COMPLETE_DRIVER_PROJECT_OWPR's real Fs/Qes/Vas.
    await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    await page.locator('#mob-box-type').selectOption('vented');
    await expect(page.locator('.mob-btn', { hasText: 'Choose alignment' })).toBeVisible();

    await page.locator('.mob-btn', { hasText: 'Choose alignment' }).click();
    await expect(page.locator('.mob-align-sheet')).toBeVisible();

    // Vented has no volume/tuning reverse lookup (VentedEngine has no closestAlignment), so the
    // sheet's Volume + Tuning freq are read-only readouts driven by the alignment <select>, unlike
    // sealed's directly-editable field.
    await page.locator('.mob-align-sheet .mob-select').selectOption('bb4');
    await expect(page.locator('.mob-align-sheet .mob-field-label', { hasText: 'Tuning freq' })).toBeVisible();
    await expect(page.locator('.mob-align-readout')).toContainText('EBP');

    await page.locator('.mob-align-footer .mob-btn-primary', { hasText: 'Accept' }).click();
    await expect(page.locator('.mob-align-sheet')).toHaveCount(0);

    const volumeField = page.locator('.mob-field-row.mob-field-entered .mob-field-value input').first();
    await expect(volumeField).not.toHaveValue('0.00');
    await expect(volumeField).not.toHaveValue('');
  });

  test('Cancel discards the sheet\'s draft without touching the volume field', async ({ page }) => {
    await page.locator('#mob-box-type').selectOption('sealed');
    const volumeField = page.locator('.mob-field-row.mob-field-entered .mob-field-value input').first();
    await volumeField.fill('15');
    await volumeField.blur();

    await page.locator('.mob-btn', { hasText: 'Choose alignment' }).click();
    const sheetVolume = page.locator('.mob-align-sheet .mob-field-value input');
    await sheetVolume.fill('99');
    await page.locator('.mob-align-footer .mob-btn', { hasText: 'Cancel' }).click();

    await expect(page.locator('.mob-align-sheet')).toHaveCount(0);
    await expect(volumeField).toHaveValue(/15/);
  });
});
