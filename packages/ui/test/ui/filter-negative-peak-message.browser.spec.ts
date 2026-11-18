/**
 * A Peaking 2nd order highpass with a negative peak gain draws no curve; the engine says why and
 * the Filters list shows what it says (bugs/BUG_20261118_peak-highpass-negative-gain-nan.md, QO951).
 * A user's journey on each shell: add the filter, type -6 dB at 50 Hz, read the message.
 */
import type {Locator, Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

const MESSAGE = /WinISD closes when this filter has a negative peak gain, but a peak gain below 0 dB has no curve to draw, so OpenISD keeps the value and draws no curve for this filter \(here -6 dB at 50 Hz\)\./;

function field(scope: Locator, label: string): Locator {
  return scope.locator('.ui-field').filter({has: scope.page().locator('label').filter({hasText: new RegExp(`^${label}$`)})}).locator('input');
}

async function expectNotClipped(page: Page, message: Locator): Promise<void> {
  await expect(message).toBeVisible();
  const box = (await message.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await message.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
}

test('desktop: a Peak HP filter at -6 dB shows the engine message in the list, and 6 dB does not', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', {hasText: 'Filters'}).click();
  const panel = page.locator('.content-panel');
  await panel.locator('.action-btn', {hasText: '+ Peak HP'}).click();
  await expect(panel.getByText('WinISD closes when this filter')).toHaveCount(0);
  await fillAndBlur(field(panel, 'Gpk'), '-6');
  await fillAndBlur(field(panel, 'fpk'), '50');
  const message = panel.locator('.filter-issue');
  await expect(message).toHaveText(MESSAGE);
  await expectNotClipped(page, message);
  await fillAndBlur(field(panel, 'Gpk'), '6');
  await expect(message).toHaveCount(0);
});

test('phone: a Peak HP filter at -6 dB shows the engine message on its card', async ({appPage: page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Filters'}).click();
  await page.getByText('+ Peak HP', {exact: true}).click();
  const card = page.locator('.mob-fcard');
  await fillAndBlur(field(card, 'Gpk'), '-6');
  await fillAndBlur(field(card, 'fpk'), '50');
  const message = card.locator('.filter-issue');
  await expect(message).toHaveText(MESSAGE);
  await expectNotClipped(page, message);
});
