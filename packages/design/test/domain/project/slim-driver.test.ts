/**
 * The driver embedded in a stored or exported project carries what the Driver Editor shows and
 * the calculation reads (T158). What the project looks like after a reload is unchanged; what
 * only the catalogue record needs is gone; the text still parses under the schema older builds read.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../../engine/Engine.js';
import {OpenISDProject} from '../../../domain/project/openISDProject.js';
import {parseOwprSession, compactedStoredText} from '../../../domain/project/projectSerialization.js';
import {slimmedProjectSession} from '../../../domain/project/slimDriver.js';
import {WinIsdProjectConverter} from '../../../domain/winIsdProjectConverter.js';

const here = dirname(fileURLToPath(import.meta.url));
const engine = createEngine();
const wprText = readFileSync(join(here, '..', '..', 'winisd', 'fixtures', 'abc-w5-1.wpr'), 'utf8');

function project(): OpenISDProject {
  const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(wprText);
  if (value === null) throw new Error('import failed: ' + JSON.stringify(errors));
  return value;
}

function loaded(text: string): OpenISDProject {
  const p = OpenISDProject.fromOwprText(text, engine);
  if (Array.isArray(p)) throw new Error('refused: ' + p.join('; '));
  return p;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function record(v: unknown): Record<string, unknown> {
  if (!isRecord(v)) throw new Error('not an object');
  return v;
}

/** The embedded driver's device record in an `.owpr` text. */
function deviceOf(text: string): Record<string, unknown> {
  return record(record(record(record(JSON.parse(text)).saved).driverEmbedding).device);
}

const text = (value: string) => ({value, origin: 'manufacturer_datasheet', dq_scraper: [{kind: 'k', severity: 's', rule: 'r', detail: 'd', params: {}}]});
const reading = (read_value: number, read_precision: number) => ({actual_reading: String(read_value), read_value, read_precision});
const mark = {kind: 'calc', severity: 'error', rule: 'inconsistent-inputs', detail: 'd', params: {}};

/** A session whose driver has every kind of spec entry and every device field. */
function fatSession(): Record<string, unknown> {
  const device = {
    uuid: {value: 'u1'},
    quality: {issue: 'x', missing: ['Xmax_m'], invalid: [], parse_errors: [], cross_source_only: []},
    manufacturer: text('Tang Band'), brand: text('Tang Band'), model: text('W5'),
    sku: {value: 'w5', grounds: [{origin: 'manufacturer_datasheet', reading: 'W5'}]},
    driver_type: {value: ['woofer']},
    categories: {value: [{label: 'c', url: 'u'}]}, series: text('S'), nominal_size_cm: {value: 13},
    data_sources: {value: {manufacturer_datasheet: 'http://x'}},
    authoritative: {value: 'a'}, product_image: text('i'), description: text('long description'),
    surround_material: text('rubber'), provided_by: text('someone'), comment: text('a comment'), added: text('2026-01-01'),
    specs: {woofer: {
      Fs_hz: {state: 'E', value: 45, origin: 'manufacturer_datasheet', corroboration: 'UNMATCHED',
        readings: {manufacturer_datasheet: reading(45, 0.5)}, dq_scraper: [mark], dq_calculated: [mark]},
      Re_ohm: {state: 'E', value: 3.4, precision: 0.05, dq_calculated: [mark]},
      Qts: {state: 'E', value: 0.4},
      Qes: {state: 'C', value: 0.57, precision: 0.01, dq_calculated: [mark]},
      Vas_m3: {state: 'N', readings: {manufacturer_datasheet: {actual_reading: 'N/A', rejected: 'unparsable'}}},
    }},
    curves: {spl: {value: {type: 'spl'}, origin: 'manufacturer_datasheet'}},
  };
  return {label: 'p', saved: {driverEmbedding: {device}}, edited: null};
}

function slimDeviceOf(session: Record<string, unknown>): Record<string, unknown> {
  return record(record(record(record(slimmedProjectSession(session)).saved).driverEmbedding).device);
}

