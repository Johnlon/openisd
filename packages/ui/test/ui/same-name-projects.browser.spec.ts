/** BUG_20261017_same-name-projects-show-as-one-row: two projects called alike are two rows. */
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, openAMobileProject, openAProject, SAMPLE_PROJECT_OWPR, test} from '../fixtures.js';
import {forceMobileSkin, openMobileMenu} from '../fixtures/mobileSkin.js';

/** A project file that names the same project as the sample but is not the same file text, so the app opens it as a second project. */
function otherFileOfTheSameName(): string {
  const dir = mkdtempSync(join(tmpdir(), 'same-name-'));
  const path = join(dir, 'other.owpr');
  writeFileSync(path, readFileSync(SAMPLE_PROJECT_OWPR, 'utf8') + '\n\n');
  return path;
}

test.describe('Original Projects list: two projects with one name', () => {
  test('two open projects called alike are two rows', async ({page}) => {
    await page.goto('/');
    await openAProject(page, SAMPLE_PROJECT_OWPR, 'abc.owpr');
    await openAProject(page, otherFileOfTheSameName(), 'abc.owpr');
    await expect(page.locator('.project-row .project-name')).toHaveText(['abc', 'abc']);
    await expect(page.locator('.project-row.is-unsaved')).toHaveCount(0);
  });
});

test.describe('Mobile: two projects with one name', () => {
  test('two open projects called alike are two rows on the Projects page and two in the menu', async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page, SAMPLE_PROJECT_OWPR, 'abc.owpr');
    await openAMobileProject(page, otherFileOfTheSameName(), 'abc.owpr');
    await openMobileMenu(page);
    await expect(page.locator('.mob-open-project-name')).toHaveText(['abc', 'abc']);
    await page.locator('.mob-menu-item', {hasText: 'Projects'}).click();
    await expect(page.locator('.mob-projects-pane .mob-project-name')).toHaveText(['abc', 'abc']);
  });
});

test.describe('Both Projects pages say the same when there is no project', () => {
  test('the phone page says "No projects yet." like the desktop list', async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await page.locator('.mob-cta-secondary', {hasText: 'Open project'}).click();
    await expect(page.locator('.mob-projects-pane .mob-hint').first()).toHaveText('No projects yet.');
  });
});
