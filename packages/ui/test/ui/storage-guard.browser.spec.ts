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
