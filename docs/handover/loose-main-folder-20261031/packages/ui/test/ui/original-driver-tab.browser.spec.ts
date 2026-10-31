import {readFileSync} from 'node:fs';
import {expect, openAProject, test} from '../fixtures.js';

const B_AND_C_18NW100 = readFileSync('packages/ui/public/drivers/b-c-speakers/18nw100-4.json');

test.beforeEach(async ({appPage: page}) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', {hasText: /^Driver$/}).click();
});

test('shows expandable driver consistency details on the main Driver tab', async ({appPage: page}) => {
  await page.getByRole('button', {name: 'Select Driver'}).click();
  await page.locator('.driver-library input[type="file"]').setInputFiles({
    name: '18nw100-4.owdr', mimeType: 'application/json', buffer: B_AND_C_18NW100,
  });
  await expect(page.locator('.driver-library .preview')).toBeVisible();
  await page.locator('.driver-library .use-btn').click();
  await expect(page.locator('.overlay.open')).toHaveCount(0);
  await page.getByRole('button', {name: /Edit/}).click();
  await expect(page.locator('.de-inconsistent')).toBeVisible();
  await page.locator('.de-footer button', {hasText: 'Cancel'}).click();
  await expect(page.locator('.de-modal')).toHaveCount(0);
  const checks = page.locator('.driver-consistency');
  await expect(checks).toBeVisible();
  await expect(checks.locator('summary')).toHaveText('⚠ Driver consistency checks');
  await checks.locator('summary').click();
  await expect(checks).toContainText('Clear force factor (BL) to calculate it from the other values.');
  await expect(checks).toContainText('Clear resonance (Fs) to calculate it from the other values.');
});
