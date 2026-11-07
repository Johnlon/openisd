import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import type {Locator, Page} from '@playwright/test';

/**
 * T567: press a digit of an editable number box to spin it: mouse up/down, touch left/right (John, 19 Oct 2026:
 * "the existing UI should be allowing spin by dragging any field"; QO299.c24: left/right only; 22 Oct:
 * "stretch and digit selection ... with same with mouse drag"). The pressed digit sets the step; past
 * 8 px the value keeps running while held; a tap still puts the caret; a vertical finger swipe still scrolls. Desktop horizontal dragging selects text (John, 28 Oct).
 * Acts as a user: real mouse and touch events, values read from the screen.
 */

/** Page x and y of the middle of character `index` of the box's text, measured in the box's font. */
async function digitCentre(box: Locator, index: number): Promise<{x: number; y: number}> {
  return box.evaluate((el, i) => {
    if (!(el instanceof HTMLInputElement)) throw new Error('not an input');
    const style = getComputedStyle(el);
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx === null) throw new Error('no canvas');
    ctx.font = style.font;
    const r = el.getBoundingClientRect();
    const left = r.left + el.clientLeft + parseFloat(style.paddingLeft);
    const free = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - ctx.measureText(el.value).width;
    const origin = style.textAlign === 'right' || style.textAlign === 'end' ? free : style.textAlign === 'center' ? free / 2 : 0;
    const x = left + origin + (ctx.measureText(el.value.slice(0, i)).width + ctx.measureText(el.value.slice(0, i + 1)).width) / 2;
    return {x, y: r.top + r.height / 2};
  }, index);
}

const numberIn = async (box: Locator): Promise<number> => Number(await box.inputValue());

/** Press at `from`, move `dx` right (negative = left) and `dy` down, and hold until `reached` is true, then release. */
async function mouseDrag(page: Page, from: {x: number; y: number}, dx: number, dy: number, reached: () => Promise<boolean>): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, {steps: 4});
  await page.mouse.move(from.x + dx, from.y + dy, {steps: 4});
  await expect.poll(reached).toBe(true);
  await page.mouse.up();
}

/** A finger from `from` to `to`, held until `reached` is true, then lifted. */
async function touchDrag(page: Page, from: {x: number; y: number}, to: {x: number; y: number}, reached: () => Promise<boolean>): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: from.x, y: from.y, id: 1}]});
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: from.x + (to.x - from.x) * i / 8, y: from.y + (to.y - from.y) * i / 8, id: 1}]});
  }
  await expect.poll(reached).toBe(true);
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
}

