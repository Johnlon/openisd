import {expect, test} from '../fixtures.js';
import {fillAndBlur, fillAndCommit} from '../fixtures/numField.js';
import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {SAMPLE_PROJECT_OWPR} from '../fixtures/sampleProject.js';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MY_DRIVERS_KEY, myDriversJson} from '../fixtures/seedMyDrivers.js';

const COMPLETE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'complete-driver-project.owpr');
const SAMPLE = SAMPLE_PROJECT_OWPR;

const DRIVER = {
  brand: 'Wizard Air', model: 'WOOF', specs: {
    Fs_hz: 30, Qts: 0.4, Qms: 4, Vas_m3: 0.05, Re_ohm: 6.4, Sd_m2: 0.02, Xmax_m: 0.008,
  },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(([key, json]) => {
    localStorage.setItem(key, json);
  }, [MY_DRIVERS_KEY, myDriversJson([DRIVER])] as const);
  await page.goto('/');
  await page.locator('.original-root input[type=file]').setInputFiles({ name: 'project.owpr', mimeType: 'application/json', buffer: readFileSync(COMPLETE) });
  await page.locator('.original-root').waitFor({ state: 'visible' });
  await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
});

test('BUG 6: temperature/humidity/pressure show the app defaults, not blank', async ({ page }) => {
  // 20°C (293.15 K), 30 %RH, 101325 Pa are the application defaults (presentationState).
  const temp = page.locator('.field', { hasText: 'Temperature' }).locator('input');
  await expect(temp).toHaveValue(/293\.15/);
  const hum = page.locator('.field', { hasText: 'Relative humidity' }).locator('input');
  await expect(hum).toHaveValue(/30/);
  const pres = page.locator('.field', { hasText: 'Air pressure' }).locator('input');
  await expect(pres).toHaveValue(/101325/);
});

test('BUG 7: typing an environment value sticks — it no longer resets to blank on blur', async ({ page }) => {
  const temp = page.locator('.field', { hasText: 'Temperature' }).locator('input');
  await fillAndBlur(temp, '301');
  await expect(temp).toHaveValue(/301/);

  const hum = page.locator('.field', { hasText: 'Relative humidity' }).locator('input');
  await fillAndBlur(hum, '45');
  await expect(hum).toHaveValue(/45/);
});

test('BUG 8: clearing an environment field cannot blank it — the app default flows through', async ({ page }) => {
  const temp = page.locator('.field', { hasText: 'Temperature' }).locator('input');
  await fillAndBlur(temp, '');
  await expect(temp).toHaveValue(/293\.15/);   // back to the app default, never blank
});

