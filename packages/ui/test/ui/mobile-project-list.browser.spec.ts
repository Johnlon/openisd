/**
 * The open-project rows at the bottom of the mobile hamburger menu: one row per open project, with
 * a show-on-graphs checkbox, a focus tap and a colour swatch.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, openMobileMenu} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test.describe('MobileProjectList', () => {
  test('the menu lists the open project at the bottom, though it was never saved', async ({ page }) => {
    await openMobileMenu(page);
    const rows = page.locator('.mob-open-project');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveClass(/focused/);
  });

  test('an open project has a show-on-graphs checkbox, ticked by default', async ({ page }) => {
    await openMobileMenu(page);
    await expect(page.locator('.mob-open-project-show').first()).toBeChecked();
    await page.locator('.mob-open-project-show').first().uncheck();
    await expect(page.locator('.mob-open-project-show').first()).not.toBeChecked();
  });

  test('a second open project gets its own row, and a tap on it focuses it', async ({ page }) => {
    await openAMobileProject(page);
    await openMobileMenu(page);
    const rows = page.locator('.mob-open-project');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(1)).toHaveClass(/focused/);
    await rows.nth(0).locator('.mob-open-project-name').click();
    await expect(page.locator('.mob-menu')).toHaveCount(0);
    await openMobileMenu(page);
    await expect(rows.nth(0)).toHaveClass(/focused/);
  });

  test('tapping a project\'s colour swatch changes its colour', async ({ page }) => {
    await openMobileMenu(page);
    const swatch = page.locator('.mob-open-project-colour').first();
    const before = await swatch.evaluate(el => getComputedStyle(el).backgroundColor);
    await swatch.click();
    await expect.poll(() => swatch.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(before);
  });
});
