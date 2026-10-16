import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

/** bugs/BUG_20261016_live-crash-no-project-is-focused.md: with no project open, nothing reads the
 *  focused project, so no flow ends on the crash screen with "no project is focused". */

async function noCrash(page: Page, pageErrors: readonly string[]): Promise<void> {
  await expect(page.getByTestId('crash-screen')).toHaveCount(0);
  expect(pageErrors.filter(e => e.includes('no project is focused'))).toEqual([]);
}

test('desktop: closing the only open project leaves the empty shell, no crash', async ({page, browserLog}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.close-btn', {hasText: 'Close'}).first().click();
  await expect(page.locator('.graph-empty-h')).toBeVisible();
  await noCrash(page, browserLog.pageErrors);
});

test('mobile: closing the only open project leaves the empty screen, no crash', async ({page, browserLog}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-item', {hasText: 'Projects'}).click();
  const pane = page.locator('.mob-projects-pane');
  await pane.locator('.mob-project-menu-btn').first().click();
  await page.locator('.mob-action-sheet .mob-action-close').click();
  await pane.locator('.mob-dlg-close').click();
  await expect(page.locator('.mob-empty')).toBeVisible();
  await noCrash(page, browserLog.pageErrors);
});

test('mobile: a cold start with no project shows the empty screen, no crash', async ({page, browserLog}) => {
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/');
  await expect(page.locator('.mob-empty')).toBeVisible();
  await noCrash(page, browserLog.pageErrors);
});

for (const tab of ['Driver', 'Box', 'Vented', 'Filters', 'Signal', 'Advanced', 'Project']) {
  test(`desktop: closing the only project with the ${tab} tab open leaves the empty shell, no crash`, async ({page, browserLog}) => {
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-nav li', {hasText: tab}).first().click();
    await page.locator('.close-btn', {hasText: 'Close'}).first().click();
    await expect(page.locator('.graph-empty-h')).toBeVisible();
    await noCrash(page, browserLog.pageErrors);
  });
}

test('desktop: closing the only project after the driver editor leaves the empty shell, no crash', async ({page, browserLog}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', {hasText: 'Driver'}).first().click();
  await page.locator('.edit-btn').filter({hasText: /Edit/}).first().click();
  await page.keyboard.press('Escape');
  await page.locator('.close-btn', {hasText: 'Close'}).first().click();
  await expect(page.locator('.graph-empty-h')).toBeVisible();
  await noCrash(page, browserLog.pageErrors);
});
