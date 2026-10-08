/**
 * The mobile Box and Enclosure tabs for a 6th-order bandpass and ABC (plan
 * PLAN_20261007_bp6_abc_complete.md steps 7 and 8): the front chamber's tuning on the Box tab, and
 * one vent panel per port on the Enclosure tab, each editing its own vent.
 */
import {expect, focusedBandpass6Tunings, focusedPortVents, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

async function chooseBox(page: Page, option: 'bandpass6' | 'abc'): Promise<void> {
  await page.locator('.mob-tab', {hasText: 'Box'}).click();
  await page.locator('#mob-box-type').selectOption(option);
}

const ventPanel = (page: Page, title: string) =>
  page.locator('.mob-panel', {has: page.locator('.mob-panel-head', {hasText: title})});

test('bandpass6: the Front chamber panel on the Box tab edits the front chamber tuning', async ({page}) => {
  await chooseBox(page, 'bandpass6');
  const before = await focusedBandpass6Tunings(page);
  const tuning = ventPanel(page, 'Front chamber').locator('.ui-field', {hasText: 'Tuning'}).locator('input');
  await tuning.fill('31.5');
  await tuning.blur();
  const after = await focusedBandpass6Tunings(page);
  expect(after.front).toBe(31.5);
  expect(after.vented).toBe(before.vented);
});

test('bandpass6: one vent panel per port, no pending note, a diameter edit reaches only that vent', async ({page}) => {
  await chooseBox(page, 'bandpass6');
  await page.locator('.mob-tab', {hasText: '6th Order Bandpass'}).click();
  await expect(page.locator('.mob-panel-head', {hasText: /^(Rear|Front) vent$/})).toHaveText(['Rear vent', 'Front vent']);
  await expect(page.locator('body')).not.toContainText('Response model pending');
  const before = await focusedPortVents(page);
  const diameter = ventPanel(page, 'Rear vent').locator('.ui-field', {hasText: 'Vent diameter'}).locator('input');
  await diameter.fill('6.5');
  await diameter.blur();
  const after = await focusedPortVents(page);
  expect(after.rear.diameter).toBeCloseTo(0.065, 6);
  expect(after.front.diameter).toBe(before.front.diameter);
});

test('abc: Rear, Front and Intra vent panels; the Intra length is editable', async ({page}) => {
  await chooseBox(page, 'abc');
  await page.locator('.mob-tab', {hasText: 'ABC'}).click();
  await expect(page.locator('.mob-panel-head', {hasText: /^(Rear|Front|Intra) vent$/})).toHaveText(['Rear vent', 'Front vent', 'Intra vent']);
  const length = ventPanel(page, 'Intra vent').locator('.ui-field', {hasText: 'Vent length'}).locator('input');
  await length.fill('7');
  await length.blur();
  expect((await focusedPortVents(page)).intra?.length).toBeCloseTo(0.07, 6);
});
