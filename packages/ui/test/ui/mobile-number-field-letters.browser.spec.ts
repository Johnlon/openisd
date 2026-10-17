/** BUG_20261016_number-fields-accept-letters, Mobile skin: letters never go into a number field. */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {pasteInto} from '../fixtures/numField.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';

test('Mobile: a number field refuses letters typed or pasted and takes the number from a paste', async ({page}) => {
  await page.setViewportSize({width: 412, height: 900});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Signal'}).click();
  const input = mobileFieldRow(page, 'Series resistance').locator('input');

  await input.click();
  const start = await input.inputValue();
  await input.press('Control+a');
  await input.pressSequentially('a');
  await expect(input).toHaveValue(start);

  await pasteInto(input, '12.5 Hz');
  await expect(input).toHaveValue('12.5');

  await pasteInto(input, 'abc');
  await expect(input).toHaveValue('12.5');

  await input.press('Control+a');
  await input.pressSequentially('12');
  await input.press('End');
  await pasteInto(input, 'abc');
  await expect(input).toHaveValue('12');
});
