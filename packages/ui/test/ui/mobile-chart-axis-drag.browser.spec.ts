/**
 * Mobile Graph page — axis strip drag behaviour on phone viewport.
 * - With 2+ stacked charts: vertical touch drag on Y-axis strip (top/middle/bottom zones) changes
 *   that chart's Y range and does NOT scroll the stack.
 * - Vertical drag on X-axis strip does not scroll the stack.
 * - Vertical swipe on plot body DOES scroll the stack.
 * - With 1 chart: Y drag still works.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Graph' }).click();
});

function getYOverlay(page: Page, index: number) {
  return page.locator('.mob-chart-cell').nth(index).locator('.y-axis-overlay');
}

function getXOverlay(page: Page, index: number) {
  return page.locator('.mob-chart-cell').nth(index).locator('.x-axis-overlay');
}

async function getStackScrollTop(page: Page): Promise<number> {
  return page.evaluate(() => {
    const stack = document.querySelector('.mob-chart-stack');
    return stack instanceof HTMLElement ? stack.scrollTop : 0;
  });
}

async function getYRangeReadout(page: Page, chartIndex: number): Promise<string> {
  const panel = page.locator('.mob-chart-cell').nth(chartIndex).locator('.gpanel');
  const attr = await panel.getAttribute('data-y-range');
  return attr ?? '';
}

/** Whether the chart's Y range was set by hand: its panel then leaves Auto Y. */
async function yRangeIsManual(page: Page, chartIndex: number): Promise<boolean> {
  const panel = page.locator('.mob-chart-cell').nth(chartIndex).locator('.gpanel');
  return (await panel.getAttribute('class') ?? '').split(' ').includes('y-manual');
}

/**
 * Dispatch real touch drag via CDP to generate genuine browser Touch and Pointer events.
 */
async function touchDrag(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps = 10,
): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: Math.round(startX), y: Math.round(startY) }],
  });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(startX + (endX - startX) * t);
    const cy = Math.round(startY + (endY - startY) * t);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: cx, y: cy }],
    });
  }
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
}

test.describe('mobile stacked charts — axis strip drag', () => {
  test.beforeEach(async ({ page }) => {
    // Add 2 more charts to make 3 stacked
    await page.locator('.mob-chart-pick').click();
    await page.locator('.mob-chart-row').filter({ has: page.locator('.mob-chart-name', { hasText: /^Cone excursion$/ }) }).locator('input[type=checkbox]').click();
    await page.locator('.mob-chart-row').filter({ has: page.locator('.mob-chart-name', { hasText: /^Impedance$/ }) }).locator('input[type=checkbox]').click();
    await page.locator('.mob-chart-pick').click();
    await expect(page.locator('.mob-chart-cell')).toHaveCount(3);
  });

  test('vertical touch drag on Y-axis strip top zone zooms top — stack does not scroll', async ({ page }) => {
    const overlay = getYOverlay(page, 1);
    await expect(overlay).toBeVisible();
    const beforeReadout = await getYRangeReadout(page, 1);
    const beforeScroll = await getStackScrollTop(page);

    const box = (await overlay.boundingBox())!;
    const startX = box.x + box.width * 0.5;
    const startY = box.y + 0.1 * box.height;
    const endY = startY + 50;

    await touchDrag(page, startX, startY, startX, endY, 10);

    await expect.poll(async () => getYRangeReadout(page, 1)).not.toBe(beforeReadout);
    const afterManual = await yRangeIsManual(page, 1);
    const afterScroll = await getStackScrollTop(page);

    expect(afterScroll).toBe(beforeScroll);
    expect(afterManual, 'the Y range is now set by hand').toBe(true);
  });

  test('vertical touch drag on Y-axis strip middle zone pans — stack does not scroll', async ({ page }) => {
    const overlay = getYOverlay(page, 1);
    await expect(overlay).toBeVisible();
    const beforeReadout = await getYRangeReadout(page, 1);
    const beforeScroll = await getStackScrollTop(page);

    const box = (await overlay.boundingBox())!;
    const startX = box.x + box.width * 0.5;
    const startY = box.y + 0.5 * box.height;
    const endY = startY + 40;

    await touchDrag(page, startX, startY, startX, endY, 10);

    await expect.poll(async () => getYRangeReadout(page, 1)).not.toBe(beforeReadout);
    const afterManual = await yRangeIsManual(page, 1);
    const afterScroll = await getStackScrollTop(page);

    expect(afterScroll).toBe(beforeScroll);
    expect(afterManual, 'the Y range is now set by hand').toBe(true);
  });

  test('vertical touch drag on Y-axis strip bottom zone zooms bottom — stack does not scroll', async ({ page }) => {
    const overlay = getYOverlay(page, 1);
    await expect(overlay).toBeVisible();
    const beforeReadout = await getYRangeReadout(page, 1);
    const beforeScroll = await getStackScrollTop(page);

    const box = (await overlay.boundingBox())!;
    const startX = box.x + box.width * 0.5;
    const startY = box.y + 0.9 * box.height;
    const endY = startY - 50;

    await touchDrag(page, startX, startY, startX, endY, 10);

    await expect.poll(async () => getYRangeReadout(page, 1)).not.toBe(beforeReadout);
    const afterManual = await yRangeIsManual(page, 1);
    const afterScroll = await getStackScrollTop(page);

    expect(afterScroll).toBe(beforeScroll);
    expect(afterManual, 'the Y range is now set by hand').toBe(true);
  });

  test('vertical drag on X-axis strip does not scroll stack', async ({ page }) => {
    const overlay = getXOverlay(page, 1);
    await expect(overlay).toBeVisible();
    const beforeScroll = await getStackScrollTop(page);

    const box = (await overlay.boundingBox())!;
    const startX = box.x + box.width * 0.5;
    const startY = box.y + box.height * 0.5;
    const endY = startY - 30;

    await touchDrag(page, startX, startY, startX, endY, 10);

    const afterScroll = await getStackScrollTop(page);
    expect(afterScroll).toBe(beforeScroll);
  });

  test('vertical swipe on plot body scrolls the stack', async ({ page }) => {
    const canvas = page.locator('.mob-chart-cell').nth(1).locator('canvas');
    await expect(canvas).toBeVisible();
    const beforeScroll = await getStackScrollTop(page);

    const box = (await canvas.boundingBox())!;
    const startX = box.x + box.width * 0.6;
    const startY = box.y + box.height * 0.5;
    const endY = startY - 150;

    await touchDrag(page, startX, startY, startX, endY, 10);

    await expect.poll(async () => getStackScrollTop(page)).toBeGreaterThan(beforeScroll);
  });
});

