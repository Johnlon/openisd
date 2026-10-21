/**
 * T426: creating a project with the phone New project wizard must not change another project.
 * Seen in the QO247 review: after "Sub" (Closed) was created, the earlier Vented project showed
 * Closed and turned Unsaved.
 */
import {expect, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';

const TEST_DRIVER = 'Tang Band W5-1138SMF';

async function createWithWizard(page: Page, name: string, boxLabel: string): Promise<void> {
  await tapMobileMenuItem(page, 'New project');
  await page.getByText(TEST_DRIVER).click();
  const next = page.locator('.mob-np-footer').getByText('Next ▸', {exact: true});
  await next.click();
  await next.click();
  await page.locator('#np-box-type').selectOption({label: boxLabel});
  await next.click();
  await next.click();
  await page.getByLabel('Project name').fill(name);
  await page.locator('.mob-np-footer').getByText('Create Project', {exact: true}).click();
  await expect(page.locator('.mob-np-overlay')).toBeHidden();
}

async function openFromProjects(page: Page, name: string): Promise<void> {
  await tapMobileMenuItem(page, 'Projects');
  await page.locator('.mob-project-name', {hasText: name}).click();
}

test('a new Closed project leaves the earlier Vented project Vented and unchanged', async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await createWithWizard(page, 'Project A', 'Vented');
  await page.locator('.mob-tab').filter({hasText: 'Box'}).click();
  await expect(page.locator('#mob-box-type')).toHaveValue('vented');
  await createWithWizard(page, 'Project B', 'Closed');
  await page.locator('.mob-tab').filter({hasText: 'Box'}).click();
  await expect(page.locator('#mob-box-type')).toHaveValue('sealed');

  await openFromProjects(page, 'Project A');
  await page.locator('.mob-tab').filter({hasText: 'Box'}).click();
  await expect(page.locator('#mob-box-type')).toHaveValue('vented');
  await tapMobileMenuItem(page, 'Projects');
  await expect(page.locator('.mob-project-row', {hasText: 'Project A'}).getByText('Unsaved')).toHaveCount(0);
});
