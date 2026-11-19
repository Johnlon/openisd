/**
 * A project file whose air, driver count, series resistance or box holds a value no design can
 * use is repaired automatically on opening: air pressure, sound velocity or density at or below 0,
 * humidity outside 0-100 %, temperature at or below 0 K; a driver or passive radiator count below 1,
 * a negative series resistance or added mass, a loss Q or port tuning at or below 0, a
 * negative port length. The box shows the repaired value with NO data-quality mark, the opening
 * message names each repair once, and the charts draw. John, 18 Nov 2026: "refuse impossible, warn
 * odd" (QO953.c14); "a 0 is just the same as clearing the value in a sense" (QO953.c28); "there
 * won't be a dq flag on a repair as the dq always relate to the value the user can see" (QO953.c30);
 * "all you can do is show a toast" (QO953.c31). Task T924.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import type {OpenedProject} from '../../domain/project/openISDProject.js';
import {NumberField} from '../../fields/field.js';
import {soundSpeedAt} from '../../engine/air.js';
import type {OpenISDProjectJson} from '../../domain/openisdSchema.js';
import {repairedRecord} from '../../domain/project/projectLoadRepairRules.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {DEFAULT_GRID, loadProject, projectFindings, wprText} from '../fixtures/inputLimitsSweep.js';
import type {ProjectName} from '../fixtures/inputLimitsSweep.js';

const engine = createEngine();

/** A starting project as a saved `.owpr` text (no unsaved edits), its record changed by `change`. */
function owprWith(name: ProjectName, change: (record: OpenISDProjectJson) => OpenISDProjectJson): string {
  const session = loadProject(name).cloneSession();
  return JSON.stringify({...session, saved: change(session.edited ?? session.saved), edited: null}, null, 2);
}

/** An `.owpr` text opened as File > Open opens it. */
function opened(text: string): OpenedProject {
  const result = OpenISDProject.fromOwprTextRepairing(text, engine);
  if (Array.isArray(result)) throw new Error(`the project did not open: ${result.join('; ')}`);
  return result;
}

/** The project's air with one entry replaced by an entered `value`. */
function withAir(key: keyof OpenISDProjectJson['environment'], value: number): (r: OpenISDProjectJson) => OpenISDProjectJson {
  return r => ({...r, environment: {...r.environment, [key]: {state: 'E', value}}});
}

/** The charts draw: nothing non-finite, nothing refused. */
function expectCharts(project: OpenISDProject): void {
  const result = projectFindings(project, DEFAULT_GRID);
  expect(result.findings).toEqual([]);
  expect(result.refused).toBe(false);
}

const STANDARD_AIR = loadProject('sealed');

