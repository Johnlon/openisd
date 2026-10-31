import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import type {Page} from '@playwright/test';

const skins = [
  {name: 'desktop', root: '.dg', open: async (page: Page) => {await page.goto('/'); await openAProject(page);}},
  {name: 'mobile', root: '.mob-dlg', open: async (page: Page) => {await forceMobileSkin(page); await page.goto('/'); await openAMobileProject(page);}},
];
for (const skin of skins) {
  test(`${skin.name}: completed stored-data repair does not misidentify the fault as running code`, async ({page}) => {
    await skin.open(page);
    const before = await page.evaluate(() => localStorage.getItem('openisd_projects'));
    await page.evaluate(() => {
      const error = Object.assign(new Error('Stored-view repair fixture'), {name: 'StoredDataFault', store: 'view'});
      window.dispatchEvent(new ErrorEvent('error', {message: error.message, error}));
    });
    await page.getByTestId('crash-dismiss').click();
    const dialog = page.locator(skin.root);
    const repair = dialog.locator('.dg-fix').filter({hasText: 'Reset the chart layout and panels'});
    await expect(repair).toBeVisible();
    const download = page.waitForEvent('download');
    await repair.getByRole('button', {name: 'Apply', exact: true}).click();
    expect((await download).suggestedFilename()).toBe('openisd_view.backup.json');
    await expect(dialog.locator('.dg-outcome')).toContainText('Saved a backup');
    await expect(dialog).not.toContainText('this fault is in the running code');
    expect(await page.evaluate(() => localStorage.getItem('openisd_projects'))).toBe(before);
  });
}
