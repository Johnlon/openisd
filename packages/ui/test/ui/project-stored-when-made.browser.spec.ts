/**
 * John, 17 Oct 2026: a new project is added to storage the moment it is made (New project, the
 * wizard, Open a file, Duplicate). Later edits mark it unsaved and light Save. So no open project
 * is "never saved".
 */
import {expect, openAMobileProject, openAProject, SAMPLE_PROJECT_OWPR, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';
import {forceMobileSkin, mobileFieldRow, openMobileMenu} from '../fixtures/mobileSkin.js';

test.describe('Original: a project is stored when it is made', () => {
  test('an opened file is in the list as saved with Save not lit; an edit lights Save', async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await expect(page.locator('.project-row')).toHaveCount(1);
    await expect(page.locator('.project-row')).not.toHaveClass(/is-unsaved/);
    await expect(page.locator('.project-row')).not.toContainText('Not saved');
    await expect(page.locator('.tb-btn[title^="Save - "]')).not.toHaveClass(/dirty/);

    await page.locator('.project-nav li', {hasText: 'Project'}).click();
    await fillAndBlur(page.locator('.tab-section.active .field', {hasText: 'Name'}).locator('input'), 'Edited name');
    await expect(page.locator('.tb-btn[title^="Save - "]')).toHaveClass(/dirty/);
    await expect(page.locator('.project-row.selected')).toHaveClass(/is-unsaved/);
  });

  test('a duplicate is in the list, stored, with Save not lit', async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-row.selected .row-menu-btn').click();
    await page.locator('.row-menu-item:has-text("Duplicate")').click();
    await expect(page.locator('.project-row .project-name')).toHaveText(['Copy of sample-project', 'sample-project']);
    await expect(page.locator('.project-row.is-unsaved')).toHaveCount(0);
    await expect(page.locator('.tb-btn[title^="Save - "]')).not.toHaveClass(/dirty/);
  });

  test('a closed project stays in the list, stored', async ({page}) => {
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-row.selected .row-menu-btn').click();
    await page.locator('.row-menu-item:has-text("Close")').click();
    await expect(page.locator('.project-row')).toHaveCount(1);
    await expect(page.locator('.project-row')).toHaveClass(/is-closed/);
  });
});

test.describe('Mobile: a project is stored when it is made', () => {
  test.beforeEach(async ({page}) => {
    await forceMobileSkin(page);
    await page.goto('/');
    await openAMobileProject(page);
  });

  test('an opened file is in the Projects page as saved with Save not lit; an edit lights Save', async ({page}) => {
    await openMobileMenu(page);
    await expect(page.locator('.mob-menu-item', {hasText: /^Save$/})).not.toHaveClass(/dirty/);
    await page.locator('.mob-menu-item', {hasText: 'Projects'}).click();
    await expect(page.locator('.mob-project-row')).toHaveCount(1);
    await expect(page.locator('.mob-project-row')).not.toContainText('Not saved');
    await expect(page.locator('.mob-project-row .mob-project-dirty')).toHaveCount(0);
    await page.locator('.mob-dlg-close').click();

    await fillAndBlur(mobileFieldRow(page, 'Volume').locator('input').first(), '25');
    await openMobileMenu(page);
    await expect(page.locator('.mob-menu-item', {hasText: /^Save$/})).toHaveClass(/dirty/);
    await expect(page.locator('.mob-open-project-dot')).toBeVisible();
  });
});

test.describe('Original: storage full', () => {
  test('a project the store will not take is not created; the popup offers the projects list', async ({page}) => {
    await page.addInitScript(() => {
      const originalSetItem = window.localStorage.setItem;
      Reflect.set(window, 'forceQuotaError', false);
      window.localStorage.setItem = function(key, value) {
        if (key === 'openisd_projects' && Reflect.get(window, 'forceQuotaError')) throw new DOMException('QuotaExceededError');
        originalSetItem.call(window.localStorage, key, value);
      };
    });
    await page.goto('/');
    await page.evaluate(() => { Reflect.set(window, 'forceQuotaError', true); });
    await page.locator('.original-root input[type=file]').setInputFiles(SAMPLE_PROJECT_OWPR);
    await expect(page.locator('.confirm-modal')).toContainText('Browser storage is full');
    await expect(page.locator('.confirm-modal')).not.toContainText('Export');
    await expect(page.locator('.project-row')).toHaveCount(0);
    await page.locator('.confirm-dialog-confirm').click();
    await expect(page.locator('.confirm-overlay')).toHaveCount(0);
    await expect(page.locator('.project-row')).toHaveCount(0);
  });
});
