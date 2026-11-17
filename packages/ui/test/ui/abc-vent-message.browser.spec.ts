/**
 * An ABC rear vent whose tuning the geometry cannot reach: the length is blank with a warning
 * mark; tapping it shows the message once, in a popup, with no row moved (bugs/BUG_20261016_abc-rear-vent-cleared-tuning-blanks-length.md).
 *
 * Set SHOT_DIR and SHOT_NAME to save a screenshot of the opened message.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {fillAndCommit, setNumField} from '../fixtures/numField.js';
import type {Locator, Page} from '@playwright/test';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

const UNREACHABLE = /can't reach that tuning/;
const shotDir = process.env['SHOT_DIR'];
const shotName = process.env['SHOT_NAME'] ?? 'shot';

/** Saves a screenshot when SHOT_DIR is set. */
async function saveShot(page: Page, skin: string): Promise<void> {
  if (shotDir !== undefined) await page.screenshot({path: `${shotDir}/${skin}-${shotName}.png`});
}

/** Taps the field's warning mark and returns the message it opens. */
async function openMessage(page: Page, field: Locator): Promise<Locator> {
  await field.locator('.ui-field-dq-btn').click();
  return page.getByText(UNREACHABLE);
}

/** The row's size and its distance below the field, which scrolling the page does not change. */
async function boxOf(row: Locator, field: Locator) {
  const box = await row.boundingBox();
  const anchor = await field.boundingBox();
  expect(box).not.toBeNull();
  expect(anchor).not.toBeNull();
  return {width: box?.width, height: box?.height, below: (box?.y ?? 0) - (anchor?.y ?? 0)};
}

/** True when the popup lies wholly inside the window. */
async function insideWindow(page: Page, note: Locator): Promise<boolean> {
  const box = await note.boundingBox();
  const size = page.viewportSize();
  return box !== null && size !== null && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height;
}

/** Opens the message, then checks it is one popup inside the window, no row moved, and a second tap closes it. */
async function checkPopup(page: Page, field: Locator, resonance: Locator, skin: string): Promise<void> {
  const before = await boxOf(resonance, field);
  const note = await openMessage(page, field);
  await saveShot(page, skin);
  await expect(note).toHaveCount(1);
  await expect(note).toBeVisible();
  expect(await insideWindow(page, note)).toBe(true);
  expect(await boxOf(resonance, field)).toEqual(before);
  await field.locator('.ui-field-dq-btn').click();
  await expect(note).toBeHidden();
}

test.describe('Original skin', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await expect(page.getByText(/Project imported/)).toBeHidden();
  });

  test('an unreachable rear tuning shows its message once in a popup and moves no row', async ({page}) => {
    await page.locator('#og-box-type').selectOption('abc');
    await page.locator('.project-nav li', {hasText: 'Box'}).first().click();
    await setNumField(page, 'Tuning freq (Frc)', '2000', page.locator('.tab-section.active'));
    await page.locator('.project-nav li', {hasText: 'ABC'}).click();
    const length = page.locator('.ui-field', {has: page.locator('#og-vent-length-rear')});
    const resonance = page.locator('.vent-col').first().locator('.field', {hasText: '1st port resonance'});
    await expect(resonance).toBeVisible();
    await checkPopup(page, length, resonance, 'desktop');
  });
});

test.describe('Mobile skin', () => {
  test.use({viewport: PIXEL_9});

  test.beforeEach(async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await expect(page.getByText(/Project imported/)).toBeHidden();
  });

  test('an unreachable rear tuning shows its message once in a popup and moves no row', async ({page}) => {
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption('abc');
    const tuning = page.locator('.ui-field', {hasText: 'Frc'}).locator('input');
    await fillAndCommit(tuning, '2000');
    const rear = page.locator('.mob-csection', {has: page.locator('.mob-band-title', {hasText: 'Rear vent'})});
    const length = rear.locator('.ui-field', {hasText: 'Vent length'});
    const resonance = rear.locator('.ui-field', {hasText: '1st port resonance'});
    await expect(resonance).toBeVisible();
    await checkPopup(page, length, resonance, 'phone');
  });
});
