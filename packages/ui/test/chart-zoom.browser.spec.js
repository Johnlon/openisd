import { test, expect } from './fixtures.js';

// Frequency-range (X-axis) zoom controls in the graph toolbar. The shared fixture
// (fixtures.js) fails the test on any console / render / network error, so each
// range change here also proves the full redraw pipeline stays clean at the new range.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

const minInput = (page) => page.locator('.freq-in').nth(0);
const maxInput = (page) => page.locator('.freq-in').nth(1);

test('range inputs default to 10–20000 Hz', async ({ page }) => {
  await expect(minInput(page)).toHaveValue('10');
  await expect(maxInput(page)).toHaveValue('20000');
});

test('preset "1–40k" zooms the range all the way out; charts still render', async ({ page }) => {
  await page.locator('.freq-preset', { hasText: '40k' }).click();
  await expect(minInput(page)).toHaveValue('1');
  await expect(maxInput(page)).toHaveValue('40000');
  await expect(page.locator('#ggrid .gpanel canvas').first()).toBeVisible();
});

test('preset "20–20k" sets the audio band', async ({ page }) => {
  await page.locator('.freq-preset', { hasText: '20–20k' }).click();
  await expect(minInput(page)).toHaveValue('20');
  await expect(maxInput(page)).toHaveValue('20000');
});

test('typing a valid narrower range zooms in with a clean redraw', async ({ page }) => {
  await maxInput(page).fill('2000');
  await maxInput(page).press('Tab');
  await minInput(page).fill('30');
  await minInput(page).press('Tab');
  await expect(minInput(page)).toHaveValue('30');
  await expect(maxInput(page)).toHaveValue('2000');
  await expect(page.locator('#ggrid .gpanel canvas').first()).toBeVisible();
});

test('an inverted min (above the max) is rejected — the range never collapses', async ({ page }) => {
  await minInput(page).fill('99999');   // above the 20000 max → invalid
  await minInput(page).press('Tab');
  await expect(minInput(page)).toHaveValue('10');  // reverted to the last valid value
});

test('the chosen range persists across reload', async ({ page }) => {
  await page.locator('.freq-preset', { hasText: '40k' }).click();
  await expect(maxInput(page)).toHaveValue('40000');
  await page.reload();
  await expect(minInput(page)).toHaveValue('1');
  await expect(maxInput(page)).toHaveValue('40000');
});

// ── Y-axis (level) per-chart override ────────────────────────────────────────

test('per-chart Y control appears on hover and starts in auto mode', async ({ page }) => {
  const panel = page.locator('#ggrid .gpanel').first();
  await panel.hover();
  const yctl = panel.locator('.gyctl');
  await expect(yctl).toBeVisible();
  // Auto is the default — the "A" button is highlighted (on).
  await expect(panel.locator('.gy-auto')).toHaveClass(/on/);
});

test('setting a manual Y range switches off auto and keeps the control pinned visible', async ({ page }) => {
  const panel = page.locator('#ggrid .gpanel').first();  // SPL chart
  await panel.hover();
  const yMin = panel.locator('.gy-in').nth(0);
  const yMax = panel.locator('.gy-in').nth(1);
  await yMax.fill('110'); await yMax.press('Tab');
  await yMin.fill('30');  await yMin.press('Tab');

  // Override active → auto no longer highlighted, control stays visible (pinned), chart redraws clean.
  await expect(panel.locator('.gy-auto')).not.toHaveClass(/on/);
  await expect(panel.locator('.gyctl')).toHaveClass(/active/);
  await expect(panel.locator('canvas')).toBeVisible();
});

test('the "A" button resets the Y axis back to auto', async ({ page }) => {
  const panel = page.locator('#ggrid .gpanel').first();
  await panel.hover();
  await panel.locator('.gy-in').nth(1).fill('110');
  await panel.locator('.gy-in').nth(1).press('Tab');
  await expect(panel.locator('.gy-auto')).not.toHaveClass(/on/);

  await panel.locator('.gy-auto').click();
  await expect(panel.locator('.gy-auto')).toHaveClass(/on/);
});

test('an inverted Y range (min above max) is rejected', async ({ page }) => {
  const panel = page.locator('#ggrid .gpanel').first();
  await panel.hover();
  const yMax = panel.locator('.gy-in').nth(1);
  const before = await yMax.inputValue();
  const yMin = panel.locator('.gy-in').nth(0);
  await yMin.fill('99999');  // above the max → invalid
  await yMin.press('Tab');
  // Still auto (no override applied), max unchanged.
  await expect(panel.locator('.gy-auto')).toHaveClass(/on/);
  await expect(yMax).toHaveValue(before);
});
