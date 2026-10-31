/**
 * Persistent storage, on both skins: when the browser refuses to keep OpenISD's data, a popup says
 * so at startup (once, until closed, remembered over a reload); when storage is nearly full a popup
 * says how full, at every start; Your data always says both.
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

const WARNING = /^Nothing is wrong now \(\d+ projects?, [\d.]+ (B|KB|MB) of 5 MB used\): this browser could clear OpenISD's data only if your disk gets nearly full\. OpenISD warns you when its storage is 80% full \(usage is in Options, Your data\); to be safe, use Chrome, turn on Google Drive sync, or export your projects\.$/;
const RISK = /^\w+( \w+)? has not granted persistent storage for this site, so it could clear your OpenISD projects if your disk gets nearly full\. Best: turn on Google Drive sync, so your projects live in Drive\. Otherwise export your projects\.$/;
const FULL = /^Storage is 90% full \(\d+ projects?, [\d.]+ (B|KB|MB) of 5 MB used\)\. \w+( \w+)? has not granted persistent storage for this site\. Best: turn on Google Drive sync, so your projects live in Drive\. Otherwise export your projects or delete old ones\.$/;

/** The browser refuses to keep the data, and says the site holds `usedMb` of the 100 MB it allows. */
async function refusingBrowser(page: Page, usedMb: number): Promise<void> {
  await page.addInitScript((used: number) => {
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
        estimate: () => Promise.resolve({usage: used * mb, quota: 100 * mb}),
      },
    });
  }, usedMb);
}

async function yourDataSaysSo(page: Page): Promise<void> {
  await page.locator('.opt-tab, .opt-phone-tabs button', {hasText: 'Your data'}).click();
  await expect(page.locator('.su-persist-warning')).toHaveText(WARNING);
  await expect(page.locator('.su-full-warning')).toHaveText(/^Storage is 90% full \(\d+ projects?, [\d.]+ (B|KB|MB) of 5 MB used\)\. Export or delete old projects\.$/);
  await expect(page.locator('.su-site')).toHaveText('This site uses 90.0 MB of the 100.0 MB this browser allows.');
}

/** The risk popup, then closing it: it stays closed over a reload. */
async function riskPopupShowsOnce(page: Page, settled: () => Promise<void>): Promise<void> {
  const popup = page.getByRole('alertdialog', {name: 'Your projects may not be kept'});
  await expect(popup.locator('p')).toHaveText(RISK);
  await popup.getByRole('button', {name: 'Close', exact: true}).click();
  await expect(popup).toHaveCount(0);
  await page.reload();
  await settled();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
}

/** The nearly-full popup, closed; after a reload it comes again. */
async function fullPopupComesAtEveryStart(page: Page, settled: () => Promise<void>): Promise<void> {
  const popup = page.getByRole('alertdialog', {name: 'Storage is nearly full'});
  await expect(popup.locator('p')).toHaveText(FULL);
  await popup.getByRole('button', {name: 'Close', exact: true}).click();
  await expect(popup).toHaveCount(0);
  await page.reload();
  await settled();
  await expect(popup.locator('p')).toHaveText(FULL);
  await popup.getByRole('button', {name: 'Close', exact: true}).click();
}

test('desktop: a refused browser is told once, in a popup, and always on Your data', async ({page}) => {
  await refusingBrowser(page, 1);
  await page.goto('/');
  await riskPopupShowsOnce(page, () => expect(page.locator('.tb-btn').first()).toBeVisible());
});

test('desktop: nearly full storage is told at every start, and always on Your data', async ({page}) => {
  await refusingBrowser(page, 90);
  await page.goto('/');
  await fullPopupComesAtEveryStart(page, () => expect(page.locator('.tb-btn').first()).toBeVisible());
  await page.locator('.tb-btn[title="Options"]').or(page.getByRole('button', {name: 'Options'})).first().click();
  await yourDataSaysSo(page);
});

test('mobile: a refused browser is told once, in a popup', async ({page}) => {
  await forceMobileSkin(page);
  await refusingBrowser(page, 1);
  await page.goto('/');
  await expect(page.getByRole('alertdialog')).toHaveCount(1);
  await riskPopupShowsOnce(page, () => openAMobileProject(page));
});

test('mobile: nearly full storage is told at every start, and always on Your data', async ({page}) => {
  await forceMobileSkin(page);
  await refusingBrowser(page, 90);
  await page.goto('/');
  await fullPopupComesAtEveryStart(page, () => expect(page.locator('.mobile-root')).toBeVisible());
  await tapMobileMenuItem(page, 'Options');
  await yourDataSaysSo(page);
});

/** The browser keeps the data and the site holds 10 of its 100 MB, until the test (the browser) says it holds 90. */
async function growingBrowser(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const mb = 1024 * 1024;
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        persisted: () => Promise.resolve(true),
        persist: () => Promise.resolve(true),
        estimate: () => Promise.resolve({usage: (sessionStorage.getItem('site-holds-90') === null ? 10 : 90) * mb, quota: 100 * mb}),
      },
    });
  });
}

const CROSSED = /^Storage is 90% full \(\d+ projects?, [\d.]+ (B|KB|MB) of 5 MB used\)\. Best: turn on Google Drive sync, so your projects live in Drive\. Otherwise export your projects or delete old ones\.$/;

test('desktop: a save that takes storage past 80% shows the nearly-full popup once', async ({page}) => {
  await growingBrowser(page);
  await page.goto('/');
  await openAProject(page);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.evaluate(() => { sessionStorage.setItem('site-holds-90', '1'); });
  await page.locator('.tb-btn[aria-label="Save"]').click();
  const popup = page.getByRole('alertdialog', {name: 'Storage is nearly full'});
  await expect(popup.locator('p')).toHaveText(CROSSED);
  await popup.getByRole('button', {name: 'Close', exact: true}).click();
  await expect(popup).toHaveCount(0);
  await page.locator('.tb-btn[aria-label="Save"]').click();
  await expect(page.locator('.tb-btn[aria-label="Save"]')).toBeVisible();
  await expect(popup).toHaveCount(0);
});

test('mobile: a save that takes storage past 80% shows the nearly-full popup', async ({page}) => {
  await forceMobileSkin(page);
  await growingBrowser(page);
  await page.goto('/');
  await openAMobileProject(page);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.evaluate(() => { sessionStorage.setItem('site-holds-90', '1'); });
  await tapMobileMenuItem(page, /^Save$/);
  await expect(page.getByRole('alertdialog', {name: 'Storage is nearly full'}).locator('p')).toHaveText(CROSSED);
});
