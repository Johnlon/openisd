import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import type {Locator, Page} from '@playwright/test';

/**
 * The ▲▼ buttons on the phone (John, 2026-10-15): a tap moves focus to the button and keeps it there,
 * so the keyboard goes away and stays away; the text box is never focused or selected by a step, and
 * the row does not move under the finger. The step is at the digit the caret last sat on, kept after
 * the box loses focus; a box that never had a caret steps 0.1. Real touch events at a phone viewport.
 */
test.use({hasTouch: true, viewport: {width: 412, height: 900}});

test.beforeEach(async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Signal'}).click();
});

const activeIs = (el: Locator) => el.evaluate(node => node === document.activeElement);
const selectionOf = (box: Locator) => box.evaluate(el => (el instanceof HTMLInputElement ? [el.selectionStart, el.selectionEnd] : null));

/** A finger held on `target` until `reached` is true, as the phone sends it. */
async function hold(page: Page, target: Locator, reached: () => Promise<boolean>): Promise<void> {
  const b = await target.boundingBox();
  if (b === null) throw new Error('button has no box');
  const point = {x: b.x + b.width / 2, y: b.y + b.height / 2, id: 1};
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
  await expect.poll(reached).toBe(true);
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
}

test('a tap focuses the button, steps the digit the caret last sat on, and the row does not move', async ({page}) => {
  const row = mobileFieldRow(page, 'Series resistance');
  const box = row.locator('input');
  const up = row.locator('.num-stepper-btn').first();
  await box.focus();
  await box.fill('1.00');
  await box.evaluate(el => { if (el instanceof HTMLInputElement) el.setSelectionRange(4, 4); });
  const where = await box.boundingBox();

  await up.tap();

  await expect(box).toHaveValue('1.010');
  expect(await activeIs(up)).toBe(true);
  expect(await activeIs(box)).toBe(false);
  expect(await box.boundingBox()).toEqual(where);

  await up.tap();
  await expect(box).toHaveValue('1.020');
  expect(await activeIs(up)).toBe(true);
});

test('a box that never had a caret steps 0.1, and nothing in the box is focused or selected', async ({page}) => {
  const row = mobileFieldRow(page, 'Series resistance');
  const box = row.locator('input');
  const before = await box.inputValue();
  const selection = await selectionOf(box);

  await row.locator('.num-stepper-btn').first().tap();

  const after = await box.inputValue();
  expect(Number(after) - Number(before)).toBeCloseTo(0.1, 9);
  expect(await activeIs(box)).toBe(false);
  expect(await selectionOf(box)).toEqual(selection);
});

test('pressing into the text box afterwards gives the keyboard\'s box back as normal', async ({page}) => {
  const row = mobileFieldRow(page, 'Series resistance');
  const box = row.locator('input');
  await row.locator('.num-stepper-btn').first().tap();
  await box.tap();
  expect(await activeIs(box)).toBe(true);
});

test('a hold keeps focus on the button and steps the same digit throughout', async ({page}) => {
  const row = mobileFieldRow(page, 'Series resistance');
  const box = row.locator('input');
  const up = row.locator('.num-stepper-btn').first();
  await box.focus();
  await box.fill('1.00');
  await box.evaluate(el => { if (el instanceof HTMLInputElement) el.setSelectionRange(4, 4); });
  await box.blur();

  await hold(page, up, async () => Number(await box.inputValue()) > 1.03);

  const value = Number(await box.inputValue());
  expect(value).toBeGreaterThan(1.03);
  expect(value).toBeLessThan(1.4);
  expect(await activeIs(up)).toBe(true);
  expect(await activeIs(box)).toBe(false);
});
