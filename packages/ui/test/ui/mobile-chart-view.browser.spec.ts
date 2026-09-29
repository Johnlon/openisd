/**
 * The mobile Graph destination — the project's open charts, one filling the screen or several
 * stacked in a list that scrolls up and down. A vertical swipe over a stacked chart scrolls the
 * list; a sideways drag moves the cursor.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Graph' }).click();
});

const pickerRow = (page: Page, name: string) =>
  page.locator('.mob-chart-row').filter({ has: page.locator('.mob-chart-name', { hasText: new RegExp(`^${name}$`) }) });

test('one chart fills the screen, with a chart picker', async ({ page }) => {
  await expect(page.locator('.mob-chart-pick')).toHaveText(/SPL/);
  await expect(page.locator('.mob-chart-cell')).toHaveCount(1);
  const [cell, stack] = await Promise.all(['.mob-chart-cell', '.mob-chart-stack'].map(s =>
    page.locator(s).evaluate(e => e.getBoundingClientRect().height)));
  expect(cell).toBeGreaterThan(stack - 2);
});

test('ticking charts stacks them in a list that scrolls up and down', async ({ page }) => {
  await page.locator('.mob-chart-pick').click();
  await pickerRow(page, 'Cone excursion').locator('input[type=checkbox]').click();
  await pickerRow(page, 'Impedance').locator('input[type=checkbox]').click();
  await expect(page.locator('.mob-chart-list')).toBeVisible(); // ticking leaves the list open
  await page.locator('.mob-chart-pick').click();

  await expect(page.locator('.mob-chart-cell')).toHaveCount(3);
  const stack = page.locator('.mob-chart-stack');
  const { scrollHeight, clientHeight } = await stack.evaluate(e => ({ scrollHeight: e.scrollHeight, clientHeight: e.clientHeight }));
  expect(scrollHeight).toBeGreaterThan(clientHeight);
  await stack.evaluate(e => { e.scrollTop = e.scrollHeight; });
  await expect(page.locator('.mob-chart-cell').last().locator('canvas')).toBeInViewport();
});

test('the per-screen number sizes each stacked chart to a whole fraction of the screen', async ({ page }) => {
  await page.locator('.mob-chart-pick').click();
  await pickerRow(page, 'Cone excursion').locator('input[type=checkbox]').click();
  await pickerRow(page, 'Impedance').locator('input[type=checkbox]').click();
  await page.locator('.mob-chart-pick').click();

  const heights = () => Promise.all(['.mob-chart-cell', '.mob-chart-stack'].map(s =>
    page.locator(s).first().evaluate(e => e.getBoundingClientRect().height)));
  const select = page.getByLabel('Charts per screen');
  for (const n of [2, 3, 1]) {
    await select.selectOption(String(n));
    await expect.poll(async () => { const [cell, stack] = await heights(); return Math.round(cell * n / stack * 100); })
      .toBeGreaterThanOrEqual(98);
    const [cell, stack] = await heights();
    expect(cell * n).toBeLessThanOrEqual(stack + 2);
  }
});

test('tapping a chart name shows it alone, and the choice survives switching tabs', async ({ page }) => {
  await page.locator('.mob-chart-pick').click();
  await pickerRow(page, 'Impedance').locator('.mob-chart-name').click();
  await expect(page.locator('.mob-chart-list')).toHaveCount(0);
  await expect(page.locator('.mob-chart-cell')).toHaveCount(1);
  await expect(page.locator('.mob-chart-pick')).toHaveText(/Impedance/);

  await page.locator('.mob-tab', { hasText: 'Box' }).click();
  await page.locator('.mob-tab', { hasText: 'Graph' }).click();
  await expect(page.locator('.mob-chart-pick')).toHaveText(/Impedance/);
});
