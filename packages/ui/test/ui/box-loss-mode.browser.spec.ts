/**
 * The Box tab offers a sealed-box loss-mode selector (Lossless / Conventional Lossy / WinISD
 * Lossy) defaulting to WinISD Lossy; switching it recomputes the Fsc readout in the stat bar.
 */
import { test, expect } from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Loss mode applies to the sealed box; the selector is sealed-only.
  await page.locator('select#boxtype').selectOption('sealed');
});

test('the Fsc-model selector defaults to WinISD Lossy with three options', async ({ page }) => {
  const sel = page.locator('select#lossmode');
  await expect(sel).toBeVisible();
  await expect(sel).toHaveValue('winisd-lossy');
  await expect(sel.locator('option')).toHaveText(['Lossless', 'Conventional Lossy', 'WinISD Lossy']);
});

test('switching WinISD Lossy → Lossless lowers the reported Fsc', async ({ page }) => {
  // Stat bar shows "fc: <n> Hz". With the default leakage (Ql=10) the WinISD pole sits ABOVE
  // the lossless value, so switching to Lossless must drop the number.
  const fcText = async () => (await page.locator('#stat').innerText()).match(/fc:\s*([\d.]+)/)?.[1];

  await page.locator('select#lossmode').selectOption('winisd-lossy');
  const winisd = Number(await fcText());

  await page.locator('select#lossmode').selectOption('lossless');
  const lossless = Number(await fcText());

  expect(winisd).toBeGreaterThan(0);
  expect(lossless).toBeGreaterThan(0);
  expect(lossless).toBeLessThan(winisd);
});
