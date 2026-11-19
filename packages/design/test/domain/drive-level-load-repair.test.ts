/**
 * A drive level a file holds below 10 mV (Driver input voltage), or a System input power that is 0 W,
 * negative or drives below 10 mV, is repaired automatically on opening to the 10 mV minimum: the box
 * shows the repaired value with NO data-quality mark, the project lists the repair once for the
 * opening message, and the charts draw. John, 18 Nov 2026: "a repair is ok but it has to be
 * automatic" (QO953.c26); "there won't be a dq flag on a repair as the dq always relate to the value
 * the user can see" (QO953.c30). Task T918.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
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

const VOLTS = NumberField.SIGNAL_DRIVEV_V.label;
const WATTS = NumberField.SIGNAL_PIN_W.label;

describe('a drive level below 10 mV in a file is repaired on opening, with no data-quality mark (QO953.c26, c30)', () => {
  it('the Driver input voltage field states its own load repair: below its 10 mV minimum, set to 10 mV', () => {
    expect(NumberField.SIGNAL_DRIVEV_V.loadRepair).toEqual({breaks: 'min', to: 0.01, described: 'the 10 mV minimum'});
    expect(NumberField.SIGNAL_DRIVEV_V.limits.min).toBe(0.01);
  });

  for (const V of [-6, 0, 0.005]) {
    it(`a project file with Driver input voltage ${V} V opens showing 0.01 V, unmarked, the repair named once, and the charts draw`, () => {
      const {project, loadRepairs} = opened(owprWithSignal({voltage_V: {state: 'E', value: V}}));
      expect(project.driveVoltage_V.value).toBe(0.01);
      expect(project.driveVoltage_V.entered).toBe(true);
      expect(project.driveVoltage_V.dq).toEqual([]);
      expect(loadRepairs.map(r => r.text)).toEqual([`${VOLTS} ${V} V in the file: set to the 10 mV minimum`]);
      const result = projectFindings(project, DEFAULT_GRID);
      expect(result.findings).toEqual([]);
      expect(result.refused).toBe(false);
    });
  }

  for (const P of [0, -6]) {
    it(`a project file with System input power ${P} W opens at the power that drives 10 mV, unmarked, the repair named once, and the charts draw`, () => {
      const {project, loadRepairs} = opened(owprWithSignal({power_W: {state: 'E', value: P}}));
      expect(project.powerDrive_W.entered).toBe(true);
      expect(project.powerDrive_W.value).toBeGreaterThan(0);
      expect(project.driveVoltage_V.value).toBeCloseTo(0.01, 9);
      expect(project.powerDrive_W.dq).toEqual([]);
      expect(project.driveVoltage_V.dq).toEqual([]);
      const texts = loadRepairs.map(r => r.text);
      expect(texts).toHaveLength(1);
      expect(texts[0]).toMatch(new RegExp(`^${WATTS} ${P} W in the file: set to .* W, the power that drives the 10 mV minimum$`));
      const result = projectFindings(project, DEFAULT_GRID);
      expect(result.findings).toEqual([]);
      expect(result.refused).toBe(false);
    });
  }

  for (const P of ['0', '-6']) {
    it(`a WinISD .wpr with P=${P} opens at the power that drives 10 mV, unmarked, the repair named once, and the charts draw`, () => {
      const {project, loadRepairs} = wprWithPower(P);
      expect(project.driveVoltage_V.value).toBeCloseTo(0.01, 9);
      expect(project.powerDrive_W.dq).toEqual([]);
      expect(loadRepairs).toHaveLength(1);
      expect(loadRepairs[0]?.text).toMatch(new RegExp(`^${WATTS} ${P} W in the file: set to`));
      expect(projectFindings(project, DEFAULT_GRID).findings).toEqual([]);
    });
  }

  it('a stored project with an unsaved -6 V edit reopens from storage showing 0.01 V, unmarked, the repair named', () => {
    const project = loadProject('sealed');
    project.driveVoltage_V.set(2);
    const session = project.cloneSession();
    const edited = session.edited ?? session.saved;
    const text = JSON.stringify({...session, edited: {...edited, signal: {voltage_V: {state: 'E', value: -6}}}});
    const reopened = OpenISDProject.fromOwprTextRepairing(text, engine);
    if (Array.isArray(reopened)) throw new Error(reopened.join('; '));
    expect(reopened.project.driveVoltage_V.value).toBe(0.01);
    expect(reopened.project.driveVoltage_V.dq).toEqual([]);
    expect(reopened.loadRepairs.map(r => r.text)).toEqual([`${VOLTS} -6 V in the file: set to the 10 mV minimum`]);
    expect(projectFindings(reopened.project, DEFAULT_GRID).findings).toEqual([]);
  });

  it('a file within the limits opens unchanged, with nothing repaired', () => {
    const {project, loadRepairs} = opened(owprWithSignal({voltage_V: {state: 'E', value: 2}}));
    expect(project.driveVoltage_V.value).toBe(2);
    expect(loadRepairs).toEqual([]);
    expect(wprWithPower('2').loadRepairs).toEqual([]);
  });
});

describe('Duplicate, What-if and a snapshot copy a project the opening already repaired: nothing is left to repair or report (QO953.c31)', () => {
  it('a project opened from a -6 V file copies as 0.01 V, and opening the copy repairs nothing', () => {
    const {project} = opened(owprWithSignal({voltage_V: {state: 'E', value: -6}}));
    // Duplicate (appState.duplicateFocusedProject) round-trips the project's own .owpr text.
    expect(opened(project.toOwprText()).loadRepairs).toEqual([]);
    expect(opened(project.toStoredText()).loadRepairs).toEqual([]);
    expect(project.committedSnapshot().driveVoltage_V.value).toBe(0.01);
    project.beginWhatIf();
    expect(project.driveVoltage_V.value).toBe(0.01);
    expect(project.driveVoltage_V.dq).toEqual([]);
  });
});
