import type {Page} from '@playwright/test';
import {expect, openAProject, test} from '../fixtures.js';

async function enableCloudSync(page: Page) {
  await page.route('**/*main*', async route => {
    const url = route.request().url();
    if (!url.endsWith('.js') && !url.endsWith('.ts') && !url.includes('/assets/main-')) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    let text = await response.text();
    if (text.includes('clientId:null')) {
      text = text.replace('clientId:null', 'clientId:"stubbed-client-id"');
    }
    await route.fulfill({
      response,
      body: text,
    });
  });
}

async function stubGoogleApis(page: Page) {
  await page.route('**/accounts.google.com/**', async route => {
    const url = new URL(route.request().url());
    const redirectUri = url.searchParams.get('redirect_uri') ?? 'http://localhost:4100/';
    const state = url.searchParams.get('state') ?? '';
    const callbackUrl = `${redirectUri}#access_token=ya29.stubbed_test_token&token_type=Bearer&expires_in=3600&state=${state}`;
    await route.fulfill({
      status: 302,
      headers: { Location: callbackUrl },
    });
  });

  await page.route('**/*googleapis.com/**', async route => {
    const url = route.request().url();
    if (url.includes('/revoke')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
      return;
    }
    if (url.includes('/drive/v3/about')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { emailAddress: 'john@gmail.com' } }),
      });
      return;
    }
    if (url.includes('/drive/v3/changes/startPageToken')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ startPageToken: 'cursor-1' }),
      });
      return;
    }
    if (url.includes('/drive/v3/changes')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ kind: 'drive#changeList', changes: [], newStartPageToken: 'cursor-1' }),
      });
      return;
    }
    if (url.includes('/upload/drive/v3/files')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'file-stubbed-1',
          name: 'stubbed.owpr',
          headRevisionId: 'rev-stubbed-1',
          appProperties: {
            app: 'openisd',
            kind: 'project',
            uuid: 'proj-uuid-1',
            layout: '1',
            seq: '1',
            writer: 'device-laptop',
          },
        }),
      });
      return;
    }
    if (url.includes('/drive/v3/files')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ kind: 'drive#fileList', files: [] }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

