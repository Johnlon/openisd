import {expect, test, W5_1138SMF} from '../fixtures.js';
import {readFileSync} from 'node:fs';
import {SAMPLE_PROJECT_OWPR} from '../fixtures/sampleProject.js';
import {MY_DRIVERS_KEY, myDriversJson} from '../fixtures/seedMyDrivers.js';

const SAMPLE = SAMPLE_PROJECT_OWPR;

const DRIVER = W5_1138SMF.toSeedDriver();

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
  await expect(modal).toContainText('Select driver for project');
  await expect(modal.locator('.dlist')).toBeVisible();
  await page.locator('.dlist .ditem', { hasText: 'W5-1138SMF' }).first().click();
  await page.locator('.use-btn').click();
  await modal.locator('button', { hasText: 'Next' }).click();   // Use lands on step 2 (num/placement); step 3: box type
  await modal.locator('.field', { hasText: 'Box type' }).locator('select').selectOption('sealed');
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('button', { hasText: 'Next' }).click();   // step 4: sealed alignment
  await modal.locator('input[type="text"]').fill('Sealed project');
  await modal.locator('button', { hasText: 'Create' }).click();
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