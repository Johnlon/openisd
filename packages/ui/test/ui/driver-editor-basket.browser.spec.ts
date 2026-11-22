import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {driverEditorField, expect, expectChartDrawn, openAProject, openDriverEditor, test} from '../fixtures.js';
import {fillAndBlur, typeInto} from '../fixtures/numField.js';
import {ensureSampleProject, OLD_BASKET_PROJECT_OWPR} from '../fixtures/sampleProject.js';

async function openDimensions(page: Page): Promise<void> {
  await openDriverEditor(page);
  await page.getByRole('button', {name: 'Dimensions', exact: true}).click();
}

test('Basket Diameter refuses 2380 mm and saves 750 mm with a warning', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await openDimensions(page);
  const basket = driverEditorField(page, 'Basket Diameter');
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

test('an old Dayton project displays its loaded basket with a warning and draws a chart', async ({page}) => {
  await page.goto('/');
  await openAProject(page, OLD_BASKET_PROJECT_OWPR);
  const toast = page.locator('.flash').filter({hasText: 'Project imported from old-basket-project.owpr'});
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveText('Project imported from old-basket-project.owpr', {useInnerText: true});
  await expectChartDrawn(page);
  await page.locator('.gpanel canvas').first().hover();
  await expect(page.locator('.cursor-readout .ro-val')).toHaveText(/^-?\d+(?:\.\d+)? dB$/);

  await openDimensions(page);
  const basket = driverEditorField(page, 'Basket Diameter');
  const input = basket.getByRole('textbox');
  await expect(input).toHaveValue('2377.44');
  await input.focus();
  await basket.getByRole('button', {name: 'Why this value is flagged'}).click();
  await expect(basket.getByRole('note')).toHaveText(/2377\.44 mm is outside the normal range.*610\.00 mm/);
  await expect(basket.getByRole('note')).toHaveClass(/ui-field-note-warning/);
  await expect(input).toHaveValue('2377.44');
});

test('a project with a zero basket shows the zero and its warning, and draws a chart', async ({page}) => {
  ensureSampleProject();
  await page.goto('/');
  const text = readFileSync(OLD_BASKET_PROJECT_OWPR, 'utf8').replace('"value":2.37744', '"value":0');
  await page.locator('.original-root input[type=file]').setInputFiles({
    name: 'zero-basket.owpr', mimeType: 'application/json', buffer: Buffer.from(text),
  });
  const toast = page.locator('.flash').filter({hasText: 'Project imported from zero-basket.owpr'});
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveText('Project imported from zero-basket.owpr', {useInnerText: true});
  await expectChartDrawn(page);
  await page.locator('.gpanel canvas').first().hover();
  await expect(page.locator('.cursor-readout .ro-val')).toHaveText(/^-?\d+(?:\.\d+)? dB$/);

  await openDimensions(page);
  const basket = driverEditorField(page, 'Basket Diameter');
  const input = basket.getByRole('textbox');
  await expect(input).toHaveValue('0.00');
  await expect(input).toHaveClass(/\bdq-root\b/);
  await basket.getByRole('button', {name: 'Why this value is flagged'}).click();
  await expect(basket.getByRole('note')).toHaveText(/zero or less is not a physical value/);
});

test('opening a WinISD driver displays the file’s dimensions and range marks', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await openDimensions(page);

  const dimensions = [
    ['Basket Plate Thickness', 'Thick', 11, 11000],
    ['Driver Depth', 'Depth', 22, 22000],
    ['Magnet Depth', 'MagDepth', 66, 66000],
    ['Magnet Diameter', 'Magnet', 44, 44000],
    ['Basket Diameter', 'Basket', 55, 55000],
    ['Outer Diameter', 'Outer', 66, 66000],
  ] as const;
  const name = 'impossible-dimensions.wdr';
  const text = ['[Driver]', 'Brand=Fixture', 'Model=Dimensions', 'numVC=1',
    ...dimensions.map(([, key, value]) => `${key}=${value}`), ''].join('\r\n');
  await page.locator('.de-modal input[type=file]').setInputFiles({
    name, mimeType: 'application/x-winisd-driver', buffer: Buffer.from(text),
  });
  await page.getByRole('button', {name: 'Continue', exact: true}).click();

  const heading = `Driver imported from ${name}`;
  const toast = page.locator('.flash').filter({hasText: heading});
  await expect(toast).toHaveCount(1);
  await expect(toast).toHaveText(heading, {useInnerText: true});
  for (const [label, , , mm] of dimensions) {
    const field = driverEditorField(page, label);
    const input = field.getByRole('textbox');
    await expect(input).toHaveValue(`${mm}.00`);
    await expect(input).toHaveClass(/\bvalue-e\b/);
    await expect(field.getByRole('button', {name: 'Why this value is flagged'})).toBeVisible();
  }
});
