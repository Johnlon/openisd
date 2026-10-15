import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

/** The box type reads "ABC" and "6th Order Bandpass" in the mobile box picker and the tab bar (John, 2026-10-15). */
test.use({viewport: {width: 390, height: 844}});

test('the box picker lists ABC, and picking it names the tab ABC', async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Box'}).click();

  const picker = page.locator('#mob-box-type');
  await expect(picker.locator('option')).toHaveText(['Closed', 'Vented', 'Passive Radiator', '4th Order Bandpass', '6th Order Bandpass', 'ABC']);

  await picker.selectOption('abc');
  await expect(page.locator('.mob-tab', {hasText: /^ABC$/})).toBeVisible();
  await expect(page.locator('.mob-tab', {hasText: /^abc$/})).toHaveCount(0);

  await picker.selectOption('bandpass6');
  await expect(page.locator('.mob-tab', {hasText: '6th Order Bandpass'})).toBeVisible();
});
