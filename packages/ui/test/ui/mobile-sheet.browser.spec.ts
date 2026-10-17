/**
 * The mobile bottom sheet (Tune and Learn modes):
 * - Tune writes live to the project; edits survive Close and reload.
 * - Learn edits the What-if layer; charts update live but the project is never modified.
 * - Close in Learn discards the What-if; switching Learn -> Tune also discards.
 * - Dragging down closes the sheet; leaving Graph page ends Learn.
 * - Strings match plan §5.
 */
import {chartPicture, expect, focusedIsModified, openAMobileProject, shownBoxVolume, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Locator, Page} from '@playwright/test';

async function openGraph(page: Page) {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Graph' }).click();
  return page.locator('.mob-chart-cell .gpanel').first();
}

/** Drag `handle` to the bottom of the screen. */
async function dragToBottom(page: Page, handle: Locator) {
  const box = await handle.boundingBox();
  if (box === null) throw new Error('the drag handle is not laid out');
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('no viewport');
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, viewport.height - 1, { steps: 5 });
  await page.mouse.up();
}

test('strings and controls match plan §5 in Tune and Learn modes', async ({ page }) => {
  await openGraph(page);
  const tab = page.getByRole('button', { name: 'Open Tune' });
  await expect(tab).toBeVisible();
  await expect(tab).toHaveText('Tune ▲');
  await tab.click();

  const sheet = page.locator('.mob-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute('aria-label', 'Tune');

  const handle = sheet.getByRole('separator', { name: 'Drag to resize' });
  await expect(handle).toBeVisible();

  const group = sheet.getByRole('group', { name: 'Sheet mode' });
  await expect(group).toBeVisible();
  const tuneBtn = group.getByRole('button', { name: 'Tune' });
  const learnBtn = group.getByRole('button', { name: 'Learn' });

  await expect(tuneBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(tuneBtn).toHaveAttribute('title', 'Change the design');
  await expect(learnBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(learnBtn).toHaveAttribute('title', 'Try values. The design is not changed.');

  await expect(sheet.getByRole('button', { name: 'Reset' })).toHaveCount(0);
  const closeBtn = sheet.getByRole('button', { name: 'Close' });
  await expect(closeBtn).toHaveAttribute('title', 'Close');

  // Switch to Learn mode
  await learnBtn.click();
  await expect(sheet).toHaveAttribute('aria-label', 'Learn');
  await expect(tuneBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(learnBtn).toHaveAttribute('aria-pressed', 'true');

  const resetBtn = sheet.getByRole('button', { name: 'Reset' });
  await expect(resetBtn).toBeVisible();
  await expect(resetBtn).toHaveAttribute('title', "Back to the design's values");
  await expect(closeBtn).toHaveAttribute('title', 'Close. The design is not changed.');

  // Close sheet: closed pull-tab now says Learn ▲
  await closeBtn.click();
  await expect(sheet).toHaveCount(0);
  const learnTab = page.getByRole('button', { name: 'Open Learn' });
  await expect(learnTab).toBeVisible();
  await expect(learnTab).toHaveText('Learn ▲');
});

/** The sheet cell's number as shown. */
const shown = async (cell: Locator) => Number(await cell.locator('input').inputValue());

test('Tune: stepping a field modifies the project; edit survives Close and reload', async ({ page }) => {
  const panel = await openGraph(page);
  await expect(panel).not.toHaveAttribute('data-y-range', '');
  await expect(panel.getByRole('checkbox', { name: 'Auto Y' })).toHaveCount(0);
  expect(await focusedIsModified(page)).toBe(false);

  const closedPicture = await chartPicture(page);

  await page.getByRole('button', { name: 'Open Tune' }).click();
  const sheet = page.locator('.mob-sheet');
  await expect(sheet).toBeVisible();
  const initialPicture = await chartPicture(page);

  // Auto Y shows while sheet is open
  await expect(panel.getByRole('checkbox', { name: 'Auto Y' })).toHaveCount(1);

  // In Tune, volume label is 'V' (short label for Box volume)
  const cell = sheet.locator('.mob-sheet-cell', { has: page.locator('.mob-sheet-label', { hasText: 'V' }) });
  const initialVolume = await shown(cell);
  await cell.getByTitle('Increase').click();

  await expect.poll(() => shown(cell)).toBeGreaterThan(initialVolume);
  await expect.poll(() => chartPicture(page)).not.toBe(initialPicture);

  const tunedVolume = await shown(cell);

  // Close sheet in Tune mode
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toHaveCount(0);

  // Project stays modified and keeps the tuned design
  expect(await chartPicture(page)).not.toBe(closedPicture);
  expect(await focusedIsModified(page)).toBe(true);

  // Reload page: tuned value persists
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.mob-tab', { hasText: 'Graph' }).click();
  expect(await shownBoxVolume(page)).toBe(tunedVolume);
});

test('Learn: stepping a field changes charts but not the project; Close puts curve back', async ({ page }) => {
  await openGraph(page);
  expect(await focusedIsModified(page)).toBe(false);

  const closedPicture = await chartPicture(page);

  await page.getByRole('button', { name: 'Open Tune' }).click();
  const sheet = page.locator('.mob-sheet');
  await expect(sheet).toBeVisible();
  const initialPicture = await chartPicture(page);

  // Switch to Learn mode
  await sheet.locator('.mob-sheet-modes').getByRole('button', { name: 'Learn' }).click();

  // In Learn, volume label is full 'Box volume'
  const cell = sheet.locator('.mob-sheet-cell', { has: page.locator('.mob-sheet-label', { hasText: 'Box volume' }) });
  const initialVolume = await shown(cell);
  await cell.getByTitle('Increase').click();

  await expect.poll(() => shown(cell)).toBeGreaterThan(initialVolume);
  await expect.poll(() => chartPicture(page)).not.toBe(initialPicture);

  // Close sheet in Learn mode: values revert
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => chartPicture(page)).toBe(closedPicture);
  expect(await shownBoxVolume(page)).toBe(initialVolume);
  expect(await focusedIsModified(page)).toBe(false);
});

test('switching Learn to Tune discards the What-if changes', async ({ page }) => {
  await openGraph(page);

  await page.getByRole('button', { name: 'Open Tune' }).click();
  const sheet = page.locator('.mob-sheet');
  await expect(sheet).toBeVisible();
  const initialPicture = await chartPicture(page);

  // Switch to Learn
  await sheet.locator('.mob-sheet-modes').getByRole('button', { name: 'Learn' }).click();
  const learnCell = sheet.locator('.mob-sheet-cell', { has: page.locator('.mob-sheet-label', { hasText: 'Box volume' }) });
  const initialVolume = await shown(learnCell);
  await learnCell.getByTitle('Increase').click();
  await expect.poll(() => shown(learnCell)).toBeGreaterThan(initialVolume);

  // Switch back to Tune: What-if is discarded
  await sheet.locator('.mob-sheet-modes').getByRole('button', { name: 'Tune' }).click();
  const tuneCell = sheet.locator('.mob-sheet-cell', { has: page.locator('.mob-sheet-label', { hasText: 'V' }) });
  await expect.poll(() => shown(tuneCell)).toBe(initialVolume);
  await expect.poll(() => chartPicture(page)).toBe(initialPicture);
  expect(await focusedIsModified(page)).toBe(false);
});

test('dragging the mobile sheet down closes it and ends Learn What-if', async ({ page }) => {
  await openGraph(page);
  const initialPicture = await chartPicture(page);

  await page.getByRole('button', { name: 'Open Tune' }).click();
  const sheet = page.locator('.mob-sheet');
  await expect(sheet).toBeVisible();
  await sheet.locator('.mob-sheet-modes').getByRole('button', { name: 'Learn' }).click();

  const cell = sheet.locator('.mob-sheet-cell', { has: page.locator('.mob-sheet-label', { hasText: 'Box volume' }) });
  const initialVolume = await shown(cell);
  await cell.getByTitle('Increase').click();
  await expect.poll(() => shown(cell)).toBeGreaterThan(initialVolume);

  await dragToBottom(page, sheet.getByRole('separator', { name: 'Drag to resize' }));
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => chartPicture(page)).toBe(initialPicture);
  expect(await shownBoxVolume(page)).toBe(initialVolume);
  expect(await focusedIsModified(page)).toBe(false);
});

test('leaving the Graph page with Learn sheet open ends the What-if', async ({ page }) => {
  await openGraph(page);

  await page.getByRole('button', { name: 'Open Tune' }).click();
  const sheet = page.locator('.mob-sheet');
  await expect(sheet).toBeVisible();
  await sheet.locator('.mob-sheet-modes').getByRole('button', { name: 'Learn' }).click();

  const cell = sheet.locator('.mob-sheet-cell', { has: page.locator('.mob-sheet-label', { hasText: 'Box volume' }) });
  const initialVolume = await shown(cell);
  await cell.getByTitle('Increase').click();
  await expect.poll(() => shown(cell)).toBeGreaterThan(initialVolume);

  await page.locator('.mob-tab', { hasText: 'Box' }).click();
  await expect.poll(() => shownBoxVolume(page)).toBe(initialVolume);
  expect(await focusedIsModified(page)).toBe(false);
});
