/**
 * The project Bin (John, 2026-10-14: "deletes into a bin, and only empty bin really deletes"). Both
 * skins' Open project lists move a saved project to the Bin, which lists it with its date, device
 * and size, and restores it or deletes it forever.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

const MOVE_TEXT = 'Move "sample-project" to the Bin? You can restore it from the Bin on any device.';
const DETAIL = /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2} · .+ · .+$/;

test('desktop: Move to Bin, Restore, then Delete forever', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.tb-btn[title^="Save - "]').click();

  await page.locator('.project-row.selected .row-menu-btn').click();
  await page.locator('.row-menu-item:has-text("Move to Bin")').click();
  await expect(page.getByText(MOVE_TEXT)).toBeVisible();
  await page.locator('.confirm-dialog-confirm').click();
  await expect(page.locator('.project-row')).toHaveCount(0);
  await expect(page.locator('.projects-empty')).toBeVisible();

  const binToggle = page.locator('.projects-panel-footer .bin-toggle');
  await expect(binToggle).toContainText('Bin (1)');
  await binToggle.click();
  await expect(page.locator('.bin-name')).toHaveText(['sample-project']);
  await expect(page.locator('.bin-detail')).toHaveText(DETAIL);
  await page.locator('.bin-restore').click();
  await expect(page.locator('.bin-row')).toHaveCount(0);
  await page.getByRole('button', {name: 'Back to projects'}).click();
  await expect(page.locator('.project-name')).toHaveText(['sample-project']);

  await page.locator('.project-row .row-menu-btn').click();
  await page.locator('.row-menu-item:has-text("Move to Bin")').click();
  await page.locator('.confirm-dialog-confirm').click();
  await binToggle.click();
  await page.locator('.bin-delete-forever').click();
  await expect(page.getByText('Delete "sample-project" forever?', {exact: false})).toBeVisible();
  await page.locator('.confirm-dialog-confirm').click();
  await expect(page.getByText('The Bin is empty')).toBeVisible();
  await page.getByRole('button', {name: 'Back to projects'}).click();
  await expect(page.getByText('No projects yet.')).toBeVisible();
});

test('mobile: Bin a project, see it in the Bin, then Empty Bin', async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, /^Save$/);
  await tapMobileMenuItem(page, 'Projects');
  const pane = page.locator('.mob-projects-pane');

  await pane.locator('.mob-project-menu-btn').first().click();
  await page.locator('.mob-action-sheet').getByRole('button', {name: 'Move to Bin'}).click();
  await expect(page.getByText(MOVE_TEXT)).toBeVisible();
  await page.locator('.confirm-dialog-confirm').click();
  await expect(pane.locator('.mob-project-row')).toHaveCount(0);

  await pane.getByRole('button', {name: 'Bin (1)'}).click();
  await expect(pane.locator('.mob-bin-row .mob-stored-project-name')).toHaveText(['sample-project']);
  await expect(pane.locator('.mob-bin-row .mob-stored-project-summary')).toHaveText(DETAIL);
  await pane.locator('.mob-bin-empty').click();
  await expect(page.getByText('Delete 1 project in the Bin', {exact: false})).toBeVisible();
  await page.locator('.confirm-dialog-confirm').click();
  await expect(pane.getByText('The Bin is empty.')).toBeVisible();

  await pane.locator('.mob-dlg-close').click();
  await expect(page.getByText('No project open')).toBeVisible();
});

test('desktop: the Bin toggle is in the footer with an icon, and the projects list has no horizontal scroll', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', { hasText: 'Project' }).click();
  const name = page.locator('.tab-section.active .field', { hasText: 'Name' }).locator('input');
  await name.fill('A very long project name that goes on and on and on and on and on and on and on and on and on');
  await name.blur();
  await page.locator('.tb-btn[title^="Save - "]').click();

  const bin = page.locator('.projects-panel-footer .bin-toggle');
  await expect(bin).toContainText('Bin (0)');
  await expect(bin.locator('svg')).toBeVisible();

  for (const sel of ['.quad-projects-wrap', '.projects-list']) {
    const fits = await page.locator(sel).evaluate(e => e.scrollWidth <= e.clientWidth);
    expect(fits, `${sel} scrolls sideways`).toBe(true);
  }
});

test('mobile at 360px: the Bin button is an icon and the Open project sheet has no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({width: 360, height: 740});
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await tapMobileMenuItem(page, /^Save$/);
  await tapMobileMenuItem(page, 'Projects');
  const pane = page.locator('.mob-projects-pane');

  await expect(pane.locator('.mob-bin-toggle svg')).toBeVisible();
  const fits = await pane.evaluate(e => e.scrollWidth <= e.clientWidth);
  expect(fits, 'sheet scrolls sideways').toBe(true);
});
