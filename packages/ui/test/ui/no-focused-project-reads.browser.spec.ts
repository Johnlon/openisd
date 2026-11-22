import {expect, test} from '../fixtures.js';

/** bugs/BUG_20261031_crash-no-project-is-focused.md: with no project ever opened, the shell
 *  evaluates no reader of the focused project. The app logs every uncaught error with
 *  `console.error`, and the fixture fails a test on any, so a reader that throws shows here. */
test('desktop: a cold start, then every nav tab and toolbar menu, reads no focused project', async ({page, browserLog}) => {
  await page.goto('/');
  await expect(page.locator('.graph-empty-h')).toBeVisible();
  const tabs = page.locator('.project-nav li');
  const n = await tabs.count();
  for (let i = 0; i < n; i++) await tabs.nth(i).click();
  const menus = page.locator('.toolbar .menu-btn, .toolbar [aria-haspopup]');
  const m = await menus.count();
  for (let i = 0; i < m; i++) { await menus.nth(i).click(); await page.keyboard.press('Escape'); }
  expect(browserLog.consoleErrors.filter(e => e.includes('uncaught') || e.includes('no project is focused'))).toEqual([]);
});
