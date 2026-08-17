/**
 * The sealed-box Box tab exposes the Fsc-model loss-mode selector (Lossless / Conventional
 * Lossy / WinISD Lossy). The calculation reads state.lossMode (OriginalShell.vue's
 * sealedRes), so without a control the model would be pinned to the default.
 */
import { test, expect } from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('select#og-box-type').selectOption('sealed');
});

test('the Original skin Fsc-model selector defaults to WinISD Lossy with three options', async ({ page }) => {
  const sel = page.locator('select#lossmode');
  await expect(sel).toBeVisible();
  await expect(sel).toHaveValue('winisd-lossy');
  await expect(sel.locator('option')).toHaveText(['Lossless', 'Conventional Lossy', 'WinISD Lossy']);
});
