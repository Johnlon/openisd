import { test, expect } from '../fixtures.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMPLETE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'complete-driver-project.owpr');

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
  await width.fill('5');
  await width.blur();
  await expect(width).toHaveValue(/5/);
});
