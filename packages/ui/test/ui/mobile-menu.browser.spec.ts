/**
 * The mobile hamburger menu: its layout, the Open project… sheet, and the panes it opens
 * (Manage Drivers, Options, Project details, Advanced). The open-project ROWS at the bottom of the
 * menu are `mobile-project-list`'s.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mobileFieldRow} from '../fixtures/mobileSkin.js';
import {duplicateFocusedProject, expect, openAMobileProject, setFocusedBoxType, setFocusedBoxVolume, test} from '../fixtures.js';
import {forceMobileSkin, openMobileMenu, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

const BUILD_INFO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'build-info.json');

function isBuildInfo(v: unknown): v is { version: string } {
  return typeof v === 'object' && v !== null && 'version' in v && typeof v.version === 'string';
}

function readBuildInfo(): { version: string } {
  const parsed: unknown = JSON.parse(readFileSync(BUILD_INFO, 'utf8'));
  if (!isBuildInfo(parsed)) throw new Error(`build-info.json has no string "version": ${JSON.stringify(parsed)}`);
  return parsed;
}

// The label is the build stamp in UTC with a Z suffix (T113), the same on every device.
function computeExpectedPublishedLabel(version: string): string {
  const match = /^v?(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?Z$/.exec(version);
  if (!match) return version;
  const d = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +(match[6] ?? '0')));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hr = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${mon} ${day} ${hr}:${min}Z`;
}

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
});

test.describe('MobileMenu', () => {
  test.describe('layout', () => {
    test('brand shows the version for the running environment', async ({ page }) => {
      await openMobileMenu(page);
      const onDisk = readBuildInfo();
      expect(onDisk.version).toMatch(/^v\d{8}T\d{4}Z$/);
      const expectedPublished = computeExpectedPublishedLabel(onDisk.version);

      const versionEl = page.locator('.mob-menu-version');
      await expect(versionEl).toBeVisible();
      const escaped = expectedPublished.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await expect(versionEl).toHaveText(new RegExp(`^(?:dev [a-f0-9]{7,8}(?: \\+ changes)?|${escaped})$`));
    });

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
        'New project', 'Projects', 'Open a file', 'Save', 'Save all', 'Save As / Export',
        'Revert unsaved changes', 'Project details', 'Advanced',
      ]);
      expect(await items('App')).toEqual([
        'Manage Drivers', 'Options', 'OpenISD and WinISD differences', 'Diagnostics', 'About OpenISD', 'Switch to Desktop view',
        'Automatic view',
      ]);
      // A visible divider sits between the two sections.
      const divider = await sections.nth(1).evaluate(el => getComputedStyle(el).borderTopWidth);
      expect(divider).not.toBe('0px');
    });

    // A saved layout choice (this spec's setup) adds "Automatic view" to the App section; choosing it
    // clears the choice and the entry goes, the window being phone-sized keeps the mobile skin.
    test('"Automatic view" is in the App section while a layout choice is saved, and gone once chosen', async ({ page }) => {
      await tapMobileMenuItem(page, 'Automatic view');
      await expect(page.locator('.mobile-root')).toBeVisible();
      await openMobileMenu(page);
      const app = page.locator('.mob-menu-section', { has: page.locator('.mob-menu-section-head', { hasText: 'App' }) });
      await expect(app.locator('.mob-menu-item', { hasText: 'Switch to Desktop view' })).toBeVisible();
      await expect(app.locator('.mob-menu-item', { hasText: 'Automatic view' })).toHaveCount(0);
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
    });
  });

  // The menu's "Projects" lists every project (saved or open), distinct from
  // "Open a file" (a disk import). John, 2026-10-02: "the file menu offer no way to save and reopen
  // projects".
  test.describe('Projects', () => {
    // T204: the list holds every project, saved or open, so the open project shows before it is saved.
    test('before anything is saved it lists only the open project, marked not saved', async ({ page }) => {
      await tapMobileMenuItem(page, 'Projects');
      const pane = page.locator('.mob-projects-pane');
      await expect(pane).toBeVisible();
      await expect(pane.locator('.mob-project-row')).toHaveCount(1);
      await expect(pane.locator('.mob-project-row')).toContainText('Not saved yet');
    });

    test('Save, then "Projects" lists it and reopens it', async ({ page }) => {
      const before = await mobileFieldRow(page, 'Volume').locator('input').first().inputValue();

      await tapMobileMenuItem(page, /^Save$/);

      await tapMobileMenuItem(page, 'Projects');
      const pane = page.locator('.mob-projects-pane');
      await expect(pane).toBeVisible();
      await expect(pane.locator('.mob-project-row')).toHaveCount(1);

      await pane.locator('.mob-project-row').first().click();
      await expect(pane).toHaveCount(0);
      // Reopening the same project lands back on the Box tab with the same value — a real
      // re-load, not a no-op that merely closed the sheet.
      await expect(mobileFieldRow(page, 'Volume').locator('input').first()).toHaveValue(before);
    });

    // John, 2026-10-14: a project was marked unsaved but Save all was not highlighted. Save is
    // highlighted while the focused project has unsaved changes, Save all while ANY open project
    // has (the same two rules as the desktop toolbar).
    test('Save and Save all are highlighted while there are unsaved changes', async ({ page }) => {
      await openMobileMenu(page);
      const save = page.locator('.mob-menu-item', { hasText: /^Save$/ });
      const saveAll = page.locator('.mob-menu-item', { hasText: /^Save all$/ });
      await expect(saveAll).toBeDisabled();
      await expect(save).not.toHaveClass(/dirty/);
      await expect(saveAll).not.toHaveClass(/dirty/);

      await setFocusedBoxVolume(page, 0.012);
      await expect(save).toHaveClass(/dirty/);
      await expect(saveAll).toBeEnabled();
      await expect(saveAll).toHaveClass(/dirty/);

      // Focus moves to a second, unedited project; the first keeps its unsaved changes.
      await duplicateFocusedProject(page, 'Second');
      await expect(saveAll).toBeEnabled();
      await expect(saveAll).toHaveClass(/dirty/);
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

      await tapMobileMenuItem(page, 'Projects');
      const rows = page.locator('.mob-projects-pane .mob-project-row');
      await expect(rows).toHaveCount(2);
      await expect(rows.locator('.mob-project-name')).toHaveText(['Second', 'sample-project']);
      await expect(rows.locator('.mob-project-summary')).toHaveText([
        'Tang Band W5-1138SMF · Closed · 20.0 L',
        'Tang Band W5-1138SMF · Vented · 12.0 L',
      ]);
      // John, 2026-10-12: never US style; the one design formatter shows "5 Oct 2026, 23:32", whatever the browser locale.
      for (const modified of await rows.locator('.mob-project-meta').allTextContents()) {
        // T204: the edited date, then the size.
        expect(modified.trim()).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} · [\d.]+ (B|KB)/);
      }
    });

    // John, 2026-10-05: "the Open project popup doesn't cover the entire screen — it should".
    test('the sheet fills the whole screen', async ({ page }) => {
      await page.setViewportSize({ width: 412, height: 915 });
      await tapMobileMenuItem(page, 'Projects');
      const box = await page.locator('.mob-projects-pane').boundingBox();
      expect(box).toEqual({ x: 0, y: 0, width: 412, height: 915 });
      await expect(page.locator('.mob-projects-pane .mob-dlg-footer').getByRole('button', { name: 'Close' })).toBeVisible();
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