describe('loaded impossible air is emptied on opening: the box shows the app\'s or the calculated value, unmarked (QO953.c14, c28, c30)', () => {
  const cases = [
    {key: 'pressure_Pa', value: 0, field: NumberField.ADV_PRESSURE_KPA, read: (p: OpenISDProject) => p.envPressurePa, line: "Air pressure 0 Pa in the file: emptied, so the box shows the app's pressure (Options)"},
    {key: 'pressure_Pa', value: -1, field: NumberField.ADV_PRESSURE_KPA, read: (p: OpenISDProject) => p.envPressurePa, line: "Air pressure -1 Pa in the file: emptied, so the box shows the app's pressure (Options)"},
    {key: 'c_m_per_s', value: 0, field: NumberField.ADV_SOUNDVELOCITY_M_PER_S, read: (p: OpenISDProject) => p.envC_m_per_s, line: 'Sound velocity 0 m/s in the file: emptied, so the box shows the value worked out from the temperature, humidity and pressure'},
    {key: 'roo_kg_per_m3', value: -100, field: NumberField.ADV_AIRDENSITY_KG_PER_M3, read: (p: OpenISDProject) => p.envRoo_kg_per_m3, line: 'Air density -100 kg/m³ in the file: emptied, so the box shows the value worked out from the temperature, humidity and pressure'},
    {key: 'humidity_pct', value: 150, field: NumberField.ADV_HUMIDITY_PCT, read: (p: OpenISDProject) => p.envHumidityPct, line: "Relative humidity 150 % in the file: emptied, so the box shows the app's humidity (Options)"},
    {key: 'humidity_pct', value: -5, field: NumberField.ADV_HUMIDITY_PCT, read: (p: OpenISDProject) => p.envHumidityPct, line: "Relative humidity -5 % in the file: emptied, so the box shows the app's humidity (Options)"},
    {key: 'temperature_K', value: 0, field: NumberField.ADV_TEMP_K, read: (p: OpenISDProject) => p.envTempK, line: "Temperature 0 K in the file: emptied, so the box shows the app's temperature (Options)"},
    {key: 'temperature_K', value: -20, field: NumberField.ADV_TEMP_K, read: (p: OpenISDProject) => p.envTempK, line: "Temperature -20 K in the file: emptied, so the box shows the app's temperature (Options)"},
  ] as const;

  for (const c of cases) {
    it(`${c.field.label} ${c.value} in a project file opens calculated, unmarked, the repair named once, and the charts draw`, () => {
      const {project, loadRepairs} = opened(owprWith('sealed', withAir(c.key, c.value)));
      const field = c.read(project);
      expect(field.entered).toBe(false);
      expect(field.value).not.toBeNull();
      expect(field.value).toBeGreaterThan(0);
      expect(field.dq).toEqual([]);
      for (const other of [project.envTempK, project.envHumidityPct, project.envPressurePa, project.envC_m_per_s, project.envRoo_kg_per_m3]) {
        expect(other.dq).toEqual([]);
      }
      expect(loadRepairs.map(r => r.text)).toEqual([c.line]);
      expect(project.air.c()).toBeCloseTo(STANDARD_AIR.air.c(), 6);
      expectCharts(project);
    });
  }

  it('a WinISD .wpr with T=0, p=0 and phi=2 (200 %) opens in the app\'s air, three repairs named, the charts draw', () => {
    const plain = wprText('sealed');
    const text = plain.replace('T=293.15\n', 'T=0\n').replace('p=101325\n', 'p=0\n').replace('phi=0.3\n', 'phi=2\n');
    expect(text, 'the sealed W5 file states T, p and phi').not.toBe(plain);
    const {value, errors, loadRepairs} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
    if (value === null) throw new Error(errors.map(e => e.message).join('; '));
    expect(loadRepairs.map(r => r.field)).toEqual([NumberField.ADV_TEMP_K, NumberField.ADV_HUMIDITY_PCT, NumberField.ADV_PRESSURE_KPA]);
    expect(value.envTempK.entered).toBe(false);
    expect(value.envPressurePa.dq).toEqual([]);
    expectCharts(value);
  });

  it('odd but possible air in a file (pressure 5000 Pa, 330 K, 60 %) is kept as it is and nothing is repaired', () => {
    const {project, loadRepairs} = opened(owprWith('sealed', r => withAir('temperature_K', 330)(withAir('humidity_pct', 60)(withAir('pressure_Pa', 5000)(r)))));
    expect(loadRepairs).toEqual([]);
    expect(project.envPressurePa.value).toBe(5000);
    expect(project.envPressurePa.entered).toBe(true);
    expect(project.envTempK.value).toBe(330);
    expect(project.envHumidityPct.value).toBe(60);
    expectCharts(project);
  });
});

