/**
 * `.mob-content`'s scroll container must actually scroll a tall tab, not silently clip it.
 *
 * BUG (2026-09-29, John, live on his phone): "environment view needs to scroll... truncation at
 * the moment". Root cause: every mobile tab's `.mob-panel` sets `overflow: hidden`, and a flex
 * item with overflow other than visible gets an automatic MINIMUM size of 0 (flexbox spec) — so
 * with the column-flex default `flex-shrink: 1`, once a tall tab's content exceeded
 * `.mob-content`, the shrink algorithm silently squashed every panel to fit and clipped its
 * content, instead of letting `.mob-content` overflow so its own `overflow-y: auto` could
 * scroll. Fixed in MobileShell.vue: `.mob-content > :deep(*) { flex-shrink: 0; }`.
 *
 * None of the other mobile specs caught this because they never run at a genuinely phone-sized
 * (narrow AND short) viewport — the default Playwright viewport is tall enough that most tabs
 * never actually overflowed in a test.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.setViewportSize({ width: 412, height: 700 }); // narrow AND short enough to force overflow
  await page.goto('/');
  await openAMobileProject(page);
});

test('the Advanced tab scrolls to its last control instead of clipping it', async ({ page }) => {
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-item', { hasText: 'Advanced' }).click();

  const lastControl = page.getByText('WinISD VA model');
  await lastControl.scrollIntoViewIfNeeded();
  await expect(lastControl).toBeVisible();

  // The scrollable element is .mob-content, not the individual .mob-panel blocks — each panel
  // must render at its full (unclipped) height, only the shared container scrolls.
  const panelOverflow = await page.locator('.mob-panel').evaluateAll(
    panels => panels.map(p => ({ scrollHeight: p.scrollHeight, clientHeight: p.clientHeight })));
  for (const p of panelOverflow) expect(p.scrollHeight).toBeLessThanOrEqual(p.clientHeight);
});

test('the Box tab scrolls to its last button (Box losses) instead of clipping it', async ({ page }) => {
  const lastControl = page.locator('.mob-btn', { hasText: 'Box losses' });
  await lastControl.scrollIntoViewIfNeeded();
  await expect(lastControl).toBeVisible();
});
