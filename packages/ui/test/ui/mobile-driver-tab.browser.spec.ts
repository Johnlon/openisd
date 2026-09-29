/**
 * The mobile Driver tab. Select/Edit reuse the app's existing global overlays (DriverBrowser,
 * DriverEditorModal) unchanged — these specs prove the mobile tab reaches them, not that the
 * overlays themselves behave correctly (their own spec files cover that).
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Driver' }).click();
});

test('shows the driver identity and the Select/Edit actions', async ({ page }) => {
  await expect(page.locator('.mob-driver-model')).toBeVisible();
  await expect(page.getByText('Select driver')).toBeVisible();
  await expect(page.getByText('Edit')).toBeVisible();
});

test('Select driver opens the driver browser overlay', async ({ page }) => {
  await page.getByText('Select driver').click();
  await expect(page.locator('.overlay.on .wb-modal')).toBeVisible();
});

test('Edit opens the driver editor modal', async ({ page }) => {
  await page.getByText('Edit', { exact: true }).click();
  await expect(page.locator('.de-modal')).toBeVisible();
});

// Bug (John, live on his phone, 2026-09-29, screenshot): the Parameters tab's field rows
// overlapped illegibly. `max-width: 96vw` on .de-modal computes against the REAL viewport, not
// the 480px phone pane — at the default (wide) test viewport it never actually constrained the
// 770px-wide grid, so this needs a genuinely narrow viewport to reproduce/verify (same class of
// gap as the tall-tab clipping bug: no existing mobile spec ran narrow enough).
test('the Driver Editor field rows stack without overlapping at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await page.getByText('Edit', { exact: true }).click();
  await expect(page.locator('.de-modal')).toBeVisible();

  const qesRow = page.locator('.de-fld[data-field-key="Qes"]');
  const fsRow = page.locator('.de-fld[data-field-key="Fs_hz"]');
  const qesBox = await qesRow.boundingBox();
  const fsBox = await fsRow.boundingBox();
  expect(qesBox).not.toBeNull();
  expect(fsBox).not.toBeNull();
  // Fs_hz sits later in source order in the same field-slot column — stacked (not overlapping)
  // means it starts at or below where Qes ends.
  expect(fsBox!.y).toBeGreaterThanOrEqual(qesBox!.y + qesBox!.height - 1);
});

test('changing the number of drivers and the wiring writes the project', async ({ page }) => {
  await page.locator('#mob-n-drivers').selectOption('2');
  await expect(page.locator('#mob-n-drivers')).toHaveValue('2');

  const wiringBefore = await page.locator('#mob-wiring').inputValue();
  const options = await page.locator('#mob-wiring option').allTextContents();
  await page.locator('#mob-wiring').selectOption({ index: 1 });
  const wiringAfter = await page.locator('#mob-wiring').inputValue();
  expect(options.length).toBeGreaterThan(1);
  // eslint-disable-next-line playwright/prefer-web-first-assertions -- comparing two runtime-captured values, not a fixed expected one
  expect(wiringAfter).not.toBe(wiringBefore);
});
