import {expect, focusedIsModified, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';

/**
 * The mobile sheet's Port area rows in Tune and Learn modes (John, 2026-10-15):
 * - Stepper steps the port area.
 * - Tap on the value opens the port overlay without keyboard popping up.
 * - In Tune mode, port edits write directly to the project.
 * - In Learn mode, port edits update the What-if layer and leave the project unmodified.
 */
test.use({hasTouch: true, viewport: {width: 390, height: 844}});

async function openSheet(page: Page, type: string, mode: 'tune' | 'learn' = 'tune'): Promise<void> {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', {hasText: 'Box'}).click();
  await page.locator('#mob-box-type').selectOption(type);
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
  await page.getByRole('button', {name: 'Open Tune'}).click();
  const sheet = page.locator('.mob-sheet');
  await expect(sheet).toBeVisible();
  if (mode === 'learn') {
    await sheet.locator('.mob-sheet-modes').getByRole('button', {name: 'Learn'}).click();
    await expect(page.locator('.mob-sheet-learn')).toBeVisible();
  }
}

const cell = (page: Page, title: string) =>
  page.locator('.mob-sheet-cell', {has: page.locator(`.mob-sheet-label[title="${title}"]`)});

test('vented Tune: ▲ steps the port area', async ({page}) => {
  await openSheet(page, 'vented', 'tune');
  const area = cell(page, 'Port area').locator('input');
  const before = Number(await area.inputValue());
  await cell(page, 'Port area').getByTitle('Increase').tap();
  await expect.poll(async () => Number(await area.inputValue())).toBeGreaterThan(before);
});

test('vented Tune: tap on area opens port fields, edit writes to the project', async ({page}) => {
  await openSheet(page, 'vented', 'tune');
  const area = cell(page, 'Port area').locator('input');
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
  expect(await focusedIsModified(page)).toBe(true);

  // Close sheet: project is still modified
  await page.getByRole('button', {name: 'Close'}).tap();
  expect(await focusedIsModified(page)).toBe(true);
});

test('vented Learn: a tap opens port fields, an edit moves the area, Close returns', async ({page}) => {
  await openSheet(page, 'vented', 'learn');
  const area = cell(page, 'Port area').locator('input');
  const before = Number(await area.inputValue());

  await area.tap();
  const port = page.getByRole('dialog', {name: 'Port'});
  await expect(port).toBeVisible();
  await expect(area).not.toBeFocused();

  const diameter = port.locator('.ui-field', {hasText: 'Vent diameter'}).locator('input');
  await diameter.fill('8');
  await diameter.blur();
  await port.getByRole('button', {name: 'Close'}).tap();

  await expect(port).toHaveCount(0);
  await expect.poll(async () => Number(await area.inputValue())).toBeGreaterThan(before);
});

test('6th-order bandpass: rear and front port-area rows each open their own port dialog', async ({page}) => {
  await openSheet(page, 'bandpass6', 'tune');
  await cell(page, 'Rear port area').locator('input').tap();
  await expect(page.getByRole('dialog', {name: 'Rear port'})).toBeVisible();
  await page.getByRole('button', {name: 'Close'}).first().tap();
  await cell(page, 'Front port area').locator('input').tap();
  await expect(page.getByRole('dialog', {name: 'Front port'})).toBeVisible();
});

test('Learn: the project is not changed by an edit made in the port fields', async ({page}) => {
  await openSheet(page, 'vented', 'learn');
  await cell(page, 'Port area').locator('input').tap();
  const port = page.getByRole('dialog', {name: 'Port'});
  const length = port.locator('.ui-field', {hasText: 'Vent length'}).locator('input');
  await length.fill('30');
  await length.blur();
  await port.getByRole('button', {name: 'Close'}).tap();
  await page.getByRole('button', {name: 'Close'}).tap();
  expect(await focusedIsModified(page)).toBe(false);
  await expect(page.locator('.mob-open-project-dot')).toHaveCount(0);
});
