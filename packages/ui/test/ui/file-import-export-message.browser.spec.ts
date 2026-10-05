/**
 * John, 2026-10-05: "when a driver or project has been imported/exported we need a little
 * message". Opening a project file and exporting it as a WinISD .wpr each show a toast naming
 * the file, in both skins. The message wording for every path is proven in applicationIO.test.ts.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, openMobileMenu} from '../fixtures/mobileSkin.js';

test.describe('import and export messages', () => {
  test('desktop: opening a project and exporting it as .wpr each say so', async ({ page }) => {
    await page.goto('/');
    await openAProject(page);
    await expect(page.locator('.flash')).toHaveText('Project imported from sample-project.owpr');

    await page.locator('.toolbar #btnExportMenu').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.export-menu-list button', { hasText: 'Save As WinISD project (.wpr)' }).click(),
    ]);
    await expect(page.locator('.flash')).toHaveText(`Project exported as ${download.suggestedFilename()}`);
  });

  test('mobile: opening a project and exporting it as .wpr each say so', async ({ page }) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
    await expect(page.locator('.flash')).toHaveText('Project imported from sample-project.owpr');

    await openMobileMenu(page);
    await page.locator('.mob-menu-export .export-menu-trigger').click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('.export-menu-list button', { hasText: 'Save As WinISD project (.wpr)' }).click(),
    ]);
    await expect(page.locator('.flash')).toHaveText(`Project exported as ${download.suggestedFilename()}`);
  });
});
