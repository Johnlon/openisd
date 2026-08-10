/**
 * Specification: http://localhost:8000/winisd/openisd/openspec/specs/app-shell/spec.md?html
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures.js';

// ui-todo.md "Remove UI Elements" — four controls come out of the driver picker, in EVERY
// skin: DriverBrowserWinisd.vue (Original, Classic) and DriverBrowserMd.vue (Modern).
//
// The scope was originally the WinISD picker alone, and this spec asserted that Modern kept
// all four. The human widened it to both pickers on 2026-08-04, so the guard now runs the
// same absence check against all three skins rather than pulling in two directions.
//
// store.ts picks `modern` whenever the port is 4100 — this suite's port — so the skin is
// seeded through localStorage or these specs never reach DriverBrowserWinisd.vue at all.

const CONTROLS = {
  'Reset Demo Drivers button': '.reset-demo-btn',
  'All Sources dropdown': '.src-btn',
  'Add GitHub URL input': '.addrow',
  'SpeakerBoxLite footer link': 'a[href*="speakerboxlite"]',
} as const;

async function openPicker(page: Page, skin: string): Promise<void> {
  await page.addInitScript((s) => {
    localStorage.setItem('openisd.state', JSON.stringify({ ui: { skin: s } }));
  }, skin);
  await page.goto('/');
  // Each shell opens the picker from its own control; all of them say "library".
  await page.locator('[title*="librar" i]').first().click();
  await expect(page.locator('.dlist'), `the ${skin} picker did not open`).toBeVisible();
}

for (const skin of ['original', 'classic', 'modern'] as const) {
  test(`the picker no longer carries the four removed controls — skin ${skin}`, async ({ page }) => {
    await openPicker(page, skin);
    for (const [label, selector] of Object.entries(CONTROLS)) {
      await expect(page.locator(selector), `the ${label} is still present in the ${skin} skin`)
        .toHaveCount(0);
    }
  });
}
