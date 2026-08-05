/**
 * Classic (WinISD) skin — selecting it swaps the whole shell, and the reused editor
 * panels + chart drive the same store. Proves the skin seam works end-to-end and that
 * no shell forks logic: switching tabs mounts the shared panels; the chart-type selector
 * re-renders the shared GraphPanel. The auto console/network guardrail (fixtures) asserts
 * the skin swap raises no errors.
 */
import { test, expect } from './fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('choosing Classic swaps to the WinISD shell (Projects, tab rail, Color)', async ({ page }) => {
  // Modern is the default; the picker lives in its header.
  await page.locator('.skin-picker select').selectOption('classic');

  await expect(page.locator('.classic-root')).toBeVisible();
  await expect(page.locator('.classic-root')).toContainText('Projects');
  await expect(page.locator('.classic-root')).toContainText('Signal Generator');
  // Vertical Project tab rail + the yellow Color swatch. The 3rd rail slot's label
  // tracks the current box type (default: vented) instead of a static "Passive
  // Radiator" — see the next test for the dynamic-label behaviour itself.
  await expect(page.locator('.cl-rtab', { hasText: 'Driver' })).toBeVisible();
  await expect(page.locator('.cl-rtab', { hasText: 'Vented' })).toBeVisible();
  await expect(page.locator('.cl-color')).toContainText('Color');
});

test('the 3rd rail tab label tracks the box type (specialist tab)', async ({ page }) => {
  await page.locator('.skin-picker select').selectOption('classic');
  await page.locator('.cl-rtab', { hasText: 'Box' }).click();

  await page.locator('select#boxtype').selectOption('pr');
  await expect(page.locator('.cl-rtab', { hasText: 'Passive Radiator' })).toBeVisible();

  await page.locator('select#boxtype').selectOption('bandpass4');
  await expect(page.locator('.cl-rtab', { hasText: 'Bandpass' })).toBeVisible();

  await page.locator('select#boxtype').selectOption('sealed');
  await expect(page.locator('.cl-rtab', { hasText: 'Passive Radiator' })).toBeVisible();
  await page.locator('.cl-rtab', { hasText: 'Passive Radiator' }).click();
  await expect(page.locator('.cl-br')).toContainText('Nothing extra for a Sealed box');
});

test('the tab rail switches editors — Driver uses the WinISD layout, Box reuses the shared BoxPanel', async ({ page }) => {
  await page.locator('.skin-picker select').selectOption('classic');

  // Driver tab is default — WinISD field layout (bound to the shared store).
  await expect(page.locator('.cl-br')).toContainText('Brand');
  await expect(page.locator('.cl-br')).toContainText('Placement');
  await expect(page.locator('.cl-br')).toContainText('Num. of drivers');

  // Switching to Box mounts the shared BoxPanel (no fork — shows the Vb control).
  await page.locator('.cl-rtab', { hasText: 'Box' }).click();
  await expect(page.locator('.cl-br')).toContainText('Vb');
});

test('the chart-type selector re-renders the shared GraphPanel', async ({ page }) => {
  await page.locator('.skin-picker select').selectOption('classic');

  const chart = page.locator('.cl-chart');
  await expect(chart.locator('.gpanel')).toBeVisible();

  // Default is SPL; switch to excursion and the panel title follows.
  await page.locator('.cl-chartsel select').selectOption('Excursion');
  await expect(chart).toContainText(/excursion/i);
});

test('the chosen skin is remembered across a reload (local preference)', async ({ page }) => {
  await page.locator('.skin-picker select').selectOption('classic');
  await expect(page.locator('.classic-root')).toBeVisible();

  await page.reload();
  await expect(page.locator('.classic-root')).toBeVisible();
});
