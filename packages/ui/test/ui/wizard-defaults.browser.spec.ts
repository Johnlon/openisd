import { test, expect } from '../fixtures.js';
import { readFileSync } from 'node:fs';
import { Engine } from '@openisd/design/engine';
import { DEFAULT_SOURCE_RESISTANCE_OHM } from '@openisd/design/fields';
import { SAMPLE_PROJECT_OWPR } from '../fixtures/sampleProject.js';
import { MY_DRIVERS_KEY, myDriversJson } from '../fixtures/seedMyDrivers.js';

// The app's store, reached in-browser at runtime — passed as an evaluate ARGUMENT (never as a
// literal import), the same pattern original-skin.browser.spec.ts uses, so vue-tsc resolves nothing.
const APP_STATE = '/src/logic/appState.ts';

const SAMPLE = SAMPLE_PROJECT_OWPR;

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

/** New 5-step wizard (FIX_WIZARD_SEALED): driver → num/placement → box type → (alignment) → name. */
async function buildProject(page: import('@playwright/test').Page, boxType: string): Promise<void> {
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await expect(modal).toContainText('Select driver for project');
  // Step 1 IS the driver library (Q1): the list, summary and Use live inside the wizard modal,
  // and Next only appears once a driver has been chosen (Q2).
  await expect(modal.locator('button.pick-btn')).toHaveCount(0);
  await expect(modal.locator('button', { hasText: 'Next' })).toHaveCount(0);
  await expect(modal.locator('.dlist')).toBeVisible();
  await modal.locator('.dlist .ditem', { hasText: 'Wizard Test RS225' }).first().click();
  await modal.locator('.use-btn').click();
  await expect(modal.locator('.selected-driver-banner')).toContainText('Wizard Test RS225');
  await modal.locator('button', { hasText: 'Next' }).click();   // Use lands on step 2 (num/placement); step 3: box type
  await modal.locator('.field', { hasText: 'Box type' }).locator('select').selectOption(boxType);
  await modal.locator('button', { hasText: 'Next' }).click();
  if (boxType === 'sealed' || boxType === 'vented') {
    await modal.locator('button', { hasText: 'Next' }).click(); // step 4: alignment (sealed or vented — docs/plans/archive/FIX_WIZARD_VENTED.md)
  }
  await modal.locator('input[type="text"]').fill('Wizard project');  // step 5: name
  await modal.locator('button', { hasText: 'Create' }).click();
  await expect(page.locator('.original-root')).toBeVisible();
}
/** Ignore UUIDs, dates, and non-essential meta fields for comparison. */
function normalize(json: unknown) {
  const clone = JSON.parse(JSON.stringify(json));
  if (clone.driverEmbedding?.device?.uuid) clone.driverEmbedding.device.uuid = 'normalized';
  if (clone.driverEmbedding?.device?.added) clone.driverEmbedding.device.added = 'normalized';
  if (clone.box?.passiveRadiator?.component?.uuid?.value) clone.box.passiveRadiator.component.uuid.value = 'normalized';
  // The passive radiator's own added-date, stamped when the record was built. The fixture is
  // generated once and cached, so this differs from the wizard's whenever the two happen on
  // different days — the same volatility as `device.added` above.
  if (clone.box?.passiveRadiator?.component?.added?.value) clone.box.passiveRadiator.component.added.value = 'normalized';
  if (clone.meta) {
    clone.meta.created = 'normalized';
    clone.meta.modified = 'normalized';
  }
  return clone;
}

/** Mask solved (state-C) numeric values so two construction paths compare structurally. */
function maskDerived(json: unknown): unknown {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(o)) {
        if (k === 'value' && o.state === 'C' && typeof v === 'number') { out[k] = 'derived'; continue; }
        out[k] = walk(v);
      }
      return out;
    }
    return node;
  };
  return walk(JSON.parse(JSON.stringify(json)));
}

