import { test, expect } from '../fixtures.js';

// ui-todo.md "Remove UI Elements" — four controls come out of the driver picker
// (DriverBrowserWinisd.vue).

const CONTROLS = {
  'Reset Demo Drivers button': '.reset-demo-btn',
  'All Sources dropdown': '.src-btn',
  'Add GitHub URL input': '.addrow',
  'SpeakerBoxLite footer link': 'a[href*="speakerboxlite"]',
} as const;

test('the picker no longer carries the four removed controls', async ({ page }) => {
  await page.goto('/');
  await page.locator('[title*="librar" i]').first().click();
  await expect(page.locator('.dlist'), 'the picker did not open').toBeVisible();

  for (const [label, selector] of Object.entries(CONTROLS)) {
    await expect(page.locator(selector), `the ${label} is still present`).toHaveCount(0);
  }
});
