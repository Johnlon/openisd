/**
 * The mobile shell's navigation and empty state — Phase 1 of the mobile-first skin. Each tab's
 * own field behaviour has its own spec file; this one covers routing, the empty state, and that
 * the bottom tab bar shows/hides the right destinations.
 *
 * Every test forces the mobile skin via a persisted override (not a narrow viewport) — deciding
 * WHICH skin renders is `mobile-skin-selection.browser.spec.ts`'s job; these specs assume the
 * mobile skin and test what it does once showing.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
});

test('a cold start with no project shows the empty state with New/Open actions', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.mobile-root')).toBeVisible();
  await expect(page.locator('.mob-empty')).toBeVisible();
  await expect(page.getByText('No project open')).toBeVisible();
  await expect(page.getByText('New project')).toBeVisible();
  await expect(page.getByText('Open a file')).toBeVisible();
  await expect(page.locator('.mob-tabbar')).toHaveCount(0);
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

test('New project from the empty state opens the mobile wizard', async ({ page }) => {
  await page.goto('/');
  await page.getByText('New project').click();
  // MobileNewProject.vue — the phone-width wizard, not the desktop OriginalNewProject modal. Same
  // useOgNewProject() state, mobile-only presentation (App.vue picks by activeSkin).
  await expect(page.locator('.mob-np-overlay .mob-np-title')).toContainText('New project');
});

// Bug (John, live on his phone, 2026-09-29): "openisd button should just open the splash as full
// width scrolling it as a popup" — SplashModal.vue (shared with desktop) stays a popup, but its
// backdrop padding and centred width cap are removed on mobile only (App.vue's .app-root-mobile
// :deep() override), so it spans the phone pane edge-to-edge instead of floating with grey
// margins on both sides.
test('About OpenISD (the splash) fills the phone pane edge-to-edge, not a small centred popup', async ({ page }) => {
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-item', { hasText: 'About OpenISD' }).click();

  const rootBox = await page.locator('.mobile-root').boundingBox();
  const splashBox = await page.locator('.sp').boundingBox();
  expect(rootBox).not.toBeNull();
  expect(splashBox).not.toBeNull();
  expect(splashBox!.width).toBeGreaterThanOrEqual(rootBox!.width - 1);
});