describe('slimmedProjectSession', () => {
  it('holds the null GUID as the id and keeps the three texts the editor edits, as bare values', () => {
    const d = slimDeviceOf(fatSession());
    expect(d.uuid).toEqual({value: '00000000-0000-0000-0000-000000000000'});
    expect(d.manufacturer).toEqual({value: 'Tang Band'});
    expect(d.brand).toEqual({value: 'Tang Band'});
    expect(d.model).toEqual({value: 'W5'});
    expect(d.sku).toEqual({value: 'w5', grounds: [{origin: 'manufacturer_datasheet', reading: 'W5'}]});
    expect(d.driver_type).toEqual({value: ['woofer']});
    expect(d.provided_by).toEqual({value: 'someone'});
    expect(d.comment).toEqual({value: 'a comment'});
    expect(d.added).toEqual({value: '2026-01-01'});
  });

  it('drops what no screen shows, leaving the required keys empty', () => {
    const d = slimDeviceOf(fatSession());
    for (const gone of ['categories', 'series', 'nominal_size_cm', 'authoritative', 'product_image', 'description', 'surround_material', 'curves']) {
      expect(d).not.toHaveProperty(gone);
    }
    expect(d.quality).toEqual({missing: [], invalid: [], parse_errors: [], cross_source_only: []});
    expect(d.data_sources).toEqual({value: {}});
  });

  it('keeps each spec entry as state, value and the precision it states', () => {
    const woofer = record(record(slimDeviceOf(fatSession()).specs).woofer);
    expect(woofer.Fs_hz).toEqual({state: 'E', value: 45, precision: 0.5});
    expect(woofer.Re_ohm).toEqual({state: 'E', value: 3.4, precision: 0.05});
    expect(woofer.Qts).toEqual({state: 'E', value: 0.4});
    expect(woofer.Qes).toEqual({state: 'C', value: 0.57, precision: 0.01});
  });

  it('keeps not-available source readings without turning them into simulation values', () => {
    const woofer = record(record(slimDeviceOf(fatSession()).specs).woofer);
    expect(woofer.Vas_m3).toEqual({
      state: 'N',
      readings: {manufacturer_datasheet: {actual_reading: 'N/A', rejected: 'unparsable'}},
    });
  });

  it('is the same on a second pass', () => {
    const once = slimmedProjectSession(fatSession());
    expect(slimmedProjectSession(once)).toEqual(once);
  });

  it('leaves an edited state as well as the saved one slim, and a null edited as null', () => {
    const session = fatSession();
    expect(record(slimmedProjectSession(session)).edited).toBeNull();
    const both = {...session, edited: session.saved};
    const out = record(slimmedProjectSession(both));
    expect(record(record(record(out.edited).driverEmbedding).device)).not.toHaveProperty('categories');
  });

  it.each([null, 3, 'text', [], {}, {saved: 3}, {saved: {driverEmbedding: 3}}])('returns %j as it was when it is not a project session', value => {
    expect(slimmedProjectSession(value)).toEqual(value);
  });
});

describe('the project text', () => {
  it('is much smaller than the unslimmed driver made it', () => {
    const p = project();
    const slim = p.toOwprText();
    const fat = JSON.stringify(p.cloneSession(), null, 2);
    expect(slim.length).toBeLessThan(fat.length / 2);
    expect(deviceOf(slim)).not.toHaveProperty('categories');
    expect(slim).not.toContain('dq_calculated');
    expect(slim).not.toContain('readings');
  });

  it('parses under the project schema, which every earlier build reads', () => {
    const p = project();
    expect(parseOwprSession(p.toOwprText(), () => "unused")).toHaveProperty('session');
    expect(parseOwprSession(p.toStoredText(), () => "unused")).toHaveProperty('session');
  });

  it('reads back with the same driver, parameter by parameter', () => {
    const original = project();
    const back = loaded(original.toOwprText());
    expect(back.driver.brand.value).toBe(original.driver.brand.value);
    expect(back.driver.model.value).toBe(original.driver.model.value);
    expect(back.driver.sku.value).toBe(original.driver.sku.value);
    const pairs = [
      [original.driver.specs.Fs_hz, back.driver.specs.Fs_hz], [original.driver.specs.Qts, back.driver.specs.Qts],
      [original.driver.specs.Qes, back.driver.specs.Qes], [original.driver.specs.Qms, back.driver.specs.Qms],
      [original.driver.specs.Re_ohm, back.driver.specs.Re_ohm], [original.driver.specs.Sd_m2, back.driver.specs.Sd_m2],
      [original.driver.specs.Mms_kg, back.driver.specs.Mms_kg], [original.driver.specs.Xmax_m, back.driver.specs.Xmax_m],
      [original.driver.specs.BL_Tm, back.driver.specs.BL_Tm], [original.driver.specs.Vas_m3, back.driver.specs.Vas_m3],
    ] as const;
    for (const [was, now] of pairs) {
      expect(now.value, was.name).toBe(was.value);
      expect(now.provenance, was.name).toBe(was.provenance);
      expect(now.precision, was.name).toBe(was.precision);
      expect(now.dq, was.name).toEqual(was.dq);
    }
  });

  it('a stored text rewritten from an older, fat one is the slim one', () => {
    const p = project();
    const fat = JSON.stringify(slimmedProjectSession(JSON.parse(p.toOwprText())), null, 2);
    expect(compactedStoredText(fat)).toBe(p.toStoredText());
  });
});
