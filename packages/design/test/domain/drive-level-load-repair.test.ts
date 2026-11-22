/**
 * A drive level a file states is shown exactly as the file states it, never repaired (QO972): a Driver input voltage below 10 mV, or a System input power that is 0 W, negative or
 * drives below 10 mV, opens unchanged with the usual data-quality mark (`outside-normal-band` for a
 * positive low drive, `invalid-value` for zero or negative), no opening message, and the charts still
 * draw: a sweep that needs a drive level takes the labelled reference drive voltage for the
 * calculation only, never written into the field. A typed value is unchanged: below 10 mV is refused
 * with a note and the old value stays.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {REFERENCE_DRIVE_VOLTAGE_V} from '../../domain/project/projectSignal.js';
import {NumberField} from '../../fields/field.js';
import type {OpenISDProjectJson} from '../../domain/openisdSchema.js';
import {DEFAULT_GRID, loadProject, projectFindings, wprText} from '../fixtures/inputLimitsSweep.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import type {OpenedProject} from '../../domain/project/openISDProject.js';

const engine = createEngine();

/** The sealed W5 project as a saved `.owpr` text (no unsaved edits), its signal replaced by `signal`. */
function owprWithSignal(signal: OpenISDProjectJson['signal']): string {
  const session = loadProject('sealed').cloneSession();
  return JSON.stringify({...session, saved: {...(session.edited ?? session.saved), signal}, edited: null}, null, 2);
}

/** An `.owpr` text opened as File > Open opens it: the project and what the load repaired. */
function opened(text: string): OpenedProject {
  const result = OpenISDProject.fromOwprTextRepairing(text, engine);
  if (Array.isArray(result)) throw new Error(`the project did not open: ${result.join('; ')}`);
  return result;
}

/** The sealed W5 `.wpr` with its `[SignalSource] P` set to `P`, opened as File > Open opens it. */
function wprWithPower(P: string): OpenedProject {
  const plain = wprText('sealed');
  const text = plain.replace('[SignalSource]\nRg=0.1\nP=1.0\n', `[SignalSource]\nRg=0.1\nP=${P}\n`);
  expect(text, 'the sealed W5 file states P=1.0').not.toBe(plain);
  const {value, errors, loadRepairs} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
  if (value === null) throw new Error(errors.map(e => e.message).join('; '));
  return {project: value, loadRepairs};
}


/** Every number a finding row holds is finite (a chart that goes NaN is a blank chart). */
function expectFiniteCharts(project: OpenISDProject): void {
  const result = projectFindings(project, DEFAULT_GRID);
  expect(result.findings, 'no NaN, infinity or blank curve').toEqual([]);
  expect(result.refused, 'the sweep ran, it was not refused').toBe(false);
}

describe('a drive voltage a file states is kept as stated, with its mark (QO972)', () => {
  it('the Driver input voltage field states no load repair any more', () => {
    expect(NumberField.SIGNAL_DRIVEV_V.loadRepair).toBeNull();
    expect(NumberField.SIGNAL_DRIVEV_V.limits.min).toBe(0.01);
  });

  it('a project file with Driver input voltage 5 mV stays 5 mV, marked outside-normal-band, nothing repaired, the charts draw', () => {
    const {project, loadRepairs} = opened(owprWithSignal({voltage_V: {state: 'E', value: 0.005}}));
    expect(project.driveVoltage_V.value).toBe(0.005);
    expect(project.driveVoltage_V.entered).toBe(true);
    expect(project.driveVoltage_V.dq.map(i => i.kind)).toEqual(['outside-normal-band']);
    expect(loadRepairs).toEqual([]);
    expectFiniteCharts(project);
  });

  for (const V of [-6, 0]) {
    it(`a project file with Driver input voltage ${V} V stays ${V} V, marked invalid-value, nothing repaired, the charts draw at the reference drive`, () => {
      const {project, loadRepairs} = opened(owprWithSignal({voltage_V: {state: 'E', value: V}}));
      expect(project.driveVoltage_V.value).toBe(V);
      expect(project.driveVoltage_V.dq.map(i => i.kind)).toEqual(['invalid-value']);
      expect(loadRepairs).toEqual([]);
      expect(project.signal.sweepVoltage_V).toBe(REFERENCE_DRIVE_VOLTAGE_V);
      expect(project.driveVoltage_V.value, 'the reference never lands in the field').toBe(V);
      expectFiniteCharts(project);
    });
  }

  it('a stored project with an unsaved -6 V edit reopens from storage showing -6 V, marked, nothing repaired', () => {
    const project = loadProject('sealed');
    project.driveVoltage_V.set(2);
    const session = project.cloneSession();
    const edited = session.edited ?? session.saved;
    const text = JSON.stringify({...session, edited: {...edited, signal: {voltage_V: {state: 'E', value: -6}}}});
    const reopened = OpenISDProject.fromOwprTextRepairing(text, engine);
    if (Array.isArray(reopened)) throw new Error(reopened.join('; '));
    expect(reopened.project.driveVoltage_V.value).toBe(-6);
    expect(reopened.project.driveVoltage_V.dq.map(i => i.kind)).toEqual(['invalid-value']);
    expect(reopened.loadRepairs).toEqual([]);
    expectFiniteCharts(reopened.project);
  });

  it('a file within the limits opens unchanged, with no mark and nothing repaired', () => {
    const {project, loadRepairs} = opened(owprWithSignal({voltage_V: {state: 'E', value: 2}}));
    expect(project.driveVoltage_V.value).toBe(2);
    expect(project.driveVoltage_V.dq).toEqual([]);
    expect(loadRepairs).toEqual([]);
    expect(wprWithPower('2').loadRepairs).toEqual([]);
  });
});

