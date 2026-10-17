import {duplicateFocusedProject, expect, openAProject, setFocusedBoxVolume, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {z} from 'zod';
import {fillAndBlur} from '../fixtures/numField.js';

/** The Original shell's Projects list: every project, row menus, show/hide, Copy and Close. */

const rowStates = (page: Page) =>
  page.locator('.project-row').evaluateAll(els => els.map(e => ({
    name: e.querySelector('.project-name')?.textContent?.trim() ?? '',
    checked: e.querySelector<HTMLInputElement>('.project-show-cbx')?.checked ?? false,
  })));

/** Count opaque pixels drawn on the canvas: a hidden trace removes its pixels, whatever any trace's width. */
const inkPixels = (page: Page) => page.evaluate(() => {
  const c = document.querySelector<HTMLCanvasElement>('.graph-wrap canvas')!;
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 200) n++;
  return n;
});

/** Ink count once the chart has finished drawing: non-zero, and two reads (a poll interval apart) agree. */
async function settledInk(page: Page): Promise<number> {
  let previous = -1;
  await expect.poll(async () => {
    const now = await inkPixels(page);
    const stable = now > 0 && now === previous;
    previous = now;
    return stable;
  }).toBe(true);
  return previous;
}

async function addCopies(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await duplicateFocusedProject(page, `Copy ${i + 1}`);
    await expect(page.locator('.project-row')).toHaveCount(i + 2);
  }
}

