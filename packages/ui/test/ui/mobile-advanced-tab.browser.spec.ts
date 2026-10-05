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
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

function fieldRow(page: import('@playwright/test').Page, label: string) {
  return page.locator('.mob-field-row', { has: page.locator('.mob-field-label', { hasText: label }) });
}

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
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
  await expect(page.locator('#mob-adv-lossmode')).toHaveCount(0);
  await expect(page.getByText('WinISD air model')).toHaveCount(0);
  await expect(page.getByText('Two-BL driver')).toBeVisible();
  await expect(page.getByText('Re without Rg')).toBeVisible();
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

test('the bug switches carry the warning class under a "Enable WinISD bugs" heading', async ({ page }) => {
  const group = page.locator('.error-switch-group');
  await expect(group.locator('.error-switch-group-head')).toHaveText('Enable WinISD bugs');
  for (const key of ['winisdDriverModel', 'winisdVaModel', 'winisdPrNprResonance', 'winisdBesselHighpass', 'winisdAbcGroupDelay', 'winisdDriverCountModel']) {
    const label = group.locator(`label[data-field-key="${key}"]`);
    await expect(label, key).toHaveClass(/error-switch-marked/);
    await expect(label, key).toHaveAttribute('title', /^Reproduces a WinISD bug\.\n/);
  }
  await expect(group.locator('label[data-field-key="winisdAbcIntraPortVelocity"]')).toHaveCount(0);
  await expect(page.locator('label[data-field-key="winisdAbcIntraPortVelocity"] input')).toBeDisabled();
  await expect(group.locator('label[data-field-key="winisdPrNprResonance"] input')).toBeDisabled();
  await expect(group.locator('label[data-field-key="winisdDriverCountModel"] input')).toBeDisabled();
});

test('the "Enable WinISD-style" group has every WinISD option the desktop has, and each one writes through', async ({ page }) => {
  const panel = page.locator('.mob-panel', { hasText: 'WinISD compatibility' });
  await expect(panel.locator('.mob-group-head').first()).toHaveText('Enable WinISD-style …');
  for (const key of ['winisdWrapPhase', 'winisdFlatModel']) {
    const checkbox = panel.locator(`label[data-field-key="${key}"] input[type=checkbox]`);
    await expect(checkbox, key).toBeVisible();
    const before = await checkbox.isChecked();
    await checkbox.click();
    await expect(checkbox, key).toBeChecked({ checked: !before });
  }
});

test('the compatibility panel has no preset or reset buttons, only switches and a help link per group', async ({ page }) => {
  const panel = page.locator('.mob-panel', { hasText: 'WinISD compatibility' });
  await expect(panel.locator('button:not(.compat-help-link)')).toHaveCount(0);
  await expect(panel.locator('button.compat-help-link')).toHaveCount(2);
});

// BUG (2026-09-29, John, live on his phone): "environment view needs to scroll... truncation at
// the moment". Every mobile tab's `.mob-panel` sets `overflow: hidden`, and a flex item with
// overflow other than visible gets an automatic MINIMUM size of 0 — so with the column-flex default
// `flex-shrink: 1`, once a tall tab's content exceeded `.mob-content` the shrink algorithm silently
// squashed every panel and clipped its content, instead of letting `.mob-content`'s own
// `overflow-y: auto` scroll. Fixed in MobileShell.vue: `.mob-content > :deep(*) { flex-shrink: 0; }`.
// Needs a genuinely phone-sized (narrow AND short) viewport: the default one is tall enough that
// most tabs never overflow.
test('scrolls to its last control instead of clipping it', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 700 });

  const lastControl = page.getByText('Re without Rg');
  await lastControl.scrollIntoViewIfNeeded();
  await expect(lastControl).toBeVisible();

  // The scrollable element is .mob-content, not the individual .mob-panel blocks — each panel
  // must render at its full (unclipped) height, only the shared container scrolls.
  const panelOverflow = await page.locator('.mob-panel').evaluateAll(
    panels => panels.map(p => ({ scrollHeight: p.scrollHeight, clientHeight: p.clientHeight })));
  for (const p of panelOverflow) expect(p.scrollHeight).toBeLessThanOrEqual(p.clientHeight);
});
