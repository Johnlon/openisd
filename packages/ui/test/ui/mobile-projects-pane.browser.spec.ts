/**
 * Tests for MobileProjectsPane: full-screen Projects pane listing every project (saved or open),
 * replacing the menu's "Open projects" section and the "Open project" sheet.
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

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

test.describe('MobileProjectsPane', () => {
  test('the menu item "Projects" opens the pane with 56px rows, swatch, show checkbox, and closes when tapping a closed row', async ({page}) => {
    await forceMobileSkin(page);
    await seedStoredProjects(page, 2);
    await page.goto('/');
    await openAMobileProject(page);

    // Menu item "Projects" replaces "Open project…"
    await tapMobileMenuItem(page, 'Projects');
    const pane = page.locator('.mob-projects-pane');
    await expect(pane).toBeVisible();
    await expect(pane.locator('.mob-dlg-title')).toHaveText('Projects');

    // Rows for an open project and saved closed projects
    const rows = pane.locator('.mob-project-row');
    await expect(rows).toHaveCount(3);

    // Active row is bold, has swatch and show checkbox
    const activeRow = pane.locator('.mob-project-row.active');
    await expect(activeRow).toHaveCount(1);
    await expect(activeRow.locator('.mob-project-swatch')).toBeVisible();
    await expect(activeRow.locator('.mob-project-show')).toBeChecked();

    // Check minimum row height is at least 56px
    const rowBox = await activeRow.boundingBox();
    expect(rowBox?.height).toBeGreaterThanOrEqual(56);

    // Check hit area of show checkbox is at least 44px
    const showHitBox = await activeRow.locator('.mob-project-show-wrap').boundingBox();
    expect(showHitBox?.width).toBeGreaterThanOrEqual(44);
    expect(showHitBox?.height).toBeGreaterThanOrEqual(44);

    // Closed rows don't show the checkbox
    const closedRow = pane.locator('.mob-project-row:not(.open)').first();
    await expect(closedRow.locator('.mob-project-show')).toHaveCount(0);

    // Tapping a closed row opens it and closes the pane
    await closedRow.locator('.mob-project-info').click();
    await expect(pane).toBeHidden();
  });

  test('row menu ⋯ → Hide on charts unticks the show checkbox', async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);

    await tapMobileMenuItem(page, 'Projects');
    const pane = page.locator('.mob-projects-pane');
    const activeRow = pane.locator('.mob-project-row.active');

    await expect(activeRow.locator('.mob-project-show')).toBeChecked();

    // Open row menu ⋯
    await activeRow.locator('.mob-project-menu-btn').click();
    const actionSheet = page.locator('.mob-action-sheet');
    await expect(actionSheet).toBeVisible();

    // Tap Hide on charts
    await actionSheet.getByRole('button', {name: 'Hide on charts'}).click();
    await expect(actionSheet).toBeHidden();

    // Show checkbox is now unticked
    await expect(activeRow.locator('.mob-project-show')).not.toBeChecked();
  });

  test('row menu ⋯ → Move to Bin moves saved project to the Bin', async ({page}) => {
    await forceMobileSkin(page);
    await seedStoredProjects(page, 1);
    await page.goto('/');
    await openAMobileProject(page);

    await tapMobileMenuItem(page, 'Projects');
    const pane = page.locator('.mob-projects-pane');

    // Find the stored closed row
    const closedRow = pane.locator('.mob-project-row:not(.open)').first();
    await closedRow.locator('.mob-project-menu-btn').click();

    const actionSheet = page.locator('.mob-action-sheet');
    await actionSheet.getByRole('button', {name: 'Move to Bin'}).click();

    // Confirm dialog
    await expect(page.locator('.confirm-dialog-confirm')).toBeVisible();
    await page.locator('.confirm-dialog-confirm').click();

    // Project moved to bin, bin button shows Bin (1)
    await expect(pane.locator('.mob-bin-toggle')).toContainText('Bin (1)');
  });

  test('search field appears when more than 8 rows exist', async ({page}) => {
    await forceMobileSkin(page);
    await seedStoredProjects(page, 9);
    await page.goto('/');
    await openAMobileProject(page);

    await tapMobileMenuItem(page, 'Projects');
    const pane = page.locator('.mob-projects-pane');

    await expect(pane.locator('.mob-project-search')).toBeVisible();
  });

  test('search field is hidden when 8 or fewer rows exist', async ({page}) => {
    await forceMobileSkin(page);
    await seedStoredProjects(page, 4);
    await page.goto('/');
    await openAMobileProject(page);

    await tapMobileMenuItem(page, 'Projects');
    const pane = page.locator('.mob-projects-pane');

    await expect(pane.locator('.mob-project-search')).toBeHidden();
  });

  test('no horizontal overflow at 320 px viewport', async ({page}) => {
    await page.setViewportSize({width: 320, height: 568});
    await forceMobileSkin(page);
    await seedStoredProjects(page, 3);
    await page.goto('/');
    await openAMobileProject(page);

    await tapMobileMenuItem(page, 'Projects');
    const pane = page.locator('.mob-projects-pane');
    await expect(pane).toBeVisible();

    const fits = await pane.evaluate(el => el.scrollWidth <= el.clientWidth);
    expect(fits, 'pane has horizontal scroll').toBe(true);

    const bodyFits = await pane.locator('.mob-dlg-body').evaluate(el => el.scrollWidth <= el.clientWidth);
    expect(bodyFits, 'pane body has horizontal scroll').toBe(true);
  });

  // bugs/BUG_20261016_mobile-project-sort-tabs-cramped.md: five short tabs on one row, none wrapping.
  for (const width of [360, 390]) {
    test(`the sort tabs fit on one row at ${width} px, each at least 44 px tall`, async ({page}) => {
      await page.setViewportSize({width, height: 780});
      await forceMobileSkin(page);
      await page.goto('/');
      await openAMobileProject(page);
      await tapMobileMenuItem(page, 'Projects');
      const tabs = page.locator('.mob-projects-pane .mob-project-sort button');
      await expect(tabs).toHaveText(['Newest', 'Oldest', 'Name', 'Driver', 'Size']);
      const boxes = await tabs.evaluateAll(els => els.map(el => {
        const r = el.getBoundingClientRect();
        const line = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.3;
        const text = document.createRange();
        text.selectNodeContents(el);
        return {top: r.top, height: r.height, overflows: el.scrollWidth > el.clientWidth, textLines: Math.round(text.getBoundingClientRect().height / line)};
      }));
      for (const b of boxes) {
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.overflows).toBe(false);
        expect(b.textLines).toBe(1);
        expect(b.top).toBe(boxes[0]?.top);
      }
    });
  }
});
