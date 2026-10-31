import {expect, test} from '../fixtures.js';

const specimen = '[data-specimen="number-writable-switchable-none"]';

test.beforeEach(async ({page}) => {
  await page.goto('/?field-catalogue=1');
  await expect(page.locator(specimen)).toBeVisible();
});

test('button-focused left/right selects the spin digit and up/down steps it', async ({page}) => {
  const row = page.locator(specimen), input = row.locator('input');
  const up = row.getByTitle('Increase', {exact: true});
  await input.fill('123.4500');
  await input.evaluate(el => { if (el instanceof HTMLInputElement) el.setSelectionRange(4, 5); });
  await up.focus();
  await up.press('ArrowLeft');
  await up.press('ArrowUp');
  await expect(input).toHaveValue('124.4500');
  await expect(row.locator('.num-mark-underline')).toHaveText('4');
  await up.press('ArrowRight');
  await up.press('ArrowDown');
  await expect(input).toHaveValue('124.3500');
  await expect(up).toBeFocused();
});

test('the spin marker uses blinking inverse video and disappears on leaving the whole field', async ({page}) => {
  const row = page.locator(specimen), input = row.locator('input');
  await input.fill('123.4500');
  await input.evaluate(el => { if (el instanceof HTMLInputElement) el.setSelectionRange(4, 5); });
  await row.getByTitle('Increase', {exact: true}).click();
  const marker = row.locator('.num-mark-underline');
  await expect(marker).toBeVisible();
  await expect(marker).toHaveCSS('animation-duration', '1s');
  await expect(marker).toHaveCSS('text-decoration-line', 'none');
  await page.getByRole('heading', {name: 'Field appearance catalogue', exact: true}).click();
  await expect(marker).toHaveCount(0);
});

test('held keyboard spinning accelerates and stops exactly on key release', async ({page}) => {
  const time = new Date('2026-10-27T00:00:00Z');
  await page.clock.install({time});
  await page.clock.pauseAt(time);
  const row = page.locator(specimen), input = row.locator('input');
  const up = row.getByTitle('Increase', {exact: true});
  await input.fill('100.0000');
  await input.evaluate(el => { if (el instanceof HTMLInputElement) el.setSelectionRange(4, 5); });
  await up.focus();
  await page.keyboard.down('ArrowUp');
  await expect(input).toHaveValue('100.1000');
  await page.clock.runFor(399);
  await expect(input).toHaveValue('100.1000');
  await page.clock.runFor(1);
  await expect(input).toHaveValue('100.2000');
  await page.clock.runFor(600);
  const early = Number(await input.inputValue());
  await page.clock.runFor(3000);
  const late = Number(await input.inputValue());
  await page.clock.runFor(1000);
  expect(Number(await input.inputValue()) - late).toBeGreaterThan(early - 100);
  await page.keyboard.up('ArrowUp');
  const stopped = await input.inputValue();
  await page.clock.runFor(1000);
  await expect(input).toHaveValue(stopped);
});

test.describe('touch editing', () => {
  test.use({hasTouch: true, isMobile: true, viewport: {width: 374, height: 705}});

  test('touching a digit immediately edits with a collapsed native caret and a visible inverse marker', async ({page}) => {
    const row = page.locator(specimen), input = row.locator('input');
    await input.fill('123.4500');
    await input.scrollIntoViewIfNeeded();
    const digit = await input.evaluate(el => {
      if (!(el instanceof HTMLInputElement)) throw new Error('Expected a native numeric editor');
      const context = document.createElement('canvas').getContext('2d');
      if (context === null) throw new Error('Text measurement unavailable');
      const css = getComputedStyle(el), box = el.getBoundingClientRect();
      context.font = css.font;
      return {x: box.left + parseFloat(css.borderLeftWidth) + parseFloat(css.paddingLeft) + context.measureText('123.').width + context.measureText('4').width / 2, y: box.top + box.height / 2};
    });
    await page.touchscreen.tap(digit.x, digit.y);
    await expect(input).toBeFocused();
    expect(await input.evaluate(el => el instanceof HTMLInputElement && !el.readOnly && el.selectionStart === el.selectionEnd)).toBe(true);
    await expect(row.locator('.num-mark-underline')).toHaveText('4');
    await row.getByTitle('Increase', {exact: true}).tap();
    await expect(input).toHaveValue('123.5500');
  });
});

test('moving the native caret to the end moves the marker to the final digit before spinning', async ({page}) => {
  const row = page.locator(specimen), input = row.locator('input');
  await input.fill('123.4500');
  await input.press('ArrowLeft');
  await input.press('End');
  await expect(row.locator('.num-mark-pre')).toHaveText('123.450');
  await expect(row.locator('.num-mark-underline')).toHaveText('0');
  expect(await input.evaluate(el => el instanceof HTMLInputElement && el.selectionStart === 8 && el.selectionEnd === 8)).toBe(true);
  await row.getByTitle('Increase', {exact: true}).click();
  await expect(input).toHaveValue('123.4501');
  await row.getByTitle('Decrease', {exact: true}).click();
  await expect(input).toHaveValue('123.4500');
});


