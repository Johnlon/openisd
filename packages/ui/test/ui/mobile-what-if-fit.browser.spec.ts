import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';

/**
 * The mobile What-if? sheet is as tall as its rows need (rows at the phone row metrics, John,
 * 2026-10-15), so every vented field shows without scrolling.
 */
async function selectRectangularTwoVents(page: Page): Promise<void> {
  const selects = page.locator('.mob-content select.mob-select');
  await selects.nth(0).selectOption('2');
  await selects.nth(1).selectOption('slotted');
}
async function selectTwoRadiators(page: Page): Promise<void> {
  await page.locator('#mob-pr-count').selectOption('2');
}
const SIZES = [{width: 390, height: 844}, {width: 412, height: 915}];

// The box types, each with the most the What-if can list: the 4th-order bandpass has the most rows (9).
const BOXES = [
  {type: 'vented', tab: 'Vented', rows: 8, setup: selectRectangularTwoVents},
  {type: 'bandpass4', tab: '4th Order Bandpass', rows: 9, setup: selectRectangularTwoVents},
  {type: 'bandpass6', tab: '6th Order Bandpass', rows: 8, setup: selectRectangularTwoVents},
  {type: 'abc', tab: 'ABC', rows: 8, setup: selectRectangularTwoVents},
  {type: 'box-passive-radiator', tab: 'Passive Radiator', rows: 8, setup: selectTwoRadiators},
];

for (const size of SIZES) for (const {type, tab, rows: fieldCount, setup} of BOXES) {
  test(`${tab} What-if: every field fits without scrolling at ${size.width}×${size.height}`, async ({page}) => {
    await page.setViewportSize(size);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption(type);
    // A rectangular port and two vents change the Enclosure tab, not the What-if rows.
    await page.locator('.mob-tab', {hasText: tab}).first().click();
    await setup(page);
    await page.locator('.mob-tab', {hasText: 'Graph'}).click();
    await page.getByRole('button', {name: 'Open What-if?'}).click();

    const rows = page.locator('.mob-what-if-rows');
    await expect(rows).toBeVisible();
    const {scroll, client} = await rows.evaluate(el => ({scroll: el.scrollHeight, client: el.clientHeight}));
    expect(scroll, `the What-if rows need ${scroll - client} px more than the sheet has`).toBeLessThanOrEqual(client);

    await expect(page.locator('.mob-what-if-row')).toHaveCount(fieldCount);
    const heights = await page.locator('.mob-what-if-row').evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(40);
  });
}
