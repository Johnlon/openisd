/**
 * The mobile What-if? sheet: the pull-tab under the charts opens it, a stepper press changes the
 * charts live, and the project is never changed — no unsaved marker. Close, or dragging the sheet
 * down, ends the What-if and the charts show the project's own values again. While it is open the
 * chart's Auto Y box shows (John, 2026-10-05).
 */
import {curvesSplSum, expect, focusedBoxVolume, focusedIsModified, openAMobileProject, test} from '../fixtures.js';
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

async function openSheetAndStepVolume(page: Page, volume: number, spl: number) {
  await page.getByRole('button', { name: 'Open What-if?' }).click();
  const sheet = page.locator('.mob-what-if-sheet');
  await expect(sheet).toBeVisible();
  const row = sheet.locator('.mob-what-if-row', { has: page.locator('.mob-what-if-label', { hasText: 'Box volume' }) });
  await row.getByTitle('Increase').click();
  await expect.poll(() => focusedBoxVolume(page)).toBeGreaterThan(volume);
  await expect.poll(() => curvesSplSum(page)).not.toBe(spl);
  return sheet;
}

test('the mobile What-if? sheet changes the charts but never the project; Close puts the curve back', async ({ page }) => {
  const panel = await openGraph(page);
  await expect(panel).not.toHaveAttribute('data-y-range', '');
  await expect(panel.getByRole('checkbox', { name: 'Auto Y' })).toHaveCount(0);
  expect(await focusedIsModified(page)).toBe(false);

  const volume = await focusedBoxVolume(page);
  const spl = await curvesSplSum(page);

  const sheet = await openSheetAndStepVolume(page, volume, spl);
  await expect(panel.getByRole('checkbox', { name: 'Auto Y' })).toHaveCount(1);
  await expect(sheet.getByRole('button', { name: 'Done' })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  expect(await focusedIsModified(page)).toBe(false);
  await expect(page.locator('.mob-open-project-dot')).toHaveCount(0);

  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => focusedBoxVolume(page)).toBe(volume);
  await expect.poll(() => curvesSplSum(page)).toBe(spl);
  expect(await focusedIsModified(page)).toBe(false);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.mob-tab', { hasText: 'Graph' }).click();
  await expect.poll(() => focusedBoxVolume(page)).toBe(volume);
  expect(await focusedIsModified(page)).toBe(false);
});

test('dragging the mobile What-if? sheet down closes it and ends the What-if', async ({ page }) => {
  await openGraph(page);
  const volume = await focusedBoxVolume(page);
  const spl = await curvesSplSum(page);
  const sheet = await openSheetAndStepVolume(page, volume, spl);

  await dragToBottom(page, sheet.getByRole('separator', { name: 'Drag to resize What-if?' }));

  await expect(sheet).toHaveCount(0);
  await expect.poll(() => focusedBoxVolume(page)).toBe(volume);
  await expect.poll(() => curvesSplSum(page)).toBe(spl);
  expect(await focusedIsModified(page)).toBe(false);
});

test('leaving the Graph page with the mobile What-if? sheet open ends the What-if', async ({ page }) => {
  await openGraph(page);
  const volume = await focusedBoxVolume(page);
  const spl = await curvesSplSum(page);
  await openSheetAndStepVolume(page, volume, spl);

  await page.locator('.mob-tab', { hasText: 'Box' }).click();
  await expect.poll(() => focusedBoxVolume(page)).toBe(volume);
  expect(await focusedIsModified(page)).toBe(false);
});
