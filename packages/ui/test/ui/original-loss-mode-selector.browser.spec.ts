import {expect, openAProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('select#og-box-type').selectOption('sealed');
});

test('the Box tab has no loss model selector; it lives in the WinISD Compatibility panel only', async ({ page }) => {
  await expect(page.locator('select#lossmode')).toHaveCount(0);
});

test('the WinISD Compatibility loss model selector defaults to WinISD, unlabelled, with three options', async ({ page }) => {
  await page.locator('li', { hasText: /^Advanced$/ }).click();
  const sel = page.locator('select#adv-lossmode');
  await expect(sel).toBeVisible();
  await expect(sel).toHaveValue('winisd-lossy');
  await expect(sel.locator('option')).toHaveText(['WinISD lossy model', 'Lossless model', 'Conventional lossy model']);
  await expect(page.locator('.sim-options-box label', { hasText: 'Loss model' })).toHaveCount(0);
});

test('the WinISD Compatibility panel ends just below its last switch', async ({ page }) => {
  await page.locator('li', { hasText: /^Advanced$/ }).click();
  const panel = (await page.locator('.sim-options-box').boundingBox())!;
  const last = (await page.locator('[data-field-key="winisdVaModel"]').boundingBox())!;
  expect(panel.y + panel.height - (last.y + last.height)).toBeLessThanOrEqual(10);
});
