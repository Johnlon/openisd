/**
 * The Open project list sorts saved projects by date or name and filters them with a search box
 * (John, 2026-10-14: "open project needs sorting by name and date and a search box").
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

async function renameAndSave(page: Page, name: string): Promise<void> {
  await page.locator('.project-nav li', {hasText: 'Project'}).click();
  const field = page.locator('.tab-section.active .field', {hasText: 'Name'}).locator('input');
  await field.fill(name);
  await field.blur();
  await page.locator('.tb-btn[title^="Save - "]').click();
}

test('desktop: sort by date and name, and search', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await renameAndSave(page, 'Alpha sub');
  await page.locator('.proj-actions button:has-text("Copy")').click();
  await expect(page.locator('.project-row')).toHaveCount(2);
  await renameAndSave(page, 'Zebra sub');
  await page.getByTitle('Open project', {exact: true}).click();
  const dialog = page.locator('.open-project-dialog');
  const names = dialog.locator('.stored-project-name');

  await expect(names).toHaveText(['Zebra sub', 'Alpha sub']);
  await dialog.getByRole('button', {name: 'Oldest first'}).click();
  await expect(names).toHaveText(['Alpha sub', 'Zebra sub']);
  await dialog.getByRole('button', {name: 'Name A–Z'}).click();
  await expect(names).toHaveText(['Alpha sub', 'Zebra sub']);

  await dialog.getByLabel('Search projects').fill('zebra');
  await expect(names).toHaveText(['Zebra sub']);
  await dialog.getByLabel('Search projects').fill('nothing like it');
  await expect(dialog.getByText('No project matches')).toBeVisible();
});

test('mobile: the sheet has a search box and sort buttons', async ({page}) => {
  await page.setViewportSize({width: 360, height: 740});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, /^Save$/);
  await tapMobileMenuItem(page, 'Open project…');
  const sheet = page.locator('.mob-open-project-sheet');

  await expect(sheet.locator('.mob-stored-project-name')).toHaveCount(1);
  await sheet.getByRole('button', {name: 'Name A–Z'}).click();
  await expect(sheet.getByRole('button', {name: 'Name A–Z'})).toHaveClass(/on/);
  await sheet.getByLabel('Search projects').fill('nothing like it');
  await expect(sheet.getByText('No project matches.')).toBeVisible();
  await expect(sheet.locator('.mob-stored-project-name')).toHaveCount(0);
  const fits = await sheet.evaluate(e => e.scrollWidth <= e.clientWidth);
  expect(fits, 'sheet scrolls sideways').toBe(true);
});
