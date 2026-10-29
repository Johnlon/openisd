import {expect, openAProject, test} from '../fixtures.js';
import {measureFieldContent} from '../fixtures/fieldVisualContract.js';
import {fillAndBlur} from '../fixtures/numField.js';

/**
 * The Driver tab's voice-coil temperature rise and added mass are UIFixedFields
 * (bugs/BUG_20261005_no-common-ui-field-component.md): a number that is always there, so an
 * emptied box is refused (kept, red, with a ⚠) instead of being stored as 0.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
});

for (const label of ['Voice coil temp rise', 'Added mass to cone']) {
  test(`${label}: an emptied box is refused with a ⚠ and Esc restores the stored value`, async ({ page }) => {
    const row = page.locator('.ui-field', { hasText: label });
    const box = row.locator('input');
    await fillAndBlur(box, '7');
    await box.fill('');
    await expect(box).toHaveValue('');
    await expect(row.locator('.ui-field-dq-btn')).toBeVisible();
    await box.press('Escape');
    await expect(box).toHaveValue(/^7(\.0+)?$/);
  });
}


test('all three advanced driver boxes have equal width', async ({page}) => {
  const widths = await page.locator('.driver-columns .ui-field input').evaluateAll(inputs => inputs.map(input => input.getBoundingClientRect().width));
  expect(widths).toHaveLength(3);
  for (const width of widths) expect(width).toBe(widths[0]);
  const units = await page.locator('.driver-advanced-fields .ui-field-unit').evaluateAll(elements=>elements.map(element=>element.getBoundingClientRect().width));
  for (const width of units) expect(width).toBe(units[0]);
  expect((await page.locator('.driver-advanced-fields').evaluate(measureFieldContent)).issues).toEqual([]);
});
