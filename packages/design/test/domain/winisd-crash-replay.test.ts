/**
 * The user actions that crash, close or hang WinISD 0.7 (winisd_research/book/APPENDIX_D_WINISD_CRASHES.md,
 * D1 to D12), replayed on OpenISD through the same domain calls the screens make (T915; John, 18 Nov
 * 2026: "ok look make the ap robust / and include proper limits on ui"). OpenISD must not do any of
 * them: no throw, no NaN or Infinity in what the charts draw, no slow call. A sweep the app refuses
 * with a message is allowed: that is the app saying what is missing.
 *
 * A replay that breaks today runs under `it.fails` naming bugs/BUG_20261118_input-limits-sweep.md.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {DRIVER_SPEC_FIELD_NAMES} from '../../domain/driver/driverSpecFieldName.js';
import type {NumericDriverSpecFieldName} from '../../domain/driver/driverSpecFieldName.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {DEFAULT_GRID, SLOW_MS, importWprText, loadProject, projectFindings, wprText} from '../fixtures/inputLimitsSweep.js';

const engine = createEngine();
const NUMERIC_DRIVER_FIELDS = DRIVER_SPEC_FIELD_NAMES.filter((n): n is NumericDriverSpecFieldName => n !== 'VCCon');

/** Empties every number the driver states, as a person clearing each box of the driver editor. */
function clearDriver(project: OpenISDProject): void {
  for (const name of NUMERIC_DRIVER_FIELDS) project.driver.specField(name).clear();
}

/** Every number the driver editor shows, read as the editor reads it. */
function driverEditorValues(project: OpenISDProject): readonly (number | null)[] {
  return NUMERIC_DRIVER_FIELDS.map(name => project.driver.specField(name).value);
}

const nonFinite = (values: readonly (number | null)[]) => values.filter(v => v !== null && !Number.isFinite(v));