test('BUG: a project built from the wizard shows the air constants, and they recompute on input', async ({ page }) => {
  // Same flow as wizard-defaults: New project → pick the seeded driver — a fresh project has
  // NO environment of its own, so the Advanced page must fall back to the app defaults and the
  // derived c/ρ (see BUG 6/7 — the "blank" disease hit fresh projects most often).
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await expect(modal).toContainText('Project name');
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('select').selectOption('sealed');
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('button', { hasText: 'Pick Driver' }).click();
  await page.locator('.dlist .ditem', { hasText: 'Wizard Air WOOF' }).first().click();
  await page.locator('.use-btn').click();
  await expect(page.locator('.original-root')).toBeVisible();

  await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
  const temp = page.locator('.field', { hasText: 'Temperature' }).locator('input');
  const hum = page.locator('.field', { hasText: 'Relative humidity' }).locator('input');
  const pres = page.locator('.field', { hasText: 'Air pressure' }).locator('input');
  const vel = page.locator('.field', { hasText: 'Sound velocity' }).locator('input');
  const density = page.locator('.field', { hasText: 'Air density' }).locator('input');

  await expect(temp).toHaveValue(/293\.15/);
  await expect(hum).toHaveValue(/30/);
  await expect(pres).toHaveValue(/101325/);
  // c = √(γRT) at 293.15 K → 343.68 m/s; ρ = p/(RT) → 1.20095 kg/m³.
  await expect(vel).toHaveValue(/343\.68/);
  await expect(density).toHaveValue(/1\.20\d/);

  await fillAndBlur(temp, '301');
  await expect(vel).toHaveValue(/348\.5\d/);
  await expect(density).toHaveValue(/1\.16\d/);

  // RH is the field that has broken before; it must BOTH stick AND move the derived
  // constants. Note the temp is still 301 K here — 80 % air is wetter, so c rises
  // (348.53 → 349.76) and ρ drops, ON TOP of the temperature effect.
  const velAt301_30 = parseFloat(await vel.inputValue());
  const rhoAt301_30 = parseFloat(await density.inputValue());
  await fillAndBlur(hum, '80');
  await expect(hum).toHaveValue(/80/);
  await expect(vel).toHaveValue(/349\.7\d/);            // c = √(γ·p/ρ) at 301 K, 80 %
  const velAt301_80 = parseFloat(await vel.inputValue());
  const rhoAt301_80 = parseFloat(await density.inputValue());
  expect(velAt301_80).toBeGreaterThan(velAt301_30);     // moisture raises c
  expect(rhoAt301_80).toBeLessThan(rhoAt301_30);        // moisture lowers ρ

  // Out-of-range entry is DATA now, not an error to clamp away (QO11.5 rework): 153 %
  // stays readable but raises the field's DQ flag — same contract the field-constraints
  // test pins for the -20 %/250 % extremes.
  await fillAndBlur(hum, '153');
  await expect(hum).toHaveValue(/153/);
  await expect(page.locator('.adv-air-fields .field', { hasText: 'Relative humidity' })).toHaveClass(/dq-flag/);
});

async function buildWizardProject(page: Page): Promise<void> {
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await expect(modal).toContainText('Project name');
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('select').selectOption('sealed');
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('button', { hasText: 'Pick Driver' }).click();
  await page.locator('.dlist .ditem', { hasText: 'Wizard Air WOOF' }).first().click();
  await page.locator('.use-btn').click();
  await expect(page.locator('.original-root')).toBeVisible();
}

test('wizard-built project: air constants move with pressure and the WinISD-model toggle switches physics', async ({ page }) => {
  await buildWizardProject(page);
  await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
  const pres = envField(page, 'Air pressure');
  const vel = envField(page, 'Sound velocity');
  const density = envField(page, 'Air density');
  const hum = envField(page, 'Relative humidity');
  const useWinisd = page.locator('label', { hasText: 'Use WinISD air model' }).locator('input[type=checkbox]');

  // QO95: a fresh wizard project matches WinISD out of the box — parity model ON (checked),
  // ρ/c at WinISD's own 1.20095 / 343.68. (The SAMPLE-project template instead keeps openisd's
  // physical model, at 1.20096 — the 8.3 ppm pair from engine/air.ts.)
  await expect(useWinisd).toBeChecked();
  await expect(density).toHaveValue(/1\.20095/);
  await expect(vel).toHaveValue(/343\.68/);

  // Pressure is the one air input the wizard test never exercised: ρ·c² = γ·p holds in BOTH
  // models, so ρ scales with p while c stays flat.
  await fillAndBlur(pres, '110000');
  await expect(pres).toHaveValue(/110000/);
  await expect(density).toHaveValue(/1\.30404/);      // ρ = 1.30404 kg/m³ at 110 kPa
  await expect(vel).toHaveValue(/343\.65/);           // c ≈ √(γRT) — pressure leaves it ~flat

  await fillAndBlur(pres, '101325');
  await expect(density).toHaveValue(/1\.20095/);

  // Unchecking switches to openisd's CIPM-2007 physical model: at RH 100 the density drops to
  // 1.19358 and c rises to 344.74 — clearly different physics from the parity pair.
  await useWinisd.uncheck();
  await fillAndBlur(hum, '100');
  await expect(density).toHaveValue(/1\.19358/);
  await expect(vel).toHaveValue(/344\.74/);
});

