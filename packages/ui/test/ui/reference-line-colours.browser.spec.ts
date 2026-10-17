/**
 * Options, Plot Window: the "0 dB line" and "-3dB line" pickers colour those lines on the transfer
 * function chart, on both skins (BUG_20261018_options-0db-3db-colour-pickers-do-nothing).
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

/** A green nothing else on the chart uses. */
const CHOSEN = '#00c000';

/** Pixels on the chart canvas within a few levels of CHOSEN. */
const chosenPixels = (page: Page, canvas: string) => page.evaluate(selector => {
  const c = document.querySelector<HTMLCanvasElement>(selector);
  const g = c?.getContext('2d');
  if (!c || !g || c.width === 0) return 0;
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] < 40 && d[i + 1] > 160 && d[i + 1] < 230 && d[i + 2] < 40) n++;
  return n;
}, canvas);

async function chooseMinus3DbColour(page: Page): Promise<void> {
  await page.locator('.opt-tab', {hasText: 'Plot Window'}).click();
  await page.locator('.opt-color-row', {hasText: '-3dB line'}).locator('input[type=color]').fill(CHOSEN);
  await page.getByTestId('settings-apply').click();
}

test('desktop: the -3dB line picker colours the line on the transfer function chart', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.chart-select').click();
  await page.locator('.chart-select .menu-item', {hasText: /^Transfer function magnitude$/}).click();
  const canvas = '.graph-wrap canvas';
  await expect.poll(() => chosenPixels(page, canvas)).toBe(0);

  await page.locator('.tb-btn[title="Options"]').or(page.getByRole('button', {name: 'Options'})).first().click();
  await chooseMinus3DbColour(page);
  await expect.poll(() => chosenPixels(page, canvas)).toBeGreaterThan(50);
});

test('mobile: the -3dB line picker colours the line on the transfer function chart', async ({page}) => {
  await page.setViewportSize({width: 411, height: 923});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  await page.locator('.mob-chart-pick').click();
  await page.locator('.mob-chart-row .mob-chart-name', {hasText: /^Transfer function magnitude$/}).click();
  const canvas = '.mob-chart-cell canvas';
  await expect.poll(() => chosenPixels(page, canvas)).toBe(0);

  await page.getByRole('button', {name: 'Menu'}).click();
  await page.locator('.mob-menu-item', {hasText: 'Options'}).click();
  await chooseMinus3DbColour(page);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  await expect.poll(() => chosenPixels(page, canvas)).toBeGreaterThan(50);
});
