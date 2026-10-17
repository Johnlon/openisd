/** John, 17 Oct 2026: every button shows a visible result. "Export everything" on the newer-store screen ends with a popup. */
import {expect, test} from '../fixtures.js';
import {expectExportedPopup} from '../fixtures/exportPopup.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';

async function seedNewerStore(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_storage_layout', '99');
    localStorage.setItem('openisd_projects', 'projects from the future');
  });
}

async function exportEverything(page: Page): Promise<void> {
  const gate = page.getByTestId('store-gate');
  await expect(gate).toBeVisible();
  const download = page.waitForEvent('download');
  await gate.getByRole('button', {name: 'Export everything'}).click();
  await download;
  await expectExportedPopup(page, 'Everything exported', /^Exported everything this browser holds for OpenISD to openisd-everything-\d{8}T\d{6}Z\.json\.$/);
}

test('Original skin: Export everything shows a popup saying what was exported', async ({page}) => {
  await seedNewerStore(page);
  await page.goto('/');
  await exportEverything(page);
  await expect(page.locator('.confirm-modal')).toBeHidden();
});

test('Mobile skin: Export everything shows a popup saying what was exported', async ({page}) => {
  await forceMobileSkin(page);
  await seedNewerStore(page);
  await page.goto('/');
  await exportEverything(page);
  await expect(page.locator('.confirm-modal')).toBeHidden();
});
