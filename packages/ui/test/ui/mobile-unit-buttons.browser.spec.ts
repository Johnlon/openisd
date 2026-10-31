/** Unit appearance comes from the selected reference; fixed labels and switchable controls
 * keep their distinct roles, and the unit cap stays joined to the numeric box. */
import {expect, openAMobileProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {referenceUnitPaint, measureUnitPaint} from '../fixtures/referenceUnitPaint.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({appPage: page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

/** What a user sees of a unit's chip: its fill, text colour, edge, size, weight and corner. */
function chip(unit: Locator): Promise<string[]> {
  return unit.evaluate(el => {
    const s = getComputedStyle(el);
    return [s.backgroundColor, s.color, s.borderLeftWidth, s.borderLeftColor, s.fontSize, s.fontWeight, s.borderTopRightRadius];
  });
}

/** The chip plus the dotted underline a rotating unit carries. */
async function look(unit: Locator): Promise<string[]> {
  return [...await chip(unit), await unit.evaluate(el => getComputedStyle(el).textDecorationLine)];
}

async function boxPageUnit(page: Page): Promise<Locator> {
  const unit = page.locator('.mob-classic .ui-field-unit.unit-toggle').first();
  await expect(unit).toBeVisible();
  await expect(unit).toHaveCSS('background-color', 'rgb(239, 239, 239)');
  return unit;
}

test.describe('phone unit buttons', () => {
  test('the Driver tab unit button looks like the Box page one', async ({appPage: page}) => {
    const box = await look(await boxPageUnit(page));
    await page.locator('.mob-tab', {hasText: 'Driver'}).click();
    const unit = page.locator('.mob-classic .ui-field-unit.unit-toggle').first();
    await expect(unit).toBeVisible();
    expect(await look(unit)).toEqual(box);
  });

  test('the Box vented alignment sheet unit buttons look like the Box page one', async ({appPage: page}) => {
    const box = await look(await boxPageUnit(page));
    await page.locator('.mob-clink', {hasText: 'Choose alignment'}).click();
    const units = page.locator('.mob-align-sheet .unit-toggle');
    await expect(units.first()).toBeVisible();
    for (const unit of await units.all()) expect(await look(unit)).toEqual(box);

    const fields = page.locator('.mob-align-sheet .ui-field');
    await expect(fields).toHaveCount(2);
    for (const field of await fields.all()) {
      const valueControl = field.locator('.ui-field-value input[readonly]');
      const unit = field.locator('.ui-field-unit.unit-toggle');
      await expect(valueControl).toBeVisible();
      await expect(unit).toBeVisible();
      const [controlBox, unitBox] = await Promise.all([valueControl.boundingBox(), unit.boundingBox()]);
      expect(controlBox, 'alignment value control must have layout geometry').not.toBeNull();
      expect(unitBox, 'alignment unit chip must have layout geometry').not.toBeNull();
      expect(unitBox!.x).toBe(controlBox!.x + controlBox!.width + (await referenceUnitPaint(page)).gap);
      expect(unitBox!.y).toBe(controlBox!.y);
      expect(unitBox!.height).toBe(controlBox!.height);
    }

    for (const field of await fields.all()) {
      const valueControl = field.locator('.ui-field-value input[readonly]');
      const unit = field.locator('.ui-field-unit.unit-toggle');
      const beforeUnit = (await unit.innerText()).trim();
      const beforeValue = Number(await valueControl.inputValue());
      await unit.click();
      await expect(unit).not.toHaveText(beforeUnit);
      const afterValue = Number(await valueControl.inputValue());
      expect(Number.isFinite(beforeValue) && Number.isFinite(afterValue)).toBe(true);
      expect(afterValue).not.toBe(beforeValue);
    }
  });

  test('the Box sealed alignment sheet unit button looks like the Box page one', async ({appPage: page}) => {
    await page.locator('#mob-box-type').selectOption('sealed');
    const box = await look(await boxPageUnit(page));
    await page.locator('.mob-clink', {hasText: 'Choose alignment'}).click();
    const units = page.locator('.mob-align-sheet .unit-toggle');
    await expect(units.first()).toBeVisible();
    for (const unit of await units.all()) expect(await look(unit)).toEqual(box);

    const field = page.locator('.mob-align-sheet .ui-field').first();
    const valueControl = field.locator('.ui-field-value input');
    const unit = field.locator('.ui-field-unit.unit-toggle');
    const [controlBox, unitBox] = await Promise.all([valueControl.boundingBox(), unit.boundingBox()]);
    expect(controlBox).not.toBeNull();
    expect(unitBox).not.toBeNull();
    expect(unitBox!.x).toBe(controlBox!.x + controlBox!.width + (await referenceUnitPaint(page)).gap);
    expect(unitBox!.y).toBe(controlBox!.y);
    expect(unitBox!.height).toBe(controlBox!.height);

    const beforeUnit = (await unit.innerText()).trim();
    const beforeValue = Number(await valueControl.inputValue());
    await unit.click();
    await expect(unit).not.toHaveText(beforeUnit);
    expect(Number(await valueControl.inputValue())).not.toBe(beforeValue);
  });

  test('the Signal tab fixed units (W, V, Ω) match the reference plain labels', async ({appPage: page}) => {
    await page.locator('.mob-tab', {hasText: 'Signal'}).click();
    const units = page.locator('.mob-classic .ui-field-unit:not(.unit-toggle)');
    await expect(units.first()).toBeVisible();
    const reference = await referenceUnitPaint(page);
    for (const unit of await units.all()) {
      expect(await unit.evaluate(measureUnitPaint)).toEqual(reference.fixed);
      await expect(unit).not.toHaveAttribute('role', 'button');
      await expect(unit).not.toHaveAttribute('tabindex');
      await expect(unit).toHaveCSS('text-decoration-line', 'none');
    }
  });
});
