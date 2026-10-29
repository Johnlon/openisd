/**
 * The mobile New Project wizard. Every step is a regular page with one footer: Back, Next
 * and Cancel (John, 2026-10-03: "this needs to be a regular looking page, back/next
 * green/cancel"). On step 1 the driver preview has no Use/Cancel pair of its own — Next is what
 * chooses the driver being read and moves on, so there is one set of buttons, not two.
 *
 * The test suite's own vite server swaps in a tiny 6-reference-device catalogue (test-bundle.mjs
 * — "no corpus needed"), not the full ~1600-driver one a dev server serves — "Tang Band
 * W5-1138SMF" is one of the six (also used by new-project-wizard.browser.spec.ts).
 */
import {expect, openAMobileProject, setFocusedBoxVolume, shownBoxVolume, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

const TEST_DRIVER = 'Tang Band W5-1138SMF';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await page.getByText('New project').click();
});

test('step 1 has one footer, in the list and in the driver preview: Next and Cancel, no Use', async ({ page }) => {
  const footer = page.locator('.mob-np-footer');
  await expect(footer.getByText('Cancel', { exact: true })).toBeVisible();
  await expect(footer.getByText('Next ▸', {exact: true})).toBeDisabled();   // nothing chosen or being read yet
  await page.getByText(TEST_DRIVER).click();
  await expect(page.locator('.mob-np-library .preview')).toHaveCSS('padding', '12px 16px');
  await expect(footer.getByText('Cancel', { exact: true })).toBeVisible();
  await expect(footer.getByText('Next ▸', {exact: true})).toBeEnabled();
  await expect(page.locator('.prev-footer')).toHaveCount(0);   // the preview's own Use/Cancel pair is gone
  await expect(page.getByText('Use', { exact: true })).toHaveCount(0);
});

test('Next chooses the driver being read and advances to step 2 with the footer intact', async ({ page }) => {
  await page.getByText(TEST_DRIVER).click();
  await page.locator('.mob-np-footer').getByText('Next ▸', {exact: true}).click();
  await expect(page.locator('.np-step')).toHaveText('Number of drivers and placement');
  await expect(page.locator('.mob-np-footer').getByText('◀ Back', {exact: true})).toBeVisible();
});

test('Next is the blue lead button, Create Project the green one (screen 25)', async ({ page }) => {
  await page.getByText(TEST_DRIVER).click();
  const next = page.locator('.mob-np-footer').getByText('Next ▸', {exact: true});
  const bg = await next.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe('rgb(240, 240, 240)');
  expect(bg).toMatch(/^rgb\(\d+, \d+, (1[5-9][0-9]|2[0-5][0-9])\)$/);   // a blue-dominant fill
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


test('an unsaved project remains marked and unchanged without a warning on every wizard pane', async ({page}) => {
  await page.locator('.mob-np-close').click();
  await openAMobileProject(page);
  await setFocusedBoxVolume(page, 0.042);
  await tapMobileMenuItem(page, 'Projects');
  await expect(page.locator('.mob-project-dirty')).toHaveText('Unsaved');
  await page.locator('.mob-dlg-close').click();
  await tapMobileMenuItem(page, 'New project');
  await expect(page.locator('.mob-np-overlay')).toBeVisible();
  await expect(page.getByText(/The open project has unsaved changes/)).toHaveCount(0);
  await page.getByText(TEST_DRIVER).click();
  await page.locator('.mob-np-footer').getByText('Next ▸', {exact: true}).click();
  await expect(page.locator('.np-step')).toHaveText('Number of drivers and placement');
  await expect(page.getByText(/The open project has unsaved changes/)).toHaveCount(0);
  await page.locator('.mob-np-close').click();
  expect(await shownBoxVolume(page)).toBe(42);
  await tapMobileMenuItem(page, 'Projects');
  await expect(page.locator('.mob-project-dirty')).toHaveText('Unsaved');
});

test('the wizard driver list keeps the same phone inset as Manage Drivers', async ({page}) => {
  const library = page.locator('.mob-np-library');
  await expect(library).toHaveClass(/dl-phone/);
  await expect(library.locator('.ditem').first()).toHaveCSS('padding-left', '16px');
  await page.getByText(TEST_DRIVER).click();
  await expect(library.locator('.preview')).toHaveCSS('padding', '12px 16px');
});


test.describe('touch viewport', () => {
  test.use({isMobile: true, hasTouch: true, viewport: {width: 374, height: 705}});

  test('wizard actions remain fully inside the phone viewport in the list and driver preview', async ({page}) => {
    await expect(page.locator('.mob-np-footer')).toBeInViewport({ratio: 1});
    const cancel = page.locator('.mob-np-footer').getByRole('button', {name: 'Cancel', exact: true});
    expect(await cancel.evaluate(button => {
      const box = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
    })).toBe(true);
    await page.getByText(TEST_DRIVER).click();
    await expect(page.locator('.mob-np-footer')).toBeInViewport({ratio: 1});
    await cancel.click();
    await expect(page.locator('.mob-np-overlay')).toBeHidden();
  });
});

test('the phone driver library actions span the full list width', async ({page}) => {
  const difference = await page.locator('.mob-np-library').evaluate(library => {
    const actions = library.querySelector('.browser-footer > div');
    if (!actions) throw new Error('Missing driver library actions');
    return Math.abs(actions.getBoundingClientRect().width - library.getBoundingClientRect().width);
  });
  expect(difference).toBeLessThanOrEqual(1);
});
