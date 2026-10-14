import {expect, test} from '../fixtures.js';

test.describe('Cloud sync boot lifecycle', () => {
  test('a #access_token= load connects and strips the fragment', async ({ page }) => {
    const testState = 'test-state-boot-123';

    await page.addInitScript(({ state }) => {
      localStorage.setItem('openisd_cloud_auth', JSON.stringify({
        kind: 'pending',
        state,
        returnTo: '/',
        silent: false,
      }));
    }, { state: testState });

    await page.goto(`/#access_token=ya29.boot_test_token&token_type=Bearer&expires_in=3600&state=${testState}`);
    await expect(page.locator('.original-root')).toBeVisible();

    // Verify fragment is stripped
    expect(page.url()).not.toContain('access_token');
    expect(page.url()).not.toContain('#');

    // Verify token is stored and connected
    const authRaw = await page.evaluate(() => localStorage.getItem('openisd_cloud_auth'));
    expect(authRaw).not.toBeNull();
    expect(authRaw).toContain('"kind":"token"');
    expect(authRaw).toContain('ya29.boot_test_token');
  });

  test('a plain load when off does not redirect', async ({ page }) => {
    let googleRequested = false;
    await page.route('**/accounts.google.com/**', route => {
      googleRequested = true;
      void route.abort();
    });

    await page.goto('/');
    await expect(page.locator('.original-root')).toBeVisible();

    expect(googleRequested).toBe(false);
    expect(page.url()).not.toContain('accounts.google.com');
  });
});
