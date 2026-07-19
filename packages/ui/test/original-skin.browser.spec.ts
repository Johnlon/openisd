/**
 * Original (WinISD) skin — the fuller recreation ported from the `mock/` prototype.
 * Selecting it swaps the whole shell; the reused chart + panels drive the same store,
 * so no shell forks logic. Proves the skin seam works end-to-end for a third shell and
 * that the six-box-type Box tab drives real state. The auto console/network guardrail
 * (fixtures) asserts the skin swap raises no errors.
 */
import { test, expect } from './fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('choosing Original swaps to the ported WinISD shell (Projects, tab rail, graph)', async ({ page }) => {
  await page.locator('.skin-picker select').selectOption('original');

  await expect(page.locator('.original-root')).toBeVisible();
  await expect(page.locator('.original-root')).toContainText('Projects');
  await expect(page.locator('.original-root')).toContainText('Signal Generator');
  // The shared GraphPanel renders inside the graph quadrant.
  await expect(page.locator('.original-root .gpanel')).toBeVisible();
});

test('the Box tab exposes all six box types and drives the shared store for supported ones', async ({ page }) => {
  await page.locator('.skin-picker select').selectOption('original');
  await page.locator('.og-nav li', { hasText: 'Box' }).click();

  const boxSel = page.locator('select#og-box-type');
  await expect(boxSel.locator('option')).toHaveCount(6);

  // A supported type (Vented) drives real state → its box diagram shows, no pending banner.
  await boxSel.selectOption('vented');
  await expect(page.locator('#og-box-diagram-vented')).toBeVisible();
  await expect(page.locator('.original-root')).not.toContainText(/response model pending/i);

  // An unsupported type (ABC) shows its ported diagram + the honest pending state (no fake curve).
  await boxSel.selectOption('abc');
  await expect(page.locator('#og-box-diagram-abc')).toBeVisible();
  await expect(page.locator('.original-root')).toContainText(/response model pending/i);
});

test('the chart-type selector re-renders the shared GraphPanel', async ({ page }) => {
  await page.locator('.skin-picker select').selectOption('original');

  const chart = page.locator('.og-chart');
  await expect(chart.locator('.gpanel')).toBeVisible();
  await page.locator('.og-chartsel select').selectOption('Excursion');
  await expect(chart).toContainText(/excursion/i);
});

test('the chosen skin is remembered across a reload (local preference)', async ({ page }) => {
  await page.locator('.skin-picker select').selectOption('original');
  await expect(page.locator('.original-root')).toBeVisible();

  await page.reload();
  await expect(page.locator('.original-root')).toBeVisible();
});
