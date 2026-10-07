/**
 * The mobile "Box losses" sheet, opened from the Box tab: Ql and Qa always, Qp only for a vented box.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test.describe('MobileBoxLossesPopup', () => {
  test('edits Ql/Qa, and Qp only for a vented box', async ({ page }) => {
    await expect(page.locator('.ui-field-label', { hasText: 'Port Qp' })).toHaveCount(0);
    await page.locator('.mob-btn', { hasText: 'Box losses' }).click();
    await expect(page.locator('.ui-field-label', { hasText: 'Leakage Ql' })).toBeVisible();
    await expect(page.locator('.ui-field-label', { hasText: 'Absorption Qa' })).toBeVisible();
    await expect(page.locator('.ui-field-label', { hasText: 'Port Qp' })).toBeVisible();

    const qlInput = page.locator('.mob-ui-field', { hasText: 'Leakage Ql' }).locator('input');
    await qlInput.fill('12');
    await qlInput.blur();
    await expect(qlInput).toHaveValue(/12/);

    await page.locator('.mob-align-footer .mob-btn', { hasText: 'OK' }).click();
    await expect(page.locator('.mob-align-sheet')).toHaveCount(0);

    await page.locator('#mob-box-type').selectOption('sealed');
    await page.locator('.mob-btn', { hasText: 'Box losses' }).click();
    await expect(page.locator('.ui-field-label', { hasText: 'Port Qp' })).toHaveCount(0);
  });

  test('Reset puts Ql, Qa and Qp back to WinISD\'s defaults', async ({ page }) => {
    await page.locator('.mob-btn', { hasText: 'Box losses' }).click();
    const q = (label: string) => page.locator('.mob-ui-field', { hasText: label }).locator('input');
    await q('Leakage Ql').fill('7'); await q('Leakage Ql').blur();
    await q('Absorption Qa').fill('20'); await q('Absorption Qa').blur();
    await page.locator('#mob-box-losses-reset').click();
    await expect(q('Leakage Ql')).toHaveValue(/^10(\.0+)?$/);
    await expect(q('Absorption Qa')).toHaveValue(/^100(\.0+)?$/);
    await expect(q('Port Qp')).toHaveValue(/^100(\.0+)?$/);
  });

  // bugs/BUG_20261007_advanced-link-opens-every-chamber-losses.md: a two-chamber box has one
  // "Box losses" button per chamber panel, each opening that chamber's set only.
  for (const [type, rearPorts] of [['bandpass4', 0], ['bandpass6', 1], ['abc', 1]] as const) {
    const openFor = async (page: Page, chamber: 'Rear' | 'Front') => {
      await page.locator('.mob-panel', { has: page.locator('.mob-panel-head', { hasText: `${chamber} chamber` }) })
        .locator('.mob-btn', { hasText: 'Box losses' }).click();
      return page.locator('.mob-align-sheet');
    };
    test(`${type}: each chamber panel's button opens only that chamber's set`, async ({ page }) => {
      await page.locator('#mob-box-type').selectOption(type);
      const rear = await openFor(page, 'Rear');
      await expect(rear.locator('.mob-panel-head', { hasText: 'chamber' })).toHaveText(['Rear chamber']);
      await expect(rear.locator('.ui-field-label', { hasText: 'Port Qp' })).toHaveCount(rearPorts);
      await expect(rear.locator('.ui-field-label', { hasText: 'Interchamber Qicl' })).toHaveCount(1);
      await rear.locator('.mob-align-footer .mob-btn', { hasText: 'OK' }).click();
      const front = await openFor(page, 'Front');
      await expect(front.locator('.mob-panel-head', { hasText: 'chamber' })).toHaveText(['Front chamber']);
      await expect(front.locator('.ui-field-label', { hasText: 'Port Qp' })).toHaveCount(1);
    });
    test(`${type}: Reset puts only the open chamber back; the Qicl is one value for both`, async ({ page }) => {
      await page.locator('#mob-box-type').selectOption(type);
      const q = (sheet: Locator, label: string) =>
        sheet.locator('.mob-ui-field', { hasText: label }).locator('input');
      let sheet = await openFor(page, 'Front');
      await q(sheet, 'Leakage Ql').fill('7'); await q(sheet, 'Leakage Ql').blur();
      await q(sheet, 'Interchamber Qicl').fill('42'); await q(sheet, 'Interchamber Qicl').blur();
      await sheet.locator('.mob-align-footer .mob-btn', { hasText: 'OK' }).click();
      sheet = await openFor(page, 'Rear');
      await expect(q(sheet, 'Leakage Ql')).toHaveValue(/^10(\.0+)?$/);
      await expect(q(sheet, 'Interchamber Qicl')).toHaveValue(/^42(\.0+)?$/);
      await q(sheet, 'Leakage Ql').fill('8'); await q(sheet, 'Leakage Ql').blur();
      await page.locator('#mob-box-losses-reset').click();
      await expect(q(sheet, 'Leakage Ql')).toHaveValue(/^10(\.0+)?$/);
      await sheet.locator('.mob-align-footer .mob-btn', { hasText: 'OK' }).click();
      sheet = await openFor(page, 'Front');
      await expect(q(sheet, 'Leakage Ql')).toHaveValue(/^7(\.0+)?$/);
    });
  }
});
