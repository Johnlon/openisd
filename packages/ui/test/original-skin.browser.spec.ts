/**
 * Original (WinISD) skin — the wholesale port of the `mock/` prototype, wired to the
 * shared store/engine. Selecting it swaps the whole shell; the reused chart + panels
 * drive the same store, so no shell forks logic. These tests assert the skin seam plus
 * the mock-fidelity regions (toolbar icons, chart-select dropdown, all 7 tabs, the
 * Placement/Advanced/Listening-place sections, box types, and the box-losses modal).
 * The auto console/network guardrail (fixtures) asserts the skin swap raises no errors.
 */
import { test, expect } from './fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('original');
  await expect(page.locator('.original-root')).toBeVisible();
});

test('choosing Original swaps to the ported WinISD shell (titlebar, projects, graph)', async ({ page }) => {
  await expect(page.locator('.original-root')).toContainText('WinISD Original Mode');
  await expect(page.locator('.original-root')).toContainText('Projects');
  await expect(page.locator('.original-root')).toContainText('Signal Generator');
  await expect(page.locator('.graph-wrap .gpanel')).toBeVisible();
});

test('the toolbar ports the mock icon buttons + chart-select', async ({ page }) => {
  // Mock toolbar: 8 icon controls (.tb-btn) + the .chart-select control.
  await expect(page.locator('.toolbar .tb-btn')).toHaveCount(8);
  await expect(page.locator('.toolbar .chart-select .chart-name')).toBeVisible();
});

test('the chart-select dropdown switches the shared GraphPanel', async ({ page }) => {
  await expect(page.locator('.graph-wrap .gpanel')).toBeVisible();
  await page.locator('.chart-select').click();
  await page.locator('.chart-select .menu-item', { hasText: /^Cone excursion$/ }).click();
  await expect(page.locator('.chart-select .chart-name')).toHaveText('Cone excursion');
  await expect(page.locator('.graph-wrap .gpanel')).toBeVisible();
});

test('all seven project tabs render their ported content', async ({ page }) => {
  const nav = page.locator('.project-nav li');
  await expect(nav).toHaveCount(7);

  await nav.filter({ hasText: 'Driver' }).click();
  await expect(page.locator('.content-panel')).toContainText('Placement');
  await expect(page.locator('.content-panel')).toContainText('Advanced options');
  await expect(page.locator('.content-panel')).toContainText('Num. of drivers');

  await nav.filter({ hasText: 'Signal' }).click();
  await expect(page.locator('.content-panel')).toContainText('Listening place');
  await expect(page.locator('.content-panel')).toContainText('Signal source');

  await nav.filter({ hasText: 'Advanced' }).click();
  await expect(page.locator('.content-panel')).toContainText('Sound velocity');

  await nav.filter({ hasText: 'Project' }).click();
  await expect(page.locator('.content-panel')).toContainText('Description');
});

test('the Box tab exposes all six box types and drives the shared store for supported ones', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const boxSel = page.locator('select#og-box-type');
  await expect(boxSel.locator('option')).toHaveCount(6);

  // Scope pending assertions to the active tab — hidden v-show tabs keep their text in
  // the DOM, so assert on the currently-visible Box section only.
  const boxTab = page.locator('.tab-section.active');
  await boxSel.selectOption('vented');
  await expect(page.locator('#og-box-diagram-vented')).toBeVisible();
  await expect(boxTab).not.toContainText(/response model pending/i);

  await boxSel.selectOption('abc');
  await expect(page.locator('#og-box-diagram-abc')).toBeVisible();
  await expect(boxTab).toContainText(/response model pending/i);
});

test('an externally loaded box type re-syncs the Box tab (no desync while pending)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  const boxTab = page.locator('.tab-section.active');
  await page.locator('select#og-box-type').selectOption('abc');
  await expect(boxTab).toContainText(/response model pending/i);

  await page.evaluate(async () => {
    const modPath = '/src/store.ts';
    const store = await import(/* @vite-ignore */ modPath);
    store.state.box = 'sealed';
  });

  await expect(boxTab).not.toContainText(/response model pending/i);
  await expect(page.locator('#og-box-diagram-sealed')).toBeVisible();
  await expect(page.locator('.graph-wrap .gpanel')).toBeVisible();
});

test('the box-losses modal opens from the Box tab and closes', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('.link-btn', { hasText: 'Advanced' }).click();
  await expect(page.locator('.overlay.open')).toContainText('Box losses');
  await expect(page.locator('.overlay.open')).toContainText('Leakage Ql');
  await page.locator('.overlay.open .ok-btn').click();
  await expect(page.locator('.overlay.open')).toHaveCount(0);
});

test('the Color button cycles the current design trace colour (and wraps)', async ({ page }) => {
  const swatch = page.locator('.color-btn');
  const bg = () => swatch.evaluate(el => getComputedStyle(el).backgroundColor);
  const before = await bg();
  await swatch.click();
  expect(await bg()).not.toBe(before);
  // The mock palette has 7 colours, so 7 clicks total returns to the start.
  for (let i = 0; i < 6; i++) await swatch.click();
  expect(await bg()).toBe(before);
});

test('the bandpass Box tab shows calculated Frc + Tuning-freq readouts (real values)', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('select#og-box-type').selectOption('bandpass4');
  const panel = page.locator('.content-panel');
  // Assert the readouts show real computed Hz values (not just the labels) — this fails
  // if the underlying computeds regress to a literal or null.
  await expect(panel.locator('.field').filter({ hasText: 'Frc' }).locator('input.calculated')).toHaveValue(/^\d+\.\d{2}$/);
  await expect(panel.locator('.field').filter({ hasText: 'Tuning freq' }).locator('input.calculated')).toHaveValue(/^\d+\.\d{2}$/);
});

test('the Vented pane labels the tuning readout "1st port resonance"', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('select#og-box-type').selectOption('vented');
  await page.locator('.project-nav li').nth(2).click(); // the dynamic enclosure/Vents tab
  await expect(page.locator('.content-panel')).toContainText('1st port resonance');
});

test('the chosen skin is remembered across a reload (local preference)', async ({ page }) => {
  await page.reload();
  await expect(page.locator('.original-root')).toBeVisible();
});
