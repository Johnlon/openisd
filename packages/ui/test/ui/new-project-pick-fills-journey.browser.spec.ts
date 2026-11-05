import {expect, openTab, test, editorTab, openDriverEditor} from '../fixtures.js';
import type {Locator, Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import type {BoxType} from '@openisd/design/engine';
import {NumberField, PhoneWizardText} from '@openisd/design/fields';
import {forceMobileSkin, mobileFieldRow} from '../fixtures/mobileSkin.js';
import {readPassiveRadiatorTab} from '../fixtures/passiveRadiatorScreen.js';

/**
 * Journey (QO326): from an empty app, make a new project of each box type with a real bundled driver, and for
 * the passive-radiator box also a real bundled radiator. Every box the screen shows for the driver or the radiator
 * must hold the figure the bundled record states, in both skins (desktop 1280x800, phone 374x705).
 * The expected figures are read from the record file and formatted by the design formatter the screen uses;
 * the observed figures are read from the screen. Nothing is seeded, no state object is read, no reload.
 */

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

const entry = z.object({value: z.unknown().optional()});
const recordSchema = z.object({
  brand: z.object({value: z.string()}),
  model: z.object({value: z.string()}),
  specs: z.record(z.string(), z.record(z.string(), entry)),
});
const indexSchema = z.array(z.object({path: z.string(), name: z.string()}));

interface Record_ {
  readonly brand: string;
  readonly model: string;
  readonly listName: string;
  figure(key: string): number | null;
}

function loadRecord(path: string, indexFile: string): Record_ {
  const parsed = recordSchema.parse(JSON.parse(readFileSync(join(PUBLIC, 'drivers', `${path}.json`), 'utf8')));
  const row = indexSchema.parse(JSON.parse(readFileSync(join(PUBLIC, indexFile), 'utf8'))).find(r => r.path === path);
  if (row === undefined) throw new Error(`${path} is not in ${indexFile}`);
  const group = parsed.specs['woofer'] ?? Object.values(parsed.specs).find(g => Object.keys(g).length > 0) ?? {};
  return {
    brand: parsed.brand.value, model: parsed.model.value, listName: row.name,
    figure: key => {
      const v = group[key]?.value;
      return typeof v === 'number' ? v : null;
    },
  };
}

function required(record: Record_, key: string): number {
  const v = record.figure(key);
  if (v === null) throw new Error(`the catalogue record states no ${key}`);
  return v;
}

interface Figure { readonly label: string; readonly key: string; readonly field: NumberField }

/** The driver editor's Parameters boxes (desktop). */
const EDITOR_FIGURES: readonly Figure[] = [
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
  {label: 'Mms', key: 'Mms_kg', field: NumberField.MMS_KG},
  {label: 'Cms', key: 'Cms_m_per_N', field: NumberField.CMS_M_PER_N},
  {label: 'Rms', key: 'Rms_kg_per_s', field: NumberField.RMS_KG_PER_S},
  {label: 'Dd', key: 'Dd_m', field: NumberField.DD_M},
];

/** The phone Driver tab's key figures. */
const PHONE_FIGURES = EDITOR_FIGURES.filter(f => ['Fs', 'Qts', 'Vas', 'Re', 'Xmax'].includes(f.label));

interface Case {
  readonly box: BoxType;
  readonly driver: string;
  readonly radiator: {readonly path: string; readonly pickText: string} | null;
}

/** The test build bundles 11 records (fixtures/test-bundle-paths.json); the cases use those. */
const CASES: readonly Case[] = [
  {box: 'sealed', driver: 'dayton-audio/e150he-44', radiator: null},
  {box: 'vented', driver: 'tang-band/w5-1138smf', radiator: null},
  {box: 'box-passive-radiator', driver: 'dayton-audio/e150he-44', radiator: {path: 'dayton-audio/e150he-pr', pickText: 'E150HE-PR'}},
  {box: 'box-passive-radiator', driver: 'dayton-audio/e180he-44', radiator: {path: 'dayton-audio/e180he-pr', pickText: 'E180HE-PR'}},
  {box: 'box-passive-radiator', driver: 'faitalpro/10fe200-4', radiator: {path: 'dayton-audio/nd140-pr', pickText: 'ND140-PR'}},
  {box: 'bandpass4', driver: 'eminence/sigma-pro-18a', radiator: null},
  {box: 'bandpass6', driver: 'faitalpro/12pr300-8', radiator: null},
  {box: 'abc', driver: 'dayton-audio/cx120-8', radiator: null},
];


/** The labels of the number boxes inside `scope` that hold no value. A box's label is its field key or its row label. */
async function blankBoxes(scope: Locator): Promise<string[]> {
  return scope.evaluateAll(roots => roots.flatMap(root => Array.from(root.querySelectorAll('input'))
    .filter(i => (i.type === 'text' || i.type === 'number') && i.inputMode !== 'text' && i.value.trim() === '' && !i.disabled && i.offsetParent !== null)
    .map(i => i.closest('[data-field-key]')?.getAttribute('data-field-key') ?? i.closest('.mob-field-row, .ui-field')?.textContent?.trim().slice(0, 30) ?? i.id)));
}

async function runJourney(page: Page, phone: boolean, c: Case, blanks: boolean): Promise<void> {
  const driver = loadRecord(c.driver, 'drivers-index.json');
  const radiator = c.radiator === null ? null : loadRecord(c.radiator.path, 'passive-radiators-index.json');
  const root = page.locator(phone ? '.mob-np-overlay' : '.overlay.open');
  const footer = phone ? page.locator('.mob-np-footer') : page.locator('.overlay.open .modal-footer');
  const next = footer.getByRole('button', {name: phone ? PhoneWizardText.NEXT : 'Next', exact: true});
  const create = footer.getByRole('button', {name: phone ? PhoneWizardText.CREATE : 'Create', exact: true});

  if (phone) await page.getByText('New project').click();
  else await page.locator('.tb-btn[title*="New project"]').click();
  await expect(root).toBeVisible();

  // A person finds a driver by typing its model into the search box.
  const modelToken = driver.model.split(' ')[0] ?? driver.model;
  await root.locator('input.filter').fill(modelToken);
  await root.locator('.dlist .ditem', {hasText: modelToken}).first().click();
  await expect(root.locator('.preview .prev-name')).toContainText(driver.model);
  // Every figure the preview draws equals the record's.
  for (const f of EDITOR_FIGURES.filter(e => ['Fs', 'Qts', 'Qes', 'Qms', 'Re', 'BL', 'Le', 'Vas', 'Sd', 'Xmax', 'Pe'].includes(e.label))) {
    if ((driver.figure(f.key) ?? 0) === 0) continue; // the preview draws only the figures a record states
    const row = root.locator('.preview .spec-row', {has: page.locator('.spec-lbl', {hasText: new RegExp(`^${f.label}$`)})});
    await expect.soft(row.locator('.spec-val b'), `preview ${f.label}`).toHaveText(f.field.format(required(driver, f.key)));
  }
  await next.click();
  await next.click();
  await root.locator('#np-box-type').selectOption(c.box);
  await next.click();

  if (radiator !== null && c.radiator !== null) {
    await root.locator('#np-pr-select').click();
    await page.locator('.pr-lib-item .pr-lib-name', {hasText: c.radiator.pickText}).first().click();
    await expect(root.locator('#np-pr-name')).toHaveValue(radiator.model);
    const boxes: readonly [string, string, NumberField][] = [
      ['#np-pr-vas', 'Vas_m3', NumberField.PR_VAS_L], ['#np-pr-qms', 'Qms', NumberField.PR_QMS],
      ['#np-pr-fs', 'Fs_hz', NumberField.PR_FS_HZ], ['#np-pr-sd', 'Sd_m2', NumberField.PR_SD_CM2],
    ];
    for (const [id, key, field] of boxes) {
      await expect.soft(root.locator(id), `wizard radiator ${id} has a value`).toHaveValue(/\d/);
      await expect.soft(root.locator(id), `wizard radiator ${id}`).toHaveValue(field.format(required(radiator, key)));
    }
    const xmaxKey = radiator.figure('Xmax_m') !== null ? 'Xmax_m' : 'Xlim_m';
    await expect.soft(root.locator('#np-pr-xmax'), 'wizard radiator Xmax has a value').toHaveValue(/\d/);
    await expect.soft(root.locator('#np-pr-xmax'), 'wizard radiator Xmax').toHaveValue(NumberField.PR_XMAX_MM.format(required(radiator, xmaxKey)));
  }
  await next.click();
  await create.click();
  await expect(root).toHaveCount(0);

  // The project's Driver tab: every box holds the record's figure.
  await openTab(page, 'Driver');
  if (phone) {
    if (blanks) expect.soft(await blankBoxes(page.locator('.mobile-root')), 'phone Driver tab: boxes left blank').toEqual([]);
    for (const f of PHONE_FIGURES) {
      const box = mobileFieldRow(page, f.label).locator('input').first();
      await expect.soft(box, `driver ${f.label} has a value`).toHaveValue(/\d/);
      await expect.soft(box, `driver ${f.label}`).toHaveValue(f.field.format(required(driver, f.key)));
    }
  } else {
    await openDriverEditor(page);
    await editorTab(page, 'Parameters');
    if (blanks) expect.soft(await blankBoxes(page.locator('.de-body')), 'driver editor Parameters: boxes left blank').toEqual([]);
    for (const f of EDITOR_FIGURES) {
      if (driver.figure(f.key) === null) continue;
      const box = page.locator(`.de-body [data-field-key="${f.key}"] input`).first();
      await expect.soft(box, `driver editor ${f.label} has a value`).toHaveValue(/\d/);
      expect.soft(Number(await box.inputValue()), `driver editor ${f.label}`).toBeCloseTo(Number(f.field.format(required(driver, f.key))), 2);
    }
    await page.locator('.de-footer button', {hasText: 'Cancel'}).click();
    await page.locator('.de-body').waitFor({state: 'hidden'});
  }

  if (radiator !== null) {
    if (phone) await openTab(page, 'Box');
    if (blanks) expect.soft(await blankBoxes(phone ? page.locator('.mobile-root') : page.locator('.tab-section.active')), 'passive radiator page: boxes left blank').toEqual([]);
    const shown = await readPassiveRadiatorTab(page);
    const num = (field: NumberField, key: string) => Number(field.format(required(radiator, key)));
    const xmaxKey = radiator.figure('Xmax_m') !== null ? 'Xmax_m' : 'Xlim_m';
    expect.soft(shown.name, 'PR name').toBe(radiator.model);
    expect.soft(shown.vas_L, 'PR Vas').toBe(num(NumberField.PR_VAS_L, 'Vas_m3'));
    expect.soft(shown.qms, 'PR Qms').toBe(num(NumberField.PR_QMS, 'Qms'));
    expect.soft(shown.fs_hz, 'PR Fs').toBe(num(NumberField.PR_FS_HZ, 'Fs_hz'));
    expect.soft(shown.sd_cm2, 'PR Sd').toBe(num(NumberField.PR_SD_CM2, 'Sd_m2'));
    expect.soft(shown.xmax_mm, 'PR Xmax').toBe(num(NumberField.PR_XMAX_MM, xmaxKey));
  }
}

const BLANK_BOXES_BUG = 'BUG_20261105_driver-editor-parameter-boxes-blank-after-pick';

test.describe('Journey: pick a bundled driver and radiator, every box fills', () => {
  for (const c of CASES) {
    const title = `${c.box} / ${c.driver}${c.radiator === null ? '' : ` + ${c.radiator.path}`}`;

    test(`desktop: ${title}`, async ({appPage: page}) => {
      await runJourney(page, false, c, false);

      await expect(page.locator('.overlay.open'), 'the wizard is closed').toHaveCount(0);
    });

    test(`desktop: every box holds a value: ${title}`, async ({appPage: page}) => {
      test.fail(true, BLANK_BOXES_BUG);
      await runJourney(page, false, c, true);

      await expect(page.locator('.overlay.open'), 'the wizard is closed').toHaveCount(0);
    });

    test.describe('phone', () => {
      test.use({isMobile: true, hasTouch: true, viewport: {width: 374, height: 705}});

      test(`phone: ${title}`, async ({page}) => {
        await forceMobileSkin(page);
        await page.goto('/');
        await runJourney(page, true, c, false);

        await expect(page.locator('.mob-np-overlay'), 'the wizard is closed').toHaveCount(0);
      });

      test(`phone: every box holds a value: ${title}`, async ({page}) => {
        await forceMobileSkin(page);
        await page.goto('/');
        await runJourney(page, true, c, true);

        await expect(page.locator('.mob-np-overlay'), 'the wizard is closed').toHaveCount(0);
      });
    });
  }
});
