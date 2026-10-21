import {dirtyFocusedDesign, expect, openAProject, shownBoxVolume, shownDrivePower, shownFilterCount, shownProjectName, test, W5_1138SMF} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULT_SOURCE_RESISTANCE_OHM} from '@openisd/design/fields';
import {createEngine} from '@openisd/design/engine';
import {owdrText, type SeedDriver} from '../fixtures/seedMyDrivers.js';

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
  await expect(footerNext(page)).toBeDisabled();
  await modal.locator('#np-pr-select').click();
  await page.locator('button', { hasText: 'Define new passive radiator' }).click();
}

/** Puts drivers in My Drivers the way a user does: Load File… in the wizard's driver list, one `.owdr` file
 *  each. The import lands on the driver's summary, which has no way back to the list, so each driver gets its
 *  own opening of the wizard. */
async function importDrivers(page: Page, drivers: SeedDriver[]): Promise<void> {
  for (const [i, d] of drivers.entries()) {
    await openWizard(page);
    const modal = page.locator('.overlay.open');
    const id = `00000000-0000-4000-8000-00000000000${i + 1}`;
    await modal.locator('input[type=file]').setInputFiles({
      name: `${d.model}.owdr`, mimeType: 'application/x-openisd-driver', buffer: Buffer.from(owdrText(d, id)),
    });
    await expect(page.locator('.flash').last(), `${d.model} was not imported`).toContainText(`Driver imported to My Drivers: ${d.brand} ${d.model}`);
    await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.locator('.overlay.open')).toHaveCount(0);
  }
}

/** The wizard's one footer: Back, Next/Create (the green lead), Cancel. */
function footer(page: Page) {
  return page.locator('.overlay.open .modal-footer');
}

function footerNext(page: Page) {
  return footer(page).getByRole('button', { name: 'Next', exact: true });
}

/** Background colour of a footer button; the lead is green-dominant, the others grey. */
async function background(locator: ReturnType<Page['locator']>): Promise<string> {
  return locator.evaluate(el => getComputedStyle(el).backgroundColor);
}

const GREEN_FILL = /^rgb\(\d+, (1[0-9]{2}|[2-9][0-9]), \d+\)$/;

/** Open the wizard from the toolbar. */
async function openWizard(page: Page): Promise<void> {
  await page.locator('.tb-btn[title*="New project"]').click();
  await expect(page.locator('.overlay.open')).toContainText('Select driver for project');
}

