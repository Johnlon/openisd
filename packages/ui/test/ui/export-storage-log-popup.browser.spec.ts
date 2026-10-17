/** John, 17 Oct 2026: every button shows a visible result. "Export log" on the saved-data-is-gone notice ends with a popup. */
import {expect, test} from '../fixtures.js';
import {expectExportedPopup} from '../fixtures/exportPopup.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';

async function seedLostDrivers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_storage_log', JSON.stringify({entries: [{at: '20261011T100000Z', keys: {openisd_my_drivers: 5120}}]}));
  });
}

async function exportTheLog(page: Page): Promise<void> {
  const notice = page.locator('.confirm-modal');
  await expect(notice).toContainText('they are gone now.');
  const download = page.waitForEvent('download');
  await notice.getByRole('button', {name: 'Export log'}).click();
  await download;
  await expectExportedPopup(page, 'Storage log exported', /^Exported the storage log to openisd-storage-log-\d{8}T\d{6}Z\.json\.$/);
}

test('Original skin: Export log shows a popup saying what was exported', async ({page}) => {
  await seedLostDrivers(page);
  await page.goto('/');
  await exportTheLog(page);
  await expect(page.locator('.confirm-modal')).toBeHidden();
});

test('Mobile skin: Export log shows a popup saying what was exported', async ({page}) => {
  await forceMobileSkin(page);
  await seedLostDrivers(page);
  await page.goto('/');
  await exportTheLog(page);
  await expect(page.locator('.confirm-modal')).toBeHidden();
});
