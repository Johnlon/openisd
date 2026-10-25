/**
 * The mobile Graph page's two bottom sheets, Tune and What-if (John, 17 Oct 2026: they are
 * entirely different; one edits the project, the other is for experiments), each opened from its
 * own pull-tab, with no toggle between them:
 * - Tune writes live to the project; edits survive Close and reload.
 * - What-if edits a temporary layer; charts update live but the project is never modified.
 * - Close in What-if discards it; dragging down closes the sheet; leaving Graph ends it.
 * - The two sheets have their own fields.
 */
import {chartPicture, expect, focusedIsModified, openAMobileProject, settledChartPicture, shownBoxVolume, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Locator, Page} from '@playwright/test';

async function openGraph(page: Page) {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  // The import's flash strip (42 px, bottom of the page) takes space from the chart for about two seconds; when it goes
  // the chart grows and is redrawn. The pictures below are taken after that, as the chart stays for the user.
  await expect(page.getByTestId('flash-strip')).toHaveCount(0);
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

test('Tune and What-if each have their own pull-tab, side by side, and no mode toggle', async ({ page }) => {
  await openGraph(page);
  const tune = page.getByRole('button', { name: 'Open Tune' });
  const whatIf = page.getByRole('button', { name: 'Open What-if' });
  await expect(tune).toHaveText('Tune ▲');
  await expect(whatIf).toHaveText('What-if ▲');
  const tuneRect = await tune.evaluate(el => el.getBoundingClientRect());
  const whatIfRect = await whatIf.evaluate(el => el.getBoundingClientRect());
  expect(Math.abs(tuneRect.top - whatIfRect.top)).toBeLessThan(1);
  expect(whatIfRect.left).toBeGreaterThan(tuneRect.right - 1);
  await expect(page.getByText(new RegExp('Lea' + 'rn'))).toHaveCount(0);

  // Tune: its own sheet, no Reset, no mode toggle, no driver Fs row.
  await tune.click();
  const sheet = page.locator('.mob-sheet');
  await expect(sheet).toHaveAttribute('aria-label', 'Tune');
  await expect(sheet.getByRole('separator', { name: 'Drag to resize' })).toBeVisible();
  await expect(sheet.getByRole('group')).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Reset' })).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Close' })).toHaveAttribute('title', 'Close');
  await expect(sheet.locator('.mob-sheet-label', { hasText: /^Fs$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open What-if' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(tune).toBeVisible();
  await expect(whatIf).toBeVisible();

  // What-if: its own sheet, with Reset and the driver's Fs.
  await whatIf.click();
  await expect(sheet).toHaveAttribute('aria-label', 'What-if');
  await expect(sheet.getByRole('button', { name: 'Reset' })).toHaveAttribute('title', "Back to the design's values");
  await expect(sheet.getByRole('button', { name: 'Close' })).toHaveAttribute('title', 'Close. The design is not changed.');
  await expect(sheet.locator('.mob-sheet-label', { hasText: /^Fs$/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Open Tune' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toHaveCount(0);
});

/** The sheet cell's number as shown. */
const shown = async (cell: Locator) => Number(await cell.locator('input').inputValue());

test('Tune: stepping a field modifies the project; edit survives Close and reload', async ({ page }) => {
  const panel = await openGraph(page);
  await expect(panel).not.toHaveAttribute('data-y-range', '');
  await expect(panel.getByRole('checkbox', { name: 'Auto Y' })).toHaveCount(0);
  expect(await focusedIsModified(page)).toBe(false);

  // The settled picture, taken once the chart has stopped changing.
  const closedPicture = await settledChartPicture(page);

  await page.getByRole('button', { name: 'Open Tune' }).click();
  const sheet = page.locator('.mob-sheet');
  await expect(sheet).toBeVisible();
  const initialPicture = await chartPicture(page);

  // Auto Y is in the sheet footer, not on the chart
  await expect(panel.getByRole('checkbox', { name: 'Auto Y' })).toHaveCount(0);
  await expect(sheet.getByRole('checkbox', { name: 'Auto Y' })).toHaveCount(1);

  const cell = sheet.locator('.mob-sheet-cell', { has: page.locator('.mob-sheet-label', { hasText: 'Box volume' }) });
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

test('What-if: stepping a field changes charts but not the project; Close puts curve back', async ({ page }) => {
  await openGraph(page);
  expect(await focusedIsModified(page)).toBe(false);

  // The settled picture, taken once the chart has stopped changing.
  const closedPicture = await settledChartPicture(page);

  await page.getByRole('button', { name: 'Open What-if' }).click();
  const sheet = page.locator('.mob-sheet');
  await expect(sheet).toBeVisible();
  const initialPicture = await chartPicture(page);

  const cell = sheet.locator('.mob-sheet-cell', { has: page.locator('.mob-sheet-label', { hasText: 'Box volume' }) });
  const initialVolume = await shown(cell);
  await cell.getByTitle('Increase').click();

  await expect.poll(() => shown(cell)).toBeGreaterThan(initialVolume);
  await expect.poll(() => chartPicture(page)).not.toBe(initialPicture);

  // Close sheet in What-if mode: values revert
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => chartPicture(page)).toBe(closedPicture);
  expect(await shownBoxVolume(page)).toBe(initialVolume);
  expect(await focusedIsModified(page)).toBe(false);
});

test('a What-if experiment never shows in Tune', async ({ page }) => {
  await openGraph(page);
  const sheet = page.locator('.mob-sheet');
  // The picture with a sheet open (it shows the Auto Y box), as the Tune baseline.
  await page.getByRole('button', { name: 'Open Tune' }).click();
  await expect(sheet).toBeVisible();
  const initialPicture = await chartPicture(page);
  await sheet.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Open What-if' }).click();
  const whatIfCell = sheet.locator('.mob-sheet-cell', { has: page.locator('.mob-sheet-label', { hasText: 'Box volume' }) });
  const initialVolume = await shown(whatIfCell);
  await whatIfCell.getByTitle('Increase').click();
  await expect.poll(() => shown(whatIfCell)).toBeGreaterThan(initialVolume);
  await sheet.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Open Tune' }).click();
  const tuneCell = sheet.locator('.mob-sheet-cell', { has: page.locator('.mob-sheet-label', { hasText: 'Box volume' }) });
  await expect.poll(() => shown(tuneCell)).toBe(initialVolume);
  await expect.poll(() => chartPicture(page)).toBe(initialPicture);
  expect(await focusedIsModified(page)).toBe(false);
});

test('dragging the mobile sheet down closes it and ends What-if What-if', async ({ page }) => {
  await openGraph(page);
  const initialPicture = await settledChartPicture(page);

  await page.getByRole('button', { name: 'Open What-if' }).click();
  const sheet = page.locator('.mob-sheet');
  await expect(sheet).toBeVisible();

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

test('leaving the Graph page with What-if sheet open ends the What-if', async ({ page }) => {
  await openGraph(page);

  await page.getByRole('button', { name: 'Open What-if' }).click();
  const sheet = page.locator('.mob-sheet');
  await expect(sheet).toBeVisible();

  const cell = sheet.locator('.mob-sheet-cell', { has: page.locator('.mob-sheet-label', { hasText: 'Box volume' }) });
  const initialVolume = await shown(cell);
  await cell.getByTitle('Increase').click();
  await expect.poll(() => shown(cell)).toBeGreaterThan(initialVolume);

  await page.locator('.mob-tab', { hasText: 'Box' }).click();
  await expect.poll(() => shownBoxVolume(page)).toBe(initialVolume);
  expect(await focusedIsModified(page)).toBe(false);
});

test.describe('phone keyboard', () => {
  test.use({hasTouch: true, viewport: {width: 374, height: 705}});

  test('phone what-if: keyboard dismiss after stepper does not shove view or close sheet', async ({ page }) => {
    await openGraph(page);

    const whatIfBtn = page.getByRole('button', { name: 'Open What-if' });
    await whatIfBtn.click();

    const sheet = page.locator('.mob-sheet');
    await expect(sheet).toBeVisible();

    const driversCell = sheet.locator('.mob-sheet-cell', { hasText: 'Drivers' });
    const input = driversCell.locator('input');
    const upBtn = driversCell.locator('.num-stepper-btn').first();

    await input.scrollIntoViewIfNeeded();
    await input.tap();
    await expect(input).toHaveValue('1');

    // Keyboard appears (shrinking viewport to soft keyboard height)
    await page.setViewportSize({ width: 374, height: 380 });

    // Stepper ▲ is tapped
    await upBtn.tap();

    // Keyboard dismisses (viewport restored to phone height)
    await page.setViewportSize({ width: 374, height: 705 });

    // Sheet MUST remain open, value incremented to 2, and document/content scroll MUST NOT be shoved up
    await expect(sheet).toBeVisible();
    await expect(input).toHaveValue('2');

    const scrollOffsets = await page.evaluate(() => ({
      windowY: window.scrollY,
      docY: document.documentElement.scrollTop,
      bodyY: document.body.scrollTop,
      contentY: document.querySelector('.mob-content')?.scrollTop ?? 0,
    }));
    expect(scrollOffsets.windowY).toBe(0);
    expect(scrollOffsets.docY).toBe(0);
    expect(scrollOffsets.bodyY).toBe(0);
    expect(scrollOffsets.contentY).toBe(0);
  });
});
