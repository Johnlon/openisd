/**
 * The mobile Box and Enclosure tabs for a 6th-order bandpass and ABC: the front chamber's tuning on the Box tab, and
 * one vent panel per port on the Enclosure tab, each editing its own vent.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

/** The numbers of every vent panel, by panel title, as shown. */
async function shownVentPanels(page: Page): Promise<Record<string, string[]>> {
  const titles = await page.locator('.mob-panel-head', {hasText: /^(Rear|Front|Intra) vent$/}).allTextContents();
  const panels: Record<string, string[]> = {};
  for (const title of titles) {
    panels[title] = await ventPanel(page, title).locator('.ui-field input').evaluateAll(
      els => els.map(el => el instanceof HTMLInputElement ? el.value : ''));
  }
  return panels;
}

async function chooseBox(page: Page, option: 'bandpass6' | 'abc'): Promise<void> {
  await page.locator('.mob-tab', {hasText: 'Box'}).click();
  await page.locator('#mob-box-type').selectOption(option);
}

const ventPanel = (page: Page, title: string) =>
  page.locator('.mob-panel', {has: page.locator('.mob-panel-head', {hasText: title})});

test('bandpass6: the Front chamber panel on the Box tab edits the front chamber tuning', async ({page}) => {
  await chooseBox(page, 'bandpass6');
  const ventedTuning = async (): Promise<string> => {
    await page.locator('#mob-box-type').selectOption('vented');
    const shown = await page.locator('.ui-field', {hasText: 'Tuning'}).locator('input').first().inputValue();
    await page.locator('#mob-box-type').selectOption('bandpass6');
    return shown;
  };
  const before = await ventedTuning();
  const tuning = ventPanel(page, 'Front chamber').locator('.ui-field', {hasText: 'Tuning'}).locator('input');
  await tuning.fill('31.5');
  await tuning.blur();
  await expect(tuning).toHaveValue(/^31\.5/);
  expect(await ventedTuning()).toBe(before);
});

test('bandpass6: one vent panel per port, no pending note, a diameter edit reaches only that vent', async ({page}) => {
  await chooseBox(page, 'bandpass6');
  await page.locator('.mob-tab', {hasText: '6th Order Bandpass'}).click();
  await expect(page.locator('.mob-panel-head', {hasText: /^(Rear|Front) vent$/})).toHaveText(['Rear vent', 'Front vent']);
  await expect(page.locator('body')).not.toContainText('Response model pending');
  const before = await shownVentPanels(page);
  const diameter = ventPanel(page, 'Rear vent').locator('.ui-field', {hasText: 'Vent diameter'}).locator('input');
  await diameter.fill('6.5');
  await diameter.blur();
  const after = await shownVentPanels(page);
  expect(Number(await diameter.inputValue())).toBeCloseTo(6.5, 2);
  expect(after['Front vent']).toEqual(before['Front vent']);
});

test('abc: Rear, Front and Intra vent panels; the Intra length is editable', async ({page}) => {
  await chooseBox(page, 'abc');
  await page.locator('.mob-tab', {hasText: 'ABC'}).click();
  await expect(page.locator('.mob-panel-head', {hasText: /^(Rear|Front|Intra) vent$/})).toHaveText(['Rear vent', 'Front vent', 'Intra vent']);
  const length = ventPanel(page, 'Intra vent').locator('.ui-field', {hasText: 'Vent length'}).locator('input');
  await length.fill('7');
  await length.blur();
  const before = await shownVentPanels(page);
  await length.fill('8');
  await length.blur();
  const after = await shownVentPanels(page);
  expect(Number(await length.inputValue())).toBeCloseTo(8, 2);
  expect(after['Rear vent']).toEqual(before['Rear vent']);
  expect(after['Front vent']).toEqual(before['Front vent']);
});
