/**
 * The help page "OpenISD and WinISD differences" in the mobile skin: the hamburger menu opens it,
 * the "Enable WinISD bugs" heading's help link opens it at that section, and a ≠W cue opens it at the
 * cue's entry. What the page lists is proven in the design package
 * (`winisd-differences.test.ts`); these specs prove the entry points reach it.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const PAGE = {name: 'OpenISD and WinISD differences'};

test.beforeEach(async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test('the menu opens the page full screen; Close shuts it', async ({page}) => {
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-item', {hasText: 'OpenISD and WinISD differences'}).click();
  const help = page.getByRole('dialog', PAGE);
  await expect(help).toBeVisible();
  // Full screen: as wide as the phone-width app column the mobile skin sits in.
  const box = (await help.boundingBox())!;
  const app = (await page.locator('.app-root-mobile').boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(app.width - 1);
  await help.locator('.wd-footer button', {hasText: 'Close'}).click();
  await expect(help).toHaveCount(0);
});

test('the "Enable WinISD bugs" heading\'s help link opens the page at the bug-switch section', async ({page}) => {
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-item', {hasText: 'Advanced'}).click();
  await page.locator('.error-switch-group .compat-help-link').click();
  const section = page.getByRole('dialog', PAGE).locator('#winisd-diff-bugs');
  await expect(section).toHaveClass(/current/);
  await expect(section).toBeInViewport();
});

test('a ≠W cue opens the page at that cue\'s entry', async ({page}) => {
  await page.locator('.mob-tab', {hasText: 'Filters'}).click();
  await page.getByText('+ AP', {exact: true}).click();
  const order = page.locator('.filter-edit-body label').filter({hasText: /^Order\b/}).locator('input');
  await order.fill('4');
  await order.blur();
  await page.locator('button.winisd-deviation-cue').click();
  const entry = page.getByRole('dialog', PAGE).locator('.wd-entry.current');
  await expect(entry.locator('h4')).toHaveText('WinISD ignores allpass orders above 2');
  await expect(entry).toBeInViewport();
});
