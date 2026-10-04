/**
 * Hamburger menu layout (John, 2026-10-04): the three save items sit together, Revert is its own
 * section after them, and a thin separator divides each section.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-hamburger').click();
});

test('Save, Save all and Save As sit together; Revert follows in its own section', async ({ page }) => {
  const rows = await page.locator('.mob-menu > .mob-menu-item, .mob-menu > .mob-menu-sep').evaluateAll(
    nodes => nodes.map(n => n.classList.contains('mob-menu-sep') ? '---' : (n.textContent ?? '').trim()));
  const from = rows.indexOf('Open a file');
  expect(rows.slice(from, from + 8)).toEqual([
    'Open a file', '---', 'Save', 'Save all', 'Save As / Export', '---', 'Revert unsaved changes', '---',
  ]);
});
