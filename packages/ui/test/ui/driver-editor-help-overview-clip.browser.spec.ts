/**
 * T744, John (16 Nov 2026): "Clipping is a bug: fix it, don't ask". The driver editor's help overview ("Blue dot" is its next-to-last
 * paragraph) was cut off at the bottom of the dialog. The dialog keeps its size ("dlg changing size for a workflow is anti pattern"),
 * so the help sheet must show the whole text, and where the window is too small to, it scrolls to the last paragraph.
 */
import {expect, openAProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

async function openOverview(page: Page): Promise<void> {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', {hasText: 'Driver'}).click();
  await page.locator('.driver-id-row').getByRole('button', {name: 'Edit'}).click();
  await expect(page.locator('.de-modal')).toBeVisible();
  await page.getByRole('button', {name: 'General', exact: true}).click();
  await page.getByRole('button', {name: 'Help: Driver editor', exact: true}).click();
  await expect(page.locator('.mob-help-sheet')).toBeVisible();
}

async function lastRowInsideSheet(page: Page): Promise<boolean> {
  return page.locator('.mob-help-sheet').evaluate(sheet => {
    const rows = sheet.querySelectorAll('.mob-help-row');
    const box = sheet.getBoundingClientRect();
    const last = rows[rows.length - 1]!.getBoundingClientRect();
    return last.bottom <= box.bottom + 0.5 && last.top >= box.top;
  });
}

test('the help overview shows its whole text on the desktop editor, with nothing hidden below the sheet', async ({page}) => {
  await page.setViewportSize({width: 1880, height: 1000});
  await openOverview(page);
  const [scrollHeight, clientHeight] = await page.locator('.mob-help-sheet').evaluate(el => [el.scrollHeight, el.clientHeight]);
  expect(scrollHeight).toBeLessThanOrEqual(clientHeight);
  expect(await lastRowInsideSheet(page)).toBe(true);
});

test('in a short window the help overview scrolls and its last paragraph is reachable inside the dialog', async ({page}) => {
  await page.setViewportSize({width: 1280, height: 560});
  await openOverview(page);
  const sheet = page.locator('.mob-help-sheet');
  await sheet.evaluate(el => { el.scrollTop = el.scrollHeight; });
  expect(await lastRowInsideSheet(page)).toBe(true);
  const [sheetBottom, modalBottom] = await page.evaluate(() => [
    document.querySelector('.mob-help-sheet')!.getBoundingClientRect().bottom,
    document.querySelector('.de-modal')!.getBoundingClientRect().bottom]);
  expect(sheetBottom).toBeLessThanOrEqual(modalBottom);
});
