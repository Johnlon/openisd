/**
 * Phone Graph: Auto Y lives in the Tune and What-if sheet footer (QO267 mock), never over the chart, so it
 * cannot cover the first frequency label (bug auto-y-overlaps-first-frequency-label). The desktop switch
 * stays on the chart (original-chart-auto-y.browser.spec.ts).
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';
import type {Page} from '@playwright/test';

test.use({viewport: {width: PIXEL_9.width, height: PIXEL_9.height}});

async function openGraph(page: Page) {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  const panel = page.locator('.mob-chart-cell .gpanel').first();
  await expect(panel).not.toHaveAttribute('data-y-range', '');
  return panel;
}

for (const [sheetName, hasReset] of [['Tune', false], ['What-if', true]] as const) {
  test(`${sheetName} sheet: Auto Y is in the footer, not on the chart, and frees and fixes the Y scale`, async ({page}) => {
    const panel = await openGraph(page);
    await page.getByRole('button', {name: `Open ${sheetName}`}).click();
    const sheet = page.locator('.mob-sheet');
    await expect(sheet).toBeVisible();

    await expect(panel.getByRole('checkbox', {name: 'Auto Y'})).toHaveCount(0);
    const foot = sheet.locator('.mob-sheet-foot');
    const box = foot.getByRole('checkbox', {name: 'Auto Y'});
    await expect(box).toBeChecked();
    await expect(foot.getByRole('button', {name: 'Reset'})).toHaveCount(hasReset ? 1 : 0);
    await expect(foot.getByRole('button', {name: 'Close'})).toBeVisible();

    // The tap target is 44 px tall.
    const row = await foot.locator('label', {hasText: 'Auto Y'}).boundingBox();
    expect(row?.height ?? 0).toBeGreaterThanOrEqual(44);

    // Nothing sits over the chart's bottom-left corner (where the first frequency label "10" is drawn).
    const covered = await panel.evaluate(el => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + 12, r.bottom - 8);
      return hit !== null && !el.contains(hit) ? hit.className : '';
    });
    expect(covered).toBe('');

    // Unticking holds the Y range drawn now; ticking frees it again.
    const yRange = (await panel.getAttribute('data-y-range')) ?? '';
    await box.uncheck();
    await expect(box).not.toBeChecked();
    await expect(panel).toHaveAttribute('data-y-range', yRange);
    await box.check();
    await expect(box).toBeChecked();
  });
}

test('Tune sheet: with Auto Y unticked an edit leaves the Y range, ticked it rescales', async ({page}) => {
  const panel = await openGraph(page);
  await page.getByRole('button', {name: 'Open Tune'}).click();
  const sheet = page.locator('.mob-sheet');
  const box = sheet.getByRole('checkbox', {name: 'Auto Y'});
  const cell = sheet.locator('.mob-sheet-cell', {has: page.locator('.mob-sheet-label', {hasText: 'Box volume'})});
  const before = (await panel.getAttribute('data-y-range')) ?? '';
  await box.uncheck();
  for (let i = 0; i < 12; i++) await cell.getByTitle('Increase').click();
  await expect(panel).toHaveAttribute('data-y-range', before);
  await box.check();
  await expect.poll(() => panel.getAttribute('data-y-range')).not.toBe(before);
});
