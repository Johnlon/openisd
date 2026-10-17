import {expect, test, openAProject, setFocusedBoxVolume, duplicateFocusedProject} from '../fixtures.js';
import {SAMPLE_PROJECT_OWPR} from '../fixtures/sampleProject.js';
import '../fixtures/generateSample.js';

test.describe('Projects across addresses', () => {
  test('the store address is shown in the Bin view, and projects can be exported', async ({ page }) => {
    // Open a project to get the app running
    await page.goto("/");
    await openAProject(page, SAMPLE_PROJECT_OWPR);
    
    // Create a second project so we have something to export
    await duplicateFocusedProject(page, 'Second Project');

    // Check for the store address in the Bin view
    await page.locator('.projects-panel-footer .bin-toggle').click();
    const storeLabel = page.locator('.store-label');
    await expect(storeLabel).toBeVisible();
    await expect(storeLabel).toContainText('Projects saved in this browser at http://localhost');
    await page.getByRole('button', {name: 'Back to projects'}).click();

    // Click Export all
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-all-btn').click();
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/^openisd-projects-.*\.json$/);
  });
  
  test('export then import into fresh storage restores every project', async ({ page }) => {
    await page.goto("/");
    await openAProject(page, SAMPLE_PROJECT_OWPR);
    await duplicateFocusedProject(page, 'Exported Project 2');
    
    // Export
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-all-btn').click();
    const download = await downloadPromise;
    const path = await download.path();
    
    // Clear storage to simulate fresh storage
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // Import the file using the hidden input
    await page.locator('.original-root input[type=file]').setInputFiles(path!);
    
    // Verify projects are imported and the projects panel shows them
    const projectRows = page.locator('.projects-list .project-row');
    await expect(projectRows).toHaveCount(2);
    const text = await projectRows.allTextContents();
    expect(text.join(' ')).toContain('sample-project');
    expect(text.join(' ')).toContain('Exported Project 2');
  });

  test('a forced setItem quota error on save shows the message and the export offer', async ({ page }) => {
    // Force a quota error in localStorage
    await page.addInitScript(() => {
      const originalSetItem = window.localStorage.setItem;
      Reflect.set(window, 'forceQuotaError', false);
      window.localStorage.setItem = function(key, value) {
        if (key === 'openisd_projects' && Reflect.get(window, 'forceQuotaError')) {
          throw new DOMException('QuotaExceededError');
        }
        originalSetItem.call(window.localStorage, key, value);
      };
    });

    await page.goto("/");
    await openAProject(page, SAMPLE_PROJECT_OWPR);
    
    // Enable the quota error
    await page.evaluate(() => { Reflect.set(window, 'forceQuotaError', true); });
    
    await setFocusedBoxVolume(page, 0.05); // edit project to make it dirty
    await page.locator('.tb-btn[title^="Save"]').first().click();

    // The save failure asks through the in-app confirm dialog (applicationIO handleSaveFailure).
    await expect(page.locator('.confirm-overlay')).toBeVisible();
    await expect(page.locator('.confirm-modal')).toContainText('Browser storage is full');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.confirm-dialog-confirm').click(); // Export

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^openisd-projects-.*\.json$/);
    // The export then says what it did (T268), and OK closes that popup.
    await expect(page.locator('.confirm-modal')).toContainText('Exported 1 project to openisd-projects-');
    await page.locator('.confirm-dialog-confirm').click();
    await expect(page.locator('.confirm-overlay')).toHaveCount(0);
  });
});
