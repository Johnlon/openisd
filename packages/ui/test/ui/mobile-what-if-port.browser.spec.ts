import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';

/**
 * The mobile What-if? sheet's Port area row (John, 2026-10-15): ▲▼ steps the area, and a tap on the
 * value opens that port's own fields over the sheet, as the Vents tab shows them; an edit there
 * lands in the What-if and Close returns to the rows with the area updated.
 */
test.use({hasTouch: true, viewport: {width: 390, height: 844}});

async function openWhatIf(page: Page, type: string): Promise<void> {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Box'}).click();
  await page.locator('#mob-box-type').selectOption(type);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  await page.getByRole('button', {name: 'Open What-if?'}).click();
}

const row = (page: Page, label: string) =>
  page.locator('.mob-what-if-row', {has: page.locator('.mob-what-if-label', {hasText: new RegExp(`^${label}$`)})});

test('vented: ▲ steps the port area', async ({page}) => {
  await openWhatIf(page, 'vented');
  const area = row(page, 'Port area').locator('input');
  const before = Number(await area.inputValue());
  await row(page, 'Port area').getByTitle('Increase').tap();
  await expect.poll(async () => Number(await area.inputValue())).toBeGreaterThan(before);
});

test('vented: a tap on the area opens the port fields, an edit there moves the area, Close returns', async ({page}) => {
  await openWhatIf(page, 'vented');
  const area = row(page, 'Port area').locator('input');
  const before = Number(await area.inputValue());

  await area.tap();
  const port = page.getByRole('dialog', {name: 'Port'});
  await expect(port).toBeVisible();
  await expect(area).not.toBeFocused();
  for (const label of ['Number of Vents', 'Shape', 'End Correction', 'Vent diameter', 'Vent length']) {
    await expect(port.getByText(label, {exact: true}).first()).toBeVisible();
  }

  const diameter = port.locator('.ui-field', {hasText: 'Vent diameter'}).locator('input');
  await diameter.fill('8');
  await diameter.blur();
  await port.getByRole('button', {name: 'Close'}).tap();

  await expect(port).toHaveCount(0);
  await expect.poll(async () => Number(await area.inputValue())).toBeGreaterThan(before);
});

test('6th-order bandpass: a rear and a front port-area row, each opens its own port', async ({page}) => {
  await openWhatIf(page, 'bandpass6');
  await row(page, 'Rear port area').locator('input').tap();
  await expect(page.getByRole('dialog', {name: 'Rear port'})).toBeVisible();
  await page.getByRole('button', {name: 'Close'}).first().tap();
  await row(page, 'Front port area').locator('input').tap();
  await expect(page.getByRole('dialog', {name: 'Front port'})).toBeVisible();
});

test('the project is not changed by an edit made in the port fields', async ({page}) => {
  await openWhatIf(page, 'vented');
  await row(page, 'Port area').locator('input').tap();
  const port = page.getByRole('dialog', {name: 'Port'});
  const length = port.locator('.ui-field', {hasText: 'Vent length'}).locator('input');
  await length.fill('30');
  await length.blur();
  await port.getByRole('button', {name: 'Close'}).tap();
  await page.getByRole('button', {name: 'Close'}).tap();
  await expect(page.locator('.mob-open-project-dot')).toHaveCount(0);
});
