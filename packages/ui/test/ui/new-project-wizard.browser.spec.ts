import {curvesSplLength, dirtyFocusedDesign, expect, focusedBoxVolume, focusedFilterCount, focusedPowerDrive_W, focusedProjectName, openAProject, test, W5_1138SMF} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEngine} from '@openisd/design/engine';
import {DEFAULT_SOURCE_RESISTANCE_OHM} from '@openisd/design/fields';
import {MY_DRIVERS_KEY, myDriversJson} from '../fixtures/seedMyDrivers.js';

const WDR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'drivers', 'myprobes', 'per_field_and_misc', 's-re.wdr');

/**
 * The New Project wizard (OriginalNewProject.vue): driver (the embedded library) → number and
 * placement → box type → alignment (or the passive radiator) → name. These specs read what the
 * wizard produces; other specs seed their projects through the domain instead of walking it.
 */

// A complete driver so the wizard-built project can sweep.
const DRIVER = {
  brand: 'Wizard Test', model: 'RS225', specs: {
    Fs_hz: 30, Qts: 0.4, Qms: 4, Vas_m3: 0.05, Re_ohm: 6.4, Sd_m2: 0.02, Xmax_m: 0.008,
  },
};

/** Step 4 of a passive-radiator project: Next waits for a radiator; define a new one. */
async function choosePassiveRadiator(page: Page): Promise<void> {
  const modal = page.locator('.overlay.open');
  await expect(modal).toContainText('Passive Radiator');
  await expect(modal.locator('button', { hasText: 'Next' })).toHaveCount(0);
  await modal.locator('#np-pr-select').click();
  await page.locator('button', { hasText: 'Define new passive radiator' }).click();
}

/** Open the wizard from the toolbar. */
async function openWizard(page: Page): Promise<void> {
  await page.locator('.tb-btn[title*="New project"]').click();
  await expect(page.locator('.overlay.open')).toContainText('Select driver for project');
}

/** Walk the open wizard: driver → num/placement → box type → (alignment or radiator) → name. */
async function walkWizard(page: Page, boxType: string, name: string, driverText = 'Wizard Test RS225'): Promise<void> {
  const modal = page.locator('.overlay.open');
  // Step 1 IS the driver library: the list, summary and Use live inside the wizard modal, and
  // Next only appears once a driver has been chosen.
  await expect(modal.locator('button.pick-btn')).toHaveCount(0);
  await expect(modal.locator('button', { hasText: 'Next' })).toHaveCount(0);
  await expect(modal.locator('.dlist')).toBeVisible();
  await modal.locator('.dlist .ditem', { hasText: driverText }).first().click();
  await modal.locator('.use-btn').click();
  await expect(modal.locator('.selected-driver-banner')).toContainText(driverText);
  await modal.locator('button', { hasText: 'Next' }).click();   // Use lands on step 2 (num/placement); step 3: box type
  await modal.locator('.field', { hasText: 'Box type' }).locator('select').selectOption(boxType);
  await modal.locator('button', { hasText: 'Next' }).click();
  if (boxType === 'sealed' || boxType === 'vented') {
    await modal.locator('button', { hasText: 'Next' }).click(); // step 4: alignment
  }
  if (boxType === 'box-passive-radiator') {
    await choosePassiveRadiator(page);                          // step 4: the radiator, as WinISD's wizard asks
    await modal.locator('button', { hasText: 'Next' }).click();
  }
  await modal.locator('input[type="text"]').fill(name);         // step 5: name
  await modal.locator('button', { hasText: 'Create' }).click();
  await expect(page.locator('.original-root')).toBeVisible();
}

async function buildProject(page: Page, boxType: string, name = 'Wizard project'): Promise<void> {
  await openWizard(page);
  await walkWizard(page, boxType, name);
}

