/**
 * `Engine.ventedPlausibility()` — is a designed vented box a box anyone could build?
 *
 * The alignment formulas keep PARITY with WinISD outside their design range: WinISD does not
 * clamp, it extrapolates, so `ventedAlignment()` extrapolates too (C4 at a source-loaded Qts of
 * 1.0 designs a 1684 L box tuned to 5.4 Hz). The number is not changed — it is MARKED. This is
 * the marking, and nothing here may alter a designed value.
 *
 * Two separate judgements:
 *   - non-physical — zero, negative, or not a finite number. Always an issue, whatever the
 *     limits say: no setting makes a zero-litre box a box.
 *   - out-of-range  — finite and positive, but outside the plausibility band. The band is an
 *     APPLICATION SETTING the user owns (Settings tab), never a constant in here, so every
 *     assertion below states its own limits rather than leaning on the factory ones.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {
  DEFAULT_ENV_DEFAULTS, DEFAULT_VENTED_DESIGN_LIMITS, Engine, type AppSettings, type VentedDesignLimits,
} from '../../engine/index.js';

/** The band is an application SETTING, so an engine is constructed with the settings under
 *  test — the same seam the composition root uses (`new Engine(appSettingsRepo)`). */
function engineWith(ventedLimits: VentedDesignLimits): Engine {
  const settings: AppSettings = {ventedLimits: () => ventedLimits, envDefaults: () => DEFAULT_ENV_DEFAULTS};
  return new Engine(settings);
}

/** A band wide enough that nothing in these tests is out of range by accident. */
const wide = engineWith({minVb_m3: 1e-9, maxVb_m3: 1e9, minFb_hz: 1e-9, maxFb_hz: 1e9});

/** 1 L … 1000 L, 10 Hz … 150 Hz — the same shape as the factory band, stated locally. */
const narrow = engineWith({minVb_m3: 0.001, maxVb_m3: 1.0, minFb_hz: 10, maxFb_hz: 150});

describe('Engine.ventedPlausibility', () => {
  it('passes a buildable box', () => {
    assert.deepEqual(narrow.ventedPlausibility({Vb: 0.05, Fb: 35}), []);
  });

  it('marks a zero or negative volume non-physical however wide the band', () => {
    const issues = wide.ventedPlausibility({Vb: 0, Fb: 35});
    assert.deepEqual(issues, [{kind: 'non-physical', quantity: 'Vb', value: 0}]);
    assert.deepEqual(
      wide.ventedPlausibility({Vb: -0.02, Fb: 35}),
      [{kind: 'non-physical', quantity: 'Vb', value: -0.02}]);
  });

  it('marks a zero or negative tuning non-physical however wide the band', () => {
    assert.deepEqual(
      wide.ventedPlausibility({Vb: 0.05, Fb: 0}),
      [{kind: 'non-physical', quantity: 'Fb', value: 0}]);
    assert.deepEqual(
      wide.ventedPlausibility({Vb: 0.05, Fb: -3}),
      [{kind: 'non-physical', quantity: 'Fb', value: -3}]);
  });

  it('marks NaN and Infinity non-physical', () => {
    const nan = wide.ventedPlausibility({Vb: Number.NaN, Fb: 35});
    assert.equal(nan.length, 1);
    assert.equal(nan[0].kind, 'non-physical');
    assert.deepEqual(
      wide.ventedPlausibility({Vb: 0.05, Fb: Number.POSITIVE_INFINITY}),
      [{kind: 'non-physical', quantity: 'Fb', value: Number.POSITIVE_INFINITY}]);
  });

  it('reports both quantities when both are wrong', () => {
    assert.deepEqual(wide.ventedPlausibility({Vb: 0, Fb: -1}), [
      {kind: 'non-physical', quantity: 'Vb', value: 0},
      {kind: 'non-physical', quantity: 'Fb', value: -1},
    ]);
  });

  it('marks a volume above the band, naming the limit it broke', () => {
    assert.deepEqual(narrow.ventedPlausibility({Vb: 1.684, Fb: 35}), [
      {kind: 'out-of-range', quantity: 'Vb', value: 1.684, min: 0.001, max: 1.0},
    ]);
  });

  it('marks a volume below the band', () => {
    assert.deepEqual(narrow.ventedPlausibility({Vb: 0.0000027, Fb: 35}), [
      {kind: 'out-of-range', quantity: 'Vb', value: 0.0000027, min: 0.001, max: 1.0},
    ]);
  });

  it('marks a tuning below and above the band', () => {
    assert.deepEqual(narrow.ventedPlausibility({Vb: 0.05, Fb: 5.4}), [
      {kind: 'out-of-range', quantity: 'Fb', value: 5.4, min: 10, max: 150},
    ]);
    assert.deepEqual(narrow.ventedPlausibility({Vb: 0.05, Fb: 400}), [
      {kind: 'out-of-range', quantity: 'Fb', value: 400, min: 10, max: 150},
    ]);
  });

  it('accepts a value exactly on a limit', () => {
    assert.deepEqual(narrow.ventedPlausibility({Vb: 1.0, Fb: 10}), []);
    assert.deepEqual(narrow.ventedPlausibility({Vb: 0.001, Fb: 150}), []);
  });

  it('obeys the band it is given, not a constant of its own', () => {
    const design = {Vb: 1.684, Fb: 5.4};
    assert.equal(narrow.ventedPlausibility(design).length, 2);
    assert.deepEqual(wide.ventedPlausibility(design), []);
  });

  it('asks its settings on every call, so a Settings edit lands without a new engine', () => {
    // What makes the app's notify → recall → repaint route work: the engine must not snapshot
    // the band at construction, or an already-open project would keep judging by the old one.
    const bands: VentedDesignLimits[] = [
      {minVb_m3: 0.001, maxVb_m3: 1.0, minFb_hz: 10, maxFb_hz: 150},
      {minVb_m3: 0.001, maxVb_m3: 2.0, minFb_hz: 5, maxFb_hz: 150},
    ];
    let current = 0;
    const live = new Engine({ventedLimits: () => bands[current]!, envDefaults: () => DEFAULT_ENV_DEFAULTS});
    const design = {Vb: 1.684, Fb: 5.4};
    assert.equal(live.ventedPlausibility(design).length, 2);
    current = 1;
    assert.deepEqual(live.ventedPlausibility(design), []);
  });

  it('marks WinISD\'s own extrapolated C4 design, both quantities', () => {
    // WinISD's literal answer for the capture driver (Fs 40, Vas 0.02, Qms 4, Re 6, Rg 0.1) at
    // Qes 1.333333 — a 1684 L box tuned to 5.4 Hz. `vented-alignment.test.ts` proves the engine
    // reproduces it; this proves we mark it rather than clamp it.
    const design = {Vb: 1.68448856574925, Fb: 5.40253768331173};
    assert.deepEqual(narrow.ventedPlausibility(design).map(i => i.quantity), ['Vb', 'Fb']);
  });
});

