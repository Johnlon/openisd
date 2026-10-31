import {expect, openTab, shownBoxVolume, shownProjectName, test, editorTab, openDriverEditor} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {defaultProjectName, WizardPlan, WizardStep} from '@openisd/design';
import {createEngine, type BoxType, type EbpSuitability} from '@openisd/design/engine';
import {NumberField, PhoneWizardText, ReadoutFormat} from '@openisd/design/fields';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import {readPassiveRadiatorTab} from '../fixtures/passiveRadiatorScreen.js';

/**
 * The New project wizard, walked the way a person walks it, once per skin: the desktop (Original) window and
 * a 374x705 phone. A passive-radiator project built from two bundled catalogue records, the Dayton Audio
 * E150HE-44 driver and the E150HE-PR radiator that is its partner.
 *
 * Every step is checked on arrival (the heading, the footer buttons and which of them work) and every figure the
 * step shows is checked against the catalogue record it came from. The expected figures are read from the record
 * file and formatted by the same design formatter (`NumberField.format`) the screen uses; nothing is typed in.
 * The checks on figures are soft, so one run lists every wrong figure instead of stopping at the first.
 */

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');
const DRIVER_PATH = 'dayton-audio/e150he-44';
const RADIATOR_PATH = 'dayton-audio/e150he-pr';
const BOX_TYPE: BoxType = 'box-passive-radiator';

// ---------------------------------------------------------------------------------------------------------
// The catalogue records, parsed once at the boundary.
// ---------------------------------------------------------------------------------------------------------

const textEntry = z.object({value: z.string()});
const recordSchema = z.object({
  brand: textEntry, model: textEntry, sku: textEntry, manufacturer: textEntry, provided_by: textEntry, added: textEntry,
  description: textEntry.optional(),
  specs: z.record(z.string(), z.record(z.string(), z.object({value: z.unknown()}))),
});
const indexSchema = z.array(z.object({path: z.string(), name: z.string(), canonical: z.string().optional()}));

interface CatalogueRecord {
  readonly brand: string;
  readonly model: string;
  readonly sku: string;
  readonly manufacturer: string;
  readonly providedBy: string;
  readonly added: string;
  readonly description: string | null;
  /** The list row's name, and the type the preview shows, from the catalogue index the list is built from. */
  readonly listName: string;
  readonly canonicalType: string;
  /** A stated figure in SI, or null where the record states none. */
  figure(key: string): number | null;
}

function loadRecord(path: string): CatalogueRecord {
  const parsed = recordSchema.parse(JSON.parse(readFileSync(join(PUBLIC, 'drivers', `${path}.json`), 'utf8')));
  const row = indexSchema.parse(JSON.parse(readFileSync(join(PUBLIC, 'drivers-index.json'), 'utf8'))).find(r => r.path === path)
    ?? indexSchema.parse(JSON.parse(readFileSync(join(PUBLIC, 'passive-radiators-index.json'), 'utf8'))).find(r => r.path === path);
  if (row === undefined) throw new Error(`${path} is not in a catalogue index`);
  const group = Object.values(parsed.specs).find(g => Object.keys(g).length > 0) ?? {};
  return {
    brand: parsed.brand.value, model: parsed.model.value, sku: parsed.sku.value, manufacturer: parsed.manufacturer.value,
    providedBy: parsed.provided_by.value, added: parsed.added.value, description: parsed.description?.value ?? null,
    listName: row.name, canonicalType: row.canonical ?? '',
    figure: key => {
      const entry = group[key];
      return entry !== undefined && typeof entry.value === 'number' ? entry.value : null;
    },
  };
}

function required(record: CatalogueRecord, key: string): number {
  const v = record.figure(key);
  if (v === null) throw new Error(`the catalogue record states no ${key}`);
  return v;
}

// ---------------------------------------------------------------------------------------------------------
// What each screen shows, as record keys with the field that formats them.
// ---------------------------------------------------------------------------------------------------------

interface Figure { readonly label: string; readonly key: string; readonly field: NumberField }