test.describe('New Project wizard', () => {
  test.describe('with a project open', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(([key, json]) => {
        localStorage.setItem(key, json);
      }, [MY_DRIVERS_KEY, myDriversJson([DRIVER, W5_1138SMF.toSeedDriver()])] as const);
      await page.goto('/');
      await openAProject(page);
    });

    test('walks driver → num/placement → box type → alignment → name, and the name shows in the titlebar', async ({ page }) => {
      await buildProject(page, 'sealed', 'My Sub Build');
      expect(await focusedProjectName(page)).toBe('My Sub Build');
      await expect(page.locator('.projects-list .project-row.selected')).toContainText('My Sub Build');
    });

    test('starts fresh — it discards the previous design (filters, params)', async ({ page }) => {
      await dirtyFocusedDesign(page);

      await openWizard(page);
      await expect(page.locator('.overlay.open .np-warn')).toBeVisible();   // data-loss guard warns about unsaved changes
      await walkWizard(page, 'sealed', 'Skin project');

      expect(await focusedFilterCount(page), 'fresh project — no inherited filters').toBe(0);
      expect(await focusedPowerDrive_W(page), 'default 1 W reference — not the previous 250').toBe(1);
    });

    test('a wizard-created project draws a chart for every simulatable box type', async ({ page }) => {
      test.setTimeout(30000);
      for (const box of ['sealed', 'vented', 'box-passive-radiator', 'bandpass4']) {
        await buildProject(page, box);
        await expect.poll(() => curvesSplLength(page)).toBeGreaterThan(0);
      }
    });

    test('wizard-created vented project has a vent diameter and a tuning; the PR project has a radiator', async ({ page }) => {
      await buildProject(page, 'vented');
      await expect(page.locator('.field', { hasText: 'Diameter' }).locator('input')).toHaveValue(/\d/);
      // WinISD's default C4/SC4 alignment at the new project's Rg 0.1 Ω / Ql 10 — the same design the
      // wizard derives the tuning from (docs/research/VENTED_ALIGNMENT_FORMULAS.md). Qes is what the
      // driver solver derives from Qts/Qms.
      const { specs } = DRIVER;
      const engine = createEngine();
      const Qes = specs.Qts * specs.Qms / (specs.Qms - specs.Qts);
      const qtsLoaded = engine.driver.sourceLoadedQts(specs.Qms, Qes, specs.Re_ohm, DEFAULT_SOURCE_RESISTANCE_OHM, specs.Qts);
      const { Fb } = engine.vented.alignment('c4', specs.Fs_hz, qtsLoaded, specs.Vas_m3, 10);
      await expect(page.locator('#og-fb-target')).toHaveValue(new RegExp(Fb.toFixed(1).replace('.', '\\.')));

      await buildProject(page, 'box-passive-radiator');
      await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
      await expect.poll(async () => page.locator('#og-box-resonance').inputValue(), { timeout: 8000 })
        .not.toBe('');
    });

    test('a wizard-created project gets the copper voice-coil resistance TC', async ({ page }) => {
      await buildProject(page, 'sealed');

      // Navigate to Driver tab
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();

      // Voice coil resistance TC should default to copper (3.9000 in 1000/K)
      const tcField = page.locator('.field', { hasText: 'Voice coil resistance TC' });
      const tc = tcField.locator('input');
      await expect(tc).toHaveValue('3.9000');
    });

    test('a new sealed project drives the sealed alignment towards Qt 0.707 and derives its volume', async ({ page }) => {
      await buildProject(page, 'sealed', 'Sealed project');
      await page.locator('#og-box-type').selectOption('sealed');

      const qtc = page.locator('.box-layout .field', { hasText: 'Qtc' }).locator('input');
      await expect.poll(() => qtc.inputValue(), { timeout: 8000 }).not.toBe('');
      expect(Math.abs(parseFloat(await qtc.inputValue()) - 0.707)).toBeLessThan(0.1);

      const volVal = parseFloat(await page.locator('.box-layout .field', { hasText: 'Volume' }).locator('input').inputValue());
      expect(volVal, `volume derived from alignment, got ${volVal}`).toBeGreaterThan(0.1);
    });

    test('the sealed volume input follows the volume unit rotation: rotated to cu ft, a typed cu ft value is the created volume', async ({ page }) => {
      await openWizard(page);
      const modal = page.locator('.overlay.open');
      await modal.locator('.dlist .ditem', { hasText: 'Wizard Test RS225' }).first().click();
      await modal.locator('.use-btn').click();
      await modal.locator('button', { hasText: 'Next' }).click();
      await modal.locator('.field', { hasText: 'Box type' }).locator('select').selectOption('sealed');
      await modal.locator('button', { hasText: 'Next' }).click();

      const volume = modal.locator('#np-sealed-volume');
      const unit = modal.locator('.field:has(#np-sealed-volume) [role="button"]');
      await expect(unit).toHaveText('L');
      await unit.click();
      await expect(unit).toHaveText('cu ft');
      await volume.fill('1');
      await volume.press('Tab');
      await modal.locator('button', { hasText: 'Next' }).click();
      await modal.locator('input[type="text"]').fill('Cubic foot');
      await modal.locator('button', { hasText: 'Create' }).click();

      await expect.poll(() => focusedBoxVolume(page)).toBeCloseTo(1 / 35.3147, 6);
    });

    // WinISD's wizard asks for the passive radiator after the box type.
    // bugs/archive/BUG_20261001_new-project-wizard-skips-the-passive-radiator-step.md
    test('the passive-radiator step\'s Vas / Qms / Fs reach the created project', async ({ page }) => {
      await page.locator('.tb-btn[title*="New project"]').click();
      const modal = page.locator('.overlay.open');
      await modal.locator('.dlist .ditem', { hasText: 'Wizard Test RS225' }).first().click();
      await modal.locator('.use-btn').click();
      await modal.locator('button', { hasText: 'Next' }).click();
      await modal.locator('.field', { hasText: 'Box type' }).locator('select').selectOption('box-passive-radiator');
      await modal.locator('button', { hasText: 'Next' }).click();
      await choosePassiveRadiator(page);

      for (const [id, text] of [['#np-pr-vas', '40'], ['#np-pr-qms', '6'], ['#np-pr-fs', '18']] as const) {
        await modal.locator(id).fill(text);
        await modal.locator(id).press('Tab');
      }
      await modal.locator('button', { hasText: 'Next' }).click();
      await modal.locator('input[type="text"]').fill('PR from the wizard');
      await modal.locator('button', { hasText: 'Create' }).click();

      await page.locator('.project-nav li', { hasText: 'Box' }).first().click();
      await expect.poll(async () => parseFloat(await page.locator('#og-pr-vas').inputValue())).toBeCloseTo(40, 3);
      await expect.poll(async () => parseFloat(await page.locator('#og-pr-qms').inputValue())).toBeCloseTo(6, 3);
      await expect.poll(async () => parseFloat(await page.locator('#og-pr-fs').inputValue())).toBeCloseTo(18, 3);
    });
  });

  test.describe('with no project open', () => {
    test('opening a .wdr with no project starts the wizard, not a default sealed project', async ({ page }) => {
      // No project open is this test's precondition. The clear also takes the shared fixture's
      // splash seed with it, so put that back — the splash is an overlay across the whole app and
      // is not what this test is about (`splash.browser.spec.ts` covers it).
      await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true } }));
      });
      await page.goto('/');
      await expect(page.locator('.original-root')).toBeVisible();

      await page.locator('.original-root input[type=file]').setInputFiles({
        name: 's-re.wdr', mimeType: 'text/plain', buffer: readFileSync(WDR),
      });

      // A driver file is not a project — the wizard opens with the driver pre-selected on step 1
      // (Q3 ruling) instead of a ready-made sealed project.
      const modal = page.locator('.overlay.open');
      await expect(modal).toContainText('Select driver for project');
      // The driver is pre-selected (Q3): step 1 shows it in the banner above the library, and Next
      // is already offered (Q2).
      await expect(modal.locator('.selected-driver-banner')).toBeVisible();
      await expect(modal.locator('.dlist')).toBeVisible();

      // Complete the wizard: vented box has an alignment step, C4 default (docs/plans/archive/FIX_WIZARD_VENTED.md); the .wdr
      // driver must be the project's driver.
      await modal.locator('button', { hasText: 'Next' }).click();   // step 2
      await modal.locator('button', { hasText: 'Next' }).click();   // step 3
      await modal.locator('select').selectOption('vented');
      await modal.locator('button', { hasText: 'Next' }).click();   // step 4: vented alignment
      await modal.locator('button', { hasText: 'Next' }).click();   // step 5: name
      await modal.locator('input[type="text"]').fill('s-re project');
      await modal.locator('button', { hasText: 'Create' }).click();

      await expect(page.locator('.original-root')).toBeVisible();
      await expect(page.locator('.driver-id-row input').first()).toHaveValue(/\S/);
    });
  });
});
