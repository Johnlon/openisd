import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

/** The box type reads "ABC" and "6th Order Bandpass" in the mobile box picker (John, 2026-10-15). */
test.use({viewport: {width: 390, height: 844}});

test('the box picker lists ABC, and picking it shows ABC', async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Box'}).click();

  const picker = page.locator('#mob-box-type');
  await expect(picker.locator('option')).toHaveText(['Closed', 'Vented', 'Passive Radiator', '4th Order Bandpass', '6th Order Bandpass', 'ABC']);

  await picker.selectOption('abc');
  await expect(picker.locator('option:checked')).toHaveText('ABC');
  await expect(page.locator('.mob-tab')).toHaveText(['Box', 'Driver', 'Signal', 'Filters', 'Graph']);

  await picker.selectOption('bandpass6');
  await expect(picker.locator('option:checked')).toHaveText('6th Order Bandpass');
});
