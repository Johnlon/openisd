/**
 * The public about page (/about/) and the install page (/install/): the splash's words under a
 * header that leads to the app, and a page saying how to add the app to the desktop.
 */
import {expect, test} from '../fixtures.js';

test('the about page carries the splash text and leads to the app and the install page', async ({page}) => {
  await page.goto('/about/');
  await expect(page.locator('h2#sp-title')).toContainText('open loudspeaker enclosure simulator');
  await expect(page.locator('main')).toContainText('WinISD, by Linearteam');
  await expect(page.locator('main')).toContainText('both work offline');
  await expect(page.locator('a.about-open').first()).toHaveAttribute('href', 'https://openisd.app/');
  await expect(page.locator('a[href="https://openisd.app/install/"]').first()).toBeVisible();
  await expect(page.locator('.sp-stat')).toContainText(/\d+ drivers and \d+ passive radiators/);
});

test('the privacy section stands alone at /about/#privacy', async ({page}) => {
  await page.goto('/about/#privacy');
  const privacy = page.locator('section#privacy');
  await expect(privacy).toBeInViewport();
  await expect(privacy.locator('h3')).toHaveText('Privacy');
  await expect(privacy).toContainText('hidden folder in your own Google Drive');
  await expect(privacy).toContainText('anonymous usage counts');
  await expect(privacy.locator('a[href$="/issues"]')).toBeVisible();
});

test('the terms section stands alone at /about/#terms', async ({page}) => {
  await page.goto('/about/#terms');
  const terms = page.locator('section#terms');
  await expect(terms).toBeInViewport();
  await expect(terms.locator('h3')).toHaveText('Terms');
  await expect(terms).toContainText("with no warranty");
  await expect(terms).toContainText("maker's own datasheet");
  await expect(terms.locator('a', {hasText: 'MIT licence'})).toHaveAttribute('href', /\/blob\/main\/LICENSE$/);
});

test('the install page names each browser and links back to the app', async ({page}) => {
  await page.goto('/install/');
  await expect(page.locator('h1')).toHaveText('Add OpenISD as an app');
  await expect(page.locator('main')).toContainText('Install and create shortcut');
  await expect(page.locator('main')).toContainText('Add to Home Screen');
  await expect(page.locator('a[href="/"]').first()).toBeVisible();
  await expect(page.locator('img.shot')).toBeVisible();
  expect(await page.locator('img.shot').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
});
