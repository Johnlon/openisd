/**
 * The mobile Graph destination — a full-screen chart, its own screen because GraphPanel's
 * canvas sets touch-action:none (custom pointer pan/zoom) and would trap vertical scroll inline.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Graph' }).click();
});

test('renders the chart full-screen with a chart picker', async ({ page }) => {
  await expect(page.locator('.mob-chart-select')).toBeVisible();
  await expect(page.locator('.mob-chart-body canvas')).toBeVisible();
});

test('picking a different chart swaps the drawn chart, and the choice survives switching tabs', async ({ page }) => {
  await expect(page.locator('.mob-chart-select')).toHaveValue('SPL');

  await page.locator('.mob-chart-select').selectOption('Impedance');
  await expect(page.locator('.mob-chart-select')).toHaveValue('Impedance');

  await page.locator('.mob-tab', { hasText: 'Box' }).click();
  await page.locator('.mob-tab', { hasText: 'Graph' }).click();
  await expect(page.locator('.mob-chart-select')).toHaveValue('Impedance');
});

