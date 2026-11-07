import {readFileSync} from 'node:fs';
import type {Page} from '@playwright/test';
import {expect, openAProject, test} from '../fixtures.js';

/**
 * The desktop Driver tab lists the driver's consistency checks, as the Driver Editor does
 * (bugs/BUG_20261104_driver-consistency-gap-shown-as-zero.md). B&C 18NW100-4 states BL 24.7 Tm
 * where its other figures imply 26.7 Tm.
 *
 * John, 4 Nov 2026 (T662 ruling_layout): the bottom panel never changes height because of the
 * warning. The summary sits in the hint row. John, 4 Nov 2026 (ruling_open_editor): the full error
 * is in the Driver Editor, so clicking the summary opens the Driver Editor with the list showing.
 */
const B_AND_C_18NW100 = readFileSync('packages/ui/public/drivers/b-c-speakers/18nw100-4.json');

/** Dayton CE28M-4: its stated figures agree, so the Driver tab shows no warning. */
const CONSISTENT_DRIVER = readFileSync('packages/ui/public/drivers/dayton-audio/ce28m-4.json');

async function selectDriver(page: Page, file: Buffer): Promise<void> {
  await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  await page.getByRole('button', {name: 'Select Driver'}).click();
  await page.locator('.driver-library input[type="file"]').setInputFiles({
    name: 'driver.owdr', mimeType: 'application/json', buffer: file,
  });
  await expect(page.locator('.driver-library .preview')).toBeVisible();
  await page.locator('.driver-library .use-btn').click();
  await expect(page.locator('.wb-modal')).toHaveCount(0);
}

const panel = (page: Page) => page.locator('.tab-section.active');
const hintRow = (page: Page) => page.locator('.driver-hint-row');
const summary = (page: Page) => page.locator('.driver-consistency-summary');
const editorList = (page: Page) => page.locator('.de-modal .de-inconsistent');

async function height(page: Page, what: ReturnType<typeof panel>): Promise<number> {
  const box = await what.boundingBox();
  if (!box) throw new Error('not on screen');
  return box.height;
}

test('the Driver tab lists the consistency checks of the project driver (18NW100-4: BL disagrees)', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await selectDriver(page, B_AND_C_18NW100);
  await expect(summary(page)).toBeVisible();
  await expect(page.locator('.de-modal')).toHaveCount(0);
  await summary(page).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  await expect(editorList(page)).toContainText('force factor (BL) stated as 24.7 Tm, the others imply 26.7 Tm, 7.7% apart');
});

for (const size of [{width: 1400, height: 900}, {width: 1280, height: 720}, {width: 1024, height: 768}]) {
  test(`the warning never changes the bottom panel height; the summary opens the Driver Editor (${size.width}x${size.height})`, async ({page}) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await openAProject(page);
    await selectDriver(page, CONSISTENT_DRIVER);
    await expect(summary(page)).toHaveCount(0);
    const noWarning = await height(page, panel(page));
    const noWarningRow = await height(page, hintRow(page));

    await selectDriver(page, B_AND_C_18NW100);
    await expect(summary(page)).toBeVisible();
    expect(await height(page, panel(page))).toBe(noWarning);
    expect(await height(page, hintRow(page))).toBe(noWarningRow);

    await summary(page).click();
    await expect(editorList(page)).toBeVisible();
    await page.locator('.de-footer button', {hasText: 'Cancel'}).click();
    await expect(page.locator('.de-modal')).toHaveCount(0);
    expect(await height(page, panel(page))).toBe(noWarning);
    expect(await height(page, hintRow(page))).toBe(noWarningRow);
  });
}

test('the list redraws as the driver is edited; the panel and hint row keep their height', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await selectDriver(page, B_AND_C_18NW100);
  const before = await height(page, panel(page));
  const rowBefore = await height(page, hintRow(page));
  await expect(summary(page)).toContainText('2 values');
  await summary(page).click();
  await expect(editorList(page)).toContainText('force factor (BL)');
  await expect(editorList(page)).toContainText('resonance (Fs)');

  // Set Fs and BL to the values the others imply (32.5 Hz, 26.7 Tm): those two lines go.
  await page.getByRole('button', {name: 'Parameters', exact: true}).click();
  for (const [label, value] of [['Fs', '32.5'], ['BL', '26.7']]) {
    const input = page.locator('.de-modal .de-fld', {has: page.locator('label', {hasText: new RegExp(`^${label}\\b`)})}).locator('input').first();
    await input.click();
    await input.press('Control+a');
    await input.fill(value);
    await input.press('Tab');
  }
  await page.locator('.de-footer button.pri', {hasText: 'OK'}).click();
  await expect(page.locator('.de-modal')).toHaveCount(0);

  await summary(page).click();
  await expect(editorList(page)).toBeVisible();
  await expect(editorList(page)).not.toContainText('force factor (BL)');
  await expect(editorList(page)).not.toContainText('resonance (Fs)');
  const lines = await editorList(page).locator('li').count();
  await expect(summary(page)).toContainText(`${lines} value`);
  await page.locator('.de-footer button', {hasText: 'Cancel'}).click();
  await expect(page.locator('.de-modal')).toHaveCount(0);
  expect(await height(page, panel(page))).toBe(before);
  expect(await height(page, hintRow(page))).toBe(rowBefore);

  // A consistent driver: the summary goes and the row keeps its height.
  await selectDriver(page, CONSISTENT_DRIVER);
  await expect(summary(page)).toHaveCount(0);
  expect(await height(page, panel(page))).toBe(before);
  expect(await height(page, hintRow(page))).toBe(rowBefore);
});
