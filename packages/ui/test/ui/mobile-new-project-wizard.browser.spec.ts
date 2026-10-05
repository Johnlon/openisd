/**
 * The mobile New Project wizard. Every step is a regular page with one footer: Back, Next
 * (green) and Cancel (John, 2026-10-03: "this needs to be a regular looking page, back/next
 * green/cancel"). On step 1 the driver preview has no Use/Cancel pair of its own — Next is what
 * chooses the driver being read and moves on, so there is one set of buttons, not two.
 *
 * The test suite's own vite server swaps in a tiny 6-reference-device catalogue (test-bundle.mjs
 * — "no corpus needed"), not the full ~1600-driver one a dev server serves — "Tang Band
 * W5-1138SMF" is one of the six (also used by new-project-wizard.browser.spec.ts).
 */
import {expect, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const TEST_DRIVER = 'Tang Band W5-1138SMF';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await page.getByText('New project').click();
});

test('step 1 has one footer, in the list and in the driver preview: Next and Cancel, no Use', async ({ page }) => {
  const footer = page.locator('.mob-np-footer');
  await expect(footer.getByText('Cancel', { exact: true })).toBeVisible();
  await expect(footer.getByText('Next', {exact: true})).toBeDisabled();   // nothing chosen or being read yet
  await page.getByText(TEST_DRIVER).click();
  await expect(footer.getByText('Cancel', { exact: true })).toBeVisible();
  await expect(footer.getByText('Next', {exact: true})).toBeEnabled();
  await expect(page.locator('.prev-footer')).toHaveCount(0);   // the preview's own Use/Cancel pair is gone
  await expect(page.getByText('Use', { exact: true })).toHaveCount(0);
});

test('Next chooses the driver being read and advances to step 2 with the footer intact', async ({ page }) => {
  await page.getByText(TEST_DRIVER).click();
  await page.locator('.mob-np-footer').getByText('Next', {exact: true}).click();
  await expect(page.locator('.np-step')).toContainText('Step 2 of 5');
  await expect(page.locator('.mob-np-footer').getByText('Back', {exact: true})).toBeVisible();
});

test('Next is green', async ({ page }) => {
  await page.getByText(TEST_DRIVER).click();
  const bg = await page.locator('.mob-np-footer').getByText('Next', {exact: true}).evaluate(el => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe('rgb(240, 240, 240)');
  expect(bg).toMatch(/^rgb\(\d+, (1[0-9]{2}|[2-9][0-9]), \d+\)$/);   // a green-dominant fill
});

test('the header close (✕) still cancels the whole wizard from step 1', async ({ page }) => {
  await page.locator('.mob-np-close').click();
  await expect(page.locator('.mob-np-overlay')).toBeHidden();
});

test('New project from the empty state opens the phone-width wizard, not the desktop modal', async ({ page }) => {
  // MobileNewProject.vue — same useOgNewProject() state as OriginalNewProject, mobile-only
  // presentation (App.vue picks by activeSkin). The beforeEach has already tapped New project.
  await expect(page.locator('.mob-np-overlay .mob-np-title')).toContainText('New project');
});
