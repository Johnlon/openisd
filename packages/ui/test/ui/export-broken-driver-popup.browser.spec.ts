/** John, 17 Oct 2026: every button shows a visible result. Exporting one damaged saved driver ends with a popup. */
import {deviceRecord} from '../fixtures/seedMyDrivers.js';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {expectExportedPopup} from '../fixtures/exportPopup.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';

async function seedOneDamagedDriver(page: Page): Promise<void> {
  const good = {uuid: 'u-ok', record: deviceRecord({brand: 'Good', model: 'One', specs: {Fs_hz: 41, Re_ohm: 5.4, Sd_m2: 0.0132, Qts: 0.35, Qes: 0.38}}, 'u-ok')};
  const broken = {brand: {value: 'Ghost'}, model: {value: 'Blob'}, halfARecord: true};
  const raw = JSON.stringify({schema: 1, entries: [broken, good]});
  await page.addInitScript((value: string) => { localStorage.setItem('openisd_my_drivers', value); }, raw);
}

async function exportTheDamagedEntry(page: Page): Promise<void> {
  const row = page.locator('.my-broken-row');
  await expect(row).toContainText('Ghost Blob');
  const download = page.waitForEvent('download');
  await row.getByRole('button', {name: 'Export'}).click();
  await download;
  await expectExportedPopup(page, 'Driver entry exported', /^Exported the damaged driver entry to my-driver-\d+\.json\.$/);
}

test('Original skin: exporting a damaged driver shows a popup saying what was exported', async ({page}) => {
  await seedOneDamagedDriver(page);
  await page.goto('/');
  await openAProject(page);
  await page.locator('[title*="librar" i]').first().click();
  await exportTheDamagedEntry(page);
  await expect(page.locator('.confirm-modal')).toBeHidden();
});

test('Mobile skin: exporting a damaged driver shows a popup saying what was exported', async ({page}) => {
  await forceMobileSkin(page);
  await seedOneDamagedDriver(page);
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, 'Manage Drivers');
  await exportTheDamagedEntry(page);
  await expect(page.locator('.confirm-modal')).toBeHidden();
});
