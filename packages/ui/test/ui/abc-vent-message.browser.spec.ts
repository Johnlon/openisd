/**
 * An ABC rear vent whose tuning the geometry cannot reach: the length is blank with a warning
 * mark; tapping it shows the message once, in its own space under the length, with the rows
 * below it still visible (bugs/BUG_20261016_abc-rear-vent-cleared-tuning-blanks-length.md).
 *
 * Set SHOT_DIR and SHOT_NAME to save a screenshot of the opened message.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {fillAndCommit, setNumField} from '../fixtures/numField.js';
import type {Locator, Page} from '@playwright/test';

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

/** True when the message ends above the row, so it covers none of it. */
async function endsAbove(note: Locator, row: Locator): Promise<boolean> {
  const noteBox = await note.boundingBox();
  const rowBox = await row.boundingBox();
  return noteBox !== null && rowBox !== null && noteBox.y + noteBox.height <= rowBox.y + 1;
}

test.describe('Original skin', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await expect(page.getByText(/Project imported/)).toBeHidden();
  });

  test('an unreachable rear tuning shows its message once and covers no row', async ({page}) => {
    await page.locator('#og-box-type').selectOption('abc');
    await page.locator('.project-nav li', {hasText: 'Box'}).first().click();
    await setNumField(page, 'Tuning freq (Frc)', '2000');
    await page.locator('.project-nav li', {hasText: 'ABC'}).click();
    const length = page.locator('.ui-field', {has: page.locator('#og-vent-length-rear')});
    const resonance = page.locator('.vent-col').first().locator('.field', {hasText: '1st port resonance'});
    const note = await openMessage(page, length);
    await saveShot(page, 'desktop');
    await expect(note).toHaveCount(1);
    await expect(resonance).toBeVisible();
    expect(await endsAbove(note, resonance)).toBe(true);
  });
});

test.describe('Mobile skin', () => {
  test.use({viewport: {width: 411, height: 923}});

  test.beforeEach(async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await expect(page.getByText(/Project imported/)).toBeHidden();
  });

  test('an unreachable rear tuning shows its message once and covers no row', async ({page}) => {
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption('abc');
    const tuning = page.locator('.ui-field', {hasText: 'Tuning freq (Frc)'}).locator('input');
    await fillAndCommit(tuning, '2000');
    await page.locator('.mob-tab', {hasText: 'ABC'}).click();
    const rear = page.locator('.mob-panel', {has: page.locator('.mob-panel-head', {hasText: 'Rear vent'})});
    const length = rear.locator('.ui-field', {hasText: 'Vent length'});
    const resonance = rear.locator('.mob-field-row', {hasText: '1st port resonance'});
    const note = await openMessage(page, length);
    await saveShot(page, 'phone');
    await expect(note).toHaveCount(1);
    await expect(resonance).toBeVisible();
    expect(await endsAbove(note, resonance)).toBe(true);
  });
});
