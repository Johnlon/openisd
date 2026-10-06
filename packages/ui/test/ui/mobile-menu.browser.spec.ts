/**
 * The mobile hamburger menu: its layout, the Open project… sheet, and the panes it opens
 * (Manage Drivers, Options, Project details, Advanced). The open-project ROWS at the bottom of the
 * menu are `mobile-project-list`'s.
 */
import {mobileFieldRow} from '../fixtures/mobileSkin.js';
import {duplicateFocusedProject, expect, openAMobileProject, setFocusedBoxType, setFocusedBoxVolume, test} from '../fixtures.js';
import {forceMobileSkin, openMobileMenu, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test.describe('MobileMenu', () => {
  test.describe('layout', () => {
    // John, 2026-10-04: the three save items sit together, Revert is its own section after them,
    // and a thin separator divides each section.
    // John, 2026-10-05: "a clear segregation between project things and app things".
    test('items sit in a Project section and an App section, each under its own heading', async ({ page }) => {
      await openMobileMenu(page);
      const sections = page.locator('.mob-menu-section');
      await expect(sections.locator('.mob-menu-section-head')).toHaveText(['Project', 'App']);
      const items = (section: string) => page.locator('.mob-menu-section', { has: page.locator('.mob-menu-section-head', { hasText: section }) })
        .locator('.mob-menu-item').evaluateAll(nodes => nodes.map(n => (n.querySelector('.export-menu-trigger') ?? n).textContent?.trim()));
      expect(await items('Project')).toEqual([
        'New project', 'Open project…', 'Open a file', 'Save', 'Save all', 'Save As / Export',
        'Revert unsaved changes', 'Project details', 'Advanced',
      ]);
      await expect(sections.first().locator('.mob-open-project')).toHaveCount(1);
      expect(await items('App')).toEqual([
        'Manage Drivers', 'Options', 'OpenISD and WinISD differences', 'About OpenISD', 'Switch to Desktop view',
      ]);
      // A visible divider sits between the two sections.
      const divider = await sections.nth(1).evaluate(el => getComputedStyle(el).borderTopWidth);
      expect(divider).not.toBe('0px');
    });

    test('Save, Save all and Save As sit together; Revert follows in its own section', async ({ page }) => {
      await openMobileMenu(page);
      const rows = await page.locator('.mob-menu-section > .mob-menu-item, .mob-menu-section > .mob-menu-sep').evaluateAll(
        nodes => nodes.map(n => n.classList.contains('mob-menu-sep') ? '---' : (n.textContent ?? '').trim()));
      const from = rows.indexOf('Open a file');
      expect(rows.slice(from, from + 8)).toEqual([
        'Open a file', '---', 'Save', 'Save all', 'Save As / Export', '---', 'Revert unsaved changes', '---',
      ]);
    });

    test('the whole menu, open projects included, fits a phone screen without scrolling', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await openMobileMenu(page);
      const fits = await page.locator('.mob-menu').evaluate(el => el.scrollHeight <= el.clientHeight);
      expect(fits).toBe(true);
    });

    test('the Graph page has its own menu button', async ({ page }) => {
      await page.locator('.mob-tab', { hasText: 'Graph' }).click();
      await expect(page.locator('.mob-topbar')).toHaveCount(0);
      await page.locator('.mob-chart-menu').click();
      await expect(page.locator('.mob-menu')).toBeVisible();
      await expect(page.locator('.mob-open-project')).toHaveCount(1);
    });
  });

  // The menu's "Open project…" lists previously-SAVED projects (browser storage), distinct from
  // "Open a file" (a disk import). John, 2026-10-02: "the file menu offer no way to save and reopen
  // projects".
  test.describe('Open project…', () => {
    test('lists nothing yet before anything has been saved', async ({ page }) => {
      await tapMobileMenuItem(page, 'Open project…');
      await expect(page.locator('.mob-open-project-sheet')).toBeVisible();
      await expect(page.locator('.mob-open-project-sheet')).toContainText('No saved project yet');
    });

    test('Save, then "Open project…" lists it and reopens it', async ({ page }) => {
      const before = await mobileFieldRow(page, 'Volume').locator('input').first().inputValue();

      await tapMobileMenuItem(page, /^Save$/);

      await tapMobileMenuItem(page, 'Open project…');
      const sheet = page.locator('.mob-open-project-sheet');
      await expect(sheet).toBeVisible();
      await expect(sheet.locator('.mob-stored-project-row')).toHaveCount(1);

      await sheet.locator('.mob-stored-project-row').first().click();
      await expect(sheet).toHaveCount(0);
      // Reopening the same project lands back on the Box tab with the same value — a real
      // re-load, not a no-op that merely closed the sheet.
      await expect(mobileFieldRow(page, 'Volume').locator('input').first()).toHaveValue(before);
    });

    // John, 2026-10-05: "can the Open project action show the driver name, and volume and type?"
    test('each saved project shows its driver, box type and volume under its name', async ({ page }) => {
      await setFocusedBoxType(page, 'vented');
      await setFocusedBoxVolume(page, 0.012);
      await tapMobileMenuItem(page, /^Save$/);
      await duplicateFocusedProject(page, 'Second');
      await setFocusedBoxType(page, 'sealed');
      await setFocusedBoxVolume(page, 0.02);
      await tapMobileMenuItem(page, /^Save$/);

      await tapMobileMenuItem(page, 'Open project…');
      const rows = page.locator('.mob-open-project-sheet .mob-stored-project-row');
      await expect(rows).toHaveCount(2);
      await expect(rows.locator('.mob-stored-project-name')).toHaveText(['Second', 'sample-project']);
      await expect(rows.locator('.mob-stored-project-summary')).toHaveText([
        'Tang Band W5-1138SMF · Closed · 20.0 L',
        'Tang Band W5-1138SMF · Vented · 12.0 L',
      ]);
      // John, 2026-10-05: never US style; yyyy-mm-dd everywhere. "2026-10-05 23:32", whatever the browser locale.
      for (const modified of await rows.locator('.mob-stored-project-modified').allTextContents()) {
        expect(modified).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      }
    });

    // John, 2026-10-05: "the Open project popup doesn't cover the entire screen — it should".
    test('the sheet fills the whole screen', async ({ page }) => {
      await page.setViewportSize({ width: 412, height: 915 });
      await tapMobileMenuItem(page, 'Open project…');
      const box = await page.locator('.mob-open-project-sheet').boundingBox();
      expect(box).toEqual({ x: 0, y: 0, width: 412, height: 915 });
      await expect(page.locator('.mob-open-project-sheet .mob-dlg-footer').getByRole('button', { name: 'Close' })).toBeVisible();
    });
  });

  // Bugs John reported live on his phone (2026-09-29): "manage drivers appears as an overlay
  // pop-up... should be a regular pane"; "options appears as an overlay popup and should be a
  // regular pane". Options stays a `position:fixed` overlay under the hood (OptionsModal.vue is
  // one monolithic file with desktop specs pinned to its own layout) but fills the phone screen
  // edge-to-edge and scrolls as a single column, from MobileShell.vue only.
  test.describe('panes', () => {
    test('Manage Drivers opens as a full pane, not the DriverBrowser overlay', async ({ page }) => {
      await tapMobileMenuItem(page, 'Manage Drivers');

      await expect(page.locator('.mob-dlg-title', { hasText: 'Manage drivers' })).toBeVisible();
      await expect(page.locator('.driver-library')).toBeVisible();
      // The global DriverBrowser overlay (.wb-modal) must NOT be what opened.
      await expect(page.locator('.wb-modal')).toHaveCount(0);
    });

    test('picking a driver from Manage Drivers embeds it and returns to the Driver tab', async ({ page }) => {
      await tapMobileMenuItem(page, 'Manage Drivers');

      await page.locator('.ditem', { hasText: 'Tang Band W5-1138SMF' }).click();
      await page.locator('.prev-footer .use-btn').click();

      await expect(page.locator('.mob-tab.active')).toHaveText('Driver');
      await expect(page.getByText('Tang Band', { exact: false })).toBeVisible();
    });

    test('Options fills the phone screen edge-to-edge instead of floating as a small popup', async ({ page }) => {
      await tapMobileMenuItem(page, 'Options');

      const rootBox = await page.locator('.mobile-root').boundingBox();
      const modalBox = await page.locator('.opt-modal').boundingBox();
      expect(rootBox).not.toBeNull();
      expect(modalBox).not.toBeNull();
      expect(modalBox!.width).toBeGreaterThanOrEqual(rootBox!.width - 1);
      expect(modalBox!.height).toBeGreaterThanOrEqual(rootBox!.height - 1);
    });
  });

  // Manage drivers, Project details and Advanced open as dialogs in the Options style (John,
  // 2026-10-04): full-screen, title with a top-right ✕, body, footer button; closing returns to the
  // tab underneath. A dialog never changes size for a workflow, e.g. the Favourites toggle.
  test.describe('pane dialogs', () => {
    for (const [item, title] of [['Manage Drivers', 'Manage drivers'], ['Project details', 'Project'], ['Advanced', 'Advanced']] as const) {
      test(`${item} is a dialog with a title, a top-right ✕ and closes back to the Box tab`, async ({ page }) => {
        await tapMobileMenuItem(page, item);
        const dlg = page.locator('.mob-dlg');
        await expect(dlg.locator('.mob-dlg-title')).toHaveText(title);
        const shell = (await page.locator('.mobile-root').boundingBox())!;
        expect(await dlg.boundingBox()).toEqual(shell);
        const x = dlg.locator('.mob-dlg-close');
        const box = (await x.boundingBox())!;
        expect(box.x + box.width).toBeGreaterThan(shell.x + shell.width - 60);
        expect(box.y).toBeLessThan(60);
        await x.click();
        await expect(dlg).toHaveCount(0);
        await expect(page.locator('.mob-tab.active', { hasText: 'Box' })).toBeVisible();
      });
    }

    test('every pane dialog has a Close button in the footer', async ({ page }) => {
      for (const item of ['Project details', 'Advanced', 'Manage Drivers']) {
        await tapMobileMenuItem(page, item);
        await page.locator('.mob-dlg-footer').getByRole('button', { name: 'Close' }).click();
        await expect(page.locator('.mob-dlg')).toHaveCount(0);
      }
    });

    test('turning Favourites on does not change the Manage drivers dialog size', async ({ page }) => {
      await tapMobileMenuItem(page, 'Manage Drivers');
      const dlg = page.locator('.mob-dlg');
      const lib = page.locator('.driver-library');
      await expect(lib).toBeVisible();
      const before = { dlg: await dlg.boundingBox(), lib: await lib.boundingBox() };
      await page.locator('.fav-filter').click();
      await expect(page.locator('.fav-filter.active')).toBeVisible();
      expect(await dlg.boundingBox()).toEqual(before.dlg);
      expect(await lib.boundingBox()).toEqual(before.lib);
    });
  });
});
