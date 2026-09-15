/**
 * The no-project shell can open a saved project from disk.
 *
 * The shell remains mounted without a project, including its hidden file input.
 * bugs/BUG_20260909_no_project_can_be_opened_from_a_file_when_none_is_open.md
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, expect } from '../fixtures.js';

const OWPR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'sample-project.owpr');

test('the no-project shell opens a saved .owpr', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.original-root')).toBeVisible();

  await page.locator('.original-root input[type=file]').setInputFiles({
    name: 'sample-project.owpr',
    mimeType: 'application/json',
    buffer: readFileSync(OWPR),
  });

  // The project is open: the shell renders, and the opened file is the project in the list
  // (the row is named for the file it came from, not the `label` inside it).
  await expect(page.locator('.original-root')).toBeVisible();
  await expect(page.locator('.projects-list')).toContainText('sample-project');
});

test('Open shows saved browser projects with Import from disk first', async ({ page }) => {
  await page.goto('/');

  await page.getByTitle('Open project').click();
  const dialog = page.locator('.open-project-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('button').first()).toHaveText('Import from disk');
  await expect(dialog.locator('.open-project-list')).toContainText('No saved project yet');
});

test('no-project chart empty state offers icon links for New, Open, and Import', async ({ page }) => {
  await page.goto('/');

  const emptyState = page.locator('.graph-empty');
  await expect(emptyState).toContainText('Open or Create a project for charts');
  await expect(emptyState.getByRole('button', { name: 'New project' })).toBeVisible();
  await expect(emptyState.getByRole('button', { name: 'Open project' })).toBeVisible();
  await expect(emptyState.getByRole('button', { name: 'Import project' })).toBeVisible();

  await emptyState.getByRole('button', { name: 'Open project' }).click();
  await expect(page.locator('.open-project-dialog')).toBeVisible();
});
