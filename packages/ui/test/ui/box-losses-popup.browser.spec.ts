import {expect, openAProject, test} from '../fixtures.js';

/** The Box losses popup (leakage Ql, absorption Qa) opened from the Box tab. */

test.describe('Box losses popup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openAProject(page);
  });

  test('the Box losses popup opens from the Box tab Advanced link and closes with OK', async ({ page }) => {
    await page.locator('.project-nav li', { hasText: 'Box' }).click();
    await page.locator('.link-btn', { hasText: 'Advanced' }).click();
    await expect(page.locator('.overlay.open')).toContainText('Box losses');
    await expect(page.locator('.overlay.open')).toContainText('Leakage Ql');
    await page.locator('.overlay.open .ok-btn').click();
    await expect(page.locator('.overlay.open')).toHaveCount(0);
  });
});
