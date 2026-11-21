import {fileURLToPath} from 'node:url';
import {expect, openAProject, test} from '../fixtures.js';

const project = fileURLToPath(new URL('../fixtures/pr-resonance-underflow.owpr', import.meta.url));

test('the passive radiator readout explains why its resonance is unavailable after import', async ({page}) => {
  await page.goto('/');
  await openAProject(page, project);
  await page.locator('.project-nav li', {hasText: /^Passive Radiator$/}).click();

  const readout = page.locator('#og-pr-fs-mass');
  await expect(readout).toHaveValue('—');
  const row = page.locator('.ui-field', {has: readout});
  await row.getByRole('button', {name: 'Why this value is flagged'}).click();
  await expect(row.getByText(/passive radiator resonance with added mass.*infinite/i)).toBeVisible();
});
