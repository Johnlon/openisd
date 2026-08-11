import { test, expect } from '../fixtures.js';
import type { Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Test at a small viewport height to verify that the bottom panel has layout priority (stays visible without scrolling)
  // while the chart shrinks.
  await page.setViewportSize({ width: 1600, height: 400 });
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('original');
  await expect(page.locator('.original-root')).toBeVisible();
});

async function checkScrollbars(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('.tab-section.active');
    if (!el) return { hasVScroll: false, hasHScroll: false, error: 'Active tab-section not found' };
    
    // Check if vertical or horizontal scrollbar is present.
    // scrollHeight > clientHeight (with 1px buffer to avoid subpixel/scaling rounding issues)
    // scrollWidth > clientWidth (with 1px buffer)
    const hasVScroll = el.scrollHeight > el.clientHeight + 1;
    const hasHScroll = el.scrollWidth > el.clientWidth + 1;
    
    return {
      hasVScroll,
      hasHScroll,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth
    };
  });
}

test('bottom panels never get scrollbars', async ({ page }) => {
  const boxTypes = ['vented', 'sealed', 'bandpass4', 'bandpass6', 'abc'];
  
  for (const boxType of boxTypes) {
    // Navigate to Box tab to switch the type
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.locator('#og-box-type').selectOption(boxType);
    
    // Iterate through all visible tabs for this box type
    const tabs = page.locator('.project-nav li');
    const count = await tabs.count();
    
    for (let i = 0; i < count; i++) {
      const tabName = await tabs.nth(i).innerText();
      await tabs.nth(i).click();
      
      const res = await checkScrollbars(page);
      expect(
        res.hasVScroll,
        `Tab "${tabName}" for box type "${boxType}" should not have a vertical scrollbar. Details: ${JSON.stringify(res)}`
      ).toBe(false);
      expect(
        res.hasHScroll,
        `Tab "${tabName}" for box type "${boxType}" should not have a horizontal scrollbar. Details: ${JSON.stringify(res)}`
      ).toBe(false);
    }
  }
});
