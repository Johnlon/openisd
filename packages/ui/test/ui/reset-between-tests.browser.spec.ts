import {expect, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {owdrText, type SeedDriver} from '../fixtures/seedMyDrivers.js';

/**
 * T922: what one test puts in the user libraries (a saved driver, a saved passive radiator, a star on a
 * driver or a radiator) must be gone before the next test on the same worker
 * (BUG_20261118_browser-tests-leak-my-drivers). The two tests run in order on one worker's shared page:
 * the first makes each of the four, the way a user does; the second looks for them.
 */
const LEAKED: SeedDriver = {
  brand: 'Leak Probe', model: 'LP-922', specs: {Fs_hz: 30, Qts: 0.4, Qms: 4, Vas_m3: 0.05, Re_ohm: 6.4, Sd_m2: 0.02, Xmax_m: 0.008},
};
const RADIATOR = 'Leak Probe PR 922';

/** The wizard opened on its passive radiator step (any driver, a passive radiator box). */
async function openRadiatorStep(page: Page): Promise<void> {
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await modal.locator('.dlist .ditem').first().click();
  await modal.locator('.modal-footer').getByRole('button', {name: 'Next', exact: true}).click();
  await modal.locator('.modal-footer').getByRole('button', {name: 'Next', exact: true}).click();
  await modal.getByLabel('Box type').selectOption('box-passive-radiator');
  await modal.locator('.modal-footer').getByRole('button', {name: 'Next', exact: true}).click();
  await modal.locator('#np-pr-select').click();
  await expect(page.locator('.pr-lib')).toBeVisible();
}

async function leaveWizard(page: Page): Promise<void> {
  await page.getByRole('button', {name: 'Done'}).click();
  await page.locator('.overlay.open').getByRole('button', {name: 'Cancel', exact: true}).click();
  await expect(page.locator('.overlay.open')).toHaveCount(0);
}

test.describe.configure({mode: 'serial'});

test.describe('what one test puts in the user libraries', () => {
  test('first test: saves a driver, saves a passive radiator, stars a driver and stars a radiator', async ({appPage: page}) => {
    // A driver imported into My Drivers.
    await page.locator('.tb-btn[title*="New project"]').click();
    const modal = page.locator('.overlay.open');
    await modal.locator('input[type=file]').setInputFiles({
      name: 'LP-922.owdr', mimeType: 'application/x-openisd-driver', buffer: Buffer.from(owdrText(LEAKED, '00000000-0000-4000-8000-000000009220')),
    });
    await expect(page.locator('.flash').last()).toContainText('Driver imported to My Drivers: Leak Probe LP-922');
    await modal.getByRole('button', {name: 'Cancel', exact: true}).click();
    await expect(page.locator('.overlay.open')).toHaveCount(0);

    // A star on a catalogue driver.
    await page.locator('.tb-btn[title^="Manage Drivers"]').click();
    const library = page.locator('.driver-library');
    await library.locator('.dlist .ditem:not(.my-ditem) .fav-btn').first().click();
    await expect(library.locator('.dlist .fav-btn.on')).toHaveCount(1);
    await page.locator('.overlay.on .x').first().click();
    await expect(page.locator('.overlay.on')).toHaveCount(0);

    // A saved passive radiator, and a star on it.
    await openRadiatorStep(page);
    await page.getByRole('button', {name: /Define new passive radiator/}).click();
    const editor = page.getByRole('dialog', {name: 'Define new passive radiator'});
    await editor.locator('#pr-editor-name').fill(RADIATOR);
    await editor.getByRole('button', {name: 'Copy to My PRs'}).click();
    await editor.getByRole('button', {name: 'OK'}).click();
    await expect(editor).toHaveCount(0);
    await page.locator('#np-pr-select').click();
    const saved = page.locator('.pr-lib-item', {hasText: RADIATOR});
    await expect(saved).toHaveCount(1);
    await saved.locator('.fav-btn').click();
    await expect(saved.locator('.fav-btn.on')).toHaveCount(1);
    await leaveWizard(page);
  });

  test('next test on the same worker: no saved driver, no saved radiator, no star', async ({appPage: page}) => {
    await page.locator('.tb-btn[title^="Manage Drivers"]').click();
    const library = page.locator('.driver-library');
    await expect(library.locator('.dlist')).toBeVisible();
    await expect(library.locator('.my-ditem')).toHaveCount(0);
    await expect(library.locator('.dlist .ditem', {hasText: 'LP-922'})).toHaveCount(0);
    await expect(library.locator('.dlist .fav-btn.on')).toHaveCount(0);
    await page.locator('.overlay.on .x').first().click();
    await expect(page.locator('.overlay.on')).toHaveCount(0);

    await openRadiatorStep(page);
    await expect(page.locator('.pr-lib-item', {hasText: RADIATOR})).toHaveCount(0);
    await expect(page.locator('.pr-lib .pr-lib-del')).toHaveCount(0);
    await expect(page.locator('.pr-lib .fav-btn.on')).toHaveCount(0);
    await leaveWizard(page);
  });
});
