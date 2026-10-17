import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';

/**
 * The mobile bottom sheet (Tune and Learn modes): rows fit without scrolling, horizontal layout
 * fits without overflow, and sheet height is identical in Tune and Learn so the chart never moves
 * on a mode switch.
 */
async function selectRectangularTwoVents(page: Page): Promise<void> {
  const selects = page.locator('.mob-content select.mob-select');
  await selects.nth(0).selectOption('2');
  await selects.nth(1).selectOption('slotted');
}
async function selectTwoRadiators(page: Page): Promise<void> {
  await page.locator('#mob-pr-count').selectOption('2');
}
import {PHONE_SIZES} from '../fixtures/phoneSizes.js';

const BOXES = [
  {type: 'sealed', tab: 'Box', tuneLines: 2, learnRows: 6, setup: async () => {}},
  {type: 'vented', tab: 'Vented', tuneLines: 3, learnRows: 8, setup: selectRectangularTwoVents},
  {type: 'box-passive-radiator', tab: 'Passive Radiator', tuneLines: 3, learnRows: 8, setup: selectTwoRadiators},
  {type: 'bandpass4', tab: '4th Order Bandpass', tuneLines: 3, learnRows: 9, setup: selectRectangularTwoVents},
  {type: 'bandpass6', tab: '6th Order Bandpass', tuneLines: 4, learnRows: 10, setup: selectRectangularTwoVents},
  {type: 'abc', tab: 'ABC', tuneLines: 5, learnRows: 11, setup: selectRectangularTwoVents},
];

for (const size of PHONE_SIZES) for (const {type, tab, tuneLines, learnRows, setup} of BOXES) {
  test(`${type} sheet: fits without scrolling or overflow in Tune and Learn at ${size.width}×${size.height}`, async ({page}) => {
    await page.setViewportSize(size);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption(type);
    await page.locator('.mob-tab', {hasText: tab}).first().click();
    await setup(page);
    await page.locator('.mob-tab', {hasText: 'Graph'}).click();
    await page.getByRole('button', {name: 'Open Tune'}).click();

    const sheet = page.locator('.mob-sheet');
    await expect(sheet).toBeVisible();
    const rows = page.locator('.mob-sheet-rows');
    await expect(rows).toBeVisible();

    // Tune mode: no vertical scroll, no horizontal overflow
    const tuneScroll = await rows.evaluate(el => ({scroll: el.scrollHeight, client: el.clientHeight}));
    expect(tuneScroll.scroll, `Tune rows vertically scroll by ${tuneScroll.scroll - tuneScroll.client}px`).toBeLessThanOrEqual(tuneScroll.client);

    const tuneHScroll = await rows.evaluate(el => ({scroll: el.scrollWidth, client: el.clientWidth}));
    expect(tuneHScroll.scroll, `Tune rows horizontally overflow by ${tuneHScroll.scroll - tuneHScroll.client}px`).toBeLessThanOrEqual(tuneHScroll.client);

    const tuneLinesOverflow = await page.locator('.mob-sheet-line').evaluateAll(els => els.map(e => e.scrollWidth <= e.clientWidth));
    expect(tuneLinesOverflow.every(Boolean)).toBe(true);

    await expect(page.locator('.mob-sheet-line')).toHaveCount(tuneLines);

    const tuneHeight = await sheet.evaluate(el => el.getBoundingClientRect().height);
    const tuneChartHeight = await page.locator('.mob-chart-cell .gpanel').first().evaluate(el => el.getBoundingClientRect().height);
    expect(tuneChartHeight).toBeGreaterThanOrEqual(120);

    // Switch to Learn mode
    await page.locator('.mob-sheet-modes').getByRole('button', {name: 'Learn'}).click();
    await expect(page.locator('.mob-sheet-learn')).toBeVisible();

    const learnScroll = await rows.evaluate(el => ({scroll: el.scrollHeight, client: el.clientHeight}));
    expect(learnScroll.scroll, `Learn rows vertically scroll by ${learnScroll.scroll - learnScroll.client}px`).toBeLessThanOrEqual(learnScroll.client);

    const learnHScroll = await rows.evaluate(el => ({scroll: el.scrollWidth, client: el.clientWidth}));
    expect(learnHScroll.scroll, `Learn rows horizontally overflow by ${learnHScroll.scroll - learnHScroll.client}px`).toBeLessThanOrEqual(learnHScroll.client);

    await expect(page.locator('.mob-sheet-cell')).toHaveCount(learnRows);

    const learnHeight = await sheet.evaluate(el => el.getBoundingClientRect().height);
    expect(Math.round(learnHeight)).toBe(Math.round(tuneHeight));

    const learnChartHeight = await page.locator('.mob-chart-cell .gpanel').first().evaluate(el => el.getBoundingClientRect().height);
    expect(learnChartHeight).toBeGreaterThanOrEqual(120);
  });
}
