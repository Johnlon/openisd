/** Desktop vented-alignment readouts use the shared grey toggle-unit control with no gap. */
import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAProject, test} from '../fixtures.js';

test('desktop vented alignment unit chips join their value controls', async ({appPage: page}) => {
  await page.goto('/');
  await openAProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
  await page.locator('#og-box-type').selectOption('vented');
  await page.locator('button.link-btn[title*="vented-box alignment"]').click();

  const modal = page.locator('.alignment-modal');
  await expect(modal).toBeVisible();
  const fields = modal.locator('.ui-field');
  await expect(fields).toHaveCount(2);
  const details = await fields.evaluateAll(elements => elements.map(element => {
      const value = element.querySelector<HTMLElement>('.ui-field-value')!;
      const unit = element.querySelector<HTMLElement>('.ui-field-unit')!;
      const unitStyle = getComputedStyle(unit);
      return {
        label: element.querySelector('label')?.textContent?.trim(),
        gap: unit.getBoundingClientRect().left - value.getBoundingClientRect().right,
        background: unitStyle.backgroundColor,
        borderLeft: unitStyle.borderLeftWidth,
        role: unit.getAttribute('role'),
        underline: unitStyle.textDecorationLine,
        overflow: element.getBoundingClientRect().right > innerWidth || element.getBoundingClientRect().left < 0,
      };
  }));
  const issues = details.filter(detail => detail.gap > 0.5
    || detail.background !== 'rgb(239, 239, 239)'
    || detail.borderLeft !== '0px'
    || detail.role !== 'button'
    || !detail.underline.includes('underline')
    || detail.overflow);
  expect(issues).toEqual([]);
});
