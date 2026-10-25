/**
 * Unit labels share bold typography. A switchable unit adds its grey control chip and blue underline;
 * a fixed unit stays a plain, light-grey label.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
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
  });

  test('the Box sealed alignment sheet unit button looks like the Box page one', async ({appPage: page}) => {
    await page.locator('#mob-box-type').selectOption('sealed');
    const box = await look(await boxPageUnit(page));
    await page.locator('.mob-clink', {hasText: 'Choose alignment'}).click();
    const units = page.locator('.mob-align-sheet .unit-toggle');
    await expect(units.first()).toBeVisible();
    for (const unit of await units.all()) expect(await look(unit)).toEqual(box);
  });

  test('the Signal tab fixed units (W, V, Ω) are bold labels, not controls', async ({appPage: page}) => {
    await page.locator('.mob-tab', {hasText: 'Signal'}).click();
    const units = page.locator('.mob-classic .ui-field-unit:not(.unit-toggle)');
    await expect(units.first()).toBeVisible();
    for (const unit of await units.all()) {
      expect(await chip(unit)).toEqual(['rgba(0, 0, 0, 0)', 'rgb(136, 136, 136)', '0px', 'rgb(136, 136, 136)', '13px', '600', '0px']);
      await expect(unit).toHaveCSS('text-decoration-line', 'none');
    }
  });
});