describe('the air boxes warn outside their normal band, keeping and using the value (QO953.c14 "warn odd")', () => {
  for (const {field, set, value, says} of [
    {field: NumberField.ADV_PRESSURE_KPA, set: (p: OpenISDProject) => p.envPressurePa, value: 1000, says: 'Air pressure 1000 Pa is outside the sane range for air (30000 Pa to 110000 Pa). It is kept and used; check it.'},
    {field: NumberField.ADV_SOUNDVELOCITY_M_PER_S, set: (p: OpenISDProject) => p.envC_m_per_s, value: 1000, says: 'Sound velocity 1000.00 m/s is outside the sane range for air (260.00 m/s to 500.00 m/s). It is kept and used; check it.'},
    {field: NumberField.ADV_AIRDENSITY_KG_PER_M3, set: (p: OpenISDProject) => p.envRoo_kg_per_m3, value: 10, says: 'Air density 10.00 kg/m³ is outside the sane range for air (0.15 kg/m³ to 2.25 kg/m³). It is kept and used; check it.'},
    {field: NumberField.ADV_TEMP_K, set: (p: OpenISDProject) => p.envTempK, value: 400, says: 'Temperature 400.00 K is outside the sane range for air (174.00 K to 373.00 K). It is kept and used; check it.'},
  ]) {
    it(`${field.label} ${value} is stored, marked with the band, and the charts draw`, () => {
      const project = loadProject('sealed');
      set(project).set(value);
      expect(set(project).value).toBe(value);
      expect(set(project).dq.map(i => i.text)).toContain(says);
      // A warning of its own kind, never a conflict: the box says it without "Conflicts with other values".
      expect(set(project).dq.filter(i => i.text === says).map(i => i.kind)).toEqual(['outside-normal-band']);
      expectCharts(project);
    });
  }

  it('20 C air, as WinISD starts, carries no mark on any air box', () => {
    const project = loadProject('sealed');
    project.envTempK.set(293.15);
    for (const f of [project.envTempK, project.envHumidityPct, project.envPressurePa, project.envC_m_per_s, project.envRoo_kg_per_m3]) expect(f.dq).toEqual([]);
  });

  it("each air field's normal band holds the air model's own values over the temperature, humidity and pressure bands", () => {
    const {ADV_TEMP_K: T, ADV_PRESSURE_KPA: P, ADV_SOUNDVELOCITY_M_PER_S: C, ADV_AIRDENSITY_KG_PER_M3: R} = NumberField;
    for (const tempK of [T.plausible.min, 293.15, T.plausible.max]) for (const rh of [0, 50, 100]) for (const p of [P.plausible.min, 101325, P.plausible.max]) {
      const c = soundSpeedAt(tempK, rh, p);
      const rho = 1.4 * p / c ** 2;
      expect(c, `c at ${tempK} K, ${rh} %, ${p} Pa`).toBeGreaterThanOrEqual(C.plausible.min);
      expect(c).toBeLessThanOrEqual(C.plausible.max);
      expect(rho, `rho at ${tempK} K, ${rh} %, ${p} Pa`).toBeGreaterThanOrEqual(R.plausible.min);
      expect(rho).toBeLessThanOrEqual(R.plausible.max);
    }
  });
});

