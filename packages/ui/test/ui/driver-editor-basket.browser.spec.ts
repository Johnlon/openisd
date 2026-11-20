import type {Page} from '@playwright/test';
import {driverEditorField, expect, expectChartDrawn, openAProject, openDriverEditor, test} from '../fixtures.js';
import {fillAndBlur, typeInto} from '../fixtures/numField.js';
import {OLD_BASKET_PROJECT_OWPR} from '../fixtures/sampleProject.js';

async function openDimensions(page: Page): Promise<void> {
  await openDriverEditor(page);
  await page.getByRole('button', {name: 'Dimensions', exact: true}).click();
}

test('Basket Diameter refuses 2380 mm and saves 750 mm with a warning', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await openDimensions(page);
  const basket = driverEditorField(page, 'Basket Diameter (Basket)');
  const input = basket.getByRole('textbox');
  const ok = page.locator('.de-modal').getByRole('button', {name: 'OK', exact: true});
  await expect(basket.locator('.unit-label')).toHaveText('mm');
  await fillAndBlur(input, '165');
  await ok.click();

  await openDimensions(page);
  await expect(input).toHaveValue('165.00');
  await typeInto(input, '2380');
  await expect(input).toHaveValue('2380');
  await expect(basket.getByRole('note')).toHaveText(/above its maximum.*between 10\.00 and 1000\.00 mm/);
  await ok.click();

  await openDimensions(page);
  await expect(input).toHaveValue('165.00');
  await fillAndBlur(input, '750');
  const warning = basket.getByRole('button', {name: 'Why this value is flagged'});
  await warning.click();
  const note = basket.getByRole('note');
  await expect(note).toHaveText(/750\.00 mm is outside the normal range.*610\.00 mm/);
  await expect(note).toHaveClass(/ui-field-note-warning/);
  await ok.click();

  await openDimensions(page);
  await expect(input).toHaveValue('750.00');
  await expect(warning).toBeVisible();
});

test('an old Dayton project opens at the basket minimum, with one repair notice and a chart', async ({page}) => {
  await page.goto('/');
  await openAProject(page, OLD_BASKET_PROJECT_OWPR);
  const toast = page.locator('.flash').filter({hasText: 'Project imported from old-basket-project.owpr'});
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveText(
    'Project imported from old-basket-project.owpr\nBasket Diameter (Basket) 2377.44 mm in the file: set to the 10 mm minimum',
    {useInnerText: true},
  );
  await expectChartDrawn(page);
  await page.locator('.gpanel canvas').first().hover();
  await expect(page.locator('.cursor-readout .ro-val')).toHaveText(/^-?\d+(?:\.\d+)? dB$/);

  await openDimensions(page);
  const basket = driverEditorField(page, 'Basket Diameter (Basket)');
  await expect(basket.getByRole('textbox')).toHaveValue('10.00');
  await expect(basket.getByRole('button', {name: 'Why this value is flagged'})).toHaveCount(0);
});
