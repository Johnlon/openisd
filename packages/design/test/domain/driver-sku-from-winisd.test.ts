/**
 * The driver's short code (`sku`): a WinISD file states none, so an import stores '' (QO259);
 * a saved project that carries an import's placeholder is repaired on load; a driver that
 * states a code keeps it through save, load and export/import.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {DriverRecordConverter} from '../../domain/driverRecordConverter.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const engine = createEngine();
const wprText = readFileSync(join(here, '..', 'winisd', 'fixtures', 'abc-w5-1.wpr'), 'utf8');
const prWprText = readFileSync(join(here, '..', 'winisd', 'fixtures', 'pr-w5-1.wpr'), 'utf8');
const wdrText = readFileSync(join(here, '..', 'fixtures', 'dual-coil', 'e150he-44-series.wdr'), 'utf8');

function projectFromWpr(text: string): OpenISDProject {
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  return value;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The embedded driver's device record of one project state. */
function deviceOf(state: unknown): Record<string, unknown> {
  if (!isRecord(state) || !isRecord(state.driverEmbedding) || !isRecord(state.driverEmbedding.device)) throw new Error('no embedded driver');
  return state.driverEmbedding.device;
}

/** `.owpr` text with the embedded driver's sku (both states) replaced by `sku` grounded 'manual'. */
function withSku(text: string, sku: string, model?: string): string {
  const session: unknown = JSON.parse(text);
  if (!isRecord(session)) throw new Error('not a session');
  for (const state of [session.saved, session.edited]) {
    if (state === null) continue;
    const device = deviceOf(state);
    device.sku = {value: sku, grounds: [{origin: 'manual', reading: sku}]};
    if (model !== undefined) device.model = {value: model};
  }
  return JSON.stringify(session);
}

function loaded(text: string): OpenISDProject {
  const r = OpenISDProject.fromOwprTextRepairing(text, engine);
  if (Array.isArray(r)) throw new Error('refused: ' + r.join('; '));
  return r.project;
}

describe('driver sku from WinISD files', () => {
  it('a .wdr import has no sku', () => {
    const {value} = new DriverRecordConverter(engine).winIsdDriverToOpenIsdDriver(wdrText);
    expect(value?.sku.value).toBe('');
  });

  it('a .wpr import has no sku on its driver', () => {
    expect(projectFromWpr(wprText).driver.sku.value).toBe('');
  });

  it('a .wpr passive-radiator import has no sku on its radiator', () => {
    expect(JSON.stringify(JSON.parse(projectFromWpr(prWprText).toOwprText()))).not.toContain('WPR-IMPORT');
  });
});

describe('a saved project with an import placeholder sku', () => {
  it('WPR-IMPORT loads as no sku', () => {
    const text = withSku(projectFromWpr(wprText).toOwprText(), 'WPR-IMPORT');
    expect(loaded(text).driver.sku.value).toBe('');
  });

  it('a sku equal to the model text loads as no sku', () => {
    const text = withSku(projectFromWpr(wprText).toOwprText(), 'ZZ-111111', 'ZZ-111111');
    expect(loaded(text).driver.sku.value).toBe('');
  });

  it('a sku that differs from the model keeps it', () => {
    const text = withSku(projectFromWpr(wprText).toOwprText(), 'ZZ-111111', 'other model');
    expect(loaded(text).driver.sku.value).toBe('ZZ-111111');
  });

  it('the repair is reported', () => {
    const text = withSku(projectFromWpr(wprText).toOwprText(), 'WPR-IMPORT');
    const r = OpenISDProject.fromOwprTextRepairing(text, engine);
    if (Array.isArray(r)) throw new Error(r.join('; '));
    expect(r.repaired.length).toBeGreaterThan(0);
  });
});

describe('a typed or db sku survives', () => {
  it('a project keeps a typed sku through stored text and .owpr text', () => {
    const p = projectFromWpr(wprText);
    p.driver.sku.set('ZZ-222222');
    p.save();
    expect(loaded(p.toStoredText()).driver.sku.value).toBe('ZZ-222222');
    expect(loaded(p.toOwprText()).driver.sku.value).toBe('ZZ-222222');
  });

  it('a driver keeps its sku through openisd.json export and import', () => {
    const {value} = new DriverRecordConverter(engine).winIsdDriverToOpenIsdDriver(wdrText);
    if (value === null) throw new Error('import failed');
    value.sku.set('ZZ-333333');
    const back = OpenISDDriver.fromOwdrText(value.toOwdrText(), engine);
    if (Array.isArray(back)) throw new Error(back.join('; '));
    expect(back.sku.value).toBe('ZZ-333333');
  });
});

describe('a library driver saved with an import placeholder sku', () => {
  /** A stored driver record whose sku is `sku` grounded 'manual' and whose model is `model`. */
  function storedRecord(sku: string, model: string, origin: string): unknown {
    const {value} = new DriverRecordConverter(engine).winIsdDriverToOpenIsdDriver(wdrText);
    if (value === null) throw new Error('import failed');
    const record: unknown = JSON.parse(value.toOwdrText());
    if (!isRecord(record)) throw new Error('not a record');
    record.sku = {value: sku, grounds: [{origin, reading: sku}]};
    record.model = {value: model};
    record.uuid = {value: '00000000-0000-4000-8000-000000000009'};
    return record;
  }

  function opened(record: unknown): OpenISDDriver {
    const d = OpenISDDriver.fromConformingRecord(record, engine);
    if (Array.isArray(d)) throw new Error(d.join('; '));
    return d;
  }

  it('a sku equal to the model, grounded only manual, opens as no sku', () => {
    expect(opened(storedRecord('ZZ-111111', 'ZZ-111111', 'manual')).sku.value).toBe('');
  });

  it('WPR-IMPORT opens as no sku', () => {
    expect(opened(storedRecord('WPR-IMPORT', 'ZZ-111111', 'manual')).sku.value).toBe('');
  });

  it('a datasheet sku equal to the model is kept (a db driver)', () => {
    expect(opened(storedRecord('ZZ-111111', 'ZZ-111111', 'manufacturer_product_page')).sku.value).toBe('ZZ-111111');
  });

  it('a sku that differs from the model is kept', () => {
    expect(opened(storedRecord('ZZ-222222', 'ZZ-111111', 'manual')).sku.value).toBe('ZZ-222222');
  });
});
