import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';
import {ChartPageSizes} from '@openisd/design/fields';

/**
 * The two mobile bottom sheets, Tune and What-if, on every phone size: each keeps one fixed height
 * while open (an edit never resizes it), the chart keeps 120 px, nothing overflows sideways, and
 * on a screen too short for the rows they scroll inside the sheet (never shrunk away, never
 * clipped: every row can be scrolled fully into view and Close stays on screen). A sheet stops
 * growing at ChartPageSizes' cap (250 px, the classic mock) and its rows scroll below that.
 */
const MIN_CHART_PX = 120;
/** How far the rows may overflow their box: not at all, unless the chart is held at its 120 px floor
 *  or the sheet has reached its cap. */
async function allowedRowsOverflow(page: Page): Promise<number> {
  const chart = await page.locator('.mob-chart-cell .gpanel').first().evaluate(el => el.getBoundingClientRect().height);
  const sheet = await page.locator('.mob-sheet').evaluate(el => el.getBoundingClientRect().height);
  const capped = sheet >= ChartPageSizes.CLASSIC.values.sheetMaxPx - 1;
  return chart > MIN_CHART_PX + 1 && !capped ? 0 : Number.POSITIVE_INFINITY;
}
async function chartHeight(page: Page): Promise<number> {
  return page.locator('.mob-chart-cell .gpanel').first().evaluate(el => el.getBoundingClientRect().height);
}
async function selectRectangularTwoVents(page: Page): Promise<void> {
  const select = (label: string) => page.locator('.mob-crow', {hasText: label}).first().locator('select');
  await select('Number of Vents').selectOption('2');
  await select('Shape').selectOption('slotted');
}
async function selectTwoRadiators(page: Page): Promise<void> {
  await page.locator('#mob-pr-count').selectOption('2');
}
import {PHONE_SIZES} from '../fixtures/phoneSizes.js';

const BOXES = [
  {type: 'vented', tuneRows: 5, whatIfRows: 9, setup: selectRectangularTwoVents},
  {type: 'box-passive-radiator', tuneRows: 5, whatIfRows: 9, setup: selectTwoRadiators},
  {type: 'abc', tuneRows: 8, whatIfRows: 12, setup: selectRectangularTwoVents},
];
const SHEETS = [
  {name: 'Tune', rows: (b: typeof BOXES[number]) => b.tuneRows},
  {name: 'What-if', rows: (b: typeof BOXES[number]) => b.whatIfRows},
];

for (const size of PHONE_SIZES) for (const box of BOXES) for (const sheetKind of SHEETS) {
  test(`${box.type} ${sheetKind.name} sheet: fixed height, chart kept, nothing clipped at ${size.width}×${size.height}`, async ({page}) => {
    await page.setViewportSize(size);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption(box.type);
    await box.setup(page);
    await page.locator('.mob-tab', {hasText: 'Graph'}).click();
    await page.getByRole('button', {name: `Open ${sheetKind.name}`}).click();

    const sheet = page.locator('.mob-sheet');
    await expect(sheet).toBeVisible();
    const rows = page.locator('.mob-sheet-rows');
    await expect(page.locator('.mob-sheet-cell')).toHaveCount(sheetKind.rows(box));

    const vertical = await rows.evaluate(el => ({scroll: el.scrollHeight, client: el.clientHeight}));
    expect(vertical.scroll - vertical.client, `rows scroll by ${vertical.scroll - vertical.client}px`).toBeLessThanOrEqual(await allowedRowsOverflow(page));
    const horizontal = await rows.evaluate(el => ({scroll: el.scrollWidth, client: el.clientWidth}));
    expect(horizontal.scroll, `rows overflow sideways by ${horizontal.scroll - horizontal.client}px`).toBeLessThanOrEqual(horizontal.client);
    const linesFit = await page.locator('.mob-sheet-line').evaluateAll(els => els.map(e => e.scrollWidth <= e.clientWidth));
    expect(linesFit.every(Boolean)).toBe(true);
    expect(await chartHeight(page)).toBeGreaterThanOrEqual(MIN_CHART_PX);

    // Close stays on the screen.
    const closeRect = await sheet.getByRole('button', {name: 'Close'}).evaluate(el => el.getBoundingClientRect());
    expect(closeRect.bottom).toBeLessThanOrEqual(size.height);
    expect(closeRect.right).toBeLessThanOrEqual(size.width);

    // Every row can be scrolled fully into the rows box.
    const last = page.locator('.mob-sheet-cell').last();
    await last.scrollIntoViewIfNeeded();
    const lastBottom = await last.evaluate(el => el.getBoundingClientRect().bottom);
    const rowsBottom = await rows.evaluate(el => el.getBoundingClientRect().bottom);
    expect(lastBottom).toBeLessThanOrEqual(rowsBottom + 1);
    await page.locator('.mob-sheet-cell').first().scrollIntoViewIfNeeded();

    // An edit never resizes the sheet.
    const before = await sheet.evaluate(el => el.getBoundingClientRect().height);
    await page.locator('.mob-sheet-cell').first().getByTitle('Increase').click();
    expect(await sheet.evaluate(el => el.getBoundingClientRect().height)).toBe(before);
    expect(await chartHeight(page)).toBeGreaterThanOrEqual(MIN_CHART_PX);
  });
}
