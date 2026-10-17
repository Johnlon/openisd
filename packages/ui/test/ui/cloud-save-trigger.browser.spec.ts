import {dirtyFocusedDesign, expect, openAProject, test} from '../fixtures.js';
import {connectedToDrive} from './fixtures/driveConnected.js';
import {stubGoogleApis} from './fixtures/cloudSyncStubs.js';

test.describe('Cloud save trigger', () => {
  test('connected, save a project → within ~5 s a Drive files request is made', async ({ page }) => {
    await connectedToDrive(page);

    await page.goto('/');
    await openAProject(page);

    // Wait for initial boot sync to complete
    await expect(page.locator('.cloud-sync-badge .icon-cloudDone')).toBeVisible();

    // A save of an unchanged project has nothing to upload: the user changes the design first.
    await dirtyFocusedDesign(page);

    // Set up expectation for subsequent files request triggered by user save
    const saveDrivePromise = page.waitForRequest(
      req => req.url().includes('/drive/v3/files'),
    );

    // User saves the project
    const start = Date.now();
    await page.locator('.tb-btn[title^="Save - "]').click();

    // A Drive files request is made within ~5 s (debounced by 3 s)
    const filesReq = await saveDrivePromise;
    const elapsed = Date.now() - start;
    expect(filesReq.url()).toContain('/drive/v3/files');
    expect(elapsed).toBeLessThan(6000);
  });

  test('no client id → no Drive request after a save', async ({ page }) => {
    await stubGoogleApis(page);

    await page.addInitScript(() => {
      localStorage.setItem('openisd_cloud_auth', JSON.stringify({
        kind: 'token',
        accessToken: 'ya29.stubbed_test_token',
        expiresAt_ms: Date.now() + 3600000,
        account: 'john@gmail.com',
      }));
    });

    let driveRequested = false;
    page.on('request', req => {
      if (req.url().includes('googleapis.com')) {
        driveRequested = true;
      }
    });

    await page.goto('/');
    await openAProject(page);

    await page.locator('.tb-btn[title^="Save"]').first().click();

    // Wait 5 seconds to ensure no debounced sync triggers
    await new Promise(resolve => setTimeout(resolve, 5000));

    expect(driveRequested).toBe(false);
  });
});
