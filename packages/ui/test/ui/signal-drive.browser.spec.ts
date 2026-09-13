import { test, expect } from '../fixtures.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMPLETE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'complete-driver-project.owpr');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('.original-root input[type=file]').setInputFiles({ name: 'project.owpr', mimeType: 'application/json', buffer: readFileSync(COMPLETE) });
  await page.locator('.original-root').waitFor({ state: 'visible' });
});

test('complete driver stores the 1 W reference and draws a chart without a drive DQ', async ({ page }) => {
  // The sweep and Signal tab use the same stored 1 W project reference.
  const modPath = '/src/logic/appState.ts';
  await expect.poll(async () => page.evaluate(async (p) => {
    const m = await import(/* @vite-ignore */ p);
    return m.curvesData.value?.spl?.length ?? 0;
  }, modPath)).toBeGreaterThan(0);

  await page.locator('.project-nav li', { hasText: 'Signal' }).click();
  const powField = page.locator('.field', { hasText: 'System input power' });
  await expect(powField.locator('.dq-note')).toHaveCount(0);
});

test('upping the power moves the voltage; clearing the voltage keeps the power', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Signal' }).click();
  const powField = page.locator('.field', { hasText: 'System input power' });
  const volField = page.locator('.field', { hasText: 'Driver input voltage' });

  await powField.locator('input').fill('10');
  await powField.locator('input').blur();
  const v1 = Number(await volField.locator('input').inputValue());
  expect(v1, '10 W into the driver must show a real voltage').toBeGreaterThan(0);

  // Clear the voltage — the entered power must survive (the pair's clear blanks only its own end).
  await volField.locator('input').fill('');
  await volField.locator('input').blur();
  await expect(powField.locator('input')).toHaveValue(/10/);
  expect(Number(await volField.locator('input').inputValue())).toBeGreaterThan(0);
});
