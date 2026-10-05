/**
 * The Driver Editor (DriverEditorModal, shared with desktop) at phone width, opened from the mobile
 * Driver tab.
 *
 * Bug (John, live on his phone, 2026-09-29, screenshot): the Parameters tab's field rows
 * overlapped illegibly. `max-width: 96vw` on .de-modal computes against the REAL viewport, not
 * the 480px phone pane — at the default (wide) test viewport it never actually constrained the
 * 770px-wide grid, so this needs a genuinely narrow viewport to reproduce/verify.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Driver' }).click();
});

test('the Driver Editor field rows stack without overlapping at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await page.getByText('Edit', { exact: true }).click();
  await expect(page.locator('.de-modal')).toBeVisible();

  const qesBox = await page.locator('.de-fld[data-field-key="Qes"]').boundingBox();
  const fsBox = await page.locator('.de-fld[data-field-key="Fs_hz"]').boundingBox();
  expect(qesBox).not.toBeNull();
  expect(fsBox).not.toBeNull();
  // Fs_hz sits later in source order in the same field-slot column — stacked (not overlapping)
  // means it starts at or below where Qes ends.
  expect(fsBox!.y).toBeGreaterThanOrEqual(qesBox!.y + qesBox!.height - 1);
});

/** Every rendered element under `root` whose box crosses the left or right screen edge. Elements
 *  inside the tab row are skipped: that row scrolls sideways inside the editor by design. */
async function elementsPastScreenEdges(page: import('@playwright/test').Page, root: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const width = window.innerWidth;
    const out: string[] = [];
    for (const el of document.querySelectorAll(`${sel}, ${sel} *`)) {
      if (el.closest('.de-tabs')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.left < -1 || r.right > width + 1) out.push(`${el.tagName}.${el.className} ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    return out;
  }, root);
}

// Bug (John, live on his phone, 2026-10-05: "that screen is really broken due to the bottom bar").
test('at phone width the Driver Editor fits the screen: first tab, legend one per line, every footer button', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.getByText('Edit', { exact: true }).click();
  const modal = page.locator('.de-modal');
  await expect(modal).toBeVisible();

  expect(await elementsPastScreenEdges(page, '.de-modal')).toEqual([]);
  await expect(page.locator('.de-tab').first()).toBeInViewport({ ratio: 1 });
  for (const button of await page.locator('.de-btns button').all()) {
    await expect(button).toBeInViewport({ ratio: 1 });
  }

  await expect(page.locator('.de-legend-item')).toHaveCount(3);
  const items = await page.locator('.de-legend-item').all();
  const boxes = await Promise.all(items.map(i => i.boundingBox()));
  for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.y).toBeGreaterThanOrEqual(boxes[i - 1]!.y + boxes[i - 1]!.height - 1);
  const firstButton = await page.locator('.de-btns button').first().boundingBox();
  expect(firstButton!.y).toBeGreaterThanOrEqual(boxes[2]!.y + boxes[2]!.height - 1);
});

// Bug (John, live on his phone, 2026-10-05): the Save to My Drivers boxes ran past the dialog.
test('at phone width the Save to My Drivers dialog sits on screen with its boxes inside it', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByText('Edit', { exact: true }).click();
  await page.locator('.de-copy-my').click();
  const panel = page.getByRole('dialog', { name: 'Save to My Drivers' });
  await expect(panel).toBeVisible();

  expect(await elementsPastScreenEdges(page, '.save-lib-panel')).toEqual([]);
  const p = (await panel.boundingBox())!;
  for (const input of await panel.locator('input').all()) {
    const r = (await input.boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(p.x);
    expect(r.x + r.width).toBeLessThanOrEqual(p.x + p.width);
  }
});