/** The driver preview's rows, in the order it draws them (a row with no stated figure is not drawn). */
const PREVIEW_FIGURES: readonly Figure[] = [
  {label: 'Fs', key: 'Fs_hz', field: NumberField.FS_HZ},
  {label: 'Qts', key: 'Qts', field: NumberField.QTS},
  {label: 'Qes', key: 'Qes', field: NumberField.QES},
  {label: 'Qms', key: 'Qms', field: NumberField.QMS},
  {label: 'Re', key: 'Re_ohm', field: NumberField.RE_OHM},
  {label: 'BL', key: 'BL_Tm', field: NumberField.BL_TM},
  {label: 'Le', key: 'Le_H', field: NumberField.LE_H},
  {label: 'Vas', key: 'Vas_m3', field: NumberField.VAS_M3},
  {label: 'Sd', key: 'Sd_m2', field: NumberField.SD_M2},
  {label: 'Xmax', key: 'Xmax_m', field: NumberField.XMAX_M},
  {label: 'Pe', key: 'Pe_W', field: NumberField.PE_W},
  {label: 'Znom', key: 'Znom_ohm', field: NumberField.ZNOM_OHM},
];

/** The driver editor's Parameters boxes, which the desktop Driver tab opens with Edit. */
const EDITOR_FIGURES: readonly Figure[] = [
  ...PREVIEW_FIGURES.filter(f => f.key !== 'Znom_ohm'),
  {label: 'Mms', key: 'Mms_kg', field: NumberField.MMS_KG},
  {label: 'Cms', key: 'Cms_m_per_N', field: NumberField.CMS_M_PER_N},
  {label: 'Rms', key: 'Rms_kg_per_s', field: NumberField.RMS_KG_PER_S},
  {label: 'Dd', key: 'Dd_m', field: NumberField.DD_M},
];

/** The radiator step's boxes, by the id of the box. */
const STEP_RADIATOR_FIGURES: readonly {readonly id: string; readonly key: string; readonly field: NumberField}[] = [
  {id: '#np-pr-vas', key: 'Vas_m3', field: NumberField.PR_VAS_L},
  {id: '#np-pr-qms', key: 'Qms', field: NumberField.PR_QMS},
  {id: '#np-pr-fs', key: 'Fs_hz', field: NumberField.PR_FS_HZ},
  {id: '#np-pr-sd', key: 'Sd_m2', field: NumberField.PR_SD_CM2},
];

// ---------------------------------------------------------------------------------------------------------
// The two skins' wizards.
// ---------------------------------------------------------------------------------------------------------

interface Skin {
  readonly name: string;
  readonly buttons: {readonly back: string; readonly next: string; readonly create: string; readonly cancel: string};
  open(page: Page): Promise<void>;
  root(page: Page): Locator;
  footer(page: Page): Locator;
  /** The heading text of a step of the passive-radiator plan. */
  headingText(step: WizardStep): string;
  /** The box that names the project on the last step. */
  nameBox(page: Page): Locator;
  /** The banner line under the chosen driver's name, by step. */
  expectBanner(page: Page, driver: CatalogueRecord, line: BannerLine): Promise<void>;
  /** The EBP value and suitability the box type step shows. */
  expectEbp(page: Page, ebpText: string, suitability: EbpSuitability): Promise<void>;
  /** Where the project's Driver tab is read, and what it shows. */
  expectDriverTab(page: Page, driver: CatalogueRecord, step2: Step2Values): Promise<void>;
  /** Opens the project's passive radiator page (the phone: the Box tab) and reads it. */
  readRadiator(page: Page): ReturnType<typeof readPassiveRadiatorTab>;
}

/** What the banner line carries on each step: the driver's figures, its EBP, or the box and the count. */
type BannerLine =
  | {readonly kind: 'figures'}
  | {readonly kind: 'ebp'; readonly ebpText: string; readonly suitability: EbpSuitability}
  | {readonly kind: 'box'; readonly boxLabel: string; readonly nDrivers: number};

/** The choices step 2 offered, as the project must show them later. */
interface Step2Values { readonly nDrivers: string; readonly wiring: string }

/** The lines of the driver figures the banner carries (WinISD parity: Fs, Qts, Vas as the wizard words them). */
function driverFigureLines(driver: CatalogueRecord): string[] {
  return [
    `Fs: ${required(driver, 'Fs_hz')} ${NumberField.FS_HZ.unitLabel()}`,
    `Qts: ${required(driver, 'Qts')}`,
    `Vas: ${NumberField.VAS_M3.format(required(driver, 'Vas_m3'))} ${NumberField.VAS_M3.unitLabel()}`,
  ];
}

