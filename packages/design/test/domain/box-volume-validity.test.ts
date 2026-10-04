/**
 * Every box type's volume field shares ONE floor: zero, negative or non-finite is not a volume,
 * whatever box it is (BUG_20260927_box-volume-validity-decided-in-ui.md). This was a UI-only
 * `v > 0` check before, duplicated per box type and never reaching the domain. `Engine.positiveValueIssue`
 * (generalised again for BUG_20260927_driver-bad-value-decided-in-ui.md — see
 * driver-value-validity.test.ts, the same `invalid-value` issue over driver spec fields) is the
 * box-agnostic counterpart to the vented-only `Engine.ventedVolumeIssue`
 * (`vented-plausibility-cells.test.ts` pins that one; this file pins every OTHER box type's own
 * volume field, sealed through passive-radiator).
 *
 * Each box is built once with a valid volume, then driven to 0 / negative / NaN through the
 * field's own `.set()` — the same field a UI hook already holds — and the resulting `.dq` is
 * checked, never the stored value: a bad volume is kept exactly as entered, only marked.
 */
import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone, ProjectBuilder} from '../../domain/index.js';

const scraped = <T,>(value: T) => ({value});
const spec = (read_value: number) => ({state: 'E' as const, value: read_value, origin: 'scraped', readings: {scraped: {read_value}}});

function driverFor(engine: Engine): OpenISDDriver {
  const record = {
    uuid: {value: '00000000-0000-4000-8000-000000000000'},
    manufacturer: scraped('Dayton'), brand: scraped('Dayton'), model: scraped('RS225'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: {value: 'TEST-SKU', grounds: [{origin: 'manufacturer_datasheet', reading: 'TEST-SKU'}]},
    driver_type: scraped('woofer'),
    data_sources: {value: {manufacturer_datasheet: 'https://example.invalid/ds.pdf'}},
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        Fs_hz: spec(30), Qts: spec(0.4), Sd_m2: spec(0.02), Cms_m_per_N: spec(0.0005),
        Mms_kg: spec(0.05), Rms_kg_per_s: spec(2), Xmax_m: spec(0.008),
      },
    },
  };
  const driver = OpenISDDriver.fromConformingRecord(record, engine);
  if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
  return driver;
}

/** Every case asserts the same shape against a field's `.dq`, whichever box handed it in. */
function expectInvalidVolumeAtEachBadValue(
  engine: Engine, field: {set(v: number): void; dq: readonly unknown[]},
) {
  for (const value of [0, -1, NaN]) {
    field.set(value);
    expect(field.dq).toEqual([engine.issues.positiveValueIssue(value)]);
  }
}

describe('box volume validity — every box type shares one floor (BUG_20260927)', () => {
  it('sealed volume_m3', () => {
    const engine = createEngine();
    const p = new ProjectBuilder(driverFor(engine), engine).sealed().volume_m3(0.03).build();
    expectInvalidVolumeAtEachBadValue(engine, p.box.sealed.volume_m3);
  });

  it('bandpass4 rear volume_m3', () => {
    const engine = createEngine();
    const p = new ProjectBuilder(driverFor(engine), engine).bandpass4()
      .rearVolume_m3(0.02).frontVolume_m3(0.02).frontTuning_hz(40).build();
    expectInvalidVolumeAtEachBadValue(engine, p.box.bandpass4.chambers.rear.volume_m3);
  });

  it('bandpass4 front volume_m3', () => {
    const engine = createEngine();
    const p = new ProjectBuilder(driverFor(engine), engine).bandpass4()
      .rearVolume_m3(0.02).frontVolume_m3(0.02).frontTuning_hz(40).build();
    expectInvalidVolumeAtEachBadValue(engine, p.box.bandpass4.chambers.front.volume_m3);
  });

  it('bandpass6 rear volume_m3', () => {
    const engine = createEngine();
    const p = new ProjectBuilder(driverFor(engine), engine).bandpass6()
      .rearVolume_m3(0.02).rearTuning_hz(30).frontVolume_m3(0.02).frontTuning_hz(40).build();
    expectInvalidVolumeAtEachBadValue(engine, p.box.bandpass6.chambers.rear.volume_m3);
  });

  it('bandpass6 front volume_m3', () => {
    const engine = createEngine();
    const p = new ProjectBuilder(driverFor(engine), engine).bandpass6()
      .rearVolume_m3(0.02).rearTuning_hz(30).frontVolume_m3(0.02).frontTuning_hz(40).build();
    expectInvalidVolumeAtEachBadValue(engine, p.box.bandpass6.chambers.front.volume_m3);
  });

  it('abc rear volume_m3', () => {
    const engine = createEngine();
    const p = new ProjectBuilder(driverFor(engine), engine).abc()
      .rearVolume_m3(0.02).rearTuning_hz(30).frontVolume_m3(0.02).frontTuning_hz(40).build();
    expectInvalidVolumeAtEachBadValue(engine, p.box.abc.chambers.rear.volume_m3);
  });

  it('abc front volume_m3', () => {
    const engine = createEngine();
    const p = new ProjectBuilder(driverFor(engine), engine).abc()
      .rearVolume_m3(0.02).rearTuning_hz(30).frontVolume_m3(0.02).frontTuning_hz(40).build();
    expectInvalidVolumeAtEachBadValue(engine, p.box.abc.chambers.front.volume_m3);
  });

  it('passive-radiator volume_m3', () => {
    const engine = createEngine();
    const radiator = OpenISDPassiveRadiatorStandalone.empty();
    const p = new ProjectBuilder(driverFor(engine), engine).passiveRadiator()
      .volume_m3(0.05).tuning_goal_hz(35).count(1).radiator(radiator).build();
    expectInvalidVolumeAtEachBadValue(engine, p.box.passiveRadiator.volume_m3);
  });

  it('leaves vented\'s own richer check untouched — still a VentedPlausibilityIssue, not this one', () => {
    const engine = createEngine();
    const p = new ProjectBuilder(driverFor(engine), engine).vented().volume_m3(0.05).tuning_goal_hz(35).build();
    p.box.vented.volume_m3.set(0);
    expect(p.box.vented.volume_m3.dq).toEqual([engine.issues.nonPhysicalQuantity('Vb', 0)]);
  });
});
