/**
 * Options, Plot Window (desktop): the two rows the phone already had, "Air speed limit" and "Selected range" (T555).
 * They sit after Cursor lines, colour the port air speed limit line and the dragged range's shading,
 * and their reset button brings the default back.
 */
import type {Page} from '@playwright/test';
import {expect, openAProject, test} from '../fixtures.js';

/** A green nothing else on the chart uses. */
const CHOSEN = '#00c000';
const CANVAS = '.gpanel canvas';
const ROW_LABELS = ['0 dB line', '-3dB line', 'Background', 'Other lines', 'Labels', 'Xmax limit', 'Cursor lines', 'Air speed limit', 'Selected range'];

const chosenPixels = (page: Page, minAlpha: number) => page.evaluate(({selector, alpha}) => {
  const c = document.querySelector<HTMLCanvasElement>(selector);
  const g = c?.getContext('2d');
  if (!c || !g || c.width === 0) return 0;
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > alpha && d[i] < 40 && d[i + 1] > 120 && d[i + 1] < 230 && d[i + 2] < 40) n++;
  return n;
}, {selector: CANVAS, alpha: minAlpha});

async function openChart(page: Page, chartName: string): Promise<void> {
  await page.setViewportSize({width: 1280, height: 800});
  await page.goto('/');
  await openAProject(page);
  await page.locator('.chart-select').click();
  await page.locator('.chart-select .menu-item', {hasText: new RegExp(`^${chartName}$`)}).click();
  await expect(page.locator(CANVAS).first()).toBeVisible();
}

async function openPlotWindowOptions(page: Page): Promise<void> {
  await page.getByTitle('Options', {exact: true}).click();
  await page.locator('.opt-tab', {hasText: 'Plot Window'}).click();
}

const row = (page: Page, label: string) => page.locator('.opt-color-row', {has: page.locator('label', {hasText: new RegExp(`^${label}$`)})});

test('desktop Options lists the nine colour rows, the two newest after Cursor lines', async ({page}) => {
  await openChart(page, 'Rear port - Air velocity');
  await openPlotWindowOptions(page);
  await expect(page.locator('.opt-color-row label')).toHaveText(ROW_LABELS);
});

test('desktop: the Air speed limit picker colours the limit line, and reset brings the default back', async ({page}) => {
  await openChart(page, 'Rear port - Air velocity');
  await expect.poll(() => chosenPixels(page, 200)).toBe(0);
  await openPlotWindowOptions(page);
  await expect(row(page, 'Air speed limit').locator('input[type=color]')).toHaveValue('#ff6b6b');
  await row(page, 'Air speed limit').locator('input[type=color]').fill(CHOSEN);
  await page.getByTestId('settings-apply').click();
  await expect.poll(() => chosenPixels(page, 200)).toBeGreaterThan(10);
  await openPlotWindowOptions(page);
  await row(page, 'Air speed limit').locator('.opt-clear-btn').click();
  await expect(row(page, 'Air speed limit').locator('input[type=color]')).toHaveValue('#ff6b6b');
  await page.getByTestId('settings-apply').click();
  await expect.poll(() => chosenPixels(page, 200)).toBe(0);
});

test('desktop: the Selected range picker colours the dragged range, and reset brings the default back', async ({page}) => {
  await openChart(page, 'Transfer function magnitude');
  await openPlotWindowOptions(page);
  await expect(row(page, 'Selected range').locator('input[type=color]')).toHaveValue('#000000');
  await row(page, 'Selected range').locator('input[type=color]').fill(CHOSEN);
  await page.getByTestId('settings-apply').click();
  const box = await page.locator(CANVAS).first().boundingBox();
  expect(box).not.toBeNull();
  const {x, y, width, height} = box ?? {x: 0, y: 0, width: 0, height: 0};
  await page.mouse.move(x + width * 0.35, y + height * 0.5);
  await page.mouse.down();
  await page.mouse.move(x + width * 0.7, y + height * 0.5, {steps: 8});
  await page.mouse.up();
  await expect.poll(() => chosenPixels(page, 5)).toBeGreaterThan(500);
  await openPlotWindowOptions(page);
  await row(page, 'Selected range').locator('.opt-clear-btn').click();
  await expect(row(page, 'Selected range').locator('input[type=color]')).toHaveValue('#000000');
});

for (const size of [{width: 1280, height: 800}, {width: 1024, height: 700}]) {
  test(`desktop ${size.width}x${size.height}: the Plot Window tab does not clip or scroll`, async ({page}) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await openAProject(page);
    await openPlotWindowOptions(page);
    const m = await page.evaluate(() => {
      const body = document.querySelector('.opt-body')!;
      const modal = document.querySelector('.opt-modal')!.getBoundingClientRect();
      const fs = document.querySelector('.opt-color-grid')!.closest('fieldset')!.getBoundingClientRect();
      const rows = Array.from(document.querySelectorAll('.opt-color-row')).map(r => r.getBoundingClientRect());
      const outside = rows.filter(r => r.right > fs.right || r.bottom > fs.bottom).length;
      return {vScroll: body.scrollHeight - body.clientHeight, hScroll: body.scrollWidth - body.clientWidth, outside, bottom: modal.bottom};
    });
    expect(m.outside).toBe(0);
    // Before the two rows were added the tab already scrolled by 76 px at 1024x700, and not at all at 1280x800.
    expect(m.vScroll).toBeLessThanOrEqual(size.height === 800 ? 0 : 76);
    expect(m.hScroll).toBeLessThanOrEqual(0);
    expect(m.bottom).toBeLessThanOrEqual(size.height);
  });
}