function desktopSuitabilityLabel(suitability: EbpSuitability): string {
  switch (suitability) {
    case 'sealed': return 'Sealed preferred';
    case 'vented': return 'Vented preferred';
    case 'either': return 'Either sealed or vented';
  }
}

async function desktopOpen(page: Page): Promise<void> {
  await page.locator('.tb-btn[title*="New project"]').click();
  await expect(page.locator('.overlay.open')).toBeVisible();
}

async function desktopExpectBanner(page: Page, driver: CatalogueRecord, line: BannerLine): Promise<void> {
  const banner = page.locator('.overlay.open .selected-driver-banner');
  await expect(banner.locator('.banner-value')).toHaveText(`${driver.brand} ${driver.model}`);
  // The desktop banner always carries the driver's figures; the box and EBP lines are the phone's.
  if (line.kind === 'figures') await expect.soft(banner.locator('.driver-specs-preview span')).toHaveText(driverFigureLines(driver));
}

async function desktopExpectEbp(page: Page, ebpText: string, suitability: EbpSuitability): Promise<void> {
  const root = page.locator('.overlay.open');
  await expect.soft(root.locator('.ebp-row')).toHaveText(`Efficiency Bandwidth Product (EBP): ${ebpText}`);
  await expect.soft(root.locator('.suitability-badge')).toHaveText(desktopSuitabilityLabel(suitability));
}

async function desktopExpectDriverTab(page: Page, driver: CatalogueRecord, step2: Step2Values): Promise<void> {
  await openTab(page, 'Driver');
  const tab = page.locator('.tab-section.active');
  await expect.soft(tab.locator('.driver-id-row input').first(), 'Brand').toHaveValue(driver.brand);
  await expect.soft(tab.locator('.driver-model-field input'), 'Model').toHaveValue(driver.model);
  await expect.soft(tab.locator('.field', {hasText: 'Num. of drivers'}).locator('select'), 'Num. of drivers').toHaveValue(step2.nDrivers);
  await expect.soft(tab.locator('.field', {hasText: 'Voice coil connection'}).locator('select'), 'Voice coil connection').toHaveValue(step2.wiring);
  await expect.soft(tab.locator('input[type=radio][value=standard]'), 'Placement Standard').toBeChecked();
  for (const advanced of [NumberField.DRIVER_VCTEMPRISE_K, NumberField.DRIVER_ADDEDMASS_G, NumberField.ALFAVC_PER_K]) {
    await expect.soft(tab.locator('.driver-advanced-fields .field', {hasText: advanced.label}).locator('input').first(), advanced.label).toHaveValue(/\d/);
  }
  // The driver's figures: the Driver tab's Edit opens the editor, whose Parameters tab states them all.
  await openDriverEditor(page);
  await editorTab(page, 'Parameters');
  for (const f of EDITOR_FIGURES) {
    // The editor keeps a record's own digits (Dd 109.998), where the formatter rounds to the field's precision (110.00):
    // the figure must agree to that precision.
    const box = page.locator(`.de-body [data-field-key="${f.key}"] input`).first();
    await expect(box, `driver editor ${f.label} has a value`).toHaveValue(/\d/);
    expect.soft(Number(await box.inputValue()), `driver editor ${f.label}`).toBeCloseTo(Number(f.field.format(required(driver, f.key))), 2);
  }
  await page.locator('.de-footer button', {hasText: 'Cancel'}).click();
  await page.locator('.de-body').waitFor({state: 'hidden'});
}

async function desktopReadRadiator(page: Page): ReturnType<typeof readPassiveRadiatorTab> {
  return readPassiveRadiatorTab(page);
}

