/**
 * The mobile Signal tab. The V/P coupling itself is proven once in `createDriveSignal`'s unit
 * tests (`driveSignal.test.ts`) — the same factory this tab calls. These specs prove the
 * UI is wired to it, not that the coupling formula is correct.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Signal' }).click();
});

test('shows power, voltage and series resistance fields', async ({ page }) => {
  await expect(page.locator('.mob-field-label', { hasText: 'System input power' })).toBeVisible();
  await expect(page.locator('.mob-field-label', { hasText: 'Driver input voltage' })).toBeVisible();
  await expect(page.locator('.mob-field-label', { hasText: 'Series resistance' })).toBeVisible();
});

function rowInput(page: import('@playwright/test').Page, label: string) {
  return page.locator('.mob-field-row', { has: page.locator('.mob-field-label', { hasText: label }) }).locator('input');
}

test('typing a drive voltage moves the derived input power', async ({ page }) => {
  const powerBefore = await rowInput(page, 'System input power').inputValue();

  const voltageInput = rowInput(page, 'Driver input voltage');
  await voltageInput.fill('20');
  await voltageInput.blur();

  const powerAfter = await rowInput(page, 'System input power').inputValue();
  // eslint-disable-next-line playwright/prefer-web-first-assertions -- comparing two runtime-captured values, not a fixed expected one
  expect(powerAfter).not.toBe(powerBefore);
});

test('editing series resistance persists the typed value', async ({ page }) => {
  const rsInput = rowInput(page, 'Series resistance');
  await rsInput.fill('0.5');
  await rsInput.blur();
  await expect(rsInput).toHaveValue(/0\.5/);
});

test('System input power spins by about 1 % a tap: 1 W up is 1.01 W, by key and by button', async ({ page }) => {
  const pow = rowInput(page, 'System input power');
  await pow.fill('1');
  await pow.blur();
  await pow.focus();
  await pow.press('ArrowUp');
  await expect(pow).toHaveValue('1.01');
  const [upBtn, downBtn] = await page.locator('.mob-field-row', { has: page.locator('.mob-field-label', { hasText: 'System input power' }) })
    .locator('.num-stepper-btn').all();   // [▲, ▼] order
  await downBtn.click();
  await expect(pow).toHaveValue('1.00');
  await downBtn.click();
  await expect(pow).toHaveValue('0.99');
  await upBtn.click();
  await expect(pow).toHaveValue('1.00');
});
