/**
 * The phone New project wizard, passive-radiator step: a pick always fills every box, whatever the
 * user did to the boxes before (John, 1 Nov 2026: installed phone app, every radiator left blank).
 * Does only what a user does, at John's phone size (374x705).
 */
import type {Page} from '@playwright/test';
import {expect, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

const TEST_DRIVER = 'Tang Band W5-1138SMF';
const BOXES = ['#np-pr-name', '#np-pr-vas', '#np-pr-qms', '#np-pr-fs', '#np-pr-sd', '#np-pr-xmax'] as const;

test.use({viewport: {width: PIXEL_9.width, height: PIXEL_9.height}});

async function openWizardAtRadiatorStep(page: Page, fromMenu = false): Promise<void> {
  if (fromMenu) await tapMobileMenuItem(page, 'New project'); else await page.getByText('New project').click();
  await page.getByText(TEST_DRIVER).click();
  const next = page.locator('.mob-np-footer').getByText('Next ▸', {exact: true});
  await next.click();
  await next.click();
  await page.locator('#np-box-type').selectOption('box-passive-radiator');
  await next.click();
}

async function pickE150(page: Page): Promise<void> {
  await page.locator('#np-pr-select').click();
  await page.locator('.pr-lib-item .pr-lib-name', {hasText: 'E150HE-PR'}).first().click();
}

async function expectAllFilled(page: Page, why: string): Promise<void> {
  for (const id of BOXES) await expect(page.locator(id), `${why}: ${id}`).toHaveValue(/\S/);
}

test.beforeEach(async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
});

test('(a) emptying Vas, then picking the same radiator again, fills every box', async ({page}) => {
  await openWizardAtRadiatorStep(page);
  await pickE150(page);
  await expectAllFilled(page, 'first pick');
  const vas = await page.locator('#np-pr-vas').inputValue();
  await page.locator('#np-pr-vas').fill('');
  await pickE150(page);
  await expectAllFilled(page, 'after emptying Vas and picking again');
  await expect(page.locator('#np-pr-vas')).toHaveValue(vas);
});

test('(b)(d) a second wizard, after a created project or a cancelled one, fills every box on a pick', async ({page}) => {
  await openWizardAtRadiatorStep(page);
  await pickE150(page);
  await page.locator('#np-pr-fs').fill('');
  await page.locator('.mob-np-footer').getByText('Cancel', {exact: true}).click();
  await expect(page.locator('.mob-np-overlay')).toBeHidden();

  await openWizardAtRadiatorStep(page);
  const next = page.locator('.mob-np-footer').getByText('Next ▸', {exact: true});
  await pickE150(page);
  await expectAllFilled(page, 'after a cancelled wizard');
  await next.click();
  await page.locator('.mob-np-footer').getByText(/Create/).click();
  await expect(page.locator('.mob-np-overlay')).toBeHidden();

  await openWizardAtRadiatorStep(page, true);
  await pickE150(page);
  await expectAllFilled(page, 'after a created project');
});

test('(4) touching the boxes while the pick is still loading never leaves a blank after it arrives', async ({page}) => {
  await page.route(/\/drivers\/.+e150he-pr\.json$/, async route => { await new Promise(r => setTimeout(r, 1500)); await route.continue(); });
  await openWizardAtRadiatorStep(page);
  await pickE150(page);
  // The picker is closed and the record has not arrived: tap each box and leave it, as a phone keyboard does.
  for (const id of BOXES) {
    await page.locator(id).click();
    await page.locator('.mob-np-title').click();
  }
  // A tap that lands on the stepper beneath the closing picker.
  await page.locator('.np-pr-step button[title="Increase"]').first().click();
  await expectAllFilled(page, 'after the delayed load');
  await expect(page.locator('.np-pr-error')).toHaveCount(0);
});
