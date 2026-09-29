/**
 * The mobile Project tab — name, creator, created/modified, description. Reached via the
 * hamburger menu (not the bottom tab bar — it's secondary, not a primary design destination).
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-hamburger').click();
  await page.getByText('Project details').click();
});

test('shows the project\'s name, creator, dates and description', async ({ page }) => {
  await expect(page.locator('#mob-proj-name')).toBeVisible();
  await expect(page.locator('#mob-proj-creator')).toBeVisible();
  await expect(page.locator('#mob-proj-created')).toBeVisible();
  await expect(page.locator('#mob-proj-modified')).toBeVisible();
  await expect(page.locator('#mob-proj-description')).toBeVisible();
});

test('editing the name writes the project, and survives switching tabs', async ({ page }) => {
  await page.locator('#mob-proj-name').fill('Living-room sub');
  await page.locator('#mob-proj-name').blur();

  await page.locator('.mob-tab', { hasText: 'Box' }).click();
  await page.locator('.mob-hamburger').click();
  await page.getByText('Project details').click();
  await expect(page.locator('#mob-proj-name')).toHaveValue('Living-room sub');
});

test('editing the description writes the project', async ({ page }) => {
  await page.locator('#mob-proj-description').fill('A test description.');
  await page.locator('#mob-proj-description').blur();
  await expect(page.locator('#mob-proj-description')).toHaveValue('A test description.');
});