test.describe('Original project list', () => {
  test.beforeEach(async ({ appPage: page }) => {
    await page.goto('/');
    await openAProject(page);
  });

  // T217 review: at the default layout the name was cut to "s…" by the Not saved tag and ⋯.
  test('the project name keeps its room at the default window size', async ({ appPage: page }) => {
    await page.setViewportSize({width: 1880, height: 1000});
    const name = page.locator('.project-row.selected .project-name');
    await expect(name).toBeVisible();
    const box = await name.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(80);
    // The whole name shows within its two lines: nothing is clamped away.
    const fits = await name.evaluate(el => el.scrollHeight <= el.clientHeight + 1);
    expect(fits).toBe(true);
  });

  test('a saved project that is not open is listed and a click opens it', async ({ appPage: page }) => {
    await page.locator('.tb-btn[title^="Save - "]').click();
    await page.locator('.project-row.selected .row-menu-btn').click();
    await page.locator('.row-menu-item:has-text("Close")').click();

    const row = page.locator('.project-row');
    await expect(row).toHaveCount(1);
    await expect(row).toHaveClass(/is-closed/);
    await expect(row.locator('.project-show-cbx')).toHaveCount(0);
    await expect(row.locator('.project-swatch')).toHaveClass(/swatch-closed/);

    await row.click();
    await expect(row).not.toHaveClass(/is-closed/);
    await expect(row).toHaveClass(/selected/);
    await expect(row.locator('.project-show-cbx')).toBeVisible();
    await expect(row.locator('.project-swatch')).toHaveClass(/swatch-open/);
  });

  test('⋯ → Hide unticks the show box', async ({ appPage: page }) => {
    const cbx = page.locator('.project-row.selected .project-show-cbx');
    await expect(cbx).toBeChecked();

    await page.locator('.project-row.selected .row-menu-btn').click();
    await page.locator('.row-menu-item:has-text("Hide trace")').click();

    await expect(cbx).not.toBeChecked();
    await expect(page.locator('.project-row.selected')).toHaveClass(/trace-hidden/);
    await expect(page.locator('.project-row.selected .project-tag-hidden')).toBeVisible();
    await expect(page.locator('.project-row.selected .project-swatch')).toHaveClass(/swatch-hidden/);
  });

  test('⋯ → Close closes it', async ({ appPage: page }) => {
    // Dirty the project first so the unsaved changes challenge appears
    await setFocusedBoxVolume(page, 0.037);

    await page.locator('.project-row.selected .row-menu-btn').click();
    await page.locator('.row-menu-item:has-text("Close")').click();

    // Since the project has unsaved changes, it prompts with the unsaved changes challenge
    await expect(page.locator('.close-actions')).toBeVisible();
    await page.locator('.close-actions button:has-text("Close without saving")').click();
    await expect(page.locator('.project-row')).toHaveCount(0);
    await expect(page.locator('.projects-empty')).toBeVisible();
  });

  test('⋯ → Move to Bin moves it to the Bin', async ({ appPage: page }) => {
    await page.locator('.tb-btn[title^="Save - "]').click();
    await page.locator('.project-row.selected .row-menu-btn').click();
    await page.locator('.row-menu-item:has-text("Move to Bin")').click();

    await expect(page.getByText('Move "sample-project" to the Bin?', { exact: false })).toBeVisible();
    await page.locator('.confirm-dialog-confirm').click();

    await expect(page.locator('.project-row')).toHaveCount(0);
    await expect(page.locator('.projects-empty')).toBeVisible();

    const binBtn = page.locator('.projects-panel-footer .bin-toggle');
    await expect(binBtn).toContainText('Bin (1)');
    await binBtn.click();

    await expect(page.locator('.bin-row .bin-name')).toHaveText('sample-project');
  });

  test('the toolbar Open focuses the search box when there are 9 or more projects', async ({ appPage: page }) => {
    // 1 initial project + 8 copies = 9 projects (> PROJECT_SEARCH_FROM_ROWS = 8)
    for (let i = 1; i <= 8; i++) {
      await duplicateFocusedProject(page, `Copy ${i}`);
    }
    await expect(page.locator('.project-row')).toHaveCount(9);

    const searchInput = page.locator('.project-search-input');
    await expect(searchInput).toBeVisible();

    // Focus somewhere else first
    await page.locator('.tab-section.active').click();
    await expect(searchInput).not.toBeFocused();

    // Toolbar Open button focuses search input
    await page.locator('.tb-btn[title^="Open project"]').click();
    await expect(searchInput).toBeFocused();
  });

  test('no page overflow at 1024x768', async ({ appPage: page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const overflow768 = await page.evaluate(() => ({
      hasHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      hasVerticalScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    }));
    expect(overflow768.hasHorizontalScroll).toBe(false);
    expect(overflow768.hasVerticalScroll).toBe(false);

    await page.setViewportSize({ width: 1920, height: 1080 });
    const overflow1080 = await page.evaluate(() => ({
      hasHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      hasVerticalScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    }));
    expect(overflow1080.hasHorizontalScroll).toBe(false);
    expect(overflow1080.hasVerticalScroll).toBe(false);
  });

  test('every project row keeps its own show/hide state, including the active one', async ({ appPage: page }) => {
    await addCopies(page, 2);

    // Untick all three — the active row included.
    for (let i = 0; i < 3; i++) await page.locator('.project-show-cbx').nth(i).click();
    expect((await rowStates(page)).map(r => r.checked)).toEqual([false, false, false]);

    // An unrelated design edit must not resurrect any of them. The active row's checkbox
    // used to spring back here, because a second copy of "visible" was re-applied on every
    // store change.
    await setFocusedBoxVolume(page, 0.042);
    await expect.poll(async () => (await rowStates(page)).map(r => r.checked)).toEqual([false, false, false]);
  });

  test('hiding a project removes its trace from the chart, and showing it brings it back', async ({ appPage: page }) => {
    await addCopies(page, 1);

    // After duplicateFocusedProject the COPY is open; the non-selected row is the original
    const overlayCheckbox = page.locator('.project-row:not(.selected) .project-show-cbx');

    await expect(overlayCheckbox).toBeChecked();
    const shown = await settledInk(page);
    await overlayCheckbox.click();
    await expect(overlayCheckbox).not.toBeChecked();
    await expect.poll(() => inkPixels(page)).toBeLessThan(shown);
    const hidden = await settledInk(page);

    // Back to the two-trace level: a little slack, as a repainted curve can land a pixel or two apart.
    await overlayCheckbox.click();
    await expect.poll(() => inkPixels(page)).toBeGreaterThan(hidden);
    await expect.poll(() => inkPixels(page)).toBeGreaterThanOrEqual(shown * 0.98);
  });

  // bugs/BUG_20261005_project-selection-lost-on-reload.md
  test('a hidden project is still hidden after a reload, and the chart still leaves its trace out', async ({ appPage: page }) => {
    await addCopies(page, 1);
    const overlayCheckbox = page.locator('.project-row:not(.selected) .project-show-cbx');
    await expect(overlayCheckbox).toBeChecked();
    const shown = await settledInk(page);
    await overlayCheckbox.click();
    await expect(overlayCheckbox).not.toBeChecked();
    await expect.poll(() => inkPixels(page)).toBeLessThan(shown);
    const hidden = await settledInk(page);

    await page.reload();

    await expect(page.locator('.project-row')).toHaveCount(2);
    expect((await rowStates(page)).map(r => r.checked)).toEqual([true, false]);
    await expect.poll(async () => await inkPixels(page)).toBeLessThan(shown);
    await expect.poll(async () => Math.abs(await inkPixels(page) - hidden)).toBeLessThan(shown - hidden);
  });

  test('open projects are never written into the active design (nothing to leak into its file)', async ({ appPage: page }) => {
    await addCopies(page, 2);
    await page.locator('.project-row').nth(1).click();          // work in the copy for a moment
    await page.locator('.project-row').nth(0).click();          // and back

    // What gets persisted IS what gets saved and shared. It must describe one project: no
    // list of other designs, and no trace of the other open projects' names.
    const persisted = await page.evaluate(() => localStorage.getItem('openisd_open_sessions') ?? '');
    expect(persisted).not.toBe('');
    const openSessionsSchema = z.looseObject({
      entries: z.array(z.looseObject({ text: z.string() })).min(1),
    });
    const session = openSessionsSchema.parse(JSON.parse(persisted));
    const activeDesignText = session.entries[0].text;
    const activeDesign = z.record(z.string(), z.unknown()).parse(JSON.parse(activeDesignText));
    expect(Object.keys(activeDesign)).not.toContain('compare');
    expect(activeDesignText).not.toContain('Copy 1');
  });

  test('closing an unsaved project asks first, and offers all three outcomes by name', async ({ appPage: page }) => {
    await addCopies(page, 1);
    await setFocusedBoxVolume(page, 0.037);  // make it unsaved

    await page.locator('.project-row.selected .row-menu-btn').click();
    await page.locator('.row-menu-item:has-text("Close")').click();
    await expect(page.locator('.close-actions')).toBeVisible();
    expect(await page.locator('.close-actions button').evaluateAll(els => els.map(e => e.textContent!.trim())))
      .toEqual(['Save and close', 'Close without saving', 'Keep it open']);

    // "Keep it open" is a true no-op.
    await page.locator('.close-actions button:has-text("Keep it open")').click();
    await expect(page.locator('.close-actions')).toBeHidden();
    await expect(page.locator('.project-row')).toHaveCount(2);

    await page.locator('.project-row.selected .row-menu-btn').click();
    await page.locator('.row-menu-item:has-text("Close")').click();
    await page.locator('.close-actions button:has-text("Close without saving")').click();
    await expect(page.locator('.project-row')).toHaveCount(1);
  });

  test('the last project can be closed too — the app lands on an empty workspace', async ({ appPage: page }) => {
    // Dirty it first, so the challenge is CERTAIN to appear and the close path under test is the
    // same one every other close goes through.
    await setFocusedBoxVolume(page, 0.037);

    await page.locator('.project-row.selected .row-menu-btn').click();
    await page.locator('.row-menu-item:has-text("Close")').click();
    await expect(page.locator('.close-actions')).toBeVisible();
    await page.locator('.close-actions button:has-text("Close without saving")').click();

    await expect(page.locator('.project-row')).toHaveCount(0);
    await expect(page.locator('.projects-empty')).toBeVisible();
  });

  test('the projects checkbox hides that project\'s trace without removing the project', async ({ appPage: page }) => {
    await duplicateFocusedProject(page, 'Copy 1');
    const rows = page.locator('.projects-list .project-row');
    await expect(rows).toHaveCount(2); // current design + 1 comparison

    const cbx = rows.nth(1).locator('.project-show-cbx');
    await expect(cbx).toBeChecked();
    await cbx.uncheck();
    await expect(rows).toHaveCount(2); // NOT deleted — still there
    await expect(rows.nth(1)).toHaveClass(/trace-hidden/);

    await cbx.check();
    await expect(rows.nth(1)).not.toHaveClass(/trace-hidden/);
  });

  test('opening a second project: edits land on the correct one, and the Project tab reflects whichever is focused', async ({ appPage: page }) => {
    // Name the original project so the two open tabs are distinguishable from the start.
    await page.locator('.project-nav li', { hasText: 'Project' }).click();
    const nameInput = page.locator('.tab-section.active .field', { hasText: 'Name' }).locator('input');
    await fillAndBlur(nameInput, 'Original');

    // Duplicate opens a second, genuinely independent project and focuses it.
    await page.locator('.project-row.selected .row-menu-btn').click();
    await page.locator('.row-menu-item:has-text("Duplicate")').click();
    const rows = page.locator('.projects-list .project-row');
    await expect(rows).toHaveCount(2);

    // The copy is focused — rename IT. This must not touch the original's own name.
    await fillAndBlur(nameInput, 'Edited Copy');
    const copyRow = rows.filter({ has: page.locator('.project-name', { hasText: 'Edited Copy' }) });
    await expect(copyRow).toHaveCount(1);
    const originalRow = rows.filter({ has: page.locator('.project-name', { hasText: /^Original$/ }) });
    await expect(originalRow).toHaveCount(1);

    // Switch focus to the original — the Project tab's own Name field now shows ITS name, not
    // the edit just made to the copy
    await originalRow.click();
    await expect(nameInput).toHaveValue('Original');

    // Switching back, the copy's edit is still there — it was never lost or bled into the original.
    await copyRow.click();
    await expect(nameInput).toHaveValue('Edited Copy');
  });

  test('closing the last open project keeps the shell and exposes recovery actions', async ({ appPage: page }) => {
    // The default single open project is unmodified at fresh load, so Close needs no confirmation.
    await page.locator('.project-row.selected .row-menu-btn').click();
    await page.locator('.row-menu-item:has-text("Close")').click();

    await expect(page.locator('.original-root')).toBeVisible();
    await expect(page.locator('.projects-empty')).toContainText('No projects yet.');
    await expect(page.locator('.content-panel')).toContainText('No projects open');
    await expect(page.locator('.graph-empty-h')).toHaveText('No project open. Create or open a project.');
    await expect(page.locator('canvas')).toHaveCount(0);

    // The shell's New action remains reachable.
    await page.locator('.tb-btn[title^="New project"]').click();
    await expect(page.locator('.modal-titlebar', { hasText: 'New Project' })).toBeVisible();
  });

  test('the unsaved mark stays on a project row after another project takes focus', async ({ appPage: page }) => {
    // John, 2026-09-24: "there is a yellow mark to indicate an unsaved project - it only shows
    // for the focused project - it needs to be always visible".
    await duplicateFocusedProject(page, 'Copy 1');
    const rows = page.locator('.projects-list .project-row');
    await expect(rows).toHaveCount(2);

    const copyRow = rows.filter({ has: page.locator('.project-name', { hasText: 'Copy 1' }) });
    const originalRow = rows.filter({ hasNot: page.locator('.project-name', { hasText: 'Copy 1' }) });

    // The copy is focused and saved; dirty it, then focus the original.
    await setFocusedBoxVolume(page, 0.037);
    await expect(copyRow).toHaveClass(/is-unsaved/);

    await originalRow.click();
    await expect(originalRow).toHaveClass(/selected/);
    await expect(copyRow, 'the unsaved mark vanished when the row lost focus').toHaveClass(/is-unsaved/);
    await expect(originalRow).not.toHaveClass(/is-unsaved/);
  });

  test('rename from the row menu changes the project name shown in the row and in the title', async ({ appPage: page }) => {
    const row = page.locator('.project-row.selected');
    await expect(row.locator('.project-name')).toHaveText('sample-project');
    await expect(row).toHaveAttribute('title', 'Project — sample-project (Active)');

    await row.locator('.row-menu-btn').click();
    await page.locator('.row-menu-item:has-text("Rename…")').click();

    const input = row.locator('.project-name-input');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();

    await input.fill('Renamed Project');
    await input.press('Enter');

    await expect(input).toBeHidden();
    await expect(row.locator('.project-name')).toHaveText('Renamed Project');
    await expect(row).toHaveAttribute('title', 'Project — Renamed Project (Active)');

    // Double-click to edit, Escape to cancel
    await row.locator('.project-name').dblclick();
    await expect(input).toBeVisible();
    await input.fill('Cancelled Name');
    await input.press('Escape');
    await expect(input).toBeHidden();
    await expect(row.locator('.project-name')).toHaveText('Renamed Project');
  });
});
