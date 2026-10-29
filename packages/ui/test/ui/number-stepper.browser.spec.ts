import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import type {Locator} from '@playwright/test';

/** The decided rendition keeps spinner focus and marks the logical digit in inverse video.
 * Native selection of an unfocused input is not the marker: the reference gallery's browser
 * collapses it after pointer release too. Active-input caret behavior has its own spec. */
async function logicalMarkOf(box: Locator) {
  return box.evaluate(el => {
    const row = el.closest('.ui-field');
    const digit = row?.querySelector('.num-mark-underline');
    if (digit === null || digit === undefined) return null;
    const start = row?.querySelector('.num-mark-pre')?.textContent?.length ?? 0;
    const char = digit.textContent ?? '';
    return {start, end: start + char.length, char};
  });
}

async function setBoxValueAndCaret(box: Locator, value: string, caret: number): Promise<void> {
  await box.focus();
  await box.fill(value);
  await box.evaluate((el, at) => {
    if (el instanceof HTMLInputElement) el.setSelectionRange(at, at);
  }, caret);
}

test.describe('Original skin (desktop)', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-nav li', {hasText: /^Box$/}).click();
  });

  test('▲ steps the digit at the caret (tenths here), marks the stepped digit, and keeps focus on the spinner', async ({page}) => {
    const box = page.locator('#og-box-volume');
    await setBoxValueAndCaret(box, '20.00', 4); // caret after the tenths digit
    await expect(box).toHaveValue('20.00');

    const stepperUp = page.locator('.ui-field:has(#og-box-volume) .num-stepper-btn').first();
    await stepperUp.click();

    await expect(box).toHaveValue('20.10');
    await expect(stepperUp).toBeFocused();

    const sel = await logicalMarkOf(box);
    expect(sel).not.toBeNull();
    expect(sel!.end! - sel!.start!).toBe(1);
    expect(sel!.start).toBe(3); // tenths digit in '20.10'
    expect(sel!.char).toBe('1');
  });

  test('caret moved to the tens digit steps tens and marks the tens digit', async ({page}) => {
    const box = page.locator('#og-box-volume');
    await setBoxValueAndCaret(box, '20.10', 1); // caret after '2' (tens digit)

    const stepperUp = page.locator('.ui-field:has(#og-box-volume) .num-stepper-btn').first();
    await stepperUp.click();

    await expect(box).toHaveValue('30.10');
    await expect(stepperUp).toBeFocused();

    const sel = await logicalMarkOf(box);
    expect(sel).not.toBeNull();
    expect(sel!.end! - sel!.start!).toBe(1);
    expect(sel!.start).toBe(0); // tens digit in '30.10'
    expect(sel!.char).toBe('3');
  });

  test('after 9.9 ▲ the mark is still on tenths across carry to 10.0', async ({page}) => {
    const box = page.locator('#og-box-volume');
    await setBoxValueAndCaret(box, '9.9', 3); // caret at tenths

    const stepperUp = page.locator('.ui-field:has(#og-box-volume) .num-stepper-btn').first();
    await stepperUp.click();

    await expect(box).toHaveValue('10.0');
    await expect(stepperUp).toBeFocused();

    const sel = await logicalMarkOf(box);
    expect(sel).not.toBeNull();
    expect(sel!.end! - sel!.start!).toBe(1);
    expect(sel!.start).toBe(3); // tenths digit in '10.0'
    expect(sel!.char).toBe('0');
  });

  test('Escape clears the mark', async ({page}) => {
    const box = page.locator('#og-box-volume');
    await box.fill('20.00');
    await box.blur();
    await expect(box).toHaveValue('20.00');

    const stepperUp = page.locator('.ui-field:has(#og-box-volume) .num-stepper-btn').first();
    await stepperUp.click();

    expect(await logicalMarkOf(box)).toMatchObject({end: 5, start: 4});

    await stepperUp.press('Escape');
    await expect(page.locator('.ui-field:has(#og-box-volume) .num-mark-underline')).toHaveCount(0);
    const selAfter = await box.evaluate(el => (el instanceof HTMLInputElement ? el.selectionEnd! - el.selectionStart! : -1));
    expect(selAfter).toBe(0);
  });
});

