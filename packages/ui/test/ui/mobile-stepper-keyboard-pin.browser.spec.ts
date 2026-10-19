import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Locator} from '@playwright/test';

/**
 * A ▲▼ tap with the keyboard up closes the keyboard; the box stays where it was on screen, so the
 * next tap at the same spot steps the same box (bugs/BUG_20261019_phone-field-jumps-when-stepper-closes-keyboard.md).
 * The keyboard is played by shrinking the viewport, as the phone's visible screen shrinks.
 */
const PHONE = {width: 374, height: 705};
const KEYBOARD_UP = {width: 374, height: 400};
test.use({hasTouch: true, viewport: PHONE});

type ScreenBox = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;

async function boxOf(el: Locator): Promise<ScreenBox> {
  const b = await el.boundingBox();
  if (b === null) throw new Error('not on screen');
  return b;
}

test.beforeEach(async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Box'}).click();
});

test('the last box on the tab stays put when its ▲ closes the keyboard, and a second tap steps it again', async ({page}) => {
  const row = page.locator('.mob-content :has(> .num-stepper)').last();
  const box = row.locator('input[data-numinput]');
  const up = row.locator('.num-stepper-btn').first();

  await box.tap();
  await page.setViewportSize(KEYBOARD_UP);
  await expect.poll(async () => {
    const b = await box.boundingBox();
    return b !== null && b.y >= 0 && b.y + b.height <= KEYBOARD_UP.height;
  }).toBe(true);

  const before = await boxOf(box);
  const btn = await boxOf(up);
  const first = await box.inputValue();

  await up.tap();
  await page.setViewportSize(PHONE);
  await expect.poll(async () => Math.round((await box.boundingBox())?.y ?? -1)).toBe(Math.round(before.y));
  await expect(box).not.toHaveValue(first);

  const second = await box.inputValue();
  await page.touchscreen.tap(btn.x + btn.width / 2, btn.y + btn.height / 2);
  await expect(box).not.toHaveValue(second);
});
