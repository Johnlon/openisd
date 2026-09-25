/**
 * The Options dialog's application settings: the environment a project reads when it has none
 * of its own, and the band the vented plausibility marks are judged against.
 *
 * Both are drafts until `apply()` — the dialog's OK. A half-typed "min volume" must not mark
 * every open project mid-keystroke, and Cancel must leave the settings as they were. The two
 * reset methods put the factory values into the draft and write nothing.
 *
 * The hook edits the band in the unit the user sees — litres and hertz — and the repo stores
 * m³, so the conversion is this hook's boundary and is pinned here.
 */
import {describe, expect, it} from 'vitest';
import assert from 'node:assert/strict';
import {
  DEFAULT_ENV_DEFAULTS, DEFAULT_VENTED_DESIGN_LIMITS, type EnvDefaults, type VentedDesignLimits,
} from '@openisd/design/engine';
import {LIMIT_ROWS, type OptionsModalDeps, useOptionsModal} from '../../src/hooks/OptionsModal-hooks.js';
import {parseChartTabId} from '../../src/logic/series.js';

/** A stand-in for appState's settings seam — records what the dialog writes. */
function fakeSettings(
  band: VentedDesignLimits = DEFAULT_VENTED_DESIGN_LIMITS,
  env: EnvDefaults = DEFAULT_ENV_DEFAULTS,
) {
  const bandWrites: VentedDesignLimits[] = [];
  const envWrites: EnvDefaults[] = [];
  const deps: OptionsModalDeps = {
    ventedLimits: () => band,
    setVentedLimits: (limits) => { band = limits; bandWrites.push(limits); },
    envDefaults: () => env,
    setEnvDefaults: (defaults) => { env = defaults; envWrites.push(defaults); },
  };
  return {...deps, bandWrites, envWrites};
}

const ARCTIC: EnvDefaults = {tempK: 250, humidityPct: 80, pressurePa: 99000};

describe('useOptionsModal — vented design limits', () => {
  it('opens showing the band in force, in litres and hertz', () => {
    const settings = fakeSettings({minVb_m3: 0.002, maxVb_m3: 0.5, minFb_hz: 12, maxFb_hz: 120});

    const dialog = useOptionsModal(settings);

    assert.equal(dialog.minVolume_L.value, 2);
    assert.equal(dialog.maxVolume_L.value, 500);
    assert.equal(dialog.minTuning_hz.value, 12);
    assert.equal(dialog.maxTuning_hz.value, 120);
  });

  it('writes nothing until apply() — a half-typed field must not mark every open project', () => {
    const settings = fakeSettings();
    const dialog = useOptionsModal(settings);

    dialog.minVolume_L.value = 5;
    dialog.maxVolume_L.value = 800;

    assert.deepEqual(settings.bandWrites, []);
  });

  it('apply() writes the band back in m³', () => {
    const settings = fakeSettings();
    const dialog = useOptionsModal(settings);

    dialog.minVolume_L.value = 5;
    dialog.maxVolume_L.value = 800;
    dialog.minTuning_hz.value = 15;
    dialog.maxTuning_hz.value = 200;
    dialog.apply();

    assert.deepEqual(settings.bandWrites, [{
      minVb_m3: 0.005, maxVb_m3: 0.8, minFb_hz: 15, maxFb_hz: 200,
    }]);
  });

  it('refuses a band whose minimum is not below its maximum, and says why', () => {
    const settings = fakeSettings();
    const dialog = useOptionsModal(settings);

    dialog.minVolume_L.value = 800;
    dialog.maxVolume_L.value = 5;

    expect(dialog.error.value).toMatch(/volume/i);
    assert.equal(dialog.canApply.value, false);
    dialog.apply();
    assert.deepEqual(settings.bandWrites, [], 'a refused band must not reach the repo');
  });

  it('refuses a non-positive limit — a box of zero litres is not a band edge', () => {
    const settings = fakeSettings();
    const dialog = useOptionsModal(settings);

    dialog.minVolume_L.value = 0;

    assert.equal(dialog.canApply.value, false);
    dialog.apply();
    assert.deepEqual(settings.bandWrites, []);
  });

  it('refuses an inverted tuning band too', () => {
    const settings = fakeSettings();
    const dialog = useOptionsModal(settings);

    dialog.minTuning_hz.value = 300;
    dialog.maxTuning_hz.value = 20;

    expect(dialog.error.value).toMatch(/tuning/i);
    assert.equal(dialog.canApply.value, false);
  });

  it('accepts a valid band with no error', () => {
    const dialog = useOptionsModal(fakeSettings());

    dialog.minVolume_L.value = 1;
    dialog.maxVolume_L.value = 1000;

    assert.equal(dialog.error.value, null);
    assert.equal(dialog.canApply.value, true);
  });

  it('resetLimits() puts the factory band in the draft and writes nothing until apply()', () => {
    const settings = fakeSettings({minVb_m3: 0.002, maxVb_m3: 0.5, minFb_hz: 12, maxFb_hz: 120});
    const dialog = useOptionsModal(settings);

    dialog.resetLimits();

    assert.deepEqual(settings.bandWrites, []);
    assert.equal(dialog.minVolume_L.value, DEFAULT_VENTED_DESIGN_LIMITS.minVb_m3 * 1000);
    assert.equal(dialog.maxTuning_hz.value, DEFAULT_VENTED_DESIGN_LIMITS.maxFb_hz);

    dialog.apply();
    assert.deepEqual(settings.bandWrites, [DEFAULT_VENTED_DESIGN_LIMITS]);
  });

  it('limitsAreFactory says whether the edited band is the factory one', () => {
    const dialog = useOptionsModal(fakeSettings());
    assert.equal(dialog.limitsAreFactory.value, true);

    dialog.minVolume_L.value = 7;

    assert.equal(dialog.limitsAreFactory.value, false);
  });
});