describe('WinISD crash list, replayed on OpenISD', () => {
  // D1: WinISD dies on Add. OpenISD keeps the value and draws no curve for that filter (T913, ruled QO951).
  // D1 replays -6 dB through the load path: the typed edit clamps since QO951.c9. The sealed W5 file
  // is opened with one Peak HP filter at 50 Hz, -6 dB in its [Filters] section, as File > Open reads it.
  it('D1: a Peaking 2nd order highpass at -6 dB and 50 Hz on a sealed W5 leaves the charts finite', () => {
    const plain = wprText('sealed');
    const text = plain.replace('[Filters]\nCount=0\n', '[Filters]\nCount=1\nfilter0type=5\nfilter0params=0;1;50;-6\n');
    expect(text, 'the sealed W5 file has an empty [Filters] section').not.toBe(plain);
    const project = importWprText('sealed W5 with a -6 dB Peak HP', text);
    const filters = project.filters.value;
    expect(filters, 'the stored gain is -6 dB, never quietly 0').toEqual([expect.objectContaining({type: 'peakHighpass', fpk: 50, gainPk: -6})]);
    expect(engine.filters.issue(filters[0])?.text).toBe(
      'WinISD closes when this filter has a negative peak gain, but a peak gain below 0 dB has no curve to draw, '
      + 'so OpenISD keeps the value and draws no curve for this filter (here -6 dB at 50 Hz).');
    expect(projectFindings(project, DEFAULT_GRID).findings).toEqual([]);
  });

  it('D2: emptying the passive radiator Vas box leaves the charts finite', () => {
    const project = loadProject('passive radiator');
    project.box.passiveRadiator.radiator.spec.Vas_m3.clear();
    expect(project.box.passiveRadiator.radiator.spec.Vas_m3.value).toBeNull();
    expect(projectFindings(project, DEFAULT_GRID).findings).toEqual([]);
  });

  it('D3: a driver stating Mms, Cms, BL, Re, Qms and Sd but no Fs, Qes, Qts, Rms or Vas sweeps finite', () => {
    const project = loadProject('sealed');
    clearDriver(project);
    const s = project.driver.specField.bind(project.driver);
    s('Mms_kg').set(0.0155); s('Cms_m_per_N').set(0.0011809); s('BL_Tm').set(7.5);
    s('Re_ohm').set(6.4); s('Qms').set(3.8); s('Sd_m2').set(0.0132);
    const result = projectFindings(project, DEFAULT_GRID);
    // With neither Pe nor Xmax stated the maximum curves are unbounded (Infinity) and the engine names
    // the two missing figures: QO143, John 15 Sep 2026, "separate label from 'blocked', e.g. 'state Pe
    // or Xmax to bound this curve'".
    expect(project.maxCurves(DEFAULT_GRID).driverPrerequisites.map(p => p.output)).toEqual(['maxspl', 'maxpwr']);
    const unbounded = (f: {symptom: string; call: string}) => f.symptom === 'Infinity' && f.call === 'maxCurves';
    expect(result.findings.filter(f => !unbounded(f))).toEqual([]);
    expect(result.refused).toBe(false);
  });

  it('D4: a driver with Vas 0, saved and reopened from storage, opens and sweeps without a throw or a NaN', () => {
    const project = loadProject('sealed');
    project.driver.specField('Vas_m3').set(0);
    const reopened = OpenISDProject.fromOwprTextRepairing(project.toOwprText(), engine);
    if (Array.isArray(reopened)) throw new Error(`the saved project did not reopen: ${reopened.join('; ')}`);
    expect(projectFindings(reopened.project, DEFAULT_GRID).findings).toEqual([]);
  });

  // The same project duplicated (appState.ts duplicateFocusedProject round-trips through the strict
  // fromOwprText). It was refused, "edited.box.sealed.Qtc.value: expected number, received null",
  // until the sealed solve stopped writing a NaN Qtc (T916).
  it('D4: a driver with Vas 0 round-trips through its own saved text (Duplicate project)', () => {
    const project = loadProject('sealed');
    project.driver.specField('Vas_m3').set(0);
    const reopened = OpenISDProject.fromOwprText(project.toOwprText(), engine);
    expect(Array.isArray(reopened) ? reopened : []).toEqual([]);
  });

  it('D5: Hc equal to Hg with Sd stated, no Vd and no Xmax answers quickly and finite', () => {
    const project = loadProject('sealed');
    project.driver.specField('Vd_m3').clear();
    project.driver.specField('Xmax_m').clear();
    project.driver.specField('Hc_m').set(0.012);
    project.driver.specField('Hg_m').set(0.012);
    const start = performance.now();
    const values = driverEditorValues(project);
    expect(performance.now() - start).toBeLessThan(SLOW_MS);
    expect(nonFinite(values)).toEqual([]);
    expect(projectFindings(project, DEFAULT_GRID).findings).toEqual([]);
  });

  it('D6: a driver with nothing stated, Box tab: the sweep is refused with a message, nothing throws', () => {
    const project = loadProject('sealed');
    clearDriver(project);
    const result = projectFindings(project, DEFAULT_GRID);
    expect(result.findings).toEqual([]);
    expect(project.sweep(DEFAULT_GRID).issues.length).toBeGreaterThan(0);
  });

  it('D7: the driver editor on a driver with nothing stated reads every box without a throw or a NaN', () => {
    const project = loadProject('sealed');
    clearDriver(project);
    expect(nonFinite(driverEditorValues(project))).toEqual([]);
  });

  it('D8: emptying the passive radiator box Volume leaves the charts finite', () => {
    const project = loadProject('passive radiator');
    project.box.passiveRadiator.volume_m3.clear();
    expect(projectFindings(project, DEFAULT_GRID).findings).toEqual([]);
  });

  it('D9: a Lowpass of order 12, typed and loaded from a WinISD file line, sweeps finite', () => {
    const typed = loadProject('sealed');
    const start = {...engine.filters.default('lowpass'), id: 'd9', enabled: true};
    if (start.type !== 'lowpass') throw new Error('the default lowpass is not a lowpass');
    typed.filters.set([engine.filters.editPass(start, {order: 12, fc: 400, Q: 0.707})]);
    expect(projectFindings(typed, DEFAULT_GRID).findings).toEqual([]);

    const loaded = loadProject('sealed');
    const {filter} = engine.filters.fromWpr(0, '0;1;12;400;0.707'.split(';'));
    if (filter === null) throw new Error('the WinISD filter line did not load');
    loaded.filters.set([filter]);
    expect(projectFindings(loaded, DEFAULT_GRID).findings).toEqual([]);
  });

  it('D10: air at 410 K, 60 % RH and 93000 Pa sweeps finite', () => {
    for (const name of ['sealed', 'vented'] as const) {
      const project = loadProject(name);
      project.envTempK.set(410);
      project.envHumidityPct.set(60);
      project.envPressurePa.set(93000);
      expect(projectFindings(project, DEFAULT_GRID).findings).toEqual([]);
    }
  });

  it('D11: a driver with only Re 123 stated: refused with a message or finite, nothing throws', () => {
    const project = loadProject('sealed');
    clearDriver(project);
    project.driver.specField('Re_ohm').set(123);
    expect(nonFinite(driverEditorValues(project))).toEqual([]);
    expect(projectFindings(project, DEFAULT_GRID).findings).toEqual([]);
  });

  // D12 was heap corruption in WinISD's native code after the driver editor closed. OpenISD has no
  // native heap; the replay is the same sequence: edit the driver, then read what the Signal tab shows.
  it('D12: edit the driver, then the Signal tab values are finite', () => {
    const project = loadProject('sealed');
    project.driver.specField('Fs_hz').set((project.driver.specField('Fs_hz').value ?? 45) * 1.1);
    expect(nonFinite([project.powerDrive_W.value, project.driveVoltage_V.value, project.Rs_ohm.value])).toEqual([]);
    expect(projectFindings(project, DEFAULT_GRID).findings).toEqual([]);
  });
});