test.describe('Mobile skin', () => {
  test.beforeEach(async ({page}) => {
    await page.setViewportSize({width: 412, height: 900});
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
  });

  test('▲ button holds focus, steps tenths across carry 9.9 -> 10.0, and marks tenths with inverse overlay', async ({page}) => {
    const row = mobileFieldRow(page, 'Vb').first();
    const box = row.locator('input').first();
    await box.fill('9.9');
    await box.blur();

    const stepperUp = row.locator('.num-stepper-btn').first();
    await stepperUp.click();

    await expect(box).toHaveValue('10.00');
    // Button holds focus; box is not activeElement (keyboard stays down)
    expect(await box.evaluate(el => document.activeElement === el)).toBe(false);

    // Overlay is visible
    const overlay = row.locator('.num-mark-overlay');
    await expect(overlay).toBeVisible();

    // Check pre, underline, and post text offsets
    const pre = overlay.locator('.num-mark-pre');
    const underline = overlay.locator('.num-mark-underline');
    const post = overlay.locator('.num-mark-post');
    await expect(pre).toHaveText('10.');
    await expect(underline).toHaveText('0');
    await expect(post).toHaveText('0');

    // Clicking beyond the text puts the native caret after the final digit. John's
    // end-caret ruling requires that digit to be highlighted and spun, not cleared.
    await box.click();
    await expect(box).toBeFocused();
    await expect(pre).toHaveText('10.0');
    await expect(underline).toHaveText('0');
    await expect(post).toHaveText('');
    await box.press('ArrowUp');
    await expect(box).toHaveValue('10.01');
    await page.locator('.mob-tab').filter({hasText: /^Box$/}).click();
    await expect(overlay).toHaveCount(0);
  });
});

/**
 * John, 2026-10-16 (bugs/BUG_20261016_mobile-vent-stepper-jumps-focus-ignores-caret-no-digit-marker.md):
 * on the phone vent editor a ▲ press stepped the tenths whatever the caret, moved focus to the next
 * box, and marked nothing. Focus stays on the pressed button, the step uses the caret the box had
 * before the press (kept for further presses), and the stepped digit is marked.
 */
test.describe('Mobile vent editor: Tuning freq (calculated) steps the digit at the caret', () => {
  test.use({hasTouch: true});

  test.beforeEach(async ({page}) => {
    await page.setViewportSize({width: 390, height: 844});
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    const length = mobileFieldRow(page, 'Vent length').locator('input');
    await length.fill('30');
    await length.blur();
  });

  test('the caret after the units digit: ▲ steps the units, focus stays on ▲, the units digit is marked, a repeat steps it again', async ({page}) => {
    const row = mobileFieldRow(page, 'Fb');
    const box = row.locator('input');
    await expect(box).toHaveClass(/value-c/);
    const before = Number(await box.inputValue());
    await box.focus();
    await box.evaluate(el => { if (el instanceof HTMLInputElement) el.setSelectionRange(2, 2); });
    const up = row.locator('.num-stepper-btn').first();

    await up.tap();

    await expect(box).toHaveValue(new RegExp(`^${Math.trunc(before) + 1}\\.`));
    expect(await up.evaluate(el => document.activeElement === el), 'focus is on the ▲ button').toBe(true);
    await expect(row.locator('.num-mark-underline')).toHaveText(String((Math.trunc(before) + 1) % 10));
    await up.tap();
    await expect(box).toHaveValue(new RegExp(`^${Math.trunc(before) + 2}\\.`));
    expect(await up.evaluate(el => document.activeElement === el)).toBe(true);
  });

  test('the caret after the decimal point: ▲ steps the tenths', async ({page}) => {
    const row = mobileFieldRow(page, 'Fb');
    const box = row.locator('input');
    const before = await box.inputValue();
    await box.focus();
    await box.evaluate(el => { if (el instanceof HTMLInputElement) el.setSelectionRange(3, 3); });

    await row.locator('.num-stepper-btn').first().click();

    const tenths = (text: string): number => Number(text.split('.')[0] + text.split('.')[1].slice(0, 1));
    expect(tenths(await box.inputValue())).toBe(tenths(before) + 1);
  });

  test('every stepped field on the Vented tab: ▲ changes the value and focus stays on the ▲ that was pressed', async ({page}) => {
    const rows = page.locator('.mob-ui-field', {has: page.locator('.num-stepper-btn')});
    const count = await rows.count();
    expect(count, 'stepped rows on the Vented tab').toBeGreaterThan(2);
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const box = row.locator('input').first();
      const up = row.locator('.num-stepper-btn').first();
      const before = await box.inputValue();
      await up.tap();
      await expect(box, `row ${i}`).not.toHaveValue(before);
      expect(await up.evaluate(el => document.activeElement === el), `row ${i}: focus on its ▲`).toBe(true);
    }
  });
});