describe('a system input power a file states is kept as stated, with its mark (QO972)', () => {
  it('a positive power that drives below 10 mV stays as stated, marked outside-normal-band, and the sweep runs at its voltage', () => {
    // 6.25 uW into the sealed W5's Re: the amplifier voltage is under 10 mV.
    const {project, loadRepairs} = opened(owprWithSignal({power_W: {state: 'E', value: 6.25e-6}}));
    expect(project.powerDrive_W.value).toBe(6.25e-6);
    expect(project.powerDrive_W.entered).toBe(true);
    expect(project.driveVoltage_V.value).toBeLessThan(0.01);
    expect(project.powerDrive_W.dq.map(i => i.kind)).toEqual(['outside-normal-band']);
    expect(loadRepairs).toEqual([]);
    expectFiniteCharts(project);
  });

  for (const P of [0, -6]) {
    it(`a project file with System input power ${P} W stays ${P} W, marked invalid-value, never square-rooted, the charts draw`, () => {
      const {project, loadRepairs} = opened(owprWithSignal({power_W: {state: 'E', value: P}}));
      expect(project.powerDrive_W.value).toBe(P);
      expect(project.powerDrive_W.entered).toBe(true);
      expect(project.powerDrive_W.dq.map(i => i.kind)).toEqual(['invalid-value']);
      expect(Number.isFinite(project.driveVoltage_V.value)).toBe(true);
      expect(loadRepairs).toEqual([]);
      expectFiniteCharts(project);
    });
  }

  for (const P of ['0', '-6']) {
    it(`a WinISD .wpr with P=${P} keeps ${P} W, marked invalid-value, nothing repaired, and the charts draw`, () => {
      const {project, loadRepairs} = wprWithPower(P);
      expect(project.powerDrive_W.value).toBe(Number(P));
      expect(project.powerDrive_W.dq.map(i => i.kind)).toEqual(['invalid-value']);
      expect(loadRepairs).toEqual([]);
      expectFiniteCharts(project);
    });
  }

  it('with "Re without Rg" ticked a loaded negative power is never square-rooted: the sweep voltage is finite', () => {
    const {project} = opened(owprWithSignal({power_W: {state: 'E', value: -6}}));
    project.winisdVaModel.set(true);
    expect(Number.isFinite(project.signal.sweepVoltage_V)).toBe(true);
    expect(project.signal.sweepVoltage_V).toBeGreaterThan(0);
  });
});

describe('a typed drive level is unchanged: below 10 mV is refused, the old value stays (QO953.c21, c26)', () => {
  it('typing 5 mV into Driver input voltage keeps the old value and says why', () => {
    const project = loadProject('sealed');
    project.driveVoltage_V.set(2);
    project.driveVoltage_V.set(0.005);
    expect(project.driveVoltage_V.value).toBe(2);
    expect(project.signal.driveVoltageRefusal(0.005)).toContain('is below the 10 mV minimum');
  });

  it('typing a negative voltage or a 0 W power keeps the old value', () => {
    const project = loadProject('sealed');
    project.driveVoltage_V.set(2);
    project.driveVoltage_V.set(-6);
    expect(project.driveVoltage_V.value).toBe(2);
    project.powerDrive_W.set(3);
    project.powerDrive_W.set(0);
    expect(project.powerDrive_W.value).toBe(3);
  });
});

describe('Duplicate, What-if and a snapshot copy a loaded drive level exactly as stated (QO972)', () => {
  it('a project opened from a -6 V file copies as -6 V, and opening the copy repairs nothing', () => {
    const {project} = opened(owprWithSignal({voltage_V: {state: 'E', value: -6}}));
    expect(opened(project.toOwprText()).loadRepairs).toEqual([]);
    expect(opened(project.toStoredText()).loadRepairs).toEqual([]);
    expect(project.committedSnapshot().driveVoltage_V.value).toBe(-6);
    project.beginWhatIf();
    expect(project.driveVoltage_V.value).toBe(-6);
    expect(project.driveVoltage_V.dq.map(i => i.kind)).toEqual(['invalid-value']);
  });
});
