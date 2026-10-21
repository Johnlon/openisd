/**
 * The mobile Signal tab. The V/P coupling itself is proven once in `createDriveSignal`'s unit
 * tests (`driveSignal.test.ts`) — the same factory this tab calls. These specs prove the
 * UI is wired to it, not that the coupling formula is correct.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ appPage: page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Signal' }).click();
});

test('shows power, voltage and series resistance fields', async ({ appPage: page }) => {
  await expect(page.locator('.ui-field-label', { hasText: 'Power' })).toBeVisible();
  await expect(page.locator('.ui-field-label', { hasText: 'Volts' })).toBeVisible();
  await expect(page.locator('.ui-field-label', { hasText: 'Rs' })).toBeVisible();
});

function rowInput(page: import('@playwright/test').Page, label: string) {
  return page.locator('.mob-ui-field', { hasText: label }).locator('input');
}

test('typing a drive voltage moves the derived input power', async ({ appPage: page }) => {
  const powerBefore = await rowInput(page, 'Power').inputValue();

  const voltageInput = rowInput(page, 'Volts');
  await voltageInput.fill('20');
  await voltageInput.blur();

  const powerAfter = await rowInput(page, 'Power').inputValue();
  // eslint-disable-next-line playwright/prefer-web-first-assertions -- comparing two runtime-captured values, not a fixed expected one
  expect(powerAfter).not.toBe(powerBefore);
});

test('editing series resistance persists the typed value', async ({ appPage: page }) => {
  const rsInput = rowInput(page, 'Rs');
  await fillAndBlur(rsInput, '0.5');
  await expect(rsInput).toHaveValue(/0\.5/);
});

test('System input power spins by its tenths digit a tap: 1 W up is 1.1 W, by key and by button', async ({ appPage: page }) => {
  const pow = rowInput(page, 'Power');
  await pow.fill('1');
  await pow.blur();
  await pow.focus();
  await pow.press('ArrowUp');
  await expect(pow).toHaveValue('1.10');
  const [upBtn, downBtn] = await page.locator('.mob-ui-field', { hasText: 'Power' })
    .locator('.num-stepper-btn').all();   // [▲, ▼] order
  await downBtn.click();
  await expect(pow).toHaveValue('1.00');
  await downBtn.click();
  await expect(pow).toHaveValue('0.90');
  await upBtn.click();
  await expect(pow).toHaveValue('1.00');
});

// John, 21 Oct 2026 (QO291.c153): the stepped digit is a place value; it moves with the number.
test('a spin keeps its place as the number gains and loses a digit, by key and by ▲▼', async ({ appPage: page }) => {
  const pow = rowInput(page, 'Power');
  await pow.fill('9.5');
  await pow.blur();
  await pow.focus();
  await pow.press('Home');
  await pow.press('ArrowRight');            // the caret right of the units digit
  await pow.press('ArrowUp');
  await expect(pow).toHaveValue(/^10\.5/);
  await pow.press('ArrowUp');
  await expect(pow).toHaveValue(/^11\.5/);
  await pow.fill('10.5');
  await pow.blur();
  await pow.focus();
  await pow.press('Home');                  // the caret left of the tens digit
  const [upBtn, downBtn] = await page.locator('.mob-ui-field', { hasText: 'Power' })
    .locator('.num-stepper-btn').all();     // [▲, ▼] order
  await downBtn.click();
  await expect(pow).toHaveValue(/^0\.5/);
  await upBtn.click();
  await expect(pow).toHaveValue(/^10\.5/);
  await downBtn.click();
  await expect(pow).toHaveValue(/^0\.5/);
});

// fable, 21 Oct 2026 (bugs/BUG_20261021_last-decimal-digit-cannot-spin.md): a selected digit spins
// its own place, even the last digit; a bare caret at the end still spins the tenths.
test('selecting the last digit spins that digit, by key and by ▲▼', async ({ appPage: page }) => {
  const pow = rowInput(page, 'Power');
  await pow.fill('1.05');
  await pow.blur();
  await pow.focus();
  await pow.press('End');
  await pow.press('Shift+ArrowLeft');       // the 5 selected
  const [upBtn] = await page.locator('.mob-ui-field', { hasText: 'Power' })
    .locator('.num-stepper-btn').all();     // [▲, ▼] order
  await upBtn.click();
  await expect(pow).toHaveValue('1.06');
  await upBtn.click();
  await expect(pow).toHaveValue('1.07');
  await pow.focus();
  await pow.press('End');
  await pow.press('Shift+ArrowLeft');
  await pow.press('ArrowUp');
  await expect(pow).toHaveValue('1.08');
});
