import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

/**
 * The mobile What-if? sheet is as tall as its rows need (rows at the phone row metrics, John,
 * 2026-10-15), so every vented field shows without scrolling.
 */
const SIZES = [{width: 390, height: 844}, {width: 412, height: 915}];

for (const size of SIZES) {
  test(`vented What-if: every field fits without scrolling at ${size.width}×${size.height}`, async ({page}) => {
    await page.setViewportSize(size);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption('vented');
    await page.locator('.mob-tab', {hasText: 'Graph'}).click();
    await page.getByRole('button', {name: 'Open What-if?'}).click();

    const rows = page.locator('.mob-what-if-rows');
    await expect(rows).toBeVisible();
    const {scroll, client} = await rows.evaluate(el => ({scroll: el.scrollHeight, client: el.clientHeight}));
    expect(scroll, `the What-if rows need ${scroll - client} px more than the sheet has`).toBeLessThanOrEqual(client);

    const heights = await page.locator('.mob-what-if-row').evaluateAll(els => els.map(e => e.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(40);
  });
}
