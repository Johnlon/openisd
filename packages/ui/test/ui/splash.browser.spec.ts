/**
 * The splash: what a first visitor sees, and what a returning one does not.
 *
 * The shared fixture seeds `openisd_view` so the rest of the suite starts past the splash.
 * That seed is exactly what this file must not have, so every test here drops the key again
 * in its own init script — registered after the fixture's, so it runs after it.
 */
import {expect, test} from '../fixtures.js';

/** Forget the fixture's splash seed: this page is a first visit. Once, on the first navigation
 *  only — an init script runs on every navigation, and dropping the key again on a reload
 *  would erase the dismissal these tests then check for. */
async function firstVisit(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('splash-spec-visited')) return;
    sessionStorage.setItem('splash-spec-visited', '1');
    localStorage.removeItem('openisd_view');
  });
}

test('a first visitor gets the splash, and it credits WinISD and links to the project', async ({page}) => {
  await firstVisit(page);
  await page.goto('/');

  const splash = page.locator('.sp');
  await expect(splash).toBeVisible();
  await expect(splash.locator('.sp-logo')).toBeVisible();
  await expect(splash).toContainText('WinISD, by Linearteam');
  await expect(splash.locator('a[href="https://github.com/Johnlon/openisd"]')).toBeVisible();
  await expect(splash.locator('a[href$="ARCHITECTURE.md"]')).toBeVisible();
  await expect(splash.locator('a[href$="OPENISD_WINISD_GAPS_AND_BUGS.md"]')).toBeVisible();
});

test('dismissing it keeps it shut across a reload', async ({page}) => {
  await firstVisit(page);
  await page.goto('/');
  await page.locator('.sp-go').click();
  await expect(page.locator('.sp')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.sp')).toHaveCount(0);
});

test('the close button at the top dismisses it too — the text is long enough that the bottom one is a scroll away', async ({page}) => {
  await firstVisit(page);
  await page.goto('/');
  await page.locator('.sp-x').click();
  await expect(page.locator('.sp')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.sp')).toHaveCount(0);
});

test('Info -> About OpenISD reopens it', async ({page}) => {
  await firstVisit(page);
  await page.goto('/');
  await page.locator('.sp-go').click();

  await page.locator('.tb-btn[title="Info"]').click();
  await page.getByText('About OpenISD').click();
  await expect(page.locator('.sp')).toBeVisible();
});
