import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import type {Locator} from '@playwright/test';

/**
 * A number box steps one unit of the digit at the caret (John, 2026-10-15: "spin the digits at the
 * precision of the position of the cursor"): ArrowUp/ArrowDown and the wheel. The step logic is
 * `caretSpin` (unit-tested in packages/design); this proves the box uses it in both skins, keeps the
 * stepped digit selected, keeps the decimals shown, and still steps as before with no caret to read.
 */

/** Types `text` into the box and puts the caret at `caret`. */
async function setTextAndCaret(box: Locator, text: string, caret: number): Promise<void> {
  await box.focus();
  await box.fill(text);
  await box.evaluate((el, at) => { if (el instanceof HTMLInputElement) el.setSelectionRange(at, at); }, caret);
}
/** The box's selection: after a step it is the stepped digit (T222, John 2026-10-16: the stepped digit stays marked). */
const markOf = (box: Locator) => box.evaluate(el => (el instanceof HTMLInputElement ? [el.selectionStart, el.selectionEnd] : null));

test.describe('Original skin', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-nav li', {hasText: /^Box$/}).click();
  });

  test('ArrowUp steps the digit left of the caret, carries, and the stepped digit stays selected', async ({page}) => {
    const box = page.locator('#og-box-volume');
    await setTextAndCaret(box, '19.90', 4);
    await box.press('ArrowUp');
    await expect(box).toHaveValue('20.00');
    expect(await markOf(box)).toEqual([3, 4]); // the tenths digit

    await setTextAndCaret(box, '19.90', 2);
    await box.press('ArrowUp');
    await expect(box).toHaveValue('20.90');
    expect(await markOf(box)).toEqual([1, 2]); // the units digit

    await setTextAndCaret(box, '19.90', 1);
    await box.press('ArrowDown');
    await expect(box).toHaveValue('9.90');
    expect(await markOf(box)).toEqual([0, 1]); // the tens place is gone: the leading digit
  });

  test('the step reaches the value, and the decimals shown do not change', async ({page}) => {
    const box = page.locator('#og-box-volume');
    await setTextAndCaret(box, '6.00', 4);
    await box.press('ArrowUp');
    await box.press('ArrowUp');
    await expect(box).toHaveValue('6.02');
    await box.press('Tab');
    await expect(box).toHaveValue('6.02');
  });

  test('a comma is accepted as the decimal mark', async ({page}) => {
    const box = page.locator('#og-box-volume');
    await setTextAndCaret(box, '6,50', 4);
    await box.press('ArrowUp');
    await expect(box).toHaveValue('6.51');
  });

  test('the wheel steps a focused box at the caret', async ({page}) => {
    const box = page.locator('#og-box-volume');
    await setTextAndCaret(box, '6.00', 3);
    await box.hover();
    await page.mouse.wheel(0, -100);
    await expect(box).toHaveValue('6.10');
  });
});

test.describe('Mobile skin', () => {
  test.beforeEach(async ({page}) => {
    await page.setViewportSize({width: 412, height: 900});
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Signal'}).click();
  });

  test('a focused box steps at the caret; the ▲ button, with no caret, steps as before', async ({page}) => {
    const row = mobileFieldRow(page, 'Rs');
    const box = row.locator('input');
    await expect(box).toHaveAttribute('inputmode', 'decimal');
    await setTextAndCaret(box, '1.00', 4);
    await box.press('ArrowUp');
    await expect(box).toHaveValue('1.01');
    expect(await markOf(box)).toEqual([3, 4]); // the explicit end caret chooses the final displayed digit

    await box.blur();
    const before = Number(await box.inputValue());
    await row.locator('.num-stepper-btn').first().click();
    expect(Number(await box.inputValue())).toBeGreaterThan(before);
  });
});
