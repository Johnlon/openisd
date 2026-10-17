import type {Page} from '@playwright/test';

export async function enableCloudSync(page: Page): Promise<void> {
  await page.route('**/*main*', async route => {
    const url = route.request().url();
    // Only the script that holds the client id is rewritten. The stylesheet main-<hash>.css matched
    // the old test and was fetched through the test runner for nothing: its fetch is what the
    // post-land run saw reset (F55).
    if (!url.endsWith('.js') && !url.endsWith('.ts') && !/\/assets\/main-[^/]*\.js(\?|$)/.test(url)) {
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
