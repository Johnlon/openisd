import { test, expect } from './fixtures.js';

// Chart zoom controls:
//   X (frequency) — a dropdown of preset spans in the graph toolbar. Changing it
//     re-sweeps over the new band, so the Y axis auto-fits the visible data.
//   Y (level) — drag on a chart's left axis strip: middle = pan, ends = zoom,
//     Shift-drag = symmetric zoom, double-click = reset to auto. A bottom-left chip
//     appears while a manual Y range is active and resets it.
// The shared fixture fails on any console / render / network error, so every change
// here also proves the redraw pipeline stays clean.

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

const rangeSel = (page) => page.locator('.freq-sel');

// ── X-axis frequency range dropdown ──────────────────────────────────────────

test('frequency dropdown defaults to 1–20 kHz', async ({ page }) => {
  await expect(rangeSel(page)).toHaveValue('20000');
});

test('choosing 1–500 Hz narrows the range; charts still render', async ({ page }) => {
  await rangeSel(page).selectOption('500');
  await expect(rangeSel(page)).toHaveValue('500');
  await expect(page.locator('#ggrid .gpanel canvas').first()).toBeVisible();
});

test('choosing 1–40 kHz zooms all the way out', async ({ page }) => {
  await rangeSel(page).selectOption('40000');
  await expect(rangeSel(page)).toHaveValue('40000');
  await expect(page.locator('#ggrid .gpanel canvas').first()).toBeVisible();
});

test('the chosen frequency range persists across reload', async ({ page }) => {
  await rangeSel(page).selectOption('500');
  await page.reload();
  await expect(rangeSel(page)).toHaveValue('500');
});

// ── Y-axis drag (level pan/zoom) ─────────────────────────────────────────────

// Drag vertically inside a panel's left axis strip (x within the 44 px label margin).
async function dragYAxis(page, panel, fromFrac, dyPx) {
  const box = await panel.boundingBox();
  const x = box.x + 8;                                  // inside the 44 px Y-axis strip
  const y = box.y + box.height * fromFrac;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dyPx, { steps: 6 });
  await page.mouse.up();
}

test('dragging the Y axis sets a manual range and reveals the reset chip', async ({ page }) => {
  const panel = page.locator('#ggrid .gpanel').first();   // SPL chart
  await expect(panel.locator('.gy-reset')).toHaveCount(0); // auto by default
  await dragYAxis(page, panel, 0.5, 40);                   // middle = pan
  await expect(panel.locator('.gy-reset')).toBeVisible();
  await expect(panel.locator('canvas')).toBeVisible();
});

test('the reset chip returns the Y axis to auto', async ({ page }) => {
  const panel = page.locator('#ggrid .gpanel').first();
  await dragYAxis(page, panel, 0.5, 40);
  await expect(panel.locator('.gy-reset')).toBeVisible();
  await panel.locator('.gy-reset').click();
  await expect(panel.locator('.gy-reset')).toHaveCount(0);
});

test('double-clicking the Y axis resets it to auto', async ({ page }) => {
  const panel = page.locator('#ggrid .gpanel').first();
  await dragYAxis(page, panel, 0.2, 30);                   // top end = zoom
  await expect(panel.locator('.gy-reset')).toBeVisible();
  const box = await panel.boundingBox();
  await page.mouse.dblclick(box.x + 8, box.y + box.height * 0.5);
  await expect(panel.locator('.gy-reset')).toHaveCount(0);
});