test.describe('mobile single chart — axis strip drag still works', () => {
  test('vertical drag on Y-axis strip top zone zooms top', async ({ page }) => {
    await expect(page.locator('.mob-chart-cell')).toHaveCount(1);
    const overlay = getYOverlay(page, 0);
    await expect(overlay).toBeVisible();
    const beforeReadout = await getYRangeReadout(page, 0);

    const box = (await overlay.boundingBox())!;
    const startX = box.x + box.width * 0.5;
    const startY = box.y + 0.1 * box.height;
    const endY = startY + 50;

    await touchDrag(page, startX, startY, startX, endY, 10);

    await expect.poll(async () => getYRangeReadout(page, 0)).not.toBe(beforeReadout);
    const afterManual = await yRangeIsManual(page, 0);

    expect(afterManual, 'the Y range is now set by hand').toBe(true);
  });

  test('vertical drag on Y-axis strip middle zone pans', async ({ page }) => {
    await expect(page.locator('.mob-chart-cell')).toHaveCount(1);
    const overlay = getYOverlay(page, 0);
    await expect(overlay).toBeVisible();
    const beforeReadout = await getYRangeReadout(page, 0);

    const box = (await overlay.boundingBox())!;
    const startX = box.x + box.width * 0.5;
    const startY = box.y + 0.5 * box.height;
    const endY = startY + 40;

    await touchDrag(page, startX, startY, startX, endY, 10);

    await expect.poll(async () => getYRangeReadout(page, 0)).not.toBe(beforeReadout);
    const afterManual = await yRangeIsManual(page, 0);

    expect(afterManual, 'the Y range is now set by hand').toBe(true);
  });

  test('vertical drag on Y-axis strip bottom zone zooms bottom', async ({ page }) => {
    await expect(page.locator('.mob-chart-cell')).toHaveCount(1);
    const overlay = getYOverlay(page, 0);
    await expect(overlay).toBeVisible();
    const beforeReadout = await getYRangeReadout(page, 0);

    const box = (await overlay.boundingBox())!;
    const startX = box.x + box.width * 0.5;
    const startY = box.y + 0.9 * box.height;
    const endY = startY - 50;

    await touchDrag(page, startX, startY, startX, endY, 10);

    await expect.poll(async () => getYRangeReadout(page, 0)).not.toBe(beforeReadout);
    const afterManual = await yRangeIsManual(page, 0);

    expect(afterManual, 'the Y range is now set by hand').toBe(true);
  });
});