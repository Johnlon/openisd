/** BUG_20261016_number-fields-accept-letters, Original skin: letters never go into a number field. */
import {expect, openAProject, test} from '../fixtures.js';
import {pasteInto} from '../fixtures/numField.js';

test('Original: a number field refuses letters typed or pasted and takes the number from a paste', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', {hasText: 'Box'}).click();
  const vol = page.locator('.tab-section.active .ui-field', {hasText: 'Volume'}).first().locator('input').first();

  await vol.click();
  const start = await vol.inputValue();
  await vol.press('Control+a');
  await vol.pressSequentially('a');
  await expect(vol).toHaveValue(start);          // typing a letter: nothing changes

  await pasteInto(vol, '12.5 Hz');
  await expect(vol).toHaveValue('12.5');      // paste: the number in the text

  await pasteInto(vol, 'abc');
  await expect(vol).toHaveValue('12.5');      // paste with no number: the value stays

  await vol.press('Control+a');
  await vol.pressSequentially('12');
  await vol.press('End');
  await pasteInto(vol, 'abc');
  await expect(vol).toHaveValue('12');        // cursor at the end of "12": still 12
});
