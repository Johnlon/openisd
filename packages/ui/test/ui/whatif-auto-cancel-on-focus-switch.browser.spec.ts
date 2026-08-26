/**
 * Specification: http://localhost:8000/winisd/openisd/bugs/BUG_20260825_tune_whatif_stays_open_across_a_project_switch_with_no_overlay_on_the_newly_focused_project.md
 *
 * Switching focus to a different open project is a focus-changing action, matching the
 * existing "any focus-changing action auto-cancels an open what-if" pattern already covered
 * for export/driver-picker/editor in `whatif-auto-cancel-on-export.browser.spec.ts`
 * (`appState.ts`'s `openDriverPicker()`). Tune (a live what-if overlay on the FOCUSED project)
 * and the Driver Editor modal must both close when focus moves to a different project, so
 * neither stays silently rebound to a project it was never opened for.
 */
import { test, expect } from '../fixtures.js';

test('switching focus to a different open project auto-cancels an active Tune what-if', async ({ page }) => {
  await page.goto('/');

  await page.locator('button.link-btn', { hasText: '＋ Copy' }).click();

  await page.locator('li', { hasText: 'Driver' }).click();
  await page.locator('button.edit-btn', { hasText: 'Tune' }).click();
  const tunePanel = page.locator('.tune-panel');
  await expect(tunePanel).toBeVisible();

  const projectRows = page.locator('.project-row');
  await expect(projectRows).toHaveCount(2);
  await projectRows.nth(0).click();

  await expect(tunePanel).toBeHidden();
});

test('switching focus to a different open project closes the Driver Editor modal', async ({ page }) => {
  await page.goto('/');

  await page.locator('button.link-btn', { hasText: '＋ Copy' }).click();

  await page.locator('li', { hasText: 'Driver' }).click();
  await page.locator('button.edit-btn', { hasText: 'Edit' }).click();
  const editorModal = page.locator('.de-modal');
  await expect(editorModal).toBeVisible();

  const projectRows = page.locator('.project-row');
  await expect(projectRows).toHaveCount(2);
  await projectRows.nth(0).click();

  await expect(editorModal).toBeHidden();
});
