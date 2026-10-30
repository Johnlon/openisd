/**
 * `OpenISDProject.tune` — the read model of the Tune view. Every number comes from the same calls
 * the charts use (`rolloffFreq`, the sweep, `lengthForTuning_m`); nothing is computed twice.
 */
import {describe, expect, it, vi} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {TuneLimits, VolumeLimit_L} from '../../domain/project/tuneLimits.js';
import {f3PointOf, whenKnown} from '../../domain/project/tuneView.js';
import {NumberField} from '../../fields/field.js';
import {TuneText} from '../../fields/tuneText.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const GRID: FrequencyGrid = {fmin: 10, fmax: 1000, N: 120};

function driver(engine: Engine) {
  return driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100,
  });
}

function vented() {
  const engine = createEngine();
  const project = new ProjectBuilder(driver(engine), engine).vented().volume_m3(0.05).tuning_goal_hz(40).build();
  project.box.vented.vent.shape.set('round');
  project.box.vented.vent.diameter_m.set(0.08);
  project.powerDrive_W.set(10);
  project.save();
  return project;
}

function sweepOf(project: ReturnType<typeof vented>) {
  const sw = project.sweep(GRID).values;
  if (sw === null) throw new Error('the project did not sweep');
  return sw;
}

describe('OpenISDProject.tune on a vented design', () => {
  it('reads F3, F10, peaks, vent length and diameter from the same calls the charts use', () => {
    const project = vented();
    const sw = sweepOf(project);
    const view = project.tune(GRID);
    if (!view.applies) throw new Error('expected Tune to apply');
    const peaks = project.peaks(sw);
    expect(view.now.f3_hz).toBe(project.rolloffFreq(sw, 3));
    expect(view.f10_hz).toBe(project.rolloffFreq(sw, 10));
    expect(view.now.vb_L).toBeCloseTo(50, 9);
    expect(view.now.ventSpeed_m_per_s).toBe(peaks.ventSpeed_m_per_s);
    expect(view.now.excursion_mm).toBe((peaks.excursion_m ?? Number.NaN) * 1000);
    expect(view.now.ventLength_cm).toBe((project.box.vented.vent.lengthForTuning_m(0.05, 40) ?? Number.NaN) * 100);
    expect(view.now.ventDiameter_cm).toBeCloseTo(8, 9);
    expect(view.curve).toEqual({fs: sw.fs, spl: sw.spl});
    expect(view.f3Point).toEqual({f_hz: view.now.f3_hz, spl_db: project.passbandRef(sw.spl) - 3});
    expect(view.vbRange_L).toBe(NumberField.BOX_VB_L.limits);
    expect(view.fbRange_hz).toBe(NumberField.BOX_FB_HZ.limits);
  });

  it('is saved = now with no What-if open, and every state none with blank limits', () => {
    const view = vented().tune(GRID);
    if (!view.applies) throw new Error('expected Tune to apply');
    expect(view.saved).toEqual(view.now);
    expect(view.savedCurve).toEqual(view.curve);
    expect(view.states.vb).toEqual({kind: 'none'});
  });

  it('colours a state from the limits it is handed', () => {
    const view = vented().tune(GRID, new TuneLimits(null, VolumeLimit_L.of(40), null, null, null, null));
    if (!view.applies) throw new Error('expected Tune to apply');
    expect(view.states.vb.kind).toBe('red');
    expect(view.states.f3).toEqual({kind: 'none'});
  });

  it('keeps the saved design apart from a What-if tuning drag', () => {
    const project = vented();
    const before = project.tune(GRID);
    project.beginWhatIf();
    project.box.vented.tuning_goal_hz.set(30);
    const view = project.tune(GRID);
    if (!view.applies || !before.applies) throw new Error('expected Tune to apply');
    expect(view.saved).toEqual(before.now);
    expect(view.savedCurve).toEqual(before.curve);
    expect(view.now.ventLength_cm).not.toBe(view.saved.ventLength_cm);
    expect(view.curve.spl).not.toEqual(view.savedCurve.spl);
  });
});

describe('f3PointOf', () => {
  it('puts the F3 marker 3 dB under the passband, and none when there is no F3', () => {
    expect(f3PointOf(35, 90)).toEqual({f_hz: 35, spl_db: 87});
    expect(f3PointOf(null, 90)).toBeNull();
  });
});

describe('whenKnown', () => {
  it('reads a known value, and never calls the reader for a missing one', () => {
    const read = vi.fn((v: number) => v * 2);
    expect(whenKnown(21, read)).toBe(42);
    expect(read).toHaveBeenCalledWith(21);
    read.mockClear();
    expect(whenKnown(null, read)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});

describe('OpenISDProject.tune where Tune does not apply', () => {
  it('says so, in design text, for a sealed box', () => {
    const engine = createEngine();
    const project = new ProjectBuilder(driver(engine), engine).sealed().volume_m3(0.03).build();
    expect(project.tune(GRID)).toEqual({applies: false, note: TuneText.NOT_VENTED_NOTE});
  });
  it('says so for a vented design that will not sweep', () => {
    const project = ProjectBuilder.empty(createEngine());
    project.box.boxType.set('vented');
    expect(project.tune(GRID).applies).toBe(false);
  });
  it('says so for a vented design with no volume', () => {
    const project = ProjectBuilder.empty(createEngine());
    project.box.boxType.set('vented');
    project.driver.specs.Vas_m3.clear();
    project.box.vented.volume_m3.clear();
    expect(project.box.vented.volume_m3.value).toBeNull();
    expect(project.tune(GRID)).toEqual({applies: false, note: TuneText.NOT_VENTED_NOTE});
  });
  it('says so when the saved design will not sweep although the What-if does', () => {
    const project = ProjectBuilder.empty(createEngine());
    project.box.boxType.set('vented');
    project.save();
    project.beginWhatIf();
    const s = project.driver.specs;
    s.Fs_hz.set(37); s.Qts.set(0.378); s.Qes.set(0.40); s.Qms.set(7.0); s.Vas_m3.set(0.03);
    s.Sd_m2.set(0.0133); s.Re_ohm.set(5.6); s.Le_H.set(0.7e-3); s.Xmax_m.set(0.005); s.Pe_W.set(60);
    project.box.vented.volume_m3.set(0.03);
    project.box.vented.tuning_goal_hz.set(40);
    project.box.vented.vent.shape.set('round');
    project.box.vented.vent.diameter_m.set(0.08);
    expect(project.sweep(GRID).values).not.toBeNull();
    expect(project.tune(GRID).applies).toBe(false);
  });
});

describe('OpenISDProject.commitWhatIf', () => {
  it('makes the What-if values ordinary unsaved edits and closes the layer', () => {
    const project = vented();
    project.beginWhatIf();
    project.box.vented.tuning_goal_hz.set(30);
    expect(project.isModified()).toBe(false);
    project.commitWhatIf();
    expect(project.isWhatIfActive()).toBe(false);
    expect(project.box.vented.tuning_goal_hz.value).toBe(30);
    expect(project.isModified()).toBe(true);
    expect(project.committedSnapshot().box.vented.tuning_goal_hz.value).toBe(30);
  });
  it('does nothing when no What-if is open', () => {
    const project = vented();
    project.commitWhatIf();
    expect(project.isModified()).toBe(false);
  });
  it('revert (resetWhatIf) leaves the project as saved', () => {
    const project = vented();
    project.beginWhatIf();
    project.box.vented.tuning_goal_hz.set(30);
    project.resetWhatIf();
    expect(project.box.vented.tuning_goal_hz.value).toBe(40);
  });
});
