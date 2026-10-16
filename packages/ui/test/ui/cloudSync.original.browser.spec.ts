import type {Locator} from '@playwright/test';
import {expect, openAProject, test} from '../fixtures.js';
import {enableCloudSync, stubGoogleApis} from './fixtures/cloudSyncStubs.js';

async function boxOf(locator: Locator): Promise<{x: number; width: number}> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('element has no box');
  return box;
}


test.describe('Original shell cloud sync — default unconfigured build (ADDENDUM)', () => {
  test('when OAuthConfig.clientId is null, NOTHING cloud-related renders', async ({ page }) => {
    await page.goto('/');
    await openAProject(page);

    // No sync badge in toolbar
    await expect(page.locator('.cloud-sync-badge')).toHaveCount(0);
    // Toolbar has exactly 9 buttons (as today)
    await expect(page.locator('.toolbar .tb-btn')).toHaveCount(9);

    // Info menu has no "Cloud sync…" entry
    await page.locator('.tb-btn.has-menu[title="Info"]').click();
    await expect(page.locator('.dropdown-menu .menu-item', { hasText: 'Cloud sync' })).toHaveCount(0);

    // No reconnect strip, conflict notice, hint, or dialog
    await expect(page.locator('.cloud-reconnect-strip')).toHaveCount(0);
    await expect(page.locator('.cloud-conflict-notice')).toHaveCount(0);
    await expect(page.locator('.cloud-hint')).toHaveCount(0);
    await expect(page.locator('.cloud-modal')).toHaveCount(0);
  });
});

test.describe('Original shell cloud sync — configured build (Plan P1-13a)', () => {
  test('at 1024px the brand text and every toolbar button are inside the viewport and document.documentElement.scrollWidth <= innerWidth', async ({ page }) => {
    const width = 1024;
    await enableCloudSync(page);
    await stubGoogleApis(page);
    await page.setViewportSize({ width, height: 768 });
    await page.goto('/');
    await openAProject(page);

    // Verify no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);

    // Verify brand text is inside viewport
    const brand = page.locator('.app-brand');
    await expect(brand).toBeVisible();
    const brandBox = await boxOf(brand);
    expect(brandBox.x).toBeGreaterThanOrEqual(0);
    expect(brandBox.x + brandBox.width).toBeLessThanOrEqual(width);

    // Verify every toolbar button (.tb-btn) is inside viewport
    const buttons = page.locator('.toolbar .tb-btn');
    await expect(buttons).toHaveCount(10); // 9 standard + 1 sync badge
    for (let i = 0; i < 10; i++) {
      const btnBox = await boxOf(buttons.nth(i));
      expect(btnBox.x).toBeGreaterThanOrEqual(0);
      expect(btnBox.x + btnBox.width).toBeLessThanOrEqual(width);
    }

  });

  test('at 1366px the brand text and every toolbar button are inside the viewport and document.documentElement.scrollWidth <= innerWidth', async ({ page }) => {
    const width = 1366;
    await enableCloudSync(page);
    await stubGoogleApis(page);
    await page.setViewportSize({ width, height: 768 });
    await page.goto('/');
    await openAProject(page);

    // Verify no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const innerWidth = await page.evaluate(() => window.innerWidth);
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);

    // Verify brand text is inside viewport
    const brand = page.locator('.app-brand');
    await expect(brand).toBeVisible();
    const brandBox = await boxOf(brand);
    expect(brandBox.x).toBeGreaterThanOrEqual(0);
    expect(brandBox.x + brandBox.width).toBeLessThanOrEqual(width);

    // Verify every toolbar button (.tb-btn) is inside viewport
    const buttons = page.locator('.toolbar .tb-btn');
    await expect(buttons).toHaveCount(10); // 9 standard + 1 sync badge
    for (let i = 0; i < 10; i++) {
      const btnBox = await boxOf(buttons.nth(i));
      expect(btnBox.x).toBeGreaterThanOrEqual(0);
      expect(btnBox.x + btnBox.width).toBeLessThanOrEqual(width);
    }

  });

  test('status off renders cloudOff glyph and tooltip', async ({ page }) => {
    await enableCloudSync(page);
    await stubGoogleApis(page);
    await page.goto('/');
    await openAProject(page);

    const badge = page.locator('.cloud-sync-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute('title', 'Sync your work across devices through your Google Drive. Tap to turn on.');
    await expect(badge.locator('.icon-cloudOff')).toBeVisible();
  });

  test('status reconnect renders reconnect strip with Reconnect and Not now', async ({ page }) => {
    await enableCloudSync(page);
    await stubGoogleApis(page);

    await page.addInitScript(() => {
      localStorage.setItem('openisd_cloud_auth', JSON.stringify({
        kind: 'reconnect',
        account: 'john@gmail.com',
      }));
    });

    await page.goto('/');
    await openAProject(page);

    const badge = page.locator('.cloud-sync-badge');
    await expect(badge).toBeVisible();
    await expect(badge.locator('.icon-cloudAlert')).toBeVisible();

    // Reconnect strip is visible directly under the toolbar
    const strip = page.locator('.cloud-reconnect-strip');
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('Google needs you to connect again');

    // Reconnect, and Not now (hides the strip for this session)
    const buttons = strip.locator('button');
    await expect(buttons).toHaveCount(2);
    await expect(buttons.first()).toHaveText('Reconnect');
    await expect(buttons.nth(1)).toHaveText('Not now');
    await buttons.nth(1).click();
    await expect(strip).toHaveCount(0);
  });

  test('the hint\'s Turn on opens the Cloud sync dialog', async ({ page }) => {
    await enableCloudSync(page);
    await stubGoogleApis(page);
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('openisd_cloud_ui', JSON.stringify({launches: 1, hintDismissed: false, conflictsSeen: 0}));
    });
    await page.reload();
    await page.locator('.cloud-hint button', { hasText: 'Turn on' }).click();
    await expect(page.getByRole('dialog', { name: 'Cloud sync' })).toBeVisible();
    await expect(page.locator('.cloud-hint')).toHaveCount(0);
  });

  test('one-time hint shows on launch 2 only, and never again after button click', async ({ page }) => {
    await enableCloudSync(page);
    await stubGoogleApis(page);

    // Launch 1: hint does not show
    await page.goto('/');
    await expect(page.locator('.cloud-hint')).toHaveCount(0);

    // Prepare state so next launch is launch 2
    await page.evaluate(() => {
      localStorage.setItem('openisd_cloud_ui', JSON.stringify({
        launches: 1,
        hintDismissed: false,
        conflictsSeen: 0,
      }));
    });

    // Launch 2: recordLaunch increments to 2 -> hint shows
    await page.reload();
    const hint = page.locator('.cloud-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('Sync your projects across devices?');

    // Clicking "No thanks" dismisses the hint
    await hint.locator('button', { hasText: 'No thanks' }).click();
    await expect(hint).toHaveCount(0);

    // Hint never shows again
    await page.reload();
    await expect(page.locator('.cloud-hint')).toHaveCount(0);
  });
});
