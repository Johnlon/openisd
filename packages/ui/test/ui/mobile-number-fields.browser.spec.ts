/** Shared appearance and interaction contract for number fields in the mobile application. */
import {PhoneRowSizes} from '@openisd/design/fields';
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test('number fields keep the classic control geometry across mobile pages and overlays', async ({page}) => {
  const fieldRows = page.locator('.mobile-root .mob-ui-field.ui-field:visible');
  await expect(fieldRows.first()).toBeVisible();

  const mainRow = fieldRows.first();
  await expect(mainRow).toHaveCSS('height', `${PhoneRowSizes.CLASSIC.rowMinPx}px`);

  // Open a field overlay to include controls outside the page frame in the same app-wide contract.
  await page.locator('.mob-clink', {hasText: 'Choose alignment'}).click();
  const visibleRows = page.locator('.mobile-root .mob-ui-field.ui-field:visible');
  const problems = await visibleRows.evaluateAll((rows, sizes) => rows.flatMap(row => {
    const value = row.querySelector<HTMLElement>('.ui-field-value input, .ui-field-value .mob-readonly');
    const unit = row.querySelector<HTMLElement>('.ui-field-unit');
    const stepperButtons = [...row.querySelectorAll<HTMLElement>('.num-stepper-btn')];
    const issues: string[] = [];

    if (Math.abs(row.getBoundingClientRect().height - sizes.row) > 0.5) issues.push('field row is not classic height');
    if (value && Math.abs(value.getBoundingClientRect().height - sizes.input) > 0.5) issues.push('value control is not classic height');
    if (unit && Math.abs(unit.getBoundingClientRect().height - sizes.input) > 0.5) issues.push('unit control is not classic height');
    if (stepperButtons.some(button => button.getBoundingClientRect().height < sizes.input)) issues.push('stepper is shorter than the value control');
    if (unit?.classList.contains('unit-toggle')) {
      const style = getComputedStyle(unit);
      if (style.backgroundColor !== 'rgb(239, 239, 239)') issues.push('toggle unit is missing its shared control fill');
      if (style.textDecorationLine === 'none') issues.push('toggle unit is missing its shared affordance');
      if (!value) issues.push('toggle unit has no value control');
      else {
        const control = value.getBoundingClientRect();
        const chip = unit.getBoundingClientRect();
        if (chip.left < control.left || chip.right > control.right + 0.5 || chip.top < control.top || chip.bottom > control.bottom + 0.5) {
          issues.push('toggle unit is detached from its value control');
        }
      }
    }
    return issues.map(issue => `${row.querySelector('.ui-field-label')?.textContent?.trim() ?? 'unnamed field'}: ${issue}`);
  }), {row: PhoneRowSizes.CLASSIC.rowMinPx, input: PhoneRowSizes.CLASSIC.inputMinPx});

  expect(problems).toEqual([]);
});

test('a mobile number field and its unit control both respond to user input', async ({page}) => {
  const field = page.locator('.mobile-root .mob-ui-field.ui-field')
    .filter({has: page.locator('.ui-field-value input[data-numinput]')})
    .filter({has: page.locator('.ui-field-unit.unit-toggle')}).first();
  const input = field.locator('.ui-field-value input[data-numinput]');
  await expect(input).toBeVisible();
  const unit = field.locator('.ui-field-unit.unit-toggle');
  const originalUnit = (await unit.innerText()).trim();

  await input.fill('17');
  await input.blur();
  expect(Number(await input.inputValue())).toBe(17);

  const valueBeforeUnitChange = Number(await input.inputValue());
  await expect(unit).toBeVisible();
  await unit.click();
  await expect(unit).not.toHaveText(originalUnit);
  expect(Number(await input.inputValue())).not.toBe(valueBeforeUnitChange);
});
