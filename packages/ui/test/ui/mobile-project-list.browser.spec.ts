/**
 * The open-project rows at the bottom of the mobile hamburger menu: one row per open project, with
 * a show-on-graphs checkbox, a focus tap and a colour swatch.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, openMobileMenu} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';

/** Count distinct opaque colours drawn on the chart: a second trace is a second colour. */
const inkColours = (page: Page) => page.evaluate(() => {
  const c = document.querySelector<HTMLCanvasElement>('.mob-chart-cell canvas');
  const g = c?.getContext('2d');
  if (!c || !g) return 0;
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const seen = new Set<string>();
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
  return seen.size;
});

const graphTab = (page: Page) => page.locator('.mob-tab', { hasText: 'Graph' });
const boxTab = (page: Page) => page.locator('.mob-tab', { hasText: 'Box' });

/** Close the menu by tapping the overlay to the right of the drawer. */
async function closeMenu(page: Page): Promise<void> {
  const overlay = page.locator('.mob-menu-overlay');
  const box = await overlay.boundingBox();
  if (!box) throw new Error('menu overlay not laid out');
  await overlay.click({ position: { x: box.width - 5, y: box.height / 2 } });
  await expect(page.locator('.mob-menu')).toHaveCount(0);
}

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

  // bugs/BUG_20261005_project-selection-lost-on-reload.md
  test('a hidden project is still hidden after a reload, and the chart still leaves its trace out', async ({ page }) => {
    await openAMobileProject(page);
    await graphTab(page).click();
    await expect.poll(() => inkColours(page)).toBeGreaterThan(0);
    const shown = await inkColours(page);
    await boxTab(page).click(); // the Graph view has no menu button
    await openMobileMenu(page);
    await page.locator('.mob-open-project-show').first().uncheck();
    await closeMenu(page);
    await graphTab(page).click();
    await expect.poll(() => inkColours(page)).toBeLessThan(shown);
    const hidden = await inkColours(page);

    await page.reload();

    await boxTab(page).click();
    await openMobileMenu(page);
    await expect(page.locator('.mob-open-project-show')).toHaveCount(2);
    await expect(page.locator('.mob-open-project-show').first()).not.toBeChecked();
    await expect(page.locator('.mob-open-project-show').nth(1)).toBeChecked();
    await closeMenu(page);
    await graphTab(page).click();
    await expect.poll(async () => Math.abs(await inkColours(page) - hidden)).toBeLessThanOrEqual(2);
  });

  test('tapping a project\'s colour swatch changes its colour', async ({ page }) => {
    await openMobileMenu(page);
    const swatch = page.locator('.mob-open-project-colour').first();
    const before = await swatch.evaluate(el => getComputedStyle(el).backgroundColor);
    await swatch.click();
    await expect.poll(() => swatch.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(before);
  });
});
