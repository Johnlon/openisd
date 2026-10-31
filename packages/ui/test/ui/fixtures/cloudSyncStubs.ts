import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

/** The built app the suite's server serves (playwright.config.js BUILD_TEST_APP). */
const TEST_DIST = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', 'build', `test-dist-${process.env.OPENISD_TEST_PORT}`);

/** The app built with a Google client id: its main script, read from the built app on disk, with the
 *  client id set. Read from disk, never fetched through the test runner: the runner's pooled
 *  connection to the server was reset under load (F55, BUG_20261018_cloud-sync-stub-fetch-reset). */
export async function enableCloudSync(page: Page): Promise<void> {
  await page.route(/\/assets\/main-[^/?]*\.js(\?|$)/, async route => {
    const script = readFileSync(join(TEST_DIST, new URL(route.request().url()).pathname), 'utf8');
    if (!script.includes('clientId:null')) throw new Error('the built main script no longer holds clientId:null');
    await route.fulfill({contentType: 'text/javascript', body: script.replace('clientId:null', 'clientId:"stubbed-client-id"')});
  });
}

export async function stubGoogleApis(page: Page): Promise<void> {
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

  await page.route('**/www.googleapis.com/**', async route => {
    const url = route.request().url();
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
        body: JSON.stringify({ kind: 'drive#startPageToken', startPageToken: 'cursor-1' }),
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
    if (url.includes('/drive/v3/files')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ kind: 'drive#fileList', files: [] }),
      });
      return;
    }
    if (url.includes('/revoke')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
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

/** The storage layout the app writes now, read from its source, as the text a page's store is stamped
 *  with so it is not migrated (a migration forgets the cloud sync record). */
export const CURRENT_STORAGE_LAYOUT: string = (() => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'persistence', 'src', 'storageLayout.ts'), 'utf8');
  const match = /STORAGE_LAYOUT\s*(?::\s*number\s*)?=\s*(\d+)/.exec(source);
  if (match === null) throw new Error('storageLayout.ts does not say STORAGE_LAYOUT = <number>');
  return match[1];
})();
