/**
 * The Backups page on the phone skin: the same Options page, full screen, with its tab
 * and rows inside the phone width.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

test('Your data opens inside the full-screen Options dialog and fits a 360 px phone', async ({ page }) => {
  await page.setViewportSize({width: 360, height: 740});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.evaluate(() => { localStorage.setItem('openisd_my_drivers', '{"entries":[]}'); });
  await tapMobileMenuItem(page, 'Options');

  await expect(page.locator('.opt-tab')).toHaveText(['General', 'Plot Window', 'Your data']);
  await page.locator('.opt-tab', {hasText: 'Your data'}).click();
  await expect(page.locator('.opt-modal legend')).toHaveText(['Storage', 'Backups', 'Export / Import']);
  const tabsFit = await page.locator('.opt-tabs').evaluate(el => el.scrollWidth <= el.clientWidth);
  expect(tabsFit).toBe(true);
  const before = await page.locator('.sh-row').count();
  await page.locator('.sh-backup-now').click();
  await expect(page.locator('.sh-row')).toHaveCount(before + 1);

  const shell = (await page.locator('.mobile-root').boundingBox())!;
  const modal = (await page.locator('.opt-modal').boundingBox())!;
  expect(modal.width).toBeGreaterThanOrEqual(shell.width - 1);
  expect(modal.height).toBeGreaterThanOrEqual(shell.height - 1);
  const row = (await page.locator('.sh-row').first().boundingBox())!;
  expect(row.x).toBeGreaterThanOrEqual(0);
  expect(row.x + row.width).toBeLessThanOrEqual(shell.x + shell.width + 1);
  const scrolls = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(scrolls).toBe(false);
});
