/**
 * Project name ↔ file name, end to end in a real browser.
 *
 * Two behaviours the user sees directly:
 *  1. Open… of a saved `.owpr` visibly loads it — the project name in the title bar
 *     and in the Projects list comes from the FILE NAME (spaces and all), and the comparison
 *     overlays saved with it come back. The old importFile() restored a subset of the file
 *     and left the name untouched, so opening a project built on the same driver looked like
 *     nothing had happened at all.
 *  2. Saving keeps the two names equal: Save suggests `<project>.owpr`, Save As over
 *     an already-open file suggests `Copy of <project>`, the picked file renames the project,
 *     and renaming the project releases the open file so the next Save asks where to put it.
 *
 * The native save dialog cannot be driven from Playwright, so `showSaveFilePicker` is stubbed
 * with a handle that reports the suggested name back as its own `name` — i.e. the user
 * accepting the default. Everything else is the real click → composable → store wiring.
 */
import { test, expect } from './fixtures.js';
import type { Page } from '@playwright/test';

/** A saved project whose stored name deliberately DISAGREES with its file name. */
const SAVED_PROJECT = JSON.stringify({
  v: 2,
  driver: { inputs: { name: 'Samples - Generic 6.5" Woofer', brand: 'Samples', model: 'Generic 6.5" Woofer', Fs: 37, Qts: 0.378, Qes: 0.4, Qms: 7, Vas: 0.03, Sd: 0.0133, Re: 5.6, Le: 0.0007, Xmax: 0.005, Pe: 60, Z: 8 } },
  box: 'vented',
  P: { Vb: 0.00042 },
  graphs: ['SPL', 'Excursion', 'Zmag', 'GD'],
  compare: [{ driver: { name: 'Overlay', Fs: 37, Re: 5.6, Sd: 0.0133, Vas: 0.03, Qts: 0.378, Qes: 0.4, Qms: 7, Cms: 0.0008, Mms: 0.0231, Rms: 0.767, Bl: 8.67, Le: 0.0007, Xmax: 0.005, Pe: 60, Z: 8 }, box: 'sealed', P: { Vb: 0.02 }, name: 'Copy of glob', color: '#ff8800' }],
  ui: { skin: 'original' },
  project: { name: 'glob', creator: '', created: '', modified: '', description: '' },
});

async function openProjectFile(page: Page, filename: string, text = SAVED_PROJECT): Promise<void> {
  await page.locator('.original-root input[type=file]').setInputFiles({
    name: filename, mimeType: 'application/json', buffer: Buffer.from(text, 'utf8'),
  });
}

/** Stub the OS save dialog: the returned handle is named after the suggestion (user accepts it). */
async function stubSaveFilePicker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __saveCalls: Array<{ suggestedName: string; text: string }> }).__saveCalls = [];
    (window as unknown as { showSaveFilePicker: (o: { suggestedName: string }) => Promise<unknown> }).showSaveFilePicker =
      async (opts: { suggestedName: string }) => {
        const record = { suggestedName: opts.suggestedName, text: '' };
        (window as unknown as { __saveCalls: Array<{ suggestedName: string; text: string }> }).__saveCalls.push(record);
        return {
          name: opts.suggestedName,
          createWritable: async () => ({
            write: async (t: string) => { record.text = t; },
            close: async () => {},
          }),
        };
      };
  });
}

function saveCalls(page: Page): Promise<Array<{ suggestedName: string; text: string }>> {
  return page.evaluate(() => (window as unknown as { __saveCalls: Array<{ suggestedName: string; text: string }> }).__saveCalls);
}

const CURRENT_ROW = '.projects-list .project-row:first-child span';
const SAVE_BTN = '.toolbar .tb-btn[title^="Save —"]';

