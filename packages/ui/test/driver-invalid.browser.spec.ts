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

test('missing Pe drops only the thermal-limit line — Max-SPL chart still draws, and the issue is listed (dismissable)', async ({ page }) => {
  // Pe is optional. Its absence removes ONE reference line (the thermal limit) from
  // the Max-SPL / Max-power charts. The excursion-limited curve is still fully valid,
  // so the chart must keep drawing — no blocking message. The missing line is surfaced
  // as a dismissable issue in the driver panel's issue list.

  // Show a Pe-dependent chart so the missing-line case is actually on screen.
  await page.locator('.gchip', { hasText: 'Maximum SPL' }).click();

  await page.locator('text=What-If? ✎').click();
  const peInput = page.locator('label').filter({ hasText: /^Pe/ })
    .locator('..').locator('input[type="number"]');
  await peInput.fill('0');
  await peInput.press('Tab');

  // The Max-SPL chart draws (canvas visible) — it is NOT replaced by a block message.
  await expect(page.locator('#ggrid .gpanel canvas').first()).toBeVisible();
  await expect(page.locator('#ggrid .gpanel .gmsg')).toHaveCount(0);

  // The missing line is reported in the driver panel's issue list, and it is a warning
  // (amber, not a blocking error), and it is dismissable.
  const issues = page.locator('.drv-issues');
  await expect(issues).toBeVisible();
  await expect(issues).not.toHaveClass(/is-error/);
  await expect(issues).toContainText(/Pe/);
  await expect(issues).toContainText(/thermal-limit line/i);
  await issues.locator('.drv-warn-x').click();
  await expect(page.locator('.drv-issues')).toHaveCount(0);
});

test('missing Xmax drops only the excursion limit line — Excursion chart still draws, issue is a warning', async ({ page }) => {
  // Xmax is optional. Without it, the Excursion chart keeps its (reliable) cone-travel
  // curve; only the Xmax limit reference line is omitted. Reported as a dismissable warn.
  await page.locator('text=What-If? ✎').click();
  const xmaxInput = page.locator('label').filter({ hasText: /^Xmax/ })
    .locator('..').locator('input[type="number"]');
  await xmaxInput.fill('0');
  await xmaxInput.press('Tab');

  // Excursion is in the default chart set — it must still render, no block message.
  await expect(page.locator('#ggrid .gpanel canvas').first()).toBeVisible();
  await expect(page.locator('#ggrid .gpanel .gmsg')).toHaveCount(0);

  const issues = page.locator('.drv-issues');
  await expect(issues).toBeVisible();
  await expect(issues).not.toHaveClass(/is-error/);
  await expect(issues).toContainText(/Xmax/);
});
