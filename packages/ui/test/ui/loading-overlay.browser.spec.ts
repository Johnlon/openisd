/**
 * Loading overlay (T030).
 *
 * Verifies that the OpenISD icon overlay is displayed from first paint until
 * the app has mounted (for at least 0.7 s), and is shown again when the page
 * becomes visible after having been hidden for more than 30 s.
 */
import type {Page} from '@playwright/test';
import {expect, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

interface OverlaySeen {atPaint: boolean; hiddenAtMs: number | null}
declare global {
  interface Window { __overlaySeen: OverlaySeen }
}

async function simulateVisibility(page: Page, hiddenDurationMs: number): Promise<void> {
  await page.evaluate((duration) => {
    const baseNow = Date.now();
    let currentOffset = 0;
    Date.now = () => baseNow + currentOffset + performance.now();

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    currentOffset = duration;

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hiddenDurationMs);
}

test.describe('loading overlay — Original desktop skin', () => {
  test('overlays the app initially, hides after mount and >= 0.7 s, and re-appears after > 30 s hidden', async ({page}) => {
    await page.addInitScript(() => {
      const seen: OverlaySeen = {atPaint: false, hiddenAtMs: null};
      Object.defineProperty(window, '__overlaySeen', {value: seen});
      document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('loading-overlay');
        if (!el) return;
        seen.atPaint = getComputedStyle(el).display !== 'none';
        new MutationObserver(() => {
          if (el.style.display === 'none' && seen.hiddenAtMs === null) seen.hiddenAtMs = performance.now();
        }).observe(el, {attributes: true, attributeFilter: ['style']});
      });
    });
    await page.goto('/');

    const overlay = page.locator('#loading-overlay');
    // The overlay is cosmetic: it never takes a click or drag meant for the app under it
    await expect(overlay).toHaveCSS('pointer-events', 'none');
    // Overlay must eventually hide after mount and at least 0.7 s
    await expect(overlay).toBeHidden();
    const seen = await page.evaluate(() => window.__overlaySeen);
    expect(seen.atPaint).toBe(true);
    expect(seen.hiddenAtMs).toBeGreaterThanOrEqual(700);

    // Hiding for <= 30 s (e.g. 10 s) does NOT trigger redisplay
    await simulateVisibility(page, 10_000);
    await expect(overlay).toBeHidden();

    // Hiding for > 30 s (e.g. 35 s) triggers redisplay
    await simulateVisibility(page, 35_000);
    await expect(overlay).toBeVisible();

    // Stays visible for at least 0.7 s and then hides again
    await expect(overlay).toBeHidden();
  });
});

test.describe('loading overlay — Mobile skin', () => {
  test('overlays the mobile app initially, hides after mount and >= 0.7 s, and re-appears after > 30 s hidden', async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');

    const overlay = page.locator('#loading-overlay');
    await expect(overlay).toBeHidden();

    // Hiding for > 30 s (e.g. 35 s) triggers redisplay on mobile skin as well
    await simulateVisibility(page, 35_000);
    await expect(overlay).toBeVisible();

    // Stays visible for at least 0.7 s and then hides again
    await expect(overlay).toBeHidden();
  });
});