const DESKTOP: Skin = {
  name: 'desktop (Original)',
  buttons: {back: 'Back', next: 'Next', create: 'Create', cancel: 'Cancel'},
  open: desktopOpen,
  root: page => page.locator('.overlay.open'),
  footer: page => page.locator('.overlay.open .modal-footer'),
  headingText(step) {
    const plan = WizardPlan.of(BOX_TYPE);
    return `Step ${plan.numberOf(step)} of ${plan.total} — ${plan.labelOf(step)}`;
  },
  nameBox: page => page.locator('.overlay.open #np-project-name'),
  expectBanner: desktopExpectBanner,
  expectEbp: desktopExpectEbp,
  expectDriverTab: desktopExpectDriverTab,
  readRadiator: desktopReadRadiator,
};

async function phoneOpen(page: Page): Promise<void> {
  await page.getByText('New project').click();
  await expect(page.locator('.mob-np-overlay')).toBeVisible();
}

async function phoneExpectBanner(page: Page, driver: CatalogueRecord, line: BannerLine): Promise<void> {
  const banner = page.locator('.mob-np-banner');
  await expect(banner.locator('.mob-np-banner-name')).toHaveText(`${driver.brand} ${driver.model}`);
  const sub = banner.locator('.mob-np-banner-sub');
  switch (line.kind) {
    case 'figures':
      await expect.soft(sub).toHaveText(PhoneWizardText.driverFigures(driverFigureLines(driver)));
      break;
    case 'ebp':
      await expect.soft(sub).toHaveText(PhoneWizardText.ebpLine(line.ebpText, PhoneWizardText.ebpBadge(line.suitability)));
      break;
    case 'box':
      await expect.soft(sub).toHaveText(PhoneWizardText.boxAndDrivers(line.boxLabel, line.nDrivers));
      break;
  }
}

async function phoneExpectEbp(page: Page, ebpText: string, suitability: EbpSuitability): Promise<void> {
  const root = page.locator('.mob-np-overlay');
  await expect.soft(root.locator('.mob-np-ebp-val')).toHaveText(`${PhoneWizardText.EBP_LABEL}: ${ebpText}`);
  await expect.soft(root.locator('.mob-np-ebp-formula')).toHaveText(PhoneWizardText.EBP_FORMULA);
  await expect.soft(root.locator('.mob-np-ebp-badge')).toHaveText(PhoneWizardText.ebpBadge(suitability)?.label ?? '');
}

async function phoneExpectDriverTab(page: Page, driver: CatalogueRecord, step2: Step2Values): Promise<void> {
  await openTab(page, 'Driver');
  await expect.soft(page.locator('.mob-cname-button'), 'Brand and model').toHaveText(`${driver.brand} ${driver.model}`);
  await expect.soft(page.locator('#mob-n-drivers'), 'Drivers').toHaveValue(step2.nDrivers);
  await expect.soft(page.locator('#mob-wiring'), 'Connection').toHaveValue(step2.wiring);
  // The phone's Driver tab states five key figures.
  for (const f of PREVIEW_FIGURES.filter(p => ['Fs', 'Qts', 'Vas', 'Re', 'Xmax'].includes(p.label))) {
    const expected = f.field.format(required(driver, f.key));
    await expect.soft(mobileFieldRow(page, f.label).locator('input').first(), `driver key figure ${f.label}`).toHaveValue(expected);
  }
}

async function phoneReadRadiator(page: Page): ReturnType<typeof readPassiveRadiatorTab> {
  await openTab(page, 'Box');
  return readPassiveRadiatorTab(page);
}

const PHONE: Skin = {
  name: 'phone (mobile, 374x705)',
  buttons: {back: PhoneWizardText.BACK, next: PhoneWizardText.NEXT, create: PhoneWizardText.CREATE, cancel: PhoneWizardText.CANCEL},
  open: phoneOpen,
  root: page => page.locator('.mob-np-overlay'),
  footer: page => page.locator('.mob-np-footer'),
  headingText: step => WizardPlan.of(BOX_TYPE).labelOf(step),
  nameBox: page => page.locator('.mob-np-overlay #np-proj-name'),
  expectBanner: phoneExpectBanner,
  expectEbp: phoneExpectEbp,
  expectDriverTab: phoneExpectDriverTab,
  readRadiator: phoneReadRadiator,
};

// ---------------------------------------------------------------------------------------------------------
// The walk.
// ---------------------------------------------------------------------------------------------------------

