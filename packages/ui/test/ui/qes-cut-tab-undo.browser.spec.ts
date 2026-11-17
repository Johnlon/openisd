import {expect, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {clearWithKeyboard} from '../fixtures/numField.js';

/**
 * Ctrl-Z in a number box is the box's own one-step undo (John, 8 Nov 2026: "CTRL-Z doesn't work at
 * all now"): it puts back, and commits, the value from before the last edit.
 * Edit Driver, Parameters: a refused entry's red message is a popup that moves no row (John, 8 Nov 2026, "serious ui bug ... its the error boxes"); and a typed value
 * replaces the old one, also after Ctrl-Z (BUG_20261108_edit-driver-typed-digits-append-to-old-value).
 */

async function openParameters(page: Page) {
  await page.setViewportSize({width: 1280, height: 800});
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  await page.locator('.edit-btn', {hasText: 'Edit'}).click();
  await page.locator('.de-body').waitFor({state: 'visible'});
  await page.getByRole('button', {name: 'Parameters', exact: true}).click();
}

function rowFor(page: Page, key: string): Locator {
  return page.locator(`.de-body .de-fld[data-field-key="${key}"]`);
}

async function box(l: Locator) {
  const b = await l.boundingBox();
  if (b === null) throw new Error('not visible');
  return b;
}

const BOXES = [{key: 'Qes', name: 'Qes'}, {key: 'Vas_m3', name: 'Vas'}, {key: 'Mms_kg', name: 'Mms'}] as const;

/** The row's size and the distance to a neighbouring row: scrolling the dialog changes neither, a pushed row changes the second. */
async function shape(l: Locator) {
  const b = await box(l);
  const next = await box(l.locator('xpath=(preceding-sibling::*[not(self::style)]|following-sibling::*[not(self::style)])[1]'));
  return {width: b.width, height: b.height, toNext: Math.abs(next.y - b.y)};
}

/** The window's size, read from the page. */
const windowSize = (page: Page) => page.evaluate(() => ({width: innerWidth, height: innerHeight}));

test('two refused boxes at once (Qes and Vas) each show a popup inside the window and move no row at 2200 px', async ({page}) => {
  await openParameters(page);
  await page.setViewportSize({width: 2200, height: 900});
  const rows = [rowFor(page, 'Qes'), rowFor(page, 'Vas_m3')];
  const before = await Promise.all(rows.map(r => shape(r)));
  for (const row of rows) {
    const input = row.locator('input').first();
    await clearWithKeyboard(input);
    await input.pressSequentially('.');
    await input.press('Tab');
    await expect(row.locator('.ui-field-note')).toBeVisible();
    await row.locator('.ui-field-dq-btn').click();
  }
  const size = await windowSize(page);
  for (const row of rows) {
    await row.locator('.ui-field-dq-btn').click();
    const note = row.locator('.ui-field-note');
    await expect(note).toBeVisible();
    const n = await box(note);
    expect(n.x).toBeGreaterThanOrEqual(0);
    expect(n.y).toBeGreaterThanOrEqual(0);
    expect(n.x + n.width).toBeLessThanOrEqual(size.width);
    expect(n.y + n.height).toBeLessThanOrEqual(size.height);
    await row.locator('.ui-field-dq-btn').click();
    await expect(note).toBeHidden();
  }
  const after = await Promise.all(rows.map(r => shape(r)));
  expect(after).toEqual(before);
});

for (const {key, name} of BOXES) {
  test(`a refused ${name} entry shows its message in a popup inside the window and moves no row`, async ({page}) => {
    await openParameters(page);
    const row = rowFor(page, key);
    const before = await shape(row);
    const input = row.locator('input').first();
    await clearWithKeyboard(input);
    await input.pressSequentially('.');
    await input.press('Tab');
    const note = row.locator('.ui-field-note');
    await expect(note).toBeVisible();
    await page.screenshot({path: process.env[`T727_SHOT_${name}`] ?? `build/t727/run-${name}.png`});
    const n = await box(note);
    const size = await windowSize(page);
    expect(n.x).toBeGreaterThanOrEqual(0);
    expect(n.y).toBeGreaterThanOrEqual(0);
    expect(n.x + n.width).toBeLessThanOrEqual(size.width);
    expect(n.y + n.height).toBeLessThanOrEqual(size.height);
    expect(await shape(row)).toEqual(before);
    // The popup is drawn on top: the element under its centre is the note itself.
    const top = await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.className ?? '', {x: n.x + n.width / 2, y: n.y + n.height / 2});
    expect(String(top)).toContain('ui-field-note');
    // A second click on the glyph closes it.
    await row.locator('.ui-field-dq-btn').click();
    await expect(note).toBeHidden();
  });
}

for (const {key, name} of BOXES) {
  test(`qes-cut-tab-undo: ${name} cut, Tab, back in, Ctrl-Z restores the original value and no error`, async ({page}) => {
    await openParameters(page);
    await page.getByLabel('Auto calculate unknowns').check();
    const row = rowFor(page, key);
    const input = row.locator('input').first();
    const original = await input.inputValue();
    await input.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+x');
    await page.keyboard.press('Tab');
    await expect(input).toHaveValue(/^\d+(\.\d+)?$/);   // the app calculated it
    await input.click();
    await page.keyboard.press('Control+z');
    await expect(input, 'Ctrl-Z restores the value from before the cut').toHaveValue(original);
    await page.keyboard.press('Tab');
    await expect(input, 'and it is committed, not just shown').toHaveValue(original);
    await expect(row.locator('.ui-field-note')).toHaveCount(0);
  });
}

for (const {name, tab, input, note} of [
  {name: 'tuning frequency (Fb)', tab: 'Box', input: (p: Page) => p.locator('#og-fb-target'), note: (p: Page) => p.locator('#og-fb-target-field .ui-field-note')},
  {name: 'vent diameter', tab: 'Vented', input: (p: Page) => p.locator('.ui-field', {hasText: 'Vent diameter'}).locator('input').first(), note: (p: Page) => p.locator('.ui-field', {hasText: 'Vent diameter'}).locator('.ui-field-note')},
]) {
  test(`qes-cut-tab-undo: the Vented tab ${name} cut, Tab, back in, Ctrl-Z restores the original value and no error`, async ({page}) => {
    await page.setViewportSize({width: 1280, height: 800});
    await page.goto('/');
    await openAProject(page);
    await setFocusedBoxType(page, 'vented');
    await page.locator('.project-nav li', {hasText: tab}).click();
    const box = input(page);
    const original = await box.inputValue();
    await box.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+x');
    await page.keyboard.press('Tab');
    await expect(box).toHaveValue(/^\d+(\.\d+)?$/);
    await box.click();
    await page.keyboard.press('Control+z');
    await expect(box, 'Ctrl-Z restores the value from before the cut').toHaveValue(original);
    await page.keyboard.press('Tab');
    await expect(box, 'and it is committed, not just shown').toHaveValue(original);
    await expect(note(page)).toHaveCount(0);
  });
}