/** The vented project's solved port length — the number a user reads. */
function ventLengthOf(json: unknown): number {
  const len = (json as { box?: { vented?: { vent?: { length_m?: { value: number } } } } })
    .box?.vented?.vent?.length_m?.value;
  if (typeof len !== 'number') throw new Error('a vented project must carry a solved vent length');
  return len;
}

test('a wizard-created project draws a chart for every simulatable box type', async ({ page }) => {
  test.setTimeout(30000);
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
  // WinISD's default C4/SC4 alignment at the new project's Rg 0.1 Ω / Ql 10 — the same design the
  // wizard derives the tuning from (docs/research/VENTED_ALIGNMENT_FORMULAS.md). Qes is what the
  // driver solver derives from Qts/Qms.
  const { specs } = DRIVER;
  const engine = new Engine();
  const Qes = specs.Qts * specs.Qms / (specs.Qms - specs.Qts);
  const qtsLoaded = engine.sourceLoadedQts(specs.Qms, Qes, specs.Re_ohm, DEFAULT_SOURCE_RESISTANCE_OHM, specs.Qts);
  const { Fb } = engine.ventedAlignment('c4', specs.Fs_hz, qtsLoaded, specs.Vas_m3, 10);
  await expect(page.locator('#og-fb-target')).toHaveValue(new RegExp(Fb.toFixed(1).replace('.', '\\.')));

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

  // Walk the new 5-step wizard (FIX_WIZARD_SEALED)
  await page.locator('.tb-btn[title*="New project"]').click();
  const modal = page.locator('.overlay.open');
  await modal.locator('.dlist .ditem', { hasText: 'Tang Band W5-1138SMF' }).first().click();  // step 1: driver (embedded library)
  await modal.locator('.use-btn').click();
  await modal.locator('button', { hasText: 'Next' }).click();   // Use lands on step 2 (num/placement); step 3: box type
  await modal.locator('.field', { hasText: 'Box type' }).locator('select').selectOption('vented');           // step 3: box type
  await modal.locator('button', { hasText: 'Next' }).click();
  await modal.locator('button', { hasText: 'Next' }).click();   // step 4: vented alignment (docs/research/VENTED_ALIGNMENT_FORMULAS.md)
  await modal.locator('input[type="text"]').fill('W5-1138SMF Fixture');  // step 5: name
  await modal.locator('button', { hasText: 'Create' }).click();
  await expect(page.locator('.original-root')).toBeVisible();

  // Export the created project and compare its core structure to the fixture
  const wizardJson = await page.evaluate(async (modPath) => {
    const { requireFocusedProject } = await import(/* @vite-ignore */ modPath);
    const p = requireFocusedProject();
    // `saved` is the project C/S baseline (empty) until the wizard's choices are committed —
    // mirror generateSample.ts, which saves before serializing.
    p.save();
    return JSON.parse(p.toOwprText());
  }, APP_STATE);

  const sampleJson = JSON.parse(readFileSync(SAMPLE, 'utf-8'));
  
  const normWizard = normalize(wizardJson.saved);
  const normSample = normalize(sampleJson.saved);

  // SOLVED values (state "C") are masked below (maskDerived) so the two construction paths
  // compare structurally; the one number a user reads (the port length) is closeTo-checked.
  const maskedWizard = maskDerived(normWizard) as { box: unknown; driverEmbedding: unknown };
  const maskedSample = maskDerived(normSample) as { box: unknown; driverEmbedding: unknown };

  // Compare the box section, driver section, etc.
  // Using toEqual which does a deep comparison
  expect(maskedWizard.box).toEqual(maskedSample.box);
  expect(maskedWizard.driverEmbedding).toEqual(maskedSample.driverEmbedding);

  // The port length is a solved value the two construction paths float-differ on — it must be
  // present (never skipped) and close, not bit-identical.
  expect(ventLengthOf(normWizard)).toBeCloseTo(ventLengthOf(normSample), 2);
});
