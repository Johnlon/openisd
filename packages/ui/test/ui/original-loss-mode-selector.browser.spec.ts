import { test, expect, openAProject } from '../fixtures.js';
import type { Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('select#og-box-type').selectOption('sealed');
});

test('the Original skin Fsc-model selector defaults to WinISD Lossy with three options', async ({ page }) => {
  const sel = page.locator('select#lossmode');
  await expect(sel).toBeVisible();
  await expect(sel).toHaveValue('winisd-lossy');
  await expect(sel.locator('option')).toHaveText(['Lossless', 'Conventional Lossy', 'WinISD Lossy']);
});
