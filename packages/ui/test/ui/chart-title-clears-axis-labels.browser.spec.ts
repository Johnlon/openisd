/**
 * A chart's title never sits on its tick labels (17 Oct 2026: on the phone Graph tab "SPL response" was drawn
 * over the top level label, 100). The labels are drawn on the canvas from `ChartLayout`; the title is a page
 * element. Its real box must end above the highest point the top level label can reach, on every chart, on
 * every phone size and on desktop. On the phone the title is the band over the chart (classic Graph page).
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PHONE_SIZES} from '../fixtures/phoneSizes.js';
import {ChartLayout} from '@openisd/design/chart';
import type {Locator} from '@playwright/test';

const LAYOUT = ChartLayout.CHART;

/** How far the title's bottom sits below the top of its chart's canvas. */
async function titleBottomInCanvas(panel: Locator, titleSel: string): Promise<number> {
  return panel.evaluate((el, sel) => {
    const title = el.querySelector(sel);
    const canvas = el.querySelector('canvas');
    if (!title || !canvas) throw new Error('the chart has no title or no canvas');
    return title.getBoundingClientRect().bottom - canvas.getBoundingClientRect().top;
  }, titleSel);
}

const DESKTOP_TITLE = '.gtitle';
const PHONE_TITLE = '.mob-band';

async function expectTitleClear(panel: Locator, what: string, titleSel: string): Promise<void> {
  const name = (await panel.locator(titleSel).first().textContent())?.trim();
  expect(await titleBottomInCanvas(panel, titleSel), `${what}: "${name}" runs into the top level label`)
    .toBeLessThanOrEqual(LAYOUT.levelLabelTopPx - LAYOUT.gapPx);
}

for (const size of PHONE_SIZES) {
  test(`phone ${size.width}×${size.height}: the chart title clears the tick labels`, async ({page}) => {
    await page.setViewportSize(size);
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await page.locator('.mob-tab', {hasText: 'Graph'}).click();
    const panel = page.locator('.mob-chart-cell').first();
    await expect(panel.locator('canvas')).toBeVisible();
    await expectTitleClear(panel, `${size.width}×${size.height}`, PHONE_TITLE);
  });
}

test('every chart title clears the tick labels on the narrowest phone', async ({page}) => {
  const narrowest = PHONE_SIZES.reduce((a, b) => (b.width < a.width ? b : a));
  await page.setViewportSize(narrowest);
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  await page.locator('.mob-chart-pick').click();
  const names = (await page.locator('.mob-chart-row .mob-chart-name').allTextContents()).map(n => n.trim());
  expect(names.length).toBeGreaterThan(5);
  await page.locator('.mob-chart-pick').click();
  for (const name of names) {
    await page.locator('.mob-chart-pick').click();
    await page.locator('.mob-chart-row .mob-chart-name', {hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)}).click();
    const panel = page.locator('.mob-chart-cell').first();
    await expect(panel.locator('canvas')).toBeVisible();
    await expectTitleClear(panel, name, PHONE_TITLE);
  }
});

test('desktop: the chart title clears the tick labels', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 800});
  await page.goto('/');
  await openAProject(page);
  const panel = page.locator('.gpanel').first();
  await expect(panel.locator('canvas')).toBeVisible();
  await expectTitleClear(panel, 'desktop', DESKTOP_TITLE);
});