test.describe('desktop skin, mouse', () => {
  test.beforeEach(async ({page}) => {
    await page.clock.install({time: new Date()});
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-nav li', {hasText: /^Box$/}).click();
    await page.locator('select#og-box-type').selectOption('sealed');
  });

  test('dragging up from the units digit raises the value in whole units and keeps it running while held', async ({page}) => {
    const box = page.locator('#og-box-volume');
    await box.fill('20.00');
    await box.blur();
    await mouseDrag(page, await digitCentre(box, 1), 0, -40, async () => (await numberIn(box)) > 22);
    const after = await numberIn(box);
    expect(Number.isInteger(after - 20)).toBe(true);
    const shown = await box.inputValue();
    await page.waitForTimeout(300); // eslint-disable-line playwright/no-wait-for-timeout -- proves it has stopped
    await expect(box).toHaveValue(shown);
  });

  test('the digit pressed sets the step: tenths moves in tenths', async ({page}) => {
    const box = page.locator('#og-box-volume');
    await box.fill('20.00');
    await box.blur();
    const from = await digitCentre(box, 3);
    await page.clock.pauseAt(new Date(Date.now() + 60_000)); // the hold is 200 ms of scripted page time, not of a loaded machine's
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y - 20, {steps: 4});
    await page.mouse.move(from.x, from.y - 40, {steps: 4});
    await page.clock.runFor(200);
    await page.mouse.up();
    const change = (await numberIn(box)) - 20;
    expect(change).toBeGreaterThan(0);
    expect(change).toBeLessThan(10);
    expect(Math.abs(change * 10 - Math.round(change * 10))).toBeLessThan(1e-6);
    expect(Math.round(change * 10) % 10).not.toBe(0);   // not a whole-unit step
  });

  test('dragging down lowers the value, and the driven digit is highlighted while dragging', async ({page}) => {
    const box = page.locator('#og-box-volume');
    await box.fill('20.00');
    await box.blur();
    const from = await digitCentre(box, 1);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + 40, {steps: 6});
    await expect.poll(async () => (await numberIn(box)) < 19).toBe(true);
    await expect.poll(() => box.evaluate(el => el instanceof HTMLInputElement ? el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0).length : -1)).toBe(1);
    await page.mouse.up();
  });

  test('a vertical spin keeps its digit after returning to the dead zone with sideways drift', async ({page}) => {
    const box = page.locator('#og-box-volume');
    await box.fill('20.00');
    await box.blur();
    await page.clock.pauseAt(new Date(Date.now() + 60_000));
    const from = await digitCentre(box, 1);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y - 40, {steps: 4});
    await page.clock.runFor(200);
    expect(await numberIn(box)).toBeGreaterThan(20);
    const selected = await box.evaluate(el => el instanceof HTMLInputElement ? [el.selectionStart, el.selectionEnd] : null);
    await page.mouse.move(from.x + 60, from.y - 2);
    await page.mouse.up();
    expect(await box.evaluate(el => el instanceof HTMLInputElement ? [el.selectionStart, el.selectionEnd] : null)).toEqual(selected);
    expect((selected?.[1] ?? 0) - (selected?.[0] ?? 0)).toBe(1);
    await expect(box.locator('..').locator('.num-mark-underline')).toHaveText(/\d/);
  });

  test('under 8 px nothing changes, and a click selects one digit', async ({page}) => {
    const box = page.locator('#og-box-volume');
    await box.fill('20.00');
    await box.blur();
    const from = await digitCentre(box, 1);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 5, from.y, {steps: 3});
    await page.mouse.up();
    await expect(box).toHaveValue('20.00');
    const caret = await box.evaluate(el => el instanceof HTMLInputElement ? [el.selectionStart, el.selectionEnd] : null);
    expect((caret?.[1] ?? 0) - (caret?.[0] ?? 0)).toBe(1);
    await expect(box.locator('..').locator('.num-mark-underline')).toHaveText(/\d/);
  });

  for(const start of ['selected digit','decimal point','left padding','empty value space'] as const) test(`mouse drag spins from ${start} even with selected text`,async({page})=>{
    const box=page.locator('#og-box-volume');await box.fill('20.00');await box.press('ControlOrMeta+A');
    const points=await box.evaluate(el=>{
      if(!(el instanceof HTMLInputElement))throw new Error('Expected numeric input');const r=el.getBoundingClientRect(),css=getComputedStyle(el);const ctx=document.createElement('canvas').getContext('2d')!;ctx.font=css.font;
      const textLeft=r.left+el.clientLeft+parseFloat(css.paddingLeft),y=r.top+r.height/2;
      return {'selected digit':{x:textLeft+ctx.measureText(el.value[0]??'').width/2,y},'decimal point':{x:textLeft+ctx.measureText('20').width+ctx.measureText('.').width/2,y},'left padding':{x:r.left+2,y},'empty value space':{x:r.right-parseFloat(css.paddingRight)-3,y}};
    });
    const from=points[start];
    await mouseDrag(page,from,0,-40,async()=>await numberIn(box)>20);
    await expect(box).toBeFocused();
  });

  test('a horizontal selection drag never changes the value', async ({page}) => {
    const box = page.locator('#og-box-volume');
    await box.fill('20.00');
    await box.blur();
    const from = await digitCentre(box, 1);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 60, from.y, {steps: 6});
    await page.mouse.move(from.x - 60, from.y, {steps: 6});
    await page.mouse.move(from.x - 60, from.y - 50, {steps: 6});
    await page.clock.runFor(300);
    await page.mouse.up();
    await expect(box).toHaveValue('20.00');
  });
});

