import {readFileSync} from 'node:fs';
import {expect, exportedProjectOwpr, forEachEditorTab, openAProject, openDriverEditor, test} from '../fixtures.js';
import {setFocusedBoxType} from '../fixtures.js';
import {NumberField, UNIT_GROUPS} from '@openisd/design/fields';
import {OpenISDDriver} from '@openisd/design';
import {createEngine, DEFAULT_VENTED_DESIGN_LIMITS, FixedAir} from '@openisd/design/engine';
import {DRIVER_SPEC_FIELD_NAMES, type NumericDriverSpecFieldName} from '../../../design/domain/driver/driverSpecFieldName.js';
import {z} from 'zod';

const BUNDLE_PATHS = z.string().array().parse(JSON.parse(readFileSync('packages/ui/test/fixtures/test-bundle-paths.json', 'utf8')));
const DRIVER_BUNDLE_PATHS = BUNDLE_PATHS.filter(path => !path.endsWith('-pr'));
const PR_BUNDLE_PATHS = BUNDLE_PATHS.filter(path => path.endsWith('-pr'));

const EXPECTED_REPORTED_COIL_VALUES: Record<string, Record<string, Record<string, number>>> = {
  'tang-band/w5-1138smf': {woofer: {Re_ohm: 3.4, BL_Tm: 7.17}},
  'dayton-audio/e150he-44': {woofer: {Re_ohm: 6.6, BL_Tm: 9.8}},
  'dayton-audio/e180he-44': {woofer: {Re_ohm: 6.8, BL_Tm: 9.6}},
  'dayton-audio/cx120-8': {woofer: {Re_ohm: 6.22, BL_Tm: 5.08}, tweeter: {Re_ohm: 5.6}},
  'dayton-audio/nd140-pr': {},
  'dayton-audio/e150he-pr': {},
  'dayton-audio/e180he-pr': {},
  'eminence/sigma-pro-18a': {woofer: {Re_ohm: 6.29, BL_Tm: 22.1}},
  'faitalpro/10fe200-4': {woofer: {Re_ohm: 3, BL_Tm: 7}},
  'faitalpro/12pr300-8': {woofer: {Re_ohm: 5.4, BL_Tm: 14.1}},
  'sb-acoustics/sb15bac30-8-coax-aluminum': {woofer: {Re_ohm: 5.7, BL_Tm: 5.3}, tweeter: {Re_ohm: 3.8}},
};
const NUMERIC_DRIVER_NAMES = DRIVER_SPEC_FIELD_NAMES.filter(
  (key): key is NumericDriverSpecFieldName => key !== 'VCCon',
);

const SpecEntrySchema = z.object({
  state: z.enum(['E', 'C', 'N']),
  value: z.union([z.number(), z.string()]).optional(),
  readings: z.record(z.string(), z.object({actual_reading: z.string()}).passthrough()).optional(),
}).passthrough();
const DriverRecordSchema = z.object({
  model: z.object({value: z.string()}),
  specs: z.record(z.string(), z.record(z.string(), SpecEntrySchema)),
});
type SpecEntry = z.infer<typeof SpecEntrySchema>;
type DriverRecord = z.infer<typeof DriverRecordSchema>;