describe('the other loaded impossible values T916 flagged and blocked are repaired on opening, unmarked, named once (QO953.c28)', () => {
  it('driver count 0 opens as 1 and series resistance -2 Ω as 0 Ω', () => {
    const {project, loadRepairs} = opened(owprWith('sealed', r => ({...r, driverEmbedding: {...r.driverEmbedding, nDrivers: 0, Rs_ohm: -2}})));
    expect(project.nDrivers.value).toBe(1);
    expect(project.Rs_ohm.value).toBe(0);
    expect(loadRepairs.map(n => n.text)).toEqual([
      'Num. of drivers 0 in the file: set to 1, the fewest',
      'Series resistance -2 Ω in the file: set to 0 Ω, the least',
    ]);
    expectCharts(project);
  });

  it("a sealed box's Ql 0 and Qa -1 open at WinISD's defaults 10 and 100", () => {
    const {project, loadRepairs} = opened(owprWith('sealed', r => ({...r, box: {...r.box, sealed: {...r.box.sealed, losses: {Ql: 0, Qa: -1}}}})));
    expect(project.box.sealed.losses.Ql.value).toBe(10);
    expect(project.box.sealed.losses.Qa.value).toBe(100);
    expect(loadRepairs.map(n => n.text)).toEqual([
      "Leakage Ql 0 in the file: set to 10, WinISD's default",
      "Absorption Qa -1 in the file: set to 100, WinISD's default",
    ]);
    expectCharts(project);
  });

  it('a vented box whose tuning was entered as 0 Hz opens with the tuning worked out from the port length the file gave', () => {
    const before = loadProject('vented');
    const length = before.box.vented.vent.length_m.value;
    expect(length).not.toBeNull();
    const {project, loadRepairs} = opened(owprWith('vented', r => ({...r, box: {...r.box, vented: {
      ...r.box.vented, chamber: {...r.box.vented.chamber, tuning_goal_hz: {state: 'E', value: 0}},
    }}})));
    expect(loadRepairs.map(n => n.text)).toEqual(['Tuning freq (Fb) 0 Hz in the file: emptied, so the box shows the tuning worked out from the port']);
    expect(project.box.vented.tuning_goal_hz.value).toBeCloseTo(38, 6);
    expect(project.box.vented.vent.length_m.value).toBe(length);
    expect(project.box.vented.vent.length_m.entered).toBe(true);
    expect(project.box.vented.tuning_goal_hz.dq).toEqual([]);
    expectCharts(project);
  });

  it('a vented port length entered as -0.05 m opens with the length worked out from the tuning', () => {
    const before = loadProject('vented');
    const Fb = before.box.vented.tuning_goal_hz.value;
    expect(Fb).not.toBeNull();
    const {project, loadRepairs} = opened(owprWith('vented', r => ({...r, box: {...r.box, vented: {
      chamber: {...r.box.vented.chamber, tuning_goal_hz: {state: 'E', value: Fb ?? 0}},
      vent: {...r.box.vented.vent, length_m: {state: 'E', value: -0.05}},
    }}})));
    // The project file reader's own repair (`repaired`) already drops a negative entry; the load
    // repair pass is the same rule for a record that reaches it another way (a stored session).
    expect(loadRepairs).toEqual([]);
    expect(project.box.vented.vent.length_m.value).toBe(before.box.vented.vent.length_m.value);
    expectCharts(project);
  });

  it('the record repair empties a negative entered port length, so the resolve works it out from the tuning', () => {
    const r = loadProject('vented').cloneSession().saved;
    const {record, notes} = repairedRecord({...r, box: {...r.box, vented: {...r.box.vented, vent: {...r.box.vented.vent, length_m: {state: 'E', value: -0.05}}}}});
    expect(notes.map(n => n.text)).toEqual(['Vent length -5 cm in the file: emptied, so the box shows the length worked out from the tuning']);
    expect(record.box.vented.vent.length_m).toBeUndefined();
  });

  it('a 6th-order bandpass rear tuning (Frc) entered as 0 Hz opens worked out from the rear port', () => {
    const {project, loadRepairs} = opened(owprWith('bandpass6', r => ({...r, box: {...r.box, bandpass6: {...r.box.bandpass6,
      rear: {...r.box.bandpass6.rear, tuning_goal_hz: {state: 'E', value: 0}},
    }}})));
    expect(loadRepairs.map(n => n.text)).toEqual(['Tuning freq (Frc) 0 Hz in the file: emptied, so the box shows the tuning worked out from the port']);
    expect(project.box.bandpass6.chambers.rear.tuning_goal_hz.value).toBeCloseTo(42, 6);
    expectCharts(project);
  });

  it('a passive radiator count of 0 opens as 1, an added mass of -0.01 kg as 0 g, a 4th-order bandpass Qicl 0 at 100', () => {
    const pr = opened(owprWith('passive radiator', r => ({...r, box: {...r.box, passiveRadiator: {...r.box.passiveRadiator,
      count: 0, addedMass_kg: {state: 'E', value: -0.01}}}})));
    expect(pr.loadRepairs.map(n => n.text)).toEqual([
      'Num. of PRs 0 in the file: set to 1, the fewest',
      'Added mass to cone -10 g in the file: set to 0 g, no added mass',
    ]);
    expectCharts(pr.project);
    const bp4 = opened(owprWith('bandpass4', r => ({...r, box: {...r.box, bandpass4: {...r.box.bandpass4, Qiclfr: 0}}})));
    expect(bp4.loadRepairs.map(n => n.text)).toEqual(["Interchamber Qicl 0 in the file: set to 100, WinISD's default"]);
    expectCharts(bp4.project);
  });

  it('a project opened from a repaired file copies with nothing left to repair', () => {
    const {project} = opened(owprWith('sealed', withAir('pressure_Pa', 0)));
    expect(opened(project.toOwprText()).loadRepairs).toEqual([]);
    expect(opened(project.toStoredText()).loadRepairs).toEqual([]);
  });
});