describe('Engine.ventedVolumeIssue / Engine.ventedTuningIssue', () => {
  // A CELL carries one quantity, so it can only be marked for that quantity's own issue. The
  // whole-design call answers for the wizard's step-4 readout, which shows both at once.
  it('judges a volume without being told a tuning', () => {
    assert.equal(narrow.ventedVolumeIssue(0.05), null);
    assert.deepEqual(narrow.ventedVolumeIssue(1.684),
      {kind: 'out-of-range', quantity: 'Vb', value: 1.684, min: 0.001, max: 1.0});
    assert.deepEqual(wide.ventedVolumeIssue(-0.02),
      {kind: 'non-physical', quantity: 'Vb', value: -0.02});
  });

  it('judges a tuning without being told a volume', () => {
    assert.equal(narrow.ventedTuningIssue(35), null);
    assert.deepEqual(narrow.ventedTuningIssue(5.4),
      {kind: 'out-of-range', quantity: 'Fb', value: 5.4, min: 10, max: 150});
    assert.deepEqual(wide.ventedTuningIssue(0),
      {kind: 'non-physical', quantity: 'Fb', value: 0});
  });

  it('agrees with the whole-design judgement', () => {
    const design = {Vb: 1.684, Fb: 5.4};
    assert.deepEqual(narrow.ventedPlausibility(design), [
      narrow.ventedVolumeIssue(design.Vb), narrow.ventedTuningIssue(design.Fb),
    ]);
  });
});

describe('DEFAULT_VENTED_DESIGN_LIMITS', () => {
  it('is the band the Settings tab starts from, and is frozen', () => {
    assert.ok(Object.isFrozen(DEFAULT_VENTED_DESIGN_LIMITS));
    assert.deepEqual(engineWith(DEFAULT_VENTED_DESIGN_LIMITS).ventedPlausibility({Vb: 0.05, Fb: 35}), []);
    assert.equal(engineWith(DEFAULT_VENTED_DESIGN_LIMITS).ventedPlausibility({Vb: 1.684, Fb: 5.4}).length, 2);
  });
});
