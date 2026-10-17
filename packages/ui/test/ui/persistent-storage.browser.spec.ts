/**
 * Persistent storage, on both skins: when the browser refuses to keep OpenISD's data, a banner
 * says so at startup (until dismissed, remembered over a reload) and Your data always says so; a
 * storage nearly full is warned about on Your data.
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

const WARNING = /^Nothing is wrong now \(\d+ projects?, [\d.]+ (B|KB|MB) of 5 MB used\): this browser could clear OpenISD's data only if your disk gets nearly full\. OpenISD warns you when its storage is 80% full \(usage is in Options, Your data\); to be safe, use Chrome, turn on Google Drive sync, or export your projects\.$/;

/** The browser refuses to keep the data, and says the site holds 90 of the 100 MB it allows. */
async function refusingNearlyFullBrowser(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // The suite starts with the warning dismissed; this spec wants it back, on its first load only.
    if (sessionStorage.getItem('persist-spec') === null) {
      localStorage.removeItem('openisd_persist_warning_dismissed');
      sessionStorage.setItem('persist-spec', '1');
    }
    const mb = 1024 * 1024;
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persisted: () => Promise.resolve(false),
        persist: () => Promise.resolve(false),
        estimate: () => Promise.resolve({usage: 90 * mb, quota: 100 * mb}),
      },
    });
  });
}

async function yourDataSaysSo(page: Page): Promise<void> {
  await page.locator('.opt-tab', {hasText: 'Your data'}).click();
  await expect(page.locator('.su-persist-warning')).toHaveText(WARNING);
  await expect(page.locator('.su-full-warning')).toHaveText(/^Storage is 90% full \(\d+ projects?, [\d.]+ (B|KB|MB) of 5 MB used\)\. Export or delete old projects\.$/);
  await expect(page.locator('.su-site')).toHaveText('This site uses 90.0 MB of the 100.0 MB this browser allows.');
}

test('desktop: a refused browser is warned about at startup until dismissed, and always on Your data', async ({page}) => {
  await refusingNearlyFullBrowser(page);
  await page.goto('/');
  const banner = page.locator('.persist-banner');
  await expect(banner.locator('.persist-banner-text')).toHaveText(WARNING);
  await banner.getByRole('button', {name: 'Dismiss'}).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.tb-btn').first()).toBeVisible();
  await expect(banner).toHaveCount(0);

  await page.locator('.tb-btn[title="Options"]').or(page.getByRole('button', {name: 'Options'})).first().click();
  await yourDataSaysSo(page);
});

test('mobile: a refused browser is warned about at startup until dismissed, and always on Your data', async ({page}) => {
  await forceMobileSkin(page);
  await refusingNearlyFullBrowser(page);
  await page.goto('/');
  const banner = page.locator('.persist-banner');
  await expect(banner.locator('.persist-banner-text')).toHaveText(WARNING);
  await banner.getByRole('button', {name: 'Dismiss'}).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await openAMobileProject(page);
  await expect(banner).toHaveCount(0);

  await tapMobileMenuItem(page, 'Options');
  await yourDataSaysSo(page);
});