test('a refused draft retains its text but loses the digit marker when focus leaves', async ({page}) => {
  const row = page.locator('[data-specimen="number-writable-none-none"]');
  const input = row.locator('input');
  await input.fill('0');
  await input.press('ArrowLeft');
  await input.press('End');
  await expect(row.locator('.num-mark-underline')).toBeVisible();
  await expect(input).toHaveAttribute('title', /must be greater than 0/);
  await page.getByRole('heading', {name: 'Field appearance catalogue', exact: true}).click();
  await expect(input).not.toBeFocused();
  await expect(input).toHaveValue('0');
  await expect(input).toHaveAttribute('title', /must be greater than 0/);
  await expect(row.locator('.num-mark-underline')).toHaveCount(0);
});


test('leaving the field stops held keyboard spinning before key release', async ({page}) => {
  const time = new Date('2026-10-27T00:00:00Z');
  await page.clock.install({time});
  await page.clock.pauseAt(time);
  const input = page.locator('[data-specimen="number-writable-none-none"] input');
  await input.fill('10.0000');
  await input.evaluate(el => { if (el instanceof HTMLInputElement) el.setSelectionRange(1, 2); });
  await page.keyboard.down('ArrowUp');
  await expect(input).toHaveValue('11.0000');
  await page.getByRole('heading', {name: 'Field appearance catalogue', exact: true}).click();
  await expect(input).not.toBeFocused();
  const stopped = await input.inputValue();
  await page.clock.runFor(1000);
  await expect(input).toHaveValue(stopped);
  await page.keyboard.up('ArrowUp');
});


test('leaving a refused field stops held repeat from repainting its digit marker', async ({page}) => {
  const time = new Date('2026-10-27T00:00:00Z');
  await page.clock.install({time});
  await page.clock.pauseAt(time);
  const row = page.locator('[data-specimen="number-writable-none-none"]');
  const input = row.locator('input');
  await input.fill('1.000');
  await input.evaluate(el => { if (el instanceof HTMLInputElement) el.setSelectionRange(0, 1); });
  await page.keyboard.down('ArrowDown');
  await expect(input).toHaveValue('0.000');
  await expect(input).toHaveAttribute('title', /must be greater than 0/);
  await expect(row.locator('.num-mark-underline')).toBeVisible();
  await page.getByRole('heading', {name: 'Field appearance catalogue', exact: true}).click();
  await expect(input).not.toBeFocused();
  await expect(row.locator('.num-mark-underline')).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect(input).toHaveValue('0.000');
  await expect(input).toHaveAttribute('title', /must be greater than 0/);
  await expect(row.locator('.num-mark-underline')).toHaveCount(0);
  await page.keyboard.up('ArrowDown');
});


for (const {units, beforeSpinner} of [{units: 'none', beforeSpinner: []}, {units: 'fixed', beforeSpinner: []}, {units: 'switchable', beforeSpinner: ['.ui-field-unit']}]) {
  test(`native Tab follows the visible ${units}-unit controls and keeps the chosen digit`, async ({page}) => {
    const row = page.locator(`[data-specimen="number-writable-${units}-none"]`);
    const input = row.locator('input');
    const up = row.getByTitle('Increase', {exact: true});
    const down = row.getByTitle('Decrease', {exact: true});
    await input.fill('1.2500');
    await input.evaluate(element => { if (element instanceof HTMLInputElement) element.setSelectionRange(3, 4); });
    await expect(row.locator('.num-mark-underline')).toHaveText('5');
    await input.press('Tab');
    for (const selector of beforeSpinner) {
      const unit = row.locator(selector);
      await expect(unit).toBeFocused();
      await expect(input).toHaveValue('1.2500');
      await expect(row.locator('.num-mark-underline')).toHaveText('5');
      await unit.press('Tab');
    }
    await expect(up).toBeFocused();
    await expect(input).toHaveValue('1.2500');
    await up.press('ArrowUp');
    await expect(input).toHaveValue('1.2600');
    await up.press('Tab');
    await expect(down).toBeFocused();
    await down.press('ArrowDown');
    await expect(input).toHaveValue('1.2500');
    await down.press('Shift+Tab');
    await expect(up).toBeFocused();
    await up.press('Shift+Tab');
    for (const selector of [...beforeSpinner].reverse()) {
      const unit = row.locator(selector);
      await expect(unit).toBeFocused();
      await unit.press('Shift+Tab');
    }
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('1.2500');
    await expect(row.locator('.num-mark-underline')).toHaveText('5');
    await input.press('Tab');
    for (const selector of beforeSpinner) await row.locator(selector).press('Tab');
    await expect(up).toBeFocused();
    await up.press('Tab');
    await down.press('Tab');
    await expect(row.locator('.num-mark-underline')).toHaveCount(0);
  });
}


