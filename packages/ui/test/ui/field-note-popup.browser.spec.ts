/**
 * A field's note (the data-quality reason behind the ⚠ glyph, or a refused entry) is a popup, never
 * part of the grid (John, 8 Nov 2026: "all /!\ to use a popup so that view corruption and mangling
 * (pushing out of way) cannot occur"). Opening one changes neither its row's box nor the dialog's width.
 * bugs/BUG_20261108_driver-editor-warning-note-widens-grid-boxes-off-screen.md
 */
import {expect, openAProject, setFocusedBoxType, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {COMPLETE_DRIVER_PROJECT_OWPR, ensureSampleProject} from '../fixtures/sampleProject.js';
import {PageOps} from '../fixtures/numField.js';

ensureSampleProject();

/** BL typed as 3 T·m on the demo driver: Qes, Fs, Mms, Re and BL no longer agree. */
const IMPOSSIBLE_BL = '3';

const rowBox = async (row: Locator) => {
  const box = await row.boundingBox();
  expect(box).not.toBeNull();
  return {width: box?.width, height: box?.height};
};

async function openEditorParameters(page: Page) {
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  await page.locator('.edit-btn', {hasText: 'Edit'}).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  await page.getByRole('button', {name: 'Parameters', exact: true}).click();
}

const editorField = (page: Page, label: string) =>
  page.locator('.de-modal .de-fld', {has: page.locator('label', {hasText: new RegExp(`^${label}\\b`)})});

test('driver editor: the Qes warning glyph opens a popup; the row, the dialog width and the boxes do not move', async ({page}) => {
  await openEditorParameters(page);
  const bl = editorField(page, 'BL').locator('input').first();
  await bl.click();
  await bl.press('Control+a');
  await bl.pressSequentially(IMPOSSIBLE_BL);
  await bl.blur();

  const qes = editorField(page, 'Qes');
  const input = qes.locator('input').first();
  const modal = page.locator('.de-modal');
  const rowBefore = await rowBox(qes);
  const modalWidthBefore = (await modal.boundingBox())?.width;

  await qes.locator('.ui-field-dq-btn').click();
  const note = qes.locator('.ui-field-note');
  await expect(note).toBeVisible();
  await expect(note).toContainText('disagree by');

  expect(await rowBox(qes)).toEqual(rowBefore);
  expect((await modal.boundingBox())?.width).toBe(modalWidthBefore);
  const [scrollWidth, clientWidth] = await modal.evaluate(el => [el.scrollWidth, el.clientWidth]);
  expect(scrollWidth).toBe(clientWidth);
  const inputRight = (await input.boundingBox())?.x;
  const modalRight = (await modal.boundingBox());
  expect((inputRight ?? Infinity) + 90).toBeLessThanOrEqual((modalRight?.x ?? 0) + (modalRight?.width ?? 0));
});

test('Vented tab: a refused Fb shows its message in a popup and the row keeps its box', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await setFocusedBoxType(page, 'vented');
  await new PageOps(page).setNum('#og-fb-target', '40');

  const fb = page.locator('.ui-field', {has: page.locator('#og-fb-target')});
  const rowBefore = await rowBox(fb);
  const box = fb.locator('input');
  await box.fill('-');
  const note = fb.locator('.ui-field-note');
  await expect(note).toBeVisible();
  await expect(note).toContainText('Tuning freq');
  expect(await rowBox(fb)).toEqual(rowBefore);
});

test('Vented tab: the popup closes on the glyph, on Esc and on a click outside, and the box stays red', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await setFocusedBoxType(page, 'vented');
  await new PageOps(page).setNum('#og-fb-target', '40');

  const fb = page.locator('.ui-field', {has: page.locator('#og-fb-target')});
  const note = fb.locator('.ui-field-note');
  const glyph = fb.locator('.ui-field-dq-btn');
  await fb.locator('input').fill('-');
  await expect(note).toBeVisible();

  await glyph.click();
  await expect(note).toBeHidden();
  await glyph.click();
  await expect(note).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(note).toBeHidden();
  await glyph.click();
  await expect(note).toBeVisible();
  await page.locator('body').click({position: {x: 2, y: 2}});
  await expect(note).toBeHidden();
  await expect(fb.locator('input')).toHaveClass(/inp-bad/);
});

/** The popup's box and a container's box, both read from the page. */
async function insideContainer(inner: Locator, outer: Locator) {
  const note = await inner.boundingBox();
  const frame = await outer.boundingBox();
  expect(note).not.toBeNull();
  expect(frame).not.toBeNull();
  return {
    left: (note?.x ?? 0) - (frame?.x ?? 0),
    top: (note?.y ?? 0) - (frame?.y ?? 0),
    right: (frame?.x ?? 0) + (frame?.width ?? 0) - ((note?.x ?? 0) + (note?.width ?? 0)),
    bottom: (frame?.y ?? 0) + (frame?.height ?? 0) - ((note?.y ?? 0) + (note?.height ?? 0)),
  };
}

for (const label of ['Fs', 'Re', 'Mms']) {
  test(`driver editor: the ${label} warning popup stays inside the window and the dialog`, async ({page}) => {
    await page.setViewportSize({width: 1366, height: 900});
    await openEditorParameters(page);
    const bl = editorField(page, 'BL').locator('input').first();
    await bl.click();
    await bl.press('Control+a');
    await bl.pressSequentially(IMPOSSIBLE_BL);
    await bl.blur();

    const field = editorField(page, label);
    await field.locator('.ui-field-dq-btn').click();
    const note = field.locator('.ui-field-note');
    await expect(note).toBeVisible();
    await expect.poll(async () => Object.values(await insideContainer(note, page.locator('body'))).every(gap => gap >= 0)).toBe(true);
    await expect.poll(async () => Object.values(await insideContainer(note, page.locator('.de-modal'))).every(gap => gap >= 0)).toBe(true);
  });
}

test('Vented tab: a refusal on a box at the bottom of a short window opens its popup above and inside the window', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await setFocusedBoxType(page, 'vented');
  await new PageOps(page).setNum('#og-fb-target', '40');
  const fb = page.locator('.ui-field', {has: page.locator('#og-fb-target')});
  const fbBox = await fb.boundingBox();
  expect(fbBox).not.toBeNull();
  await page.setViewportSize({width: 1366, height: Math.ceil((fbBox?.y ?? 0) + (fbBox?.height ?? 0) + 6)});
  await fb.locator('input').fill('-');
  const note = fb.locator('.ui-field-note');
  await expect(note).toBeVisible();
  await expect.poll(async () => Object.values(await insideContainer(note, page.locator('body'))).every(gap => gap >= 0)).toBe(true);
  await expect.poll(async () => (await note.boundingBox())?.y ?? Infinity).toBeLessThan(fbBox?.y ?? 0);
});

test('driver editor: the Qes popup closes when focus leaves the field (Shift+Tab to the previous box)', async ({page}) => {
  await openEditorParameters(page);
  const bl = editorField(page, 'BL').locator('input').first();
  await bl.click();
  await bl.press('Control+a');
  await bl.pressSequentially(IMPOSSIBLE_BL);
  await bl.blur();

  const qes = editorField(page, 'Qes');
  const glyph = qes.locator('.ui-field-dq-btn');
  await glyph.click();
  const note = qes.locator('.ui-field-note');
  await expect(note).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(note).toBeHidden();
});
