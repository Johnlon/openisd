/**
 * T055 / T058 in the real app. A key that was in this browser at the last start and is gone now
 * is said, and waits for a click. A store written by a newer layout is not opened: the user is
 * offered their data back instead of an app running on top of it.
 */
import {expect, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

const DRIVERS_KEY = 'openisd_my_drivers';
const LOG_KEY = 'openisd_storage_log';
const LAYOUT_KEY = 'openisd_storage_layout';
const PROJECTS_KEY = 'openisd_projects';

/** Run `body` in the page, after the app has written its first start to the log. */
async function afterFirstStart(page: Page): Promise<void> {
  await page.goto('/');
  await expect.poll(() => page.evaluate((key: string) => localStorage.getItem(key), LOG_KEY)).not.toBeNull();
}

test('a saved-drivers key that was here at the last start and is gone now is said, and waits for a click', async ({ page }) => {
  await afterFirstStart(page);
  // The previous start saw saved drivers; this store, like John's at localhost:4000, has none.
  await page.evaluate(([logKey, driversKey]: readonly [string, string]) => {
    localStorage.setItem(logKey, JSON.stringify({entries: [{at: '20261011T100000Z', keys: {[driversKey]: 5120}}]}));
    localStorage.removeItem(driversKey);
  }, [LOG_KEY, DRIVERS_KEY] as const);

  await page.reload();

  const notice = page.locator('.confirm-modal');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Saved drivers were in this browser at');
  await expect(notice).toContainText('they are gone now.');
  await expect(notice.getByRole('button', {name: 'Export log'})).toBeVisible();
  await notice.getByRole('button', {name: 'OK'}).click();
  await expect(notice).toHaveCount(0);

  // said once: the next start sees the key absent both times
  await page.reload();
  await expect(page.locator('.confirm-modal')).toHaveCount(0);
});

test('Esc and a click outside the lost-key notice do not answer it; only a button does', async ({ page }) => {
  await afterFirstStart(page);
  await page.evaluate(([logKey, driversKey]: readonly [string, string]) => {
    localStorage.setItem(logKey, JSON.stringify({entries: [{at: '20261011T100000Z', keys: {[driversKey]: 5120}}]}));
  }, [LOG_KEY, DRIVERS_KEY] as const);
  await page.reload();

  const notice = page.locator('.confirm-modal');
  await expect(notice).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(notice).toBeVisible();
  await page.locator('.confirm-overlay').click({position: {x: 5, y: 5}});
  await expect(notice).toBeVisible();
  await notice.getByRole('button', {name: 'OK'}).click();
  await expect(notice).toHaveCount(0);
});

test('Export log hands the user the storage log', async ({ page }) => {
  await afterFirstStart(page);
  await page.evaluate(([logKey, driversKey]: readonly [string, string]) => {
    localStorage.setItem(logKey, JSON.stringify({entries: [{at: '20261011T100000Z', keys: {[driversKey]: 5120}}]}));
  }, [LOG_KEY, DRIVERS_KEY] as const);
  await page.reload();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.confirm-modal').getByRole('button', {name: 'Export log'}).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^openisd-storage-log-\d{8}T\d{6}Z\.json$/);
});

test('a store written by a newer layout is not opened: the user is offered the data back, and nothing is changed', async ({ page }) => {
  await afterFirstStart(page);
  await page.evaluate(([layoutKey, projectsKey]: readonly [string, string]) => {
    localStorage.setItem(layoutKey, '99');
    localStorage.setItem(projectsKey, 'projects from the future');
  }, [LAYOUT_KEY, PROJECTS_KEY] as const);

  await page.reload();

  const gate = page.getByTestId('store-gate');
  await expect(gate).toBeVisible();
  await expect(gate).toContainText('newer OpenISD');
  await expect(gate).toContainText('layout 99');
  await expect(gate).toContainText('Nothing has been changed');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    gate.getByRole('button', {name: 'Export everything'}).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^openisd-everything-\d{8}T\d{6}Z\.json$/);

  const after = await page.evaluate(([layoutKey, projectsKey]: readonly [string, string]) => [
    localStorage.getItem(layoutKey), localStorage.getItem(projectsKey),
  ], [LAYOUT_KEY, PROJECTS_KEY] as const);
  expect(after).toEqual(['99', 'projects from the future']);
});

// --- the Storage history page (T055) ---

async function openStorageHistory(page: Page): Promise<void> {
  await page.getByRole('button', {name: 'Options'}).or(page.locator('.tb-btn[title="Options"]')).first().click();
  await page.locator('.opt-tab', {hasText: 'Storage history'}).click();
  await expect(page.locator('.sh-page')).toBeVisible();
}

async function withSomethingSaved(page: Page): Promise<void> {
  await afterFirstStart(page);
  // Data under the current layout, so the start-up has nothing to migrate and backs nothing up.
  await page.evaluate(([key, layoutKey]: readonly [string, string]) => {
    localStorage.setItem(key, '{"entries":[]}');
    localStorage.setItem(layoutKey, '2');
  }, [DRIVERS_KEY, LAYOUT_KEY] as const);
  await page.reload();
}

test('Storage history: Back up now adds a row with build, layout, projects and size; Export, Delete and Restore act on it', async ({ page }) => {
  await withSomethingSaved(page);
  await openStorageHistory(page);
  // the test harness seeds the view before the app starts, so the app has already backed that up once
  const before = await page.locator('.sh-row').count();

  await page.locator('.sh-backup-now').click();
  await expect(page.locator('.sh-row')).toHaveCount(before + 1);
  // the one just made is layout 2; the harness-seeded start-up backup is layout 1
  const row = page.locator('.sh-row').filter({ has: page.locator('.sh-layout', { hasText: /^2$/ }) });
  await expect(row.locator('.sh-layout')).toHaveText('2');
  await expect(row.locator('.sh-projects')).toHaveText('0 projects');
  await expect(row.locator('.sh-size')).toContainText(/\d+(\.\d)? (B|KB)/);

  const [download] = await Promise.all([page.waitForEvent('download'), row.locator('.sh-export').click()]);
  expect(download.suggestedFilename()).toMatch(/^openisd-backup-\d{8}T\d{6}Z\.json$/);

  await row.locator('.sh-delete').click();
  await page.locator('.confirm-dialog-confirm').click();
  await expect(page.locator('.sh-row')).toHaveCount(before);
  const backups = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('openisd_backup_')));
  expect(backups).toHaveLength(before);
});

test('Storage history: Restore asks first, backs the live store up, then reloads', async ({ page }) => {
  await withSomethingSaved(page);
  await openStorageHistory(page);
  const before = await page.locator('.sh-row').count();
  await page.locator('.sh-backup-now').click();
  await expect(page.locator('.sh-row')).toHaveCount(before + 1);
  await page.evaluate((key: string) => { localStorage.setItem(key, '{"entries":["changed"]}'); }, DRIVERS_KEY);

  let reloaded = false;
  page.on('load', () => { reloaded = true; });
  page.on('dialog', async dialog => { await dialog.accept(); });
  await page.locator('.sh-row').filter({ has: page.locator('.sh-layout', { hasText: /^2$/ }) }).locator('.sh-restore').click();
  await expect(page.locator('.confirm-modal')).toContainText('A backup of what is here now is made first');
  await page.locator('.confirm-dialog-confirm').click();
  await expect.poll(() => reloaded).toBe(true);

  expect(await page.evaluate((key: string) => localStorage.getItem(key), DRIVERS_KEY)).toBe('{"entries":[]}');
  const backups = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('openisd_backup_')));
  expect(backups.length).toBeGreaterThanOrEqual(2);
});
