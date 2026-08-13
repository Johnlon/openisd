/**
 * The Original skin's sealed-box Box tab must expose the same Fsc-model loss-mode selector
 * (Lossless / Conventional Lossy / WinISD Lossy) the Classic skin already has — the underlying
 * calculation already reads state.lossMode (OriginalShell.vue's sealedRes), but until now
 * nothing rendered a control to change it, so it was silently pinned to the default.
 */
import { test, expect } from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('original');
  await page.locator('select#og-box-type').selectOption('sealed');
});

test('the Original skin Fsc-model selector defaults to WinISD Lossy with three options', async ({ page }) => {
  const sel = page.locator('select#lossmode');
  await expect(sel).toBeVisible();
  await expect(sel).toHaveValue('winisd-lossy');
  await expect(sel.locator('option')).toHaveText(['Lossless', 'Conventional Lossy', 'WinISD Lossy']);
});
