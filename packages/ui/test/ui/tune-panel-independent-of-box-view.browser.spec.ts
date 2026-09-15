/**
 * The Tune panel is independent of the box view it was opened from.
 *
 * John, 2026-09-09: "make this popup a child of a higher component so that it is independent
 * of the box view from which it was opened". It is a global overlay like the driver editor, so
 * changing the box type — which re-renders the Box tab and can swap the enclosure pane out
 * entirely — must not disturb it.
 */
import { test, expect, openAProject } from '../fixtures.js';

test('the Tune panel stays open when the box type changes underneath it', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);

  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('button.edit-btn', { hasText: 'Tune' }).click();
  await expect(page.locator('.tune-panel')).toBeVisible();

  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await page.locator('#og-box-type').selectOption('vented');
  await expect(page.locator('.tune-panel')).toBeVisible();

  await page.locator('#og-box-type').selectOption('sealed');
  await expect(page.locator('.tune-panel')).toBeVisible();
});

test('the Tune panel stays open across project tab changes', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);

  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.locator('button.edit-btn', { hasText: 'Tune' }).click();
  await expect(page.locator('.tune-panel')).toBeVisible();

  // The panel is not a child of any one tab section.
  await page.locator('.project-nav li', { hasText: 'Box' }).click();
  await expect(page.locator('.tune-panel')).toBeVisible();

  await page.locator('.project-nav li', { hasText: 'Signal' }).click();
  await expect(page.locator('.tune-panel')).toBeVisible();
});
