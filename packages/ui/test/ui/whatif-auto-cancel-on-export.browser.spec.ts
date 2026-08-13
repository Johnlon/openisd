/**
 * Specification: http://localhost:8000/winisd/openisd/STATE_MODEL.md
 *
 * Strict state-layer encapsulation: a live Tune what-if is an UNCOMMITTED preview overlay
 * (STATE_MODEL.md's "What-if overlay" layer). Export/Save/Edit-Driver operate on the
 * committed design (getDriverModel() always reads committed, never the whatif — by design,
 * see STATE_MODEL.md rule 4: "A what-if is not a modification"). Leaving the whatif silently
 * OPEN after one of these actions is misleading: the user sees an edited value on screen that
 * the action just ignored, with no indication anything happened to their in-progress edit.
 *
 * The fix: these actions auto-CANCEL any active whatif first, so there is never an ambiguous
 * moment where the screen shows one thing and the file/save reflects another.
 */
import { test, expect } from '../fixtures.js';
import type { Locator, Page } from '@playwright/test';

function numInputByLabel(page: Page, labelText: string, scope: Locator = page.locator('body')) {
  return scope.locator('label')
    .filter({ hasText: labelText })
    .locator('..')
    .locator('input[type="number"]');
}

test('exporting a WinISD driver (.wdr) while a Tune what-if is active auto-cancels the what-if', async ({ page }) => {
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('original');

  // Start a live what-if and change a field, leaving it UNCOMMITTED (no Keep).
  await page.locator('li', { hasText: 'Driver' }).click();
  await page.locator('button.edit-btn', { hasText: 'Tune' }).click();
  const tunePanel = page.locator('.tune-panel');
  await expect(tunePanel).toBeVisible();
  const qtsInput = numInputByLabel(page, 'Qts', tunePanel);
  await qtsInput.fill('0.55');
  await qtsInput.press('Tab');

  // Export WDR — a design-I/O action that must operate on the committed design, not the
  // in-progress preview.
  await page.locator('#btnExportMenu').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('button', { hasText: 'Export WinISD Driver (.wdr)' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.wdr$/);

  // The what-if must no longer be active — Tune auto-closed rather than being left open on
  // a preview the export just discarded.
  await expect(tunePanel).toBeHidden();
});

test('opening the driver picker while a Tune what-if is active auto-cancels the what-if', async ({ page }) => {
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('original');

  await page.locator('li', { hasText: 'Driver' }).click();
  await page.locator('button.edit-btn', { hasText: 'Tune' }).click();
  const tunePanel = page.locator('.tune-panel');
  await expect(tunePanel).toBeVisible();
  const qtsInput = numInputByLabel(page, 'Qts', tunePanel);
  await qtsInput.fill('0.55');
  await qtsInput.press('Tab');

  // "Select Driver" merely OPENS the picker — no driver has been chosen yet — but an
  // uncommitted preview must not be left dangling once the user has moved on to picking a
  // different driver entirely.
  await page.locator('button.edit-btn', { hasText: 'Select Driver' }).click();

  await expect(page.locator('.wb-modal')).toBeVisible();
  await expect(tunePanel).toBeHidden();
});

test('opening the full driver editor while a Tune what-if is active auto-cancels the what-if and seeds from the committed value', async ({ page }) => {
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('original');

  await page.locator('li', { hasText: 'Driver' }).click();
  await page.locator('button.edit-btn', { hasText: 'Tune' }).click();
  const tunePanel = page.locator('.tune-panel');
  await expect(tunePanel).toBeVisible();
  const qtsInput = numInputByLabel(page, 'Qts', tunePanel);
  const committedQts = await qtsInput.inputValue();
  await qtsInput.fill('0.55');           // uncommitted preview value — never Keep (there is none)
  await qtsInput.press('Tab');

  // Opening the full editor must not silently ignore the live what-if: it auto-cancels it
  // first, so the editor seeds from the committed value, not the uncommitted 0.55 on screen.
  await page.locator('button.edit-btn', { hasText: 'Edit' }).click();

  const editorModal = page.locator('.de-modal');
  await expect(editorModal).toBeVisible();
  await expect(tunePanel).toBeHidden();

  await editorModal.getByRole('button', { name: 'Parameters', exact: true }).click();
  const editorQts = numInputByLabel(page, 'Qts', editorModal);
  await expect(editorQts).toHaveValue(committedQts);
});
