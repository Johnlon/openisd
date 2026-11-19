/**
 * A vent whose tuning the geometry cannot reach: the length is blank with a warning mark; tapping it
 * shows the message once, in a popup, with no row moved (bugs/BUG_20261016_abc-rear-vent-cleared-tuning-blanks-length.md).
 * The chart that cannot be drawn shows the same reason in its "Can't plot" panel, and the field shows it too:
 * chart and field both show the reason, on the phone as well, where the two are on different tabs
 * (John, 19 Nov 2026, QO955.c3: "if a chart cannot be drawn then the chart should show the reason message, and the
 * related fields also, this is particularly important on the mobile where we can't see the chart and fields at the same time").
 * Covered: the ABC rear port, the ABC front port and the vented box, desktop and phone.
 *
 * Set SHOT_DIR and SHOT_NAME to save a screenshot of the opened message.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import {fillAndCommit, PageOps, setNumField} from '../fixtures/numField.js';
import type {Locator, Page} from '@playwright/test';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

const UNREACHABLE = /can't reach that tuning/;
const shotDir = process.env['SHOT_DIR'];
const shotName = process.env['SHOT_NAME'] ?? 'shot';

/** Saves a screenshot when SHOT_DIR is set. */
async function saveShot(page: Page, skin: string): Promise<void> {
  if (shotDir !== undefined) await page.screenshot({path: `${shotDir}/${skin}-${shotName}.png`});
}

/** Taps the field's warning mark and returns the message it opens, counted inside the field's own popup only. */
async function openMessage(field: Locator): Promise<Locator> {
  await field.locator('.ui-field-dq-btn').click();
  return field.getByText(UNREACHABLE);
}

/** The chart's "Can't plot" panel that carries the reason (the chart must show it, not only the field). */
function chartPanel(page: Page): Locator {
  return page.locator('.gmsg', {has: page.getByText(/Can.t plot/)}).filter({hasText: UNREACHABLE}).first();
}

/** Checks the chart's "Can't plot" panel is visible and shows the same reason as the field. */
async function checkChartShowsReason(page: Page, skin: string): Promise<void> {
  const panel = chartPanel(page);
  await expect(panel).toBeVisible();
  await expect(panel.getByText(UNREACHABLE).first()).toBeVisible();
  if (shotDir !== undefined) await page.screenshot({path: `${shotDir}/${skin}-${shotName}-chart.png`});
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
  const note = await openMessage(field);
  await saveShot(page, skin);
  await expect(note).toHaveCount(1);
  await expect(note).toBeVisible();
  expect(await insideWindow(page, note)).toBe(true);
  expect(await boxOf(resonance, field)).toEqual(before);
  await field.locator('.ui-field-dq-btn').click();
  await expect(note).toBeHidden();
}

/** The phone's graph tab. */
async function showPhoneChart(page: Page): Promise<void> {
  await page.locator('.mob-tab', {hasText: 'Graph'}).click();
}

test.describe('Original skin', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await expect(page.getByText(/Project imported/)).toBeHidden();
  });

  test('an unreachable rear tuning shows its message once in the field popup, moves no row, and the chart shows the reason too (QO955.c3)', async ({page}) => {
    await page.locator('#og-box-type').selectOption('abc');
    await page.locator('.project-nav li', {hasText: 'Box'}).first().click();
    await setNumField(page, 'Tuning freq (Frc)', '2000', page.locator('.tab-section.active'));
    await page.locator('.project-nav li', {hasText: 'ABC'}).click();
    const length = page.locator('.ui-field', {has: page.locator('#og-vent-length-rear')});
    const resonance = page.locator('.vent-col').first().locator('.field', {hasText: '1st port resonance'});
    await expect(resonance).toBeVisible();
    await checkPopup(page, length, resonance, 'desktop');
    await checkChartShowsReason(page, 'desktop');
  });

  test('an unreachable front tuning shows the reason in the field popup and on the chart (QO955.c3)', async ({page}) => {
    await page.locator('#og-box-type').selectOption('abc');
    await page.locator('.project-nav li', {hasText: 'Box'}).first().click();
    await setNumField(page, 'Tuning freq (Ffc)', '900', page.locator('.tab-section.active'));
    await page.locator('.project-nav li', {hasText: 'ABC'}).click();
    const length = page.locator('.ui-field', {has: page.locator('#og-vent-length-front')});
    const resonance = page.locator('.vent-col').nth(1).locator('.field', {hasText: '1st port resonance'});
    await expect(resonance).toBeVisible();
    await checkPopup(page, length, resonance, 'desktop-front');
    await checkChartShowsReason(page, 'desktop-front');
  });

  test('an unreachable vented tuning shows the reason in the field popup and on the chart (QO955.c3)', async ({page}) => {
    await new PageOps(page).setNum('#og-fb-target', '200');
    await page.locator('.project-nav li', {hasText: 'Vented'}).click();
    const length = page.locator('.ui-field', {has: page.locator('#og-vent-length')});
    const resonance = page.locator('.vent-col').first().locator('.field', {hasText: '1st port resonance'});
    await expect(resonance).toBeVisible();
    await checkPopup(page, length, resonance, 'desktop-vented');
    await checkChartShowsReason(page, 'desktop-vented');
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

  test('an unreachable rear tuning shows its message once in the field popup, moves no row, and the chart shows the reason too (QO955.c3)', async ({page}) => {
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption('abc');
    const tuning = page.locator('.ui-field', {hasText: 'Frc'}).locator('input');
    await fillAndCommit(tuning, '2000');
    const rear = page.locator('.mob-csection', {has: page.locator('.mob-band-title', {hasText: 'Rear vent'})});
    const length = rear.locator('.ui-field', {hasText: 'Vent length'});
    const resonance = rear.locator('.ui-field', {hasText: '1st port resonance'});
    await expect(resonance).toBeVisible();
    await checkPopup(page, length, resonance, 'phone');
    await showPhoneChart(page);
    await checkChartShowsReason(page, 'phone');
  });

  test('an unreachable front tuning shows the reason in the field popup and on the chart (QO955.c3)', async ({page}) => {
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption('abc');
    await fillAndCommit(page.locator('.ui-field', {hasText: 'Ffc'}).locator('input'), '900');
    const front = page.locator('.mob-csection', {has: page.locator('.mob-band-title', {hasText: 'Front vent'})});
    const length = front.locator('.ui-field', {hasText: 'Vent length'});
    const resonance = front.locator('.ui-field', {hasText: '1st port resonance'});
    await expect(resonance).toBeVisible();
    await checkPopup(page, length, resonance, 'phone-front');
    await showPhoneChart(page);
    await checkChartShowsReason(page, 'phone-front');
  });

  test('an unreachable vented tuning shows the reason in the field popup and on the chart (QO955.c3)', async ({page}) => {
    await page.locator('.mob-tab', {hasText: 'Box'}).click();
    await page.locator('#mob-box-type').selectOption('vented');
    await fillAndCommit(mobileFieldRow(page, 'Fb').locator('input'), '200');
    const length = mobileFieldRow(page, 'Vent length');
    const resonance = mobileFieldRow(page, '1st port resonance');
    await expect(resonance).toBeVisible();
    await checkPopup(page, length, resonance, 'phone-vented');
    await showPhoneChart(page);
    await checkChartShowsReason(page, 'phone-vented');
  });
});
