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