describe('useOptionsModal — environment defaults', () => {
  it('opens showing the environment in force', () => {
    const dialog = useOptionsModal(fakeSettings(undefined, ARCTIC));

    assert.equal(dialog.tempK.value, 250);
    assert.equal(dialog.humidityPct.value, 80);
    assert.equal(dialog.pressurePa.value, 99000);
  });

  it('writes nothing until apply()', () => {
    const settings = fakeSettings();
    const dialog = useOptionsModal(settings);

    dialog.tempK.value = 300;

    assert.deepEqual(settings.envWrites, []);
  });

  it('apply() writes the edited environment', () => {
    const settings = fakeSettings();
    const dialog = useOptionsModal(settings);

    dialog.tempK.value = 250;
    dialog.humidityPct.value = 80;
    dialog.pressurePa.value = 99000;
    dialog.apply();

    assert.deepEqual(settings.envWrites, [ARCTIC]);
  });

  it('resetEnv() puts the factory environment in the draft and writes nothing until apply()', () => {
    const settings = fakeSettings(undefined, ARCTIC);
    const dialog = useOptionsModal(settings);

    dialog.resetEnv();

    assert.deepEqual(settings.envWrites, []);
    assert.equal(dialog.tempK.value, DEFAULT_ENV_DEFAULTS.tempK);
    assert.equal(dialog.humidityPct.value, DEFAULT_ENV_DEFAULTS.humidityPct);
    assert.equal(dialog.pressurePa.value, DEFAULT_ENV_DEFAULTS.pressurePa);

    dialog.apply();
    assert.deepEqual(settings.envWrites, [DEFAULT_ENV_DEFAULTS]);
  });

  it('envIsFactory says whether the edited environment is the factory one', () => {
    const dialog = useOptionsModal(fakeSettings());
    assert.equal(dialog.envIsFactory.value, true);

    dialog.humidityPct.value = 31;

    assert.equal(dialog.envIsFactory.value, false);
  });

  it('the sound velocity / air density readout follows the draft, not the setting in force', () => {
    const dialog = useOptionsModal(fakeSettings());
    // c = √(γRT) at 293.15 K → 343.68 m/s; ρ = p/(RT) → 1.20 kg/m³.
    expect(dialog.defaultAir.value.c).toBeCloseTo(343.68, 1);
    expect(dialog.defaultAir.value.rho).toBeCloseTo(1.20, 2);

    dialog.tempK.value = 301;

    expect(dialog.defaultAir.value.c).toBeCloseTo(348.5, 0);
  });

  it('apply() with a refused band writes neither setting — OK is one write or none', () => {
    const settings = fakeSettings();
    const dialog = useOptionsModal(settings);
    dialog.tempK.value = 250;
    dialog.minVolume_L.value = 0;

    dialog.apply();

    assert.deepEqual(settings.envWrites, []);
    assert.deepEqual(settings.bandWrites, []);
  });
});

describe('the Plot Window Y-limit rows target charts that exist', () => {
  // John, 2026-09-24: "The selection of the Y axis limits of the TFM chart seem not to do
  // anything" — the row was keyed 'TFmag' while the chart is 'TFMag', so the override landed
  // under a key no chart reads. The rows are typed `ChartTabId` now; this pins the runtime side.
  it('every row is a chart tab the graph panel renders', () => {
    for (const row of LIMIT_ROWS) assert.equal(parseChartTabId(row.tab), row.tab, row.label);
  });

  it('has a row for the transfer function magnitude chart', () => {
    assert.ok(LIMIT_ROWS.some(row => row.tab === 'TFMag'));
  });
});
