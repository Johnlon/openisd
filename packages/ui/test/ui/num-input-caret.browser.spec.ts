import {expect, openAMobileProject, openAProject, setFocusedBoxType, test} from '../fixtures.js';
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

test.describe('desktop native text editing alongside digit spinning',()=>{
 test.beforeEach(async({page})=>{await page.goto('/');await openAProject(page);await page.locator('.project-nav li').filter({hasText:/^Box$/}).click();});

 for(const gesture of ['select all','double click'] as const) test(`${gesture} visibly selects the number for replacement and deletion`,async({page})=>{
  const box=page.locator('#og-box-volume');await box.fill('123.45');
  const selectors = {'select all': () => box.press('ControlOrMeta+A'), 'double click': () => box.dblclick()};
  const select = selectors[gesture];
  await select();
  expect(await box.evaluate(el=>el instanceof HTMLInputElement && el.selectionStart===0 && el.selectionEnd===el.value.length)).toBe(true);
  expect(await box.evaluate(el=>getComputedStyle(el,'::selection').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await expect(box.locator('..').locator('.num-mark-overlay')).toHaveCount(0);
  await box.pressSequentially('67.8');await expect(box).toHaveValue('67.8');
  await select();await box.press('Delete');await expect(box).toHaveValue('');
 });

 test('shift-click retains a native text range for replacement',async({page})=>{
  const box=page.locator('#og-box-volume');await box.fill('123.45');await box.press('Home');
  const end=await box.evaluate(el=>{const css=getComputedStyle(el),r=el.getBoundingClientRect();return {x:r.width-parseFloat(css.paddingRight)-2,y:r.height/2};});
  await box.click({position:end,modifiers:['Shift']});
  expect(await box.evaluate(el=>el instanceof HTMLInputElement && el.selectionEnd!-el.selectionStart!>1)).toBe(true);
  await box.press('Backspace');await expect(box).toHaveValue('');
 });
});


test('dragging across passive-radiator Vas selects text without changing the value', async ({page}) => {
  await page.clock.install();
  await page.goto('/');
  await openAProject(page);
  await setFocusedBoxType(page, 'box-passive-radiator');
  await page.locator('.project-nav li', {hasText: 'Passive Radiator'}).click();
  const box = page.locator('#og-pr-vas');
  await box.fill('123.45');
  const points = await box.evaluate(el => {
    if (!(el instanceof HTMLInputElement)) throw new Error('Expected numeric input');
    const css = getComputedStyle(el), rect = el.getBoundingClientRect();
    const context = document.createElement('canvas').getContext('2d');
    if (context === null) throw new Error('No text measurement context');
    context.font = css.font;
    const left = rect.left + el.clientLeft + parseFloat(css.paddingLeft);
    return {left, right: left + context.measureText(el.value).width, y: rect.top + rect.height / 2};
  });
  await page.mouse.move(points.left, points.y);
  await page.mouse.down();
  await page.mouse.move(points.right, points.y, {steps: 12});
  await page.clock.runFor(200);
  await page.mouse.up();
  await expect(box).toHaveValue('123.45');
  expect(await markOf(box)).toEqual([0, 6]);
  await box.press('Delete');
  await expect(box).toHaveValue('');
});


test('native selection of a single digit stays visibly selected for editing',async({page})=>{
 await page.goto('/');await openAProject(page);await page.locator('.project-nav li').filter({hasText:/^Box$/}).click();
 const box=page.locator('#og-box-volume');await box.fill('6');await box.press('ControlOrMeta+A');
 expect(await markOf(box)).toEqual([0,1]);
 await expect(box.locator('..').locator('.num-mark-overlay')).toHaveCount(0);
 expect(await box.evaluate(el=>getComputedStyle(el,'::selection').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
 await box.press('Delete');await expect(box).toHaveValue('');
});
