/**
 * BUG_20261018_test-build-hangs-on-loading-screen: when the app's code did not load, the loading screen
 * stayed up forever with nothing said. A start that fails says so, and offers the data this browser
 * holds and a reload. The app's code is scripted not to arrive (the real site answered it with a
 * 404 for John).
 */
import {readFileSync} from 'node:fs';
import {expect, openAProject, test} from '../fixtures.js';

test('the app\'s code not loading shows a message with Download your data and Reload', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title^="Save - "]').click();

  await page.route(/\/assets\/main-[^/]+\.js$/, route => route.abort('aborted'));
  await page.goto('/');
  const failed = page.getByRole('alertdialog', {name: 'OpenISD could not start'});
  await expect(failed).toBeVisible();
  await expect(failed).toContainText('Your projects and settings are still stored in this browser.');

  const download = page.waitForEvent('download');
  await failed.getByRole('button', {name: 'Download your data'}).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^openisd-data-\d{8}T\d{6}Z\.json$/);
  const saved: unknown = JSON.parse(readFileSync(await file.path(), 'utf8'));
  expect(JSON.stringify(saved)).toContain('sample-project');
  await expect(failed).toContainText(`Saved ${file.suggestedFilename()}`);

  await page.unroute(/\/assets\/main-[^/]+\.js$/);
  await failed.getByRole('button', {name: 'Reload'}).click();
  await expect(page.locator('.original-root')).toBeVisible();
  await expect(failed).toBeHidden();
});
