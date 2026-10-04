import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {type Engine, createEngine, DEFAULT_ENV_DEFAULTS, type AppSettings, type EnvDefaults, type VentedDesignLimits} from '@openisd/design/engine';
import {OpenISDDriver, OpenISDProject, ProjectBuilder} from '../../domain/index.js';

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
  const p = new ProjectBuilder(driverFor(engine), engine).vented().volume_m3(Vb).tuning_goal_hz(Fb).build();
  p.box.vented.vent.diameter_m.clear();   // no vent geometry: the build gave it the 50 mm starting diameter
  p.save();                                // the fixture's own state is its saved baseline
  return p;
}

describe('OpenISDProject.appSettingsChanged', () => {
  it('re-marks every cell against the new band', () => {
    const settings = new MutableSettings(WIDE);
    const p = ventedProject(createEngine(settings), 1.684, 5.4);
    assert.deepEqual(p.box.vented.volume_m3.dq, []);
    const tuningBefore = p.box.vented.tuning_goal_hz.dq.length;

    settings.set(NARROW);
    p.appSettingsChanged();

    assert.equal(p.box.vented.volume_m3.dq.length, 1);
    assert.equal(p.box.vented.tuning_goal_hz.dq.length, tuningBefore + 1);
  });

  it('notifies, so the app repaints', () => {
    const settings = new MutableSettings(WIDE);
    const p = ventedProject(createEngine(settings), 1.684, 5.4);
    let fired = 0;
    p.subscribe(() => { fired += 1; });
    settings.set(NARROW);
    p.appSettingsChanged();
    assert.equal(fired, 1);
  });

  it('does not make the project edited — a settings change is not a design change', () => {
    const settings = new MutableSettings(WIDE);
    const p = ventedProject(createEngine(settings), 1.684, 5.4);
    settings.set(NARROW);
    p.appSettingsChanged();
    assert.equal(p.isModified(), false);
  });
});
