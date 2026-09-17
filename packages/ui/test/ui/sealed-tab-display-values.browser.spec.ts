import { test, expect } from '../fixtures.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MY_DRIVERS_KEY, myDriversJson } from '../fixtures/seedMyDrivers.js';

const SAMPLE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'sample-project.owpr');

const DRIVER = {
  brand: 'Tang Band', model: 'W5-1138SMF', specs: {
    Fs_hz: 45, Qts: 0.49, Qms: 3.56, Vas_m3: 0.00485, Re_ohm: 3.4, Sd_m2: 0.0094, Xmax_m: 0.00925,
  },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(([key, json]) => {
    localStorage.setItem(key, json);
  }, [MY_DRIVERS_KEY, myDriversJson([DRIVER])] as const);
  await page.goto('/');
  await page.locator('.original-root input[type=file]').setInputFiles({ name: 'seed.owpr', mimeType: 'application/json', buffer: readFileSync(SAMPLE) });
  await page.locator('.original-root').waitFor({ state: 'visible' });
});

async function newSealedProject(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await expect(modal).toContainText('Project name');
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('select').selectOption('sealed');
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('button', { hasText: 'Pick Driver' }).click();
  await expect(page.locator('.dlist')).toBeVisible();
  await page.locator('.dlist .ditem', { hasText: 'W5-1138SMF' }).first().click();
  await page.locator('.use-btn').click();
  await expect(page.locator('.original-root')).toBeVisible();
}

test('a new sealed project drives the sealed alignment towards Qt 0.707 and derives its volume', async ({ page }) => {
  await newSealedProject(page);
  await page.locator('#og-box-type').selectOption('sealed');

  const qtc = page.locator('.box-layout .field', { hasText: 'Qtc' }).locator('input');
  await expect.poll(() => qtc.inputValue(), { timeout: 8000 }).not.toBe('');
  const qtcVal = parseFloat(await qtc.inputValue());
  expect(Math.abs(qtcVal - 0.707)).toBeLessThan(0.1);

  const vol = page.locator('.box-layout .field', { hasText: 'Volume' }).locator('input');
  const volVal = parseFloat(await vol.inputValue());
  expect(volVal, `volume derived from alignment, got ${volVal}`).toBeGreaterThan(0.1);
});