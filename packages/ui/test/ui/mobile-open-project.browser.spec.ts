/**
 * The mobile menu's "Open project…" — previously-SAVED projects (browser storage), distinct
 * from "Open a file" (a disk import). John, 2026-10-02: "the file menu offer no way to save and
 * reopen projects" — mobile had New project / Open a file, but no equivalent of desktop's own
 * Open dialog (empty-state-open-file.browser.spec.ts's `.open-project-dialog`).
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await openAMobileProject(page);
});

async function openMenu(page: import('playwright').Page): Promise<void> {
  await page.locator('.mob-hamburger').click();
}

test('"Open project…" lists nothing yet before anything has been saved', async ({ page }) => {
  await openMenu(page);
  await page.locator('.mob-menu-item', { hasText: 'Open project…' }).click();
  await expect(page.locator('.mob-align-sheet')).toBeVisible();
  await expect(page.locator('.mob-align-sheet')).toContainText('No saved project yet');
});

test('Save, then "Open project…" lists it and reopens it', async ({ page }) => {
  const before = await page.locator('.mob-field-row.mob-field-entered .mob-field-value input').first().inputValue();

  await openMenu(page);
  await page.locator('.mob-menu-item', { hasText: /^Save$/ }).click();

  await openMenu(page);
  await page.locator('.mob-menu-item', { hasText: 'Open project…' }).click();
  const sheet = page.locator('.mob-align-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.mob-stored-project-row')).toHaveCount(1);

  await sheet.locator('.mob-stored-project-row').first().click();
  await expect(sheet).toHaveCount(0);
  // Reopening the same project lands back on the Box tab with the same value — a real re-load,
  // not a no-op that merely closed the sheet.
  await expect(page.locator('.mob-field-row.mob-field-entered .mob-field-value input').first()).toHaveValue(before);
});

test('the menu lists the open project at the bottom, though it was never saved', async ({ page }) => {
  await openMenu(page);
  const rows = page.locator('.mob-open-project');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveClass(/focused/);
});

test('the Graph page has its own menu button', async ({ page }) => {
  await page.locator('.mob-tab', { hasText: 'Graph' }).click();
  await expect(page.locator('.mob-topbar')).toHaveCount(0);
  await page.locator('.mob-chart-menu').click();
  await expect(page.locator('.mob-menu')).toBeVisible();
  await expect(page.locator('.mob-open-project')).toHaveCount(1);
});

test('the whole menu, open projects included, fits a phone screen without scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openMenu(page);
  const fits = await page.locator('.mob-menu').evaluate(el => el.scrollHeight <= el.clientHeight);
  expect(fits).toBe(true);
});

test('an open project has a show-on-graphs checkbox, ticked by default', async ({ page }) => {
  await openMenu(page);
  await expect(page.locator('.mob-open-project-show').first()).toBeChecked();
  await page.locator('.mob-open-project-show').first().uncheck();
  await expect(page.locator('.mob-open-project-show').first()).not.toBeChecked();
});

test('a second open project gets its own row, and a tap on it focuses it', async ({ page }) => {
  await openAMobileProject(page);
  await openMenu(page);
  const rows = page.locator('.mob-open-project');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toHaveClass(/focused/);
  await rows.nth(0).locator('.mob-open-project-name').click();
  await expect(page.locator('.mob-menu')).toHaveCount(0);
  await openMenu(page);
  await expect(rows.nth(0)).toHaveClass(/focused/);
});

test('tapping a project\'s colour swatch changes its colour', async ({ page }) => {
  await openMenu(page);
  const swatch = page.locator('.mob-open-project-colour').first();
  const before = await swatch.evaluate(el => getComputedStyle(el).backgroundColor);
  await swatch.click();
  await expect.poll(() => swatch.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(before);
});
