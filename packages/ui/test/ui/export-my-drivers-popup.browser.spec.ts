/** John, 17 Oct 2026: every button shows a visible result. "Export my data" (saved drivers that cannot be read) ends with a popup. */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {expectExportedPopup} from '../fixtures/exportPopup.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';

async function seedUnreadableDrivers(page: Page): Promise<void> {
  await page.addInitScript(() => { localStorage.setItem('openisd_my_drivers', '{"schema": 2, "drivers": [BROKEN'); });
}

async function exportMyData(page: Page): Promise<void> {
  const modal = page.locator('.my-storage-modal');
  await expect(modal).toBeVisible();
  const download = page.waitForEvent('download');
  await modal.getByRole('button', {name: 'Export my data'}).click();
  await download;
  await expectExportedPopup(page, 'Saved drivers exported', /^Exported your saved drivers, as they are stored, to my-drivers-export\.json\.$/);
}

test('Original skin: Export my data shows a popup saying what was exported', async ({page}) => {
  await seedUnreadableDrivers(page);
  await page.goto('/');
  await openAProject(page);
  await page.locator('[title*="librar" i]').first().click();
  await exportMyData(page);
  await expect(page.locator('.confirm-modal')).toBeHidden();
});

test('Mobile skin: Export my data shows a popup saying what was exported', async ({page}) => {
  await forceMobileSkin(page);
  await seedUnreadableDrivers(page);
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, 'Manage Drivers');
  await exportMyData(page);
  await expect(page.locator('.confirm-modal')).toBeHidden();
});
