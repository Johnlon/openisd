import { test, expect } from '../fixtures.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MY_DRIVERS_KEY, myDriversJson } from '../fixtures/seedMyDrivers.js';

const SAMPLE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'sample-project.owpr');

// A complete driver so the wizard-built project can sweep.
const DRIVER = {
  brand: 'Wizard Test', model: 'RS225', specs: {
    Fs_hz: 30, Qts: 0.4, Qms: 4, Vas_m3: 0.05, Re_ohm: 6.4, Sd_m2: 0.02, Xmax_m: 0.008,
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

async function buildProject(page: import('@playwright/test').Page, boxType: string): Promise<void> {
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await expect(modal).toContainText('Project name');
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('select').selectOption(boxType);
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('button', { hasText: 'Pick Driver' }).click();
  await expect(page.locator('.dlist')).toBeVisible();
  await page.locator('.dlist .ditem', { hasText: 'Wizard Test RS225' }).first().click();
  await page.locator('.use-btn').click();
  await expect(page.locator('.original-root')).toBeVisible();
}

test('a wizard-created project draws a chart for every simulatable box type', async ({ page }) => {
  for (const box of ['sealed', 'vented', 'box-passive-radiator', 'bandpass4']) {
    await buildProject(page, box);
    await expect.poll(async () => page.evaluate(async (p) => {
      const m = await import(/* @vite-ignore */ p);
      return m.curvesData.value?.spl?.length ?? 0;
    }, '/src/logic/appState.ts')).toBeGreaterThan(0);
  }
});

test('wizard-created vented project has a vent diameter and a tuning; the PR project has a radiator', async ({ page }) => {
  await buildProject(page, 'vented');
  await expect(page.locator('.field', { hasText: 'Diameter' }).locator('input')).toHaveValue(/\d/);
  await expect(page.locator('#og-fb-target')).toHaveValue(/35/);

  await buildProject(page, 'box-passive-radiator');
  await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
  await expect.poll(async () => page.locator('#og-box-resonance').inputValue(), { timeout: 8000 })
    .not.toBe('');
});

test('wizard-created project has correct default physics values (e.g. copper alfaVC)', async ({ page }) => {
  await buildProject(page, 'sealed');
  
  // Navigate to Driver tab
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();

  // Voice coil resistance TC should default to copper (3.9000 in 1000/K)
  const tcField = page.locator('.field', { hasText: 'Voice coil resistance TC' });
  const tc = tcField.locator('input');
  await expect(tc).toHaveValue('3.9000');
});

test('the standard fixture sample-project.owpr is a faithful representation of a wizard-created project', async ({ page }) => {
  // Load the W5 driver into localStorage so it can be picked
  const w5 = JSON.parse(readFileSync('packages/ui/public/drivers/tang-band/w5-1138smf.json', 'utf-8'));
  await page.addInitScript(([key, json]) => {
    localStorage.setItem(key, json);
  }, [MY_DRIVERS_KEY, myDriversJson([w5])] as const);
  await page.goto('/');
  await page.locator('.original-root').waitFor({ state: 'visible' });

  // Walk the wizard
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await modal.locator('input[type="text"]').fill('W5-1138SMF Fixture');
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('select').selectOption('vented');
  await modal.locator('button', { hasText: 'Next' }).click();
  
  // Set volume to 7.0 L
  await modal.locator('input[type="number"]').fill('7');
  await modal.locator('button', { hasText: 'Next' }).click();

  await modal.locator('button', { hasText: 'Pick Driver' }).click();
  await page.locator('.dlist .ditem', { hasText: 'Tang Band W5-1138SMF' }).first().click();
  await page.locator('.use-btn').click();
  await expect(page.locator('.original-root')).toBeVisible();

  // Export the created project and compare its core structure to the fixture
  const wizardJson = await page.evaluate(async () => {
    const { requireFocusedProject } = await import(/* @vite-ignore */ '/src/logic/appState.ts');
    const p = requireFocusedProject();
    return p.serialize();
  });
  
  const sampleJson = JSON.parse(readFileSync(SAMPLE, 'utf-8'));
  
  // Ignore UUIDs, dates, and non-essential meta fields for comparison
  const normalize = (json: any) => {
    const clone = JSON.parse(JSON.stringify(json));
    if (clone.driverEmbedding?.device?.uuid) clone.driverEmbedding.device.uuid = 'normalized';
    if (clone.driverEmbedding?.device?.added) clone.driverEmbedding.device.added = 'normalized';
    if (clone.meta) {
      clone.meta.created = 'normalized';
      clone.meta.modified = 'normalized';
    }
    return clone;
  };

  const normWizard = normalize(wizardJson);
  const normSample = normalize(sampleJson.saved);

  // Compare the box section, driver section, etc.
  // Using toEqual which does a deep comparison
  expect(normWizard.box).toEqual(normSample.box);
  expect(normWizard.driverEmbedding).toEqual(normSample.driverEmbedding);
});
