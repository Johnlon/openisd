/**
 * The desktop toolbar icons are buttons named by their label, so keyboard and screen-reader users
 * can reach them (bugs/BUG_20261017_ui-toolbar-icons-no-accessible-name.md).
 */
import {expect, openAProject, test} from '../fixtures.js';

test('every toolbar icon is a button named by its label', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  const toolbar = page.locator('.toolbar');
  for (const name of ['Open project', 'New project', 'Save', 'Save all', 'Revert', 'Manage Drivers', 'Options', 'Info']) {
    await expect(toolbar.getByRole('button', {name, exact: true})).toBeVisible();
  }
  await expect(toolbar.getByRole('button', {name: /^Save As \/ Export/})).toBeVisible();
  // With nothing to save or revert, those two are disabled buttons.
  await expect(toolbar.getByRole('button', {name: 'Save all', exact: true})).toBeDisabled();
  await expect(toolbar.getByRole('button', {name: 'Revert', exact: true})).toBeDisabled();
});

test('Tab reaches Options and Enter opens it; Enter on Info opens its menu', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  const toolbar = page.locator('.toolbar');
  await toolbar.getByRole('button', {name: 'Manage Drivers', exact: true}).focus();
  await page.keyboard.press('Tab');
  const options = toolbar.getByRole('button', {name: 'Options', exact: true});
  await expect(options).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.opt-tab', {hasText: 'Your data'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.opt-tab')).toHaveCount(0);

  await toolbar.getByRole('button', {name: 'Info', exact: true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.dropdown-menu.open .menu-item', {hasText: 'About OpenISD'})).toBeVisible();
});
