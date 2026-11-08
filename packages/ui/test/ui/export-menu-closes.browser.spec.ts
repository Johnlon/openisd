import {COMPLETE_DRIVER_PROJECT_OWPR} from '../fixtures/sampleProject.js';
import {expect, openAProject, test} from '../fixtures.js';

// John, 8 Nov 2026 (QO459): the Save As / Export menu closes when it loses focus. Left open after the
// last project closed, its items threw "no project is focused" (BUG_20261031_crash-no-project-is-focused).
test('desktop: the Save As / Export menu closes when focus leaves it', async ({page}) => {
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  const trigger = page.locator('.original-root .export-menu-trigger');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.export-menu-list')).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.export-menu-list')).toBeHidden();
});

test('desktop: the Save As / Export menu closes when the last project closes under it', async ({page, browserLog}) => {
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.row-menu-btn').first().click();
  const trigger = page.locator('.original-root .export-menu-trigger');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.export-menu-list')).toBeVisible();
  await page.locator('.menu-action-close').click();
  await expect(page.locator('.export-menu-list')).toBeHidden();
  await expect(trigger).toBeDisabled();
  expect(browserLog.consoleErrors.filter(e => e.includes('no project is focused'))).toEqual([]);
});
