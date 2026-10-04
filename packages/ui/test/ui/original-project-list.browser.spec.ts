import {expect, openAProject, setFocusedBoxVolume, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {z} from 'zod';
import {fillAndBlur} from '../fixtures/numField.js';

/** The Original shell's Projects list: open designs, their show/hide checkboxes, Copy and Close. */

const rowStates = (page: Page) =>
  page.locator('.project-row').evaluateAll(els => els.map(e => ({
    name: e.querySelector('span')?.textContent?.trim() ?? '',
    checked: e.querySelector<HTMLInputElement>('input')?.checked ?? false,
  })));

/** Count distinct opaque colours drawn on the canvas: a second trace is a second colour. */
const inkColours = (page: Page) => page.evaluate(() => {
  const c = document.querySelector<HTMLCanvasElement>('.graph-wrap canvas')!;
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  const seen = new Set<string>();
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
  return seen.size;
});

async function addCopies(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await page.locator('.proj-actions button:has-text("Copy")').click();
    await expect(page.locator('.project-row')).toHaveCount(i + 2);
  }
}

test.describe('Original project list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openAProject(page);
  });

  test('every project row keeps its own show/hide state, including the active one', async ({ page }) => {
    await addCopies(page, 2);

    // Untick all three — the active row included.
    for (let i = 0; i < 3; i++) await page.locator('.project-row input').nth(i).click();
    expect((await rowStates(page)).map(r => r.checked)).toEqual([false, false, false]);

    // An unrelated design edit must not resurrect any of them. The active row's checkbox
    // used to spring back here, because a second copy of "visible" was re-applied on every
    // store change.
    await setFocusedBoxVolume(page, 0.042);
    await expect.poll(async () => (await rowStates(page)).map(r => r.checked)).toEqual([false, false, false]);
  });

  test('hiding a project removes its trace from the chart, and showing it brings it back', async ({ page }) => {
    await addCopies(page, 1);

    // After +Copy the COPY becomes the focused (selected) project; the ORIGINAL stays open as the
    // non-selected comparison overlay, and its trace is what this row's show/hide checkbox controls.
    const overlayCheckbox = page.locator('.project-row:not(.selected) input');

    const shown = await inkColours(page);
    await overlayCheckbox.click();
    await expect.poll(() => inkColours(page)).toBeLessThan(shown);
    const hidden = await inkColours(page);

    // Back to the two-trace level. NOT an exact match: this census counts every distinct
    // antialiased shade, and a curve repainted after a hide lands a shade or two apart from its
    // first paint (156 vs 157 out of ~156) — a difference that says nothing about whether the
    // trace is there.
    await overlayCheckbox.click();
    await expect.poll(() => inkColours(page)).toBeGreaterThan(hidden);
    await expect.poll(() => inkColours(page)).toBeGreaterThanOrEqual(shown - 2);
  });

  test('open projects are never written into the active design (nothing to leak into its file)', async ({ page }) => {
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
    expect(activeDesignText).not.toContain('Copy of');
  });

  test('closing an unsaved project asks first, and offers all three outcomes by name', async ({ page }) => {
    await addCopies(page, 1);
    await setFocusedBoxVolume(page, 0.037);  // make it unsaved

    await page.locator('.proj-actions button:has-text("Close")').click();
    await expect(page.locator('.close-actions')).toBeVisible();
    expect(await page.locator('.close-actions button').evaluateAll(els => els.map(e => e.textContent!.trim())))
      .toEqual(['Save and close', 'Close without saving', 'Keep it open']);

    // "Keep it open" is a true no-op.
    await page.locator('.close-actions button:has-text("Keep it open")').click();
    await expect(page.locator('.close-actions')).toBeHidden();
    await expect(page.locator('.project-row')).toHaveCount(2);

    await page.locator('.proj-actions button:has-text("Close")').click();
    await page.locator('.close-actions button:has-text("Close without saving")').click();
    await expect(page.locator('.project-row')).toHaveCount(1);
  });

  test('the last project can be closed too — the app lands on an empty workspace', async ({ page }) => {
    // Dirty it first, so the challenge is CERTAIN to appear and the close path under test is the
    // same one every other close goes through.
    await setFocusedBoxVolume(page, 0.037);

    await page.locator('.proj-actions button:has-text("Close")').click();
    await expect(page.locator('.close-actions')).toBeVisible();
    await page.locator('.close-actions button:has-text("Close without saving")').click();

    await expect(page.locator('.project-row')).toHaveCount(0);
    await expect(page.locator('.project-empty-row')).toBeVisible();
  });

  test('the pin button is named ＋ Copy', async ({ page }) => {
    await expect(page.locator('.quad-projects-wrap .link-btn').first()).toHaveText(/^＋ Copy$/);
  });

  test('project rows are [checkbox] Name only; the Close button under the list removes the SELECTED overlay', async ({ page }) => {
    await page.locator('.quad-projects-wrap .link-btn', { hasText: 'Copy' }).first().click();
    const rows = page.locator('.projects-list .project-row');
    await expect(rows).toHaveCount(2);
    // no inline remove control in the rows (WinISD look: checkbox + name only)
    await expect(page.locator('.projects-list .row-remove')).toHaveCount(0);
    // Close acts on the selected row, and every project can be closed — including the first
    // and the last. Unsaved work is not discarded silently, so a dirty copy asks first.
    const closeBtn = page.locator('.quad-projects-wrap .close-btn');
    await expect(closeBtn).toBeEnabled();
    await rows.nth(1).click();
    await expect(rows.nth(1)).toHaveClass(/selected/);
    // A copy opens already saved, so it would close without asking — dirty it so the
    // unsaved-changes prompt is real.
    await setFocusedBoxVolume(page, 0.037);
    await closeBtn.click();
    await page.locator('.close-actions button:has-text("Close without saving")').click();
    await expect(rows).toHaveCount(1);
    // selection falls back to the remaining project, which is itself still closeable
    await expect(rows.nth(0)).toHaveClass(/selected/);
    await expect(closeBtn).toBeEnabled();
  });

  test('the projects checkbox hides that project\'s trace without removing the project', async ({ page }) => {
    await page.locator('.link-btn', { hasText: 'Copy' }).click(); // ＋ Copy — pin a snapshot
    const rows = page.locator('.projects-list .project-row');
    await expect(rows).toHaveCount(2); // current design + 1 comparison

    const cbx = rows.nth(1).locator('input[type=checkbox]');
    await expect(cbx).toBeChecked();
    await cbx.uncheck();
    await expect(rows).toHaveCount(2); // NOT deleted — still there
    await expect(rows.nth(1)).toHaveClass(/trace-hidden/);

    // The flag lives on the row and nowhere else — a design never holds another design.
    // The drawn effect of hiding is asserted against the canvas in the test below.

    await cbx.check();
    await expect(rows.nth(1)).not.toHaveClass(/trace-hidden/);
  });

  test('opening a second project: edits land on the correct one, and the Project tab reflects whichever is focused', async ({ page }) => {
    // Name the original project so the two open tabs are distinguishable from the start.
    await page.locator('.project-nav li', { hasText: 'Project' }).click();
    const nameInput = page.locator('.tab-section.active .field', { hasText: 'Name' }).locator('input');
    await fillAndBlur(nameInput, 'Original');

    // "+ Copy" opens a second, genuinely independent project and focuses it.
    await page.locator('.link-btn', { hasText: 'Copy' }).click();
    const rows = page.locator('.projects-list .project-row');
    await expect(rows).toHaveCount(2);

    // The copy is focused — rename IT. This must not touch the original's own name.
    await fillAndBlur(nameInput, 'Edited Copy');
    await expect(rows.filter({ hasText: 'Edited Copy' })).toHaveCount(1);
    const originalRow = rows.filter({ hasText: /^Original$/ });
    await expect(originalRow).toHaveCount(1);

    // Switch focus to the original — the Project tab's own Name field now shows ITS name, not
    // the edit just made to the copy (this is the read-side of BUG_20260825_project_meta_edits_
    // never_reach_the_domain_object_or_save.md: switching focus via the registry alone, with no
    // load call, must not leave stale meta on screen).
    await originalRow.click();
    await expect(nameInput).toHaveValue('Original');

    // Switching back, the copy's edit is still there — it was never lost or bled into the
    // original.
    await rows.filter({ hasText: 'Edited Copy' }).click();
    await expect(nameInput).toHaveValue('Edited Copy');
  });

  test('closing the last open project keeps the shell and exposes recovery actions', async ({ page }) => {
    // The default single open project is unmodified at fresh load (onMounted's own
    // markProjectSaved()), so Close needs no confirmation.
    await page.locator('.quad-projects-wrap .close-btn').click();

    await expect(page.locator('.original-root')).toBeVisible();
    await expect(page.locator('.projects-list')).toContainText('No projects open');
    await expect(page.locator('.content-panel')).toContainText('No projects open');
    await expect(page.locator('.graph-empty-h')).toHaveText('Open or Create a project for charts');
    await expect(page.locator('canvas')).toHaveCount(0);

    // The shell's New action remains reachable.
    await page.locator('.tb-btn[title^="New project"]').click();
    await expect(page.locator('.modal-titlebar', { hasText: 'New Project' })).toBeVisible();
  });

  test('the unsaved mark stays on a project row after another project takes focus', async ({ page }) => {
    // John, 2026-09-24: "there is a yellow mark to indicate an unsaved project - it only shows
    // for the focused project - it needs to be always visible".
    await page.locator('.link-btn', { hasText: 'Copy' }).click();
    const rows = page.locator('.projects-list .project-row');
    await expect(rows).toHaveCount(2);

    // The copy is focused and saved; dirty it, then focus the original.
    await setFocusedBoxVolume(page, 0.037);
    await expect(rows.nth(1)).toHaveClass(/is-unsaved/);

    await rows.nth(0).click();
    await expect(rows.nth(0)).toHaveClass(/selected/);
    await expect(rows.nth(1), 'the unsaved mark vanished when the row lost focus').toHaveClass(/is-unsaved/);
    await expect(rows.nth(0)).not.toHaveClass(/is-unsaved/);
  });
});
