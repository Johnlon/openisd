import type {Locator, Page} from '@playwright/test';
import {expect, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {enableCloudSync} from './fixtures/cloudSyncStubs.js';

/** John, 16 Oct 2026 (bugs/BUG_20261016_live-crash-no-project-is-focused.md): with no project
 *  open, every app-level feature stays reachable from the menu, on both skins. Only project-level
 *  items (Save, the project tabs, charts, Tune) are hidden or disabled. */

async function opensAndCloses(page: Page, open: () => Promise<void>, dialog: Locator): Promise<void> {
  await open();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}

test('mobile: with no project open, the menu reaches every app-level feature', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await forceMobileSkin(page);
  await enableCloudSync(page);
  await page.goto('/');
  await expect(page.locator('.mob-empty')).toBeVisible();

  await page.locator('.mob-hamburger').click();
  const menu = page.locator('.mob-menu');
  for (const item of ['New project', 'Projects', 'Open a file', 'Manage Drivers', 'Options',
    'OpenISD and WinISD differences', 'Diagnostics', 'About OpenISD', 'Switch to Desktop view']) {
    await expect(menu.locator('.mob-menu-item', {hasText: item})).toBeVisible();
  }
  for (const item of ['Save', 'Save all', 'Save As / Export', 'Revert unsaved changes', 'Project details', 'Advanced']) {
    await expect(menu.locator('.mob-menu-item', {hasText: new RegExp(`^${item}$`)})).toHaveCount(0);
  }
  await expect(menu.locator('.mob-menu-cloud')).toBeVisible();
  await page.locator('.mob-menu-overlay').click({position: {x: 380, y: 400}});

  await tapMobileMenuItem(page, 'New project');
  await expect(page.locator('.mob-np-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mob-np-overlay')).toBeHidden();

  await tapMobileMenuItem(page, 'Projects');
  await expect(page.locator('.mob-projects-pane')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mob-projects-pane')).toBeHidden();

  await tapMobileMenuItem(page, 'Manage Drivers');
  await expect(page.locator('.mob-pane-dialog, [role=dialog]').filter({hasText: 'Manage drivers'}).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mob-pane-dialog, [role=dialog]').filter({hasText: 'Manage drivers'}).first()).toBeHidden();

  await tapMobileMenuItem(page, 'Options');
  await expect(page.locator('.mob-dlg[aria-label="Options"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mob-dlg[aria-label="Options"]')).toBeHidden();

  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-cloud').click();
  await expect(page.locator('.mob-cloud-dialog-body')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mob-cloud-dialog-body')).toBeHidden();

  await tapMobileMenuItem(page, 'OpenISD and WinISD differences');
  await expect(page.getByRole('dialog', {name: 'OpenISD and WinISD differences'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', {name: 'OpenISD and WinISD differences'})).toBeHidden();

  await tapMobileMenuItem(page, 'Diagnostics');
  await expect(page.locator('.mob-dlg')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mob-dlg')).toBeHidden();

  await tapMobileMenuItem(page, 'About OpenISD');
  await expect(page.locator('.sp')).toBeVisible();
});

test('desktop: with no project open, the toolbar reaches every app-level feature', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ui: {splashSeen: true}}));
  });
  await enableCloudSync(page);
  await page.goto('/');
  await expect(page.locator('.graph-empty-h')).toBeVisible();
  const info = (item: string) => async () => {
    await page.locator('.tb-btn[title="Info"]').click();
    await page.locator('.menu-item', {hasText: item}).click();
  };

  await page.locator('.tb-btn[title^="New project"]').click();
  await expect(page.locator('.np-step').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.np-step')).toHaveCount(0);

  // T217: Open goes to the Projects list (no dialog); with no project it is empty and focused.
  await page.locator('.tb-btn[title="Open project"]').click();
  await expect(page.locator('.projects-list')).toBeFocused();

  await expect(page.locator('.graph-empty-link', {hasText: 'Import project'})).toBeEnabled();
  await opensAndCloses(page, () => page.locator('.tb-btn[title^="Manage Drivers"]').click(), page.locator('.wb-modal'));
  await page.locator('.tb-btn[title="Options"]').click();
  await expect(page.locator('.opt-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.opt-modal')).toBeHidden();

  await page.locator('.cloud-sync-badge').click();
  await expect(page.locator('.cloud-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.cloud-modal')).toBeHidden();

  await info('OpenISD and WinISD differences')();
  await expect(page.locator('.wd-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.wd-modal')).toBeHidden();
  await info('Diagnostics')();
  await expect(page.locator('.dg')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.dg')).toBeHidden();
  await info('About OpenISD')();
  await expect(page.locator('.sp')).toBeVisible();

  await expect(page.locator('.tb-btn[title^="Save - "]')).toHaveClass(/disabled/);
});
