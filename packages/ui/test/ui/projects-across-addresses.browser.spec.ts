import {expect, test, openAProject, setFocusedBoxVolume, duplicateFocusedProject} from '../fixtures.js';
import {SAMPLE_PROJECT_OWPR} from '../fixtures/sampleProject.js';
import '../fixtures/generateSample.js';

test.describe('Projects across addresses', () => {
  test('the store address is shown in the open dialog, and projects can be exported', async ({ page }) => {
    // Open a project to get the app running
    await page.goto("/");
    await openAProject(page, SAMPLE_PROJECT_OWPR);
    
    // Create a second project so we have something to export
    await duplicateFocusedProject(page, 'Second Project');

    // Open the open project dialog
    await page.locator('.tb-btn[title^="Open project"]').click();
    
    // Check for the store address
    const storeLabel = page.locator('.store-label');
    await expect(storeLabel).toBeVisible();
    await expect(storeLabel).toContainText('Projects saved in this browser at http://localhost');

    // Click Export all projects
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-projects').click();
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/^openisd-projects-.*\.json$/);
  });
  
  test('export then import into fresh storage restores every project', async ({ page }) => {
    await page.goto("/");
    await openAProject(page, SAMPLE_PROJECT_OWPR);
    await duplicateFocusedProject(page, 'Exported Project 2');
    
    // Export
    await page.locator('.tb-btn[title^="Open project"]').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export-projects').click();
    const download = await downloadPromise;
    const path = await download.path();
    
    // Clear storage to simulate fresh storage
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    
    // Import the file using the hidden input
    await page.locator('.tb-btn[title^="Open project"]').click();
    await page.locator('.original-root input[type=file]').setInputFiles(path!);
    
    // Close the dialog and re-open it so it refreshes the list
    await page.locator('.open-project-dialog .close-btn').click();
    await page.locator('.tb-btn[title^="Open project"]').click();
    
    // Verify projects are imported and the dialog shows them
    const projectRows = page.locator('.stored-project-row');
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
    
    const downloadPromise = page.waitForEvent('download');
    
    // Set up dialog waiting
    let confirmMessage = '';
    const dialogPromise = new Promise<void>(resolve => {
      page.once('dialog', async dialog => {
        confirmMessage = dialog.message();
        await dialog.accept();
        resolve();
      });
    });
    
    await setFocusedBoxVolume(page, 0.05); // edit project to make it dirty
    
    // We can also click Save explicitly
    await page.locator('.tb-btn[title^="Save"]').first().click();

    // Wait for the dialog to be handled
    await dialogPromise;

    // Check confirm message
    expect(confirmMessage).toContain('Could not save: browser storage is full');
    
    // Check if export was triggered
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^openisd-projects-.*\.json$/);
  });
});
