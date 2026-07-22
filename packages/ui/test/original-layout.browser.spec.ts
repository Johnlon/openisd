/**
 * Original (WinISD) skin — layout ergonomics + chart cursor level-lines.
 *
 * Covers: the ＋ Clone/Compare button naming, the ✕ overlay-remove control sitting LEFT
 * of the overlay name (always visible), the resizable/collapsible left panel and bottom
 * section (drag splitters + collapse toggles), the chart maximise/restore toggle (the
 * toolbar stays usable while maximised), and the horizontal level-line the shared canvas
 * draws where the cursor's frequency crosses the current design's curve (one line on
 * hover, one per selection edge during a drag-select).
 */
import { test, expect } from './fixtures.js';
import type { Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('original');
  await expect(page.locator('.original-root')).toBeVisible();
});

// Count horizontal dark line clusters on the graph canvas (the level lines are drawn in
// the dark translucent cursor/band colours; the light grid and the yellow-green trace do
// not match the predicate). A "cluster" is a run of adjacent qualifying pixel rows.
async function levelLineClusters(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector('.graph-wrap canvas') as HTMLCanvasElement;
    const ctx = c.getContext('2d')!;
    const W = c.width, H = c.height;
    const img = ctx.getImageData(0, 0, W, H).data;
    const x0 = Math.floor(W * 0.2), x1 = Math.floor(W * 0.93);
    const rows: number[] = [];
    for (let y = 22; y < H - 24; y++) {
      let n = 0;
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * 4;
        if (img[i + 3] > 35 && img[i] < 140 && img[i + 1] < 140 && img[i + 2] < 140) n++;
      }
      if (n > (x1 - x0) * 0.2) rows.push(y);
    }
    let clusters = 0, prev = -10;
    for (const y of rows) { if (y > prev + 2) clusters++; prev = y; }
    return clusters;
  });
}

test('the pin button is named ＋ Clone/Compare', async ({ page }) => {
  await expect(page.locator('.quad-projects-wrap .link-btn')).toHaveText(/Clone\/Compare/);
});

test('project rows are [checkbox] Name only; the Close button under the list removes the SELECTED overlay', async ({ page }) => {
  await page.locator('.quad-projects-wrap .link-btn', { hasText: 'Clone/Compare' }).click();
  const rows = page.locator('.projects-list .project-row');
  await expect(rows).toHaveCount(2);
  // no inline remove control in the rows (WinISD look: checkbox + name only)
  await expect(page.locator('.projects-list .row-remove')).toHaveCount(0);
  // Close acts on the selected row: with the current design selected it is disabled
  const closeBtn = page.locator('.quad-projects-wrap .close-btn');
  await expect(closeBtn).toBeDisabled();
  // select the overlay row; Close removes it
  await rows.nth(1).click();
  await expect(rows.nth(1)).toHaveClass(/selected/);
  await closeBtn.click();
  await expect(rows).toHaveCount(1);
  // selection falls back to the current design; Close disables again
  await expect(rows.nth(0)).toHaveClass(/selected/);
  await expect(closeBtn).toBeDisabled();
});

test('the left panel collapses and expands via the splitter toggle', async ({ page }) => {
  await expect(page.locator('.quad-topleft')).toBeVisible();
  await page.locator('.split-v .split-toggle').click();
  await expect(page.locator('.quad-topleft')).toBeHidden();
  await page.locator('.split-v .split-toggle').click();
  await expect(page.locator('.quad-topleft')).toBeVisible();
});

test('the left panel resizes by dragging the vertical splitter', async ({ page }) => {
  const before = (await page.locator('.quad-topleft').boundingBox())!;
  const split = (await page.locator('.split-v').boundingBox())!;
  await page.mouse.move(split.x + split.width / 2, split.y + split.height / 2);
  await page.mouse.down();
  await page.mouse.move(split.x + split.width / 2 + 80, split.y + split.height / 2, { steps: 4 });
  await page.mouse.up();
  const after = (await page.locator('.quad-topleft').boundingBox())!;
  expect(after.width).toBeGreaterThan(before.width + 50);
});

test('the bottom section collapses (chart grows) and expands via the splitter toggle', async ({ page }) => {
  const graphBefore = (await page.locator('.graph-area').boundingBox())!;
  await page.locator('.split-h .split-toggle').click();
  await expect(page.locator('.content-panel')).toBeHidden();
  const graphAfter = (await page.locator('.graph-area').boundingBox())!;
  expect(graphAfter.height).toBeGreaterThan(graphBefore.height + 100);
  await page.locator('.split-h .split-toggle').click();
  await expect(page.locator('.content-panel')).toBeVisible();
});

test('the bottom section resizes by dragging the horizontal splitter', async ({ page }) => {
  const before = (await page.locator('.content-panel').boundingBox())!;
  const split = (await page.locator('.split-h').boundingBox())!;
  await page.mouse.move(split.x + split.width / 2, split.y + split.height / 2);
  await page.mouse.down();
  await page.mouse.move(split.x + split.width / 2, split.y + split.height / 2 - 60, { steps: 4 });
  await page.mouse.up();
  const after = (await page.locator('.content-panel').boundingBox())!;
  expect(after.height).toBeGreaterThan(before.height + 40);
});

test('chart maximise fills the main area, keeps the toolbar, and restores', async ({ page }) => {
  await page.locator('.chart-max-btn').click();
  await expect(page.locator('.quad-topleft')).toBeHidden();
  await expect(page.locator('.content-panel')).toBeHidden();
  await expect(page.locator('.toolbar')).toBeVisible();       // chart type still switchable
  const graph = (await page.locator('.graph-area').boundingBox())!;
  const main = (await page.locator('.original-root .main').boundingBox())!;
  expect(graph.width).toBeGreaterThan(main.width * 0.95);
  await page.locator('.chart-max-btn').click();
  await expect(page.locator('.quad-topleft')).toBeVisible();
  await expect(page.locator('.content-panel')).toBeVisible();
});

test('hovering the chart draws ONE horizontal level line where the cursor crosses the curve', async ({ page }) => {
  const box = (await page.locator('.graph-wrap canvas').boundingBox())!;
  expect(await levelLineClusters(page)).toBe(0);
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.waitForFunction(() => true); // yield a frame for the redraw watch
  await expect.poll(() => levelLineClusters(page)).toBe(1);
});

test('a drag-select draws a horizontal level line for BOTH selection cursors', async ({ page }) => {
  const box = (await page.locator('.graph-wrap canvas').boundingBox())!;
  const y = box.y + box.height * 0.5;
  await page.mouse.move(box.x + box.width * 0.25, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.45, y, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => levelLineClusters(page)).toBe(2);
});