/** On arrival at a step: its heading, and a footer of exactly the buttons that step has. */
async function expectArrival(page: Page, skin: Skin, step: WizardStep, lead: 'next' | 'create', backEnabled: boolean): Promise<void> {
  await expect(page.locator('.np-step'), `heading of ${step.value}`).toHaveText(skin.headingText(step));
  const names = (await skin.footer(page).getByRole('button').allInnerTexts()).map(t => t.trim()).sort();
  const leadName = lead === 'next' ? skin.buttons.next : skin.buttons.create;
  expect(names, `footer buttons on ${step.value}`).toEqual([skin.buttons.back, leadName, skin.buttons.cancel].sort());
  const back = skin.footer(page).getByRole('button', {name: skin.buttons.back, exact: true});
  if (backEnabled) await expect(back, `Back on ${step.value}`).toBeEnabled();
  else await expect(back, `Back on ${step.value}`).toBeDisabled();
}

function footerButton(page: Page, skin: Skin, name: string): Locator {
  return skin.footer(page).getByRole('button', {name, exact: true});
}

async function walk(page: Page, skin: Skin): Promise<void> {
  const driver = loadRecord(DRIVER_PATH);
  const radiator = loadRecord(RADIATOR_PATH);
  const root = skin.root(page);
  const engine = createEngine();
  const ebp = required(driver, 'EBP_hz');
  const ebpText = ReadoutFormat.EBP.text(ebp, '--');
  const suitability = engine.driver.ebpSuitability(ebp);

  // ---- Step 1: the driver library ----------------------------------------------------------------------
  await skin.open(page);
  await expectArrival(page, skin, WizardStep.DRIVER, 'next', false);
  await expect(footerButton(page, skin, skin.buttons.next), 'Next waits for a driver').toBeDisabled();
  await expect(root.locator('.dlist')).toBeVisible();
  const listed = root.locator('.dlist .ditem', {hasText: driver.listName});
  await expect.soft(listed, 'the driver is listed once').toHaveCount(1);
  await expect.soft(listed.first().locator('b').first(), 'list row name').toHaveText(driver.listName);
  await listed.first().click();

  // The preview of the chosen driver: every figure the record states, nothing the record does not.
  const preview = root.locator('.preview');
  await expect(preview).toBeVisible();
  await expectArrival(page, skin, WizardStep.DRIVER, 'next', false);
  await expect(footerButton(page, skin, skin.buttons.next), 'Next once a driver is read').toBeEnabled();
  await expect.soft(preview.locator('.prev-name')).toContainText(driver.model);
  const drawn = PREVIEW_FIGURES.filter(f => (driver.figure(f.key) ?? 0) !== 0);
  const typeRow = driver.canonicalType === '' ? [] : ['Type'];
  await expect.soft(preview.locator('.spec-row .spec-lbl'), 'preview rows').toHaveText([...drawn.map(f => f.label), ...typeRow, 'EBP']);
  for (const f of drawn) {
    const specRow = preview.locator('.spec-row', {has: root.page().locator('.spec-lbl', {hasText: new RegExp(`^${f.label}$`)})});
    await expect.soft(specRow.locator('.spec-val b'), `preview ${f.label}`).toHaveText(f.field.format(required(driver, f.key)));
    await expect.soft(specRow.locator('.spec-unit'), `preview ${f.label} unit`).toHaveText(f.field.unitLabel());
  }
  const typeSpec = preview.locator('.spec-row', {has: root.page().locator('.spec-lbl', {hasText: /^Type$/})});
  await expect.soft(typeSpec.locator('.spec-val b'), 'preview Type').toHaveText(driver.canonicalType);
  const ebpSpec = preview.locator('.spec-row', {has: root.page().locator('.spec-lbl', {hasText: /^EBP$/})});
  await expect.soft(ebpSpec.locator('.spec-val b'), 'preview EBP').toHaveText(NumberField.EBP_HZ.format(ebp));
  await expect.soft(ebpSpec.locator('.spec-unit'), 'preview EBP unit').toHaveText(NumberField.EBP_HZ.unitLabel());
  const texts: readonly (readonly [string, string])[] = [
    ['Brand', driver.brand], ['Model', driver.model], ['SKU', driver.sku], ['Manufacturer', driver.manufacturer],
    ['Measured by', driver.providedBy], ['Date added', driver.added],
  ];
  for (const [label, value] of texts) {
    await expect.soft(preview.locator('.prev-textrow', {hasText: label}), `preview ${label}`).toContainText(value);
  }
  if (driver.description !== null) await expect.soft(preview.locator('.prev-desc'), 'preview Description').toContainText(driver.description.slice(0, 60));

  // ---- Step 2: number of drivers and placement ----------------------------------------------------------
  await footerButton(page, skin, skin.buttons.next).click();
  await expectArrival(page, skin, WizardStep.COUNT, 'next', true);
  await skin.expectBanner(page, driver, {kind: 'figures'});
  await expect(footerButton(page, skin, skin.buttons.next), 'Next on step 2').toBeEnabled();
  const nDrivers = root.locator('#np-ndrivers');
  const wiring = root.locator('#np-wiring');
  await expect.soft(nDrivers, 'Num. of drivers default').toHaveValue(String(NumberField.DRIVER_NDRIVERS.countOptions()[0]?.value));
  await expect.soft(wiring, 'Voice coil connection has a value').toHaveValue(/\S/);
  if (skin === DESKTOP) {
    await expect.soft(root.locator('input[type=radio][value=standard]'), 'Placement Standard default').toBeChecked();
    await expect.soft(root.locator('input[type=radio][value=iso]'), 'Iso-Barik is not offered').toBeDisabled();
  } else {
    await expect.soft(root.locator('#np-placement'), 'Placement default').toHaveValue('standard');
  }
  const step2: Step2Values = {nDrivers: await nDrivers.inputValue(), wiring: await wiring.inputValue()};

  // ---- Step 3: the box type and the EBP line -----------------------------------------------------------
  await footerButton(page, skin, skin.buttons.next).click();
  await expectArrival(page, skin, WizardStep.BOX_TYPE, 'next', true);
  await skin.expectBanner(page, driver, {kind: 'ebp', ebpText, suitability});
  const boxSelect = root.locator('#np-box-type');
  await expect.soft(boxSelect, 'Box type default').toHaveValue('sealed');
  const offered: BoxType[] = ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc'];
  expect.soft((await boxSelect.locator('option').evaluateAll(os => os.map(o => (o instanceof HTMLOptionElement ? o.value : "")))).sort(), 'Box types offered').toEqual([...offered].sort());
  await skin.expectEbp(page, ebpText, suitability);

  // Back goes to step 2 with its choices kept, and Next comes forward again.
  await footerButton(page, skin, skin.buttons.back).click();
  await expectArrival(page, skin, WizardStep.COUNT, 'next', true);
  await expect.soft(nDrivers, 'Num. of drivers kept after Back').toHaveValue(step2.nDrivers);
  await expect.soft(wiring, 'Voice coil connection kept after Back').toHaveValue(step2.wiring);
  await footerButton(page, skin, skin.buttons.next).click();
  await expectArrival(page, skin, WizardStep.BOX_TYPE, 'next', true);

  await boxSelect.selectOption(BOX_TYPE);
  await expect(boxSelect).toHaveValue(BOX_TYPE);
  const boxLabel = (await boxSelect.locator('option:checked').innerText()).trim();
  await skin.expectEbp(page, ebpText, suitability);

  // ---- Step 4: the passive radiator ------------------------------------------------------------------
  await footerButton(page, skin, skin.buttons.next).click();
  await expectArrival(page, skin, WizardStep.BOX_DETAILS, 'next', true);
  await skin.expectBanner(page, driver, {kind: 'box', boxLabel, nDrivers: Number(step2.nDrivers)});
  const startingVolume = root.locator('#np-starting-volume');
  await expect.soft(startingVolume, 'Starting volume has a value').toHaveValue(/\d/);
  const startingVolume_L = Number(await startingVolume.inputValue());
  await expect(footerButton(page, skin, skin.buttons.next), 'Next waits for a radiator').toBeDisabled();
  for (const f of STEP_RADIATOR_FIGURES) await expect.soft(root.locator(f.id), `${f.id} before a radiator is chosen`).toHaveValue('');
  await expect.soft(root.locator('#np-pr-xmax'), 'Xmax before a radiator is chosen').toHaveValue('');
  await expect.soft(root.locator('#np-pr-xmech'), 'Xmech before a radiator is chosen').toHaveValue('');

  await root.locator('#np-pr-select').click();
  await page.locator('.pr-lib-item .pr-lib-name', {hasText: 'E150HE-PR'}).first().click();
  await expect(root.locator('#np-pr-name'), 'radiator name').toHaveValue(radiator.model);
  for (const f of STEP_RADIATOR_FIGURES) {
    await expect.soft(root.locator(f.id), `${f.id} after the pick`).toHaveValue(f.field.format(required(radiator, f.key)));
  }
  // The record states no Xmax, only a mechanical limit (Xlim, shown as Xmech): the two are separate fields, so
  // Xmax stays blank and Xmech shows the record's 19 mm (QO327); Mms / Cms / Rms are not boxes on this step.
  expect(radiator.figure('Xmax_m'), 'the radiator record states no Xmax').toBeNull();
  await expect.soft(root.locator('#np-pr-xmax'), 'Xmax after the pick').toHaveValue('');
  await expect.soft(root.locator('#np-pr-xmech'), 'Xmech after the pick').toHaveValue(NumberField.PR_XMECH_MM.format(required(radiator, 'Xlim_m')));
  await expectArrival(page, skin, WizardStep.BOX_DETAILS, 'next', true);
  await expect(footerButton(page, skin, skin.buttons.next), 'Next once a radiator is chosen').toBeEnabled();

  // ---- Step 5: the project's name -----------------------------------------------------------------------
  await footerButton(page, skin, skin.buttons.next).click();
  await expectArrival(page, skin, WizardStep.PROJECT_INFO, 'create', true);
  await expect(footerButton(page, skin, skin.buttons.next), 'no Next on the last step').toHaveCount(0);
  const projectName = defaultProjectName(driver.model, BOX_TYPE);
  await expect.soft(skin.nameBox(page), 'default project name').toHaveValue(projectName);
  await expect(footerButton(page, skin, skin.buttons.create), 'Create with a name').toBeEnabled();
  await footerButton(page, skin, skin.buttons.create).click();
  await expect(skin.root(page), 'wizard closes on Create').toHaveCount(0);

  // ---- The project: the Driver tab and the passive radiator page show what the wizard showed -------
  await skin.expectDriverTab(page, driver, step2);

  const shown = await skin.readRadiator(page);
  expect.soft(shown.name, 'PR name').toBe(radiator.model);
  expect.soft(shown.count, 'PR count').toBe(1);
  expect.soft(shown.vas_L, 'PR Vas').toBe(Number(NumberField.PR_VAS_L.format(required(radiator, 'Vas_m3'))));
  expect.soft(shown.qms, 'PR Qms').toBe(Number(NumberField.PR_QMS.format(required(radiator, 'Qms'))));
  expect.soft(shown.fs_hz, 'PR Fs').toBe(Number(NumberField.PR_FS_HZ.format(required(radiator, 'Fs_hz'))));
  expect.soft(shown.sd_cm2, 'PR Sd').toBe(Number(NumberField.PR_SD_CM2.format(required(radiator, 'Sd_m2'))));
  // The record states no Xmax, so the project's Xmax is blank too: nothing is invented (QO327). Its Xmech is its own field.
  expect.soft(shown.xmax_mm, 'PR Xmax').toBeNull();
  expect.soft(shown.xmech_mm, 'PR Xmech').toBe(Number(NumberField.PR_XMECH_MM.format(required(radiator, 'Xlim_m'))));

  expect.soft(await shownBoxVolume(page), 'the project box volume is the wizard starting volume').toBe(startingVolume_L);
  expect.soft(await shownProjectName(page), 'project name').toBe(projectName);
}

test.describe('New project wizard walk', () => {
  test('desktop: every step, transition and figure of a passive-radiator project against the E150HE and E150HE-PR records', async ({appPage: page}) => {
    await walk(page, DESKTOP);
  });

  test.describe('phone', () => {
    test.use({isMobile: true, hasTouch: true, viewport: {width: 374, height: 705}});

    test('phone: every step, transition and figure of a passive-radiator project against the E150HE and E150HE-PR records', async ({page}) => {
      await forceMobileSkin(page);
      await page.goto('/');
      await walk(page, PHONE);
    });
  });
});
