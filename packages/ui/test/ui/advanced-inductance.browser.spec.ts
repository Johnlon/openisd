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

test('WinISD-compatible inductance sits in the WinISD Compatibility panel', async ({ page }) => {
  const panel = page.locator('.sim-options-box', { hasText: 'WinISD Compatibility' });
  await expect(panel.locator('[data-field-key="winisdInductance"] input')).toBeVisible();
});

test('WinISD Compatibility labels are unclipped and drop the "Use" prefix', async ({ page }) => {
  const panel = page.locator('.sim-options-box', { hasText: 'WinISD Compatibility' });
  const labels = panel.locator('label[data-field-key]');
  await expect(labels).toHaveText(['WinISD driver calculations', 'WinISD air model', 'WinISD inductance model']);
  const panelBox = (await panel.boundingBox())!;
  const clipRight = await panel.evaluate(el => {
    // The visible right edge: the panel's own, or an ancestor's that clips it first.
    let right = el.getBoundingClientRect().right;
    for (let a = el.parentElement; a; a = a.parentElement) {
      if (getComputedStyle(a).overflowX !== 'visible') right = Math.min(right, a.getBoundingClientRect().right);
    }
    return right;
  });
  for (const label of await labels.all()) {
    const textRight = await label.evaluate(el => {
      const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().right;
    });
    expect(textRight, await label.innerText()).toBeLessThanOrEqual(Math.min(panelBox.x + panelBox.width, clipRight));
  }
});
