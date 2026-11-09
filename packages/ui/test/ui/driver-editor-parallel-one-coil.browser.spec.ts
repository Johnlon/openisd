import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {COMPLETE_DRIVER_PROJECT_OWPR, ensureSampleProject} from '../fixtures/sampleProject.js';

ensureSampleProject();

const WARNING = 'Connection is Parallel but the driver has 1 voice coil. Parallel needs 2 voice coils.';

/** QO432: a user states 1 voice coil and picks Parallel; the Voicecoils box shows the warning, and
 *  it goes away when there are 2 coils. */
async function pickParallelOnOneCoil(page: Page): Promise<void> {
  await page.getByRole('button', {name: 'Parameters', exact: true}).click();
  const coils = page.locator('.de-fld', {has: page.locator('label:text-is("Voicecoils")')}).first();
  await coils.locator('input').fill('1');
  await page.locator('#de-conn-sel').selectOption('series');
  await expect(coils.locator('.ui-field-dq-btn')).toHaveCount(0);
  await page.locator('#de-conn-sel').selectOption('parallel');
  await expect(coils.locator('.ui-field-dq-btn')).toHaveAttribute('title', new RegExp(WARNING));
  await expect(page.getByTestId('de-conn-dq')).toHaveAttribute('title', new RegExp(WARNING));
  await coils.locator('input').fill('2');
  await expect(coils.locator('.ui-field-dq-btn')).toHaveCount(0);
  await expect(page.getByTestId('de-conn-dq')).toHaveCount(0);
}

test('Desktop: Parallel on a 1-coil driver shows the warning', async ({page}) => {
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  await page.locator('.edit-btn', {hasText: 'Edit'}).click();
  await page.locator('.de-body').waitFor({state: 'visible'});
  await pickParallelOnOneCoil(page);
});

test('Phone: Parallel on a 1-coil driver shows the warning', async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Driver'}).click();
  await page.getByText('Edit', {exact: true}).click();
  await expect(page.locator('.de-body')).toBeVisible();
  await pickParallelOnOneCoil(page);
});
