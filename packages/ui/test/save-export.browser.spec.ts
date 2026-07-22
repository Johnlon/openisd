/**
 * Save / Save As-&-Export — the project actions every skin exposes identically through
 * the shared useDesignIO() composable: an in-place "Save" button, plus a combined
 * Save-As/Export menu with four one-way actions (Save as OpenISD .json, Save as WinISD
 * .wpr, Export driver .wdr, Share link). Real browsers don't let Playwright drive the
 * native OS save dialog, so `window.showSaveFilePicker` is stubbed via addInitScript with
 * a fake handle that records what was written — exercising the REAL click → composable →
 * fileSave.ts wiring, not a mock of our own code.
 */
import { test, expect } from './fixtures.js';
import type { Page } from '@playwright/test';

// Installed before navigation so it exists the instant the app's modules evaluate
// `typeof globalThis.showSaveFilePicker`. Records every write + the suggestedName it was
// called with, onto window.__saveCalls, readable back via page.evaluate().
async function stubSaveFilePicker(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __saveCalls: Array<{ suggestedName: string; text: string }> }).__saveCalls = [];
    (window as unknown as { showSaveFilePicker: (opts: { suggestedName: string }) => Promise<unknown> }).showSaveFilePicker =
      async (opts: { suggestedName: string }) => {
        const calls = (window as unknown as { __saveCalls: Array<{ suggestedName: string; text: string }> }).__saveCalls;
        const record = { suggestedName: opts.suggestedName, text: '' };
        calls.push(record);
        return {
          createWritable: async () => ({
            write: async (t: string) => { record.text = t; },
            close: async () => {},
          }),
        };
      };
  });
}

async function saveCalls(page: Page): Promise<Array<{ suggestedName: string; text: string }>> {
  return page.evaluate(() => (window as unknown as { __saveCalls: Array<{ suggestedName: string; text: string }> }).__saveCalls);
}

test.describe('Original skin — Save / Save-As-&-Export', () => {
  test.beforeEach(async ({ page }) => {
    await stubSaveFilePicker(page);
    await page.goto('/');
    await page.locator('.skin-picker select').selectOption('original');
    await expect(page.locator('.original-root')).toBeVisible();
  });

  test('Save prompts the (stubbed) picker and writes a valid OpenISD project JSON', async ({ page }) => {
    await page.locator('.toolbar .tb-btn[title^="Save —"]').click();
    const calls = await saveCalls(page);
    expect(calls).toHaveLength(1);
    expect(calls[0].suggestedName).toMatch(/\.openisd\.json$/);
    const parsed = JSON.parse(calls[0].text);
    expect(parsed.v).toBe(2);
    expect(parsed.box).toBeTruthy();
    expect(parsed.driver).toBeTruthy();
  });

  test('Save twice reuses the SAME retained handle — only the first click prompts the picker', async ({ page }) => {
    await page.locator('.toolbar .tb-btn[title^="Save —"]').click();
    await page.locator('.toolbar .tb-btn[title^="Save —"]').click();
    const calls = await saveCalls(page);
    expect(calls).toHaveLength(1); // 2nd Save wrote via the retained handle — no 2nd picker prompt
  });

  test('the menu has no separate "Save" toolbar button anymore — Save As lives in the combined menu', async ({ page }) => {
    await expect(page.locator('.toolbar .tb-btn[title^="Save As —"]')).toHaveCount(0);
  });

  test('Save As... (Save-As/Export menu) always re-prompts the picker, even after a prior Save', async ({ page }) => {
    await page.locator('.toolbar .tb-btn[title^="Save —"]').click();
    await page.locator('#btnExportMenu').click();
    await page.locator('.export-menu-list button', { hasText: 'Save as OpenISD project (.json)' }).click();
    const calls = await saveCalls(page);
    expect(calls).toHaveLength(2);
    expect(calls[1].suggestedName).toMatch(/\.openisd\.json$/);
  });

  test('Save-As/Export menu → Save as WinISD project (.wpr) downloads a well-formed INI file', async ({ page }) => {
    await page.locator('#btnExportMenu').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.export-menu-list button', { hasText: 'Save as WinISD project (.wpr)' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.wpr$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString('utf8');
    expect(text.startsWith('[ProjectInfo]')).toBe(true);
    expect(text).toContain('[Driver]');
    expect(text).toContain('[Box]');
    expect(text.includes('\r\n')).toBe(true);
  });

  test('Save-As/Export menu → Export driver (.wdr) still downloads a .wdr file (unchanged action)', async ({ page }) => {
    await page.locator('#btnExportMenu').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.export-menu-list button', { hasText: 'Export driver (.wdr)' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.wdr$/);
  });

  test('Save-As/Export menu → Share link (http:) writes the design into the address bar', async ({ page }) => {
    page.on('dialog', (d) => d.dismiss().catch(() => {})); // if clipboard is blocked, shareLink falls back to prompt()
    await page.locator('#btnExportMenu').click();
    await page.locator('#btnShare').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('s=');
  });
});

