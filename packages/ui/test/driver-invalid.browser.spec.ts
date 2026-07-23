import { test, expect } from './fixtures.js';
import type { Page } from '@playwright/test';

// When a driver is missing a required T/S parameter (Fs/Re absent or 0), deriveDriver
// returns { value: null, errors: [...] }. The UI must NOT crash or silently blank the
// graphs — every affected chart must show a readable message naming the problem, and the
// console must stay clean.
//
// Entry constraints (input-constraints gate, DEVELOPMENT.md §8) mean an invalid value can
// no longer be TYPED into existence — the What-If editor clamps 0 up to the field minimum.
// An invalid driver still arrives via persisted/imported data, so these tests seed it
// through localStorage (the loadLocal() path App.vue restores on mount) and reload.
//
// The shared fixture (fixtures.js) already fails the test on ANY console error,
// page error, or network failure — so a crash cascade (the previous behaviour:
// "Cannot read properties of null (reading 'Xmax')") fails this test automatically.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

// Persist a demo-like driver with `overrides` applied, then reload so the app restores it.
async function reloadWithDriver(page: Page, overrides: Record<string, number>): Promise<void> {
  await page.evaluate((ov) => {
    const driver = { name: 'Broken Test Driver', brand: 'Test', model: 'Broken',
      Fs: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas: 0.0300, Sd: 0.0133, Re: 5.6,
      Le: 0.0007, Xmax: 0.0050, Pe: 60, Z: 8, ...ov };
    localStorage.setItem('openisd.state', JSON.stringify({ v: 1, driver }));
  }, overrides);
  await page.reload();
}

test('a persisted driver with Fs=0 shows a per-chart error message instead of crashing or blanking', async ({ page }) => {
  await reloadWithDriver(page, { Fs: 0 });

  // Every chart panel must show the error message region naming the Fs problem.
  const panels = page.locator('#ggrid .gpanel');
  await expect(panels.first()).toBeVisible();
  const messages = page.locator('#ggrid .gpanel .gmsg');
  await expect(messages.first()).toBeVisible();
  await expect(messages).toHaveCount(await panels.count());
  await expect(messages.first()).toContainText(/Fs/);
  await expect(messages.first()).toContainText(/required/i);

  // Entering a valid Fs in the What-If editor brings the charts back.
  await page.locator('text=What-If? ✎').click();
  const fsInput = page.locator('label').filter({ hasText: 'Fs' })
    .locator('..').locator('input[type="number"]');
  await fsInput.fill('37');
  await fsInput.press('Tab');
  await expect(page.locator('#ggrid .gpanel canvas').first()).toBeVisible();
  await expect(page.locator('#ggrid .gpanel .gmsg')).toHaveCount(0);
});

test('a persisted driver with Re=0 (a different required field) also shows the per-chart message', async ({ page }) => {
  await reloadWithDriver(page, { Re: 0 });

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

test('persisted Vb = 0 surfaces a blocking "no usable values" error (finiteness postcondition)', async ({ page }) => {
  // A *valid* driver can still yield a non-finite sweep: Vb=0 makes cInv(0) poison
  // exc/zmag with NaN at every frequency. Entry constraints stop Vb=0 being TYPED
  // (registry floor), so seed it through persisted state — the classifyFinite
  // postcondition must catch it and surface a blocking error via the issue list —
  // never a silent blank chart, and no console error (the fixture fails the test on
  // any console/page error).
  await page.evaluate(() => {
    localStorage.setItem('openisd.state', JSON.stringify({ v: 1, P: { Vb: 0 } }));
  });
  await page.reload();

  const issues = page.locator('.drv-issues');
  await expect(issues).toBeVisible();
  await expect(issues).toHaveClass(/is-error/);
  await expect(issues).toContainText(/no usable values|box volume/i);

  // Entering a valid volume clears the error.
  const vbInput = page.locator('label').filter({ hasText: 'Box volume Vb' })
    .locator('..').locator('input[type="number"]');
  await vbInput.fill('30');
  await vbInput.press('Tab');
  await expect(page.locator('.drv-issues.is-error')).toHaveCount(0);
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
