import {expect, test} from '../fixtures.js';
import {readFileSync} from 'node:fs';

import {COMPLETE_DRIVER_PROJECT_OWPR, ensureSampleProject} from '../fixtures/sampleProject.js';

ensureSampleProject();
const COMPLETE = COMPLETE_DRIVER_PROJECT_OWPR;

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

test('upping the power moves the voltage; clearing the voltage returns the pair to the 1 W reference', async ({ page }) => {
  await page.locator('.project-nav li', { hasText: 'Signal' }).click();
  const powField = page.locator('.field', { hasText: 'System input power' });
  const volField = page.locator('.field', { hasText: 'Driver input voltage' });

  await powField.locator('input').fill('10');
  await powField.locator('input').blur();
  const v1 = Number(await volField.locator('input').inputValue());
  expect(v1, '10 W into the driver must show a real voltage').toBeGreaterThan(0);

  // Clearing the voltage empties the PAIR, and the resolve refills it from the 1 W reference:
  // P is 1 W entered, V is √Re calculated. Neither end is ever left blank. The rule and its
  // arithmetic are pinned at the hook layer by `OriginalShell-hooks.test.ts`'s
  // "commit blank V | post: P 1 E, V √6 C".
  await volField.locator('input').fill('');
  await volField.locator('input').blur();
  await expect(powField.locator('input')).toHaveValue(/^1(\.0+)?$/);
  expect(Number(await volField.locator('input').inputValue())).toBeGreaterThan(0);
});
