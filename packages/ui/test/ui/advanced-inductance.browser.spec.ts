import {expect, openAProject, test} from '../fixtures.js';

const inductance = (page: import('@playwright/test').Page) =>
  page.locator('[data-field-key="simVcInductance"] input');
const winisdCompatible = (page: import('@playwright/test').Page) =>
  page.locator('[data-field-key="winisdInductance"] input');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('li', { hasText: /^Advanced$/ }).click();
});

test('WinISD-compatible inductance is disabled until voice coil inductance is simulated', async ({ page }) => {
  await expect(inductance(page)).not.toBeChecked();
  await expect(winisdCompatible(page)).toBeDisabled();

  await inductance(page).check();
  await expect(winisdCompatible(page)).toBeEnabled();
  await expect(winisdCompatible(page)).not.toBeChecked();
});

test('checking WinISD-compatible inductance keeps voice coil inductance on', async ({ page }) => {
  await inductance(page).check();
  await winisdCompatible(page).check();
  await expect(winisdCompatible(page)).toBeChecked();
  await expect(inductance(page)).toBeChecked();

  await inductance(page).uncheck();
  await expect(winisdCompatible(page)).not.toBeChecked();
  await expect(winisdCompatible(page)).toBeDisabled();
});
