/**
 * Options → Backups → Restore one project, on both skins: a project saved before a backup comes
 * back from it as "<name> (restored <day>)", beside what is saved now.
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

const RESTORED = /^sample-project \(restored \d{1,2} [A-Z][a-z]{2} \d{4}\)$/;

async function restoreOneFromNewBackup(page: Page): Promise<void> {
  await page.locator('.opt-tab, .opt-phone-tabs button', {hasText: 'Your data'}).click();
  await expect(page.locator('.sh-page')).toContainText('The newest 3 are kept, plus the last one made before an app update');
  await page.locator('.sh-backup-now').click();
  const row = page.locator('.sh-row').filter({has: page.locator('.sh-reason', {hasText: 'Back up now'})});
  await expect(row.locator('.sh-taken')).toHaveText(/^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}$/);
  await row.locator('.sh-restore-one').click();
  await expect(row.locator('.sh-picker-name')).toHaveText(['sample-project']);
  await row.locator('.sh-picker-restore').click();
  await expect(row.locator('.sh-picker')).toHaveCount(0);
}

test('desktop: Restore one project adds the project from a backup under a restored name', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title^="Save - "]').click();
  await page.getByRole('button', {name: 'Options'}).or(page.locator('.tb-btn[title="Options"]')).first().click();
  await expect(page.locator('.opt-tab')).toHaveText(['General', 'Plot Window', 'Your data']);
  await page.locator('.opt-tab', {hasText: 'Your data'}).click();
  await expect(page.locator('.su-used')).toHaveText(/^Using \d+(\.\d)? (B|KB|MB) of about 5 MB in this browser\.$/);
  await restoreOneFromNewBackup(page);
  await page.keyboard.press('Escape');

  // T217: the Projects panel lists every saved project; the restored one joins it.
  const names = page.locator('.projects-list .project-name');
  await expect(names).toHaveCount(2);
  await expect(names.filter({hasText: RESTORED})).toHaveCount(1);
});

test('mobile: Restore one project adds the project from a backup under a restored name', async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, /^Save$/);
  await tapMobileMenuItem(page, 'Options');
  await restoreOneFromNewBackup(page);
  const shell = (await page.locator('.mobile-root').boundingBox())!;
  const picker = (await page.locator('.sh-row').first().boundingBox())!;
  expect(picker.x + picker.width).toBeLessThanOrEqual(shell.x + shell.width + 1);
  await page.locator('.mob-dlg[aria-label="Options"]').getByRole('button', {name: /^(Close|OK)$/}).last().click();

  await tapMobileMenuItem(page, 'Projects');
  const names = page.locator('.mob-projects-pane .mob-project-name');
  await expect(names).toHaveCount(2);
  await expect(names.filter({hasText: RESTORED})).toHaveCount(1);
});
