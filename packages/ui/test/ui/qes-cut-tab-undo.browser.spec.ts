import {expect, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {clearWithKeyboard} from '../fixtures/numField.js';

/**
 * Ctrl-Z in a number box is the box's own one-step undo (John, 8 Nov 2026: "CTRL-Z doesn't work at
 * all now"): it puts back, and commits, the value from before the last edit.
 * Edit Driver, Parameters: a refused entry's red message sits inside its own field's row and
 * covers nothing (John, 8 Nov 2026, "serious ui bug ... its the error boxes"); and a typed value
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

test('two refused boxes at once (Qes and Vas) each keep their message in their own row at 2200 px', async ({page}) => {
  await openParameters(page);
  await page.setViewportSize({width: 2200, height: 900});
  const rows = [rowFor(page, 'Qes'), rowFor(page, 'Vas_m3')];
  for (const row of rows) {
    const input = row.locator('input').first();
    await clearWithKeyboard(input);
    await input.pressSequentially('.');
    await input.press('Tab');
    await expect(row.locator('.ui-field-note')).toBeVisible();
  }
  await page.screenshot({path: process.env.T727_SHOT_TWO ?? 'build/t727/two-refused.png'});
  const notes = await Promise.all(rows.map(r => box(r.locator('.ui-field-note'))));
  const rects = await Promise.all(rows.map(r => box(r)));
  notes.forEach((n, i) => {
    expect(n.y).toBeGreaterThanOrEqual(rects[i].y);
    expect(n.y + n.height).toBeLessThanOrEqual(rects[i].y + rects[i].height + 0.5);
  });
  expect(notes[0].y + notes[0].height, 'Qes message ends above Vas row').toBeLessThanOrEqual(rects[1].y + 0.5);
  const others = page.locator('.de-body .de-fld:visible:not([data-field-key="Qes"]):not([data-field-key="Vas_m3"])');
  const otherRects = await Promise.all((await others.all()).map(r => box(r)));
  const overlapping = otherRects.filter(b => notes.some(n => n.x < b.x + b.width && b.x < n.x + n.width && n.y < b.y + b.height && b.y < n.y + n.height));
  expect(overlapping, 'no message covers another row').toEqual([]);
});

const BOXES = [{key: 'Qes', name: 'Qes'}, {key: 'Vas_m3', name: 'Vas'}, {key: 'Mms_kg', name: 'Mms'}] as const;

for (const {key, name} of BOXES) {
  test(`a refused ${name} entry shows its message inside its own row and covers nothing`, async ({page}) => {
    await openParameters(page);
    const row = rowFor(page, key);
    const input = row.locator('input').first();
    await clearWithKeyboard(input);
    await input.pressSequentially('.');
    await input.press('Tab');
    const note = row.locator('.ui-field-note');
    await expect(note).toBeVisible();
    await page.screenshot({path: process.env[`T727_SHOT_${name}`] ?? `build/t727/run-${name}.png`});
    const n = await box(note);
    const r = await box(row);
    expect(n.y).toBeGreaterThanOrEqual(r.y);
    expect(n.y + n.height).toBeLessThanOrEqual(r.y + r.height + 0.5);
    expect(n.x).toBeGreaterThanOrEqual(r.x);
    expect(n.x + n.width).toBeLessThanOrEqual(r.x + r.width + 0.5);
    // Nothing else (any label, box, unit, other row) is drawn inside the note's rectangle.
    const covered = await page.evaluate(({x, y, w, h}) => {
      const hits = new Set<string>();
      for (const el of document.querySelectorAll('.de-body label, .de-body input, .de-body select, .de-body button, .de-body .ui-field-unit')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        if (x < b.right && b.left < x + w && y < b.bottom && b.top < y + h) hits.add(`${el.tagName} ${(el.textContent ?? '').trim().slice(0, 12)}`);
      }
      return [...hits];
    }, {x: n.x, y: n.y, w: n.width, h: n.height});
    expect(covered, 'controls under the note').toEqual([]);
    const top = await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.className ?? '', {x: n.x + n.width / 2, y: n.y + n.height / 2});
    expect(String(top)).toContain('ui-field-note');
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
