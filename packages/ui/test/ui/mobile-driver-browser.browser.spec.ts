/**
 * The driver picker (DriverBrowser.vue's .wb-modal, shared with desktop) on a genuinely short
 * phone viewport — John, 2026-10-02, live on his phone: "something is eclipsing the bottom of
 * the Use and Cancel buttons when picking driver."
 *
 * .wb-modal was fixed at 770x535 with only a weak max-width/max-height safety net (the same gap
 * DriverEditorModal's .de-modal had before its own App.vue override) — on a viewport shorter
 * than ~630px (535px / the 85vh cap), the modal's real height clamped below what the list +
 * preview + footer need. 412x600 reproduces that: narrow AND short, not just narrow.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 600 });
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Driver' }).click();
});

test('the driver picker fills the short viewport instead of clamping to a fixed height', async ({ page }) => {
  await page.getByText('Select driver').click();
  const modal = page.locator('.overlay.on .wb-modal');
  await expect(modal).toBeVisible();
  const box = await modal.boundingBox();
  expect(box).not.toBeNull();
  // Was a fixed 535px regardless of viewport; now full-height, so it must fill the vast
  // majority of a 600px-tall viewport (leaving no room for the old fixed cap to still apply).
  expect(box!.height).toBeGreaterThan(560);
});

test('Cancel and Use stay inside the visible viewport, not clipped off the bottom', async ({ page }) => {
  await page.getByText('Select driver').click();
  await page.locator('.dlist .ditem, .dlist .my-ditem').first().click();

  const useBtn = page.locator('.use-btn');
  const cancelBtn = page.locator('.cancel-btn');
  await expect(useBtn).toBeVisible();
  await expect(cancelBtn).toBeVisible();

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const useBox = await useBtn.boundingBox();
  const cancelBox = await cancelBtn.boundingBox();
  expect(useBox).not.toBeNull();
  expect(cancelBox).not.toBeNull();
  expect(useBox!.y + useBox!.height).toBeLessThanOrEqual(viewport!.height);
  expect(cancelBox!.y + cancelBox!.height).toBeLessThanOrEqual(viewport!.height);

  // A real click lands — not just present in the DOM but actually hittable (the original bug
  // was something ELSE painting over this exact region, which also blocks clicks).
  await cancelBtn.click();
  await expect(page.locator('.use-btn')).toHaveCount(0);
});
