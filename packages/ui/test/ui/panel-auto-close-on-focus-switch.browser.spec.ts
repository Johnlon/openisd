/**
 * Switching focus to a different open project is a focus-changing action: Tune and the Driver
 * Editor modal both close when focus moves to a different project (`appState.ts`'s
 * `focusProject()`), so neither stays open on a project the user has moved away from.
 */
import { test, expect } from '../fixtures.js';

test('switching focus to a different open project closes an open Tune panel', async ({ page }) => {
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
