import type {Page} from '@playwright/test';
import {expect, openAProject, test} from '../fixtures.js';

/**
 * BUG_20261108_desktop-skin-chart-collapses-at-phone-width: in a 374x705 window the desktop skin keeps a
 * usable chart (canvas at least 120 px tall), whole drawer buttons, and a What-if dialog inside the window.
 */
async function startDesktopSkinAtPhoneWidth(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true, skinOverride: 'original'}}));
  });
  await page.setViewportSize({width: 374, height: 705});
  await page.goto('/');
}

test('desktop skin at 374x705: chart canvas >= 120 px, drawer buttons and What-if inside the window', async ({page}) => {
  await startDesktopSkinAtPhoneWidth(page);
  await openAProject(page);
  const canvas = page.locator('.graph canvas, .quad-graph canvas, canvas').first();
  await expect(canvas).toBeVisible();
  const h = (await canvas.boundingBox())?.height ?? 0;
  expect(h, `canvas ${h}px`).toBeGreaterThanOrEqual(120);
  const out = await page.locator('.quad-projects-wrap button').evaluateAll(bs => bs
    .filter(b => b.checkVisibility())
    .filter(b => { const r = b.getBoundingClientRect(); return r.bottom > innerHeight + 0.5 || r.right > innerWidth + 0.5; })
    .map(b => (b.textContent ?? '').trim()));
  expect(out).toEqual([]);
  await page.locator('.project-nav li', {hasText: /^Driver$/}).click();
  await page.locator('.edit-btn', {hasText: /What-if/i}).click();
  const dlg = page.locator('.what-if-panel').first();
  await expect(dlg).toBeVisible();
  const r = await dlg.evaluate(e => { const b = e.getBoundingClientRect(); return {left: b.left, right: b.right, w: innerWidth}; });
  expect(r.right, `what-if right ${r.right} of ${r.w}`).toBeLessThanOrEqual(r.w + 0.5);
  expect(r.left).toBeGreaterThanOrEqual(-0.5);
  const clipped = await dlg.evaluate(e => e.scrollWidth - e.clientWidth);
  expect(clipped, 'what-if content wider than its box').toBeLessThanOrEqual(1);
});
