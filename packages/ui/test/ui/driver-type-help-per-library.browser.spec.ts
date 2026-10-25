import {expect, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

/**
 * The driver-type help list (Driver Range Classifications) belongs to the library it was opened in.
 * Opened on Manage drivers and left open, it must not show when the new-project wizard opens its own
 * library, where its backdrop blocked every tap (BUG_20261018_driver-type-help-stays-open-across-libraries).
 */
const TEST_DRIVER = 'Tang Band W5-1138SMF';
const HELP = 'Driver Range Classifications';

test('desktop: help left open in Manage drivers is closed in the new-project wizard', async ({page}) => {
  await page.setViewportSize({width: 1400, height: 900});
  await page.goto('/');
  await page.locator('.tb-btn[title^="Manage Drivers"]').click();
  await page.getByTitle('How are driver types classified?').click();
  await expect(page.getByText(HELP)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Driver database')).toBeHidden();
  await page.getByRole('button', {name: 'New project', exact: true}).first().click();
  await expect(page.getByText('Step 1 of 5')).toBeVisible();
  await expect(page.getByText(HELP)).toHaveCount(0);
  await page.getByText(TEST_DRIVER).click();
  await expect(page.getByRole('button', {name: 'Next', exact: true})).toBeEnabled();
});

test('phone: help left open in Manage drivers is closed in the new-project wizard', async ({page}) => {
  await page.setViewportSize({width: 374, height: 705});
  await forceMobileSkin(page);
  await page.goto('/');
  await page.getByRole('button', {name: 'Menu', exact: true}).click();
  await page.getByText('Manage Drivers', {exact: true}).locator('visible=true').first().click();
  await page.locator('.dl-filters-toggle').click();
  await page.getByTitle('How are driver types classified?').click();
  await expect(page.getByText(HELP)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name: 'New project', exact: true}).click();
  await expect(page.locator('.np-step')).toHaveText('Select driver for project');   // the phone's step bar shows the title only
  await expect(page.getByText(HELP)).toHaveCount(0);
  await page.getByText(TEST_DRIVER).click();
  await expect(page.locator('.mob-np-footer').getByText('Next ▸', {exact: true})).toBeEnabled();
});

test('desktop: help lists Bass-midrange, and Midrange is not under Woofer', async ({page}) => {
  await page.setViewportSize({width: 1400, height: 900});
  await page.goto('/');
  await page.locator('.tb-btn[title^="Manage Drivers"]').click();
  await page.getByTitle('How are driver types classified?').click();
  await expect(page.getByText(HELP)).toBeVisible();
  const table = page.locator('.help-table');
  await expect(table.getByRole('row', {name: /^Bass-midrange/})).toBeVisible();
  const midrange = table.getByRole('row', {name: /^Midrange/});
  await expect(midrange).toContainText('Mid');
  await expect(midrange).not.toContainText('Woofer');
});
