import {expect, test} from '../fixtures.js';
import {fillAndBlur} from '../fixtures/numField.js';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const COMPLETE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'complete-driver-project.owpr');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.original-root input[type=file]').setInputFiles({ name: 'project.owpr', mimeType: 'application/json', buffer: readFileSync(COMPLETE) });
  await page.locator('.original-root').waitFor({ state: 'visible' });
  await page.locator('.project-nav li', { hasText: 'Signal' }).click();
});

test('BUG 3: series resistance holds a typed value — it no longer resets to 0', async ({ page }) => {
  const rs = page.locator('.field', { hasText: 'Series resistance' }).locator('input');
  await fillAndBlur(rs, '0.5');
  await expect(rs).toHaveValue(/0\.5/);

  await fillAndBlur(rs, '2.0');
  await expect(rs).toHaveValue(/2/);
});

test('BUG 1/2: system input power shows a value and moving it moves the voltage', async ({ page }) => {
  const pow = page.locator('.field', { hasText: 'System input power' }).locator('input');
  const vol = page.locator('.field', { hasText: 'Driver input voltage' }).locator('input');

  // Project creation stores the 1 W reference, so the pair is never blank or DQ-marked.
  await expect(pow).toHaveValue(/\d/);
  await expect(vol).toHaveValue(/\d/);
  await expect(pow).not.toHaveAttribute('title', /undefined/);
  await expect(vol).not.toHaveAttribute('title', /undefined/);
  await expect(pow).toHaveAttribute('title', /P = V² \/ Re/);
  await expect(vol).toHaveAttribute('title', /V = √\(P · Re\)/);

  await fillAndBlur(pow, '10');
  const v1 = Number(await vol.inputValue());
  expect(v1, '10 W into the driver must move the voltage').toBeGreaterThan(0);
  const v2 = Number(await vol.inputValue());
  await fillAndBlur(pow, '4');
  expect(Number(await vol.inputValue()), 'lowering power must lower the voltage').toBeLessThan(v2);
  expect(v1).toBeGreaterThan(0);
});

test('BUG 4/5: the power↔voltage pair stays coupled and positive', async ({ page }) => {
  const pow = page.locator('.field', { hasText: 'System input power' }).locator('input');
  const vol = page.locator('.field', { hasText: 'Driver input voltage' }).locator('input');

  // Edit the voltage: the power must follow (V²/Re), never stay stale.
  await fillAndBlur(vol, '8');
  const pAfterV = Number(await pow.inputValue());
  expect(pAfterV, '8 V must recompute the power').toBeGreaterThan(0);

  // Clear the voltage: the entered power survives and the voltage is stored again.
  await fillAndBlur(vol, '');
  expect(Number(await pow.inputValue())).toBeGreaterThan(0);
  expect(Number(await vol.inputValue())).toBeGreaterThan(0);
  await expect(vol).not.toHaveAttribute('title', /No drive level stated/);
});
