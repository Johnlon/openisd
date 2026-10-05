/**
 * The mobile shell's navigation and empty state — Phase 1 of the mobile-first skin. Each tab's
 * own field behaviour has its own spec file; this one covers routing, the empty state, and that
 * the bottom tab bar shows/hides the right destinations. The top bar, splash and New project wizard
 * are `mobile-topbar`, `mobile-splash` and `mobile-new-project-wizard`.
 *
 * Every test forces the mobile skin via a persisted override (not a narrow viewport) — deciding
 * WHICH skin renders is `skin-selection.browser.spec.ts`'s job; these specs assume the
 * mobile skin and test what it does once showing.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
});

test('a cold start with no project shows the empty state with New/Open actions', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.mobile-root')).toBeVisible();
  await expect(page.locator('.mob-empty')).toBeVisible();
  await expect(page.getByText('No project open')).toBeVisible();
  await expect(page.getByText('New project')).toBeVisible();
  await expect(page.getByText('Open project')).toBeVisible();
  await expect(page.getByText('Import project')).toBeVisible();
  await expect(page.locator('.mob-tabbar')).toHaveCount(0);
  await expect(page.locator('.mob-project-title')).toHaveCount(0);
});

test('the empty state shows the app logo and name above the New/Open buttons', async ({ page }) => {
  await page.goto('/');
  const empty = page.locator('.mob-empty');
  const brand = empty.locator('.mob-empty-brand', { hasText: 'OpenISD' });
  // Vite inlines the small icon.svg as a data: URL, so the img is found by place, not by src.
  const logo = brand.locator('img');
  await expect(logo).toBeVisible();
  expect(await logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(brand).toBeVisible();
  const brandBox = await brand.boundingBox();
  const ctaBox = await empty.locator('.mob-cta').first().boundingBox();
  expect(brandBox && ctaBox && brandBox.y + brandBox.height <= ctaBox.y).toBe(true);
});

// John, 2026-10-05: "the mobile app chart screen doesn't allow opening from browser storage, only
// New and Open a file". The empty state now matches desktop's empty chart: New project, Open project
// (the menu's saved-project sheet), Import project (a file).
test('the empty state opens a project saved in the browser', async ({ page }) => {
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, /^Save$/);
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-open-project-close').first().click();

  const empty = page.locator('.mob-empty');
  await expect(empty.locator('button')).toHaveText(['New project', 'Open project', 'Import project', 'Switch to Desktop view']);
  await empty.getByRole('button', { name: 'Open project' }).click();
  const sheet = page.locator('.mob-align-sheet');
  await expect(sheet.locator('.mob-stored-project-row')).toHaveCount(1);

  await sheet.locator('.mob-stored-project-row').click();
  await expect(sheet).toHaveCount(0);
  await expect(empty).toHaveCount(0);
  await expect(page.locator('.mob-tabbar')).toBeVisible();
});

// John 2026-10-05: "if I close the last project then I see the init screen, but if I refresh then
// the last project comes back". Closing empties the open list; the saved copy stays.
test('closing the last project stays closed after a reload, and Open project still lists it', async ({ page }) => {
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, /^Save$/);
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-open-project-close').first().click();
  await expect(page.locator('.mob-empty')).toBeVisible();

  await page.reload();

  const empty = page.locator('.mob-empty');
  await expect(empty.locator('button')).toHaveText(['New project', 'Open project', 'Import project', 'Switch to Desktop view']);
  await expect(page.locator('.mob-tabbar')).toHaveCount(0);
  await empty.getByRole('button', { name: 'Open project' }).click();
  await expect(page.locator('.mob-align-sheet .mob-stored-project-row')).toHaveCount(1);
});

test('opening a project swaps the empty state for the tab bar, defaulting to the Box tab', async ({ page }) => {
  await page.goto('/');
  await openAMobileProject(page);
  await expect(page.locator('.mob-empty')).toHaveCount(0);
  await expect(page.locator('.mob-tabbar')).toBeVisible();
  await expect(page.locator('.mob-tab.active')).toHaveText('Box');
  await expect(page.locator('.mob-panel-head').first()).toHaveText('Box');
});

test('the tab bar switches between Box, Driver, Signal and Graph', async ({ page }) => {
  await page.goto('/');
  await openAMobileProject(page);

  await page.locator('.mob-tab', { hasText: 'Driver' }).click();
  await expect(page.locator('.mob-tab.active')).toHaveText('Driver');
  await expect(page.locator('.mob-panel-head').first()).toHaveText('Driver');

  await page.locator('.mob-tab', { hasText: 'Signal' }).click();
  await expect(page.locator('.mob-tab.active')).toHaveText('Signal');
  await expect(page.locator('.mob-panel-head').first()).toHaveText('Signal');

  await page.locator('.mob-tab', { hasText: 'Graph' }).click();
  await expect(page.locator('.mob-tab.active')).toHaveText('Graph');
  await expect(page.locator('.mob-chart-view')).toBeVisible();
  await expect(page.locator('.mob-tabbar')).toBeVisible();

  await page.locator('.mob-tab', { hasText: 'Box' }).click();
  await expect(page.locator('.mob-panel-head').first()).toHaveText('Box');
});