test.describe('Open… names the project after the file it came from', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.locator('.skin-picker select').selectOption('original');
    await expect(page.locator('.original-root')).toBeVisible();
  });

  test('the FILE name wins over the name stored inside the file — spaces preserved', async ({ page }) => {
    await openProjectFile(page, 'glob 3.owpr');
    // The file's own body says "glob"; the file on disk says "glob 3". The file wins.
    await expect(page.locator('.titlebar .tb-left')).toContainText('glob 3');
    await expect(page.locator(CURRENT_ROW)).toHaveText('glob 3');
  });

  test('a bare .json project file names the project too', async ({ page }) => {
    await openProjectFile(page, 'my tuning.json');
    await expect(page.locator(CURRENT_ROW)).toHaveText('my tuning');
  });

  test('the whole snapshot lands — the design AND the comparison overlays it was saved with', async ({ page }) => {
    await openProjectFile(page, 'glob 3.owpr');
    const rows = page.locator('.projects-list .project-row');
    await expect(rows).toHaveCount(2);                       // current + the saved overlay
    await expect(rows.nth(1)).toContainText('Copy of glob');
    const vb = await page.evaluate(async () => {
      const modPath = '/src/store.ts';
      const store = await import(/* @vite-ignore */ modPath);
      return store.state.P.Vb;
    });
    expect(vb).toBeCloseTo(0.00042, 6);                      // the design itself, not just the name
    });
});

test.describe('Saving keeps the project name and the file name equal', () => {
  test.beforeEach(async ({ page }) => {
    await stubSaveFilePicker(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await page.locator('.skin-picker select').selectOption('original');
    await expect(page.locator('.original-root')).toBeVisible();
  });

  test('Save suggests the project name verbatim — spaces are NOT mangled into underscores', async ({ page }) => {
    await openProjectFile(page, 'glob 3.owpr');
    await expect(page.locator(CURRENT_ROW)).toHaveText('glob 3');
    await page.locator(SAVE_BTN).click();
    expect((await saveCalls(page))[0].suggestedName).toBe('glob 3.owpr');
  });

  test('the picked file renames the project', async ({ page }) => {
    await openProjectFile(page, 'glob 3.owpr');
    await page.locator(SAVE_BTN).click();                    // handle adopted, name unchanged
    await page.locator('#btnExportMenu').click();
    await page.locator('.export-menu-list button', { hasText: 'Save As OpenISD project (.owpr)' }).click();
    // Save As over an open file is making a COPY, so the default it offers — and therefore
    // the project's new name — is "Copy of glob 3".
    expect((await saveCalls(page))[1].suggestedName).toBe('Copy of glob 3.owpr');
    await expect(page.locator(CURRENT_ROW)).toHaveText('Copy of glob 3');
  });

  test('a FIRST Save As (nothing open yet) is not a copy — it keeps the project name', async ({ page }) => {
    await page.locator('#btnExportMenu').click();
    await page.locator('.export-menu-list button', { hasText: 'Save As OpenISD project (.owpr)' }).click();
    expect((await saveCalls(page))[0].suggestedName).not.toContain('Copy of');
  });

  test('renaming the project releases the open file, so the next Save asks where to put it', async ({ page }) => {
    await openProjectFile(page, 'glob 3.owpr');
    await page.locator(SAVE_BTN).click();
    await page.locator(SAVE_BTN).click();
    expect(await saveCalls(page)).toHaveLength(1);           // 2nd Save reused the handle

    // Every tab pane stays in the DOM (v-show), so scope to the ACTIVE one — otherwise
    // `.first()` picks a hidden field from another tab.
    await page.locator('.project-nav li', { hasText: 'Project' }).click();
    await page.locator('.tab-section.active input[type=text]').first().fill('renamed box');

    await page.locator(SAVE_BTN).click();
    const calls = await saveCalls(page);
    expect(calls).toHaveLength(2);                           // the handle was let go — it re-prompted
    expect(calls[1].suggestedName).toBe('renamed box.owpr');
  });
});

test('＋ Copy names the new row after the PROJECT, not the driver', async ({ page }) => {
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption('original');
  await expect(page.locator('.original-root')).toBeVisible();
  await openProjectFile(page, 'glob 3.owpr');

  await page.locator('.quad-projects-wrap .link-btn', { hasText: 'Copy' }).first().click();
  const rows = page.locator('.projects-list .project-row');
  await expect(rows).toHaveCount(3);                         // current + saved overlay + the new copy
  await expect(rows.nth(2)).toContainText('Copy of glob 3');

  // A second copy must not collide with the first.
  await page.locator('.quad-projects-wrap .link-btn', { hasText: 'Copy' }).first().click();
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(3)).toContainText('Copy of glob 3 (2)');
});
