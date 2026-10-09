/**
 * BUG_20261009_file-open-shows-diagnostics-on-mobile:
 * The mobile file-open dialog shows the file list, never the diagnostics dump.
 * Diagnostics opens only from an explicit Diagnostics action in the menu.
 */
import {expect, test} from '../fixtures.js';
import {forceMobileSkin, openMobileMenu} from '../fixtures/mobileSkin.js';
import {readFileSync} from 'node:fs';
import {ensureSampleProject} from '../fixtures/sampleProject.js';

test.describe('Mobile file-open dialog and diagnostics', () => {
  test('file-open dialog shows the file list without diagnostics; diagnostics opens only from explicit menu action', async ({ page }) => {
    await forceMobileSkin(page);
    const sampleOwprPath = ensureSampleProject();
    const cleanOwpr = readFileSync(sampleOwprPath, 'utf8');
    // Modify one field to cause a repairable field condition
    const repairableOwpr = cleanOwpr.replace(/"portVelocityLimit_m_per_s":\s*\d+/, '"portVelocityLimit_m_per_s": "fast"');

    // Pre-seed localStorage with a stored project
    await page.addInitScript(({ owpr }) => {
      localStorage.setItem('openisd_projects', JSON.stringify({
        version: 1,
        entries: [{
          id: 'proj-1',
          text: owpr,
          modified: new Date().toISOString(),
        }],
      }));
    }, { owpr: repairableOwpr });

    await page.goto('/');

    // Empty state: tap "Open project"
    await expect(page.locator('.mob-empty')).toBeVisible();
    await page.getByRole('button', { name: 'Open project' }).click();

    // The open project sheet opens and shows the file list
    const sheet = page.locator('.mob-open-project-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.mob-stored-project-row')).toHaveCount(1);

    // Diagnostics modal is NOT visible and page does not contain diagnostics dump
    await expect(page.locator('.dg')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('OpenISD diagnostics');

    // Close the file-open sheet
    await sheet.locator('.mob-dlg-close').click();
    await expect(sheet).toHaveCount(0);

    // Open a project to get access to the hamburger menu
    await page.getByRole('button', { name: 'Open project' }).click();
    await sheet.locator('.mob-stored-project-row').click();
    await expect(page.locator('.mob-topbar')).toBeVisible();

    // Open the hamburger menu and verify explicit Diagnostics action
    await openMobileMenu(page);
    const diagItem = page.locator('.mob-menu-item', { hasText: 'Diagnostics' });
    await expect(diagItem).toBeVisible();
    await diagItem.click();

    // Diagnostics modal is now visible via explicit action
    await expect(page.locator('.dg')).toBeVisible();
    await expect(page.locator('.dg header h2')).toBeVisible();

    // Dismiss closes it
    await page.locator('.dg-x').click();
    await expect(page.locator('.dg')).toHaveCount(0);
  });
});
