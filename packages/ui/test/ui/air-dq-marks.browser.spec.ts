import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {fillAndCommit} from '../fixtures/numField.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

/**
 * The Advanced tab's air boxes explain themselves (BUG_20261101_air-dq-marks-not-shown): a typed
 * sound velocity the air cannot honour stays as typed, and its box and the temperature box it could
 * not solve each show a mark whose text gives the reason. T is cleared first so it is the open box.
 * Both skins; the phone at John's 374x705 with nothing clipped.
 */

const REASON = /no temperature in range gives this c/;
const C_TOO_HOT = '900';

async function expectMarkWithReason(box: Locator): Promise<void> {
  const mark = box.locator('.ui-field-dq-btn');
  await expect(mark).toBeVisible();
  expect(await mark.getAttribute('title')).toMatch(REASON);
}

test('Original: a typed c no temperature gives is marked on the c box and the temperature box, with the reason', async ({appPage: page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('li', {hasText: /^Advanced$/}).click();
  const field = (label: string) => page.locator('.field', {hasText: label});
  await fillAndCommit(field('Temperature').locator('input'), '');
  await fillAndCommit(field('Sound velocity').locator('input'), C_TOO_HOT);
  await expect(field('Sound velocity').locator('input')).toHaveValue(/900/);
  await expectMarkWithReason(field('Sound velocity'));
  await expectMarkWithReason(field('Temperature'));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow, 'no horizontal page scroll').toBe(false);
});

async function mobileAdvanced(page: Page): Promise<void> {
  await forceMobileSkin(page);
  await page.setViewportSize(PIXEL_9);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-item', {hasText: 'Advanced'}).click();
}

test('Phone 374x705: the same marks, and nothing clipped or scrolling sideways', async ({page}) => {
  await mobileAdvanced(page);
  await fillAndCommit(mobileFieldRow(page, 'Temperature').locator('input'), '');
  await fillAndCommit(mobileFieldRow(page, 'Sound velocity').locator('input'), C_TOO_HOT);
  await expect(mobileFieldRow(page, 'Sound velocity').locator('input')).toHaveValue(/900/);
  await expectMarkWithReason(mobileFieldRow(page, 'Sound velocity'));
  await expectMarkWithReason(mobileFieldRow(page, 'Temperature'));
  const clipped = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    outside: [...document.querySelectorAll<HTMLElement>('.mob-dlg input, .mob-dlg button')]
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.right > window.innerWidth + 0.5); }).length,
  }));
  expect(clipped.page, 'no horizontal page scroll').toBe(false);
  expect(clipped.outside, 'nothing outside sideways').toBe(0);
});
