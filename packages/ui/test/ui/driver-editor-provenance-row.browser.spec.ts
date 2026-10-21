import {driverEditorField, type EditorSkin, expect, openAMobileProject, openAProject, openDriverEditor, seedDriverInEditor, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';
import type {Page} from '@playwright/test';

/**
 * Inspect Provenance lights up the WHOLE ROW of every field that feeds the inspected one, label
 * through unit, full row width, as a background tint; not only the edge of the field box.
 * bugs/BUG_20261021_provenance-highlight-edge-only.md (John, 21 Oct 2026: "Can we try the
 * provenance dependencies light up the whole row not just the edge of the box").
 */

interface RowLook { fieldLeft: number; fieldRight: number; cellRight: number; background: string; borderColour: string; valueColour: string }

/** Measure one field: its box, where its cell ends (the next field in the same row, or the end of
 *  the row), its painted background and border, and the colour of its value text. */
async function look(page: Page, label: string): Promise<RowLook> {
  return driverEditorField(page, label).evaluate((fld): RowLook => {
    // The row is the nearest ancestor that paints a box: section wrappers use `display: contents`.
    let row = fld.parentElement!;
    while (getComputedStyle(row).display === 'contents') row = row.parentElement!;
    const rowStyle = getComputedStyle(row);
    const f = fld.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    const neighbours = Array.from(row.querySelectorAll('.de-fld'))
      .filter(o => o !== fld && !fld.contains(o))
      .map(o => o.getBoundingClientRect())
      .filter(o => Math.abs(o.top - f.top) < 4 && o.left > f.right - 1);
    const gap = parseFloat(rowStyle.columnGap) || 0;
    const cellRight = neighbours.length > 0
      ? Math.min(...neighbours.map(o => o.left)) - gap
      : r.right - parseFloat(rowStyle.paddingRight);
    const style = getComputedStyle(fld);
    return {
      fieldLeft: f.left, fieldRight: f.right, cellRight,
      background: style.backgroundColor,
      borderColour: style.borderTopColor,
      valueColour: getComputedStyle(fld.querySelector('input')!).color,
    };
  });
}

/** The Entered colour as the editor's key shows it: the desktop legend swatch, or the phone key strip's ■. */
async function enteredColour(page: Page, skin: EditorSkin): Promise<string> {
  return skin === 'phone'
    ? page.locator('.de-modal .mob-key-strip .mob-key-item.value-e .mob-key-sw').evaluate(el => getComputedStyle(el).color)
    : page.locator('.de-legend2 .de-sw.value-e').evaluate(el => getComputedStyle(el).backgroundColor);
}

/** Alpha of an rgb()/rgba() string. */
const alpha = (c: string) => (c.startsWith('rgba') ? parseFloat(c.split(',')[3]) : c === 'transparent' ? 0 : 1);

async function inspectQts(page: Page, skin: EditorSkin): Promise<void> {
  await seedDriverInEditor(page, skin);
  await page.locator('.de-provenance-chk', {hasText: 'Inspect Provenance'}).locator('input').check();
  await driverEditorField(page, 'Qts').locator('label').click();
  await expect(driverEditorField(page, 'Qes')).toHaveAttribute('style', /background-color/);
}

interface Measured { qes: RowLook; re: RowLook; legendValueE: string }

async function measure(page: Page, skin: EditorSkin): Promise<Measured> {
  return {qes: await look(page, 'Qes'), re: await look(page, 'Re'), legendValueE: await enteredColour(page, skin)};
}

/** The pass condition, as expectations over the measurements. */
function expectWholeRowTint({qes, re, legendValueE}: Measured): void {
  expect(alpha(qes.background), `Qes feeds Qts: background ${qes.background}`).toBeGreaterThanOrEqual(0.25);
  const pathColour = qes.background.replace(/rgba\((.*), [\d.]+\)/, 'rgb($1)');
  expect(qes.borderColour, 'the tint is the highlight, not a coloured edge').not.toBe(pathColour);
  expect(qes.fieldRight, 'tint spans the whole row cell, label through unit').toBeGreaterThanOrEqual(qes.cellRight - 1);
  expect(alpha(re.background), `Re does not feed Qts: background ${re.background}`).toBe(0);
  expect(qes.valueColour, 'value text keeps its Entered colour').toBe(legendValueE);
}

test.describe('Inspect Provenance tints the whole row', () => {
  test('desktop: a field feeding the inspected one is tinted across the full row', async ({page}) => {
    await page.setViewportSize({width: 1280, height: 800});
    await page.goto('/');
    await openAProject(page);
    await openDriverEditor(page);
    await inspectQts(page, 'desktop');
    const measured = await measure(page, 'desktop');
    expect(measured.qes.fieldRight).toBeGreaterThan(measured.qes.fieldLeft);
    expectWholeRowTint(measured);
  });

  test('phone: a field feeding the inspected one is tinted across the full row', async ({page}) => {
    await page.setViewportSize(PIXEL_9);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Driver'}).click();
    await page.getByText('Edit', {exact: true}).click();
    await expect(page.locator('.de-modal')).toBeVisible();
    await inspectQts(page, 'phone');
    const measured = await measure(page, 'phone');
    expect(measured.qes.fieldRight).toBeGreaterThan(measured.qes.fieldLeft);
    expectWholeRowTint(measured);
  });
});