test.describe('Cloud sync dialog (Plan P1-13)', () => {
  test('clicking toolbar sync icon opens Cloud sync dialog', async ({ page }) => {
    await enableCloudSync(page);
    await stubGoogleApis(page);
    await page.goto('/');
    await openAProject(page);

    const badge = page.locator('.cloud-sync-badge');
    await expect(badge).toBeVisible();
    await badge.click();

    const modal = page.locator('.cloud-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('#cloud-dialog-title')).toHaveText('Cloud sync');

    // Closes on Close button
    await modal.locator('.cloud-modal-close-btn').click();
    await expect(modal).toHaveCount(0);
  });

  test('Info menu "Cloud sync…" opens dialog and ✕ button closes it', async ({ page }) => {
    await enableCloudSync(page);
    await stubGoogleApis(page);
    await page.goto('/');
    await openAProject(page);

    await page.locator('.tb-btn.has-menu[title="Info"]').click();
    const menuItem = page.locator('.dropdown-menu .menu-item', { hasText: 'Cloud sync' });
    await expect(menuItem).toBeVisible();
    await menuItem.click();

    const modal = page.locator('.cloud-modal');
    await expect(modal).toBeVisible();

    // Closes on ✕
    await modal.locator('.cloud-modal-x').click();
    await expect(modal).toHaveCount(0);
  });

  test('dialog renders correct buttons and headline for status off and reconnect', async ({ page }) => {
    await enableCloudSync(page);
    await stubGoogleApis(page);
    await page.goto('/');
    await openAProject(page);

    await page.locator('.cloud-sync-badge').click();
    const modal = page.locator('.cloud-modal');
    await expect(modal.locator('.cloud-sync-headline')).toContainText('Cloud sync is off');
    await expect(modal.locator('button', { hasText: 'Connect Google Drive' })).toBeVisible();
    await expect(modal.locator('.cloud-sync-explainer')).toContainText('hidden folder in your own Google Drive');
    await expect(modal.locator('.cloud-sync-explainer a', { hasText: 'Privacy' })).toHaveAttribute('href', 'https://openisd.app/about/#privacy');
    await expect(modal.locator('.cloud-sync-explainer a')).toHaveAttribute('target', '_blank');
    await modal.locator('.cloud-modal-close-btn').click();

    // Now set reconnect status
    await page.evaluate(() => {
      localStorage.setItem('openisd_cloud_auth', JSON.stringify({
        kind: 'reconnect',
        account: 'john@gmail.com',
      }));
    });
    await page.reload();
    await page.locator('.cloud-sync-badge').click();
    await expect(modal.locator('.cloud-sync-headline')).toContainText('Google needs you to connect again');
    await expect(modal.locator('button', { hasText: 'Reconnect' })).toBeVisible();
    await expect(modal.locator('button', { hasText: 'Disconnect' })).toBeVisible();
  });

  test('conflict copy row renders and clicking Open calls conflictSeen', async ({ page }) => {
    await enableCloudSync(page);
    await stubGoogleApis(page);

    await page.addInitScript(() => {
      localStorage.setItem('openisd_storage_layout', '2');
      localStorage.setItem('openisd_cloud_auth', JSON.stringify({
        kind: 'token',
        accessToken: 'ya29.test_token',
        expiresAt_ms: Date.now() + 3600000,
        account: 'john@gmail.com',
      }));
      localStorage.setItem('openisd_cloud_state', JSON.stringify({
        rows: [],
        cursor: 'cursor-1',
        conflicts: [{
          id: { kind: 'project', text: 'proj-conflict-1' },
          name: 'Sub 12 (conflict, phone, 13 Oct 2026, 21:05)',
          from: 'device-phone',
          at_ms: 1776107100000,
        }],
        deviceId: 'device-laptop',
        maxSeq: 1,
      }));
    });

    await page.goto('/');
    await openAProject(page);

    await page.locator('.cloud-sync-badge').click();
    const modal = page.locator('.cloud-modal');
    await expect(modal).toBeVisible();

    const conflictRow = modal.locator('.cloud-sync-conflict-row');
    await expect(conflictRow).toBeVisible();
    await expect(conflictRow).toContainText('Sub 12 (conflict, phone, 13 Oct 2026, 21:05)');

    const openBtn = conflictRow.locator('button', { hasText: 'Open' });
    await openBtn.click();

    // Conflict row is dropped
    await expect(modal.locator('.cloud-sync-conflict-row')).toHaveCount(0);
  });

  test('disconnect action asks for confirmation first via ConfirmDialog', async ({ page }) => {
    await enableCloudSync(page);
    await stubGoogleApis(page);

    await page.addInitScript(() => {
      localStorage.setItem('openisd_storage_layout', '2');
      localStorage.setItem('openisd_cloud_auth', JSON.stringify({
        kind: 'token',
        accessToken: 'ya29.test_token',
        expiresAt_ms: Date.now() + 3600000,
        account: 'john@gmail.com',
      }));
    });

    await page.goto('/');
    await openAProject(page);

    await page.locator('.cloud-sync-badge').click();
    const modal = page.locator('.cloud-modal');
    await expect(modal).toBeVisible();

    const disconnectBtn = modal.locator('button', { hasText: 'Disconnect' });
    await disconnectBtn.click();

    // Confirm dialog overlay appears
    const confirmOverlay = page.locator('.confirm-overlay');
    await expect(confirmOverlay).toBeVisible();
    await expect(confirmOverlay).toContainText('Disconnect Google Drive?');

    // Cancel: keep connected
    await confirmOverlay.locator('.confirm-dialog-cancel').click();
    await expect(confirmOverlay).toHaveCount(0);

    // Try again and confirm
    await disconnectBtn.click();
    await expect(confirmOverlay).toBeVisible();
    await confirmOverlay.locator('.confirm-dialog-confirm').click();
    await expect(confirmOverlay).toHaveCount(0);

    // Status reverted to off
    await expect(modal.locator('.cloud-sync-headline')).toContainText('Cloud sync is off');
  });
});
