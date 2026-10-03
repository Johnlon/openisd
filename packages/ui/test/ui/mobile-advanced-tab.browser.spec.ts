/**
 * The mobile Advanced tab. The FIELD WIRING itself (env overrides, loss mode, WinISD-compat
 * switches) is proven once, in `packages/ui/test/hooks/OriginalShell-hooks.test.ts`'s
 * `createEnvironmentAir` suite and `AdvancedOptions-hooks.test.ts` — the same factory/hook this
 * tab calls. These specs prove the UI is correctly WIRED to that shared logic.
 *
 * Reached via the hamburger menu (like Project), not the bottom tab bar — same reasoning as
 * Project: a settings-style destination, not a primary content tab.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

function fieldRow(page: import('@playwright/test').Page, label: string) {
  return page.locator('.mob-field-row', { has: page.locator('.mob-field-label', { hasText: label }) });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-item', { hasText: 'Advanced' }).click();
});

test('shows the environment fields, calculated readouts, and WinISD-compat controls', async ({ page }) => {
  await expect(page.locator('.mob-panel-head', { hasText: 'Environment' })).toBeVisible();
  await expect(fieldRow(page, 'Temperature')).toBeVisible();
  await expect(fieldRow(page, 'Relative humidity')).toBeVisible();
  await expect(fieldRow(page, 'Air pressure')).toBeVisible();
  await expect(fieldRow(page, 'Sound velocity')).toBeVisible();
  await expect(fieldRow(page, 'Air density')).toBeVisible();

  await expect(page.getByText('Force flat response')).toBeVisible();

  await expect(page.locator('.mob-panel-head', { hasText: 'WinISD compatibility' })).toBeVisible();
  await expect(page.locator('#mob-adv-lossmode')).toBeVisible();
  await expect(page.getByText('WinISD air model')).toBeVisible();
  await expect(page.getByText('WinISD driver model')).toBeVisible();
  await expect(page.getByText('WinISD VA model')).toBeVisible();
});

test('editing the temperature writes through and clearing it falls back to the app default', async ({ page }) => {
  const tempInput = fieldRow(page, 'Temperature').locator('input');
  await tempInput.fill('300');
  await tempInput.blur();
  await expect(tempInput).toHaveValue(/300/);

  await page.locator('.mob-btn', { hasText: 'Reset to app levels' }).click();
  await expect(tempInput).not.toHaveValue(/300/);
});

test('toggling the "Force flat response" checkbox writes through to the project', async ({ page }) => {
  const checkbox = page.locator('label', { hasText: 'Force flat response' }).locator('input[type=checkbox]');
  const before = await checkbox.isChecked();
  await checkbox.click();
  await expect(checkbox).toBeChecked({ checked: !before });
});

test('the error switches carry the warning class under a "WinISD errors" heading; the air model does not', async ({ page }) => {
  const group = page.locator('.error-switch-group');
  await expect(group.locator('.error-switch-group-head')).toHaveText('WinISD errors');
  for (const key of ['winisdDriverModel', 'winisdVaModel', 'winisdAbcIntraPortVelocity']) {
    const label = group.locator(`label[data-field-key="${key}"]`);
    await expect(label, key).toHaveClass(/error-switch-marked/);
    await expect(label, key).toHaveAttribute('title', /^Reproduces a WinISD error\.\n/);
  }
  await expect(page.locator('.mob-checkbox-row', { hasText: 'WinISD air model' })).not.toHaveClass(/error-switch-marked/);
  await expect(group.locator('label[data-field-key="winisdAbcIntraPortVelocity"] input')).toBeDisabled();
});
