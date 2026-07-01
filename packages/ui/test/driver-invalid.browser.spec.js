import { test, expect } from './fixtures.js';

// When a driver is missing a required T/S parameter (e.g. Fs set to 0 in the
// What-If editor), deriveDriver returns { value: null, errors: [...] }. The UI
// must NOT crash or silently blank the graphs — every affected chart must show a
// readable message naming the problem, and the console must stay clean.
//
// The shared fixture (fixtures.js) already fails the test on ANY console error,
// page error, or network failure — so a crash cascade (the previous behaviour:
// "Cannot read properties of null (reading 'Xmax')") fails this test automatically.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('setting Fs to 0 shows a per-chart error message instead of crashing or blanking', async ({ page }) => {
  // Baseline: charts render with the demo driver.
  const panels = page.locator('#ggrid .gpanel');
  await expect(panels.first()).toBeVisible();
  const panelCount = await panels.count();
  expect(panelCount).toBeGreaterThan(0);

  // Open the What-If editor and set Fs to 0 (below the 1 Hz minimum → invalid).
  await page.locator('text=What-If? ✎').click();
  const fsInput = page.locator('label').filter({ hasText: 'Fs' })
    .locator('..').locator('input[type="number"]');
  await fsInput.fill('0');
  await fsInput.press('Tab');

  // Every chart panel must now show the error message region naming the Fs problem.
  const messages = page.locator('#ggrid .gpanel .gmsg');
  await expect(messages.first()).toBeVisible();
  await expect(messages).toHaveCount(panelCount);
  await expect(messages.first()).toContainText(/Fs/);
  await expect(messages.first()).toContainText(/required/i);

  // Restore a valid Fs — the charts must come back (canvas visible, message gone).
  await fsInput.fill('37');
  await fsInput.press('Tab');
  await expect(page.locator('#ggrid .gpanel canvas').first()).toBeVisible();
  await expect(page.locator('#ggrid .gpanel .gmsg')).toHaveCount(0);
});

test('setting Re to 0 (a different required field) also shows the per-chart message', async ({ page }) => {
  await page.locator('text=What-If? ✎').click();
  const reInput = page.locator('label').filter({ hasText: /^Re$/ })
    .locator('..').locator('input[type="number"]');
  await reInput.fill('0');
  await reInput.press('Tab');

  const messages = page.locator('#ggrid .gpanel .gmsg');
  await expect(messages.first()).toBeVisible();
  await expect(messages.first()).toContainText(/Re/);
});

test('setting Pe to 0 is a warning, NOT an error — charts keep rendering, no blanking message', async ({ page }) => {
  // Pe is optional. deriveDriver returns a warn (not an error) and a usable driver.
  // The graphs must continue to render — Pe absence only removes the max-power/SPL
  // thermal limit, it does not invalidate the whole driver.
  await page.locator('text=What-If? ✎').click();
  const peInput = page.locator('label').filter({ hasText: /^Pe/ })
    .locator('..').locator('input[type="number"]');
  await peInput.fill('0');
  await peInput.press('Tab');

  // No blanking message — the canvases stay visible.
  await expect(page.locator('#ggrid .gpanel canvas').first()).toBeVisible();
  await expect(page.locator('#ggrid .gpanel .gmsg')).toHaveCount(0);
});
