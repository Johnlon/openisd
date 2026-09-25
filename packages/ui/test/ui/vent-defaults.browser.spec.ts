import {expect, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';
import {readFileSync} from 'node:fs';

import {COMPLETE_DRIVER_PROJECT_OWPR, ensureSampleProject} from '../fixtures/sampleProject.js';

ensureSampleProject();
const COMPLETE = COMPLETE_DRIVER_PROJECT_OWPR;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.original-root input[type=file]').setInputFiles({ name: 'project.owpr', mimeType: 'application/json', buffer: readFileSync(COMPLETE) });
  await page.locator('.original-root').waitFor({ state: 'visible' });
  await page.locator('select#og-box-type').selectOption('vented');
  await page.locator('.project-nav li', { hasText: 'Vented' }).click();
});

test('BUG 10: the port end correction shows Two free ends by default, not blank', async ({ page }) => {
  const endSel = page.locator('.field', { hasText: 'End Correction' }).locator('select');
  await expect(endSel).toHaveValue(/0\.613/);
  await expect(endSel.locator('option:checked')).toContainText('Two free ends');
});

test('BUG 11: the vent shape offers slotted, and slotted inputs are reachable', async ({ page }) => {
  const shape = page.locator('.field', { hasText: 'Shape' }).locator('select');
  await expect(shape.locator('option[value="slotted"]')).toHaveCount(1);
  await shape.selectOption('slotted');
  const width = page.locator('.field', { hasText: 'Slot width' }).locator('input');
  const height = page.locator('.field', { hasText: 'Slot height' }).locator('input');
  await expect(width).toBeVisible();
  await expect(height).toBeVisible();
  await fillAndBlur(width, '5');
  await expect(width).toHaveValue(/5/);
});
