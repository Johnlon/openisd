import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({appPage: page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('#mob-box-type').selectOption('vented');
  await page.locator('.mob-clink').filter({hasText: 'Choose alignment'}).click();
});

test('vented alignment readouts fill their value column and look read-only', async ({appPage: page}) => {
  const fields = page.locator('.mob-align-sheet .ui-field');
  await expect(fields).toHaveCount(2);

  for (const field of await fields.all()) {
    const readout = field.locator('.ui-field-value > input[readonly]');
    await expect(readout).toBeVisible();
    const geometry = await readout.evaluate(element => ({
      valueWidth: element.getBoundingClientRect().width,
      columnWidth: element.parentElement!.getBoundingClientRect().width,
    }));
    expect(geometry.valueWidth).toBeGreaterThan(geometry.columnWidth * 0.9);
  }
});