function bundledRecord(path: string): DriverRecord {
  return DriverRecordSchema.parse(JSON.parse(readFileSync(`packages/ui/public/drivers/${path}.json`, 'utf8')));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function entryState(value: unknown): string {
  return isRecord(value) ? String(value.state) : value === undefined ? 'N' : 'invalid';
}

function entryValue(value: unknown): unknown {
  return isRecord(value) ? value.value : undefined;
}

function expectedState(key: string, source: SpecEntry, radiator: boolean): string {
  return radiator && source.state === 'E' && PR_FIELDS_DERIVED_FROM_WINISD_FIGURES.has(key)
    ? 'C'
    : source.state;
}

function visibleNumber(cell: unknown, field: NumberField | undefined, unitLabel: string): string {
  const value = entryValue(cell);
  const precision = isRecord(cell) && typeof cell.precision === 'number' ? cell.precision : null;
  const token = field?.display.kind === 'switchable'
    ? UNIT_GROUPS[field.display.group].find(unit => unit.label === unitLabel)?.token
    : undefined;
  if (typeof value === 'number' && field !== undefined) return field.format(value, precision, token);
  return String(Array.isArray(value) ? value[0] ?? '' : value ?? '');
}

function numericEntry(value: unknown, name: string): number {
  const number = entryValue(value);
  if (typeof number !== 'number') throw new Error(`${name} is not numeric in the bundled record`);
  return number;
}

function numericValueOrNull(value: unknown): number | null {
  const number = entryValue(value);
  return typeof number === 'number' ? number : null;
}

function selectedDriverSpecs(project: unknown): Record<string, Record<string, unknown>> {
  if (!isRecord(project) || !isRecord(project.saved)
    || !isRecord(project.saved.driverEmbedding) || !isRecord(project.saved.driverEmbedding.device)
    || !isRecord(project.saved.driverEmbedding.device.specs)) {
    throw new Error('exported project has no embedded driver spec records');
  }
  const sections: Record<string, Record<string, unknown>> = {};
  for (const [name, value] of Object.entries(project.saved.driverEmbedding.device.specs)) {
    if (!isRecord(value)) throw new Error(`exported project has an invalid ${name} spec section`);
    sections[name] = value;
  }
  return sections;
}

function detachedEditorSpecs(project: unknown): Record<string, unknown> {
  if (!isRecord(project) || !isRecord(project.saved) || !isRecord(project.saved.driverEmbedding)
    || !isRecord(project.saved.driverEmbedding.device)) {
    throw new Error('exported project has no embedded driver record for the editor draft');
  }
  const driver = OpenISDDriver.fromConformingRecord(project.saved.driverEmbedding.device, createEngine());
  if (Array.isArray(driver)) throw new Error(`exported driver cannot open in editor: ${driver.join(', ')}`);
  return Object.fromEntries(NUMERIC_DRIVER_NAMES.map(key => {
    const field = driver.specField(key);
    return [key, {
      state: field.entered ? 'E' : field.calculated ? 'C' : 'N',
      value: field.value,
      precision: field.precision,
    }];
  }));
}

function projectAirValues(project: unknown) {
  if (!isRecord(project) || !isRecord(project.saved) || !isRecord(project.saved.environment)) {
    throw new Error('exported project has no environment for driver resolution');
  }
  const environment = project.saved.environment;
  return {
    c: numericEntry(environment.c_m_per_s, 'environment.c_m_per_s'),
    rho: numericEntry(environment.roo_kg_per_m3, 'environment.roo_kg_per_m3'),
  };
}

function projectAir(project: unknown) {
  return new FixedAir(projectAirValues(project));
}

function projectEngine(project: unknown) {
  if (!isRecord(project) || !isRecord(project.saved) || !isRecord(project.saved.environment)) {
    throw new Error('exported project has no environment for driver resolution');
  }
  const environment = project.saved.environment;
  return createEngine({
    ventedLimits: () => DEFAULT_VENTED_DESIGN_LIMITS,
    envDefaults: () => ({
      tempK: numericEntry(environment.temperature_K, 'environment.temperature_K'),
      humidityPct: numericEntry(environment.humidity_pct, 'environment.humidity_pct'),
      pressurePa: numericEntry(environment.pressure_Pa, 'environment.pressure_Pa'),
    }),
  });
}

function freshlyResolvedBundleSpecs(path: string, project: unknown): Record<string, unknown> {
  const bundled: unknown = JSON.parse(readFileSync(`packages/ui/public/drivers/${path}.json`, 'utf8'));
  const driver = OpenISDDriver.fromConformingRecord(bundled, projectEngine(project));
  if (Array.isArray(driver)) throw new Error(`bundled driver cannot be resolved: ${driver.join(', ')}`);
  const resolved: Record<string, unknown> = Object.fromEntries(NUMERIC_DRIVER_NAMES.map(key => {
    const field = driver.specField(key);
    return [key, {
      state: field.entered ? 'E' : field.calculated ? 'C' : 'N',
      value: field.value,
      precision: field.precision,
    }];
  }));
  resolved.__freshAir = {
    c: driver.specs.c_m_per_s.value,
    rho: driver.specs.roo_kg_per_m3.value,
    Vd_m3: driver.specs.Vd_m3.value,
  };
  return resolved;
}

function selectedRadiatorSpecs(project: unknown): Record<string, unknown> {
  if (!isRecord(project) || !isRecord(project.saved) || !isRecord(project.saved.box)
    || !isRecord(project.saved.box.passiveRadiator) || !isRecord(project.saved.box.passiveRadiator.component)
    || !isRecord(project.saved.box.passiveRadiator.component.specs)
    || !isRecord(project.saved.box.passiveRadiator.component.specs['passive-radiator'])) {
    throw new Error('exported project has no embedded passive-radiator spec record');
  }
  return project.saved.box.passiveRadiator.component.specs['passive-radiator'];
}

const PR_DERIVED_FIELD_KEYS = ['Cms_m_per_N', 'Mms_kg', 'Rms_kg_per_s'] as const;
const PR_FIELDS_DERIVED_FROM_WINISD_FIGURES = new Set<string>(PR_DERIVED_FIELD_KEYS);

function expectedWinisdRadiatorValues(source: Record<string, SpecEntry>, project: unknown) {
  return createEngine().pr.solveSpec({
    Fs_hz: numericValueOrNull(source.Fs_hz),
    Qms: numericValueOrNull(source.Qms),
    Vas_m3: numericValueOrNull(source.Vas_m3),
    Sd_m2: numericValueOrNull(source.Sd_m2),
    Mms_kg: null,
    Cms_m_per_N: null,
    Rms_kg_per_s: null,
  }, projectAir(project));
}

function expectDerivedRadiatorValue(model: string, key: typeof PR_DERIVED_FIELD_KEYS[number], expected: number | null,
  actual: Record<string, unknown>): void {
  const value = entryValue(actual[key]);
  expect(entryState(actual[key]), `${model}.${key} has the wrong derived state`).toBe(expected === null ? 'N' : 'C');
  if (expected === null) {
    expect(value, `${model}.${key} became populated without sufficient primary figures`).toBeUndefined();
  } else {
    expect(value, `${model}.${key} is not numeric`).toEqual(expect.any(Number));
    expect(value, `${model}.${key} does not match the WinISD primary figures`).toBeCloseTo(expected, 12);
  }
}

function expectEverySourceField(
  model: string,
  expected: Record<string, SpecEntry>,
  actual: Record<string, unknown>,
  freshlyResolved: Record<string, unknown>,
  radiator = false,
  projectAirForDiagnostics?: {c: number; rho: number},
): void {
  const missing = Object.entries(expected)
    .filter(([key, field]) => field.state !== 'N' && !(key in actual))
    .map(([key]) => key);
  expect(missing, `${model} lost bundled parameter keys`).toEqual([]);

  for (const [key, source] of Object.entries(expected)) {
    const cell = actual[key];
    expect(entryState(cell), `${model}.${key} changed its Entered/Calculated/Not available state`)
      .toBe(expectedState(key, source, radiator));
    const retainedEnteredValue = source.state !== 'E' || expectedState(key, source, radiator) === 'C'
      || Object.is(entryValue(cell), source.value);
    expect(retainedEnteredValue, `${model}.${key} changed its bundled entered value`).toBe(true);
    const requiresCalculation = source.state === 'C'
      || expectedState(key, source, radiator) === 'C';
    const calculatedValue = entryValue(cell);
    expect(!requiresCalculation || (typeof calculatedValue === 'number' && Number.isFinite(calculatedValue)),
      `${model}.${key} has no finite calculated value`).toBe(true);
    if (source.state === 'C' && expectedState(key, source, radiator) === 'C' && key !== 'VCCon') {
      const fresh = entryValue(freshlyResolved[key]);
      expect(typeof fresh, `${model}.${key} fresh calculation is not numeric`).toBe('number');
      if (typeof fresh === 'number' && typeof calculatedValue === 'number') {
        const diagnostic = key === 'SPLmaxLF_dB'
          ? `; project air=${JSON.stringify(projectAirForDiagnostics)}, fresh air=${JSON.stringify(freshlyResolved.__freshAir)}, selected air=${JSON.stringify({
              c: entryValue(actual.c_m_per_s), rho: entryValue(actual.roo_kg_per_m3),
              Vd_m3: entryValue(actual.Vd_m3),
            })}`
          : '';
        expect(calculatedValue, `${model}.${key} does not match a fresh calculation from the bundled input values${diagnostic}`)
          .toBeCloseTo(fresh, 12);
      }
    }
    if (source.state === 'N' && source.readings !== undefined) {
      expect(isRecord(cell) ? cell.readings : undefined,
        `${model}.${key} lost its published readings while selecting the device`).toEqual(source.readings);
    }
  }
}

function expectEveryAdditionalSectionField(model: string, section: string,
  expected: Record<string, SpecEntry>, actual: Record<string, unknown>): void {
  expect(actual, `${model} lost its ${section} specification section`).toBeDefined();
  for (const [key, source] of Object.entries(expected)) {
    const cell = actual[key];
    expect(entryState(cell), `${model}.${section}.${key} changed its source state`)
      .toBe(source.state);
    if (source.value !== undefined) {
      expect(entryValue(cell), `${model}.${section}.${key} changed its source value`)
        .toEqual(source.value);
    }
    if (source.state === 'N' && source.readings !== undefined) {
      expect(isRecord(cell) ? cell.readings : undefined,
        `${model}.${section}.${key} lost its published readings`).toEqual(source.readings);
    }
  }
}

test.describe('Original driver bundle selection', () => {
  for (const path of DRIVER_BUNDLE_PATHS) {
    const source = bundledRecord(path);

    test(`${source.model.value}: Use keeps every bundled parameter and its state`, async ({page}) => {
      await page.goto('/');
      await openAProject(page);
      await page.locator('.project-nav li', {hasText: /^Driver$/}).click();
      await page.getByRole('button', {name: 'Select driver', exact: false}).click();

      const model = source.model.value;
      await page.locator('.driver-library input.filter').fill(model);
      const row = page.locator('.dlist .ditem:not(.my-ditem)').filter({hasText: model}).first();
      await expect(row, `${model} is absent from the bundled picker`).toBeVisible();
      await row.locator('b').click();
      const summary = page.locator('.driver-library .preview');
      await expect(summary, `${model} summary did not open`).toBeVisible();
      await summary.locator('.use-btn').click();
      await expect(summary, `${model} was not selected`).toBeHidden();

      await exportedProjectOwpr(page);
      await page.reload();
      const exported = await exportedProjectOwpr(page);
      const actualSections = selectedDriverSpecs(exported);
      for (const [section, expectedFields] of Object.entries(EXPECTED_REPORTED_COIL_VALUES[path])) {
        for (const [key, value] of Object.entries(expectedFields)) {
          expect(entryState(source.specs[section]?.[key]), `${model}.${section}.${key} is not entered in the bundle`).toBe('E');
          expect(entryValue(source.specs[section]?.[key]), `${model}.${section}.${key} lost its published number in the bundle`).toBe(value);
          expect(entryState(actualSections[section]?.[key]), `${model}.${section}.${key} was not entered after selection`).toBe('E');
          expect(entryValue(actualSections[section]?.[key]), `${model}.${section}.${key} changed after selection`).toBe(value);
        }
      }
      expect(Object.keys(actualSections).sort(), `${model} changed its published spec sections`)
        .toEqual(Object.keys(source.specs).sort());
      const additionalSections = Object.entries(source.specs).filter(([section]) => section !== 'woofer');
      for (const [section, sourceFields] of additionalSections) {
        expectEveryAdditionalSectionField(model, section, sourceFields, actualSections[section] ?? {});
      }
      const actual = actualSections.woofer;
      expect(actual, `${model} has no embedded woofer spec section`).toBeDefined();
      const editorSpecs = detachedEditorSpecs(exported);
      expectEverySourceField(model, source.specs.woofer, actual, freshlyResolvedBundleSpecs(path, exported), false, projectAirValues(exported));

      await openDriverEditor(page);
      const unresolvedCoilKeys = ['Re_ohm', 'BL_Tm'].filter(key =>
        source.specs.woofer[key]?.state === 'N' && source.specs.woofer[key]?.readings !== undefined);
      for (const key of ['Re_ohm', 'BL_Tm'] as const) {
        const field = page.locator(`.de-fld[data-field-key="${key}"]`);
        const button = field.locator('.ui-field-dq-btn');
        const warningText = await button.getAttribute('title').catch(() => null);
        const warnsOfUnknownBasis = warningText?.includes('voice-coil count or basis is not specified') ?? false;
        expect(warnsOfUnknownBasis, `${model}.${key} warning must match its source voice-coil basis`)
          .toBe(unresolvedCoilKeys.includes(key));
      }
      const renderedValues: Record<string, {value: string; unit: string; state: string}> = {};
      await forEachEditorTab(page, async (_tab, _labels) => {
        const fields = await page.locator('.de-body .de-fld[data-field-key]').evaluateAll(elements =>
          elements.map(element => ({
            key: element.getAttribute('data-field-key') ?? '',
            input: (() => {
              const input = element.querySelector<HTMLInputElement | HTMLSelectElement>('input, select');
              const stateClass = (target: Element | null): string => target?.classList.contains('value-e') ? 'E'
                : target?.classList.contains('value-c') ? 'C'
                  : target?.classList.contains('value-n') ? 'N' : 'unknown';
              return {
                value: input?.value ?? '',
                state: stateClass(element) !== 'unknown' ? stateClass(element) : stateClass(input),
              };
            })(),
            unit: element.querySelector<HTMLElement>('.unit-label')?.textContent?.trim() ?? '',
          })));
        for (const field of fields) renderedValues[field.key] = {
          value: field.input.value,
          unit: field.unit,
          state: field.input.state,
        };
      });
      const uiSpecKeys = Object.keys(source.specs.woofer)
        .filter(key => NumberField.named(key) !== undefined);
      const missingUiFields = uiSpecKeys.filter(key => !(key in renderedValues));
      const wrongUiValues = uiSpecKeys.filter(key =>
        renderedValues[key]?.value !== visibleNumber(editorSpecs[key], NumberField.named(key), renderedValues[key]?.unit ?? ''));
      const wrongUiStates = uiSpecKeys.filter(key => renderedValues[key]?.state !== source.specs.woofer[key]?.state);
      expect(missingUiFields, `${model} editor does not expose every bundled parameter`).toEqual([]);
      expect(wrongUiStates.map(key => ({key, rendered: renderedValues[key]?.state, bundled: source.specs.woofer[key]?.state})),
        `${model} editor changed a bundled field's Entered/Calculated/Not available state`).toEqual([]);
      expect(wrongUiValues.map(key => ({key, rendered: renderedValues[key], editor: editorSpecs[key], formatted: visibleNumber(editorSpecs[key], NumberField.named(key), renderedValues[key]?.unit ?? '')})),
        `${model} editor values do not match the detached editor driver's resolved data`).toEqual([]);
    });
  }

  for (const path of PR_BUNDLE_PATHS) {
    const source = bundledRecord(path);

    test(`${source.model.value}: selecting a bundled radiator keeps every parameter and its state`, async ({page}) => {
      await page.goto('/');
      await openAProject(page);
      await setFocusedBoxType(page, 'box-passive-radiator');
      await page.locator('.project-nav li', {hasText: /^Passive Radiator$/}).click();
      await page.getByRole('button', {name: 'Select passive radiator', exact: true}).click();

      const model = source.model.value;
      const picker = page.locator('.modal');
      await picker.locator('.pr-filter').fill(model);
      const row = picker.locator('.pr-lib-item').filter({hasText: model}).last();
      await expect(row, `${model} is absent from the bundled radiator picker`).toBeVisible();
      await row.locator('.pr-lib-name').click();
      await expect(page.locator('.pr-lib'), `${model} was not loaded`).toHaveCount(0);

      await exportedProjectOwpr(page);
      await page.reload();
      const exported = await exportedProjectOwpr(page);
      const actual = selectedRadiatorSpecs(exported);
      expectEverySourceField(model, source.specs['passive-radiator'], actual, {}, true);
      const expectedDerived = expectedWinisdRadiatorValues(source.specs['passive-radiator'], exported);
      for (const key of PR_DERIVED_FIELD_KEYS) expectDerivedRadiatorValue(model, key, expectedDerived[key], actual);

      const displayedFields = [
        ['Fs_hz', '#og-pr-fs', NumberField.PR_FS_HZ], ['Qms', '#og-pr-qms', NumberField.PR_QMS],
        ['Vas_m3', '#og-pr-vas', NumberField.PR_VAS_L],
        ['Sd_m2', 'label.ui-field-label:text-is("Sd") ~ .ui-field-value input', NumberField.PR_SD_CM2],
        ['Mms_kg', '#og-pr-mms', NumberField.MMS_KG], ['Cms_m_per_N', '#og-pr-cms', NumberField.CMS_M_PER_N],
        ['Xmax_m', 'label.ui-field-label:text-is("Xmax") ~ .ui-field-value input', NumberField.PR_XMAX_MM],
      ] as const;
      const shown = await Promise.all(displayedFields.map(async ([key, selector, field]) => ({
        key,
        value: await page.locator(selector).inputValue(),
        unit: await page.locator(selector).evaluate(element =>
          element.closest('.field')?.querySelector('.unit-label')?.textContent?.trim() ?? ''),
        field,
      })));
      const wrongDisplayedValues = shown.filter(item =>
        item.value !== visibleNumber(actual[item.key], item.field, item.unit)).map(item => item.key);
      expect(wrongDisplayedValues, `${model} page values do not match the embedded project data`).toEqual([]);
    });
  }
});