test('BUG: the sample project (minimal driver record) also shows the air constants', async ({ page }) => {
  // sample-project.owpr carries its OWN environment (293.15 K / RH 50 / 101325 Pa — see
  // generateSample.ts) and a skeleton driver — the previous blank disease showed here too.
  // A fresh load starts at the empty state, so import it directly.
  await page.goto('/');
  await page.locator('.original-root input[type=file]').setInputFiles({ name: 'sample.owpr', mimeType: 'application/json', buffer: readFileSync(SAMPLE) });
  await page.locator('.original-root').waitFor({ state: 'visible' });
  await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
  await expect(page.locator('.field', { hasText: 'Temperature' }).locator('input')).toHaveValue(/293\.15/);
  await expect(page.locator('.field', { hasText: 'Air pressure' }).locator('input')).toHaveValue(/101325/);
  // At the stored environment the WinISD parity model gives c = 343.99, ρ = 1.19885.
  await expect(page.locator('.field', { hasText: 'Sound velocity' }).locator('input')).toHaveValue(/343\.99/);
  await expect(page.locator('.field', { hasText: 'Air density' }).locator('input')).toHaveValue(/1\.19\d/);
});

function envField(page: Page, label: string) {
  return page.locator('.field', { hasText: label }).locator('input');
}

test('BUG (human, 2026-09-13): deleting any environment field drops the stored value and shows the app default as CALCULATED', async ({ page }) => {
  // The BUG 8 test only cleared a field that was NEVER stored (a fresh project). This is the
  // stored-then-cleared path, which reused the OLD value instead (temp/pressure) or corrupted
  // the domain to '' (humidity — the raw v-model.number emits '' on clear, which the `!== null`
  // guard passed through).
  await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
  const temp = envField(page, 'Temperature');
  const hum = envField(page, 'Relative humidity');
  const pres = envField(page, 'Air pressure');

  // Fresh: the app default flows through and is shown as a CALCULATED value (blue), never
  // green "entered" — the user cleared values they had never typed.
  await expect(temp).toHaveValue(/293\.15/);
  await expect(hum).toHaveValue(/30/);
  await expect(pres).toHaveValue(/101325/);
  await expect(temp).toHaveClass(/calculated/);
  await expect(hum).toHaveClass(/calculated/);
  await expect(pres).toHaveClass(/calculated/);
  await expect(temp.evaluate((el: Element) => el.closest('.field')?.className)).resolves.not.toMatch(/entered/);

  // Type values — they stick and turn green "entered".
  await fillAndCommit(temp, '301');
  await fillAndCommit(hum, '45');
  await fillAndCommit(pres, '99000');
  await expect(temp).toHaveValue(/301/);
  await expect(hum).toHaveValue(/45/);
  await expect(pres).toHaveValue(/99000/);
  await expect(temp).not.toHaveClass(/calculated/);

  // DELETE each — the stored value must drop, the app default must flow through, and the
  // field must present as CALCULATED again.
  await fillAndCommit(temp, '');
  await fillAndCommit(hum, '');
  await fillAndCommit(pres, '');

  await expect(temp).toHaveValue(/293\.15/);
  await expect(hum).toHaveValue(/30/);
  await expect(pres).toHaveValue(/101325/);
  await expect(temp).toHaveClass(/calculated/);
  await expect(hum).toHaveClass(/calculated/);
  await expect(pres).toHaveClass(/calculated/);
  await expect(temp.evaluate((el: Element) => el.closest('.field')?.className)).resolves.not.toMatch(/entered/);
  await expect(hum.evaluate((el: Element) => el.closest('.field')?.className)).resolves.not.toMatch(/entered/);
  await expect(pres.evaluate((el: Element) => el.closest('.field')?.className)).resolves.not.toMatch(/entered/);
});
