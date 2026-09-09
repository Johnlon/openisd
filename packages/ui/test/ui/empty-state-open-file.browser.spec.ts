/**
 * The no-project empty state can open a saved project from disk.
 *
 * A cold start with no autosave and no share link renders App.vue's empty state. Before this,
 * its only action was the New Project wizard, and every file input in the app lived inside
 * `v-if="project"` — so a user holding a `.owpr` had no way to open it, and the ordinary
 * "carry on with yesterday's work" path did not exist.
 * bugs/BUG_20260909_no_project_can_be_opened_from_a_file_when_none_is_open.md
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, expect } from '../fixtures.js';

const OWPR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'sample-project.owpr');

test('the empty state opens a saved .owpr and the shell appears', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');

  // A cold start shows the empty state, and it offers a way to open a file.
  await expect(page.locator('.no-project-open')).toBeVisible();

  await page.locator('.no-project-open input[type=file]').setInputFiles({
    name: 'sample-project.owpr',
    mimeType: 'application/json',
    buffer: readFileSync(OWPR),
  });

  // The project is open: the shell renders, and the opened file is the project in the list
  // (the row is named for the file it came from, not the `label` inside it).
  await expect(page.locator('.original-root')).toBeVisible();
  await expect(page.locator('.projects-list')).toContainText('sample-project');
});
