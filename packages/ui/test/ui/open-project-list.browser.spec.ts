/**
 * The Open project list sorts saved projects by date or name and filters them with a search box
 * (John, 2026-10-14: "open project needs sorting by name and date and a search box").
 */
import type {Page} from '@playwright/test';
import {duplicateFocusedProject, expect, openAMobileProject, openAProject, test} from '../fixtures.js';
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
  await page.locator('.project-row.selected .row-menu-btn').click();
  await page.locator('.row-menu-item:has-text("Duplicate")').click();
  await expect(page.locator('.project-row')).toHaveCount(2);
  await renameAndSave(page, 'Zebra sub');

  const names = page.locator('.project-row .project-name');
  await expect(names).toHaveText(['Zebra sub', 'Alpha sub']);

  await page.locator('.project-sort-select').selectOption('Oldest first');
  await expect(names).toHaveText(['Alpha sub', 'Zebra sub']);
  await page.locator('.project-sort-select').selectOption('Name A–Z');
  await expect(names).toHaveText(['Alpha sub', 'Zebra sub']);

  // Search box is offered when there are more than 8 projects
  for (let i = 1; i <= 7; i++) {
    await duplicateFocusedProject(page, `Sub ${i}`);
  }
  await expect(page.locator('.project-row')).toHaveCount(9);
  const searchInput = page.locator('.project-search-input');
  await expect(searchInput).toBeVisible();

  await searchInput.fill('zebra');
  await expect(names).toHaveText(['Zebra sub']);
  await searchInput.fill('nothing like it');
  await expect(page.getByText('No project matches')).toBeVisible();
});

import {readSampleProject} from '../fixtures/sampleProject.js';

async function seedStoredProjects(page: Page, count: number): Promise<void> {
  const sampleOwpr = readSampleProject().toString('utf8');
  await page.addInitScript(({cnt, owpr}) => {
    const entries = [];
    for (let i = 1; i <= cnt; i++) {
      const id = `proj-${i}`;
      const name = `Stored Proj ${String(i).padStart(2, '0')}`;
      const parsed: unknown = JSON.parse(owpr);
      if (typeof parsed !== 'object' || parsed === null) throw new Error('the sample project is not a JSON object');
      const projObj = {...parsed, label: name, name};
      entries.push({
        id,
        text: JSON.stringify(projObj),
        modified: new Date(2026, 9, 14, 10, i).toISOString(),
      });
    }
    localStorage.setItem('openisd_projects', JSON.stringify({entries}));
  }, {cnt: count, owpr: sampleOwpr});
}

test('mobile: the pane has sort buttons, search when offered, and no horizontal scroll', async ({page}) => {
  await page.setViewportSize({width: 360, height: 740});
  await forceMobileSkin(page);
  await seedStoredProjects(page, 9);
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, 'Projects');
  const pane = page.locator('.mob-projects-pane');

  await expect(pane.locator('.mob-project-name')).toHaveCount(10);
  await pane.getByRole('button', {name: 'Name', exact: true}).click();
  await expect(pane.getByRole('button', {name: 'Name', exact: true})).toHaveClass(/on/);
  await pane.getByLabel('Search projects').fill('nothing like it');
  await expect(pane.getByText('No project matches')).toBeVisible();
  await expect(pane.locator('.mob-project-name')).toHaveCount(0);
  const fits = await pane.evaluate(e => e.scrollWidth <= e.clientWidth);
  expect(fits, 'pane scrolls sideways').toBe(true);
});
