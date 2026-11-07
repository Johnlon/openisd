/**
 * The Projects list has an "Open | All" choice in both skins (John, 2026-11-01): Open lists only
 * the open projects, All lists every project, and All is what shows first.
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {readSampleProject} from '../fixtures/sampleProject.js';

async function seedStoredProjects(page: Page, count: number): Promise<void> {
  const sampleOwpr = readSampleProject().toString('utf8');
  await page.addInitScript(({cnt, owpr}) => {
    const entries = [];
    for (let i = 1; i <= cnt; i++) {
      const parsed: unknown = JSON.parse(owpr);
      if (typeof parsed !== 'object' || parsed === null) throw new Error('the sample project is not a JSON object');
      const name = `Stored Proj ${String(i).padStart(2, '0')}`;
      entries.push({id: `proj-${i}`, text: JSON.stringify({...parsed, label: name, name}), modified: new Date(2026, 9, 14, 10, i).toISOString()});
    }
    localStorage.setItem('openisd_projects', JSON.stringify({entries}));
  }, {cnt: count, owpr: sampleOwpr});
}

test('desktop: Open shows only open projects, All shows every project', async ({page}) => {
  await seedStoredProjects(page, 2);
  await page.goto('/');
  await openAProject(page);
  const rows = page.locator('.project-row');
  const open = page.getByRole('button', {name: 'Open', exact: true});
  const all = page.getByRole('button', {name: 'All', exact: true});
  await expect(rows).toHaveCount(3);
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await open.click();
  await expect(rows).toHaveCount(1);
  await expect(open).toHaveAttribute('aria-pressed', 'true');
  await all.click();
  await expect(rows).toHaveCount(3);
});

test('mobile 374 px: Open shows only open projects, All shows every project, no sideways scroll', async ({page}) => {
  await forceMobileSkin(page);
  await page.setViewportSize({width: 374, height: 705});
  await seedStoredProjects(page, 2);
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, 'Projects');
  const pane = page.locator('.mob-projects-pane');
  const rows = pane.locator('.mob-project-row');
  const open = pane.getByRole('button', {name: 'Open', exact: true});
  const all = pane.getByRole('button', {name: 'All', exact: true});
  await expect(rows).toHaveCount(3);
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  await open.click();
  await expect(rows).toHaveCount(1);
  await expect(open).toHaveAttribute('aria-pressed', 'true');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  await all.click();
  await expect(rows).toHaveCount(3);
});