/** Walk the open wizard: driver → num/placement → box type → (alignment or radiator) → name. */
async function walkWizard(page: Page, boxType: string, name: string, driverText = 'Wizard Test RS225'): Promise<void> {
  const modal = page.locator('.overlay.open');
  // Step 1 IS the driver library; Next is disabled until a driver is chosen or being read, and
  // Next chooses the driver being read (landing on step 2).
  await expect(modal.locator('button.pick-btn')).toHaveCount(0);
  await expect(footerNext(page)).toBeDisabled();
  await expect(modal.locator('.dlist')).toBeVisible();
  await modal.locator('.dlist .ditem', { hasText: driverText }).first().click();
  await footerNext(page).click();
  await expect(modal.locator('.selected-driver-banner')).toContainText(driverText);
  await footerNext(page).click();                               // step 2 (num/placement) -> step 3: box type
  await modal.getByLabel('Box type').selectOption(boxType);
  await modal.locator('button', { hasText: 'Next' }).click();
  if (boxType === 'box-passive-radiator') {
    await choosePassiveRadiator(page);                          // step 4: the radiator, as WinISD's wizard asks
  }
  await modal.locator('button', { hasText: 'Next' }).click();   // step 4 -> 5: the alignment, the radiator or the chambers
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
    test.beforeEach(async ({ appPage: page }) => {
      await openAProject(page);
      await importDrivers(page, [DRIVER, W5_1138SMF.toSeedDriver()]);
    });

    test('every step has one footer: Back, Next (the green lead), Cancel; step 1 has no Use and one Cancel', async ({ appPage: page }) => {
      await openWizard(page);
      const modal = page.locator('.overlay.open');
      await expect(modal.locator('.modal-footer')).toHaveCount(1);
      await expect(footer(page).getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
      await expect(footerNext(page)).toBeDisabled();
      await modal.locator('.dlist .ditem', { hasText: 'Wizard Test RS225' }).first().click();
      await expect(footerNext(page)).toBeEnabled();
      await expect(modal.getByRole('button', { name: 'Use', exact: true })).toHaveCount(0);
      await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(1);
      await expect(modal.getByRole('button', { name: 'Clone driver' })).toHaveCount(0);
      await expect(modal.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
      expect(await background(footerNext(page))).toMatch(GREEN_FILL);
      expect(await background(footer(page).getByRole('button', { name: 'Cancel' }))).not.toMatch(GREEN_FILL);

      await footerNext(page).click();
      await expect(modal.locator('.np-step')).toContainText('Step 2 of 5');
      await expect(footer(page).getByRole('button', { name: 'Back', exact: true })).toBeEnabled();
      expect(await background(footerNext(page))).toMatch(GREEN_FILL);
    });

    test('Back returns to the previous step with its values kept', async ({ appPage: page }) => {
      await openWizard(page);
      const modal = page.locator('.overlay.open');
      await modal.locator('.dlist .ditem', { hasText: 'Wizard Test RS225' }).first().click();
      await footerNext(page).click();                           // step 2
      await footerNext(page).click();                           // step 3
      await modal.locator('#np-box-type').selectOption('vented');
      await footerNext(page).click();                           // step 4: vented alignment
      await expect(modal.locator('.np-step')).toContainText('Step 4 of 5');
      await footer(page).getByRole('button', { name: 'Back', exact: true }).click();
      await expect(modal.locator('.np-step')).toContainText('Step 3 of 5');
      await expect(modal.locator('#np-box-type')).toHaveValue('vented');
      await expect(modal.locator('.selected-driver-banner')).toContainText('Wizard Test RS225');
    });

    test('changing the Options air leaves an open project\'s temperature alone; a project made after it gets the new value', async ({ appPage: page }) => {
      const advancedTemperature = () => page.locator('.tab-section.active .field', { hasText: 'Temperature' }).locator('input');
      await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
      await expect(advancedTemperature()).toHaveValue('293.15');

      await page.locator('.tb-btn[title="Options"]').click();
      const optionsTemperature = page.locator('.opt-modal .opt-fld', { hasText: 'Temperature' }).locator('input[data-numinput], input[type="number"]');
      await optionsTemperature.fill('300');
      await optionsTemperature.dispatchEvent('input');
      await optionsTemperature.blur();
      await page.locator('.opt-modal .opt-ok').click();

      await expect(advancedTemperature()).toHaveValue('293.15');

      await buildProject(page, 'sealed', 'Air copy');
      await page.locator('.project-nav li', { hasText: 'Advanced' }).click();
      await expect(advancedTemperature()).toHaveValue('300.00');
    });

    test('Cancel closes the wizard without creating a project', async ({ appPage: page }) => {
      const rows = page.locator('.projects-list .project-row');
      const before = await rows.count();
      await openWizard(page);
      const modal = page.locator('.overlay.open');
      await modal.locator('.dlist .ditem', { hasText: 'Wizard Test RS225' }).first().click();
      await footerNext(page).click();                           // step 2
      await footer(page).getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('.overlay.open')).toHaveCount(0);
      await expect(rows).toHaveCount(before);
    });

    test('the last step\'s green lead is Create, and it creates the project', async ({ appPage: page }) => {
      const rows = page.locator('.projects-list .project-row');
      const before = await rows.count();
      await openWizard(page);
      const modal = page.locator('.overlay.open');
      await modal.locator('.dlist .ditem', { hasText: 'Wizard Test RS225' }).first().click();
      await footerNext(page).click();                           // step 2
      await footerNext(page).click();                           // step 3
      await footerNext(page).click();                           // step 4: sealed alignment
      await footerNext(page).click();                           // step 5: name
      await expect(footerNext(page)).toHaveCount(0);
      await modal.locator('input[type="text"]').fill('Lead creates');
      const create = footer(page).getByRole('button', { name: 'Create' });
      expect(await background(create)).toMatch(GREEN_FILL);
      await create.click();
      await expect(page.locator('.overlay.open')).toHaveCount(0);
      await expect(rows).toHaveCount(before + 1);
      expect(await shownProjectName(page)).toBe('Lead creates');
    });

    test('walks driver → num/placement → box type → alignment → name, and the name shows in the titlebar', async ({ appPage: page }) => {
      await buildProject(page, 'sealed', 'My Sub Build');
      expect(await shownProjectName(page)).toBe('My Sub Build');
      await expect(page.locator('.projects-list .project-row.selected')).toContainText('My Sub Build');
    });

    // John, 21 Oct 2026: "Please default the project name to the driver and box type".
    test('the name box starts as "<driver model> <box type>", and a typed name stays through a box type change', async ({ appPage: page }) => {
      const modal = page.locator('.overlay.open');
      await openWizard(page);
      await modal.locator('.dlist .ditem', { hasText: 'Wizard Test RS225' }).first().click();
      await footerNext(page).click();
      await footerNext(page).click();
      await modal.getByLabel('Box type').selectOption('vented');
      await footerNext(page).click();
      await footerNext(page).click();
      const name = modal.locator('#np-project-name');
      await expect(name).toHaveValue('RS225 vented');
      await footer(page).getByRole('button', { name: 'Create' }).click();
      expect(await shownProjectName(page)).toBe('RS225 vented');

      await openWizard(page);
      await modal.locator('.dlist .ditem', { hasText: 'Wizard Test RS225' }).first().click();
      await footerNext(page).click();
      await footerNext(page).click();
      await modal.getByLabel('Box type').selectOption('vented');
      await footerNext(page).click();
      await footerNext(page).click();
      await name.fill('Den sub');
      await footer(page).getByRole('button', { name: 'Back', exact: true }).click();
      await footer(page).getByRole('button', { name: 'Back', exact: true }).click();
      await modal.getByLabel('Box type').selectOption('sealed');
      await footerNext(page).click();
      await footerNext(page).click();
      await expect(name).toHaveValue('Den sub');
    });

    test('starts fresh — it discards the previous design (filters, params)', async ({ appPage: page }) => {
      await dirtyFocusedDesign(page);

      await openWizard(page);
      await expect(page.locator('.overlay.open .np-warn')).toBeVisible();   // data-loss guard warns about unsaved changes
      await walkWizard(page, 'sealed', 'Skin project');

      expect(await shownFilterCount(page), 'fresh project — no inherited filters').toBe(0);
      expect(await shownDrivePower(page), 'default 1 W reference — not the previous 250').toBe(1);
    });

    // One test per box type: each wizard walk has its own time limit, so a slow machine never
    // fails the sixth walk for the time the first five took.
    for (const box of ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc']) {
      test(`a wizard-created ${box} project draws a chart`, async ({ appPage: page }) => {
        await buildProject(page, box);
        await expect(page.locator('.gpanel').first()).not.toHaveAttribute('data-y-range', '');   // a curve is drawn
      });
    }

    test('wizard-created vented project has a vent diameter and a tuning; the PR project has a radiator', async ({ appPage: page }) => {
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
      await expect.poll(async () => page.locator('#og-box-resonance').inputValue())
        .not.toBe('');
    });

    test('a wizard-created project gets the copper voice-coil resistance TC', async ({ appPage: page }) => {
      await buildProject(page, 'sealed');

      // Navigate to Driver tab
      await page.locator('.project-nav li', { hasText: 'Driver' }).click();

      // Voice coil resistance TC should default to copper (3.9000 in 1000/K)
      const tcField = page.locator('.field', { hasText: 'AlfaVC' });
      const tc = tcField.locator('input');
      await expect(tc).toHaveValue('3.9000');
    });

    test('a new sealed project drives the sealed alignment towards Qt 0.707 and derives its volume', async ({ appPage: page }) => {
      await buildProject(page, 'sealed', 'Sealed project');
      await page.locator('.project-nav li', { hasText: /^Box$/ }).click();
      await page.locator('#og-box-type').selectOption('sealed');

      const qtc = page.locator('.box-layout .field', { hasText: 'Qtc' }).locator('input');
      await expect.poll(() => qtc.inputValue()).not.toBe('');
      expect(Math.abs(parseFloat(await qtc.inputValue()) - 0.707)).toBeLessThan(0.1);

      const volVal = parseFloat(await page.locator('.box-layout .field', { hasText: 'Volume' }).locator('input').inputValue());
      expect(volVal, `volume derived from alignment, got ${volVal}`).toBeGreaterThan(0.1);
    });

    test('the sealed volume input follows the volume unit rotation: rotated to cu ft, a typed cu ft value is the created volume', async ({ appPage: page }) => {
      await openWizard(page);
      const modal = page.locator('.overlay.open');
      await modal.locator('.dlist .ditem', { hasText: 'Wizard Test RS225' }).first().click();
      await footerNext(page).click();                           // chooses the driver: step 2
      await modal.locator('button', { hasText: 'Next' }).click();
      await modal.getByLabel('Box type').selectOption('sealed');
      await modal.locator('button', { hasText: 'Next' }).click();

      const volume = modal.locator('#np-sealed-volume');
      const unit = modal.locator('.ui-field:has(#np-sealed-volume) [role="button"]');
      await expect(unit).toHaveText('L');
      await unit.click();
      await expect(unit).toHaveText('cu ft');
      await volume.fill('1');
      await volume.press('Tab');
      await modal.locator('button', { hasText: 'Next' }).click();
      await modal.locator('input[type="text"]').fill('Cubic foot');
      await modal.locator('button', { hasText: 'Create' }).click();

      // The Box tab keeps the cu ft the user chose and shows 1; in cm³ it is the 28 317 the entry means.
      await expect.poll(() => shownBoxVolume(page)).toBeCloseTo(1, 2);
      const boxUnit = page.locator('.tab-section.active .ui-field', { hasText: 'Volume' }).first().locator('.ui-field-unit');
      await expect(boxUnit).toHaveText('cu ft');
      await boxUnit.click();
      await boxUnit.click();
      await expect(boxUnit).toHaveText('cm³');
      expect(await shownBoxVolume(page)).toBeCloseTo(28317, 0);
      await boxUnit.click();
      await expect(boxUnit).toHaveText('L');
    });

    // WinISD's wizard asks for the passive radiator after the box type.
    // bugs/archive/BUG_20261001_new-project-wizard-skips-the-passive-radiator-step.md
    test('the passive-radiator step\'s Vas / Qms / Fs reach the created project', async ({ appPage: page }) => {
      await page.locator('.tb-btn[title*="New project"]').click();
      const modal = page.locator('.overlay.open');
      await modal.locator('.dlist .ditem', { hasText: 'Wizard Test RS225' }).first().click();
      await footerNext(page).click();                           // chooses the driver: step 2
      await modal.locator('button', { hasText: 'Next' }).click();
      await modal.getByLabel('Box type').selectOption('box-passive-radiator');
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
    test('opening a .wdr with no project starts the wizard, not a default sealed project', async ({ appPage: page }) => {
      // No project open is this test's precondition: the reset gives it.
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

      // Complete the wizard: vented box has an alignment step, C4 default; the .wdr
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