test.describe('phone skin, finger', () => {
  test.use({hasTouch: true, isMobile: true, viewport: {width: 374, height: 705}});

  test.beforeEach(async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Signal'}).click();
  });

  test('a finger drag right raises, left lowers, in the pressed digit\'s step', async ({page}) => {
    const box = mobileFieldRow(page, 'Rs').locator('input');
    await box.fill('1.00');
    await box.evaluate(el => el.blur());
    const start = await digitCentre(box, 0);
    await touchDrag(page, start, {x: start.x + 40, y: start.y}, async () => (await numberIn(box)) > 3);
    const up = await numberIn(box);
    expect(Number.isInteger(up - 1)).toBe(true);
    const again = await digitCentre(box, 0);
    await touchDrag(page, again, {x: again.x - 40, y: again.y}, async () => (await numberIn(box)) < up - 2);
  });

  test('a vertical swipe on the box leaves the value, and the page scrolls', async ({page}) => {
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    const box = page.locator('input[data-numinput]').first();
    await expect(box).toBeVisible();
    const before = await box.inputValue();
    const scrollOf = () => box.evaluate(el => {
      let total = 0;
      for (let n: Element | null = el; n !== null; n = n.parentElement) total += n.scrollTop;
      return total;
    });
    const top = await scrollOf();
    const start = await digitCentre(box, 0);
    await touchDrag(page, start, {x: start.x, y: start.y - 150}, async () => (await scrollOf()) !== top);
    await expect(box).toHaveValue(before);
  });

  test('a vertical-first finger gesture with horizontal drift at the top boundary never spins', async ({page}) => {
    await page.clock.install();
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    const box = page.locator('input[data-numinput]').first();
    await expect(box).toBeVisible();
    const before = await box.inputValue();
    const start = await digitCentre(box, 0);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{...start, id: 1}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: start.x, y: start.y + 20, id: 1}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: start.x + 30, y: start.y + 80, id: 1}]});
    await page.clock.runFor(700);
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await expect(box).toHaveValue(before);
  });

  test('a vertical swipe starting on a spinner scrolls without stepping the value', async ({page}) => {
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    const box = page.locator('input[data-numinput]').first();
    const spinner = box.locator('xpath=../following-sibling::span[contains(@class,"num-stepper")]').locator('.num-stepper-btn').first();
    await expect(spinner).toBeVisible();
    const before = await box.inputValue();
    const scrollOf = () => page.locator('.mob-content').evaluate(el => el.scrollTop);
    const top = await scrollOf();
    const bounds = (await spinner.boundingBox())!;
    await touchDrag(page, {x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2},
      {x: bounds.x + bounds.width / 2, y: bounds.y - 120}, async () => (await scrollOf()) !== top);
    await expect(box).toHaveValue(before);
  });
});

/**
 * The same drag (press the units digit, 40 px in the positive spin direction in 8 moves, hold 700 ms, release) by mouse or by finger; returns the steps taken.
 * The hold is 700 ms of the page's scripted clock (page.clock), run in 40 ms ticks, so the count is the same on a loaded machine.
 */
async function sameDrag(page: Page, box: Locator, by: 'mouse' | 'touch'): Promise<number> {
  await box.fill('20.00');
  await box.evaluate(el => el.blur());
  const at = await digitCentre(box, 1);
  if (by === 'mouse') {
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(at.x, at.y - 5 * i);
    await page.clock.runFor(700);
    await page.mouse.up();
  } else {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: at.x, y: at.y, id: 1}]});
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: at.x + 5 * i, y: at.y, id: 1}]});
    await page.clock.runFor(700);
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  }
  return (await numberIn(box)) - 20;
}

test.describe('mouse vertical and finger horizontal spinning use the same stepping', () => {
  test.use({hasTouch: true});

  test('desktop skin: equal vertical mouse and horizontal finger drags take the same steps', async ({page}) => {
    await page.clock.install({time: new Date()});
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-nav li', {hasText: /^Box$/}).click();
    await page.locator('select#og-box-type').selectOption('sealed');
    const box = page.locator('#og-box-volume');
    await page.clock.pauseAt(new Date(Date.now() + 60_000)); // from here only runFor moves page time
    const byMouse = await sameDrag(page, box, 'mouse');
    const byFinger = await sameDrag(page, box, 'touch');
    expect(byMouse).toBeGreaterThan(0);
    expect(byFinger).toBeGreaterThan(0);
    expect(byFinger, `mouse ${byMouse} steps, finger ${byFinger}`).toBe(byMouse);
  });
});
