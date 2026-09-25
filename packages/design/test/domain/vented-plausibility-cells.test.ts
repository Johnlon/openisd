/**
 * A created project's own vented cells carry the plausibility mark.
 *
 * John's ruling: "keep parity and use dq — this is the way". The designed numbers are WinISD's
 * own extrapolated answers and are NOT changed here; `box.vented.volume_m3` and
 * `box.vented.tuning_goal_hz` simply say so. The band is an application setting, reached through the
 * collaborator `new Engine(settings)` takes, so every test states its own band.
 *
 * Two DIFFERENT marking mechanisms, forced by the two field types:
 *   - `volume_m3` is a `MandatoryField` with no `setDq` — its mark is computed at READ time.
 *   - `tuning_goal_hz` is a paired entry field — its mark is STORED, written by the project's resolve
 *     cascade alongside the vent solver's own mark, which it must not clobber.
 */
import {describe, expect, it} from 'vitest';
import assert from 'node:assert/strict';
import {Engine, DEFAULT_ENV_DEFAULTS, type AppSettings, type EnvDefaults, type VentedDesignLimits} from '@openisd/design/engine';
import {OpenISDDriver, OpenISDProject} from '../../domain/index.js';

const scraped = <T,>(value: T) => ({value});
const spec = (read_value: number) => ({state: 'E' as const, value: read_value, origin: 'scraped', readings: {scraped: {read_value}}});

const NARROW: VentedDesignLimits = {minVb_m3: 0.001, maxVb_m3: 1.0, minFb_hz: 10, maxFb_hz: 150};
const WIDE: VentedDesignLimits = {minVb_m3: 1e-9, maxVb_m3: 1e9, minFb_hz: 1e-9, maxFb_hz: 1e9};

/** A settings object whose band can be changed after the engine holds it — the Settings tab's
 *  own shape. `ventedLimits()` is a METHOD so the answer is read at call time. */
class MutableSettings implements AppSettings {
  constructor(private band: VentedDesignLimits) {}
  ventedLimits(): VentedDesignLimits { return this.band; }
  envDefaults(): EnvDefaults { return DEFAULT_ENV_DEFAULTS; }
  set(band: VentedDesignLimits): void { this.band = band; }
}

function driverFor(engine: Engine): OpenISDDriver {
  const record = {
    uuid: {value: '00000000-0000-4000-8000-000000000000'},
    manufacturer: scraped('Dayton'), brand: scraped('Dayton'), model: scraped('RS225'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: {value: 'TEST-SKU', grounds: [{origin: 'manufacturer_datasheet', reading: 'TEST-SKU'}]},
    driver_type: scraped('woofer'),
    data_sources: {value: {manufacturer_datasheet: 'https://example.invalid/ds.pdf'}},
    authoritative: {value: 'manufacturer_datasheet'},
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

function ventedProject(engine: Engine, Vb: number, Fb: number): OpenISDProject {
  return OpenISDProject.builder(driverFor(engine), engine).vented().volume_m3(Vb).tuning_goal_hz(Fb).build();
}

const engineWith = (band: VentedDesignLimits): Engine =>
  new Engine({ventedLimits: () => band, envDefaults: () => DEFAULT_ENV_DEFAULTS});

describe('vented project cells — plausibility marks', () => {
  it('leaves a buildable design unmarked', () => {
    const p = ventedProject(engineWith(NARROW), 0.05, 35);
    assert.deepEqual(p.box.vented.volume_m3.dq, []);
  });

  it('marks the volume cell when the designed box is outside the band', () => {
    const p = ventedProject(engineWith(NARROW), 1.684, 35);
    const dq = p.box.vented.volume_m3.dq;
    assert.equal(dq.length, 1);
    expect(dq[0]).toEqual({kind: 'out-of-range', quantity: 'Vb', value: 1.684, min: NARROW.minVb_m3, max: NARROW.maxVb_m3});
  });

  it('does not change the designed volume, only marks it', () => {
    const p = ventedProject(engineWith(NARROW), 1.684, 35);
    assert.equal(p.box.vented.volume_m3.value, 1.684);
  });

  it('marks the tuning cell when the designed tuning is outside the band', () => {
    const p = ventedProject(engineWith(NARROW), 0.05, 5.4);
    const dq = p.box.vented.tuning_goal_hz.dq;
    expect(dq.at(-1)).toEqual({kind: 'out-of-range', quantity: 'Fb', value: 5.4, min: NARROW.minFb_hz, max: NARROW.maxFb_hz});
    assert.equal(p.box.vented.tuning_goal_hz.value, 5.4);
  });

  it('adds its mark to the vent solver\'s own, never over it', () => {
    // The fixture states a tuning with no vent geometry, so the vent solver always has something
    // to say about `tuning_goal_hz`. If it stops having something to say this test fails loudly rather
    // than quietly proving nothing.
    const solverOnly = ventedProject(engineWith(WIDE), 0.05, 5.4).box.vented.tuning_goal_hz.dq;
    assert.ok(solverOnly.length > 0, 'fixture no longer produces a vent-solver mark');
    const both = ventedProject(engineWith(NARROW), 0.05, 5.4).box.vented.tuning_goal_hz.dq;
    assert.deepEqual(both.slice(0, solverOnly.length), solverOnly);
    assert.equal(both.length, solverOnly.length + 1);
  });

  it('leaves the vented cells of a sealed project alone — no design, nothing to judge', () => {
    // A sealed project's vented chamber sits at its schema default of 0 m³. That is not an
    // implausible box; it is no box. `cell-dq.test.ts` pins the same expectation.
    const engine = engineWith(NARROW);
    const p = OpenISDProject.builder(driverFor(engine), engine).sealed().volume_m3(0.03).build();
    assert.deepEqual(p.box.vented.volume_m3.dq, []);
  });

  it('judges by the band its engine is given, not a constant of its own', () => {
    assert.deepEqual(ventedProject(engineWith(WIDE), 1.684, 35).box.vented.volume_m3.dq, []);
  });
});

describe('OpenISDProject.appSettingsChanged', () => {
  it('re-marks every cell against the new band', () => {
    const settings = new MutableSettings(WIDE);
    const p = ventedProject(new Engine(settings), 1.684, 5.4);
    assert.deepEqual(p.box.vented.volume_m3.dq, []);
    const tuningBefore = p.box.vented.tuning_goal_hz.dq.length;

    settings.set(NARROW);
    p.appSettingsChanged();

    assert.equal(p.box.vented.volume_m3.dq.length, 1);
    assert.equal(p.box.vented.tuning_goal_hz.dq.length, tuningBefore + 1);
  });

  it('notifies, so the app repaints', () => {
    const settings = new MutableSettings(WIDE);
    const p = ventedProject(new Engine(settings), 1.684, 5.4);
    let fired = 0;
    p.subscribe(() => { fired += 1; });
    settings.set(NARROW);
    p.appSettingsChanged();
    assert.equal(fired, 1);
  });

  it('does not make the project edited — a settings change is not a design change', () => {
    const settings = new MutableSettings(WIDE);
    const p = ventedProject(new Engine(settings), 1.684, 5.4);
    settings.set(NARROW);
    p.appSettingsChanged();
    assert.equal(p.isModified(), false);
  });
});