test.describe('Modern and Classic skins — Save/Save-As-&-Export are wired identically', () => {
  test('Modern header exposes Save and the combined Save-As/Export menu (no separate Save As button)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header button', { hasText: /^Save$/ })).toBeVisible();
    await expect(page.locator('header button', { hasText: /^Save As$/ })).toHaveCount(0);
    await expect(page.locator('#btnExportMenu')).toBeVisible();
  });

  test('Modern: Save writes an OpenISD project via the stubbed picker', async ({ page }) => {
    await stubSaveFilePicker(page);
    await page.goto('/');
    await page.locator('header button', { hasText: /^Save$/ }).click();
    const calls = await saveCalls(page);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].text).v).toBe(2);
  });

  test('Modern: Save-As/Export menu → Save as OpenISD project (.json) prompts the picker', async ({ page }) => {
    await stubSaveFilePicker(page);
    await page.goto('/');
    await page.locator('#btnExportMenu').click();
    await page.locator('.export-menu-list button', { hasText: 'Save as OpenISD project (.json)' }).click();
    const calls = await saveCalls(page);
    expect(calls).toHaveLength(1);
    expect(calls[0].suggestedName).toMatch(/\.openisd\.json$/);
  });

  test('Classic: Save (disk icon) writes an OpenISD project via the stubbed picker', async ({ page }) => {
    await stubSaveFilePicker(page);
    await page.goto('/');
    await page.locator('.skin-picker select').selectOption('classic');
    await page.locator('.cl-ico[title^="Save —"]').click();
    const calls = await saveCalls(page);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].text).v).toBe(2);
  });

  test('Classic: no separate Save As icon — Save-As/Export menu covers it', async ({ page }) => {
    await page.goto('/');
    await page.locator('.skin-picker select').selectOption('classic');
    await expect(page.locator('.cl-ico[title^="Save As —"]')).toHaveCount(0);
    await expect(page.locator('#btnExportMenu')).toBeVisible();
  });

  test('Classic: Save-As/Export menu → Save as WinISD project (.wpr) downloads a well-formed project', async ({ page }) => {
    await stubSaveFilePicker(page);
    await page.goto('/');
    await page.locator('.skin-picker select').selectOption('classic');
    await page.locator('#btnExportMenu').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.export-menu-list button', { hasText: 'Save as WinISD project (.wpr)' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.wpr$/);
  });
});

test.describe('Share link carries the sender\'s skin and active tab (not a generic default)', () => {
  test('opening a share link generated from the Original skin restores Original + its active project tab', async ({ page }) => {
    await page.goto('/');
    await page.locator('.skin-picker select').selectOption('original');
    await expect(page.locator('.original-root')).toBeVisible();
    await page.locator('.project-nav li', { hasText: 'Signal' }).click();

    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.locator('#btnExportMenu').click();
    await page.locator('#btnShare').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('s=');
    const shareUrl = await page.evaluate(() => location.href);

    // Clear localStorage so ONLY the share-link hash decides the restored view — proves the
    // hash itself carries skin+tab, not a coincidence of whatever was already in localStorage.
    await page.evaluate(() => localStorage.clear());
    await page.goto(shareUrl);

    await expect(page.locator('.original-root')).toBeVisible();
    await expect(page.locator('.project-nav li.active')).toHaveText('Signal');
  });

  test('opening a share link restores the pinned graph marker (cursorF/pinnedF/cursorLocked)', async ({ page }) => {
    await page.goto('/');
    await page.locator('.skin-picker select').selectOption('original');
    await expect(page.locator('.original-root')).toBeVisible();

    // Pin a marker directly on the store (the click-to-pin gesture itself is exercised
    // elsewhere; this test is about the share-link ROUND-TRIP of whatever is pinned).
    await page.evaluate(async () => {
      const modPath = '/src/store.ts';
      const store = await import(/* @vite-ignore */ modPath);
      store.state.cursorF = 123.4;
      store.state.pinnedF = 500;
      store.state.cursorLocked = true;
    });

    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.locator('#btnExportMenu').click();
    await page.locator('#btnShare').click();
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('s=');
    const shareUrl = await page.evaluate(() => location.href);

    await page.evaluate(() => localStorage.clear());
    await page.goto(shareUrl);
    await expect(page.locator('.original-root')).toBeVisible();

    const restored = await page.evaluate(async () => {
      const modPath = '/src/store.ts';
      const store = await import(/* @vite-ignore */ modPath);
      return { cursorF: store.state.cursorF, pinnedF: store.state.pinnedF, cursorLocked: store.state.cursorLocked };
    });
    expect(restored).toEqual({ cursorF: 123.4, pinnedF: 500, cursorLocked: true });
  });
});
