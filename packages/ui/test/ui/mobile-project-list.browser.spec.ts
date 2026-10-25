/**
 * The open-project rows in the Projects pane: one row per open project, with
 * a show-on-graphs checkbox, a focus tap and a colour swatch.
 */
import {COMPLETE_DRIVER_PROJECT_OWPR, expect, openAMobileProject, renameFocusedProject, test} from '../fixtures.js';
import {forceMobileSkin, openMobileMenu, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';

/** Count distinct opaque colours drawn on the chart: a second trace is a second colour. */
const inkColours = (page: Page) => page.evaluate(() => {
  const c = document.querySelector<HTMLCanvasElement>('.mob-chart-cell canvas');
  const g = c?.getContext('2d');
  if (!c || !g) return 0;
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const seen = new Set<string>();
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
  return seen.size;
});

const graphTab = (page: Page) => page.locator('.mob-tab', { hasText: 'Graph' });
const boxTab = (page: Page) => page.locator('.mob-tab', { hasText: 'Box' });

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test.describe('MobileProjectList', () => {
  test('the Projects pane lists the open project, though it was never saved', async ({ page }) => {
    await tapMobileMenuItem(page, 'Projects');
    const rows = page.locator('.mob-project-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveClass(/active/);
  });

  test('an open project has a show-on-graphs checkbox, ticked by default', async ({ page }) => {
    await tapMobileMenuItem(page, 'Projects');
    await expect(page.locator('.mob-project-show').first()).toBeChecked();
    await page.locator('.mob-project-show').first().uncheck();
    await expect(page.locator('.mob-project-show').first()).not.toBeChecked();
  });

  test('opening the same project twice leaves one row', async ({ page }) => {
    await openAMobileProject(page);
    await tapMobileMenuItem(page, 'Projects');
    const rows = page.locator('.mob-project-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveClass(/active/);
  });

  test('a second open project gets its own row, and a tap on it focuses it', async ({ page }) => {
    await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    await tapMobileMenuItem(page, 'Projects');
    const rows = page.locator('.mob-project-row');
    await expect(rows).toHaveCount(2);
    const secondRow = page.locator('.mob-project-row', { hasText: 'complete-driver-project' });
    const firstRow = page.locator('.mob-project-row', { hasText: 'sample-project' });
    await expect(secondRow).toHaveClass(/active/);
    await firstRow.locator('.mob-project-info').click();
    await expect(page.locator('.mob-projects-pane')).toHaveCount(0);
    await tapMobileMenuItem(page, 'Projects');
    await expect(firstRow).toHaveClass(/active/);
  });

  // bugs/BUG_20261005_project-selection-lost-on-reload.md
  test('a hidden project is still hidden after a reload, and the chart still leaves its trace out', async ({ page }) => {
    await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    // The import message takes a strip above the tab bar, which resizes the chart; count after it is gone.
    await expect(page.getByTestId('flash-strip')).toHaveCount(0);
    await graphTab(page).click();
    await expect.poll(() => inkColours(page)).toBeGreaterThan(0);
    const shown = await inkColours(page);
    await boxTab(page).click();
    await tapMobileMenuItem(page, 'Projects');
    await page.locator('.mob-project-row', { hasText: 'sample-project' }).locator('.mob-project-show').uncheck();
    await page.locator('.mob-dlg-close').click();
    await graphTab(page).click();
    // A chart not yet redrawn has no ink at all; wait for the one trace left, not for an empty canvas.
    await expect.poll(async () => { const ink = await inkColours(page); return ink > 0 && ink < shown; }).toBe(true);
    const hidden = await inkColours(page);

    await page.reload();

    await boxTab(page).click();
    await tapMobileMenuItem(page, 'Projects');
    await expect(page.locator('.mob-project-show')).toHaveCount(2);
    await expect(page.locator('.mob-project-row', { hasText: 'sample-project' }).locator('.mob-project-show')).not.toBeChecked();
    await expect(page.locator('.mob-project-row', { hasText: 'complete-driver-project' }).locator('.mob-project-show')).toBeChecked();
    await page.locator('.mob-dlg-close').click();
    await graphTab(page).click();
    await expect.poll(async () => Math.abs(await inkColours(page) - hidden)).toBeLessThanOrEqual(2);
  });

  test('tapping a project\'s colour swatch changes its colour', async ({ page }) => {
    await tapMobileMenuItem(page, 'Projects');
    const swatch = page.locator('.mob-project-swatch').first();
    const before = await swatch.evaluate(el => getComputedStyle(el).backgroundColor);
    await swatch.click();
    await expect.poll(() => swatch.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(before);
  });
});

test.describe('The menu\'s open projects', () => {
  test('lists the open projects at the top, with tickbox, colour, name and a row at least 48 px tall', async ({ page }) => {
    await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    await openMobileMenu(page);
    const rows = page.locator('.mob-open-project');
    await expect(rows).toHaveCount(2);
    await expect(rows.locator('.mob-open-project-name')).toHaveText(['sample-project', 'complete-driver-project']);
    for (const row of await rows.all()) {
      const box = await row.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
      await expect(row.locator('.mob-open-project-show')).toBeChecked();
      await expect(row.locator('.mob-open-project-colour')).toBeVisible();
    }
    const first = await rows.first().boundingBox();
    const items = await page.locator('.mob-menu-item').first().boundingBox();
    expect(first?.y ?? 0).toBeLessThan(items?.y ?? 0);
  });

  test('ticking a box leaves the menu open', async ({ page }) => {
    await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    await openMobileMenu(page);
    const box = page.locator('.mob-open-project').first().locator('.mob-open-project-show');
    await box.uncheck();
    await expect(box).not.toBeChecked();
    await expect(page.locator('.mob-menu')).toBeVisible();
  });

  test('changing a colour leaves the menu open', async ({ page }) => {
    await openMobileMenu(page);
    const swatch = page.locator('.mob-open-project').first().locator('.mob-open-project-colour');
    const before = await swatch.evaluate(el => getComputedStyle(el).backgroundColor);
    await swatch.click();
    await expect.poll(() => swatch.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(before);
    await expect(page.locator('.mob-menu')).toBeVisible();
  });

  test('the colour of a hidden project can still be changed', async ({ page }) => {
    await openMobileMenu(page);
    const row = page.locator('.mob-open-project').first();
    await row.locator('.mob-open-project-show').uncheck();
    const swatch = row.locator('.mob-open-project-colour');
    const before = await swatch.evaluate(el => getComputedStyle(el).backgroundColor);
    await swatch.click();
    await expect.poll(() => swatch.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(before);
  });

  test('a tap on a name switches to that project and closes the menu', async ({ page }) => {
    await openAMobileProject(page, COMPLETE_DRIVER_PROJECT_OWPR);
    await openMobileMenu(page);
    const rows = page.locator('.mob-open-project');
    await rows.first().locator('.mob-open-project-name').click();
    await expect(page.locator('.mob-menu')).toHaveCount(0);
    await openMobileMenu(page);
    await expect(rows.first()).toHaveClass(/focused/);
  });
});

// BUG_20261019_phone-menu-project-row-cut-mid-word: a long open-project name was clipped mid-word.
// John, 20 Oct 2026: "use multi line there for the project name" — the whole name shows, wrapped.
test('a long open-project name in the phone menu wraps onto more lines, nothing cut', async ({ page }) => {
  await page.setViewportSize({ width: 374, height: 705 });
  const name = 'W5-1138SMF vented 30 L tuned low for the car door';
  await renameFocusedProject(page, name);
  await openMobileMenu(page);
  const text = page.locator('.mob-open-project-name-text');
  await expect(text).toHaveText(name);
  const shown = await text.evaluate((e) => {
    const lineHeight = parseFloat(getComputedStyle(e).lineHeight);
    return { cut: e.scrollWidth > e.clientWidth || e.scrollHeight > e.clientHeight, lines: Math.round(e.clientHeight / lineHeight) > 1 };
  });
  // 374 px wide menu: the name cannot fit on one line, so it wraps and none of it is hidden
  expect(shown).toEqual({ cut: false, lines: true });
});