for (const transfer of [{name: 'input to unit', start: 'input', key: 'ArrowUp', next: '.ui-field-unit'}, {name: 'increase to decrease', start: '[title="Increase"]', key: ' ', next: '[title="Decrease"]'}]) {
  test(`changing focus from ${transfer.name} cancels a held spin before key release`, async ({page}) => {
    const time = new Date('2026-10-27T00:00:00Z');
    await page.clock.install({time});
    await page.clock.pauseAt(time);
    const row = page.locator(specimen), input = row.locator('input');
    await input.fill('100.0000');
    await input.evaluate(element => { if (element instanceof HTMLInputElement) element.setSelectionRange(4, 5); });
    await row.locator(transfer.start).focus();
    await page.keyboard.down(transfer.key);
    await expect(input).toHaveValue('100.1000');
    await page.keyboard.press('Tab');
    await expect(row.locator(transfer.next)).toBeFocused();
    await page.clock.runFor(1000);
    await expect(input).toHaveValue('100.1000');
    await page.keyboard.up(transfer.key);
    await page.clock.runFor(1000);
    await expect(input).toHaveValue('100.1000');
    await expect(row.locator('.num-mark-underline')).toHaveText('1');
  });
}


test('changing display units drops the old spin place before the next keyboard step', async ({page}) => {
  const row = page.locator(specimen), input = row.locator('input');
  const up = row.getByTitle('Increase', {exact: true});
  const unit = row.locator('.ui-field-unit');
  await input.fill('100.0000');
  await input.evaluate(element => { if (element instanceof HTMLInputElement) element.setSelectionRange(0, 1); });
  await up.click();
  await expect(input).toHaveValue('200.0000');
  await up.press('Shift+Tab');
  await expect(unit).toBeFocused();
  await unit.press('Enter');
  await expect(unit).toHaveText('kHz');
  await expect(input).toHaveValue('0.2000000');
  await expect(row.locator('.num-mark-underline')).toHaveCount(0);
  await unit.press('Tab');
  await expect(up).toBeFocused();
  await up.press('ArrowUp');
  await expect(input).toHaveValue('0.3000000');
});


test('reverse Tab after a unit change restores an end digit instead of selecting the entire number', async ({page}) => {
  const row = page.locator(specimen), input = row.locator('input');
  const unit = row.locator('.ui-field-unit');
  await input.fill('100.0000');
  await input.press('Tab');
  await expect(unit).toBeFocused();
  await unit.press('Enter');
  await expect(input).toHaveValue('0.1000000');
  await expect(row.locator('.num-mark-underline')).toHaveCount(0);
  await unit.press('Shift+Tab');
  await expect(input).toBeFocused();
  await expect(row.locator('.num-mark-pre')).toHaveText('0.100000');
  await expect(row.locator('.num-mark-underline')).toHaveText('0');
  expect(await input.evaluate(element => element instanceof HTMLInputElement ? [element.selectionStart, element.selectionEnd] : null)).toEqual([8, 9]);
  await input.press('ArrowUp');
  await expect(input).toHaveValue('0.1000001');
});


test.describe('pointer return to the native caret', () => {
  test.use({hasTouch: true});
for (const pointer of ['mouse', 'touch'] as const) {
  test(`a ${pointer} decimal press from spinner focus keeps the native caret instead of choosing the final digit`, async ({page}) => {
    const row = page.locator(specimen), input = row.locator('input');
    await input.fill('123.4500');
    await row.getByTitle('Increase', {exact: true}).focus();
    const point = await input.evaluate(element => {
      if (!(element instanceof HTMLInputElement)) throw new Error('Expected numeric input');
      const canvas = document.createElement('canvas').getContext('2d');
      if (canvas === null) throw new Error('Text measurement unavailable');
      const css = getComputedStyle(element), box = element.getBoundingClientRect();
      canvas.font = css.font;
      return {x: box.left + parseFloat(css.borderLeftWidth) + parseFloat(css.paddingLeft) + canvas.measureText('123').width + canvas.measureText('.').width / 4, y: box.top + box.height / 2};
    });
    const press = {mouse: () => page.mouse.click(point.x, point.y), touch: () => page.touchscreen.tap(point.x, point.y)};
    await press[pointer]();
    await expect(input).toBeFocused();
    expect(await input.evaluate(element => element instanceof HTMLInputElement ? [element.selectionStart, element.selectionEnd] : null)).toEqual([3, 3]);
    await input.press('ArrowUp');
    await expect(input).toHaveValue('124.4500');
  });
}

});
