import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import type {Locator} from '@playwright/test';

/**
 * Number field steppers and digit marking across both desktop and mobile skins.
 *
 * Desktop: clicking ▲▼, key or wheel steps the digit, keeps focus in the input,
 * and marks the stepped digit via a 1-character selection at the stepped place value.
 *
 * Mobile: clicking ▲▼ keeps focus on the stepper button (keyboard stays down),
 * and marks the stepped digit via an underline mirror overlay at the stepped place value.
 *
 * Both skins: stepping tenths across carry (9.9 + 0.1 -> 10.0) keeps the mark on the tenths place.
 * Esc, typing or tapping in the box clears the mark.
 */

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

  test('▲ steps the digit at the caret (tenths here), selects the stepped digit, and keeps focus in the input', async ({page}) => {
    const box = page.locator('#og-box-volume');
    await setBoxValueAndCaret(box, '20.00', 4); // caret after the tenths digit
    await expect(box).toHaveValue('20.00');

    const stepperUp = page.locator('.ui-field:has(#og-box-volume) .num-stepper-btn').first();
    await stepperUp.click();

    await expect(box).toHaveValue('20.10');
    expect(await box.evaluate(el => document.activeElement === el)).toBe(true);

    const sel = await box.evaluate(el => {
      if (!(el instanceof HTMLInputElement)) return null;
      return {
        start: el.selectionStart,
        end: el.selectionEnd,
        char: el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0),
      };
    });
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
    expect(await box.evaluate(el => document.activeElement === el)).toBe(true);

    const sel = await box.evaluate(el => {
      if (!(el instanceof HTMLInputElement)) return null;
      return {
        start: el.selectionStart,
        end: el.selectionEnd,
        char: el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0),
      };
    });
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
    expect(await box.evaluate(el => document.activeElement === el)).toBe(true);

    const sel = await box.evaluate(el => {
      if (!(el instanceof HTMLInputElement)) return null;
      return {
        start: el.selectionStart,
        end: el.selectionEnd,
        char: el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0),
      };
    });
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

    const selBefore = await box.evaluate(el => (el instanceof HTMLInputElement ? el.selectionEnd! - el.selectionStart! : 0));
    expect(selBefore).toBe(1);

    await box.press('Escape');
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

  test('▲ button holds focus, steps tenths across carry 9.9 -> 10.0, and marks tenths with underline overlay', async ({page}) => {
    const row = mobileFieldRow(page, 'Volume').first();
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

    // Tap in the box clears the mark
    await box.click();
    await expect(overlay).toHaveCount(0);
  });
});
