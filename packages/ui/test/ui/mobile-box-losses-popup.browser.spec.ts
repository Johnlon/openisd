/**
 * The mobile "Box losses" sheet, opened from the Box tab: Ql and Qa always, Qp only for a vented box.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test.describe('MobileBoxLossesPopup', () => {
  test('edits Ql/Qa, and Qp only for a vented box', async ({ page }) => {
    await expect(page.locator('.mob-field-label', { hasText: 'Port Qp' })).toHaveCount(0);
    await page.locator('.mob-btn', { hasText: 'Box losses' }).click();
    await expect(page.locator('.mob-field-label', { hasText: 'Leakage Ql' })).toBeVisible();
    await expect(page.locator('.mob-field-label', { hasText: 'Absorption Qa' })).toBeVisible();
    await expect(page.locator('.mob-field-label', { hasText: 'Port Qp' })).toBeVisible();

    const qlInput = page.locator('.mob-field-row', { has: page.locator('.mob-field-label', { hasText: 'Leakage Ql' }) }).locator('input');
    await qlInput.fill('12');
    await qlInput.blur();
    await expect(qlInput).toHaveValue(/12/);

    await page.locator('.mob-align-footer .mob-btn', { hasText: 'OK' }).click();
    await expect(page.locator('.mob-align-sheet')).toHaveCount(0);

    await page.locator('#mob-box-type').selectOption('sealed');
    await page.locator('.mob-btn', { hasText: 'Box losses' }).click();
    await expect(page.locator('.mob-field-label', { hasText: 'Port Qp' })).toHaveCount(0);
  });

  test('Reset puts Ql, Qa and Qp back to WinISD\'s defaults', async ({ page }) => {
    await page.locator('.mob-btn', { hasText: 'Box losses' }).click();
    const q = (label: string) => page.locator('.mob-field-row', { has: page.locator('.mob-field-label', { hasText: label }) }).locator('input');
    await q('Leakage Ql').fill('7'); await q('Leakage Ql').blur();
    await q('Absorption Qa').fill('20'); await q('Absorption Qa').blur();
    await page.locator('#mob-box-losses-reset').click();
    await expect(q('Leakage Ql')).toHaveValue(/^10(\.0+)?$/);
    await expect(q('Absorption Qa')).toHaveValue(/^100(\.0+)?$/);
    await expect(q('Port Qp')).toHaveValue(/^100(\.0+)?$/);
  });
});
