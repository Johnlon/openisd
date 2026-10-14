import {expect, openAProject, test} from '../fixtures.js';

test.describe('Redirect round trip', () => {
  test('redirect round trip preserves unsaved edit and strips OAuth fragment', async ({ page }) => {
    let googleIntercepted = false;

    await page.route('**/accounts.google.com/**', async route => {
      googleIntercepted = true;
      const url = new URL(route.request().url());
      const redirectUri = url.searchParams.get('redirect_uri') ?? 'http://localhost:4100/';
      const state = url.searchParams.get('state') ?? '';
      const callbackUrl = `${redirectUri}#access_token=ya29.stubbed_round_trip&token_type=Bearer&expires_in=3600&state=${state}`;
      await route.fulfill({
        status: 302,
        headers: {
          Location: callbackUrl,
        },
      });
    });

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

    await page.goto('/');
    await openAProject(page);

    // Focus a field and type an edit without pressing Enter or blurring
    const volInput = page.locator('#og-box-volume');
    await volInput.focus();
    await volInput.fill('45.5');
    await expect(volInput).toBeFocused();

    // Trigger the real Connect path: click toolbar sync icon → Connect
    const syncBadge = page.locator('.cloud-sync-badge');
    await expect(syncBadge).toBeVisible();
    await syncBadge.click();

    const connectBtn = page.locator('.cloud-modal button', { hasText: 'Connect Google Drive' });
    await expect(connectBtn).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('accounts.google.com')),
      connectBtn.click(),
    ]);
    expect(response.status()).toBe(302);
    expect(googleIntercepted).toBe(true);

    // Ensure we landed back on the app with the edit preserved and fragment stripped
    await expect(page.locator('.original-root')).toBeVisible();
    await expect(page.locator('#og-box-volume')).toHaveValue('45.50');
    expect(page.url()).not.toContain('access_token');
    expect(page.url()).not.toContain('#');
  });
});
