/**
 * Options, Plot Window (phone): the "Air speed limit" picker colours the port air speed limit line,
 * and the "Selected range" picker colours the shading of a dragged frequency range (T539).
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

/** A green nothing else on the chart uses. */
const CHOSEN = '#00c000';
const CANVAS = '.mob-chart-cell canvas';

/** Pixels on the chart canvas within a few levels of CHOSEN, at any opacity above `minAlpha`. */
const chosenPixels = (page: Page, minAlpha: number) => page.evaluate(({selector, alpha}) => {
  const c = document.querySelector<HTMLCanvasElement>(selector);
  const g = c?.getContext('2d');
  if (!c || !g || c.width === 0) return 0;
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > alpha && d[i] < 40 && d[i + 1] > 120 && d[i + 1] < 230 && d[i + 2] < 40) n++;
  return n;
}, {selector: CANVAS, alpha: minAlpha});

async function openPhoneChart(page: Page, chartName: string): Promise<void> {
  await page.setViewportSize(PIXEL_9);
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  await page.locator('.mob-chart-pick').click();
  await page.locator('.mob-chart-row .mob-chart-name', {hasText: new RegExp(`^${chartName}$`)}).click();
}

async function chooseColour(page: Page, label: string): Promise<void> {
  await page.getByRole('button', {name: 'Menu'}).click();
  await page.locator('.mob-menu-item', {hasText: 'Options'}).click();
  await page.locator('.opt-tab, .opt-phone-tabs button', {hasText: 'Plot Window'}).click();
  await page.locator('.mob-dcolor-row', {hasText: label}).locator('input[type=color]').fill(CHOSEN);
  await page.getByTestId('settings-apply').click();
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
}

test('phone: the Air speed limit picker colours the limit line on the rear port air velocity chart', async ({page}) => {
  await openPhoneChart(page, 'Rear port - Air velocity');
  await expect.poll(() => chosenPixels(page, 200)).toBe(0);
  await chooseColour(page, 'Air speed limit');
  await expect.poll(() => chosenPixels(page, 200)).toBeGreaterThan(50);
});

test('phone: the Selected range picker colours the dragged range on the transfer function chart', async ({page}) => {
  await openPhoneChart(page, 'Transfer function magnitude');
  await chooseColour(page, 'Selected range');
  const box = await page.locator(CANVAS).boundingBox();
  expect(box).not.toBeNull();
  const {x, y, width, height} = box ?? {x: 0, y: 0, width: 0, height: 0};
  await page.mouse.move(x + width * 0.35, y + height * 0.5);
  await page.mouse.down();
  await page.mouse.move(x + width * 0.7, y + height * 0.5, {steps: 8});
  await page.mouse.up();
  await expect.poll(() => chosenPixels(page, 5)).toBeGreaterThan(500);
});

test('phone: with nothing chosen, the swatches show the colours the charts draw', async ({page}) => {
  await openPhoneChart(page, 'Rear port - Air velocity');
  await page.getByRole('button', {name: 'Menu'}).click();
  await page.locator('.mob-menu-item', {hasText: 'Options'}).click();
  await page.locator('.opt-tab, .opt-phone-tabs button', {hasText: 'Plot Window'}).click();
  const swatch = (label: string) => page.locator('.mob-dcolor-row', {hasText: label}).locator('input[type=color]');
  await expect(swatch('Air speed limit')).toHaveValue('#ff6b6b');
  await expect(swatch('Selected range')).toHaveValue('#000000');
});
